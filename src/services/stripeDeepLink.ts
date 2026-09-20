/**
 * ============================================================================
 * Toroloom — Stripe Checkout Deep Link Handler
 * ============================================================================
 *
 * The US/EU checkout flow ends in the system browser (Stripe Checkout). The
 * backend's success_url / cancel_url point back into the app:
 *
 *   toroloom://subscription/success?session_id=cs_...
 *   toroloom://subscription/cancelled
 *
 * On `success` the user's tier may have been upgraded by the backend webhook
 * while they were paying — re-pull the authoritative subscription from the
 * server (syncFromServer). A single refresh per URL is guaranteed via a
 * last-URL guard, mirroring the SnapTrade callback dedupe.
 *
 * Wiring (AppContent): this module registers its own Linking listener next
 * to the E2E deep-link handler; nothing else needs to know about it.
 * ============================================================================
 */

import { Linking } from 'react-native';
import { log } from '../utils/logger';
import { useSubscriptionStore } from '../store/subscriptionStore';

const SUCCESS_PREFIX = 'toroloom://subscription/success';
const CANCELLED_PREFIX = 'toroloom://subscription/cancelled';

/** Dedupe: deep links can arrive twice (getInitialURL + the event listener). */
let lastHandledUrl: string | null = null;

export async function handleStripeDeepLink(url: string | null): Promise<void> {
  if (!url || lastHandledUrl === url) return;
  if (!url.startsWith(SUCCESS_PREFIX) && !url.startsWith(CANCELLED_PREFIX)) return;

  lastHandledUrl = url;

  if (url.startsWith(CANCELLED_PREFIX)) {
    log.info('[Stripe] Checkout cancelled by user — subscription unchanged');
    return;
  }

  // Success → the webhook may have upgraded the tier while the user paid.
  const synced = await useSubscriptionStore.getState().syncFromServer();
  if (synced) {
    log.info('[Stripe] Subscription refreshed after checkout success');
  } else {
    // Webhook may still be in flight (Stripe retries non-2xx) — the next
    // app launch's server pull reconciles any remaining gap.
    log.warn('[Stripe] Subscription sync failed after checkout — will reconcile later');
  }
}

/**
 * Register the deep-link listeners. Returns an unsubscribe function.
 * Safe to call once from AppContent's mount effect.
 */
export function registerStripeDeepLinkHandler(): () => void {
  Linking.getInitialURL()
    .then(handleStripeDeepLink)
    .catch(() => { /* cold-start URL is optional */ });

  const sub = Linking.addEventListener('url', (event) => {
    handleStripeDeepLink(event.url);
  });

  return () => sub.remove();
}

/** Exported for tests — module-level state must reset between runs. */
export function resetStripeDeepLinkState(): void {
  lastHandledUrl = null;
}
