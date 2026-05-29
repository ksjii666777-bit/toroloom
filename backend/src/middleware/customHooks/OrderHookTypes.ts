/**
 * ============================================================================
 * Toroloom Custom Feature Hooks — Plugin Architecture
 * ============================================================================
 *
 * These are isolated injection points for the "Modular Custom Feature
 * Extension Engine". Every trading transaction exposes lifecycle hooks where
 * custom parameters, proprietary logic, and future trading strategies can be
 * injected WITHOUT altering the base codebase.
 *
 * To add a custom hook:
 *   1. Create a file in backend/src/services/customFeatures/
 *   2. Implement the relevant hook interface
 *   3. Register it in backend/src/middleware/customHooks/index.ts
 *
 * Example:
 *   import { myStrategy } from '../customFeatures/myStrategy';
 *   registry.register('preOrderExecution', myStrategy);
 */

import { OrderRiskContext, RiskEvaluation } from '../../services/riskEngine/types';

// ==================== Hook Interface Definitions ====================

/**
 * Pre-execution hook — runs BEFORE an order hits the broker.
 *
 * Use cases:
 *   - Custom order validation
 *   - Proprietary risk checks
 *   - Strategy signal verification
 *   - Custom parameter injection
 *   - Position sizing algorithms
 *
 * Return `{ blocked: true, reason }` to stop the order.
 * Return `{ blocked: false }` to allow the order through.
 */
export interface PreOrderExecutionHook {
  readonly name: string;
  execute(context: PreOrderContext): Promise<PreOrderResult>;
}

export interface PreOrderContext {
  userId: string;
  order: OrderRiskContext;
  riskEvaluation: RiskEvaluation;
  metadata: Record<string, unknown>;
}

export interface PreOrderResult {
  /** Name of the hook that produced this result */
  hookName: string;
  blocked: boolean;
  reason?: string;
  /** Injected metadata that flows to post-execution hooks */
  metadata?: Record<string, unknown>;
}

/**
 * Post-execution hook — runs AFTER an order is executed by the broker.
 *
 * Use cases:
 *   - Trade logging to custom databases
 *   - P&L tracking
 *   - Performance analytics
 *   - Telegram/Discord/Email alerts
 *   - Custom order enrichment
 */
export interface PostOrderExecutionHook {
  readonly name: string;
  execute(context: PostOrderContext): Promise<void>;
}

export interface PostOrderContext {
  userId: string;
  order: OrderRiskContext;
  riskEvaluation: RiskEvaluation;
  result: {
    orderId: string;
    status: string;
    filledPrice: number;
    filledQuantity: number;
    message: string;
    timestamp: string;
  };
  metadata: Record<string, unknown>;
}

/**
 * Error hook — runs when an order execution fails.
 *
 * Use cases:
 *   - Graceful error recovery
 *   - Custom retry logic
 *   - Incident reporting
 */
export interface OrderErrorHook {
  readonly name: string;
  execute(context: OrderErrorContext): Promise<void>;
}

export interface OrderErrorContext {
  userId: string;
  order: OrderRiskContext;
  error: Error;
  metadata: Record<string, unknown>;
}

// ==================== Hook Registry ====================

type HookRegistryMap = {
  preOrderExecution: PreOrderExecutionHook[];
  postOrderExecution: PostOrderExecutionHook[];
  orderError: OrderErrorHook[];
};

export class HookRegistry {
  private hooks: HookRegistryMap = {
    preOrderExecution: [],
    postOrderExecution: [],
    orderError: [],
  };

  register(type: 'preOrderExecution' | 'postOrderExecution' | 'orderError', hook: PreOrderExecutionHook | PostOrderExecutionHook | OrderErrorHook): void {
    this.hooks[type].push(hook as any);
    console.log(`🔌 Toroloom Hook Registered: ${hook.name} → ${type}`);
  }

  get(type: 'preOrderExecution' | 'postOrderExecution' | 'orderError'): any[] {
    return this.hooks[type];
  }

  getAll(): HookRegistryMap {
    return { ...this.hooks };
  }

  /**
   * Run all pre-order hooks sequentially.
   * If ANY hook blocks the order, the order is rejected.
   */
  async runPreOrder(context: PreOrderContext): Promise<PreOrderResult | null> {
    for (const hook of this.hooks.preOrderExecution) {
      const result = await hook.execute(context);
      if (result.blocked) {
        console.warn(`⛔ Hook "${hook.name}" blocked order: ${result.reason}`);
        return { ...result, hookName: hook.name };
      }
      // Merge metadata from each hook
      if (result.metadata) {
        Object.assign(context.metadata, result.metadata);
      }
    }
    return null; // No hook blocked the order
  }

  /**
   * Run all post-order hooks in parallel (fire-and-forget).
   */
  async runPostOrder(context: PostOrderContext): Promise<void> {
    await Promise.all(
      this.hooks.postOrderExecution.map(hook =>
        hook.execute(context).catch(err => {
          console.error(`❌ Post-order hook "${hook.name}" failed:`, err);
        }),
      ),
    );
  }

  /**
   * Run all error hooks in parallel (fire-and-forget).
   */
  async runOnError(context: OrderErrorContext): Promise<void> {
    await Promise.all(
      this.hooks.orderError.map(hook =>
        hook.execute(context).catch(err => {
          console.error(`❌ Error hook "${hook.name}" failed:`, err);
        }),
      ),
    );
  }
}

// Singleton hook registry
export const hookRegistry = new HookRegistry();
