/**
 * ============================================================================
 * Toroloom — Report Export Service
 * ============================================================================
 *
 * Generates portfolio reports in PDF (via expo-print) and CSV formats,
 * then shares them via the OS share sheet (expo-sharing).
 *
 * Usage:
 *   import { exportPDF, exportCSV } from '../../services/reportExport';
 *
 *   // PDF
 *   await exportPDF(analytics, holdings, trades, userName);
 *
 *   // CSV
 *   await exportCSV(analytics, holdings, trades);
 *
 * ============================================================================
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, moveAsync, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import type { PortfolioAnalytics, Holding, Trade } from '../types';
import { formatCurrency, formatPercent, formatNumber } from '../utils/formatters';

// ==================== Types ====================

export type ExportFormat = 'pdf' | 'csv';

export interface ExportResult {
  success: boolean;
  path?: string;
  error?: string;
}

// ==================== Helpers ====================

/** Format date to locale string */
function fmtDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/** Get current date for the report header */
function today(): string {
  return new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Escape CSV field (wrap in quotes if contains comma, quote, or newline) */
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

// ==================== HTML Template for PDF ====================

function buildHTML(
  analytics: PortfolioAnalytics,
  holdings: Holding[],
  trades: Trade[],
  userName: string,
): string {
  const m = analytics.metrics;
  const cg = analytics.capitalGains;
  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalInvested = holdings.reduce((s, h) => s + h.totalInvested, 0);

  // Holdings table rows
  const holdingRows = holdings.map(h => `
    <tr>
      <td>${h.symbol}</td>
      <td>${h.name}</td>
      <td>${h.quantity}</td>
      <td>${formatCurrency(h.buyPrice)}</td>
      <td>${formatCurrency(h.currentPrice)}</td>
      <td>${formatCurrency(h.currentValue, true)}</td>
      <td class="${h.pnl >= 0 ? 'green' : 'red'}">${h.pnl >= 0 ? '+' : ''}${formatCurrency(h.pnl, true)}</td>
      <td class="${h.pnl >= 0 ? 'green' : 'red'}">${h.pnl >= 0 ? '+' : ''}${h.pnlPercent.toFixed(2)}%</td>
    </tr>
  `).join('');

  // Recent trades rows
  const tradeRows = trades.slice(0, 20).map(t => `
    <tr>
      <td>${fmtDate(t.timestamp)}</td>
      <td>${t.symbol}</td>
      <td class="${t.type === 'buy' ? 'blue' : 'orange'}">${t.type.toUpperCase()}</td>
      <td>${t.quantity}</td>
      <td>${formatCurrency(t.price)}</td>
      <td>${formatCurrency(t.total, true)}</td>
    </tr>
  `).join('');

  // Monthly returns rows
  const monthlyRows = analytics.monthlyReturns.slice(-6).map(mr => {
    const monthLabel = new Date(mr.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    return `
      <tr>
        <td>${monthLabel}</td>
        <td>${formatCurrency(mr.startValue, true)}</td>
        <td>${formatCurrency(mr.endValue, true)}</td>
        <td class="${mr.return >= 0 ? 'green' : 'red'}">${mr.return >= 0 ? '+' : ''}${formatCurrency(mr.return, true)}</td>
        <td class="${mr.returnPercent >= 0 ? 'green' : 'red'}">${mr.returnPercent >= 0 ? '+' : ''}${mr.returnPercent.toFixed(2)}%</td>
      </tr>
    `;
  }).join('');

  // Sector allocation rows
  const sectorRows = analytics.sectorAllocation.map(s => `
    <tr>
      <td>${s.sector}</td>
      <td>${s.count}</td>
      <td>${formatCurrency(s.value, true)}</td>
      <td>${s.percent.toFixed(1)}%</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 15mm 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      color: #1A1A2E;
      line-height: 1.5;
    }
    .header {
      text-align: center;
      padding: 20px 0 15px;
      border-bottom: 3px solid #6C63FF;
      margin-bottom: 20px;
    }
    .header h1 { font-size: 22px; color: #6C63FF; margin-bottom: 4px; }
    .header .sub { font-size: 12px; color: #6E6E9A; }
    .section { margin-bottom: 18px; }
    .section-title {
      font-size: 14px; font-weight: 700; color: #6C63FF;
      padding-bottom: 4px; border-bottom: 1px solid #E0E0F0;
      margin-bottom: 8px;
    }
    .summary-grid {
      display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
    }
    .summary-card {
      flex: 1; min-width: 120px;
      padding: 10px; border-radius: 8px;
      background: #F4F5FA; border: 1px solid #E0E0F0;
    }
    .summary-card .label { font-size: 10px; color: #6E6E9A; }
    .summary-card .value { font-size: 16px; font-weight: 700; margin-top: 2px; }
    table {
      width: 100%; border-collapse: collapse; font-size: 10px;
    }
    th {
      background: #6C63FF; color: white; padding: 6px 8px;
      text-align: left; font-weight: 600;
    }
    td { padding: 5px 8px; border-bottom: 1px solid #E0E0F0; }
    tr:nth-child(even) { background: #F4F5FA; }
    .green { color: #00C853; font-weight: 600; }
    .red { color: #FF1744; font-weight: 600; }
    .blue { color: #6C63FF; font-weight: 600; }
    .orange { color: #FF9800; font-weight: 600; }
    .footer {
      text-align: center; font-size: 9px; color: #9A9AB0;
      padding-top: 15px; border-top: 1px solid #E0E0F0;
      margin-top: 20px;
    }
    .two-col {
      display: flex; gap: 12px; margin-bottom: 10px;
    }
    .two-col > div { flex: 1; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Toroloom Portfolio Report</h1>
    <div class="sub">${userName} · Generated on ${today()}</div>
  </div>

  <!-- ── Executive Summary ── -->
  <div class="section">
    <div class="section-title">Executive Summary</div>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">Portfolio Value</div>
        <div class="value">${formatCurrency(totalValue)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Total Invested</div>
        <div class="value">${formatCurrency(totalInvested)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Total Return</div>
        <div class="value" style="color:${m.totalReturn >= 0 ? '#00C853' : '#FF1744'}">${m.totalReturnPercent.toFixed(2)}%</div>
      </div>
      <div class="summary-card">
        <div class="label">P&L</div>
        <div class="value" style="color:${m.totalReturn >= 0 ? '#00C853' : '#FF1744'}">${formatCurrency(m.totalReturn, true)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Day Change</div>
        <div class="value" style="color:${m.dayChange >= 0 ? '#00C853' : '#FF1744'}">${formatCurrency(m.dayChange, true)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Win Rate</div>
        <div class="value">${m.winRate.toFixed(1)}%</div>
      </div>
    </div>
  </div>

  <!-- ── Performance Metrics ── -->
  <div class="section">
    <div class="section-title">Performance Metrics</div>
    <div class="two-col">
      <div>
        <table>
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Sharpe Ratio</td><td>${m.sharpeRatio.toFixed(2)}</td></tr>
          <tr><td>Max Drawdown</td><td class="red">${formatPercent(m.maxDrawdownPercent)}</td></tr>
          <tr><td>Profit Factor</td><td>${m.profitFactor.toFixed(2)}</td></tr>
          <tr><td>Avg Holding Period</td><td>${m.avgHoldingDays} days</td></tr>
          <tr><td>Total Trades</td><td>${m.totalTrades}</td></tr>
          <tr><td>Winning Trades</td><td class="green">${m.winningTrades}</td></tr>
          <tr><td>Losing Trades</td><td class="red">${m.losingTrades}</td></tr>
        </table>
      </div>
      <div>
        <table>
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Realized P&L</td><td class="${m.realizedPnl >= 0 ? 'green' : 'red'}">${formatCurrency(m.realizedPnl, true)}</td></tr>
          <tr><td>Unrealized P&L</td><td class="${m.unrealizedPnl >= 0 ? 'green' : 'red'}">${formatCurrency(m.unrealizedPnl, true)}</td></tr>
          <tr><td>Avg Win</td><td class="green">${formatCurrency(m.avgWin, true)}</td></tr>
          <tr><td>Avg Loss</td><td class="red">${formatCurrency(m.avgLoss, true)}</td></tr>
          <tr><td>Best Trade</td><td class="green">${formatCurrency(m.bestTrade, true)}</td></tr>
          <tr><td>Worst Trade</td><td class="red">${formatCurrency(m.worstTrade, true)}</td></tr>
          <tr><td>Consecutive Wins / Losses</td><td>${m.consecutiveWins} / ${m.consecutiveLosses}</td></tr>
        </table>
      </div>
    </div>
  </div>

  <!-- ── Tax Summary ── -->
  <div class="section">
    <div class="section-title">Tax Summary (FY 2025-26)</div>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">STCG Gains (≤12 months)</div>
        <div class="value">${formatCurrency(cg.shortTerm.gains, true)}</div>
        <div style="font-size:9px;color:#6E6E9A">${cg.shortTerm.count} trades · ${cg.shortTerm.taxRate}% tax</div>
      </div>
      <div class="summary-card">
        <div class="label">LTCG Gains (&gt;12 months)</div>
        <div class="value">${formatCurrency(cg.longTerm.gains, true)}</div>
        <div style="font-size:9px;color:#6E6E9A">${cg.longTerm.count} trades · ${cg.longTerm.taxRate}% tax above ₹1L</div>
      </div>
      <div class="summary-card">
        <div class="label">Estimated Tax</div>
        <div class="value">${formatCurrency(cg.totalEstimatedTax, true)}</div>
        <div style="font-size:9px;color:#6E6E9A">STT: ${formatCurrency(cg.sttPaid, true)} · Brokerage: ${formatCurrency(cg.totalBrokerage, true)}</div>
      </div>
    </div>
  </div>

  <!-- ── Holdings ── -->
  <div class="section">
    <div class="section-title">Current Holdings (${holdings.length})</div>
    ${holdings.length > 0 ? `
    <table>
      <tr><th>Symbol</th><th>Name</th><th>Qty</th><th>Avg Price</th><th>LTP</th><th>Value</th><th>P&L</th><th>Return</th></tr>
      ${holdingRows}
      <tr style="font-weight:700;background:#E8EAF0">
        <td colspan="3"><strong>Total</strong></td>
        <td></td><td></td>
        <td>${formatCurrency(totalValue, true)}</td>
        <td class="${m.totalReturn >= 0 ? 'green' : 'red'}">${formatCurrency(m.totalReturn, true)}</td>
        <td class="${m.totalReturn >= 0 ? 'green' : 'red'}">${m.totalReturnPercent.toFixed(2)}%</td>
      </tr>
    </table>
    ` : '<p style="color:#9A9AB0">No holdings — start investing to see them here.</p>'}
  </div>

  <!-- ── Sector Allocation ── -->
  ${analytics.sectorAllocation.length > 0 ? `
  <div class="section">
    <div class="section-title">Sector Allocation</div>
    <table>
      <tr><th>Sector</th><th>Holdings</th><th>Value</th><th>Allocation</th></tr>
      ${sectorRows}
    </table>
  </div>
  ` : ''}

  <!-- ── Monthly Returns ── -->
  ${analytics.monthlyReturns.length > 0 ? `
  <div class="section">
    <div class="section-title">Monthly Returns (Last 6)</div>
    <table>
      <tr><th>Month</th><th>Start Value</th><th>End Value</th><th>Return</th><th>Return %</th></tr>
      ${monthlyRows}
    </table>
  </div>
  ` : ''}

  <!-- ── Recent Trades ── -->
  ${trades.length > 0 ? `
  <div class="section">
    <div class="section-title">Recent Trades</div>
    <table>
      <tr><th>Date</th><th>Symbol</th><th>Type</th><th>Qty</th><th>Price</th><th>Total</th></tr>
      ${tradeRows}
    </table>
    ${trades.length > 20 ? `<p style="font-size:9px;color:#9A9AB0;margin-top:4px">Showing last 20 of ${trades.length} trades</p>` : ''}
  </div>
  ` : ''}

  <div class="footer">
    Toroloom — AI-powered trading &amp; investment platform<br>
    Report generated on ${today()} · Data is for informational purposes only.
  </div>
</body>
</html>`;
}

// ==================== CSV Builder ====================

function buildCSV(
  analytics: PortfolioAnalytics,
  holdings: Holding[],
  trades: Trade[],
): string {
  const m = analytics.metrics;
  const cg = analytics.capitalGains;
  let csv = '';

  // ── Header ──
  csv += 'Toroloom Portfolio Report\n';
  csv += `Generated,${today()}\n\n`;

  // ── Executive Summary ──
  csv += '=== EXECUTIVE SUMMARY ===\n';
  csv += csvRow('Metric', 'Value');
  csv += csvRow('Portfolio Value', formatCurrency(holdings.reduce((s, h) => s + h.currentValue, 0)));
  csv += csvRow('Total Invested', formatCurrency(holdings.reduce((s, h) => s + h.totalInvested, 0)));
  csv += csvRow('Total Return', formatPercent(m.totalReturnPercent));
  csv += csvRow('P&L', formatCurrency(m.totalReturn, true));
  csv += csvRow('Day Change', formatCurrency(m.dayChange, true));
  csv += csvRow('Win Rate', `${m.winRate.toFixed(1)}%`);
  csv += csvRow('Sharpe Ratio', m.sharpeRatio.toFixed(2));
  csv += csvRow('Max Drawdown', formatPercent(m.maxDrawdownPercent));
  csv += csvRow('Profit Factor', m.profitFactor.toFixed(2));
  csv += csvRow('Avg Holding Period', `${m.avgHoldingDays} days`);
  csv += csvRow('Total Trades', m.totalTrades);
  csv += csvRow('Winning Trades', m.winningTrades);
  csv += csvRow('Losing Trades', m.losingTrades);
  csv += csvRow('Realized P&L', formatCurrency(m.realizedPnl, true));
  csv += csvRow('Unrealized P&L', formatCurrency(m.unrealizedPnl, true));
  csv += csvRow('Avg Win', formatCurrency(m.avgWin, true));
  csv += csvRow('Avg Loss', formatCurrency(m.avgLoss, true));
  csv += '\n';

  // ── Tax Summary ──
  csv += '=== TAX SUMMARY (FY 2025-26) ===\n';
  csv += csvRow('Category', 'Gains', 'Trades', 'Tax Rate', 'Est. Tax');
  csv += csvRow('STCG (≤12 months)', formatCurrency(cg.shortTerm.gains, true), cg.shortTerm.count, `${cg.shortTerm.taxRate}%`, formatCurrency(cg.shortTerm.estimatedTax, true));
  csv += csvRow('LTCG (>12 months)', formatCurrency(cg.longTerm.gains, true), cg.longTerm.count, `${cg.longTerm.taxRate}%`, formatCurrency(cg.longTerm.estimatedTax, true));
  csv += csvRow('Total Est. Tax', '', '', '', formatCurrency(cg.totalEstimatedTax, true));
  csv += csvRow('STT Paid', formatCurrency(cg.sttPaid, true));
  csv += csvRow('Brokerage Paid', formatCurrency(cg.totalBrokerage, true));
  csv += '\n';

  // ── Holdings ──
  csv += '=== CURRENT HOLDINGS ===\n';
  csv += csvRow('Symbol', 'Name', 'Quantity', 'Avg Price', 'LTP', 'Value', 'P&L', 'Return %');
  for (const h of holdings) {
    csv += csvRow(h.symbol, h.name, h.quantity, formatCurrency(h.buyPrice), formatCurrency(h.currentPrice), formatCurrency(h.currentValue, true), formatCurrency(h.pnl, true), `${h.pnlPercent.toFixed(2)}%`);
  }
  csv += '\n';

  // ── Sector Allocation ──
  if (analytics.sectorAllocation.length > 0) {
    csv += '=== SECTOR ALLOCATION ===\n';
    csv += csvRow('Sector', 'Holdings', 'Value', 'Allocation %');
    for (const s of analytics.sectorAllocation) {
      csv += csvRow(s.sector, s.count, formatCurrency(s.value, true), `${s.percent.toFixed(1)}%`);
    }
    csv += '\n';
  }

  // ── Monthly Returns ──
  if (analytics.monthlyReturns.length > 0) {
    csv += '=== MONTHLY RETURNS ===\n';
    csv += csvRow('Month', 'Start Value', 'End Value', 'Return', 'Return %');
    for (const mr of analytics.monthlyReturns.slice(-6)) {
      const monthLabel = new Date(mr.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      csv += csvRow(monthLabel, formatCurrency(mr.startValue, true), formatCurrency(mr.endValue, true), formatCurrency(mr.return, true), `${mr.returnPercent.toFixed(2)}%`);
    }
    csv += '\n';
  }

  // ── Trade History ──
  csv += '=== TRADE HISTORY ===\n';
  csv += csvRow('Date', 'Symbol', 'Type', 'Quantity', 'Price', 'Total');
  for (const t of trades) {
    csv += csvRow(fmtDate(t.timestamp), t.symbol, t.type.toUpperCase(), t.quantity, formatCurrency(t.price), formatCurrency(t.total, true));
  }

  return csv;
}

// ==================== File Helpers ====================

/** Generate a unique filename with timestamp */
function generateFilename(extension: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const time = Date.now().toString(36).slice(-6).toUpperCase();
  return `Toroloom_Report_${date}_${time}.${extension}`;
}

/** Share a file via the OS share sheet */
async function shareFile(filePath: string, mimeType: string): Promise<ExportResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { success: false, error: 'Sharing is not available on this device' };
    }
    await Sharing.shareAsync(filePath, { mimeType });
    return { success: true, path: filePath };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error sharing file';
    return { success: false, error: msg };
  }
}

// ==================== Public API ====================

/**
 * Export portfolio report as PDF.
 * Generates HTML, converts to PDF via expo-print, then shares.
 */
export async function exportPDF(
  analytics: PortfolioAnalytics,
  holdings: Holding[],
  trades: Trade[],
  userName: string = 'Investor',
): Promise<ExportResult> {
  try {
    const html = buildHTML(analytics, holdings, trades, userName);
    const { uri } = await Print.printToFileAsync({ html, width: 595.28 }); // A4 width in points
    const filename = generateFilename('pdf');
    const dest = `${cacheDirectory ?? '.'}/${filename}`;

    // Move to a more accessible location
    await moveAsync({ from: uri, to: dest });

    return await shareFile(dest, 'application/pdf');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error generating PDF';
    return { success: false, error: msg };
  }
}

/**
 * Export portfolio report as CSV.
 * Generates CSV text, writes to file, then shares.
 */
export async function exportCSV(
  analytics: PortfolioAnalytics,
  holdings: Holding[],
  trades: Trade[],
): Promise<ExportResult> {
  try {
    const csv = buildCSV(analytics, holdings, trades);
    const filename = generateFilename('csv');
    const filePath = `${cacheDirectory ?? '.'}/${filename}`;

    await writeAsStringAsync(filePath, csv, {
      encoding: EncodingType.UTF8,
    });

    return await shareFile(filePath, 'text/csv');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error generating CSV';
    return { success: false, error: msg };
  }
}
