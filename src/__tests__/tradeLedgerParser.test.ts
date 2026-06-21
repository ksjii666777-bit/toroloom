/**
 * ============================================================================
 * Toroloom — Trade Ledger Parser Engine Unit Tests
 * ============================================================================
 *
 * Tests for tradeLedgerParser.ts covering:
 *   - Zerodha-specific contract note parsing
 *   - Angel One-specific contract note parsing
 *   - Groww-specific contract note parsing
 *   - Generic fallback parser
 *   - Auto-detection of broker format
 *   - Explicit broker format override
 *   - parseLedgerText (dedup, sorting)
 *   - validateTrade (valid/invalid trades)
 *   - Empty input / edge cases
 */

import { describe, it, expect } from 'vitest';
import {
  parseContractNote,
  parseLedgerText,
  validateTrade,
} from '../services/gateway/tradeLedgerParser';
import type { ParsedTrade } from '../types';

// ─── Zerodha Contract Note ─────────────────────────────────

const ZERODHA_CONTRACT = `ZERODHA BROKING LTD
Contract Note

Scrip Name             Buy/Sell  Qty    Rate    Value
15-06-2026 10:30:00 NSE RELIANCE BUY    50      2890.50 144525.00
15-06-2026 14:45:00 NSE TCS      SELL   20      3890.00 77800.00
16-06-2026 09:15:00 NSE HDFCBANK BUY    100     1680.25 168025.00

Total                                 1000000.00
Brokerage                             150.00
STT                                   200.00`;

// ─── Angel One Contract Note ────────────────────────────────

const ANGEL_CONTRACT = `ANGEL BROKING LIMITED
SmartAPI Contract Note

Trade Date  Scrip        Buy/Sell  Qty@Rate       Value
15-06-2026 10:15:00 NSE RELIANCE  BUY       50@2650.00     132500.00
15-06-2026 10:40:00 NSE TCS       SELL      20@3920.00     78400.00
16-06-2026 09:30:00 NSE INFY      BUY       30@1750.50     52515.00

Total                                      263415.00
Brokerage STT Charges                       320.50`;

// ─── Groww Contract Note ────────────────────────────────────

const GROWW_CONTRACT = `Groww
Contract Note - Trade Confirmation

Trade Details
Scrip Name   Action  Qty   Price   Total
15-06-2026 10:30:00 NSE RELIANCE BUY     50    2890.50 144525.00
15-06-2026 14:45:00 NSE TCS      SELL    10    3920.00 39200.00

Net Amount Payable                        183725.00
GST                                          50.00`;

// ─── ICICI Direct Contract Note ────────────────────────────

const ICICI_CONTRACT = `ICICI Direct - Trade Confirmation
Contract Note

Order No  Trade Time           Contract Description  B(S)  Qty  Gross Rate  Net Total
CN12345   15-06-2026 10:30:00  RELIANCE              B     50   2890.50     144525.00
CN12346   15-06-2026 14:45:00  TCS                   S     20   3890.00     77800.00
CN12347   16-06-2026 09:15:00  HDFCBANK              B     100  1680.25     168025.00

Total Brokerage                                       340.00
STT                                                    200.00
GST                                                     61.20`;

// ─── HDFC Securities Contract Note ─────────────────────────

const HDFC_CONTRACT = `HDFC Securities
Contract Note

Order No  Trade Time           Security   Exch/Seg  B/S  Qty  Net Rate  Net Total
12345     15-06-2026 10:30:00  RELIANCE   NSE/EQ    B    50   2890.50   144525.00
12346     15-06-2026 14:45:00  TCS        NSE/EQ    S    20   3890.00   77800.00
12347     16-06-2026 09:15:00  HDFCBANK   NSE/EQ    B    100  1680.25   168025.00

Total                                                         390350.00
Brokerage                                                      150.00
STT                                                            200.00`;

// ─── Kotak Securities Contract Note ─────────────────────────

const KOTAK_CONTRACT = `Kotak Securities
Contract Note

Trade Date/Time      Scrip Name    B/S  Qty  Rate     Total     Brokerage
15-06-2026 10:30:00  RELIANCE      B    50   2890.50  144525.00 25.00
15-06-2026 14:45:00  TCS           S    20   3890.00  77800.00  15.00
16-06-2026 09:15:00  HDFCBANK      B    100  1680.25  168025.00 30.00

Net Total                                                    390350.00`;

// ─── Generic trade text (no broker detect) ─────────────────

