/**
 * ============================================================================
 * Toroloom Custom Features — Pluggable Extension Point
 * ============================================================================
 *
 * This directory is the official extension point for future trading strategies,
 * custom analytics, proprietary indicators, and any custom business logic.
 *
 * HOW TO ADD A CUSTOM FEATURE:
 *
 *   1. Create a new file or directory here (e.g., myStrategy.ts)
 *   2. Implement one of the hook interfaces from middleware/customHooks/
 *   3. Register it in the hookRegistry
 *
 * Example:
 *   // backend/src/services/customFeatures/myStrategy.ts
 *   import { PreOrderExecutionHook } from '../../middleware/customHooks/OrderHookTypes';
 *
 *   export const myStrategy: PreOrderExecutionHook = {
 *     name: 'My Custom Strategy',
 *     async execute(context) {
 *       // Your proprietary logic here
 *       return { blocked: false };
 *     },
 *   };
 *
 *   // Then in some init file:
 *   import { hookRegistry } from '../../middleware/customHooks';
 *   import { myStrategy } from './myStrategy';
 *   hookRegistry.register('preOrderExecution', myStrategy);
 */

export {};

// ────────────────────────────────────────────────────────────────────────────
// Starter Example — Trading Volume Spike Detector
// ────────────────────────────────────────────────────────────────────────────
// Uncomment and register to see the hook system in action:
//
// import { PreOrderExecutionHook } from '../../middleware/customHooks';
//
// export const volumeSpikeDetector: PreOrderExecutionHook = {
//   name: 'Volume Spike Detector',
//   async execute(context) {
//     const { symbol, quantity, price } = context.order;
//
//     // Hypothetical: check if volume exceeds a threshold
//     if (quantity && price && (quantity * price) > 1000000) {
//       return {
//         blocked: true,
//         reason: `Order value exceeds ₹10L threshold. Manual approval required.`,
//       };
//     }
//
//     return { blocked: false };
//   },
// };
