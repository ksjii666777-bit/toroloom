/**
 * ============================================================================
 * Toroloom — KYC Callback Store
 * ============================================================================
 *
 * Module-level callback registry used by KYC screens to communicate back
 * to ProfileScreen without passing functions via navigation params.
 *
 * Why:
 *   React Navigation complains when non-serializable values (functions) are
 *   passed as route params because it breaks state persistence/restoration.
 *   This store holds the callback at module level so each KYC screen can
 *   invoke it after successful verification.
 *
 * Usage:
 *   // ProfileScreen — before navigating:
 *   kycCallbackStore.setStepCallback('pan', () => {
 *     markStepCompleted('pan');
 *     haptics...
 *   });
 *   navigation.navigate('PanVerification');
 *
 *   // PanVerificationScreen — on continue:
 *   kycCallbackStore.invokeStepCallback('pan', panNumber);
 *   navigation.goBack();
 *
 * ============================================================================
 */

type StepKey = 'pan' | 'aadhaar' | 'digilocker' | 'bank';

type StepCallback = ((...args: any[]) => void) | null;

// Module-level (singleton) state — never passed through navigation
const _registry: Record<StepKey, StepCallback> = {
  pan: null,
  aadhaar: null,
  digilocker: null,
  bank: null,
};

export const kycCallbackStore = {
  /** Register a callback for a given KYC step. */
  setStepCallback(step: StepKey, callback: StepCallback): void {
    _registry[step] = callback;
  },

  /**
   * Invoke the callback for a given step and clear it immediately.
   * Returns true if a callback was found and called.
   */
  invokeStepCallback(step: StepKey, ...args: any[]): boolean {
    const cb = _registry[step];
    if (typeof cb === 'function') {
      cb(...args);
      _registry[step] = null; // auto-clear (one-time use)
      return true;
    }
    return false;
  },

  /** Clear all registered callbacks (e.g. on screen unmount or logout). */
  clearAll(): void {
    _registry.pan = null;
    _registry.aadhaar = null;
    _registry.digilocker = null;
    _registry.bank = null;
  },
};
