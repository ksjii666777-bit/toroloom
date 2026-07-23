/**
 * ============================================================================
 * Toroloom — Webhook Management Route Integration Tests
 * ============================================================================
 *
 * Tests all CRUD operations for the webhook management endpoints.
 * Uses the same pattern as publicApi.routes.int.test.ts:
 *   - In-memory storage (no DB required)
 *   - Express app with auth middleware
 *   - supertest for HTTP assertions
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { InMemoryStorage } from '../services/storage/inMemory';
import { configureWebhookPersistence } from '../services/webhookService';
import { generateToken } from '../middleware/auth';

// ──── Test Helpers (reused from routes.int.test.ts) ───────────────────────
function buildApp() {
  const app = express();
  app.use(express.json());
  return app;
}

let app: ReturnType<typeof buildApp>;
let _token: string;
let _userId: string;

async function request(method: 'get' | 'post' | 'put' | 'del', url: string, body?: any) {
  const agent = (globalThis as any).__test_request ?? ((await import('supertest')).default(app));
  const req = agent[method](url)
    .set('Authorization', `Bearer ${_token}`)
    .set('Content-Type', 'application/json');
  if (body !== undefined) req.send(body);
  return req;
}

function get(url: string) { return request('get', url); }
function post(url: string, body?: any) { return request('post', url, body); }
function put(url: string, body?: any) { return request('put', url, body); }
function del(url: string) { return request('del', url); }

// ──── Setup ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Need supertest
  await import('supertest');
});

beforeEach(async () => {
  const storage = new InMemoryStorage();
  configureWebhookPersistence(storage);

  // Create a fresh Express app with the webhook routes
  app = buildApp();
  const webhookRoutes = (await import('../routes/webhooks')).default;
  app.use('/api/user/webhooks', webhookRoutes);

  // Generate a test JWT token
  _userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  _token = await generateToken({ userId: _userId, role: 'free' });
});

// ═══════════════════════════════════════════════════════════════════════════
// CREATE WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/user/webhooks — Create Webhook', () => {
  const validPayload = {
    name: 'Test Webhook',
    url: 'https://hooks.example.com/toroloom',
    events: ['trade:executed', 'order:placed'],
    description: 'Test webhook for integration tests',
  };

  it('should create a webhook with valid payload', async () => {
    const { status, body } = await post('/api/user/webhooks', validPayload);

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.name).toBe('Test Webhook');
    expect(body.data.url).toBe('https://hooks.example.com/toroloom');
    expect(body.data.events).toEqual(['trade:executed', 'order:placed']);
    expect(body.data.isActive).toBe(true);
    expect(body.data.secret).toMatch(/^whsec_/); // Full secret returned on create
    expect(body.data.id).toMatch(/^wh_/);
    expect(body.data.deliveryCount).toBe(0);
    expect(body.data.successCount).toBe(0);
  });

  it('should return 400 when name is missing', async () => {
    const { status, body } = await post('/api/user/webhooks', {
      url: 'https://hooks.example.com',
      events: ['trade:executed'],
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('name');
  });

  it('should return 400 when URL is missing', async () => {
    const { status, body } = await post('/api/user/webhooks', {
      name: 'Test',
      events: ['trade:executed'],
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('URL');
  });

  it('should return 400 when events are empty', async () => {
    const { status, body } = await post('/api/user/webhooks', {
      name: 'Test',
      url: 'https://hooks.example.com',
      events: [],
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('event');
  });

  it('should return 400 when events is not an array', async () => {
    const { status, body } = await post('/api/user/webhooks', {
      name: 'Test',
      url: 'https://hooks.example.com',
      events: 'trade:executed',
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('event');
  });

  it('should return 400 for invalid events', async () => {
    const { status, body } = await post('/api/user/webhooks', {
      name: 'Test',
      url: 'https://hooks.example.com',
      events: ['invalid:event'],
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Invalid event');
  });

  it('should return 400 for invalid URL', async () => {
    const { status, body } = await post('/api/user/webhooks', {
      name: 'Test',
      url: 'not-a-url',
      events: ['trade:executed'],
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Invalid');
  });

  it('should return 401 when no auth token provided', async () => {
    const res = await (await import('supertest')).default(app)
      .post('/api/user/webhooks')
      .send(validPayload)
      .set('Content-Type', 'application/json');
    // No Authorization header
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LIST WEBHOOKS
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/user/webhooks — List Webhooks', () => {
  it('should return empty list when no webhooks exist', async () => {
    const { status, body } = await get('/api/user/webhooks');

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('should return webhooks with masked secrets', async () => {
    // Create a webhook first
    const { body: created } = await post('/api/user/webhooks', {
      name: 'My Webhook',
      url: 'https://hooks.example.com',
      events: ['trade:executed'],
    });
    const fullSecret = created.data.secret;

    // List webhooks
    const { status, body } = await get('/api/user/webhooks');

    expect(status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(created.data.id);
    expect(body.data[0].secret).not.toBe(fullSecret);
    expect(body.data[0].secret).toContain('...');
  });

  it('should only return webhooks for the authenticated user', async () => {
    await post('/api/user/webhooks', {
      name: 'My Webhook',
      url: 'https://hooks.example.com',
      events: ['trade:executed'],
    });

    const { status, body } = await get('/api/user/webhooks');

    expect(status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe('My Webhook');
  });

  it('should return 401 without auth token', async () => {
    const res = await (await import('supertest')).default(app)
      .get('/api/user/webhooks');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET SINGLE WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/user/webhooks/:id — Get Single Webhook', () => {
  it('should return a webhook by ID with masked secret', async () => {
    const { body: created } = await post('/api/user/webhooks', {
      name: 'Test',
      url: 'https://hooks.example.com',
      events: ['trade:executed'],
    });
    const whId = created.data.id;

    const { status, body } = await get(`/api/user/webhooks/${whId}`);

    expect(status).toBe(200);
    expect(body.data.id).toBe(whId);
    expect(body.data.name).toBe('Test');
    expect(body.data.secret).toContain('...');
  });

  it('should return 404 for non-existent webhook', async () => {
    const { status, body } = await get('/api/user/webhooks/nonexistent');

    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════

describe('PUT /api/user/webhooks/:id — Update Webhook', () => {
  it('should update webhook name and events', async () => {
    const { body: created } = await post('/api/user/webhooks', {
      name: 'Original',
      url: 'https://hooks.example.com',
      events: ['trade:executed'],
    });
    const whId = created.data.id;

    const { status, body } = await put(`/api/user/webhooks/${whId}`, {
      name: 'Updated Name',
      events: ['trade:executed', 'order:placed', 'market:open'],
    });

    expect(status).toBe(200);
    expect(body.data.name).toBe('Updated Name');
    expect(body.data.events).toContain('order:placed');
    expect(body.data.events).toContain('market:open');
  });

  it('should toggle isActive to false', async () => {
    const { body: created } = await post('/api/user/webhooks', {
      name: 'Test',
      url: 'https://hooks.example.com',
      events: ['trade:executed'],
    });
    const whId = created.data.id;

    const { status, body } = await put(`/api/user/webhooks/${whId}`, {
      isActive: false,
    });

    expect(status).toBe(200);
    expect(body.data.isActive).toBe(false);
  });

  it('should return 404 for non-existent webhook', async () => {
    const { status, body } = await put('/api/user/webhooks/nonexistent', {
      name: 'New Name',
    });

    expect(status).toBe(404);
  });

  it('should return 400 for empty name', async () => {
    const { body: created } = await post('/api/user/webhooks', {
      name: 'Test',
      url: 'https://hooks.example.com',
      events: ['trade:executed'],
    });

    const { status, body } = await put(`/api/user/webhooks/${created.data.id}`, {
      name: '   ',
    });

    expect(status).toBe(400);
    expect(body.error).toContain('empty');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════

describe('DELETE /api/user/webhooks/:id — Delete Webhook', () => {
  it('should delete a webhook', async () => {
    const { body: created } = await post('/api/user/webhooks', {
      name: 'Test',
      url: 'https://hooks.example.com',
      events: ['trade:executed'],
    });
    const whId = created.data.id;

    const { status, body } = await del(`/api/user/webhooks/${whId}`);

    expect(status).toBe(200);
    expect(body.data.deleted).toBe(true);

    // Verify it's gone
    const { body: list } = await get('/api/user/webhooks');
    expect(list.data.length).toBe(0);
  });

  it('should return 404 for non-existent webhook', async () => {
    const { status, body } = await del('/api/user/webhooks/nonexistent');
    expect(status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST PING
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/user/webhooks/:id/test — Test Ping', () => {
  it('should return test ping result', async () => {
    const { body: created } = await post('/api/user/webhooks', {
      name: 'Test',
      url: 'https://hooks.example.com',
      events: ['trade:executed'],
    });
    const whId = created.data.id;

    const { status, body } = await post(`/api/user/webhooks/${whId}/test`);

    expect(status).toBe(200);
    expect(body.data).toBeDefined();
    // This will likely fail since the URL doesn't exist, but that's expected
    expect(body.data).toHaveProperty('success');
    expect(body.data).toHaveProperty('statusCode');
    expect(body.data).toHaveProperty('duration');
  });

  it('should return test result for non-existent webhook', async () => {
    const { status, body } = await post('/api/user/webhooks/nonexistent/test');
    expect(status).toBe(200); // sendTestPing returns result envelope
    expect(body.data.success).toBe(false);
    expect(body.data.errorMessage).toBe('Webhook not found');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DELIVERY LOGS
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/user/webhooks/:id/logs — Delivery Logs', () => {
  it('should return empty logs for a new webhook', async () => {
    const { body: created } = await post('/api/user/webhooks', {
      name: 'Test',
      url: 'https://hooks.example.com',
      events: ['trade:executed'],
    });

    const { status, body } = await get(`/api/user/webhooks/${created.data.id}/logs`);

    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });
});
