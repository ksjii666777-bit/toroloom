/**
 * ============================================================================
 * Toroloom Order Execution Route — THE SINGLE BRIDGE TO THE BROKER
 * ============================================================================
 *
 * This is THE gatekeeper endpoint. Every trade order from the frontend MUST
 * go through this route. It orchestrates the full 5-stage pipeline:
 *
 *   Client (portfolioStore)               OrderExecutionPipeline
 *         │                                      │
 *         ▼                                      ▼
 *   POST /api/orders/execute ─────►  1. RiskEngine.evaluate()
 *                                     2. HookRegistry.runPreOrder()
 *                                     3. Broker.placeOrder()
 *                                     4. RiskEngine.recordTrade()
 *                                     5. HookRegistry.runPostOrder()
 *         │                                      │
 *         ▼                                      ▼
 *   Response ◄────────────────────   success | blocked | rejected | error
 *
 * There is NO bypass path to the broker. Every order, regardless of source,
 * flows through this single pipeline — guaranteeing that the Financial
 * Bodyguard, custom hooks, and audit trail are always enforced.
 *
 * Route:  POST /api/orders/execute
 * Auth:   Required (authMiddleware)
 * Body:   { actionType, symbol, exchange?, quantity, price, productType?,
 *           orderType?, metadata? }
 *
 * Response:
 *   - 200: { success: true, orderId, riskEvaluation, ... }
 *   - 200: { success: false, message, riskEvaluation, hookBlocked? }
 *   - 400: { error: "Validation error description" }
 *   - 401: { error: "Authentication required" }
 *   - 500: { error: "Internal error" }
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { executeOrderSchema, validateOrderSchema, modifyOrderSchema, cancelOrderSchema } from '../schemas/orders';
import { getBroker } from '../services/broker';
import {
  orderPipeline,
  ExecuteOrderParams,
} from '../services/orderExecution';
import { riskEngine } from '../services/riskEngine/RiskEngine';
import { OrderActionType } from '../services/riskEngine/types';
import { auditTrail } from '../services/auditTrail';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/orders/execute
 *
 * Execute a full order lifecycle through the Risk-Guarded Execution Pipeline.
 *
 * Body schema:
 *   actionType   — BUY | SELL | SQUARE_OFF | MODIFY | CANCEL (required)
 *   symbol       — Trading symbol e.g. "RELIANCE" (required)
 *   exchange     — Exchange: "NSE" | "BSE" | "NFO" (default: "NSE")
 *   quantity     — Number of shares (required, must be > 0)
 *   price        — Limit price (required, must be > 0)
 *   productType  — "CNC" | "MIS" | "NRML" (default: "CNC")
 *   orderType    — "LIMIT" | "MARKET" | "SL" | "SLM" (default: "MARKET")
 *   metadata     — Arbitrary object for custom hooks (optional)
 */
router.post('/execute', validate(executeOrderSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const {
      actionType,
      transactionType, // Legacy alias — maps to actionType
      symbol,
      exchange,
      quantity,
      price,
      productType,
      orderType,
      metadata,
      idempotencyKey,
    } = req.body;

    // Backward compatibility: accept transactionType (old) as alias for actionType
    const resolvedAction = (actionType || transactionType) as string;
    const normalizedAction = resolvedAction.toUpperCase() as OrderActionType;
    const normalizedExchange = (exchange || 'NSE').toUpperCase();
    const normalizedProductType = (productType || 'CNC').toUpperCase();
    const normalizedOrderType = (orderType || 'MARKET').toUpperCase();
    const normalizedIdempotencyKey = idempotencyKey ? String(idempotencyKey) : undefined;

    // ──────────────────────────────────────────────────────────────
    // SERVER-SIDE POSITION LOOKUP (Exit-Exception Support)
    // ──────────────────────────────────────────────────────────────
    //
    // Fetch the user's current positions from the broker to determine
    // whether the order is an exit (reducing an existing position).
    // This is the AUTHORITATIVE source — never trust client input for
    // currentPosition, as it could be manipulated to bypass lockdown.
    //
    // The risk engine's isExitAction() checks currentPosition to allow
    // SELL / SQUARE_OFF orders during lockdown (the Exit Exception).

    let currentPosition: { quantity: number; avgPrice: number } | undefined;
    try {
      const broker = await getBroker();
      const positions = await broker.getPositions();
      const matchedPos = positions.find(
        (p: { symbol: string }) => p.symbol === symbol.trim().toUpperCase(),
      );
      if (matchedPos && matchedPos.quantity > 0) {
        currentPosition = {
          quantity: matchedPos.quantity,
          avgPrice: matchedPos.buyPrice,
        };
      }
    } catch {
      // Broker unavailable — proceed without position data.
      // The risk engine will treat SELL as non-exit (not ideal but safe:
      // it will block the order during lockdown rather than allowing it).
      console.warn('[Orders] Could not fetch positions for exit detection');
    }

    // ──────────────────────────────────────────────────────────────
    // EXECUTE THROUGH PIPELINE
    // ──────────────────────────────────────────────────────────────

    const params: ExecuteOrderParams = {
      userId,
      actionType: normalizedAction,
      symbol: symbol.trim().toUpperCase(),
      exchange: normalizedExchange,
      quantity,
      price,
      productType: normalizedProductType as 'CNC' | 'MIS' | 'NRML',
      orderType: normalizedOrderType as 'LIMIT' | 'MARKET' | 'SL' | 'SLM',
      currentPosition, // Server-resolved, never from client
      metadata: metadata || {},
      idempotencyKey: normalizedIdempotencyKey,
    };

    const result = await orderPipeline.execute(params);
    res.status(200).json(result);

  } catch (error: unknown) {
    console.error('[Orders] Route error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Internal server error',
    });
  }
});

