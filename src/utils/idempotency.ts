/**
 * ============================================================================
 * Toroloom — Idempotency Key Generator (frontend)
 * ============================================================================
 *
 * Generates a uuid-v4-shaped idempotency key for order requests. Sent with
 * every order so a retry (network loss, app kill, offline replay) returns the
 * server's ORIGINAL result instead of executing a duplicate order.
 *
 * crypto.randomUUID is not available in every React Native runtime, so we
 * build one from Math.random — collision-safe enough for per-user dedup.
 *
 * ============================================================================
 */

export function newIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
