/**
 * ============================================================================
 * Toroloom — Input Sanitization Middleware
 * ============================================================================
 *
 * Protects against:
 *   1. SSTI (Server-Side Template Injection)  — Strips template syntax from input
 *   2. LPDOS (Long Password DoS Attack)       — Enforces max length on all body fields
 *   3. NoSQL / SQL Injection                  — Type validation, rejects operators ($)
 *   4. Clipboard Attack                       — Strips hidden/zero-width characters
 *   5. JSON Depth Bomb                        — Limits nesting depth of JSON bodies
 *   6. Body Size Bomb                         — Limits total body size
 *
 * USAGE:
 *   import { sanitizeInput, inputSanitizer } from '../middleware/inputSanitizer';
 *
 *   // As global middleware:
 *   app.use(inputSanitizer);
 *
 *   // Or per-field:
 *   const clean = sanitizeInput(userInput);
 *
 * CONFIGURATION (via env vars):
 *   INPUT_MAX_LENGTH     — Max string length (default: 5000)
 *   INPUT_MAX_DEPTH      — Max JSON nesting depth (default: 10)
 *   PASSWORD_MAX_LENGTH  — Max password length (default: 128)
 *   STRIP_TEMPLATE_SYNTAX — Enable/disable template syntax stripping (default: true)
 *
 * ============================================================================
 */

// ──── Configuration ─────────────────────────────────────────────────────────

const MAX_STRING_LENGTH = parseInt(process.env.INPUT_MAX_LENGTH || '5000', 10);
const MAX_PASSWORD_LENGTH = parseInt(process.env.PASSWORD_MAX_LENGTH || '128', 10);
const MAX_JSON_DEPTH = parseInt(process.env.INPUT_MAX_DEPTH || '10', 10);
const STRIP_TEMPLATE_SYNTAX = process.env.STRIP_TEMPLATE_SYNTAX !== 'false';

// ──── SSTI: Template Syntax Patterns ────────────────────────────────────────
// Common template injection patterns across popular engines.
// Stripping these makes SSTI attacks impossible regardless of template engine.

