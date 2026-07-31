import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UpstoxBroker } from '../services/broker/upstoxBroker';

// ──────────────── UpstoxBroker — subscribeTicks (forex streaming) ────────────────
// Upstox's real market-data WebSocket (wss://api.upstox.com/v2/feed/market-data-feed/websocket)
// is not wired up yet. Forex pairs stream from the shared simulated feed
// (backend/src/services/broker/forexQuotes.ts) so the /ws feed has live forex data
// even before the native Upstox WS integration lands.

describe('UpstoxBroker — subscribeTicks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('streams simulated forex ticks for forex symbols', () => {
    const broker = new UpstoxBroker();
    const onTick = vi.fn();
    const unsubscribe = broker.subscribeTicks(['USDINR', 'EURUSD'], onTick);

    expect(typeof unsubscribe).toBe('function');

    vi.advanceTimersByTime(5000);
    expect(onTick).toHaveBeenCalled();
    const symbols = onTick.mock.calls.map((c: any[]) => c[0].symbol);
    expect(symbols).toContain('USDINR');
    expect(symbols).toContain('EURUSD');

    unsubscribe();
  });

  it('returns a no-op stream for unsupported (stock) symbols', () => {
    const broker = new UpstoxBroker();
    const onTick = vi.fn();
    const unsubscribe = broker.subscribeTicks(['RELIANCE'], onTick);

    expect(typeof unsubscribe).toBe('function');

    vi.advanceTimersByTime(5000);
    expect(onTick).not.toHaveBeenCalled();

    unsubscribe();
  });
});
