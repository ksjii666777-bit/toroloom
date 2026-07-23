/**
 * ============================================================================
 * Toroloom — Indicator Formula Engine
 * ============================================================================
 *
 * A lightweight DSL for writing custom technical indicators.
 * Users write formulas like:
 *   SMA(close, 14)
 *   RSI(close, 14)
 *   close > SMA(close, 20) ? close : null
 *   EMA(close, 9) - EMA(close, 26)
 *
 * The engine tokenizes → parses (AST) → evaluates against OHLC data arrays.
 * Each built-in function returns an array the same length as the input.
 * ============================================================================
 */

import type { StockHistoryPoint } from '../types';

// ============================================================================
// Tokenizer
// ============================================================================

export type TokenType =
  | 'IDENTIFIER'   // close, open, high, low, volume, SMA, RSI, etc.
  | 'NUMBER'       // 14, 20, 2.5
  | 'LPAREN'       // (
  | 'RPAREN'       // )
  | 'COMMA'        // ,
  | 'PLUS'         // +
  | 'MINUS'        // -
  | 'STAR'         // *
  | 'SLASH'        // /
  | 'GT'           // >
  | 'LT'           // <
  | 'GTE'          // >=
  | 'LTE'          // <=
  | 'EQ'           // ==
  | 'NEQ'          // !=
  | 'QUESTION'     // ?
  | 'COLON'        // :
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const peek = () => input[i] || '';
  const advance = () => input[i++];

  while (i < input.length) {
    const ch = peek();

    // Skip whitespace
    if (/\s/.test(ch)) {
      advance();
      continue;
    }

    const pos = i;

    // Two-char operators: >=, <=, ==, !=
    if ((ch === '>' && input[i + 1] === '=') ||
        (ch === '<' && input[i + 1] === '=') ||
        (ch === '=' && input[i + 1] === '=') ||
        (ch === '!' && input[i + 1] === '=')) {
      const pair = ch + input[i + 1];
      const map: Record<string, TokenType> = {
        '>=': 'GTE', '<=': 'LTE', '==': 'EQ', '!=': 'NEQ',
      };
      tokens.push({ type: map[pair], value: pair, pos });
      advance();
      advance();
      continue;
    }

    // Single-char operators
    switch (ch) {
      case '(': tokens.push({ type: 'LPAREN', value: '(', pos }); advance(); continue;
      case ')': tokens.push({ type: 'RPAREN', value: ')', pos }); advance(); continue;
      case ',': tokens.push({ type: 'COMMA', value: ',', pos }); advance(); continue;
      case '+': tokens.push({ type: 'PLUS', value: '+', pos }); advance(); continue;
      case '-': tokens.push({ type: 'MINUS', value: '-', pos }); advance(); continue;
      case '*': tokens.push({ type: 'STAR', value: '*', pos }); advance(); continue;
      case '/': tokens.push({ type: 'SLASH', value: '/', pos }); advance(); continue;
      case '>': tokens.push({ type: 'GT', value: '>', pos }); advance(); continue;
      case '<': tokens.push({ type: 'LT', value: '<', pos }); advance(); continue;
      case '?': tokens.push({ type: 'QUESTION', value: '?', pos }); advance(); continue;
      case ':': tokens.push({ type: 'COLON', value: ':', pos }); advance(); continue;
    }

    // Number literal — must start with a digit or a dot that follows a digit context
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(input[i + 1]))) {
      let num = '';
      let dotSeen = false;
      while (i < input.length && (/[0-9.]/.test(peek()))) {
        if (peek() === '.') {
          if (dotSeen) break; // second dot ends the number
          dotSeen = true;
        }
        num += advance();
      }
      tokens.push({ type: 'NUMBER', value: num, pos });
      continue;
    }

    // Identifier or function name
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < input.length && /[a-zA-Z0-9_]/.test(peek())) {
        id += advance();
      }
      tokens.push({ type: 'IDENTIFIER', value: id, pos });
      continue;
    }

    // Unknown character — skip
    advance();
  }

  tokens.push({ type: 'EOF', value: '', pos: i });
  return tokens;
}

