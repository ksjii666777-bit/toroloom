/**
 * ============================================================================
 * Toroloom Contract Note CSV Export — Integration Tests
 * ============================================================================
 *
 * End-to-end test of the CSV export pipeline that mirrors what the React
 * Native frontend does after parsing a PDF contract note:
 *
 *   1. Create a PDF with known trade data (via pdfkit)
 *   2. Send it to POST /api/contract-note/parse-base64
 *   3. Extract structured trades from the returned text
 *   4. Generate CSV from those trades
 *   5. Verify CSV format, sections, and content
 *
 * This validates the full integration between the PDF parsing backend
 * and the CSV export logic, catching regressions in either layer.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/contractNoteCSV.export.int.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import PDFDocument from 'pdfkit';

import contractNoteRoutes from '../routes/contractNote';

// ============================================================================
// PDF Generation Helpers
// ============================================================================

/**
 * Generate a PDF buffer containing the given text using pdfkit.
 */
function createPdfBuffer(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(11).text(text, 50, 100, {
      width: 500,
      align: 'left',
      lineGap: 4,
    });

    doc.end();
  });
}

// ============================================================================
// Test Fixture Data
// ============================================================================

const ZERODHA_TRADE_TEXT = `
Zerodha Broking Ltd.
Contract Note

Trade Date: 15-01-2024 10:30:00
Settlement No: SETTLE001

Scrip Name    | Buy/Sell | Quantity | Rate    | Amount
15-01-2024 10:30:00 RELIANCE BUY 25 2567.50 64187.50
15-01-2024 11:00:00 TCS SELL 10 3890.00 38900.00
15-01-2024 14:15:00 INFY BUY 50 1467.30 73365.00
15-01-2024 15:30:00 HDFCBANK SELL 15 1678.90 25183.50

Brokerage: 125.00
STT: 45.00
Other Charges: 12.50
Total: 64187.50
`;

const ANGEL_TRADE_TEXT = `
Angel One Ltd.
Contract Note

Trade Date: 20-01-2024 09:45:00
Order No: ORD2024001

Symbol      | B/S | Qty | Price   | Value
20-01-2024 09:45:00 SBIN B 100 789.50 78950.00
20-01-2024 10:30:00 BAJFINANCE S 30 6789.00 203670.00
20-01-2024 11:15:00 ICICIBANK B 75 1089.30 81697.50

Total Turnover: 382585.50
Brokerage: 0.00
`;

const LONG_TRADE_TEXT = Array.from({ length: 30 }, (_, i) =>
  `15-01-2024 ${String(9 + Math.floor(i / 6)).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}:00 SYMBOL${i} ${i % 2 === 0 ? 'BUY' : 'SELL'} ${i + 1} ${(100 + i * 10 + 0.50).toFixed(2)}`,
).join('\n');

// ============================================================================
// CSV Generation Helpers (mirrors frontend pdfExtractor.ts logic)
// ============================================================================

/** CSV-escape a field value */
function csvField(val: string | number): string {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV row from values */
function csvRow(...vals: (string | number)[]): string {
  return vals.map(v => csvField(v)).join(',') + '\n';
}

/** Convert a broker key to a human-readable label */
function brokerLabel(broker: string): string {
  return broker
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Normalize DD-MM-YYYY HH:MM:SS to YYYY-MM-DDT HH:MM:SS */
function normalizeTimestamp(raw: string): string {
  const parts = raw.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}:\d{2}:\d{2})/);
  if (!parts) return raw;
  return `${parts[3]}-${parts[2]}-${parts[1]}T${parts[4]}`;
}

/**
 * Parse structured trades from raw contract note text.
 * Mirrors the frontend tradeLedgerParser's behavior for known formats.
 */