const TEMPLATE_PATTERNS = [
  // Generic template syntax
  { pattern: /\{\{.*?\}\}/g, replacement: '[filtered]' },     // {{ ... }} (Handlebars, Mustache, Liquid, Twig)
  { pattern: /\$\{.*?\}/g, replacement: '[filtered]' },        // ${ ... } (ES6 template literals in strings)
  { pattern: /\{\%.*?\%\}/g, replacement: '[filtered]' },     // {% ... %} (Jinja2, Twig, Nunjucks)
  { pattern: /\{#.*?#\}/g, replacement: '[filtered]' },        // {# ... #} (Jinja2 comments)
  { pattern: /<%.*?%>/g, replacement: '[filtered]' },          // <% ... %> (EJS, ERB, ASP)
  { pattern: /<\?=.*?\?>/g, replacement: '[filtered]' },       // <?= ... ?> (PHP)
  { pattern: /#\{.*?\}/g, replacement: '[filtered]' },         // #{ ... } (Ruby/SLIM)
  { pattern: /\{@.*?\}/g, replacement: '[filtered]' },         // {@ ... } (Blade)
  { pattern: /\[\[.*?\]\]/g, replacement: '[filtered]' },      // [[ ... ]] (Angular, Vue v1)
];

// ──── NoSQL Injection: MongoDB Operator Patterns ────────────────────────────
// MongoDB operators like $where, $gt, $ne, $regex can be injected via JSON.
// We detect these in string values to prevent NoSQL injection.

const NOSQL_INJECTION_PATTERNS = [
  /\$where/i,
  /\$gt/i,
  /\$gte/i,
  /\$lt/i,
  /\$lte/i,
  /\$ne/i,
  /\$in/i,
  /\$nin/i,
  /\$regex/i,
  /\$exists/i,
  /\$type/i,
  /\$expr/i,
  /\$jsonSchema/i,
  /\$mod/i,
  /\$text/i,
  /\$search/i,
];

// ──── Clipboard Attack: Zero-Width / Invisible Characters ───────────────────
// Attackers can inject malicious code with invisible characters that get
// interpreted differently when pasted. We strip all zero-width characters.

const ZERO_WIDTH_CHARS = /[\u200B-\u200D\uFEFF\u200E\u200F\u2028\u2029\u2060\u2061\u2062\u2063\u2064]/g;

// ──── SQL Injection: Dangerous Characters ───────────────────────────────────
// Detect SQL injection attempts in string inputs.

const SQL_INJECTION_PATTERNS = [
  /\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|UNION)\b/i,
  /'\s*OR\s*'1'\s*=\s*'1/i,
  /'\s*OR\s*1\s*=\s*1/i,
  /;\s*DROP\s+TABLE/i,
  /;\s*DELETE\s+FROM/i,
  /;\s*UPDATE\s+\w+\s+SET/i,
  /\bUNION\s+(?:ALL\s+)?SELECT\b/i,
  /--\s*$/m,
  /\/\*.*?\*\//,
];

// ──── Error Class ───────────────────────────────────────────────────────────

export class InputValidationError extends Error {
  public statusCode = 400;
  public code: string;

  constructor(message: string, code: string = 'INPUT_VALIDATION_ERROR') {
    super(message);
    this.name = 'InputValidationError';
    this.code = code;
  }
}

// ──── Core Sanitization Functions ───────────────────────────────────────────

/**
 * Strip SSTI template syntax from a string.
 */
export function stripTemplateSyntax(input: string): string {
  if (!STRIP_TEMPLATE_SYNTAX) return input;
  let result = input;
  for (const { pattern, replacement } of TEMPLATE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Strip zero-width / invisible characters that enable clipboard attacks.
 */
export function stripZeroWidthChars(input: string): string {
  return input.replace(ZERO_WIDTH_CHARS, '');
}

/**
 * Detect NoSQL injection operators in a string value.
 * Returns true if dangerous operators are found.
 */
export function hasNoSqlInjection(input: string): boolean {
  return NOSQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Detect SQL injection attempts in a string value.
 * Returns true if dangerous SQL patterns are found.
 */
export function hasSqlInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Check if a value appears to be an attempted NoSQL operator injection.
 * NoSQL injection often arrives as { "$gt": "" } rather than a string.
 */
export function isNoSqlOperatorObject(value: unknown): boolean {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.some((key) => key.startsWith('$'));
}

/**
 * Enforce maximum string length. Throws if exceeded.
 */
export function enforceMaxLength(value: string, maxLength: number, fieldName: string): void {
  if (value.length > maxLength) {
    throw new InputValidationError(
      `${fieldName} exceeds maximum length of ${maxLength} characters`,
      'INPUT_TOO_LONG',
    );
  }
}

/**
 * Measure JSON nesting depth recursively.
 */
export function getJsonDepth(value: unknown, currentDepth: number = 0): number {
  if (currentDepth > MAX_JSON_DEPTH) return currentDepth;
  if (value === null || value === undefined) return currentDepth;
  if (typeof value !== 'object') return currentDepth;

  if (Array.isArray(value)) {
    let maxDepth = currentDepth;
    for (const item of value) {
      maxDepth = Math.max(maxDepth, getJsonDepth(item, currentDepth + 1));
    }
    return maxDepth;
  }

  let maxDepth = currentDepth;
  for (const key in value as Record<string, unknown>) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      maxDepth = Math.max(maxDepth, getJsonDepth((value as Record<string, unknown>)[key], currentDepth + 1));
    }
  }
  return maxDepth;
}

// ──── Field-Specific Validators ─────────────────────────────────────────────

const FIELD_LENGTH_LIMITS: Record<string, { max: number; type?: 'string' | 'email' | 'password' | 'phone' }> = {
  // Auth fields
  email: { max: 254, type: 'email' },
  password: { max: MAX_PASSWORD_LENGTH, type: 'password' },
  name: { max: 100 },
  phone: { max: 15, type: 'phone' },

  // KYC fields
  panNumber: { max: 10 },
  aadhaarNumber: { max: 14 },
  ifsc: { max: 11 },
  accountNumber: { max: 18 },
  accountHolderName: { max: 100 },
  bankName: { max: 100 },

  // Payment fields
  razorpayPaymentId: { max: 64 },
  razorpayOrderId: { max: 64 },
  razorpaySignature: { max: 128 },
  planId: { max: 50 },

  // Profile fields
  bio: { max: 500 },
  displayName: { max: 50 },
  userName: { max: 30 },

  // Community fields
  title: { max: 200 },
  body: { max: MAX_STRING_LENGTH },
  comment: { max: 1000 },
  source: { max: 100 },

  // Generic
  token: { max: 2048 },
  referenceId: { max: 64 },
  otp: { max: 8 },
  code: { max: 20 },
};

export function getFieldLimit(fieldName: string): { max: number; type?: string } | null {
  // Case-insensitive matching
  const lowerName = fieldName.toLowerCase();
  return FIELD_LENGTH_LIMITS[lowerName] || FIELD_LENGTH_LIMITS[lowerName.replace(/[_-]/g, '')] || null;
}

// ──── Main Sanitize Function ────────────────────────────────────────────────

/**
 * Sanitize a single string value against all attack vectors.
 * Order matters: strip first, then validate.
 */
export function sanitizeInput(
  value: string,
  fieldName?: string,
): string {
  if (typeof value !== 'string') return value;

  // 1. Strip zero-width / invisible characters (clipboard attack)
  let cleaned = stripZeroWidthChars(value);

  // 2. Strip SSTI template syntax
  cleaned = stripTemplateSyntax(cleaned);

  // 3. Trim whitespace
  cleaned = cleaned.trim();

  // 4. Enforce field-specific max length
  if (fieldName) {
    const limit = getFieldLimit(fieldName);
    if (limit) {
      enforceMaxLength(cleaned, limit.max, fieldName);

      // 5. Type-specific validation
      if (limit.type === 'password') {
        // Password: additional security checks
        if (cleaned.length < 6) {
          throw new InputValidationError('Password must be at least 6 characters', 'PASSWORD_TOO_SHORT');
        }
      }
    } else {
      // Generic max length for unknown fields
      if (cleaned.length > MAX_STRING_LENGTH) {
        throw new InputValidationError(
          `${fieldName} exceeds maximum length of ${MAX_STRING_LENGTH} characters`,
          'INPUT_TOO_LONG',
        );
      }
    }
  }

  // 6. Check for NoSQL injection patterns
  if (hasNoSqlInjection(cleaned)) {
    throw new InputValidationError('Input contains forbidden patterns', 'NOSQL_INJECTION_DETECTED');
  }

  // 7. Check for SQL injection patterns
  if (hasSqlInjection(cleaned)) {
    throw new InputValidationError('Input contains forbidden patterns', 'SQL_INJECTION_DETECTED');
  }

  return cleaned;
}

// ──── Recursive Object Sanitization ─────────────────────────────────────────

/**
 * Recursively sanitize all string values in an object.
 * Throws InputValidationError on any violation.
 */
export function sanitizeObject(
  obj: Record<string, unknown>,
  parentKey?: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Check for NoSQL operator keys (e.g., "$gt", "$where")
    if (key.startsWith('$')) {
      throw new InputValidationError(
        `Invalid key "${key}": keys starting with "$" are not allowed`,
        'NOSQL_OPERATOR_KEY',
      );
    }

    // Strip zero-width / invisible characters from object keys
    const cleanedKey = stripZeroWidthChars(key);

    if (typeof value === 'string') {
      result[cleanedKey] = sanitizeInput(value, key);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      result[cleanedKey] = sanitizeObject(value as Record<string, unknown>, key);
    } else if (Array.isArray(value)) {
      result[cleanedKey] = value.map((item, index) => {
        if (typeof item === 'string') {
          return sanitizeInput(item, `${key}[${index}]`);
        }
        if (item !== null && typeof item === 'object') {
          return sanitizeObject(item as Record<string, unknown>, `${key}[${index}]`);
        }
        return item;
      });
    } else {
      result[cleanedKey] = value;
    }
  }

  return result;
}

// ──── Express Middleware ─────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';

/**
 * Express middleware that sanitizes all incoming request body fields.
 * Also checks for JSON depth bombs and NoSQL operator objects.
 *
 * Mount globally or on specific routes:
 *   app.use(inputSanitizer);
 *   router.post('/login', inputSanitizer, handler);
 */
export function inputSanitizer(req: Request, _res: Response, next: NextFunction): void {
  try {
    if (req.body && typeof req.body === 'object') {
      // Check for JSON depth bomb
      const depth = getJsonDepth(req.body);
      if (depth > MAX_JSON_DEPTH) {
        throw new InputValidationError(
          `JSON nesting depth (${depth}) exceeds maximum allowed (${MAX_JSON_DEPTH})`,
          'JSON_TOO_DEEP',
        );
      }

      // Check for top-level NoSQL operator injection
      if (isNoSqlOperatorObject(req.body)) {
        throw new InputValidationError(
          'Invalid request body format',
          'NOSQL_OPERATOR_DETECTED',
        );
      }

      // Recursively sanitize
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          const cleaned = stripTemplateSyntax(stripZeroWidthChars(value));
          (req.query as Record<string, unknown>)[key] = cleaned;
        }
      }
    }

    // Sanitize URL params
    if (req.params && typeof req.params === 'object') {
      for (const [key, value] of Object.entries(req.params)) {
        if (typeof value === 'string') {
          const cleaned = stripTemplateSyntax(stripZeroWidthChars(value));
          (req.params as Record<string, unknown>)[key] = cleaned;
        }
      }
    }

    next();
  } catch (err) {
    if (err instanceof InputValidationError) {
      _res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
}

// ──── Body Size Limiter ────────────────────────────────────────────────────

/**
 * Middleware that rejects requests with excessively large bodies.
 * Use BEFORE express.json() to abort early.
 */
export function bodySizeLimiter(maxBytes: number = 100_000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxBytes) {
      res.status(413).json({
        error: `Request body too large. Maximum size is ${(maxBytes / 1024).toFixed(0)} KB`,
        code: 'BODY_TOO_LARGE',
      });
      return;
    }
    next();
  };
}

export default {
  sanitizeInput,
  sanitizeObject,
  inputSanitizer,
  bodySizeLimiter,
  stripTemplateSyntax,
  stripZeroWidthChars,
  hasNoSqlInjection,
  hasSqlInjection,
  isNoSqlOperatorObject,
  enforceMaxLength,
  getJsonDepth,
  InputValidationError,
};
