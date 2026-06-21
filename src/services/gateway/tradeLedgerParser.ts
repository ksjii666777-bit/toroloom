/**
 * ============================================================================
 * Toroloom — Automated Trade Ledger Parser Engine
 * ============================================================================
 *
 * Consumes raw text streams from broker-generated PDF Contract Notes or P&L
 * ledger files and extracts structured trade records using bulletproof
 * regular expression patterns matched against known Indian broker formats.
 *
 * Supported broker formats:
 *   - Zerodha Kite
 *   - Angel One
 *   - Groww
 *   - ICICI Direct
 *   - HDFC Securities
 *   - Generic Indian broker (fallback)
 *
 * Usage:
 *   import { parseContractNote, parseLedgerText } from
 *     '../../services/gateway/tradeLedgerParser';
 *
 *   const trades = parseContractNote(rawText, 'zerodha');
 *   const allTrades = parseLedgerText(rawPdfText);
 *
 * ============================================================================
 */

import type { ParsedTrade } from '../../types';

// ─── Regex Pattern Library ─────────────────────────────────────────────────
//
// Execution Timestamps:  (\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2})
// Action Target:         (BUY|SELL|B|S)
// Asset Symbol:          ([A-Z0-9]{12}|[A-Z\-]{3,10})
// Quantity:              \b\d+\b
// Strike/Price:          \b\d+\.\d{2}\b
// Regulatory Fees:       \b\d+\.\d{2}\b
//
// ============================================================================

// ─── Core patterns (broker-agnostic) ────────────────────────
const PATTERNS = {
  /** Standard exchange timestamp: DD-MM-YYYY HH:MM:SS */
  timestamp: /(\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2})/g,

  /** Buy/Sell action (case-insensitive) */
  action: /\b(BUY|SELL|B|S)\b/gi,

  /** ISIN (12-char alphanumeric) or trading symbol (3-10 uppercase/dash) */
  symbol: /\b([A-Z0-9]{12}|[A-Z][A-Z-]{2,9})\b/g,

  /** Decimal price values: numbers with exactly 2 decimal places */
  price: /\b(\d+\.\d{2})\b/g,

  /** Quantity: integer values preceded by volume/quantity context */
  quantity: /(?:Qty|Quantity|Vol|Volume|Shares?)\s*:?\s*(\d+)/gi,
} as const;

// ─── Broker-specific format matchers ────────────────────────

interface BrokerFormat {
  name: string;
  /** Identify if this raw text matches this broker's format */
  detect: (text: string) => boolean;
  /** Extract trade rows from this broker's specific table layout */
  extractRows: (text: string) => string[];
  /** Parse a single row into a ParsedTrade */
  parseRow: (row: string, lineIndex: number) => ParsedTrade | null;
}

