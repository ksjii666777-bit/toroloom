/**
 * Custom Hooks Module — Barrel Exports
 *
 * Import this from routes/services to access the hook system:
 *   import { hookRegistry, PreOrderExecutionHook } from '../middleware/customHooks';
 */

export { OrderActionType } from '../../services/riskEngine/types';
export type {
  PreOrderExecutionHook,
  PostOrderExecutionHook,
  OrderErrorHook,
  PreOrderContext,
  PostOrderContext,
  OrderErrorContext,
  PreOrderResult,
} from './OrderHookTypes';
export { HookRegistry, hookRegistry } from './OrderHookTypes';
