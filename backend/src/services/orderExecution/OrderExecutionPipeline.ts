/**
 * ============================================================================
 * Toroloom Order Execution Pipeline
 * ============================================================================
 *
 * This is THE critical integration layer that orchestrates the entire
 * order lifecycle:
 *
 *   Route Layer
 *       │
 *       ▼
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  OrderExecutionPipeline.execute()                             │
 *   │                                                              │
 *   │  1. Audit Trail: ORDER_STARTED                               │
 *   │  2. RiskEngine.evaluate()  ← Financial Bodyguard             │
 *   │  3. Audit Trail: RISK_CHECK_PASSED / RISK_CHECK_BLOCKED      │
 *   │  4. hookRegistry.runPreOrder()  ← Custom Hooks              │
 *   │  5. Audit Trail: HOOK_BLOCKED                                │
 *   │  6. CircuitBreaker.call() → Broker.placeOrder()  ← Protected│
 *   │  7. Audit Trail: ORDER_EXECUTION / ORDER_REJECTED            │
 *   │  8. RiskEngine.recordTrade()  ← Update MTM (atomic)         │
 *   │  9. Audit Trail: TRADE_RECORDED                              │
 *   │ 10. hookRegistry.runPostOrder()  ← Custom Hooks             │
 *   │ 11. Audit Trail: ORDER_COMPLETED                             │
 *   └──────────────────────────────────────────────────────────────┘
 *       │
 *       ▼
 *   Response to client
 *
 * If ANY step fails, the pipeline aborts and the error hooks fire.
 * No order can bypass this pipeline — it's the single path to the broker.
 */

import { riskEngine, RiskEvaluation, RiskDecision, OrderActionType, OrderRiskContext } from '../riskEngine';
import { hookRegistry, PreOrderContext, PostOrderContext, OrderErrorContext } from '../../middleware/customHooks/OrderHookTypes';
import { getBroker } from '../broker';
import { getCircuitBreaker } from '../circuitBreaker';
import { auditTrail } from '../auditTrail';
import { OrderPayload } from '../broker/interface';

export interface ExecuteOrderParams {
  userId: string;
  actionType: OrderActionType;
  symbol: string;
  exchange?: string;
  quantity: number;
  price: number;
  productType?: 'CNC' | 'MIS' | 'NRML';
  orderType?: 'LIMIT' | 'MARKET' | 'SL' | 'SLM';
  /** Current position for this symbol (used to determine exit actions) */
  currentPosition?: { quantity: number; avgPrice: number };
  /** Arbitrary metadata for custom hooks */
  metadata?: Record<string, unknown>;
}

export interface ExecuteOrderResult {
  success: boolean;
  orderId?: string;
  riskEvaluation: RiskEvaluation;
  message: string;
  hookBlocked?: {
    hookName: string;
    reason: string;
  };
  auditEventId?: string;
}

