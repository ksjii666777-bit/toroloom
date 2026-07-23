/**
 * ============================================================================
 * Toroloom — useAutoRefresh Hook
 * ============================================================================
 *
 * Triggers a periodic re-render at the given interval so that relative-time
 * labels (e.g. "Updated 3m ago") stay fresh without user interaction.
 *
 * Usage:
 *   const tick = useAutoRefresh();        // default 30s
 *   const tick = useAutoRefresh(60000);   // custom 60s interval
 *
 * The returned `tick` value increments each interval — useful if you need to
 * use it as a dependency. If you only need the re-render side-effect, you
 * can ignore the return value.
 *
 * ============================================================================
 */

import { useState, useEffect } from 'react';

export function useAutoRefresh(intervalMs: number = 30000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
}
