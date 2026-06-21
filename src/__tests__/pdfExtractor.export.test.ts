/**
 * ============================================================================
 * Toroloom — pdfExtractor Export Tests
 * ============================================================================
 *
 * Tests the exportBatchToCSV function that generates CSV from batch contract
 * note parse results, writes to the file system, and opens the OS share sheet.
 *
 * Coverage:
 *   - CSV content format (headers, sections, trade data, escaping)
 *   - File system calls (writeAsStringAsync with correct path/encoding)
 *   - Sharing integration (shareAsync with correct mime type)
 *   - Error handling (sharing unavailable, write failure)
 *
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock expo-document-picker (required because pdfExtractor.ts imports it at top level) ─
vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(() => Promise.resolve({ canceled: true })),
}));

// ── Mock expo-file-system ───────────────────────────────────
// Override the global mock from setup.ts with local vi.fn() refs
// so tests can assert on call arguments.
// NOTE: vi.mock factories are hoisted, so use vi.hoisted to declare variables 
// that the factory can reference.
const { mockWriteAsync } = vi.hoisted(() => ({
  mockWriteAsync: vi.fn(),
}));

vi.mock('expo-file-system', () => ({
  cacheDirectory: '/tmp/',
  documentDirectory: '/docs/',
  moveAsync: vi.fn(() => Promise.resolve()),
  writeAsStringAsync: (...args: any[]) => mockWriteAsync(...args),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
}));

// ── Mock expo-sharing ────────────────────────────────────────
const { mockShareAsync, mockIsSharingAvailable } = vi.hoisted(() => ({
  mockShareAsync: vi.fn(),
  mockIsSharingAvailable: vi.fn(),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockIsSharingAvailable(),
  shareAsync: (...args: any[]) => mockShareAsync(...args),
}));

// ── Import the module under test ────────────────────────────
import { exportBatchToCSV, exportSingleToCSV } from '../services/gateway/pdfExtractor';
import type { BatchParseResult, ContractNoteParseResult } from '../services/gateway/pdfExtractor';
import type { ParsedTrade } from '../types';

// ==================== Test Fixtures ====================

const sampleTrade1: ParsedTrade = {
  execution_timestamp: '2024-01-15T10:30:00',
  asset_symbol: 'RELIANCE',
  transaction_type: 'BUY',
  filled_quantity: 25,
  execution_price: 2567.50,
  regulatory_fees: 45.00,
  exchange: 'NSE',
  trade_id: 'TXN12345',
};

const sampleTrade2: ParsedTrade = {
  execution_timestamp: '2024-01-15T11:00:00',
  asset_symbol: 'TCS',
  transaction_type: 'SELL',
  filled_quantity: 10,
  execution_price: 3890.00,
  regulatory_fees: 12.50,
  exchange: 'BSE',
};

const sampleTrade3: ParsedTrade = {
  execution_timestamp: '2024-01-20T09:45:00',
  asset_symbol: 'SBIN',
  transaction_type: 'BUY',
  filled_quantity: 100,
  execution_price: 789.50,
  regulatory_fees: 18.00,
};

const fullBatchResult: BatchParseResult = {
  totalFiles: 2,
  succeeded: 2,
  failed: 0,
  files: [
    {
      filename: 'zerodha_jan15.pdf',
      success: true,
      trades: [sampleTrade1, sampleTrade2],
      pages: 2,
      brokerDetected: 'zerodha',
      source: 'backend',
    },
    {
      filename: 'angel_jan20.pdf',
      success: true,
      trades: [sampleTrade3],
      pages: 1,
      brokerDetected: 'angel',
      source: 'backend',
    },
  ],
  mergedTrades: [sampleTrade1, sampleTrade2, sampleTrade3],
  rawTradeCount: 3,
  brokersDetected: ['zerodha', 'angel'],
};

const partialBatchResult: BatchParseResult = {
  totalFiles: 3,
  succeeded: 1,
  failed: 2,
  files: [
    {
      filename: 'good_trades.pdf',
      success: true,
      trades: [sampleTrade1],
      pages: 1,
      brokerDetected: 'zerodha',
      source: 'backend',
    },
    {
      filename: 'corrupted.pdf',
      success: false,
      trades: [],
      error: 'Could not extract any text from scanned image',
      source: 'backend',
    },
    {
      filename: 'wrong_format.pdf',
      success: false,
      trades: [],
      pages: 1,
      error: 'No trade data found in this document',
      source: 'backend',
    },
  ],
  mergedTrades: [sampleTrade1],
  rawTradeCount: 1,
  brokersDetected: ['zerodha'],
};

const emptyBatchResult: BatchParseResult = {
  totalFiles: 0,
  succeeded: 0,
  failed: 0,
  files: [],
  mergedTrades: [],
  rawTradeCount: 0,
  brokersDetected: [],
};

const batchWithDedup: BatchParseResult = {
  totalFiles: 2,
  succeeded: 2,
  failed: 0,
  files: [
    {
      filename: 'first.pdf',
      success: true,
      trades: [sampleTrade1, sampleTrade2],
      pages: 1,
      brokerDetected: 'zerodha',
      source: 'backend',
    },
    {
      filename: 'second.pdf',
      success: true,
      trades: [{ ...sampleTrade1 }, sampleTrade3], // duplicate of trade1
      pages: 1,
      brokerDetected: 'zerodha',
      source: 'backend',
    },
  ],
  mergedTrades: [sampleTrade1, sampleTrade2, sampleTrade3], // deduped to 3 from 4 raw
  rawTradeCount: 4,
  brokersDetected: ['zerodha'],
};

// ── Single-file fixture ───────────────────────

const singleSuccessResult: ContractNoteParseResult = {
  success: true,
  trades: [sampleTrade1, sampleTrade2],
  rawText: 'CONTRACT NOTE\nZerodha\nRELIANCE BUY 25 @ 2567.50\nTCS SELL 10 @ 3890.00',
  pages: 1,
  filename: 'zerodha_statement.pdf',
  brokerDetected: 'zerodha',
  source: 'backend',
};

const singleFailedResult: ContractNoteParseResult = {
  success: false,
  trades: [],
  rawText: '',
  filename: 'corrupted.pdf',
  error: 'Could not extract any text from scanned image',
  source: 'backend',
};

const singleNoBrokerResult: ContractNoteParseResult = {
  success: true,
  trades: [sampleTrade3],
  rawText: 'Some unknown broker statement',
  pages: 2,
  filename: 'unknown.pdf',
  source: 'fallback_local',
};

const singleLongRawTextResult: ContractNoteParseResult = {
  success: true,
  trades: [sampleTrade1],
  rawText: 'x'.repeat(15000),
  pages: 5,
  filename: 'long_doc.pdf',
  brokerDetected: 'angel',
  source: 'backend',
};

// ==================== Tests ====================

describe('exportBatchToCSV', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSharingAvailable.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
    mockWriteAsync.mockResolvedValue(undefined);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Successful Export — Content & Calls
  // ─────────────────────────────────────────────────────────────────────────

  it('writes CSV to file system with correct encoding and shares it', async () => {
    const result = await exportBatchToCSV(fullBatchResult);

    expect(result.success).toBe(true);
    expect(mockWriteAsync).toHaveBeenCalledTimes(1);

    // File path should be in cache dir with .csv extension
    // Note: cacheDirectory may have trailing slash, so accept optional double slash
    const writeArgs = mockWriteAsync.mock.calls[0];
    expect(writeArgs[0]).toMatch(/^\/tmp\/+ContractNotes_\d{4}-\d{2}-\d{2}_[A-Z0-9]+\.csv$/);

    // Encoding should be UTF8
    expect(writeArgs[2]).toEqual({ encoding: 'utf8' });

    // File should be shared with CSV mime type
    expect(mockShareAsync).toHaveBeenCalledTimes(1);
    const shareArgs = mockShareAsync.mock.calls[0];
    expect(shareArgs[0]).toBe(writeArgs[0]); // same path
    expect(shareArgs[1]).toEqual({ mimeType: 'text/csv' });
  });

  it('includes all CSV sections in the generated output', async () => {
    await exportBatchToCSV(fullBatchResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;

    expect(csv).toContain('Toroloom Contract Notes - Batch Results');
    expect(csv).toContain('=== SELECTED TRADES ===');
    expect(csv).toContain('=== PER-FILE TRADE DETAILS ===');
  });

  it('includes batch summary metadata in CSV header', async () => {
    await exportBatchToCSV(fullBatchResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;
    const lines = csv.split('\n');

    expect(lines).toContain('Files Processed,2');
    expect(lines).toContain('Succeeded,2');
    expect(lines).toContain('Failed,0');
    expect(lines).toContain('Total Trades (selected),3');
    expect(lines).toContain('Files Selected,2');
    // join(', ') on ['zerodha', 'angel'] produces 'zerodha, angel' which
    // csvField then quotes since it contains a comma.
    expect(lines).toContain('Brokers Detected,"zerodha, angel"');
  });

  it('includes selected trades table with source file column', async () => {
    await exportBatchToCSV(fullBatchResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;

    // Headers (now includes Source File column)
    expect(csv).toContain('Timestamp,Symbol,Type,Quantity,Price,Fees,Exchange,Trade ID,Source File');

    // Trade rows (now include source filename)
    expect(csv).toContain('2024-01-15T10:30:00,RELIANCE,BUY,25,2567.50,45.00,NSE,TXN12345,zerodha_jan15.pdf');
    expect(csv).toContain('2024-01-15T11:00:00,TCS,SELL,10,3890.00,12.50,BSE,,zerodha_jan15.pdf');
    expect(csv).toContain('2024-01-20T09:45:00,SBIN,BUY,100,789.50,18.00,,,angel_jan20.pdf');
  });

  it('includes per-file trade details for each file', async () => {
    await exportBatchToCSV(fullBatchResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;

    // Per-file sections exist
    expect(csv).toContain('--- zerodha_jan15.pdf ---');
    expect(csv).toContain('--- angel_jan20.pdf ---');
  });

  it('includes per-file trade details section', async () => {
    await exportBatchToCSV(fullBatchResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;

    // File section headers
    expect(csv).toContain('--- zerodha_jan15.pdf ---');
    expect(csv).toContain('--- angel_jan20.pdf ---');

    // Trade details under each file
    expect(csv).toContain('2024-01-15T10:30:00,RELIANCE,BUY,25,2567.50,45.00');
    expect(csv).toContain('2024-01-20T09:45:00,SBIN,BUY,100,789.50,18.00');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Partial / Error Results
  // ─────────────────────────────────────────────────────────────────────────

  it('handles partial failure results with per-file sections', async () => {
    await exportBatchToCSV(partialBatchResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;

    // Summary
    expect(csv).toContain('Files Processed,3');
    expect(csv).toContain('Succeeded,1');
    expect(csv).toContain('Failed,2');

    // Successful file details (only files with trades get sections)
    expect(csv).toContain('--- good_trades.pdf ---');
    expect(csv).toContain('RELIANCE');

    // Failed files with no trades don't get their own sections
    expect(csv).not.toContain('--- corrupted.pdf ---');
    expect(csv).not.toContain('--- wrong_format.pdf ---');
  });

  it('handles empty batch result gracefully', async () => {
    await exportBatchToCSV(emptyBatchResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;

    expect(csv).toContain('Files Processed,0');
    expect(csv).toContain('Succeeded,0');
    expect(csv).toContain('Failed,0');
    expect(csv).toContain('Files Selected,0');
    expect(csv).toContain('Total Trades (selected),0');
    expect(csv).toContain('=== SELECTED TRADES ===');
    expect(csv).toContain('=== PER-FILE TRADE DETAILS ===');

    // No file sections (empty files array)
    const sections = csv.split('=== PER-FILE TRADE DETAILS ===');
    expect(sections[1]?.trim()).toBe('');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. CSV Formatting (Escaping)
  // ─────────────────────────────────────────────────────────────────────────

  it('properly escapes commas in brokers detected header', async () => {
    // Multiple brokers with comma-separated names get quoted by csvField
    await exportBatchToCSV(fullBatchResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;
    // Brokers Detected: 'zerodha, angel' has a comma, so csvField quotes it
    expect(csv).toContain('Brokers Detected,"zerodha, angel"');
  });

  it('handles broker names with underscores in detected list', async () => {
    const withLabelTest: BatchParseResult = {
      ...fullBatchResult,
      files: [{
        filename: 'icici.pdf',
        success: true,
        trades: [sampleTrade1],
        pages: 1,
        brokerDetected: 'icici_direct',
        source: 'backend',
      }],
      brokersDetected: ['icici_direct'],
    };

    await exportBatchToCSV(withLabelTest);

    const csv = mockWriteAsync.mock.calls[0][1] as string;
    // Brokers Detected uses the raw key 'icici_direct' (not label-transformed)
    expect(csv).toContain('icici_direct');
  });

  it('includes per-file trade sections for each file that has trades, skips empty ones', async () => {
    await exportBatchToCSV(partialBatchResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;

    // Success file should have trade details
    expect(csv).toContain('--- good_trades.pdf ---');
    expect(csv).not.toContain('--- corrupted.pdf ---');
    expect(csv).not.toContain('--- wrong_format.pdf ---');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Dedup Info
  // ─────────────────────────────────────────────────────────────────────────

  it('shows correct selected trade counts', async () => {
    await exportBatchToCSV(batchWithDedup);

    const csv = mockWriteAsync.mock.calls[0][1] as string;
    const lines = csv.split('\n');

    expect(lines).toContain('Files Selected,2');
    expect(lines).toContain('Total Trades (selected),4');

    // Selected trades table should have entries from each file (no dedup for per-file)
    const selectedSection = csv.split('=== SELECTED TRADES ===')[1].split('=== PER-FILE TRADE DETAILS ===')[0];
    const tradeRows = selectedSection.split('\n').filter(
      line => /^\d{4}-\d{2}-\d{2}T/.test(line)  // lines starting with timestamp
    );
    // 2 from first.pdf + 2 from second.pdf = 4 total (no dedup)
    expect(tradeRows).toHaveLength(4);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Error Handling
  // ─────────────────────────────────────────────────────────────────────────

  it('returns error when sharing is not available', async () => {
    mockIsSharingAvailable.mockResolvedValue(false);

    const result = await exportBatchToCSV(fullBatchResult);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Sharing is not available');
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('returns error when file write fails', async () => {
    mockWriteAsync.mockRejectedValue(new Error('Disk full'));

    const result = await exportBatchToCSV(fullBatchResult);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('handles shareAsync rejection gracefully', async () => {
    mockShareAsync.mockRejectedValue(new Error('User cancelled'));

    const result = await exportBatchToCSV(fullBatchResult);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Filename Format
  // ─────────────────────────────────────────────────────────────────────────

  it('generates correct filename format (ContractNotes_YYYY-MM-DD_XXXXXX.csv)', async () => {
    await exportBatchToCSV(fullBatchResult);

    const writeArgs = mockWriteAsync.mock.calls[0];
    expect(writeArgs[0]).toMatch(
      /ContractNotes_\d{4}-\d{2}-\d{2}_[A-Z0-9]+\.csv$/
    );
  });
});

// ==================== Single Export Tests ====================

describe('exportSingleToCSV', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSharingAvailable.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
    mockWriteAsync.mockResolvedValue(undefined);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Successful Export — Content & Calls
  // ─────────────────────────────────────────────────────────────────────────

  it('writes CSV to file system and shares it', async () => {
    const result = await exportSingleToCSV(singleSuccessResult);

    expect(result.success).toBe(true);
    expect(mockWriteAsync).toHaveBeenCalledTimes(1);

    const writeArgs = mockWriteAsync.mock.calls[0];
    expect(writeArgs[0]).toMatch(/^\/tmp\/+ContractNote_\d{4}-\d{2}-\d{2}_[A-Z0-9]+\.csv$/);
    expect(writeArgs[2]).toEqual({ encoding: 'utf8' });

    expect(mockShareAsync).toHaveBeenCalledTimes(1);
    expect(mockShareAsync.mock.calls[0][1]).toEqual({ mimeType: 'text/csv' });
  });

  it('includes file summary header with metadata', async () => {
    await exportSingleToCSV(singleSuccessResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;
    const lines = csv.split('\n');

    expect(csv).toContain('Toroloom Contract Notes - Parse Results');
    expect(lines).toContain('Filename,zerodha_statement.pdf');
    expect(lines).toContain('Status,Success');
    expect(lines).toContain('Trades Found,2');
    expect(lines).toContain('Broker,Zerodha');
    expect(lines).toContain('Pages,1');
    expect(lines).toContain('Source,Server extraction');
  });

  it('includes trades section with correct headers and data', async () => {
    await exportSingleToCSV(singleSuccessResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;

    expect(csv).toContain('=== TRADES ===');
    expect(csv).toContain('Timestamp,Symbol,Type,Quantity,Price,Fees,Exchange,Trade ID');
    expect(csv).toContain('2024-01-15T10:30:00,RELIANCE,BUY,25,2567.50,45.00,NSE,TXN12345');
    expect(csv).toContain('2024-01-15T11:00:00,TCS,SELL,10,3890.00,12.50,BSE,');
  });

  it('includes raw text reference section', async () => {
    await exportSingleToCSV(singleSuccessResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;

    expect(csv).toContain('=== RAW TEXT ===');
    expect(csv).toContain('CONTRACT NOTE');
    expect(csv).toContain('Zerodha');
    expect(csv).toContain('RELIANCE BUY 25 @ 2567.50');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Error / Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  it('handles failed parse result (no trades)', async () => {
    await exportSingleToCSV(singleFailedResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;
    const lines = csv.split('\n');

    expect(lines).toContain('Filename,corrupted.pdf');
    expect(lines).toContain('Status,Failed');
    expect(lines).toContain('Trades Found,0');
    expect(csv).toContain('Could not extract any text from scanned image');
    expect(csv).not.toContain('Broker,'); // no broker detected
    expect(csv).not.toContain('Pages,'); // no pages

    // Trades section header still present but no data rows
    expect(csv).toContain('=== TRADES ===');
    const tradesSection = csv.split('=== TRADES ===')[1].split('=== RAW TEXT ===')[0];
    const tradeRows = tradesSection.split('\n').filter(l => /^\d{4}-\d{2}-\d{2}T/.test(l));
    expect(tradeRows).toHaveLength(0);
  });

  it('handles result with no broker detected and fallback source', async () => {
    await exportSingleToCSV(singleNoBrokerResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;
    const lines = csv.split('\n');

    expect(lines).toContain('Filename,unknown.pdf');
    expect(lines).toContain('Status,Success');
    expect(lines).toContain('Trades Found,1');
    expect(lines).toContain('Pages,2');
    expect(lines).toContain('Source,Local fallback');
    expect(csv).not.toContain('Broker,'); // no broker
  });

  it('truncates very long raw text to 10k chars', async () => {
    await exportSingleToCSV(singleLongRawTextResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;

    expect(csv).toContain('=== RAW TEXT ===');
    // Should contain first portion
    expect(csv).toContain('x'.repeat(10000)); // first 10k
    // Should have truncation notice
    expect(csv).toContain('original length: 15000 chars');
    // Should NOT contain the full 15000 chars
    expect(csv).not.toContain('x'.repeat(15000));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Error Handling
  // ─────────────────────────────────────────────────────────────────────────

  it('returns error when sharing is not available', async () => {
    mockIsSharingAvailable.mockResolvedValue(false);

    const result = await exportSingleToCSV(singleSuccessResult);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Sharing is not available');
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('returns error when file write fails', async () => {
    mockWriteAsync.mockRejectedValue(new Error('Permission denied'));

    const result = await exportSingleToCSV(singleSuccessResult);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('handles shareAsync rejection', async () => {
    mockShareAsync.mockRejectedValue(new Error('User cancelled'));

    const result = await exportSingleToCSV(singleSuccessResult);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Filename Format
  // ─────────────────────────────────────────────────────────────────────────

  it('uses ContractNote_ prefix for single-file exports', async () => {
    await exportSingleToCSV(singleSuccessResult);

    const writeArgs = mockWriteAsync.mock.calls[0];
    expect(writeArgs[0]).toMatch(
      /ContractNote_\d{4}-\d{2}-\d{2}_[A-Z0-9]+\.csv$/
    );
  });

  it('does not show export button sections if not applicable', async () => {
    await exportSingleToCSV(singleFailedResult);

    const csv = mockWriteAsync.mock.calls[0][1] as string;

    // Broker and pages should not appear
    expect(csv).not.toContain('Broker,');
    expect(csv).not.toContain('Pages,');

    // Error should appear
    expect(csv).toContain('Error,');
    expect(csv).toContain('Could not extract any text from scanned image');
  });
});