function parseTradesFromText(text: string): Array<{
  execution_timestamp: string;
  asset_symbol: string;
  transaction_type: 'BUY' | 'SELL';
  filled_quantity: number;
  execution_price: number;
  regulatory_fees: number;
  exchange?: string;
  trade_id?: string;
}> {
  const trades: Array<{
    execution_timestamp: string;
    asset_symbol: string;
    transaction_type: 'BUY' | 'SELL';
    filled_quantity: number;
    execution_price: number;
    regulatory_fees: number;
    exchange?: string;
    trade_id?: string;
  }> = [];

  // Detected broker
  const lower = text.toLowerCase();
  const brokerDetected = lower.includes('zerodha')
    ? 'zerodha'
    : lower.includes('angel')
      ? 'angel'
      : undefined;

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match trade lines: timestamp + symbol + action + qty + price
    const tradeMatch = trimmed.match(
      /(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})\s+([A-Z]+)\s+(BUY|SELL|B|S)\s+(\d+)\s+(\d+\.\d{2})/i,
    );
    if (!tradeMatch) continue;

    const action = tradeMatch[3].toUpperCase();
    trades.push({
      execution_timestamp: normalizeTimestamp(tradeMatch[1]),
      asset_symbol: tradeMatch[2],
      transaction_type: action === 'B' ? 'BUY' : action === 'S' ? 'SELL' : (action as 'BUY' | 'SELL'),
      filled_quantity: parseInt(tradeMatch[4], 10),
      execution_price: parseFloat(tradeMatch[5]),
      regulatory_fees: 0,
      exchange: 'NSE',
    });
  }

  return trades;
}

/**
 * Detect broker from raw text (mirrors frontend detectBrokerFromText).
 */
function detectBrokerFromText(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('zerodha')) return 'zerodha';
  if (lower.includes('angel broking') || lower.includes('angel one')) return 'angel';
  if (lower.includes('groww') || lower.includes('nextbillion')) return 'groww';
  if (lower.includes('icici direct') || lower.includes('icici securities')) return 'icici_direct';
  if (lower.includes('hdfc securities') || lower.includes('hdfcsec')) return 'hdfc_securities';
  if (lower.includes('kotak') && (lower.includes('securities') || lower.includes('mahindra'))) return 'kotak_securities';
  return undefined;
}

/**
 * Generate CSV for a single-file parse result (mirrors frontend exportSingleToCSV).
 */
function generateSingleCSV(params: {
  success: boolean;
  trades: ReturnType<typeof parseTradesFromText>;
  rawText: string;
  filename?: string;
  pages?: number;
  brokerDetected?: string;
  source?: string;
  error?: string;
}): string {
  let csv = '';

  // ── File Summary ──
  csv += 'Toroloom Contract Notes - Parse Results\n';
  csv += csvRow('Generated', new Date().toLocaleString('en-IN'));
  csv += csvRow('Filename', params.filename || 'N/A');
  csv += csvRow('Status', params.success ? 'Success' : 'Failed');
  csv += csvRow('Trades Found', params.trades.length);
  if (params.brokerDetected) csv += csvRow('Broker', brokerLabel(params.brokerDetected));
  if (params.pages) csv += csvRow('Pages', params.pages);
  csv += csvRow('Source', params.source === 'backend' ? 'Server extraction' : 'Local fallback');
  if (params.error) csv += csvRow('Error', params.error);
  csv += '\n';

  // ── Trades Table ──
  csv += '=== TRADES ===\n';
  csv += csvRow('Timestamp', 'Symbol', 'Type', 'Quantity', 'Price', 'Fees', 'Exchange', 'Trade ID');
  for (const t of params.trades) {
    csv += csvRow(
      t.execution_timestamp,
      t.asset_symbol,
      t.transaction_type,
      t.filled_quantity,
      t.execution_price.toFixed(2),
      t.regulatory_fees.toFixed(2),
      t.exchange || '',
      t.trade_id || '',
    );
  }

  // ── Raw Text Reference ──
  if (params.rawText) {
    csv += '\n';
    csv += '=== RAW TEXT ===\n';
    const truncated = params.rawText.length > 10000
      ? params.rawText.slice(0, 10000) + `\n[... truncated, original length: ${params.rawText.length} chars]`
      : params.rawText;
    csv += truncated + '\n';
  }

  return csv;
}

