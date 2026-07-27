/**
 * ============================================================================
 * Regex Safe — Unit Tests
 * ============================================================================
 *
 * Covers all exported functions:
 *   - ReDosTimeoutError       — Error class
 *   - safeRegexTest()         — Safe regex .test() with best-effort timeout
 *   - safeRegexMatch()        — Safe String.prototype.match()
 *   - safeRegexExec()         — Safe RegExp.prototype.exec()
 *   - validateUserRegex()     — User-supplied regex validation (ReDoS prevention)
 *   - safeRegexTestAsync()    — Promise-based async wrapper
 *
 * KEY DESIGN NOTE:
 *   The timeout mechanism is best-effort because JavaScript is single-threaded.
 *   A truly blocking regex cannot be interrupted by setTimeout. The real ReDoS
 *   defense is input length limiting (handled by inputSanitizer.ts).
 *   These tests verify the wrapper behavior for normal (non-blocking) regex.
 *
 * Run: npx vitest run src/__tests__/regexSafe.test.ts
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';

async function importModule() {
  return await import('../utils/regexSafe');
}

// ============================================================================
// 1. ReDosTimeoutError
// ============================================================================

describe('ReDosTimeoutError', () => {
  it('creates an error with pattern and timeout info in the message', async () => {
    const { ReDosTimeoutError } = await importModule();
    const err = new ReDosTimeoutError('(a+)+b', 100);

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ReDosTimeoutError');
    expect(err.message).toContain('(a+)+b');
    expect(err.message).toContain('100');
  });
});

// ============================================================================
// 2. safeRegexTest — Basic Matching
// ============================================================================

describe('safeRegexTest — basic matching', () => {
  it('returns true when pattern matches', async () => {
    const { safeRegexTest } = await importModule();
    expect(safeRegexTest(/^hello/, 'hello world')).toBe(true);
  });

  it('returns false when pattern does not match', async () => {
    const { safeRegexTest } = await importModule();
    expect(safeRegexTest(/^hello/, 'world')).toBe(false);
  });

  it('matches case-sensitively by default', async () => {
    const { safeRegexTest } = await importModule();
    expect(safeRegexTest(/hello/, 'Hello')).toBe(false);
    expect(safeRegexTest(/hello/i, 'Hello')).toBe(true);
  });

  it('matches global flag correctly', async () => {
    const { safeRegexTest } = await importModule();
    const regex = /a/g;
    expect(safeRegexTest(regex, 'bbb')).toBe(false);
    expect(safeRegexTest(regex, 'aba')).toBe(true);
  });
});

// ============================================================================
// 3. safeRegexTest — Simple Pattern Fast Path
// ============================================================================

describe('safeRegexTest — simple pattern fast path', () => {
  it('uses fast path for short inputs (< 100 chars)', async () => {
    const { safeRegexTest } = await importModule();
    expect(safeRegexTest(/^\d{3}-\d{4}$/, '123-4567')).toBe(true);
    expect(safeRegexTest(/^\d{3}-\d{4}$/, 'abc-defg')).toBe(false);
  });

  it('uses fast path for simple patterns even on long inputs', async () => {
    const { safeRegexTest } = await importModule();
    const longInput = 'a'.repeat(500);
    expect(safeRegexTest(/^a+$/, longInput)).toBe(true);
  });
});

// ============================================================================
// 4. safeRegexTest — Complex Pattern Path
// ============================================================================

describe('safeRegexTest — complex pattern path', () => {
  it('handles complex patterns with long inputs', async () => {
    const { safeRegexTest } = await importModule();
    const longInput = 'test ' + 'a'.repeat(200);
    expect(safeRegexTest(/(a|b)+/, longInput)).toBe(true);
  });

  it('handles nested quantifier patterns', async () => {
    const { safeRegexTest } = await importModule();
    const longInput = 'x'.repeat(200);
    expect(safeRegexTest(/(x+)+$/, longInput)).toBe(true);
  });

  it('returns false for non-matching complex patterns', async () => {
    const { safeRegexTest } = await importModule();
    const longInput = 'a'.repeat(200);
    expect(safeRegexTest(/(b|c)+/, longInput)).toBe(false);
  });
});

// ============================================================================
// 5. safeRegexMatch
// ============================================================================

describe('safeRegexMatch', () => {
  it('returns match array on success', async () => {
    const { safeRegexMatch } = await importModule();
    const result = safeRegexMatch(/hello/, 'hello world');
    expect(result).not.toBeNull();
    expect(result![0]).toBe('hello');
  });

  it('returns null when no match', async () => {
    const { safeRegexMatch } = await importModule();
    expect(safeRegexMatch(/hello/, 'world')).toBeNull();
  });

  it('returns captured groups', async () => {
    const { safeRegexMatch } = await importModule();
    const result = safeRegexMatch(/(\d{3})-(\d{4})/, 'Call 123-4567 now');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('123');
    expect(result![2]).toBe('4567');
  });

  it('handles empty input', async () => {
    const { safeRegexMatch } = await importModule();
    expect(safeRegexMatch(/.*/, '')).not.toBeNull();
  });
});

