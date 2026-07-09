/**
 * ============================================================================
 * Toroloom — Sync Service
 * ============================================================================
 *
 * Core sync engine that processes mutation batches from the frontend,
 * detects data conflicts using optimistic concurrency (version stamps),
 * and returns delta responses for minimal data transfer.
 *
 * Conflict detection strategy:
 *   Each syncable entity has a `version` integer that increments on every
 *   server-side mutation.  The frontend sends its local version along with
 *   the mutation payload.  If the server version is newer, the mutation is
 *   rejected with a 409 Conflict response containing the current server
 *   state so the frontend can re-resolve.
 *
 * Delta sync:
 *   The frontend sends a `lastSyncTimestamp` — the server returns only
 *   entities that have changed since that timestamp.  This minimises
 *   transfer size on full-sync requests.
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { broadcastMutationsInvalidation } from './syncInvalidationBridge';

// ──── Types ────────────────────────────────────────────────────────────────

export interface SyncableEntity {
  id: string;
  version: number;
  updatedAt: string;
}

export interface SyncMutation {
  /** Client-generated mutation ID (for idempotency) */
  mutationId: string;
  /** Mutation type */
  type: string;
  /** The entity being mutated */
  entityType: string;
  /** Entity ID (null for creates) */
  entityId: string | null;
  /** Mutation payload */
  payload: Record<string, unknown>;
  /** Client-side entity version (null for creates) */
  clientVersion: number | null;
  /** When the mutation was enqueued on the client */
  enqueuedAt: string;
}

export interface SyncRequest {
  /** ISO timestamp of last successful sync */
  lastSyncTimestamp: string | null;
  /** Batch of mutations to apply */
  mutations: SyncMutation[];
}

export interface SyncResult {
  /** Mutations that were applied successfully */
  applied: { mutationId: string; entityId: string; newVersion: number }[];
  /** Mutations that failed due to conflicts */
  conflicts: {
    mutationId: string;
    entityType: string;
    entityId: string | null;
    clientVersion: number | null;
    serverVersion: number;
    serverState: Record<string, unknown> | null;
    error: string;
  }[];
  /** Mutations that failed due to transient errors */
  failed: { mutationId: string; error: string }[];
  /** Delta changes since lastSyncTimestamp */
  delta: { entityType: string; entityId: string; data: Record<string, unknown> }[];
  /** New sync timestamp for the next request */
  newSyncTimestamp: string;
}

// ──── In-Memory Entity Store (for demo; replace with DB in production) ─────

