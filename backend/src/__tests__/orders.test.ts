/**
 * ============================================================================
 * Toroloom — Orders Route Unit Tests
 * ============================================================================
 *
 * Tests all 5 endpoints of the orders route with mocked middleware and
 * service dependencies, using raw http.request (no supertest dependency).
 *
 * Endpoints:
 *   POST /api/orders/execute   — Full order pipeline
 *   POST /api/orders/validate  — Pre-validation without execution
 *   GET  /api/orders/open      — Fetch open orders
 *   POST /api/orders/modify    — Modify existing order
 *   POST /api/orders/cancel    — Cancel existing order
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/orders.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import http from 'http';

// ──── Mock authMiddleware — just set userId and call next() ────────────────

vi.mock('../middleware/auth', () => ({
  authMiddleware: (_req: any, _res: any, next: () => void) => {
    _req.user = { userId: 'test_user' };
    next();
  },
}));

// ──── Mock broker — return mock broker with getPositions/getOpenOrders ─────

const { mockBroker, mockPositions, mockOpenOrders } = vi.hoisted(() => {
  const pos: Array<{ symbol: string; quantity: number; buyPrice: number }> = [
    { symbol: 'RELIANCE', quantity: 50, buyPrice: 2500 },
    { symbol: 'TCS', quantity: 10, buyPrice: 3500 },
  ];
  const ords = [
    { orderId: 'ord-001', symbol: 'RELIANCE', quantity: 10, price: 2600, status: 'open' },
    { orderId: 'ord-002', symbol: 'TCS', quantity: 5, price: 3600, status: 'pending' },
  ];
  return {
    mockBroker: {
      getPositions: vi.fn().mockResolvedValue(pos),
      getOpenOrders: vi.fn().mockResolvedValue(ords),
      modifyOrder: vi.fn().mockResolvedValue({ status: 'modified', orderId: 'ord-001' }),
      cancelOrder: vi.fn().mockResolvedValue({ status: 'cancelled', orderId: 'ord-001' }),
      placeOrder: vi.fn().mockResolvedValue({ status: 'success', orderId: 'exec-001' }),
    },
    mockPositions: pos,
    mockOpenOrders: ords,
  };
});

vi.mock('../services/broker', () => ({
  getBroker: vi.fn().mockResolvedValue(mockBroker),
}));

// ──── Mock orderPipeline — control execute result ──────────────────────────

const { mockPipelineResult, mockOrderPipeline } = vi.hoisted(() => {
  const result = {
    success: true,
    orderId: 'exec-001',
    riskEvaluation: { allowed: true },
    message: 'Order placed successfully',
  };
  return {
    mockPipelineResult: result,
    mockOrderPipeline: {
      execute: vi.fn().mockResolvedValue(result),
    },
  };
});

vi.mock('../services/orderExecution', () => ({
  orderPipeline: mockOrderPipeline,
}));

// ──── Mock riskEngine ──────────────────────────────────────────────────────

const { mockRiskEngine } = vi.hoisted(() => ({
  mockRiskEngine: {
    getState: vi.fn().mockReturnValue({
      portfolioValueAtOpen: 1000000,
      dailyLossLimit: 50000,
      today: { currentPnl: 0 },
    }),
    evaluate: vi.fn().mockReturnValue({
      allowed: true,
      reason: 'All checks passed',
      riskScore: 0.2,
    }),
  },
}));

vi.mock('../services/riskEngine', () => ({
  riskEngine: mockRiskEngine,
  OrderActionType: {
    BUY: 'BUY',
    SELL: 'SELL',
    SQUARE_OFF: 'SQUARE_OFF',
    MODIFY: 'MODIFY',
    CANCEL: 'CANCEL',
  },
}));

// ──── Mock auditTrail ──────────────────────────────────────────────────────

const { mockAuditTrail } = vi.hoisted(() => ({
  mockAuditTrail: {
    append: vi.fn().mockResolvedValue({ id: 'evt-audit-001' }),
  },
}));

vi.mock('../services/auditTrail', () => ({
  auditTrail: mockAuditTrail,
}));

// ──── Import route AFTER mocks ─────────────────────────────────────────────

import ordersRoutes from '../routes/orders';

// ──── Helpers ──────────────────────────────────────────────────────────────

type ResResult = { status: number; body: any };

function request(
  server: http.Server,
  baseUrl: string,
  opts: { method: string; path: string; body?: any; headers?: Record<string, string> },
): Promise<ResResult> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, baseUrl);
    const req = http.request(
      url.toString(),
      {
        method: opts.method,
        headers: {
          'Content-Type': 'application/json',
          ...opts.headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          let body: any;
          try {
            body = data ? JSON.parse(data) : undefined;
          } catch {
            body = data;
          }
          resolve({ status: res.statusCode!, body });
        });
      },
    );
    req.on('error', reject);

    if (opts.body) {
      req.write(JSON.stringify(opts.body));
    }
    req.end();
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('Orders Route', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/orders', ordersRoutes);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const port = (server.address() as any).port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    server?.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default mock behavior
    mockBroker.getPositions.mockResolvedValue(mockPositions);
    mockBroker.getOpenOrders.mockResolvedValue(mockOpenOrders);
    mockBroker.modifyOrder.mockResolvedValue({ status: 'modified', orderId: 'ord-001' });
    mockBroker.cancelOrder.mockResolvedValue({ status: 'cancelled', orderId: 'ord-001' });
    mockOrderPipeline.execute.mockResolvedValue(mockPipelineResult);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/orders/execute — Input Validation
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/orders/execute — Validation', () => {
    it('should reject without actionType', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute', body: {},
      });
      expect(status).toBe(400);
      expect(body.error).toContain('actionType');
    });

    it('should accept legacy transactionType as alias for actionType', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { transactionType: 'BUY', symbol: 'RELIANCE', quantity: 10, price: 2500 },
      });
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should reject invalid actionType', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'INVALID', symbol: 'RELIANCE', quantity: 10, price: 2500 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid');
    });

    it('should reject without symbol', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'BUY' },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('symbol');
    });

    it('should reject symbol that is not a string', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'BUY', symbol: 123, quantity: 10, price: 2500 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('symbol');
    });

    it('should reject without quantity', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'BUY', symbol: 'RELIANCE' },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('quantity');
    });

    it('should reject non-positive quantity', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'BUY', symbol: 'RELIANCE', quantity: 0, price: 2500 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('quantity');
    });

    it('should reject non-integer quantity', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10.5, price: 2500 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('quantity');
    });

    it('should reject without price', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('price');
    });

    it('should reject non-positive price', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10, price: -100 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('price');
    });

    it('should reject invalid exchange', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10, price: 2500, exchange: 'INVALID' },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid exchange');
    });

    it('should reject invalid productType', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10, price: 2500, productType: 'INVALID' },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid productType');
    });

    it('should reject invalid orderType', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10, price: 2500, orderType: 'INVALID' },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid orderType');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/orders/execute — Successful Execution
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/orders/execute — Execution', () => {
    it('should execute a BUY order successfully', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10, price: 2500 },
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.orderId).toBe('exec-001');

      // Verify pipeline was called with correct params
      expect(mockOrderPipeline.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test_user',
          actionType: 'BUY',
          symbol: 'RELIANCE',
          quantity: 10,
          price: 2500,
        }),
      );
    });

    it('should pass correct defaults for optional fields', async () => {
      await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'SELL', symbol: 'TCS', quantity: 5, price: 3600 },
      });

      expect(mockOrderPipeline.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          exchange: 'NSE',
          productType: 'CNC',
          orderType: 'MARKET',
        }),
      );
    });

    it('should pass metadata when provided', async () => {
      const metadata = { source: 'mobile', strategy: 'momentum' };
      await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10, price: 2500, metadata },
      });

      expect(mockOrderPipeline.execute).toHaveBeenCalledWith(
        expect.objectContaining({ metadata }),
      );
    });

    it('should resolve currentPosition from broker positions', async () => {
      await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'SELL', symbol: 'RELIANCE', quantity: 10, price: 2600 },
      });

      // Should pass currentPosition for held symbol RELIANCE
      expect(mockOrderPipeline.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          currentPosition: { quantity: 50, avgPrice: 2500 },
        }),
      );
    });

    it('should not pass currentPosition for symbols not in portfolio', async () => {
      await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'BUY', symbol: 'HDFCBANK', quantity: 10, price: 1500 },
      });

      expect(mockOrderPipeline.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          currentPosition: undefined,
        }),
      );
    });

    it('should gracefully handle broker position fetch failure', async () => {
      mockBroker.getPositions.mockRejectedValue(new Error('Broker unavailable'));

      await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10, price: 2500 },
      });

      // Pipeline should still be called with undefined currentPosition
      expect(mockOrderPipeline.execute).toHaveBeenCalledWith(
        expect.objectContaining({ currentPosition: undefined }),
      );
    });

    it('should return error when pipeline throws', async () => {
      mockOrderPipeline.execute.mockRejectedValue(new Error('Risk check failed'));

      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/execute',
        body: { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10, price: 2500 },
      });

      expect(status).toBe(500);
      expect(body.error).toContain('Risk check failed');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/orders/validate
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/orders/validate', () => {
    it('should validate a BUY order successfully', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/validate',
        body: { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10, price: 2500 },
      });

      expect(status).toBe(200);
      expect(body.allowed).toBe(true);
      expect(mockRiskEngine.evaluate).toHaveBeenCalled();
    });

    it('should reject without actionType', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/validate', body: {},
      });
      expect(status).toBe(400);
      expect(body.error).toContain('actionType');
    });

    it('should reject invalid actionType', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/validate',
        body: { actionType: 'INVALID' },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid');
    });

    it('should gracefully handle position fetch failure during validate', async () => {
      mockBroker.getPositions.mockRejectedValue(new Error('Broker down'));

      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/validate',
        body: { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10, price: 2500 },
      });

      expect(status).toBe(200);
      expect(body.allowed).toBe(true);
    });

    it('should handle validate errors gracefully', async () => {
      mockRiskEngine.evaluate.mockImplementation(() => {
        throw new Error('Validation crash');
      });

      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/validate',
        body: { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10, price: 2500 },
      });

      expect(status).toBe(500);
      expect(body.error).toContain('Validation error');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/orders/open
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/orders/open', () => {
    it('should return open orders', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/orders/open',
      });

      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
      expect(body[0].orderId).toBe('ord-001');
      expect(mockBroker.getOpenOrders).toHaveBeenCalled();
    });

    it('should handle broker errors', async () => {
      mockBroker.getOpenOrders.mockRejectedValue(new Error('Broker timeout'));

      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/orders/open',
      });

      expect(status).toBe(500);
      expect(body.error).toContain('Broker timeout');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/orders/modify
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/orders/modify', () => {
    it('should modify an order', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/modify',
        body: { orderId: 'ord-001', price: 2700, quantity: 15 },
      });

      expect(status).toBe(200);
      expect(body.status).toBe('modified');
      expect(mockBroker.modifyOrder).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'ord-001', price: 2700, quantity: 15 }),
      );
    });

    it('should reject without orderId', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/modify', body: {},
      });
      expect(status).toBe(400);
      expect(body.error).toContain('orderId');
    });

    it('should reject non-string orderId', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/modify',
        body: { orderId: 123 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('orderId');
    });

    it('should reject invalid orderType', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/modify',
        body: { orderId: 'ord-001', orderType: 'INVALID' },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid orderType');
    });

    it('should reject invalid productType', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/modify',
        body: { orderId: 'ord-001', productType: 'INVALID' },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid productType');
    });

    it('should reject non-positive quantity', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/modify',
        body: { orderId: 'ord-001', quantity: -5 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('quantity');
    });

    it('should reject non-integer quantity', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/modify',
        body: { orderId: 'ord-001', quantity: 10.5 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('quantity');
    });

    it('should reject non-positive price', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/modify',
        body: { orderId: 'ord-001', price: 0 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('price');
    });

    it('should reject non-positive triggerPrice', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/modify',
        body: { orderId: 'ord-001', triggerPrice: -10 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('triggerPrice');
    });

    it('should fall back to NSE exchange when not provided', async () => {
      await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/modify',
        body: { orderId: 'ord-001', price: 2700 },
      });

      expect(mockBroker.modifyOrder).toHaveBeenCalledWith(
        expect.objectContaining({ exchange: 'NSE' }),
      );
    });

    it('should write audit trail on successful modify', async () => {
      await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/modify',
        body: { orderId: 'ord-001', price: 2700 },
      });

      expect(mockAuditTrail.append).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test_user',
          eventType: 'ORDER_EXECUTION',
        }),
      );
      const auditCall = mockAuditTrail.append.mock.calls[0][0];
      expect(auditCall.data.action).toBe('MODIFY');
    });

    it('should handle modify errors', async () => {
      mockBroker.modifyOrder.mockRejectedValue(new Error('Order not found'));

      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/modify',
        body: { orderId: 'ord-999', price: 2700 },
      });

      expect(status).toBe(500);
      expect(body.error).toContain('Order not found');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/orders/cancel
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/orders/cancel', () => {
    it('should cancel an order', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/cancel',
        body: { orderId: 'ord-001', symbol: 'RELIANCE' },
      });

      expect(status).toBe(200);
      expect(body.status).toBe('cancelled');
      expect(mockBroker.cancelOrder).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'ord-001', symbol: 'RELIANCE' }),
      );
    });

    it('should reject without orderId', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/cancel', body: {},
      });
      expect(status).toBe(400);
      expect(body.error).toContain('orderId');
    });

    it('should reject non-string orderId', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/cancel',
        body: { orderId: true },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('orderId');
    });

    it('should write audit trail on successful cancel', async () => {
      await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/cancel',
        body: { orderId: 'ord-001' },
      });

      expect(mockAuditTrail.append).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test_user',
          eventType: 'ORDER_EXECUTION',
        }),
      );
      const auditCall = mockAuditTrail.append.mock.calls[0][0];
      expect(auditCall.data.action).toBe('CANCEL');
    });

    it('should handle cancel errors', async () => {
      mockBroker.cancelOrder.mockRejectedValue(new Error('Order already filled'));

      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/orders/cancel',
        body: { orderId: 'ord-001' },
      });

      expect(status).toBe(500);
      expect(body.error).toContain('Order already filled');
    });
  });
});