// ============================================================================
// 6. safeRegexExec
// ============================================================================

describe('safeRegexExec', () => {
  it('returns exec array with match details', async () => {
    const { safeRegexExec } = await importModule();
    const result = safeRegexExec(/(\w+)@(\w+)/, 'user@example');
    expect(result).not.toBeNull();
    expect(result![0]).toBe('user@example');
    expect(result![1]).toBe('user');
    expect(result![2]).toBe('example');
  });

  it('returns null when no match', async () => {
    const { safeRegexExec } = await importModule();
    expect(safeRegexExec(/hello/, 'world')).toBeNull();
  });

  it('tracks lastIndex with sticky flag', async () => {
    const { safeRegexExec } = await importModule();
    const regex = /a/y;
    expect(safeRegexExec(regex, 'aba')).not.toBeNull();
    expect(regex.lastIndex).toBe(1);
  });

  it('iterates through multiple matches', async () => {
    const { safeRegexExec } = await importModule();
    const regex = /(a)/g;
    const input = 'aa';

    const first = safeRegexExec(regex, input);
    expect(first).not.toBeNull();
    expect(first![1]).toBe('a');

    const second = safeRegexExec(regex, input);
    expect(second).not.toBeNull();
    expect(second![1]).toBe('a');

    const third = safeRegexExec(regex, input);
    expect(third).toBeNull();
  });
});

// ============================================================================
// 7. validateUserRegex — Valid Patterns
// ============================================================================

describe('validateUserRegex — valid patterns', () => {
  it('accepts a simple digit pattern', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('^\\d{4}$');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.regex).toBeInstanceOf(RegExp);
      expect(result.regex.test('1234')).toBe(true);
    }
  });

  it('accepts patterns with flags', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('^hello', 'i');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.regex.flags).toContain('i');
      expect(result.regex.test('HELLO world')).toBe(true);
    }
  });

  it('accepts patterns with multiple flags', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('^hello.world$', 'is');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.regex.flags).toContain('i');
      expect(result.regex.flags).toContain('s');
    }
  });
});

// ============================================================================
// 8. validateUserRegex — Invalid Patterns
// ============================================================================

describe('validateUserRegex — invalid patterns', () => {
  it('rejects empty pattern', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects pattern that is too long (> 500 chars)', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('a'.repeat(501));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('rejects syntactically invalid regex', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('[invalid');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid regex');
  });

  it('rejects regex with unmatched closing parenthesis', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('hello)');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid regex');
  });

  it('rejects regex with unmatched opening parenthesis', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('(hello');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid regex');
  });
});

// ============================================================================
// 9. validateUserRegex — ReDoS Pattern Detection
// ============================================================================

