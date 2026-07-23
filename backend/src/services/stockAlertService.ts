/**
 * ============================================================================
 * Toroloom — Stock Price Alert Service
 * ============================================================================
 *
 * Manages user-defined stock price alerts backed by the `stock_alerts` table
 * (created via migration 002_add_stock_alerts.sql). Uses direct SQL for
 * PostgreSQL and falls back to in-memory storage when no DB is configured.
 *
 * Features:
 *   - Full CRUD for user alerts
 *   - Target price + direction (above/below)
 *   - Status tracking (active → triggered → cancelled)
 *   - Symbol-based batch lookup for backend poller
 *
 * Usage:
 *   import { configureStockAlertPersistence, createAlert, listUserAlerts, ... }
 *     from './services/stockAlertService';
 *
 *   configureStockAlertPersistence(pool);
 *   const alert = await createAlert('user_1', 'RELIANCE', 2890, 'above');
 *
 * ============================================================================
 */

import crypto from 'crypto';
import type { Pool } from 'pg';

// ──── Types ──────────────────────────────────────────────────────────────

export interface StockAlert {
  id: string;
  userId: string;
  symbol: string;
  targetPrice: number;
  direction: 'above' | 'below';
  status: 'active' | 'triggered' | 'cancelled';
  triggeredAt: string | null;
  triggeredPrice: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertInput {
  symbol: string;
  targetPrice: number;
  direction: 'above' | 'below';
  note?: string;
}

export interface UpdateAlertInput {
  targetPrice?: number;
  direction?: 'above' | 'below';
  status?: 'active' | 'cancelled';
  note?: string;
}

// ──── Module-level state ─────────────────────────────────────────────────

let _pool: Pool | null = null;

/**
 * In-memory fallback storage used when no PostgreSQL pool is configured.
 * Maps userId → Map<alertId, StockAlert>
 */
const _memoryStore = new Map<string, Map<string, StockAlert>>();

// ──── Configuration ──────────────────────────────────────────────────────

/**
 * Wire the PostgreSQL pool into the stock alert service.
 * When called with a pool, all CRUD uses direct SQL against stock_alerts.
 * When null (or not called), falls back to in-memory storage.
 */
export function configureStockAlertPersistence(pool: Pool | null): void {
  _pool = pool;
}

function getPool(): Pool | null {
  return _pool;
}

// ──── ID Generation ─────────────────────────────────────────────────────

function generateId(): string {
  return `sa_${crypto.randomUUID().slice(0, 18)}`;
}

// ──── CRUD Operations ───────────────────────────────────────────────────

/**
 * Create a new stock price alert.
 */
export async function createAlert(
  userId: string,
  input: CreateAlertInput,
): Promise<StockAlert> {
  const now = new Date().toISOString();
  const alert: StockAlert = {
    id: generateId(),
    userId,
    symbol: input.symbol.toUpperCase().trim(),
    targetPrice: input.targetPrice,
    direction: input.direction,
    status: 'active',
    triggeredAt: null,
    triggeredPrice: null,
    note: input.note?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };

  const pool = getPool();
  if (pool) {
    await pool.query(
      `INSERT INTO stock_alerts (id, user_id, symbol, target_price, direction, status, triggered_at, triggered_price, note, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        alert.id,
        alert.userId,
        alert.symbol,
        alert.targetPrice,
        alert.direction,
        alert.status,
        alert.triggeredAt,
        alert.triggeredPrice,
        alert.note,
        alert.createdAt,
        alert.updatedAt,
      ],
    );
  } else {
    // In-memory fallback
    let userAlerts = _memoryStore.get(userId);
    if (!userAlerts) {
      userAlerts = new Map();
      _memoryStore.set(userId, userAlerts);
    }
    userAlerts.set(alert.id, { ...alert });
  }

  return alert;
}

/**
 * Get a single alert by ID. Only returns if it belongs to the given user.
 */
export async function getAlert(
  alertId: string,
  userId: string,
): Promise<StockAlert | null> {
  const pool = getPool();
  if (pool) {
    const result = await pool.query(
      'SELECT * FROM stock_alerts WHERE id = $1 AND user_id = $2',
      [alertId, userId],
    );
    if (result.rows.length === 0) return null;
    return rowToAlert(result.rows[0]);
  }

  // In-memory fallback
  const userAlerts = _memoryStore.get(userId);
  if (!userAlerts) return null;
  return userAlerts.get(alertId) || null;
}

/**
 * List all alerts for a user, newest first.
 */
export async function listUserAlerts(userId: string): Promise<StockAlert[]> {
  const pool = getPool();
  if (pool) {
    const result = await pool.query(
      'SELECT * FROM stock_alerts WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows.map(rowToAlert);
  }

  // In-memory fallback
  const userAlerts = _memoryStore.get(userId);
  if (!userAlerts) return [];
  return Array.from(userAlerts.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Update an alert. Only allows updating targetPrice, direction, status, and note.
 * Returns the updated alert, or null if not found / not owned.
 */
export async function updateAlert(
  alertId: string,
  userId: string,
  updates: UpdateAlertInput,
): Promise<StockAlert | null> {
  const pool = getPool();
  if (pool) {
    // Build dynamic UPDATE
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (updates.targetPrice !== undefined) {
      setClauses.push(`target_price = $${paramIdx++}`);
      params.push(updates.targetPrice);
    }
    if (updates.direction !== undefined) {
      setClauses.push(`direction = $${paramIdx++}`);
      params.push(updates.direction);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIdx++}`);
      params.push(updates.status);
    }
    if (updates.note !== undefined) {
      setClauses.push(`note = $${paramIdx++}`);
      params.push(updates.note);
    }

    if (setClauses.length === 0) {
      // No changes — just return the existing alert
      return getAlert(alertId, userId);
    }

    setClauses.push(`updated_at = $${paramIdx++}`);
    params.push(new Date().toISOString());

    // WHERE id and user_id
    params.push(alertId);
    params.push(userId);

    const query = `UPDATE stock_alerts SET ${setClauses.join(', ')} WHERE id = $${paramIdx++} AND user_id = $${paramIdx++} RETURNING *`;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) return null;
    return rowToAlert(result.rows[0]);
  }

  // In-memory fallback
  const userAlerts = _memoryStore.get(userId);
  if (!userAlerts) return null;
  const alert = userAlerts.get(alertId);
  if (!alert) return null;

  if (updates.targetPrice !== undefined) alert.targetPrice = updates.targetPrice;
  if (updates.direction !== undefined) alert.direction = updates.direction;
  if (updates.status !== undefined) alert.status = updates.status;
  if (updates.note !== undefined) alert.note = updates.note;
  alert.updatedAt = new Date().toISOString();

  userAlerts.set(alertId, { ...alert });
  return { ...alert };
}