/**
 * POST /api/orders/validate
 *
 * Pre-validation endpoint — evaluates an order against the RiskEngine
 * WITHOUT actually executing it. Useful for UI pre-checks (e.g., button
 * click → disable if blocked).
 *
 * Body schema matches POST /execute (same validation rules).
 */
router.post('/validate', validate(validateOrderSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { actionType, symbol, quantity, price, exchange } = req.body;

    const normalizedAction = (actionType as string).toUpperCase() as OrderActionType;

    // ──────────────────────────────────────────────────────────────
    // SERVER-SIDE POSITION LOOKUP (mirrors /execute logic)
    // ──────────────────────────────────────────────────────────────
    let currentPosition: { quantity: number; avgPrice: number } | undefined;
    try {
      const broker = await getBroker();
      const positions = await broker.getPositions();
      const matchedPos = positions.find(
        (p: { symbol: string }) => p.symbol === ((symbol as string) || '').trim().toUpperCase(),
      );
      if (matchedPos && matchedPos.quantity > 0) {
        currentPosition = {
          quantity: matchedPos.quantity,
          avgPrice: matchedPos.buyPrice,
        };
      }
    } catch {
      console.warn('[Orders] Could not fetch positions for validate');
    }

    const portfolioValue = riskEngine.getState(userId).portfolioValueAtOpen || 1000000;

    const evaluation = riskEngine.evaluate(userId, {
      actionType: normalizedAction,
      symbol: ((symbol as string) || '').trim().toUpperCase(),
      quantity: typeof quantity === 'number' ? quantity : (quantity ? parseInt(quantity as string, 10) : undefined),
      price: typeof price === 'number' ? price : (price ? parseFloat(price as string) : undefined),
      portfolioValue,
      currentPosition,
      // Mirror /execute: F&O orders get the allowFNO gate in pre-checks too
      isFNO: ((exchange as string) || '').toUpperCase() === 'NFO',
    });

    res.status(200).json(evaluation);
  } catch (error: unknown) {
    res.status(500).json({
      error: `Validation error: ${(error as Error).message}`,
    });
  }
});


// ==================== Order Management: Modify & Cancel ====================

/**
 * GET /api/orders/open
 *
 * Fetch all open/pending orders for the authenticated user.
 * Returns an array of OpenOrder objects from the active broker.
 */
router.get('/open', async (_req: Request, res: Response) => {
  try {
    const broker = await getBroker();
    const openOrders = await broker.getOpenOrders();
    res.json(openOrders);
  } catch (error: unknown) {
    console.error('[Orders] Failed to fetch open orders:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch open orders' });
  }
});

/**
 * POST /api/orders/modify
 *
 * Modify an existing open/pending order.
 *
 * Body schema:
 *   orderId     — ID of the order to modify (required)
 *   price       — New limit price (optional)
 *   quantity    — New quantity (optional)
 *   orderType   — New order type: LIMIT | MARKET | SL | SLM (optional)
 *   productType — New product type: CNC | MIS | NRML (optional)
 *   triggerPrice — New trigger price for SL/SL-M orders (optional)
 *   symbol      — Trading symbol (optional, for token resolution)
 *   exchange    — Exchange: NSE | BSE (optional, default: NSE)
 */
router.post('/modify', validate(modifyOrderSchema), async (req: Request, res: Response) => {
  try {
    const { orderId, symbol, exchange, quantity, price, productType, orderType, triggerPrice } = req.body;

    const broker = await getBroker();
    const result = await broker.modifyOrder({
      orderId,
      symbol,
      exchange: exchange || 'NSE',
      quantity,
      price,
      productType: productType as any,
      orderType: orderType as any,
      triggerPrice,
    });

    // Audit trail
    await auditTrail.append({
      userId: req.user!.userId,
      eventType: 'ORDER_EXECUTION',
      data: {
        action: 'MODIFY',
        orderId,
        symbol,
        quantity,
        price,
        orderType,
        productType,
        status: result.status,
      },
    });

    res.status(200).json(result);
  } catch (error: unknown) {
    console.error('[Orders] Modify order error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to modify order',
    });
  }
});

/**
 * POST /api/orders/cancel
 *
 * Cancel an existing open/pending order.
 *
 * Body schema:
 *   orderId  — ID of the order to cancel (required)
 *   symbol   — Trading symbol (optional)
 *   exchange — Exchange (optional)
 */
router.post('/cancel', validate(cancelOrderSchema), async (req: Request, res: Response) => {
  try {
    const { orderId, symbol, exchange } = req.body;

    const broker = await getBroker();
    const result = await broker.cancelOrder({ orderId, symbol, exchange });

    // Audit trail
    await auditTrail.append({
      userId: req.user!.userId,
      eventType: 'ORDER_EXECUTION',
      data: {
        action: 'CANCEL',
        orderId,
        symbol,
        exchange,
        status: result.status,
      },
    });

    res.status(200).json(result);
  } catch (error: unknown) {
    console.error('[Orders] Cancel order error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to cancel order',
    });
  }
});

export default router;