const BROKER_FORMATS: BrokerFormat[] = [
  // ── Zerodha Kite ─────────────────────────────────────────
  {
    name: 'zerodha',
    detect: (text: string) =>
      /ZERODHA BROKING LTD|Kite Connect|NSE\s*\|.*BSE\s*\|/i.test(text),

    extractRows: (text: string) => {
      // Zerodha contract notes have tabular rows between header and summary
      const lines = text.split('\n');
      const tableLines: string[] = [];
      let inTable = false;

      for (const line of lines) {
        if (/Scrip Name|Symbol|Instrument/i.test(line) && /Buy|Sell|Qty/i.test(line)) {
          inTable = true;
          continue;
        }
        if (inTable) {
          if (/Total|Grand Total|Tax/i.test(line) && /\d+\.\d{2}/.test(line)) {
            break;
          }
          if (/\d{2}-\d{2}-\d{4}/.test(line) && /BUY|SELL/i.test(line)) {
            tableLines.push(line.trim());
          }
        }
      }
      return tableLines;
    },

    parseRow: (row: string, _lineIndex: number): ParsedTrade | null => {
      const timestampMatch = row.match(/(\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2})/);
      const actionMatch = row.match(/\b(BUY|SELL)\b/i);
      const prices = row.match(/\b(\d+\.\d{2})\b/g);
      const qtyMatch = row.match(/\b(BUY|SELL)\s+(\d+)\b/i);

      if (!timestampMatch || !actionMatch || !prices || prices.length < 2 || !qtyMatch) {
        return null;
      }

      return {
        execution_timestamp: normalizeTimestamp(timestampMatch[1]),
        asset_symbol: extractSymbol(row) || 'UNKNOWN',
        transaction_type: normalizeAction(actionMatch[1]),
        filled_quantity: parseInt(qtyMatch[2], 10),
        execution_price: parseFloat(prices[0]),
        regulatory_fees: parseFloat(prices[prices.length - 1]) || 0,
        exchange: detectExchange(row),
      };
    },
  },

  // ── Angel One ────────────────────────────────────────────
  {
    name: 'angel',
    detect: (text: string) =>
      /Angel Broking|Angel One|ANGEL/i.test(text) && /SmartAPI/i.test(text),

    extractRows: (text: string) => {
      const lines = text.split('\n');
      const rows: string[] = [];
      let capture = false;

      for (const line of lines) {
        if (/Trade Date|Scrip|Symbol/i.test(line) && /BUY|SELL/i.test(line)) {
          capture = true;
          continue;
        }
        if (capture) {
          if (/Total|Brokerage|STT|Grand/i.test(line) && /\d+\.\d{2}/.test(line)) {
            break;
          }
          if (/\d{2}-\d{2}-\d{4}/.test(line) && /[A-Z]/.test(line)) {
            rows.push(line.trim());
          }
        }
      }
      return rows;
    },

    parseRow: (row: string, _lineIndex: number): ParsedTrade | null => {
      const timestampMatch = row.match(/(\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2})/);
      const actionMatch = row.match(/\b(BUY|SELL|B|S)\b/i);
      const prices = row.match(/\b(\d+\.\d{2})\b/g);

      // Angel format: quantity usually appears after the symbol
      const qtyMatch = row.match(/(\d+)\s*@\s*(\d+\.\d{2})/);

      if (!timestampMatch || !actionMatch || !prices || prices.length < 1) {
        return null;
      }

      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : parseInt(prices[0] || '0', 10);

      return {
        execution_timestamp: normalizeTimestamp(timestampMatch[1]),
        asset_symbol: extractSymbol(row) || 'UNKNOWN',
        transaction_type: normalizeAction(actionMatch[1]),
        filled_quantity: qty,
        execution_price: qtyMatch ? parseFloat(qtyMatch[2]) : parseFloat(prices[1] || prices[0]),
        regulatory_fees: prices.length > 2 ? parseFloat(prices[prices.length - 1]) : 0,
        exchange: detectExchange(row),
      };
    },
  },

  // ── Groww ────────────────────────────────────────────────
  {
    name: 'groww',
    detect: (text: string) =>
      /Groww|NextBillion/i.test(text) && /Contract Note|Trade Confirmation/i.test(text),

    extractRows: (text: string) => {
      const lines = text.split('\n');
      const rows: string[] = [];
      let capture = false;

      for (const line of lines) {
        if (/Trade Details|Executed|Scrip Name/i.test(line)) {
          capture = true;
          continue;
        }
        if (capture) {
          if (/Total Charges|Net Amount|GST/i.test(line)) {
            break;
          }
          if (/BUY|SELL|B|S/i.test(line) && /\d+\.\d{2}/.test(line)) {
            rows.push(line.trim());
          }
        }
      }
      return rows;
    },

    parseRow: (row: string, _lineIndex: number): ParsedTrade | null => {
      const timestampMatch = row.match(/(\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2})/);
      const actionMatch = row.match(/\b(BUY|SELL|B|S)\b/i);
      const prices = row.match(/\b(\d+\.\d{2})\b/g);
      const qtyMatch = row.match(/\b(BUY|SELL|B|S)\s+(?:[A-Z]+\s+)?(\d+)\b/i);

      if (!timestampMatch || !actionMatch || !prices || prices.length < 1) {
        return null;
      }

      return {
        execution_timestamp: normalizeTimestamp(timestampMatch[1]),
        asset_symbol: extractSymbol(row) || 'UNKNOWN',
        transaction_type: normalizeAction(actionMatch[1]),
        filled_quantity: qtyMatch ? parseInt(qtyMatch[2], 10) : 0,
        execution_price: parseFloat(prices[0]),
        regulatory_fees: prices.length > 1 ? parseFloat(prices[prices.length - 1]) : 0,
        exchange: detectExchange(row),
      };
    },
  },

  // ── ICICI Direct ─────────────────────────────────────────
  {
    name: 'icici_direct',
    detect: (text: string) =>
      /ICICI Direct|ICICI Securities|ICICIdirect|ICICI SEC/i.test(text),

    extractRows: (text: string) => {
      const lines = text.split('\n');
      const rows: string[] = [];
      let capture = false;

      for (const line of lines) {
        // ICICI Direct uses "B(S)" column header and "Contract Description"
        if (/Contract Description|Scrip Name|Trade No/i.test(line) && /\(S\)|B\/S|B\(S\)/i.test(line)) {
          capture = true;
          continue;
        }
        if (capture) {
          if (/Total|Net Pay|Brokerage|STT|GST|Stamp/i.test(line) && /\d+\.\d{2}/.test(line)) {
            break;
          }
          if (/\d{2}-\d{2}-\d{4}/.test(line) && /\b[BS]\b/.test(line)) {
            rows.push(line.trim());
          }
        }
      }
      return rows;
    },

    parseRow: (row: string, _lineIndex: number): ParsedTrade | null => {
      const timestampMatch = row.match(/(\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2})/);
      const actionMatch = row.match(/\b([BS])\b/);
      const prices = row.match(/\b(\d+\.\d{2})\b/g);

      if (!timestampMatch || !actionMatch || !prices || prices.length < 1) {
        return null;
      }

      // ICICI Direct: quantity typically appears as a standalone integer after the action
      // e.g., "B 50" or "S 20".  Price is the first decimal value, reg fees the last.
      const qtyMatch = row.match(/\b[BS]\s+(\d+)\b/);

      return {
        execution_timestamp: normalizeTimestamp(timestampMatch[1]),
        asset_symbol: extractSymbol(row) || 'UNKNOWN',
        transaction_type: normalizeAction(actionMatch[1]),
        filled_quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : 0,
        execution_price: parseFloat(prices[0]),
        regulatory_fees: prices.length > 1 ? parseFloat(prices[prices.length - 1]) : 0,
        exchange: detectExchange(row),
      };
    },
  },

  // ── HDFC Securities ─────────────────────────────────────
  {
    name: 'hdfc_securities',
    detect: (text: string) =>
      /HDFC Securities|HDFC Sec|HDFCSec|hdfcsec/i.test(text),

    extractRows: (text: string) => {
      const lines = text.split('\n');
      const rows: string[] = [];
      let capture = false;

      for (const line of lines) {
        // HDFC uses "Exch/Seg" and "Security" as distinctive column headers
        if (/Security|Scrip|Symbol/i.test(line) && /Exch\/Seg|B\/S|Qty/i.test(line)) {
          capture = true;
          continue;
        }
        if (capture) {
          if (/Total|Grand|Brokerage|STT|GST|Stamp/i.test(line) && /\d+\.\d{2}/.test(line)) {
            break;
          }
          if (/\d{2}-\d{2}-\d{4}/.test(line) && /\b[BS]\b/.test(line)) {
            rows.push(line.trim());
          }
        }
      }
      return rows;
    },

    parseRow: (row: string, _lineIndex: number): ParsedTrade | null => {
      const timestampMatch = row.match(/(\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2})/);
      const actionMatch = row.match(/\b([BS])\b/);
      const prices = row.match(/\b(\d+\.\d{2})\b/g);
      const qtyMatch = row.match(/\b[BS]\s+(\d+)\b/);

      if (!timestampMatch || !actionMatch || !prices || prices.length < 1) {
        return null;
      }

      return {
        execution_timestamp: normalizeTimestamp(timestampMatch[1]),
        asset_symbol: extractSymbol(row) || 'UNKNOWN',
        transaction_type: normalizeAction(actionMatch[1]),
        filled_quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : 0,
        execution_price: parseFloat(prices[0]),
        regulatory_fees: prices.length > 1 ? parseFloat(prices[prices.length - 1]) : 0,
        exchange: detectExchange(row),
      };
    },
  },

  // ── Kotak Securities ─────────────────────────────────────
  {
    name: 'kotak_securities',
    detect: (text: string) =>
      /Kotak(?:\s+Mahindra)?\s+Securities|KOTAK SEC|kotaksecurities/i.test(text),

    extractRows: (text: string) => {
      const lines = text.split('\n');
      const rows: string[] = [];
      let capture = false;

      for (const line of lines) {
        // Kotak uses "Scrip Name" and "B/S" column headers
        if (/Scrip Name|Trade Date|Instrument/i.test(line) && /B\/S|B S/i.test(line)) {
          capture = true;
          continue;
        }
        if (capture) {
          if (/Total|Net|Brokerage|GST|STT|Grand/i.test(line) && /\d+\.\d{2}/.test(line)) {
            break;
          }
          if (/\d{2}-\d{2}-\d{4}/.test(line) && /\b[BS]\b/.test(line)) {
            rows.push(line.trim());
          }
        }
      }
      return rows;
    },

    parseRow: (row: string, _lineIndex: number): ParsedTrade | null => {
      const timestampMatch = row.match(/(\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2})/);
      const actionMatch = row.match(/\b([BS])\b/);
      const prices = row.match(/\b(\d+\.\d{2})\b/g);
      const qtyMatch = row.match(/\b[BS]\s+(\d+)\b/);

      if (!timestampMatch || !actionMatch || !prices || prices.length < 1) {
        return null;
      }

      return {
        execution_timestamp: normalizeTimestamp(timestampMatch[1]),
        asset_symbol: extractSymbol(row) || 'UNKNOWN',
        transaction_type: normalizeAction(actionMatch[1]),
        filled_quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : 0,
        execution_price: parseFloat(prices[0]),
        regulatory_fees: prices.length > 1 ? parseFloat(prices[prices.length - 1]) : 0,
        exchange: detectExchange(row),
      };
    },
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Normalize timestamps from DD-MM-YYYY to ISO-like YYYY-MM-DD format.
 */
