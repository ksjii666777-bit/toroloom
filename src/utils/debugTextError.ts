/**
 * ============================================================================
 * Toroloom — Text Error Debug Utility
 * ============================================================================
 *
 * Dev-only: Intercepts React Native's "Text strings must be rendered within
 * a <Text>" console.error and logs markers before/after so we can identify
 * the exact component causing the issue from Metro's output.
 *
 * NOTE: This doesn't show the React component stack directly — it marks the
 * error in Metro's console so you can see which screen/component is rendering
 * when the error fires.
 *
 * Import ONCE in App.tsx:
 *   import './src/utils/debugTextError';
 *
 * ============================================================================
 */

// Safe stringify helper (handles circular references)
function safeStringify(value: unknown): string {
  try {
    const seen = new WeakSet();
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    }, 2);
  } catch {
    return String(value);
  }
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const TEXT_ERROR_PATTERN = 'Text strings must be rendered within a <Text> component';

  const originalConsoleError = console.error;

  console.error = (...args: any[]) => {
    const message = args.join(' ');
    if (message.includes(TEXT_ERROR_PATTERN)) {
      console.warn(
        '\n═══════════════════════════════════════════════════════════════',
        '\n🔍 TEXT STRINGS ERROR DETECTED — Check the following screen(s):',
        '\n═══════════════════════════════════════════════════════════════',
      );
      // Log each argument clearly
      args.forEach((a, i) => {
        if (typeof a === 'string') {
          console.warn(`  [${i}] ${a.substring(0, 500)}`);
        } else if (a instanceof Error) {
          console.warn(`  [${i}] Error: ${a.message}`);
          console.warn(a.stack?.split('\n').slice(0, 8).join('\n'));
        } else {
          console.warn(`  [${i}] ${safeStringify(a).substring(0, 300)}`);
        }
      });
      console.warn('═══════════════════════════════════════════════════════════════\n');
    }

    originalConsoleError.apply(console, args);
  };
}

export {};
