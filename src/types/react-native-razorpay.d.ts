/**
 * Ambient type declarations for react-native-razorpay.
 *
 * This native module has no official types, so we define the minimal
 * shape consumed by subscriptionStore.ts (initiateUpgrade, setUpAutopay).
 */

declare module 'react-native-razorpay' {
  interface RazorpayCheckoutOptions {
    key: string;
    amount: number;
    currency: string;
    order_id: string;
    name?: string;
    description?: string;
    image?: string;
    prefill?: {
      email?: string;
      contact?: string;
      vpa?: string;
    };
    theme?: {
      color?: string;
    };
    modal?: {
      confirm_close?: boolean;
      ondismiss?: () => void;
    };
  }

  interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  const RazorpayCheckout: {
    open: (options: RazorpayCheckoutOptions) => Promise<RazorpaySuccessResponse>;
  };

  export default RazorpayCheckout;
}
