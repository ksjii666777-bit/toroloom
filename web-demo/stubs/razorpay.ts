/**
 * Web stub for `react-native-razorpay`.
 *
 * Pulled transitively by a store in the OfflineBanner chain; its native
 * TurboModule source imports `TurboModuleRegistry` from react-native, which
 * react-native-web doesn't export. The demo never opens a checkout, so the
 * checkout is a no-op.
 */

const RazorpayCheckout = {
  open: async (): Promise<void> => undefined,
  onPaymentSuccess: null,
  onPaymentError: null,
  onPaymentCancel: null,
};

export default RazorpayCheckout;
