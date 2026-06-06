/**
 * ============================================================================
 * Toroloom — Report Export Service Tests
 * ============================================================================
 *
 * Tests the report export feature:
 *   - exportPDF: generates HTML, converts to PDF via expo-print, shares
 *   - exportCSV: generates CSV text, writes to file via expo-file-system, shares
 *   - HTML template structure (executive summary, performance, tax, holdings)
 *   - CSV formatting (headers, rows, escaping)
 *   - Error handling (sharing unavailable, print failure)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock expo-print ─────────────────────────────────────────
const mockPrintToFile = vi.fn();
vi.mock('expo-print', () => ({
  printToFileAsync: (...args: any[]) => mockPrintToFile(...args),
}));

// ── Mock expo-sharing ───────────────────────────────────────
const mockShareAsync = vi.fn();
const mockIsSharingAvailable = vi.fn();
vi.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockIsSharingAvailable(),
  shareAsync: (...args: any[]) => mockShareAsync(...args),
}));

// ── Mock expo-file-system ───────────────────────────────────
const mockMoveAsync = vi.fn();
const mockWriteAsync = vi.fn();
vi.mock('expo-file-system', () => ({
  cacheDirectory: '/tmp/',
  documentDirectory: '/docs/',
  moveAsync: (...args: any[]) => mockMoveAsync(...args),
  writeAsStringAsync: (...args: any[]) => mockWriteAsync(...args),
  EncodingType: { UTF8: 'utf8' },
}));

// ── Also mock the /legacy subpath — reportExport imports from it ─
// Must match the setup.ts mock but use the test's local vi.fn() refs.
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/tmp/',
  moveAsync: (...args: any[]) => mockMoveAsync(...args),
  writeAsStringAsync: (...args: any[]) => mockWriteAsync(...args),
  EncodingType: { UTF8: 'utf8' },
}));

// ── Import the module under test ────────────────────────────
import { exportPDF, exportCSV } from '../services/reportExport';
import type { PortfolioAnalytics, Holding, Trade } from '../types';

// ==================== Test Fixtures ====================

const mockHoldings: Holding[] = [
  {
    id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.',
    quantity: 50, buyPrice: 2650, currentPrice: 2890.50,
    totalInvested: 132500, currentValue: 144525,
    pnl: 12025, pnlPercent: 9.08,
    dayChange: 2260, dayChangePercent: 1.59,
  },
  {
    id: 'h2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services',
    quantity: 20, buyPrice: 3800, currentPrice: 3890,
    totalInvested: 76000, currentValue: 77800,
    pnl: 1800, pnlPercent: 2.37,
    dayChange: -690, dayChangePercent: -0.88,
  },
];

const mockTrades: Trade[] = [
  { id: 't1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries', type: 'buy', quantity: 50, price: 2650, total: 132500, timestamp: '2025-05-20T09:30:00' },
  { id: 't2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services', type: 'sell', quantity: 10, price: 3920, total: 39200, timestamp: '2025-05-19T14:45:00' },
];

const mockAnalytics: PortfolioAnalytics = {
  metrics: {
    totalReturn: 26715,
    totalReturnPercent: 7.35,
    realizedPnl: 39200,
    unrealizedPnl: -12485,
    dayChange: 1570,
    dayChangePercent: 0.71,
    winRate: 100,
    totalTrades: 2,
    winningTrades: 1,
    losingTrades: 0,
    avgWin: 39200,
    avgLoss: 0,
    profitFactor: 0,
    maxDrawdown: 5000,
    maxDrawdownPercent: 1.37,
    sharpeRatio: 1.25,
    avgHoldingDays: 45,
    bestTrade: 39200,
    worstTrade: 0,
    consecutiveWins: 1,
    consecutiveLosses: 0,
  },
  capitalGains: {
    shortTerm: { gains: 9200, count: 1, taxRate: 15, estimatedTax: 1380 },
    longTerm: { gains: 0, count: 0, taxRate: 10, exemptLimit: 100000, taxableGains: 0, estimatedTax: 0 },
    totalEstimatedTax: 1380,
    sttPaid: 9.20,
    totalBrokerage: 2.76,
  },
  monthlyReturns: [
    { month: '2025-05', startValue: 200000, endValue: 210000, return: 10000, returnPercent: 5.00, contributions: 50000 },
  ],
  sectorAllocation: [
    { sector: 'Energy', value: 144525, percent: 65.0, count: 1 },
    { sector: 'Technology', value: 77800, percent: 35.0, count: 1 },
  ],
  pnlHistory: [
    { date: '2025-05-01', value: 200000, cumulativePnl: -1500 },
    { date: '2025-06-01', value: 222325, cumulativePnl: 20825 },
  ],
};

// ==================== Tests ====================

describe('exportPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrintToFile.mockResolvedValue({ uri: 'file:///tmp/print_output.pdf' });
    mockIsSharingAvailable.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
    mockMoveAsync.mockResolvedValue(undefined);
  });

  it('generates PDF and shares it successfully', async () => {
    const result = await exportPDF(mockAnalytics, mockHoldings, mockTrades, 'Test Investor');

    expect(result.success).toBe(true);
    expect(mockPrintToFile).toHaveBeenCalledTimes(1);

    // Check that HTML was passed to printToFileAsync
    const printArgs = mockPrintToFile.mock.calls[0][0];
    expect(printArgs).toHaveProperty('html');
    expect(printArgs).toHaveProperty('width', 595.28);

    const html = printArgs.html;
    // HTML should contain key report elements
    expect(html).toContain('Toroloom Portfolio Report');
    expect(html).toContain('Test Investor');
    expect(html).toContain('Executive Summary');
    expect(html).toContain('Performance Metrics');
    expect(html).toContain('Tax Summary');
    expect(html).toContain('Current Holdings');
    expect(html).toContain('RELIANCE');
    expect(html).toContain('TCS');

    // Check file operations
    expect(mockMoveAsync).toHaveBeenCalledTimes(1);
    // PDF file should be moved to cache directory with .pdf extension
    const moveArgs = mockMoveAsync.mock.calls[0][0];
    expect(moveArgs.to).toMatch(/Toroloom_Report_.*\.pdf$/);

    // Check sharing
    expect(mockShareAsync).toHaveBeenCalledTimes(1);
    const shareArgs = mockShareAsync.mock.calls[0];
    expect(shareArgs[1]).toEqual({ mimeType: 'application/pdf' });
  });

  it('includes portfolio value and metrics in HTML', async () => {
    await exportPDF(mockAnalytics, mockHoldings, mockTrades);

    const html = mockPrintToFile.mock.calls[0][0].html;

    // Executive summary — non-compact formatCurrency for these
    expect(html).toContain('₹2,22,325.00'); // totalValue = 144525 + 77800
    expect(html).toContain('₹2,08,500.00'); // totalInvested = 132500 + 76000
    expect(html).toContain('7.35%');

    // Performance metrics
    expect(html).toContain('Sharpe Ratio');
    expect(html).toContain('1.25');
    expect(html).toContain('Win Rate');
    expect(html).toContain('100.0%');

    // Tax summary
    expect(html).toContain('STCG Gains');
    expect(html).toContain('15% tax');
    expect(html).toContain('LTCG Gains');

    // Holdings table — compact format
    expect(html).toContain('₹1.45L'); // RELIANCE currentValue compact
    expect(html).toContain('₹77.8K'); // TCS currentValue compact
    expect(html).toContain('50');     // RELIANCE quantity
    expect(html).toContain('20');     // TCS quantity
  });

  it('includes sector allocation and monthly returns in HTML', async () => {
    await exportPDF(mockAnalytics, mockHoldings, mockTrades);

    const html = mockPrintToFile.mock.calls[0][0].html;

    expect(html).toContain('Sector Allocation');
    expect(html).toContain('Energy');
    expect(html).toContain('Technology');
    expect(html).toContain('Monthly Returns');
    expect(html).toContain('May 2025');
  });

  it('includes recent trades table in HTML', async () => {
    await exportPDF(mockAnalytics, mockHoldings, mockTrades);

    const html = mockPrintToFile.mock.calls[0][0].html;

    expect(html).toContain('Recent Trades');
    expect(html).toContain('BUY');
    expect(html).toContain('SELL');
  });

  it('includes user name in report header', async () => {
    await exportPDF(mockAnalytics, mockHoldings, [], 'Rahul Sharma');

    const html = mockPrintToFile.mock.calls[0][0].html;
    expect(html).toContain('Rahul Sharma');
  });

  it('uses default name when userName is not provided', async () => {
    await exportPDF(mockAnalytics, mockHoldings, []);

    const html = mockPrintToFile.mock.calls[0][0].html;
    expect(html).toContain('Investor');
  });

  it('handles empty holdings gracefully', async () => {
    await exportPDF(mockAnalytics, [], [], 'Test');

    const html = mockPrintToFile.mock.calls[0][0].html;
    expect(html).toContain('No holdings');
    expect(html).toContain('start investing');
  });

  it('returns error when sharing is not available', async () => {
    mockIsSharingAvailable.mockResolvedValue(false);

    const result = await exportPDF(mockAnalytics, mockHoldings, mockTrades);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Sharing is not available');
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('returns error when print fails', async () => {
    mockPrintToFile.mockRejectedValue(new Error('Print engine unavailable'));

    const result = await exportPDF(mockAnalytics, mockHoldings, mockTrades);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error with message when shareAsync fails', async () => {
    mockShareAsync.mockRejectedValue(new Error('User cancelled'));

    const result = await exportPDF(mockAnalytics, mockHoldings, mockTrades);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('generates correct filename format (Toroloom_Report_YYYY-MM-DD_XXXXXX.pdf)', async () => {
    await exportPDF(mockAnalytics, mockHoldings, mockTrades);

    const moveArgs = mockMoveAsync.mock.calls[0][0];
    expect(moveArgs.to).toMatch(/Toroloom_Report_\d{4}-\d{2}-\d{2}_[A-Z0-9]+\.pdf$/);
  });
});

describe('exportCSV', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSharingAvailable.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
    mockWriteAsync.mockResolvedValue(undefined);
  });

  it('generates CSV and shares it successfully', async () => {
    const result = await exportCSV(mockAnalytics, mockHoldings, mockTrades);

    expect(result.success).toBe(true);
    expect(mockWriteAsync).toHaveBeenCalledTimes(1);

    // Check CSV content
    const csvArgs = mockWriteAsync.mock.calls[0];
    const csv = csvArgs[1] as string;
    expect(csv).toContain('Toroloom Portfolio Report');
    expect(csv).toContain('EXECUTIVE SUMMARY');
    expect(csv).toContain('CURRENT HOLDINGS');
    expect(csv).toContain('TRADE HISTORY');

    // Check file path
    expect(csvArgs[0]).toMatch(/Toroloom_Report_.*\.csv$/);

    // Check encoding
    expect(csvArgs[2]).toEqual({ encoding: 'utf8' });

    // Check sharing
    expect(mockShareAsync).toHaveBeenCalledTimes(1);
    const shareArgs = mockShareAsync.mock.calls[0];
    expect(shareArgs[1]).toEqual({ mimeType: 'text/csv' });
  });

  it('includes all data sections in CSV', async () => {
    await exportCSV(mockAnalytics, mockHoldings, mockTrades);

    const csv = mockWriteAsync.mock.calls[0][1] as string;

    // Sections
    expect(csv).toContain('=== EXECUTIVE SUMMARY ===');
    expect(csv).toContain('=== TAX SUMMARY (FY 2025-26) ===');
    expect(csv).toContain('=== CURRENT HOLDINGS ===');
    expect(csv).toContain('=== SECTOR ALLOCATION ===');
    expect(csv).toContain('=== MONTHLY RETURNS ===');
    expect(csv).toContain('=== TRADE HISTORY ===');

    // Metrics
    expect(csv).toContain('Portfolio Value');
    expect(csv).toContain('Sharpe Ratio');
    expect(csv).toContain('Win Rate');

    // Holdings
    expect(csv).toContain('RELIANCE');
    expect(csv).toContain('TCS');

    // Trades
    expect(csv).toContain('BUY');
    expect(csv).toContain('SELL');
  });

  it('properly escapes CSV fields with commas', async () => {
    const holdingWithComma: Holding[] = [{
      id: 'h_c', stockId: 'TEST', symbol: 'TEST', name: 'Test, Inc.',
      quantity: 10, buyPrice: 100, currentPrice: 110,
      totalInvested: 1000, currentValue: 1100,
      pnl: 100, pnlPercent: 10,
      dayChange: 5, dayChangePercent: 0.5,
    }];

    await exportCSV(mockAnalytics, holdingWithComma, []);

    const csv = mockWriteAsync.mock.calls[0][1] as string;
    // The name "Test, Inc." should be quoted
    expect(csv).toContain('"Test, Inc."');
  });

  it('handles empty holdings in CSV', async () => {
    await exportCSV(mockAnalytics, [], []);

    const csv = mockWriteAsync.mock.calls[0][1] as string;
    // Holdings section should exist but with only headers
    expect(csv).toContain('=== CURRENT HOLDINGS ===');
    expect(csv).toContain('Symbol');
    expect(csv).toContain('Name');
  });

  it('returns error when sharing is not available', async () => {
    mockIsSharingAvailable.mockResolvedValue(false);

    const result = await exportCSV(mockAnalytics, mockHoldings, mockTrades);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Sharing is not available');
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('returns error when write fails', async () => {
    mockWriteAsync.mockRejectedValue(new Error('Disk full'));

    const result = await exportCSV(mockAnalytics, mockHoldings, mockTrades);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('generates correct filename format (Toroloom_Report_YYYY-MM-DD_XXXXXX.csv)', async () => {
    await exportCSV(mockAnalytics, mockHoldings, mockTrades);

    const writeArgs = mockWriteAsync.mock.calls[0];
    expect(writeArgs[0]).toMatch(/Toroloom_Report_\d{4}-\d{2}-\d{2}_[A-Z0-9]+\.csv$/);
  });
});