// ============================================================================
// AST Nodes
// ============================================================================

export type ASTNode =
  | { type: 'number'; value: number }
  | { type: 'identifier'; name: string }
  | { type: 'function'; name: string; args: ASTNode[] }
  | { type: 'binary'; op: TokenType; left: ASTNode; right: ASTNode }
  | { type: 'ternary'; condition: ASTNode; trueExpr: ASTNode; falseExpr: ASTNode }
  | { type: 'unary'; op: TokenType; operand: ASTNode };

// ============================================================================
// Parser (Recursive Descent)
// ============================================================================

export class ParseError extends Error {
  constructor(message: string, public pos: number) {
    super(message);
    this.name = 'ParseError';
  }
}

export class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new ParseError(
        `Expected ${type} but got ${token.type} ('${token.value}') at position ${token.pos}`,
        token.pos,
      );
    }
    return this.consume();
  }

  parse(): ASTNode {
    const node = this.parseTernary();
    this.expect('EOF');
    return node;
  }

  // Ternary: condition ? trueExpr : falseExpr
  private parseTernary(): ASTNode {
    const condition = this.parseComparison();
    if (this.peek().type === 'QUESTION') {
      this.consume(); // ?
      const trueExpr = this.parseTernary();
      this.expect('COLON');
      const falseExpr = this.parseTernary();
      return { type: 'ternary', condition, trueExpr, falseExpr };
    }
    return condition;
  }

  // Comparison: addExpr (('>' | '<' | '>=' | '<=' | '==' | '!=') addExpr)*
  private parseComparison(): ASTNode {
    let left = this.parseAddSub();
    while (['GT', 'LT', 'GTE', 'LTE', 'EQ', 'NEQ'].includes(this.peek().type)) {
      const op = this.consume().type as TokenType;
      const right = this.parseAddSub();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  // Add/Subtract: mulDiv (('+' | '-') mulDiv)*
  private parseAddSub(): ASTNode {
    let left = this.parseMulDiv();
    while (this.peek().type === 'PLUS' || this.peek().type === 'MINUS') {
      const op = this.consume().type as TokenType;
      const right = this.parseMulDiv();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  // Multiply/Divide: unary (('*' | '/') unary)*
  private parseMulDiv(): ASTNode {
    let left = this.parseUnary();
    while (this.peek().type === 'STAR' || this.peek().type === 'SLASH') {
      const op = this.consume().type as TokenType;
      const right = this.parseUnary();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  // Unary: '-' primary | primary
  private parseUnary(): ASTNode {
    if (this.peek().type === 'MINUS') {
      const op = this.consume().type as TokenType;
      const operand = this.parseUnary();
      return { type: 'unary', op, operand };
    }
    return this.parsePrimary();
  }

  // Primary: NUMBER | IDENTIFIER | IDENTIFIER '(' argList ')' | '(' expr ')'
  private parsePrimary(): ASTNode {
    const token = this.peek();

    if (token.type === 'NUMBER') {
      this.consume();
      return { type: 'number', value: parseFloat(token.value) };
    }

    if (token.type === 'IDENTIFIER') {
      this.consume();
      // Function call?
      if (this.peek().type === 'LPAREN') {
        this.consume(); // (
        const args: ASTNode[] = [];
        if (this.peek().type !== 'RPAREN') {
          args.push(this.parseTernary());
          while (this.peek().type === 'COMMA') {
            this.consume();
            args.push(this.parseTernary());
          }
        }
        this.expect('RPAREN');
        return { type: 'function', name: token.value, args };
      }
      // Plain identifier (close, open, etc.)
      return { type: 'identifier', name: token.value };
    }

    if (token.type === 'LPAREN') {
      this.consume(); // (
      const expr = this.parseTernary();
      this.expect('RPAREN');
      return expr;
    }

    throw new ParseError(
      `Unexpected token '${token.value}' at position ${token.pos}`,
      token.pos,
    );
  }
}

// ============================================================================
// Evaluation
// ============================================================================

export interface EvalContext {
  /** Full OHLC data array */
  data: StockHistoryPoint[];
  /** Current index being evaluated */
  index: number;
  /** Close prices (pre-computed) */
  closes: number[];
  /** High prices (pre-computed) */
  highs: number[];
  /** Low prices (pre-computed) */
  lows: number[];
  /** Open prices (pre-computed) */
  opens: number[];
  /** Volume values (pre-computed) */
  volumes: number[];
}

// ============================================================================
// Built-in Technical Functions
// ============================================================================

type BuiltinFn = (ctx: EvalContext, args: ASTNode[]) => number;

const functionMap: Record<string, BuiltinFn> = {};

// ============================================================================
// Evaluator — Evaluate a single node
// ============================================================================

function evalNode(ctx: EvalContext, node: ASTNode): number {
  switch (node.type) {
    case 'number':
      return node.value;

    case 'identifier': {
      switch (node.name) {
        case 'close': return ctx.closes[ctx.index] ?? 0;
        case 'open': return ctx.opens[ctx.index] ?? 0;
        case 'high': return ctx.highs[ctx.index] ?? 0;
        case 'low': return ctx.lows[ctx.index] ?? 0;
        case 'volume': return ctx.volumes[ctx.index] ?? 0;
        default: return 0;
      }
    }

    case 'function': {
      const fn = functionMap[node.name.toUpperCase()];
      if (!fn) throw new Error(`Unknown function: ${node.name}`);
      return fn(ctx, node.args);
    }

    case 'binary': {
      const left = evalNode(ctx, node.left);
      const right = evalNode(ctx, node.right);
      switch (node.op) {
        case 'PLUS': return left + right;
        case 'MINUS': return left - right;
        case 'STAR': return left * right;
        case 'SLASH': return right !== 0 ? left / right : 0;
        case 'GT': return left > right ? 1 : 0;
        case 'LT': return left < right ? 1 : 0;
        case 'GTE': return left >= right ? 1 : 0;
        case 'LTE': return left <= right ? 1 : 0;
        case 'EQ': return left === right ? 1 : 0;
        case 'NEQ': return left !== right ? 1 : 0;
        default: return 0;
      }
    }

    case 'ternary': {
      const cond = evalNode(ctx, node.condition);
      return cond !== 0 ? evalNode(ctx, node.trueExpr) : evalNode(ctx, node.falseExpr);
    }

    case 'unary': {
      const operand = evalNode(ctx, node.operand);
      return node.op === 'MINUS' ? -operand : operand;
    }
  }
}

// ============================================================================
// Evaluate formula against full OHLC data — returns array of values
// ============================================================================

export interface FormulaResult {
  values: (number | null)[];
  errors?: string[];
}

/**
 * Evaluate a formula string against OHLC data.
 * Returns an array the same length as data, with null for indices
 * where the formula couldn't be computed.
 */
export function evaluateFormula(
  formula: string,
  data: StockHistoryPoint[],
): FormulaResult {
  const errors: string[] = [];

  try {
    // 1. Tokenize
    const tokens = tokenize(formula);

    // 2. Parse
    const parser = new Parser(tokens);
    const ast = parser.parse();

    // 3. Pre-compute OHLC arrays
    const closes = data.map(d => d.close);
    const opens = data.map(d => d.open);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);

    // 4. Evaluate at each index
    const values: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
      try {
        const ctx: EvalContext = {
          data,
          index: i,
          closes,
          highs,
          lows,
          opens,
          volumes,
        };
        const result = evalNode(ctx, ast);
        values.push(isFinite(result) ? result : null);
      } catch {
        values.push(null);
      }
    }

    return { values, errors: errors.length > 0 ? errors : undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      values: data.map(() => null),
      errors: [message],
    };
  }
}

// ============================================================================
// Validate formula syntax (no data needed)
// ============================================================================

export function validateFormula(formula: string): { valid: boolean; error?: string } {
  try {
    const tokens = tokenize(formula);
    const parser = new Parser(tokens);
    parser.parse();
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ============================================================================
// Built-in Computation Helpers
// ============================================================================

function resolveNumber(ctx: EvalContext, node: ASTNode): number {
  const val = evalNode(ctx, node);
  return Math.round(val);
}

// These functions work on full arrays and are accessed via the functionMap's
// implementations.

// ============================================================================
// Per-index Computation Helpers (for built-in functions)
// ============================================================================

/** Compute EMA for an array — needed by computeMACDAt */
function computeEMAArray(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += data[j];
      result.push(sum / period);
    } else {
      const prev = result[i - 1];
      if (prev !== null) {
        result.push((data[i] - prev) * multiplier + prev);
      } else {
        result.push(null);
      }
    }
  }
  return result;
}


function computeRSIAt(index: number, closes: number[], period: number): number | null {
  if (index < period) return null;
  let gains = 0, losses = 0;
  for (let j = index - period; j < index; j++) {
    const diff = closes[j + 1] - closes[j];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeMACDAt(
  index: number,
  closes: number[],
  fast: number,
  slow: number,
  signalPeriod: number,
): { macd: number | null; signal: number | null; histogram: number | null } {
  if (index < slow) return { macd: null, signal: null, histogram: null };

  const emaFast = computeEMAArray(closes.slice(0, index + 1), fast);
  const emaSlow = computeEMAArray(closes.slice(0, index + 1), slow);

  const macdVal = emaFast[index] !== null && emaSlow[index] !== null
    ? emaFast[index]! - emaSlow[index]!
    : null;

  if (macdVal === null) return { macd: null, signal: null, histogram: null };

  // Compute signal line (EMA of MACD values)
  const macdValues: number[] = [];
  for (let i = slow; i <= index; i++) {
    const f = emaFast[i];
    const s = emaSlow[i];
    if (f !== null && s !== null) macdValues.push(f - s);
  }
  if (macdValues.length < signalPeriod) {
    return { macd: macdVal, signal: null, histogram: null };
  }
  const signalArr = computeEMAArray(macdValues, signalPeriod);
  const signal = signalArr[signalArr.length - 1];
  if (signal === null) return { macd: macdVal, signal: null, histogram: null };

  return {
    macd: macdVal,
    signal,
    histogram: macdVal - signal,
  };
}

function computeBollingerAt(
  index: number,
  closes: number[],
  period: number,
  stdDev: number,
): { upper: number | null; middle: number | null; lower: number | null } {
  if (index < period - 1) return { upper: null, middle: null, lower: null };

  let sum = 0;
  for (let j = index - period + 1; j <= index; j++) sum += closes[j];
  const avg = sum / period;

  let squaredDiff = 0;
  for (let j = index - period + 1; j <= index; j++) squaredDiff += (closes[j] - avg) ** 2;
  const std = Math.sqrt(squaredDiff / period);

  return {
    middle: avg,
    upper: avg + stdDev * std,
    lower: avg - stdDev * std,
  };
}

function computeHighestAt(index: number, source: number[], period: number): number | null {
  if (index < period - 1 || source.length === 0) return null;
  const start = Math.max(0, index - period + 1);
  let max = -Infinity;
  for (let i = start; i <= index; i++) {
    if (source[i] > max) max = source[i];
  }
  return max;
}

function computeLowestAt(index: number, source: number[], period: number): number | null {
  if (index < period - 1 || source.length === 0) return null;
  const start = Math.max(0, index - period + 1);
  let min = Infinity;
  for (let i = start; i <= index; i++) {
    if (source[i] < min) min = source[i];
  }
  return min;
}

function computeStdevAt(index: number, source: number[], period: number): number | null {
  if (index < period - 1) return null;
  const start = index - period + 1;
  let sum = 0;
  for (let i = start; i <= index; i++) sum += source[i];
  const mean = sum / period;
  let sqDiff = 0;
  for (let i = start; i <= index; i++) sqDiff += (source[i] - mean) ** 2;
  return Math.sqrt(sqDiff / period);
}

// Replace stub function implementations with real ones

functionMap.CROSSOVER = (ctx, args) => {
  if (ctx.index < 1) return 0;
  const prevCtx = { ...ctx, index: ctx.index - 1 };
  const curr1 = evalNode(ctx, args[0]);
  const curr2 = evalNode(ctx, args[1]);
  const prev1 = evalNode(prevCtx, args[0]);
  const prev2 = evalNode(prevCtx, args[1]);
  return (prev1 <= prev2 && curr1 > curr2) ? 1 : 0;
};

functionMap.CROSSUNDER = (ctx, args) => {
  if (ctx.index < 1) return 0;
  const prevCtx = { ...ctx, index: ctx.index - 1 };
  const curr1 = evalNode(ctx, args[0]);
  const curr2 = evalNode(ctx, args[1]);
  const prev1 = evalNode(prevCtx, args[0]);
  const prev2 = evalNode(prevCtx, args[1]);
  return (prev1 >= prev2 && curr1 < curr2) ? 1 : 0;
};

functionMap.VWAP = (ctx, _args) => {
  let cumPV = 0;
  let cumVol = 0;
  for (let i = 0; i <= ctx.index; i++) {
    const typPrice = (ctx.highs[i] + ctx.lows[i] + ctx.closes[i]) / 3;
    cumPV += typPrice * ctx.volumes[i];
    cumVol += ctx.volumes[i];
  }
  return cumVol > 0 ? cumPV / cumVol : 0;
};

functionMap.SMA = (ctx: EvalContext, args: ASTNode[]) => {
  // First arg is the source expression (usually just 'close')
  // But we need to evaluate it per-index
  const period = resolveNumber(ctx, args[1]);
  const sourceArr: number[] = [];
  for (let i = 0; i <= ctx.index; i++) {
    const subCtx = { ...ctx, index: i };
    sourceArr.push(evalNode(subCtx, args[0]));
  }
  if (ctx.index < period - 1) return 0;
  let sum = 0;
  for (let i = ctx.index - period + 1; i <= ctx.index; i++) sum += sourceArr[i];
  return sum / period;
};

functionMap.EMA = (ctx: EvalContext, args: ASTNode[]) => {
  const period = resolveNumber(ctx, args[1]);
  const sourceArr: number[] = [];
  for (let i = 0; i <= ctx.index; i++) {
    const subCtx = { ...ctx, index: i };
    sourceArr.push(evalNode(subCtx, args[0]));
  }
  if (ctx.index < period - 1) return 0;
  if (ctx.index === period - 1) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += sourceArr[j];
    return sum / period;
  }
  const multiplier = 2 / (period + 1);
  // Compute EMA up to this index
  const emaValues: number[] = [];
  for (let i = 0; i <= ctx.index; i++) {
    if (i < period - 1) {
      emaValues.push(0);
      continue;
    }
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += sourceArr[j];
      emaValues.push(sum / period);
    } else {
      emaValues.push((sourceArr[i] - emaValues[i - 1]) * multiplier + emaValues[i - 1]);
    }
  }
  return emaValues[ctx.index];
};

functionMap.RSI = (ctx: EvalContext, args: ASTNode[]) => {
  const period = resolveNumber(ctx, args[1]);
  if (ctx.index < period) return 50; // Neutral
  let gains = 0, losses = 0;
  for (let j = ctx.index - period; j < ctx.index; j++) {
    const diff = ctx.closes[j + 1] - ctx.closes[j];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
};

// Re-assign remaining function implementations
functionMap.MACD = (ctx: EvalContext, _args: ASTNode[]) => {
  const fast = 12, slow = 26, signalPeriod = 9;
  const result = computeMACDAt(ctx.index, ctx.closes, fast, slow, signalPeriod);
  return result.macd ?? 0;
};

functionMap.MACD_SIGNAL = (ctx: EvalContext, _args: ASTNode[]) => {
  const fast = 12, slow = 26, signalPeriod = 9;
  const result = computeMACDAt(ctx.index, ctx.closes, fast, slow, signalPeriod);
  return result.signal ?? 0;
};

functionMap.MACD_HIST = (ctx: EvalContext, _args: ASTNode[]) => {
  const fast = 12, slow = 26, signalPeriod = 9;
  const result = computeMACDAt(ctx.index, ctx.closes, fast, slow, signalPeriod);
  return result.histogram ?? 0;
};

functionMap.BB_UPPER = (ctx: EvalContext, args: ASTNode[]) => {
  const period = resolveNumber(ctx, args[1]);
  const stdDev = args.length > 2 ? resolveNumber(ctx, args[2]) : 2;
  const result = computeBollingerAt(ctx.index, ctx.closes, period, stdDev);
  return result.upper ?? 0;
};

functionMap.BB_MIDDLE = (ctx: EvalContext, args: ASTNode[]) => {
  const period = resolveNumber(ctx, args[1]);
  const result = computeBollingerAt(ctx.index, ctx.closes, period, 2);
  return result.middle ?? 0;
};

functionMap.BB_LOWER = (ctx: EvalContext, args: ASTNode[]) => {
  const period = resolveNumber(ctx, args[1]);
  const stdDev = args.length > 2 ? resolveNumber(ctx, args[2]) : 2;
  const result = computeBollingerAt(ctx.index, ctx.closes, period, stdDev);
  return result.lower ?? 0;
};

functionMap.HIGHEST = (ctx: EvalContext, args: ASTNode[]) => {
  const sourceArr: number[] = [];
  for (let i = 0; i <= ctx.index; i++) {
    const subCtx = { ...ctx, index: i };
    sourceArr.push(evalNode(subCtx, args[0]));
  }
  const period = resolveNumber(ctx, args[1]);
  const result = computeHighestAt(ctx.index, sourceArr, period);
  return result ?? 0;
};

functionMap.LOWEST = (ctx: EvalContext, args: ASTNode[]) => {
  const sourceArr: number[] = [];
  for (let i = 0; i <= ctx.index; i++) {
    const subCtx = { ...ctx, index: i };
    sourceArr.push(evalNode(subCtx, args[0]));
  }
  const period = resolveNumber(ctx, args[1]);
  const result = computeLowestAt(ctx.index, sourceArr, period);
  return result ?? 0;
};

functionMap.STDEV = (ctx: EvalContext, args: ASTNode[]) => {
  const sourceArr: number[] = [];
  for (let i = 0; i <= ctx.index; i++) {
    const subCtx = { ...ctx, index: i };
    sourceArr.push(evalNode(subCtx, args[0]));
  }
  const period = resolveNumber(ctx, args[1]);
  const result = computeStdevAt(ctx.index, sourceArr, period);
  return result ?? 0;
};

// ============================================================================
// Convenience: evaluate multiple formulas (one per line)
// ============================================================================

export interface MultiLineResult {
  values: (number | null)[];
  formula: string;
  label: string;
  color?: string;
  errors?: string[];
}

export function evaluateFormulas(
  formulas: { formula: string; label?: string; color?: string }[],
  data: StockHistoryPoint[],
): MultiLineResult[] {
  return formulas.map(f => ({
    ...evaluateFormula(f.formula, data),
    formula: f.formula,
    label: f.label || f.formula,
    color: f.color,
  }));
}