interface EntityRecord {
  id: string;
  type: string;
  userId: string;
  version: number;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

// Key: `${entityType}:${entityId}`
const _entityStore = new Map<string, EntityRecord>();
const _mutationDedup = new Set<string>(); // mutationIds seen within the last 5 min

// ──── Conflict Detection ───────────────────────────────────────────────────

export interface ConflictCheckResult {
  hasConflict: boolean;
  currentServerVersion: number;
  serverState: Record<string, unknown> | null;
  error?: string;
}

/**
 * Check if a mutation conflicts with the current server state.
 * Returns conflict info if the server version is newer.
 */
function checkConflict(
  entityType: string,
  entityId: string | null,
  clientVersion: number | null,
  userId: string,
): ConflictCheckResult {
  if (!entityId) {
    // Creating a new entity — no conflict possible
    return { hasConflict: false, currentServerVersion: 0, serverState: null };
  }

  const key = `${entityType}:${entityId}`;
  const current = _entityStore.get(key);

  if (!current) {
    // Entity doesn't exist on server
    if (clientVersion !== null) {
      return {
        hasConflict: true,
        currentServerVersion: 0,
        serverState: null,
        error: `Entity ${entityType}:${entityId} not found on server`,
      };
    }
    return { hasConflict: false, currentServerVersion: 0, serverState: null };
  }

  if (current.deleted) {
    return {
      hasConflict: true,
      currentServerVersion: current.version,
      serverState: null,
      error: `Entity ${entityType}:${entityId} was deleted on server`,
    };
  }

  if (clientVersion !== null && clientVersion < current.version) {
    return {
      hasConflict: true,
      currentServerVersion: current.version,
      serverState: current.data,
    };
  }

  return { hasConflict: false, currentServerVersion: current.version, serverState: current.data };
}

// ──── Mutation Handlers ────────────────────────────────────────────────────

type MutationHandler = (
  mutation: SyncMutation,
  userId: string,
) => Promise<{ success: boolean; entityId: string; data?: Record<string, unknown>; error?: string }>;

const _mutationHandlers = new Map<string, MutationHandler>();

/**
 * Register a handler for a specific mutation type.
 */
export function registerMutationHandler(
  type: string,
  handler: MutationHandler,
): void {
  _mutationHandlers.set(type, handler);
}

/**
 * Get registered mutation handler for a type.
 */
function getHandler(type: string): MutationHandler | undefined {
  return _mutationHandlers.get(type);
}

// ──── Core Sync Logic ──────────────────────────────────────────────────────

/**
 * Apply a single mutation with conflict detection.
 */
async function applyMutation(
  mutation: SyncMutation,
  userId: string,
): Promise<
  | { status: 'applied'; entityId: string; newVersion: number }
  | { status: 'conflict'; serverVersion: number; serverState: Record<string, unknown> | null; error: string }
  | { status: 'failed'; error: string }
> {
  // 1. Idempotency check — skip if already processed
  if (_mutationDedup.has(mutation.mutationId)) {
    // Find the result from a previous application
    // For simplicity, treat as applied (idempotent)
    return { status: 'applied', entityId: mutation.entityId || `entity_${Date.now()}`, newVersion: 0 };
  }

  // 2. Conflict check
  const conflict = checkConflict(
    mutation.entityType,
    mutation.entityId,
    mutation.clientVersion,
    userId,
  );

  if (conflict.hasConflict) {
    // @ts-ignore: conflict.error exists but isn't in the return type
    return {
      status: 'conflict',
      serverVersion: conflict.currentServerVersion,
      serverState: conflict.serverState,
      // @ts-ignore
      error: conflict.error || 'Version conflict — server has newer data',
    };
  }

  // 3. Find and execute the handler
  const handler = getHandler(mutation.type);
  if (!handler) {
    return { status: 'failed', error: `No handler registered for mutation type: ${mutation.type}` };
  }

  try {
    const result = await handler(mutation, userId);
    if (!result.success) {
      return { status: 'failed', error: result.error || 'Handler returned failure' };
    }

    // 4. Dedup — add mutationId to seen set
    _mutationDedup.add(mutation.mutationId);
    // Cleanup dedup set after 5 minutes
    setTimeout(() => _mutationDedup.delete(mutation.mutationId), 5 * 60 * 1000);

    return { status: 'applied', entityId: result.entityId, newVersion: conflict.currentServerVersion + 1 };
  } catch (err: any) {
    return { status: 'failed', error: err?.message || 'Unknown error applying mutation' };
  }
}

/**
 * Process a full sync request from the client.
 */
export async function processSyncRequest(
  request: SyncRequest,
  userId: string,
): Promise<SyncResult> {
  const now = new Date().toISOString();

  // 1. Apply all mutations
  const applied: SyncResult['applied'] = [];
  const conflicts: SyncResult['conflicts'] = [];
  const failed: SyncResult['failed'] = [];

  for (const mutation of request.mutations) {
    const result = await applyMutation(mutation, userId);
    if (result.status === 'applied') {
      applied.push({
        mutationId: mutation.mutationId,
        entityId: result.entityId,
        newVersion: result.newVersion,
      });
    } else if (result.status === 'conflict') {
      conflicts.push({
        mutationId: mutation.mutationId,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        clientVersion: mutation.clientVersion,
        serverVersion: result.serverVersion,
        serverState: result.serverState,
        error: result.error,
      });
    } else {
      failed.push({
        mutationId: mutation.mutationId,
        error: result.error,
      });
    }
  }

  // 2. Compute delta — entities changed since lastSyncTimestamp
  const delta: SyncResult['delta'] = [];
  const sinceTimestamp = request.lastSyncTimestamp
    ? new Date(request.lastSyncTimestamp).getTime()
    : 0;

  for (const [, record] of _entityStore) {
    if (record.userId !== userId) continue;
    const updatedMs = new Date(record.updatedAt).getTime();
    if (updatedMs > sinceTimestamp) {
      delta.push({
        entityType: record.type,
        entityId: record.id,
        data: record.data,
      });
    }
  }

  return {
    applied,
    conflicts,
    failed,
    delta,
    newSyncTimestamp: now,
  };
}

// ──── Default Mutation Handlers ────────────────────────────────────────────

// Stock operations
registerMutationHandler('BUY_STOCK', async (mutation, userId) => {
  const { symbol, quantity, price } = mutation.payload as any;
  const entityId = mutation.entityId || `position_${uuidv4().slice(0, 8)}`;
  const key = `${mutation.entityType}:${entityId}`;

  _entityStore.set(key, {
    id: entityId,
    type: mutation.entityType,
    userId,
    version: (mutation.clientVersion || 0) + 1,
    data: {
      symbol,
      quantity,
      price,
      action: 'BUY',
      executedAt: new Date().toISOString(),
      status: 'confirmed',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
  });

  return { success: true, entityId };
});

registerMutationHandler('SELL_STOCK', async (mutation, userId) => {
  const { symbol, quantity, price } = mutation.payload as any;
  const entityId = mutation.entityId || `position_${uuidv4().slice(0, 8)}`;
  const key = `${mutation.entityType}:${entityId}`;

  _entityStore.set(key, {
    id: entityId,
    type: mutation.entityType,
    userId,
    version: (mutation.clientVersion || 0) + 1,
    data: {
      symbol,
      quantity,
      price,
      action: 'SELL',
      executedAt: new Date().toISOString(),
      status: 'confirmed',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
  });

  return { success: true, entityId };
});

// Watchlist operations
registerMutationHandler('ADD_TO_WATCHLIST', async (mutation, userId) => {
  const { watchlistId, symbol } = mutation.payload as any;
  const key = `watchlist_stock:${watchlistId}:${symbol}`;

  // Check if stock already in watchlist
  if (_entityStore.has(key)) {
    return { success: false, entityId: watchlistId, error: 'Stock already in watchlist' };
  }

  _entityStore.set(key, {
    id: `${watchlistId}:${symbol}`,
    type: 'watchlist_stock',
    userId,
    version: 1,
    data: { watchlistId, symbol, addedAt: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
  });

  return { success: true, entityId: watchlistId };
});

registerMutationHandler('REMOVE_FROM_WATCHLIST', async (mutation, userId) => {
  const { watchlistId, symbol } = mutation.payload as any;
  const key = `watchlist_stock:${watchlistId}:${symbol}`;

  const existing = _entityStore.get(key);
  if (existing) {
    existing.deleted = true;
    existing.updatedAt = new Date().toISOString();
    existing.version++;
  }

  return { success: true, entityId: watchlistId };
});

registerMutationHandler('CREATE_WATCHLIST', async (mutation, userId) => {
  const { name } = mutation.payload as any;
  const entityId = mutation.entityId || `watchlist_${uuidv4().slice(0, 8)}`;
  const key = `watchlist:${entityId}`;

  _entityStore.set(key, {
    id: entityId,
    type: 'watchlist',
    userId,
    version: 1,
    data: { name, stocks: [], createdAt: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
  });

  return { success: true, entityId };
});

registerMutationHandler('DELETE_WATCHLIST', async (mutation, userId) => {
  const { watchlistId } = mutation.payload as any;
  const key = `watchlist:${watchlistId}`;

  const existing = _entityStore.get(key);
  if (existing) {
    existing.deleted = true;
    existing.updatedAt = new Date().toISOString();
    existing.version++;
  }

  return { success: true, entityId: watchlistId };
});

// Order operations
registerMutationHandler('MODIFY_ORDER', async (mutation, userId) => {
  const { orderId, ...updates } = mutation.payload as any;
  const key = `order:${orderId}`;

  const existing = _entityStore.get(key);
  if (existing) {
    existing.data = { ...existing.data, ...updates, modifiedAt: new Date().toISOString() };
    existing.version++;
    existing.updatedAt = new Date().toISOString();
    return { success: true, entityId: orderId };
  }

  return { success: false, entityId: orderId, error: 'Order not found' };
});

registerMutationHandler('CANCEL_ORDER', async (mutation, userId) => {
  const { orderId } = mutation.payload as any;
  const key = `order:${orderId}`;

  const existing = _entityStore.get(key);
  if (existing) {
    existing.data = { ...existing.data, status: 'cancelled', cancelledAt: new Date().toISOString() };
    existing.version++;
    existing.updatedAt = new Date().toISOString();
    return { success: true, entityId: orderId };
  }

  return { success: false, entityId: orderId, error: 'Order not found' };
});

// ──── Express Router ───────────────────────────────────────────────────────

const router = Router();

/**
 * POST /api/sync
 *
 * Processes a batch of mutations from the client with conflict detection
 * and returns the sync result including delta changes.
 *
 * Body (SyncRequest):
 *   {
 *     lastSyncTimestamp: string | null,
 *     mutations: SyncMutation[]
 *   }
 *
 * Response (SyncResult):
 *   {
 *     applied: { mutationId, entityId, newVersion }[],
 *     conflicts: { mutationId, entityType, entityId, clientVersion, serverVersion, serverState, error }[],
 *     failed: { mutationId, error }[],
 *     delta: { entityType, entityId, data }[],
 *     newSyncTimestamp: string
 *   }
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Validate request body
    const schema = z.object({
      lastSyncTimestamp: z.string().nullable(),
      mutations: z.array(
        z.object({
          mutationId: z.string(),
          type: z.string(),
          entityType: z.string(),
          entityId: z.string().nullable(),
          payload: z.record(z.unknown()),
          clientVersion: z.number().nullable(),
          enqueuedAt: z.string(),
        }),
      ),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid sync request', details: parsed.error.issues });
      return;
    }

    const result = await processSyncRequest(parsed.data, userId);
    res.json(result);

    // Broadcast cache invalidation to connected WebSocket clients
    // (fire-and-forget — no await to avoid blocking the response)
    broadcastMutationsInvalidation(userId, parsed.data.mutations, result.applied);
  } catch (err: any) {
    res.status(500).json({ error: 'Sync processing failed', message: err?.message });
  }
});

/**
 * GET /api/sync/status
 *
 * Returns sync status for the current user — total entities, last mutation,
 * and current version stamps. Used by the client to check if a full sync
 * is needed.
 */
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  let totalEntities = 0;
  let latestUpdatedAt = '';

  for (const [, record] of _entityStore) {
    if (record.userId === userId && !record.deleted) {
      totalEntities++;
      if (record.updatedAt > latestUpdatedAt) {
        latestUpdatedAt = record.updatedAt;
      }
    }
  }

  res.json({
    userId,
    totalEntities,
    latestUpdatedAt,
    serverTime: new Date().toISOString(),
  });
});

export default router;
