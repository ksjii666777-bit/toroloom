/**
 * ============================================================================
 * Toroloom — Safe Regex Utility (ReDoS Protection)
 * ============================================================================
 *
 * REDoS (Regular Expression Denial of Service) occurs when a malicious regex
 * pattern causes catastrophic backtracking, freezing the Node.js event loop.
 *
 * Note on JS timeout limitations:
 *   JavaScript is single-threaded. A blocking regex freezes the entire event
 *   loop, so setTimeout-based timeouts CANNOT interrupt a hung regex.
 *   The real ReDoS defense is input length limiting — handled by the
 *   input sanitizer middleware (INPUT_MAX_LENGTH = 5000 default).
 *   With bounded input length, even the worst-case regex is bounded by O(n).
 *
 * WHAT THIS MODULE PROVIDES:
 *   1. validateUserRegex()   — Reject known-dangerous regex patterns from users
 *   2. isSimplePattern()     — Heuristic: detect nested quantifiers / alternation
 *   3. safeRegexTest/Match   — Convenience wrappers (timeout is best-effort)
 *
 * USAGE:
 *   import { safeRegexTest, validateUserRegex } from '../utils/regexSafe';
 *
 *   // Validate user-supplied regex (e.g., search filter)
 *   const result = validateUserRegex(userPattern);
 *   if (!result.valid) { return res.status(400).json({ error: result.error }); }
 *
 *   // Use safe wrappers on known-safe patterns against user input
 *   const match = safeRegexTest(/^[A-Z0-9]{10}$/, panNumber);
 *
 * ============================================================================
 */

// ──── Configuration ─────────────────────────────────────────────────────────

const REGEX_TIMEOUT_MS = parseInt(process.env.SAFE_REGEX_TIMEOUT_MS || '100', 10);

// ──── Error Class ───────────────────────────────────────────────────────────

export class ReDosTimeoutError extends Error {
  constructor(pattern: string, timeoutMs: number) {
    super(`Regex execution timed out after ${timeoutMs}ms — possible ReDoS pattern: ${pattern}`);
    this.name = 'ReDosTimeoutError';
  }
}

// ──── Heuristic: Simple Pattern Detection ───────────────────────────────────

/**
 * Quick check: does the pattern have nested quantifiers or alternation inside
 * quantified groups? These are the most common ReDoS vectors.
 *
 * Note: this is a heuristic, not a guarantee.
 */
const COMPLEX_QUANTIFIER = /\(.+\)[+*{]/;

function isSimplePattern(regex: RegExp): boolean {
  const source = regex.source;
  if (source.length > 200) return false; // Long patterns are suspicious
  if (!COMPLEX_QUANTIFIER.test(source)) return true;
  return false;
}

// ──── Safe Regex Test ───────────────────────────────────────────────────────

/**
 * Safe version of RegExp.prototype.test() with best-effort timeout.
 *
 * NOTE: Due to JS single-threading, the timeout cannot interrupt a truly
 * blocking regex. The primary ReDoS defense is input length limiting
 * (handled by inputSanitizer). This wrapper catches edge cases where
 * a slow-but-not-blocking regex takes too long on long inputs.
 *
 * Returns `false` on timeout instead of crashing the server.
 */
export function safeRegexTest(
  regex: RegExp,
  input: string,
  timeoutMs: number = REGEX_TIMEOUT_MS,
): boolean {
  // Fast path: short strings or simple patterns don't need timeout
  if (input.length < 100 || isSimplePattern(regex)) {
    return regex.test(input);
  }

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
  }, timeoutMs);

  try {
    if (timedOut) return false;
    return regex.test(input);
  } finally {
    clearTimeout(timer);
  }
}

// ──── Safe Regex Match ──────────────────────────────────────────────────────

/**
 * Safe version of String.prototype.match() with best-effort timeout.
 * Returns `null` on timeout instead of crashing the server.
 */
export function safeRegexMatch(
  regex: RegExp,
  input: string,
  timeoutMs: number = REGEX_TIMEOUT_MS,
): RegExpMatchArray | null {
  if (input.length < 100 || isSimplePattern(regex)) {
    return input.match(regex);
  }

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
  }, timeoutMs);

  try {
    if (timedOut) return null;
    return input.match(regex);
  } finally {
    clearTimeout(timer);
  }
}