function normalizeTimestamp(raw: string): string {
  const parts = raw.match(
    /(\d{2})-(\d{2})-(\d{4})\s+(\d{2}:\d{2}:\d{2})/,
  );
  if (!parts) return raw;
  return `${parts[3]}-${parts[2]}-${parts[1]}T${parts[4]}`;
}

/**
 * Normalize action strings to BUY / SELL.
 */
function normalizeAction(raw: string): 'BUY' | 'SELL' {
  const upper = raw.toUpperCase();
  if (upper === 'B') return 'BUY';
  if (upper === 'S') return 'SELL';
  return upper as 'BUY' | 'SELL';
}

/**
 * Extract the most likely stock/asset symbol from a trade row.
 */
function extractSymbol(row: string): string | null {
  // Direct ISIN match
  const isinMatch = row.match(/\b([A-Z]{2}[0-9A-Z]{10})\b/);
  if (isinMatch) return isinMatch[1];

  // Broker symbol patterns (NSE/BSE prefixes)
  const symbolMatch = row.match(/NSE:\s*([A-Z][A-Z0-9-]{1,9})\b/i);
  if (symbolMatch) return symbolMatch[1].toUpperCase();

  const bseMatch = row.match(/BSE:\s*([A-Z][A-Z0-9-]{1,9})\b/i);
  if (bseMatch) return bseMatch[1].toUpperCase();

  // Standalone uppercase symbol 3-10 chars (after skipping known keywords)
  const words = row.split(/[\s,]+/);
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/[^A-Za-z0-9-]/g, '');
    if (/^[A-Z][A-Z0-9-]{2,9}$/.test(w) && !isKeyword(w)) {
      return w;
    }
  }

  return null;
}