/**
 * Delete an alert by ID. Returns true if deleted, false if not found.
 */
export async function deleteAlert(
  alertId: string,
  userId: string,
): Promise<boolean> {
  const pool = getPool();
  if (pool) {
    const result = await pool.query(
      'DELETE FROM stock_alerts WHERE id = $1 AND user_id = $2',
      [alertId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // In-memory fallback
  const userAlerts = _memoryStore.get(userId);
  if (!userAlerts) return false;
  return userAlerts.delete(alertId);
}

/**
 * Trigger an alert — mark it as triggered with the current market price.
 * Returns the updated alert, or null if not found.
 */
export async function triggerAlert(
  alertId: string,
  userId: string,
  triggeredPrice: number,
): Promise<StockAlert | null> {
  const now = new Date().toISOString();
  const pool = getPool();

  if (pool) {
    const result = await pool.query(
      `UPDATE stock_alerts
       SET status = 'triggered', triggered_at = $1, triggered_price = $2, updated_at = $3
       WHERE id = $4 AND user_id = $5 AND status = 'active'
       RETURNING *`,
      [now, triggeredPrice, now, alertId, userId],
    );
    if (result.rows.length === 0) return null;
    return rowToAlert(result.rows[0]);
  }

  // In-memory fallback
  const userAlerts = _memoryStore.get(userId);
  if (!userAlerts) return null;
  const alert = userAlerts.get(alertId);
  if (!alert || alert.status !== 'active') return null;

  alert.status = 'triggered';
  alert.triggeredAt = now;
  alert.triggeredPrice = triggeredPrice;
  alert.updatedAt = now;

  userAlerts.set(alertId, { ...alert });
  return { ...alert };
}

/**
 * Get all active alerts for a set of symbols (for the backend poller).
 * When symbols is empty, returns all active alerts across all symbols.
 */
export async function getActiveAlertsBySymbols(
  symbols: string[],
): Promise<Map<string, StockAlert[]>> {
  const pool = getPool();
  if (pool) {
    let query: string;
    let params: string[];

    if (symbols.length === 0) {
      // Fetch all active alerts (no symbol filter)
      query = `SELECT * FROM stock_alerts WHERE status = 'active' ORDER BY symbol, created_at ASC`;
      params = [];
    } else {
      const placeholders = symbols.map((_, i) => `$${i + 1}`);
      query = `SELECT * FROM stock_alerts WHERE symbol IN (${placeholders.join(',')}) AND status = 'active' ORDER BY symbol, created_at ASC`;
      params = symbols;
    }

    const result = await pool.query(query, params);

    const grouped = new Map<string, StockAlert[]>();
    for (const row of result.rows) {
      const alert = rowToAlert(row);
      const existing = grouped.get(alert.symbol) || [];
      existing.push(alert);
      grouped.set(alert.symbol, existing);
    }
    return grouped;
  }

  // In-memory fallback — scan all users
  const grouped = new Map<string, StockAlert[]>();
  for (const userAlerts of _memoryStore.values()) {
    for (const alert of userAlerts.values()) {
      if (alert.status !== 'active') continue;
      if (symbols.length > 0 && !symbols.includes(alert.symbol)) continue;
      const existing = grouped.get(alert.symbol) || [];
      existing.push(alert);
      grouped.set(alert.symbol, existing);
    }
  }
  return grouped;
}

// ──── Helpers ───────────────────────────────────────────────────────────

function rowToAlert(row: any): StockAlert {
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    targetPrice: parseFloat(row.target_price),
    direction: row.direction,
    status: row.status,
    triggeredAt: row.triggered_at || null,
    triggeredPrice: row.triggered_price ? parseFloat(row.triggered_price) : null,
    note: row.note || null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}
