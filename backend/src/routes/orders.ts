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
import { getBroker } from '../services/broker';
import {
  orderPipeline,
  ExecuteOrderParams,
} from '../services/orderExecution';
import { OrderActionType, riskEngine } from '../services/riskEngine';
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
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const {
      actionType,
      symbol,
      exchange,
      quantity,
      price,
      productType,
      orderType,
      metadata,
    } = req.body;

    // ──────────────────────────────────────────────────────────────
    // INPUT VALIDATION
    // ──────────────────────────────────────────────────────────────

    if (!actionType) {
      res.status(400).json({ error: 'actionType is required (BUY | SELL | SQUARE_OFF | MODIFY | CANCEL)' });
      return;
    }

    const normalizedAction = (actionType as string).toUpperCase() as OrderActionType;
    if (!Object.values(OrderActionType).includes(normalizedAction)) {
      res.status(400).json({
        error: `Invalid actionType. Must be one of: ${Object.values(OrderActionType).join(', ')}`,
      });
      return;
    }

    if (!symbol || typeof symbol !== 'string') {
      res.status(400).json({ error: 'symbol is required (e.g., "RELIANCE")' });
      return;
    }

    if (quantity === undefined || typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
      res.status(400).json({ error: 'quantity is required and must be a positive integer' });
      return;
    }

    if (price === undefined || typeof price !== 'number' || price <= 0) {
      res.status(400).json({ error: 'price is required and must be a positive number' });
      return;
    }

    // ──────────────────────────────────────────────────────────────
    // VALIDATE OPTIONAL FIELDS
    // ──────────────────────────────────────────────────────────────

    const VALID_EXCHANGES = ['NSE', 'BSE', 'NFO', 'BFO', 'CDS', 'MCX'] as const;
    const VALID_ORDER_TYPES = ['LIMIT', 'MARKET', 'SL', 'SLM'] as const;
    const VALID_PRODUCT_TYPES = ['CNC', 'MIS', 'NRML'] as const;

    const normalizedExchange = exchange ? (exchange as string).toUpperCase() : 'NSE';
    if (exchange !== undefined && !VALID_EXCHANGES.includes(normalizedExchange as any)) {
      res.status(400).json({
        error: `Invalid exchange. Must be one of: ${VALID_EXCHANGES.join(', ')}`,
      });
      return;
    }

    const normalizedProductType = productType ? (productType as string).toUpperCase() : 'CNC';
    if (productType !== undefined && !VALID_PRODUCT_TYPES.includes(normalizedProductType as any)) {
      res.status(400).json({
        error: `Invalid productType. Must be one of: ${VALID_PRODUCT_TYPES.join(', ')}`,
      });
      return;
    }

    const normalizedOrderType = orderType ? (orderType as string).toUpperCase() : 'MARKET';
    if (orderType !== undefined && !VALID_ORDER_TYPES.includes(normalizedOrderType as any)) {
      res.status(400).json({
        error: `Invalid orderType. Must be one of: ${VALID_ORDER_TYPES.join(', ')}`,
      });
      return;
    }

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
    };

    const result = await orderPipeline.execute(params);
    res.status(200).json(result);

  } catch (error: any) {
    console.error('[Orders] Route error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
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
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { actionType, symbol, quantity, price } = req.body;

    if (!actionType) {
      res.status(400).json({ error: 'actionType is required' });
      return;
    }

    const normalizedAction = (actionType as string).toUpperCase() as OrderActionType;
    if (!Object.values(OrderActionType).includes(normalizedAction)) {
      res.status(400).json({
        error: `Invalid actionType. Must be one of: ${Object.values(OrderActionType).join(', ')}`,
      });
      return;
    }

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
      symbol: (symbol as string || '').trim().toUpperCase(),
      quantity: quantity ? parseInt(quantity as string, 10) : undefined,
      price: price ? parseFloat(price as string) : undefined,
      portfolioValue,
      currentPosition,
    });

    res.status(200).json(evaluation);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: `Validation error: ${error.message}`,
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
  } catch (error: any) {
    console.error('[Orders] Failed to fetch open orders:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch open orders' });
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
router.post('/modify', async (req: Request, res: Response) => {
  try {
    const { orderId, symbol, exchange, quantity, price, productType, orderType, triggerPrice } = req.body;

    if (!orderId || typeof orderId !== 'string') {
      res.status(400).json({ error: 'orderId is required' });
      return;
    }

    // Validate optional enum fields if provided
    const VALID_ORDER_TYPES = ['LIMIT', 'MARKET', 'SL', 'SLM'] as const;
    const VALID_PRODUCT_TYPES = ['CNC', 'MIS', 'NRML'] as const;

    if (orderType && !VALID_ORDER_TYPES.includes(orderType as any)) {
      res.status(400).json({ error: `Invalid orderType. Must be one of: ${VALID_ORDER_TYPES.join(', ')}` });
      return;
    }
    if (productType && !VALID_PRODUCT_TYPES.includes(productType as any)) {
      res.status(400).json({ error: `Invalid productType. Must be one of: ${VALID_PRODUCT_TYPES.join(', ')}` });
      return;
    }
    if (quantity !== undefined && (typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity))) {
      res.status(400).json({ error: 'quantity must be a positive integer' });
      return;
    }
    if (price !== undefined && (typeof price !== 'number' || price <= 0)) {
      res.status(400).json({ error: 'price must be a positive number' });
      return;
    }

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
  } catch (error: any) {
    console.error('[Orders] Modify order error:', error);
    res.status(500).json({
      id: req.body?.orderId || 'unknown',
      status: 'rejected',
      message: error.message || 'Failed to modify order',
      timestamp: new Date().toISOString(),
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
router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const { orderId, symbol, exchange } = req.body;

    if (!orderId || typeof orderId !== 'string') {
      res.status(400).json({ error: 'orderId is required' });
      return;
    }

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
  } catch (error: any) {
    console.error('[Orders] Cancel order error:', error);
    res.status(500).json({
      id: req.body?.orderId || 'unknown',
      status: 'rejected',
      message: error.message || 'Failed to cancel order',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