const KEYWORDS = new Set([
  'BUY', 'SELL', 'B', 'S', 'NSE', 'BSE', 'NSEx', 'B SEx', 'TOTAL',
  'GRAND', 'QUANTITY', 'QTY', 'RATE', 'PRICE', 'VALUE', 'BROKERAGE',
  'STT', 'CHARGES', 'NET', 'AMOUNT', 'Traded',
]);

function isKeyword(word: string): boolean {
  return KEYWORDS.has(word.toUpperCase());
}

/**
 * Detect exchange from row context.
 */
function detectExchange(row: string): string {
  if (/\bNSE\b/i.test(row)) return 'NSE';
  if (/\bBSE\b/i.test(row)) return 'BSE';
  if (/\bNFO\b/i.test(row)) return 'NFO';
  if (/\bCDS\b/i.test(row)) return 'CDS';
  if (/\bMCX\b/i.test(row)) return 'MCX';
  return 'NSE';
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Parse a complete broker contract note or P&L text stream and return
 * a normalized array of ParsedTrade objects.
 *
 * @param rawText - Raw text extracted from a PDF contract note
 * @param brokerFormat - Optional explicit broker format.
 *                       If omitted, auto-detection is attempted.
 */
export function parseContractNote(
  rawText: string,
  brokerFormat?: string,
): ParsedTrade[] {
  if (!rawText || rawText.trim().length === 0) {
    return [];
  }

  // Find the matching broker format
  const brokers =
    brokerFormat &&
    BROKER_FORMATS.filter(
      (b) => b.name.toLowerCase() === brokerFormat.toLowerCase(),
    );

  const matchedFormats =
    (brokers?.length ? brokers : BROKER_FORMATS.filter((b) => b.detect(rawText))) ||
    [];

  if (matchedFormats.length === 0) {
    // Fallback: use generic pattern matching
    return parseGeneric(rawText);
  }

  // Use the first matching format
  const format = matchedFormats[0];
  const rows = format.extractRows(rawText);
  const trades: ParsedTrade[] = [];

  for (let i = 0; i < rows.length; i++) {
    const trade = format.parseRow(rows[i], i);
    if (trade) {
      trades.push(trade);
    }
  }

  return trades;
}

/**
 * Generic fallback parser when no broker format is detected.
 * Uses broad regex patterns to find trade-like structures in text.
 */
function parseGeneric(text: string): ParsedTrade[] {
  const trades: ParsedTrade[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const timestampMatch = line.match(/(\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2})/);
    const actionMatch = line.match(/\b(BUY|SELL|B|S)\b/i);
    const prices = line.match(/\b(\d+\.\d{2})\b/g);
    const qtyMatch = line.match(/\b(BUY|SELL|B|S)\s+(\S+)\s+(\d+)\b/i);

    if (!timestampMatch || !actionMatch || !prices || !qtyMatch) continue;

    trades.push({
      execution_timestamp: normalizeTimestamp(timestampMatch[1]),
      asset_symbol: extractSymbol(line) || 'UNKNOWN',
      transaction_type: normalizeAction(actionMatch[1]),
      filled_quantity: parseInt(qtyMatch[3], 10),
      execution_price: parseFloat(prices[0]),
      regulatory_fees: prices.length > 1 ? parseFloat(prices[prices.length - 1]) : 0,
      exchange: 'NSE',
    });
  }

  return trades;
}