describe('validateUserRegex — ReDoS pattern rejection', () => {
  it('rejects nested quantifiers: (a+)+', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('(a+)+');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('dangerous');
  });

  it('rejects nested quantifiers: ([a-z]+\\d+)+', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('([a-z]+\\d+)+');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('dangerous');
  });

  it('rejects alternation inside quantified group: (a|b)+', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('(a|b)+');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('dangerous');
  });


  it('rejects (a*)+ pattern', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('(a*)+');
    expect(result.valid).toBe(false);
  });

  it('rejects pattern with quantifier on alternation: (?:abc|def)+', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('(?:abc|def)+');
    expect(result.valid).toBe(false);
  });

  it('rejects nested capture group with alternatives: ((a|b)+)', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('((a|b)+)');
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// 10. validateUserRegex — Known Safe Complex Patterns
// ============================================================================

describe('validateUserRegex — safe complex patterns', () => {
  it('accepts IPv4 address pattern', async () => {
    const { validateUserRegex } = await importModule();
    const pattern = '^(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$';
    const result = validateUserRegex(pattern);
    expect(result.valid).toBe(true);
  });

  it('accepts URL pattern with alternation', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('^(https?|ftp)://[^\\s/$.?#].[^\\s]*$');
    expect(result.valid).toBe(true);
  });

  it('accepts hex color pattern', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$');
    expect(result.valid).toBe(true);
  });

  it('accepts date pattern (YYYY-MM-DD)', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('^\\d{4}-\\d{2}-\\d{2}$');
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// 11. safeRegexTestAsync — Promise-based Async
// ============================================================================

describe('safeRegexTestAsync', () => {
  it('resolves to true when pattern matches', async () => {
    const { safeRegexTestAsync } = await importModule();
    await expect(safeRegexTestAsync(/hello/, 'hello world')).resolves.toBe(true);
  });

  it('resolves to false when pattern does not match', async () => {
    const { safeRegexTestAsync } = await importModule();
    await expect(safeRegexTestAsync(/hello/, 'world')).resolves.toBe(false);
  });
});

// ============================================================================
// 12. validateUserRegex + safeRegexTest Integration
// ============================================================================

describe('validateUserRegex + safeRegexTest integration', () => {
  it('validates a simple pattern and uses it with safeRegexTest', async () => {
    const { validateUserRegex, safeRegexTest } = await importModule();

    const result = validateUserRegex('^\\d{4}$');
    expect(result.valid).toBe(true);

    if (result.valid) {
      expect(safeRegexTest(result.regex, '1234')).toBe(true);
      expect(safeRegexTest(result.regex, 'abcd')).toBe(false);
    }
  });

  it('rejects known ReDoS pattern', async () => {
    const { validateUserRegex } = await importModule();
    const result = validateUserRegex('(a+)+b');
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// 13. Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('handles empty input string', async () => {
    const { safeRegexTest, safeRegexMatch } = await importModule();
    expect(safeRegexTest(/^$/, '')).toBe(true);
    expect(safeRegexMatch(/.*/, '')).not.toBeNull();
  });

  it('handles special regex metacharacters as literals', async () => {
    const { safeRegexTest } = await importModule();
    expect(safeRegexTest(/\.\?\*\+/, '.?*+')).toBe(true);
  });

  it('handles unicode characters', async () => {
    const { safeRegexTest } = await importModule();
    expect(safeRegexTest(/^[\u0020-\u007E]+$/, 'Hello World!')).toBe(true);
  });

  it('handles very long inputs with simple patterns', async () => {
    const { safeRegexTest } = await importModule();
    const longInput = 'test_' + 'x'.repeat(500) + '_end';
    expect(safeRegexTest(/test_/, longInput)).toBe(true);
    expect(safeRegexTest(/_end$/, longInput)).toBe(true);
    expect(safeRegexTest(/^test_/, longInput)).toBe(true);
  });

  it('handles multiline strings', async () => {
    const { safeRegexTest } = await importModule();
    expect(safeRegexTest(/world$/m, 'hello\nworld')).toBe(true);
    expect(safeRegexTest(/^hello/m, 'hello\nworld')).toBe(true);
  });

  it('handles PAN card and IFSC patterns', async () => {
    const { safeRegexTest } = await importModule();
    // PAN: 5 uppercase + 4 digits + 1 uppercase
    expect(safeRegexTest(/^[A-Z]{5}\d{4}[A-Z]$/, 'ABCDE1234F')).toBe(true);
    expect(safeRegexTest(/^[A-Z]{5}\d{4}[A-Z]$/, 'abcde1234f')).toBe(false);
    // IFSC: 4 letters + 0 + 6 alphanumeric
    expect(safeRegexTest(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'HDFC0001234')).toBe(true);
  });
});

// ============================================================================
// 14. Default Export
// ============================================================================

describe('default export', () => {
  it('includes all public functions', async () => {
    const mod = await importModule();
    const defaultExport = mod.default;

    expect(defaultExport.safeRegexTest).toBe(mod.safeRegexTest);
    expect(defaultExport.safeRegexMatch).toBe(mod.safeRegexMatch);
    expect(defaultExport.safeRegexExec).toBe(mod.safeRegexExec);
    expect(defaultExport.validateUserRegex).toBe(mod.validateUserRegex);
    expect(defaultExport.ReDosTimeoutError).toBe(mod.ReDosTimeoutError);
  });
});