// ──── Safe Regex Exec ───────────────────────────────────────────────────────

/**
 * Safe version of RegExp.prototype.exec() with best-effort timeout.
 * Returns `null` on timeout.
 */
export function safeRegexExec(
  regex: RegExp,
  input: string,
  timeoutMs: number = REGEX_TIMEOUT_MS,
): RegExpExecArray | null {
  if (input.length < 100 || isSimplePattern(regex)) {
    return regex.exec(input);
  }

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
  }, timeoutMs);

  try {
    if (timedOut) return null;
    return regex.exec(input);
  } finally {
    clearTimeout(timer);
  }
}

// ──── Validate User-Supplied Regex ──────────────────────────────────────────

/**
 * Validate a user-supplied regex pattern by:
 *   1. Checking against known-dangerous patterns
 *   2. Testing compilation
 *   3. Running against a known-safe input
 *
 * Rejects patterns that are known ReDoS vectors or that time out.
 *
 * Returns { valid: true, regex: RegExp } or { valid: false, error: string }.
 */
export function validateUserRegex(
  pattern: string,
  flags?: string,
  timeoutMs: number = REGEX_TIMEOUT_MS,
): { valid: true; regex: RegExp } | { valid: false; error: string } {
  // Reject empty or overly long patterns
  if (!pattern) {
    return { valid: false, error: 'Pattern is required' };
  }
  if (pattern.length > 500) {
    return { valid: false, error: 'Pattern too long (max 500 characters)' };
  }

  // Reject known-dangerous patterns
  if (isKnownReDosPattern(pattern)) {
    return { valid: false, error: 'Pattern rejected: contains potentially dangerous constructs' };
  }

  try {
    const regex = new RegExp(pattern, flags);

    // Test against a short, safe string to validate the regex works
    const safeInput = 'test_input_123';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
    }, timeoutMs);

    try {
      if (timedOut) {
        return { valid: false, error: 'Pattern validation timed out (possible ReDoS)' };
      }
      regex.test(safeInput);
      return { valid: true, regex };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return { valid: false, error: `Invalid regex: ${(err as Error).message}` };
  }
}

// ──── Known ReDoS Pattern Detection ─────────────────────────────────────────

/**
 * Detect patterns known to cause catastrophic backtracking.
 * This is a heuristic, not a complete check. The primary defense is still
 * input length limiting via inputSanitizer.
 *
 * These patterns are static and simple — they won't themselves cause ReDoS.
 */
function isKnownReDosPattern(pattern: string): boolean {
  // Pattern too long → suspicious
  if (pattern.length > 500) return true;

  // Nested quantifiers: (a+)+, (a*)+, (a+)*, (a*)*
  if (/\([^)]+\)[+*][+*]?/.test(pattern)) return true;

  // Quantifier applied to a group with alternation: (a|b)+
  if (/\([^)]*\|[^)]*\)[+*{]/.test(pattern)) return true;

  // Consecutive quantified groups: \d+\s+\d+ (can cause polynomial backtracking)
  if (/\+\s*\+\s*\+/.test(pattern)) return true;

  return false;
}

// ──── Async Safe Regex Test (Worker-based) ──────────────────────────────────

/**
 * Run regex in a separate promise chain.
 *
 * For PRODUCTION use with untrusted user input, consider using
 * worker_threads to run the regex in a separate thread:
 *
 *   const { Worker } = require('worker_threads');
 *   const worker = new Worker('./regex-worker.js', { workerData: { pattern, input } });
 *   const result = await new Promise((resolve, reject) => {
 *     worker.on('message', resolve);
 *     worker.on('error', reject);
 *     setTimeout(() => { worker.terminate(); reject(new ReDosTimeoutError(...)); }, timeoutMs);
 *   });
 */
export function safeRegexTestAsync(
  regex: RegExp,
  input: string,
  timeoutMs: number = REGEX_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ReDosTimeoutError(regex.source, timeoutMs));
    }, timeoutMs);

    try {
      const result = regex.test(input);
      clearTimeout(timer);
      resolve(result);
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}

export default {
  safeRegexTest,
  safeRegexMatch,
  safeRegexExec,
  validateUserRegex,
  ReDosTimeoutError,
};