/**
 * Parse multiple contract notes / ledger text streams and merge into
 * a single deduplicated array (by timestamp + symbol + type).
 */
export function parseLedgerText(texts: string[]): ParsedTrade[] {
  const seen = new Set<string>();
  const allTrades: ParsedTrade[] = [];

  for (const text of texts) {
    const trades = parseContractNote(text);
    for (const trade of trades) {
      const key = `${trade.execution_timestamp}|${trade.asset_symbol}|${trade.transaction_type}|${trade.filled_quantity}`;
      if (!seen.has(key)) {
        seen.add(key);
        allTrades.push(trade);
      }
    }
  }

  // Sort by timestamp (newest first)
  return allTrades.sort(
    (a, b) =>
      new Date(b.execution_timestamp).getTime() -
      new Date(a.execution_timestamp).getTime(),
  );
}

/**
 * Validate a ParsedTrade object for required fields and sane values.
 */
export function validateTrade(trade: ParsedTrade): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!trade.execution_timestamp || isNaN(new Date(trade.execution_timestamp).getTime())) {
    errors.push('Invalid or missing execution_timestamp');
  }
  if (!trade.asset_symbol || trade.asset_symbol === 'UNKNOWN') {
    errors.push('Invalid or missing asset_symbol');
  }
  if (!['BUY', 'SELL'].includes(trade.transaction_type)) {
    errors.push('transaction_type must be BUY or SELL');
  }
  if (trade.filled_quantity <= 0) {
    errors.push('filled_quantity must be positive');
  }
  if (trade.execution_price <= 0) {
    errors.push('execution_price must be positive');
  }
  if (trade.regulatory_fees < 0) {
    errors.push('regulatory_fees cannot be negative');
  }

  return { valid: errors.length === 0, errors };
}