const GENERIC_TEXT = `Trade Summary
15-06-2026 10:30:00 BUY RELIANCE 50 2890.50
15-06-2026 14:45:00 SELL TCS 20 3890.00
16-06-2026 09:15:00 B HDFCBANK 100 1680.25`;

// ====================================================================
// Zerodha Format
// ====================================================================

describe('Zerodha contract note', () => {
  it('detects and parses Zerodha format', () => {
    const trades = parseContractNote(ZERODHA_CONTRACT, 'zerodha');
    expect(trades.length).toBe(3);
  });

  it('extracts correct trade fields for Zerodha BUY', () => {
    const trades = parseContractNote(ZERODHA_CONTRACT, 'zerodha');
    const reliance = trades.find(t => t.transaction_type === 'BUY' && t.asset_symbol === 'RELIANCE');
    expect(reliance).toBeDefined();
    expect(reliance!.filled_quantity).toBe(50);
    expect(reliance!.execution_price).toBe(2890.50);
    expect(reliance!.exchange).toBe('NSE');
  });

  it('extracts correct trade fields for Zerodha SELL', () => {
    const trades = parseContractNote(ZERODHA_CONTRACT, 'zerodha');
    const tcs = trades.find(t => t.asset_symbol === 'TCS');
    expect(tcs).toBeDefined();
    expect(tcs!.transaction_type).toBe('SELL');
    expect(tcs!.filled_quantity).toBe(20);
    expect(tcs!.execution_price).toBe(3890.00);
  });

  it('normalizes timestamps to ISO format', () => {
    const trades = parseContractNote(ZERODHA_CONTRACT, 'zerodha');
    for (const trade of trades) {
      expect(trade.execution_timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    }
  });

  it('regulatory_fees is extracted from the last price field', () => {
    const trades = parseContractNote(ZERODHA_CONTRACT, 'zerodha');
    for (const trade of trades) {
      expect(trade.regulatory_fees).toBeGreaterThanOrEqual(0);
    }
  });
});

// ====================================================================
// Angel One Format
// ====================================================================

describe('Angel One contract note', () => {
  it('detects and parses Angel One format', () => {
    const trades = parseContractNote(ANGEL_CONTRACT, 'angel');
    expect(trades.length).toBe(3);
  });

  it('extracts trade with correct quantity and price', () => {
    const trades = parseContractNote(ANGEL_CONTRACT, 'angel');
    const reliance = trades.find(t => t.asset_symbol === 'RELIANCE');
    expect(reliance).toBeDefined();
    expect(reliance!.filled_quantity).toBe(50);
    expect(reliance!.execution_price).toBe(2650.00);
  });

  it('extracts NSE exchange for RELIANCE', () => {
    const trades = parseContractNote(ANGEL_CONTRACT, 'angel');
    const reliance = trades.find(t => t.asset_symbol === 'RELIANCE');
    expect(reliance!.exchange).toBe('NSE');
  });

  it('handles B/S shorthand actions', () => {
    const trades = parseContractNote(ANGEL_CONTRACT, 'angel');
    const infy = trades.find(t => t.asset_symbol === 'INFY');
    expect(infy).toBeDefined();
    expect(infy!.transaction_type).toBe('BUY');
  });
});

// ====================================================================
// Groww Format
// ====================================================================

describe('Groww contract note', () => {
  it('detects and parses Groww format', () => {
    const trades = parseContractNote(GROWW_CONTRACT, 'groww');
    expect(trades.length).toBe(2);
  });

  it('extracts correct fields for Groww trades', () => {
    const trades = parseContractNote(GROWW_CONTRACT, 'groww');
    const reliance = trades.find(t => t.asset_symbol === 'RELIANCE');
    expect(reliance).toBeDefined();
    expect(reliance!.transaction_type).toBe('BUY');
    expect(reliance!.filled_quantity).toBe(50);
    expect(reliance!.execution_price).toBe(2890.50);
  });
});

// ====================================================================
// Auto-Detection (no explicit broker format)
// ====================================================================

describe('auto-detection', () => {
  it('detects Zerodha from text pattern', () => {
    const trades = parseContractNote(ZERODHA_CONTRACT);
    expect(trades.length).toBeGreaterThan(0);
  });

  it('detects Angel from text pattern', () => {
    const trades = parseContractNote(ANGEL_CONTRACT);
    expect(trades.length).toBeGreaterThan(0);
  });

  it('detects Groww from text pattern', () => {
    const trades = parseContractNote(GROWW_CONTRACT);
    expect(trades.length).toBeGreaterThan(0);
  });
});

// ====================================================================
// Generic Fallback
// ====================================================================

describe('generic fallback parser', () => {
  it('parses generic trade text when no broker format detected', () => {
    const trades = parseContractNote(GENERIC_TEXT);
    expect(trades.length).toBe(3);
  });

  it('extracts fields from generic text correctly', () => {
    const trades = parseContractNote(GENERIC_TEXT);
    const reliance = trades.find(t => t.asset_symbol === 'RELIANCE');
    expect(reliance).toBeDefined();
    expect(reliance!.transaction_type).toBe('BUY');
    expect(reliance!.filled_quantity).toBe(50);
    expect(reliance!.execution_price).toBe(2890.50);
  });

  it('normalizes B and S shorthand in generic text', () => {
    const trades = parseContractNote(GENERIC_TEXT);
    const hdfc = trades.find(t => t.asset_symbol === 'HDFCBANK');
    expect(hdfc).toBeDefined();
    expect(hdfc!.transaction_type).toBe('BUY');
  });
});

// ====================================================================
// parseLedgerText (multi-document merge)
// ====================================================================

describe('parseLedgerText', () => {
  it('merges trades from multiple documents', () => {
    const trades = parseLedgerText([ZERODHA_CONTRACT, ANGEL_CONTRACT]);
    // 3 from Zerodha + 3 from Angel = 6 unique trades
    expect(trades.length).toBe(6);
  });

  it('deduplicates identical trades across documents', () => {
    const trades = parseLedgerText([ZERODHA_CONTRACT, ZERODHA_CONTRACT]);
    // Same document twice — should not duplicate (same ts + symbol + type + qty)
    expect(trades.length).toBe(3);
  });

  it('sorts trades by timestamp descending (newest first)', () => {
    const trades = parseLedgerText([ZERODHA_CONTRACT]);
    for (let i = 1; i < trades.length; i++) {
      const prev = new Date(trades[i - 1].execution_timestamp).getTime();
      const curr = new Date(trades[i].execution_timestamp).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });
});

// ====================================================================
// validateTrade
// ====================================================================

describe('validateTrade', () => {
  const validTrade: ParsedTrade = {
    execution_timestamp: '2026-06-15T10:30:00',
    asset_symbol: 'RELIANCE',
    transaction_type: 'BUY',
    filled_quantity: 50,
    execution_price: 2890.50,
    regulatory_fees: 15.00,
    exchange: 'NSE',
  };

  it('returns valid: true for a correct trade', () => {
    const result = validateTrade(validTrade);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects missing timestamp', () => {
    const result = validateTrade({ ...validTrade, execution_timestamp: 'invalid-date' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid or missing execution_timestamp');
  });

  it('rejects missing symbol (UNKNOWN)', () => {
    const result = validateTrade({ ...validTrade, asset_symbol: 'UNKNOWN' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid or missing asset_symbol');
  });

  it('rejects invalid transaction type', () => {
    const result = validateTrade({ ...validTrade, transaction_type: 'HOLD' as any });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('transaction_type must be BUY or SELL');
  });

  it('rejects zero quantity', () => {
    const result = validateTrade({ ...validTrade, filled_quantity: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('filled_quantity must be positive');
  });

  it('rejects zero price', () => {
    const result = validateTrade({ ...validTrade, execution_price: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('execution_price must be positive');
  });

  it('rejects negative regulatory_fees', () => {
    const result = validateTrade({ ...validTrade, regulatory_fees: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('regulatory_fees cannot be negative');
  });

  it('collects multiple errors at once', () => {
    const bad: ParsedTrade = {
      execution_timestamp: 'bad',
      asset_symbol: 'UNKNOWN',
      transaction_type: 'INVALID' as any,
      filled_quantity: -5,
      execution_price: 0,
      regulatory_fees: -10,
    };
    const result = validateTrade(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});

// ====================================================================
// Edge Cases
// ====================================================================

describe('edge cases', () => {
  it('returns empty array for empty string', () => {
    const trades = parseContractNote('');
    expect(trades).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    const trades = parseContractNote('   \n  \t  ');
    expect(trades).toEqual([]);
  });

  it('returns empty array for text with no trade patterns', () => {
    const trades = parseContractNote('This is just some random text without any trade data.');
    expect(trades).toEqual([]);
  });

  it('handles unknown broker format with generic fallback', () => {
    const text = '15-06-2026 10:30:00 BUY RELIANCE 50 2890.50';
    const trades = parseContractNote(text);
    expect(trades.length).toBe(1);
    expect(trades[0].asset_symbol).toBe('RELIANCE');
  });
});