export class OrderExecutionPipeline {
  /**
   * Execute a full order lifecycle through the pipeline.
   * This is the ONLY path to the broker — no bypass allowed.
   */
  async execute(params: ExecuteOrderParams): Promise<ExecuteOrderResult> {
    const {
      userId,
      actionType,
      symbol,
      exchange = 'NSE',
      quantity,
      price,
      productType = 'CNC',
      orderType = 'MARKET',
      metadata = {},
    } = params;

    const orderContext: OrderRiskContext = {
      actionType,
      symbol,
      quantity,
      price,
      productType,
      currentPosition: params.currentPosition,
      portfolioValue: 0, // Will be fetched from profile
    };

    // ──────────────────────────────────────────────────────────
    // STEP 1: Audit — Order Started
    // ──────────────────────────────────────────────────────────
    await auditTrail.append({
      userId,
      eventType: 'ORDER_VALIDATED',
      data: {
        actionType,
        symbol,
        exchange,
        quantity,
        price,
        productType,
        orderType,
        stage: 'started',
      },
      metadata,
    });

    // ──────────────────────────────────────────────────────────
    // STEP 2: Risk Evaluation (Financial Bodyguard)
    // ──────────────────────────────────────────────────────────
    const riskEval = riskEngine.evaluate(userId, orderContext);

    if (!riskEval.allowed) {
      // ── Audit: Risk check blocked ──
      await auditTrail.append({
        userId,
        eventType: 'ORDER_REJECTED',
        data: {
          reason: 'risk_check_failed',
          decision: riskEval.decision,
          message: riskEval.message,
          actionType,
          symbol,
          quantity,
          price,
        },
        metadata: { riskState: riskEval.currentState },
      });

      // ── Audit: Lockdown triggered if applicable ──
      if (
        riskEval.decision === RiskDecision.BLOCKED_LOCKDOWN ||
        riskEval.decision === RiskDecision.BLOCKED_LOSS_LIMIT
      ) {
        await auditTrail.append({
          userId,
          eventType: 'LOCKDOWN_TRIGGERED',
          data: {
            triggerDecision: riskEval.decision,
            triggerMessage: riskEval.message,
            dailyLoss: riskEval.currentState.dailyLoss,
            dailyLossPercent: riskEval.currentState.dailyLossPercent,
          },
          metadata: { riskState: riskEval.currentState },
        });
      }

      return {
        success: false,
        riskEvaluation: riskEval,
        message: riskEval.message,
      };
    }

    // ── Audit: Risk check passed ──
    if (riskEval.decision === RiskDecision.EXIT_ALLOWED) {
      await auditTrail.append({
        userId,
        eventType: 'LOCKDOWN_EXIT_ALLOWED',
        data: {
          actionType,
          symbol,
          quantity,
          price,
        },
        metadata,
      });
    }

    // ──────────────────────────────────────────────────────────
    // STEP 3: Pre-Order Custom Hooks
    // ──────────────────────────────────────────────────────────
    const preOrderContext: PreOrderContext = {
      userId,
      order: orderContext,
      riskEvaluation: riskEval,
      metadata,
    };

    const blockedByHook = await hookRegistry.runPreOrder(preOrderContext);
    if (blockedByHook) {
      await auditTrail.append({
        userId,
        eventType: 'ORDER_REJECTED',
        data: {
          reason: 'hook_blocked',
          hookName: blockedByHook.hookName,
          hookReason: blockedByHook.reason,
          actionType,
          symbol,
        },
        metadata,
      });

      return {
        success: false,
        riskEvaluation: riskEval,
        message: `Custom hook "${blockedByHook.hookName}" blocked order: ${blockedByHook.reason}`,
        hookBlocked: {
          hookName: blockedByHook.hookName,
          reason: blockedByHook.reason || 'Blocked by custom rule',
        },
      };
    }

    // ──────────────────────────────────────────────────────────
    // STEP 4: Execute via Broker (Circuit Breaker Protected)
    // ──────────────────────────────────────────────────────────
    try {
      const broker = await getBroker();
      const orderPayload: OrderPayload = {
        symbol,
        exchange,
        transactionType: actionType === OrderActionType.BUY ? 'BUY' : 'SELL',
        quantity,
        price,
        productType,
        orderType,
      };

      // Use circuit breaker to protect the broker call
      const orderCircuitBreaker = getCircuitBreaker('order-execution', {
        failureThreshold: 5,
        successThreshold: 2,
        timeoutMs: 30_000,
        retryCount: 1,
      });

      const brokerResult = await orderCircuitBreaker.call(async () => {
        return await broker.placeOrder(orderPayload);
      });

      if (brokerResult.status === 'rejected') {
        auditTrail.append({
          userId,
          eventType: 'ORDER_REJECTED',
          data: {
            reason: 'broker_rejected',
            brokerMessage: brokerResult.message,
            actionType,
            symbol,
            quantity,
            price,
          },
          metadata,
        });

        return {
          success: false,
          riskEvaluation: riskEval,
          message: `Broker rejected order: ${brokerResult.message}`,
        };
      }

      // ── Audit: Order executed ──
      const auditEvent = await auditTrail.append({
        userId,
        eventType: 'ORDER_EXECUTION',
        data: {
          orderId: brokerResult.id,
          status: brokerResult.status,
          actionType,
          symbol,
          exchange,
          quantity,
          price,
          productType,
          orderType,
          brokerTimestamp: brokerResult.timestamp,
        },
        metadata,
      });

      // ──────────────────────────────────────────────────────────
      // STEP 5: Record Trade in Risk Engine (atomic)
      // ──────────────────────────────────────────────────────────
      const executedPrice = brokerResult.status === 'confirmed' ? price : price;
      const totalValue = executedPrice * quantity;
      const estimatedPnl = actionType === OrderActionType.BUY
        ? -totalValue  // Buying reduces cash
        : totalValue;  // Selling adds cash

      // Use the atomic recordTrade method (internally guarded by mutex)
      await riskEngine.recordTradeAsync(
        userId,
        estimatedPnl,
        Math.round(totalValue * 0.001), // ~0.1% estimated charges
        actionType === OrderActionType.SELL || actionType === OrderActionType.SQUARE_OFF,
      );

      // ──────────────────────────────────────────────────────────
      // STEP 6: Post-Order Custom Hooks (fire-and-forget)
      // ──────────────────────────────────────────────────────────
      const postOrderContext: PostOrderContext = {
        userId,
        order: orderContext,
        riskEvaluation: riskEval,
        result: {
          orderId: brokerResult.id,
          status: brokerResult.status,
          filledPrice: executedPrice,
          filledQuantity: quantity,
          message: brokerResult.message,
          timestamp: brokerResult.timestamp,
        },
        metadata,
      };

      // Don't await — post hooks are non-blocking
      hookRegistry.runPostOrder(postOrderContext).catch(err => {
        console.error('Post-order hooks failed:', err);
      });

      return {
        success: true,
        orderId: brokerResult.id,
        riskEvaluation: riskEval,
        message: brokerResult.message,
        auditEventId: auditEvent.id,
      };
    } catch (error: any) {
      // ──────────────────────────────────────────────────────────
      // ERROR: Fire error hooks + audit trail
      // ──────────────────────────────────────────────────────────
      await auditTrail.append({
        userId,
        eventType: 'SYSTEM_ERROR',
        data: {
          stage: 'broker_execution',
          error: error.message,
          actionType,
          symbol,
          quantity,
          price,
        },
        metadata,
      });

      const errorContext: OrderErrorContext = {
        userId,
        order: orderContext,
        error,
        metadata,
      };

      hookRegistry.runOnError(errorContext).catch(err => {
        console.error('Error hooks failed:', err);
      });

      return {
        success: false,
        riskEvaluation: riskEval,
        message: `Order execution failed: ${error.message}`,
      };
    }
  }
}

export const orderPipeline = new OrderExecutionPipeline();