// ============================================================================
// HTTP Request Helpers
// ============================================================================

type ReqOptions = {
  method?: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
};

function request(opts: ReqOptions): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, baseUrl);
    const req = http.request(
      url.toString(),
      {
        method: opts.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...opts.headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          let body: any;
          try {
            body = data ? JSON.parse(data) : undefined;
          } catch {
            body = data;
          }
          resolve({ status: res.statusCode!, body });
        });
      },
    );
    req.on('error', reject);

    if (opts.body) {
      req.write(JSON.stringify(opts.body));
    }
    req.end();
  });
}

function post(path: string, body?: any, headers?: Record<string, string>) {
  return request({ method: 'POST', path, body, headers });
}

// ============================================================================
// Server
// ============================================================================

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '20mb' }));
  app.use('/api/contract-note', contractNoteRoutes);

  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const port = (server.address() as any).port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

// ============================================================================
// Tests — Single File CSV Export
// ============================================================================

describe('CSV Export — Single File', () => {
  it('generates CSV from a parsed Zerodha PDF contract note', async () => {
    const pdfBuffer = await createPdfBuffer(ZERODHA_TRADE_TEXT);
    const base64 = pdfBuffer.toString('base64');

    // Step 1: Parse via backend
    const { status, body } = await post('/api/contract-note/parse-base64', {
      base64,
      filename: 'zerodha_contract.pdf',
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.text).toContain('Zerodha');
    expect(body.pages).toBeGreaterThanOrEqual(1);

    // Step 2: Extract trades from the text
    const trades = parseTradesFromText(body.text);
    expect(trades).toHaveLength(4);

    // Step 3: Detect broker
    const broker = detectBrokerFromText(body.text);
    expect(broker).toBe('zerodha');

    // Step 4: Generate CSV
    const csv = generateSingleCSV({
      success: true,
      trades,
      rawText: body.text,
      filename: 'zerodha_contract.pdf',
      pages: body.pages,
      brokerDetected: broker,
      source: 'backend',
    });

    // Step 5: Verify CSV content
    expect(csv).toContain('Toroloom Contract Notes - Parse Results');
    expect(csv).toContain('Filename,zerodha_contract.pdf');
    expect(csv).toContain('Status,Success');
    expect(csv).toContain('Trades Found,4');
    expect(csv).toContain('Broker,Zerodha');
    expect(csv).toContain('Source,Server extraction');

    // Trades section
    expect(csv).toContain('=== TRADES ===');
    expect(csv).toContain('Timestamp,Symbol,Type,Quantity,Price,Fees,Exchange,Trade ID');

    // Verify specific trades
    expect(csv).toContain('2024-01-15T10:30:00,RELIANCE,BUY,25,2567.50,0.00,NSE,');
    expect(csv).toContain('2024-01-15T11:00:00,TCS,SELL,10,3890.00,0.00,NSE,');
    expect(csv).toContain('2024-01-15T14:15:00,INFY,BUY,50,1467.30,0.00,NSE,');
    expect(csv).toContain('2024-01-15T15:30:00,HDFCBANK,SELL,15,1678.90,0.00,NSE,');

    // Raw text section
    expect(csv).toContain('=== RAW TEXT ===');
    expect(csv).toContain('Zerodha Broking Ltd.');
    expect(csv).toContain('RELIANCE BUY 25 2567.50');

    // Trade count (4 data rows, not counting headers)
    const tradeSection = csv.split('=== TRADES ===')[1].split('=== RAW TEXT ===')[0];
    const tradeRows = tradeSection.split('\n').filter(l => /^\d{4}-\d{2}-\d{2}T/.test(l));
    expect(tradeRows).toHaveLength(4);
  });

  it('generates CSV from a parsed Angel One PDF contract note', async () => {
    const pdfBuffer = await createPdfBuffer(ANGEL_TRADE_TEXT);
    const base64 = pdfBuffer.toString('base64');

    const { status, body } = await post('/api/contract-note/parse-base64', {
      base64,
      filename: 'angel_statement.pdf',
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);

    const trades = parseTradesFromText(body.text);
    expect(trades).toHaveLength(3);

    const broker = detectBrokerFromText(body.text);
    expect(broker).toBe('angel');

    const csv = generateSingleCSV({
      success: true,
      trades,
      rawText: body.text,
      filename: 'angel_statement.pdf',
      pages: body.pages,
      brokerDetected: broker,
      source: 'backend',
    });

    expect(csv).toContain('Broker,Angel');
    expect(csv).toContain('2024-01-20T09:45:00,SBIN,BUY,100,789.50,0.00,NSE,');
    expect(csv).toContain('2024-01-20T10:30:00,BAJFINANCE,SELL,30,6789.00,0.00,NSE,');
    expect(csv).toContain('2024-01-20T11:15:00,ICICIBANK,BUY,75,1089.30,0.00,NSE,');
  });

  it('generates CSV for failed parse result with error message', async () => {
    // Use a valid PDF but with text that has no trade data — the backend
    // will still return success (it extracts text, not trades), but our
    // trade parser will find 0 trades.
    const pdfBuffer = await createPdfBuffer('This is a generic document with no trade data whatsoever.');
    const base64 = pdfBuffer.toString('base64');

    const { status, body } = await post('/api/contract-note/parse-base64', { base64 });
    expect(status).toBe(200);

    const trades = parseTradesFromText(body.text);
    expect(trades).toHaveLength(0);

    const csv = generateSingleCSV({
      success: false,
      trades: [],
      rawText: body.text,
      filename: 'no_trades.pdf',
      error: 'Could not extract any trades from this document.',
    });

    expect(csv).toContain('Status,Failed');
    expect(csv).toContain('Trades Found,0');
    // No commas in the error text, so csvField leaves it unquoted
    expect(csv).toContain('Error,Could not extract any trades from this document.');

    // No trade data rows
    const tradeSection = csv.split('=== TRADES ===')[1].split('=== RAW TEXT ===')[0];
    const tradeRows = tradeSection.split('\n').filter(l => /^\d{4}-\d{2}-\d{2}T/.test(l));
    expect(tradeRows).toHaveLength(0);
  });

  it('truncates long raw text in CSV', async () => {
    const longText = 'X'.repeat(12000) + '\n' + 'Y'.repeat(500);
    const pdfBuffer = await createPdfBuffer(longText);
    const base64 = pdfBuffer.toString('base64');

    const { status, body } = await post('/api/contract-note/parse-base64', { base64 });
    expect(status).toBe(200);

    const trades = parseTradesFromText(body.text);
    expect(trades).toHaveLength(0); // no structured trade data

    const csv = generateSingleCSV({
      success: false,
      trades: [],
      rawText: body.text,
      filename: 'long_doc.pdf',
    });

    expect(csv).toContain('=== RAW TEXT ===');
    // Should have truncation notice when raw text > 10000 chars
    expect(csv).toContain('truncated');
    expect(csv).toContain('original length:');
  });

  it('includes pages and source metadata in CSV header', async () => {
    const pdfBuffer = await createPdfBuffer(ZERODHA_TRADE_TEXT);
    const base64 = pdfBuffer.toString('base64');

    const { status, body } = await post('/api/contract-note/parse-base64', {
      base64,
      filename: 'meta_test.pdf',
    });
    expect(status).toBe(200);

    const trades = parseTradesFromText(body.text);
    const broker = detectBrokerFromText(body.text);

    const csv = generateSingleCSV({
      success: true,
      trades,
      rawText: body.text,
      filename: 'meta_test.pdf',
      pages: body.pages, // should be included
      brokerDetected: broker,
      source: 'backend',
    });

    const lines = csv.split('\n');
    expect(lines).toContain(`Pages,${body.pages}`);
    expect(lines).toContain('Source,Server extraction');
  });
});

// ============================================================================
// Tests — Batch / Multi-File CSV Export
// ============================================================================

describe('CSV Export — Batch / Multi-File', () => {
  /**
   * Generate CSV for batch/multi-file parse results (mirrors frontend exportBatchToCSV).
   */
  function generateBatchCSV(files: Array<{
    filename: string;
    success: boolean;
    trades: ReturnType<typeof parseTradesFromText>;
    pages?: number;
    brokerDetected?: string;
    error?: string;
  }>, mergedTrades: ReturnType<typeof parseTradesFromText>): string {
    let csv = '';
    const succeeded = files.filter(f => f.success).length;
    const failed = files.filter(f => !f.success).length;
    const allTrades = files.flatMap(f => f.trades);
    const brokers = [...new Set(files.map(f => f.brokerDetected).filter(Boolean) as string[])];

    // ── Batch Summary ──
    csv += 'Toroloom Contract Notes - Batch Results\n';
    csv += csvRow('Generated', new Date().toLocaleString('en-IN'));
    csv += csvRow('Files Processed', files.length);
    csv += csvRow('Succeeded', succeeded);
    csv += csvRow('Failed', failed);
    csv += csvRow('Total Trades (raw)', allTrades.length);
    csv += csvRow('Merged Trades (deduped)', mergedTrades.length);
    csv += csvRow('Brokers Detected', brokers.join(', ') || 'None');
    csv += '\n';

    // ── Merged Trades ──
    csv += '=== MERGED TRADES ===\n';
    csv += csvRow('Timestamp', 'Symbol', 'Type', 'Quantity', 'Price', 'Fees', 'Exchange', 'Trade ID');
    for (const t of mergedTrades) {
      csv += csvRow(
        t.execution_timestamp,
        t.asset_symbol,
        t.transaction_type,
        t.filled_quantity,
        t.execution_price.toFixed(2),
        t.regulatory_fees.toFixed(2),
        t.exchange || '',
        t.trade_id || '',
      );
    }
    csv += '\n';

    // ── Per-File Breakdown ──
    csv += '=== PER-FILE BREAKDOWN ===\n';
    csv += csvRow('File', 'Success', 'Trades Found', 'Pages', 'Broker', 'Error');
    for (const f of files) {
      csv += csvRow(
        f.filename,
        f.success ? 'Yes' : 'No',
        f.trades.length,
        f.pages || '',
        f.brokerDetected ? brokerLabel(f.brokerDetected) : '',
        f.error || '',
      );
    }
    csv += '\n';

    // ── Per-File Trade Details ──
    csv += '=== PER-FILE TRADE DETAILS ===\n';
    for (const f of files) {
      if (f.trades.length === 0) continue;
      csv += `\n--- ${f.filename} ---\n`;
      csv += csvRow('Timestamp', 'Symbol', 'Type', 'Quantity', 'Price', 'Fees');
      for (const t of f.trades) {
        csv += csvRow(
          t.execution_timestamp,
          t.asset_symbol,
          t.transaction_type,
          t.filled_quantity,
          t.execution_price.toFixed(2),
          t.regulatory_fees.toFixed(2),
        );
      }
    }

    return csv;
  }

  it('generates batch CSV from two parsed PDFs with merged trades', async () => {
    // Parse Zerodha PDF
    const zerodhaPdf = await createPdfBuffer(ZERODHA_TRADE_TEXT);
    const { body: zerodhaRes } = await post('/api/contract-note/parse-base64', {
      base64: zerodhaPdf.toString('base64'),
      filename: 'zerodha.pdf',
    });
    const zerodhaTrades = parseTradesFromText(zerodhaRes.text);

    // Parse Angel PDF
    const angelPdf = await createPdfBuffer(ANGEL_TRADE_TEXT);
    const { body: angelRes } = await post('/api/contract-note/parse-base64', {
      base64: angelPdf.toString('base64'),
      filename: 'angel.pdf',
    });
    const angelTrades = parseTradesFromText(angelRes.text);

    const files = [
      {
        filename: 'zerodha.pdf',
        success: true,
        trades: zerodhaTrades,
        pages: zerodhaRes.pages,
        brokerDetected: 'zerodha',
      },
      {
        filename: 'angel.pdf',
        success: true,
        trades: angelTrades,
        pages: angelRes.pages,
        brokerDetected: 'angel',
      },
    ];

    // Merged trades (no dedup since all trades are unique)
    const mergedTrades = [...zerodhaTrades, ...angelTrades];

    const csv = generateBatchCSV(files, mergedTrades);

    // Summary
    expect(csv).toContain('Toroloom Contract Notes - Batch Results');
    expect(csv).toContain('Files Processed,2');
    expect(csv).toContain('Succeeded,2');
    expect(csv).toContain('Failed,0');
    expect(csv).toContain('Total Trades (raw),7');
    expect(csv).toContain('Merged Trades (deduped),7');

    // Merged trades section
    expect(csv).toContain('=== MERGED TRADES ===');
    expect(csv).toContain('2024-01-15T10:30:00,RELIANCE,BUY,25,2567.50,0.00,NSE,');
    expect(csv).toContain('2024-01-20T09:45:00,SBIN,BUY,100,789.50,0.00,NSE,');

    // Per-file breakdown
    expect(csv).toContain('=== PER-FILE BREAKDOWN ===');
    expect(csv).toContain('zerodha.pdf,Yes,4');
    expect(csv).toContain('angel.pdf,Yes,3');

    // Broker labels in breakdown
    expect(csv).toContain('Zerodha');
    expect(csv).toContain('Angel');

    // Per-file trade details
    expect(csv).toContain('--- zerodha.pdf ---');
    expect(csv).toContain('--- angel.pdf ---');
  });

  it('deduplicates merged trades when the same trade appears in multiple files', async () => {
    const TRADE_DATA_DUPLICATE = `
Zerodha Broking Ltd.
Contract Note

Trade Date: 15-01-2024 10:30:00

Scrip Name    | Buy/Sell | Quantity | Rate
15-01-2024 10:30:00 RELIANCE BUY 25 2567.50
15-01-2024 11:00:00 TCS SELL 10 3890.00

Total: 1000.00
`;

    // Parse file 1
    const pdf1 = await createPdfBuffer(ZERODHA_TRADE_TEXT);
    const pdf2 = await createPdfBuffer(TRADE_DATA_DUPLICATE);

    const { body: res1 } = await post('/api/contract-note/parse-base64', {
      base64: pdf1.toString('base64'),
      filename: 'full_contract.pdf',
    });
    const { body: res2 } = await post('/api/contract-note/parse-base64', {
      base64: pdf2.toString('base64'),
      filename: 'duplicate_contract.pdf',
    });

    const trades1 = parseTradesFromText(res1.text);
    const trades2 = parseTradesFromText(res2.text);

    // trades1 has 4 trades (RELIANCE, TCS, INFY, HDFCBANK)
    // trades2 has 2 trades (RELIANCE, TCS) — 2 of which overlap with trades1
    const allRaw = [...trades1, ...trades2];
    expect(allRaw).toHaveLength(6);

    // Dedup by timestamp + symbol + type + qty + price
    const seen = new Set<string>();
    const merged = allRaw.filter(t => {
      const key = `${t.execution_timestamp}|${t.asset_symbol}|${t.transaction_type}|${t.filled_quantity}|${t.execution_price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    expect(merged).toHaveLength(4); // 6 raw - 2 duplicates

    const files = [
      {
        filename: 'full_contract.pdf',
        success: true,
        trades: trades1,
        pages: res1.pages,
        brokerDetected: 'zerodha',
      },
      {
        filename: 'duplicate_contract.pdf',
        success: true,
        trades: trades2,
        pages: res2.pages,
        brokerDetected: 'zerodha',
      },
    ];

    const csv = generateBatchCSV(files, merged);

    expect(csv).toContain('Total Trades (raw),6');
    expect(csv).toContain('Merged Trades (deduped),4');

    // Only 4 merged trade rows
    const mergedSection = csv.split('=== MERGED TRADES ===')[1].split('=== PER-FILE BREAKDOWN ===')[0];
    const mergedRows = mergedSection.split('\n').filter(l => /^\d{4}-\d{2}-\d{2}T/.test(l));
    expect(mergedRows).toHaveLength(4);
  });

  it('includes partial failure info in batch CSV', async () => {
    // One good file, one bad file (non-trade text)
    const goodPdf = await createPdfBuffer(ZERODHA_TRADE_TEXT);
    const badPdf = await createPdfBuffer('Corrupted content with no trade data at all.');

    const { body: goodRes } = await post('/api/contract-note/parse-base64', {
      base64: goodPdf.toString('base64'),
      filename: 'good.pdf',
    });
    const { body: badRes } = await post('/api/contract-note/parse-base64', {
      base64: badPdf.toString('base64'),
      filename: 'bad.pdf',
    });

    const goodTrades = parseTradesFromText(goodRes.text);
    const badTrades = parseTradesFromText(badRes.text);
    expect(goodTrades.length).toBeGreaterThan(0);
    expect(badTrades).toHaveLength(0);

    const files = [
      {
        filename: 'good.pdf',
        success: true,
        trades: goodTrades,
        pages: goodRes.pages,
        brokerDetected: 'zerodha',
      },
      {
        filename: 'bad.pdf',
        success: false,
        trades: [],
        pages: badRes.pages,
        error: 'No trades found in document',
      },
    ];

    const csv = generateBatchCSV(files, goodTrades);

    expect(csv).toContain('Files Processed,2');
    expect(csv).toContain('Succeeded,1');
    expect(csv).toContain('Failed,1');

    // Bad file should appear in breakdown with error
    expect(csv).toContain('bad.pdf,No,0');
    expect(csv).toContain('No trades found in document');

    // Good file should have details
    expect(csv).toContain('--- good.pdf ---');

    // Bad file should NOT have a details section (0 trades)
    expect(csv).not.toContain('--- bad.pdf ---');
  });
});

// ============================================================================
// Tests — CSV Format Edge Cases
// ============================================================================

describe('CSV Format — Edge Cases & Escaping', () => {
  it('escapes fields containing commas', () => {
    const csv = generateSingleCSV({
      success: false,
      trades: [],
      rawText: '',
      filename: 'error_file.pdf',
      error: 'Parse error: column 3, row 5, unexpected token',
    });

    // Error with commas should be quoted
    expect(csv).toContain('"Parse error: column 3, row 5, unexpected token"');
  });

  it('escapes fields containing double quotes', () => {
    const csv = generateSingleCSV({
      success: false,
      trades: [],
      rawText: '',
      filename: 'quotes_file.pdf',
      error: 'Column "Amount" is missing',
    });

    // Double quotes should be doubled inside quoted fields
    expect(csv).toContain('"Column ""Amount"" is missing"');
  });

  it('includes correct CSV headers for all sections', () => {
    const csv = generateSingleCSV({
      success: true,
      trades: [{
        execution_timestamp: '2024-01-15T10:30:00',
        asset_symbol: 'TEST',
        transaction_type: 'BUY',
        filled_quantity: 10,
        execution_price: 100.50,
        regulatory_fees: 1.25,
        exchange: 'NSE',
        trade_id: 'TXN001',
      }],
      rawText: 'some text',
      filename: 'test.pdf',
      brokerDetected: 'zerodha',
      source: 'backend',
    });

    // All expected sections
    expect(csv).toContain('Toroloom Contract Notes - Parse Results');
    expect(csv).toContain('=== TRADES ===');
    expect(csv).toContain('=== RAW TEXT ===');

    // Trade header
    expect(csv).toContain('Timestamp,Symbol,Type,Quantity,Price,Fees,Exchange,Trade ID');
  });
});
