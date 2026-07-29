/**
 * ============================================================================
 * Toroloom — Period Report PDF Generator
 * ============================================================================
 *
 * Generates a full Period Report as an HTML string that can be converted
 * to PDF via expo-print. Covers:
 *   - Executive Summary (P&L, Return, metrics)
 *   - P&L Details (realized/unrealized, best/worst trade)
 *   - Tax Summary (STCG, LTCG, estimated tax)
 *   - Behavioral Insights (overtrading/brokerage/concentration alerts)
 *   - Period Breakdown (per-period P&L)
 *   - Loss Breakdown by Sector
 *   - Sector-wise Trade Metrics
 *   - Holdings table
 *
 * Usage:
 *   import { buildPeriodReportHTML } from '../../utils/periodReportPDF';
 *   const html = buildPeriodReportHTML(metrics, cg, losers, metrics, periods, summary, 'Monthly', holdings);
 *
 * ============================================================================
 */

import { formatCurrency, formatPercent } from './formatters';
import type { Holding } from '../types';

// ──── Sector Color Map ──────────────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
  Technology: '#3B82F6',
  Banking: '#8B5CF6',
  Energy: '#FFAB40',
  'Consumer Goods': '#10B981',
  'Financial Services': '#06B6D4',
  Automobile: '#F59E0B',
  Pharmaceuticals: '#EC4899',
  Telecom: '#6366F1',
  Healthcare: '#14B8A6',
  'Metals & Mining': '#F97316',
  'Cement & Construction': '#A78BFA',
  Infrastructure: '#0EA5E9',
  Conglomerate: '#8B8B8B',
  Other: '#64748B',
};

export function getSectorColor(sector: string): string {
  return SECTOR_COLORS[sector] || '#64748B';
}

// ──── Date Helpers ──────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ──── HTML Builder ──────────────────────────────────────────────────────────

/**
 * Build a full Period Report HTML document for PDF export.
 * Each section only renders when its data array is non-empty.
 */
export function buildPeriodReportHTML(
  metrics: {
    totalReturn: number;
    totalReturnPercent: number;
    dayChange: number;
    winRate: number;
    totalTrades: number;
    sharpeRatio: number;
    maxDrawdownPercent: number;
    realizedPnl: number;
    unrealizedPnl: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    avgHoldingDays: number;
    bestTrade: number;
    worstTrade: number;
    winningTrades: number;
    losingTrades: number;
  },
  capitalGains: {
    shortTerm: { gains: number; count: number; taxRate: number; estimatedTax: number };
    longTerm: { gains: number; count: number; taxRate: number; estimatedTax: number };
    totalEstimatedTax: number;
    sttPaid: number;
    totalBrokerage: number;
  },
  sectorLosers: { sector: string; totalLoss: number; totalLossPercent: number; stocks: Holding[] }[],
  sectorMetrics: { sector: string; totalTrades: number; totalWins: number; totalLosses: number; avgWin: number; avgLoss: number; profitFactor: number }[],
  periods: { label: string; pnl: number; trades: number; winners: number; losers: number }[],
  cognitiveSummary: any | null,
  periodLabel: string,
  holdings: Holding[],
): string {
  const m = metrics;
  const cg = capitalGains;

  // ── Sector loss expanded rows ───────────────────────────────
  const lossSectorRows = sectorLosers.map(g => `
    <div class="loss-sector">
      <div class="loss-sector-header">
        <span class="sector-dot" style="background:${getSectorColor(g.sector)}"></span>
        <span class="loss-sector-name">${g.sector}</span>
        <span class="loss-sector-count">${g.stocks.length} holding${g.stocks.length > 1 ? 's' : ''}</span>
        <span class="loss-sector-amt red">${formatCurrency(g.totalLoss, true)}</span>
        <span class="loss-sector-pct red">${formatPercent(g.totalLossPercent)}</span>
      </div>
      ${g.stocks.map(h => `
        <div class="loss-stock-row">
          <span class="loss-stock-symbol">${h.symbol}</span>
          <span class="loss-stock-name">${h.name}</span>
          <span class="red">${formatCurrency(h.pnl, true)}</span>
          <span class="red">${formatPercent(h.pnlPercent)}</span>
        </div>
      `).join('')}
    </div>
  `).join('');

  // ── Sector metrics rows ────────────────────────────────────
  const sectorMetricRows = sectorMetrics.map(sm => `
    <tr>
      <td><span class="sector-dot" style="background:${getSectorColor(sm.sector)}"></span>${sm.sector}</td>
      <td>${sm.totalTrades}</td>
      <td class="green">${sm.totalWins}</td>
      <td class="red">${sm.totalLosses}</td>
      <td class="green">${formatCurrency(sm.avgWin, true)}</td>
      <td class="red">${formatCurrency(sm.avgLoss, true)}</td>
      <td class="${sm.profitFactor >= 2 ? 'green' : sm.profitFactor >= 1 ? 'orange' : 'red'}">${sm.profitFactor >= 99 ? '∞' : sm.profitFactor.toFixed(1)}</td>
    </tr>
  `).join('');

  // ── Period breakdown rows ──────────────────────────────────
  const periodRows = periods.slice(0, 12).map(p => `
    <tr>
      <td>${p.label}</td>
      <td class="${p.pnl >= 0 ? 'green' : 'red'}">${p.pnl >= 0 ? '+' : ''}${formatCurrency(p.pnl, true)}</td>
      <td>${p.trades}</td>
      <td class="green">${p.winners}</td>
      <td class="red">${p.losers}</td>
    </tr>
  `).join('');

  // ── Alert blocks ───────────────────────────────────────────
  let alertHTML = '';
  if (cognitiveSummary) {
    if (cognitiveSummary.overTradingAlert?.flag) {
      alertHTML += `<div class="alert alert-danger"><strong>⚠ Over-Trading Alert</strong> — ${cognitiveSummary.overTradingAlert.message || 'Daily trade count exceeds recommended limit'}</div>`;
    }
    if (cognitiveSummary.brokerageLeakageAlert?.flag) {
      alertHTML += `<div class="alert alert-warning"><strong>💰 Brokerage Leakage</strong> — ${cognitiveSummary.brokerageLeakageAlert.message || 'Charges consuming significant portion of P&L'}</div>`;
    }
    if (cognitiveSummary.concentrationRiskAlert?.flag) {
      alertHTML += `<div class="alert alert-warning"><strong>📊 Concentration Risk</strong> — ${cognitiveSummary.concentrationRiskAlert.message || 'Portfolio over-concentrated in one sector'}</div>`;
    }
    if (cognitiveSummary.behavioralCritique) {
      alertHTML += `<div class="alert alert-info"><strong>💡 Critique</strong> — ${cognitiveSummary.behavioralCritique}</div>`;
    }
    if (!alertHTML) {
      alertHTML = '<div class="alert alert-ok"><strong>✅ No behavioral alerts</strong> — Balanced trading</div>';
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 12mm 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', 'Segoe UI', Roboto, sans-serif;
      font-size: 10px;
      color: #1A1A2E;
      line-height: 1.5;
    }
    .header { text-align: center; padding: 14px 0 10px; border-bottom: 3px solid #6C63FF; margin-bottom: 14px; }
    .header h1 { font-size: 18px; color: #6C63FF; margin-bottom: 2px; }
    .header .sub { font-size: 10px; color: #6E6E9A; }
    .header .period-badge { display: inline-block; margin-top: 4px; padding: 2px 10px; background: #6C63FF15; color: #6C63FF; border-radius: 12px; font-size: 9px; font-weight: 700; }
    .section { margin-bottom: 14px; }
    .section-title { font-size: 12px; font-weight: 700; color: #6C63FF; padding-bottom: 3px; border-bottom: 1px solid #E0E0F0; margin-bottom: 6px; }
    .summary-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .summary-card { flex: 1; min-width: 110px; padding: 8px; border-radius: 6px; background: #F4F5FA; border: 1px solid #E0E0F0; }
    .summary-card .label { font-size: 8px; color: #6E6E9A; }
    .summary-card .value { font-size: 14px; font-weight: 700; margin-top: 1px; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 8px; }
    th { background: #6C63FF; color: white; padding: 4px 6px; text-align: left; font-weight: 600; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 3px 6px; border-bottom: 1px solid #E0E0F0; }
    tr:nth-child(even) { background: #F4F5FA; }
    .green { color: #00C853; font-weight: 600; }
    .red { color: #FF1744; font-weight: 600; }
    .orange { color: #FF9800; font-weight: 600; }
    .footer { text-align: center; font-size: 8px; color: #9A9AB0; padding-top: 10px; border-top: 1px solid #E0E0F0; margin-top: 14px; }
    .two-col { display: flex; gap: 10px; }
    .two-col > div { flex: 1; }
    .alert { padding: 6px 8px; border-radius: 4px; margin-bottom: 4px; font-size: 9px; border-left: 3px solid; }
    .alert-danger { background: #FF174408; border-color: #FF1744; }
    .alert-warning { background: #FF980008; border-color: #FF9800; }
    .alert-info { background: #6C63FF08; border-color: #6C63FF; }
    .alert-ok { background: #00C85308; border-color: #00C853; color: #00C853; }
    .sector-dot { display: inline-block; width: 7px; height: 7px; border-radius: 4px; margin-right: 4px; vertical-align: middle; }
    .loss-sector { margin-bottom: 6px; padding: 4px 6px; background: #FFF0F0; border-radius: 4px; border-left: 3px solid #FF1744; }
    .loss-sector-header { display: flex; align-items: center; gap: 6px; font-size: 9px; }
    .loss-sector-name { flex: 1; font-weight: 700; }
    .loss-sector-count { color: #6E6E9A; font-size: 8px; }
    .loss-sector-amt { min-width: 60px; text-align: right; }
    .loss-sector-pct { min-width: 40px; text-align: right; }
    .loss-stock-row { display: flex; align-items: center; gap: 6px; padding: 2px 0 2px 20px; font-size: 9px; }
    .loss-stock-symbol { font-weight: 600; width: 60px; }
    .loss-stock-name { flex: 1; color: #6E6E9A; font-size: 8px; }
    .tax-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; border-bottom: 1px solid #F0F0F8; font-size: 9px; }
    .tax-row .tax-label { color: #6E6E9A; }
    .tax-row .tax-value { font-weight: 600; }
    .tax-total { display: flex; justify-content: space-between; padding: 5px 0; font-weight: 700; font-size: 11px; border-top: 2px solid #E0E0F0; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Toroloom Period Report</h1>
    <div class="sub">Generated on ${todayStr()}</div>
    <div class="period-badge">${periodLabel}</div>
  </div>

  <!-- ── Executive Summary ── -->
  <div class="section">
    <div class="section-title">Executive Summary</div>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">Total P&amp;L</div>
        <div class="value" style="color:${m.totalReturn >= 0 ? '#00C853' : '#FF1744'}">${m.totalReturn >= 0 ? '+' : ''}${formatCurrency(m.totalReturn)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Period Return</div>
        <div class="value" style="color:${m.totalReturnPercent >= 0 ? '#00C853' : '#FF1744'}">${formatPercent(m.totalReturnPercent)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Win Rate</div>
        <div class="value">${m.winRate.toFixed(1)}%</div>
      </div>
      <div class="summary-card">
        <div class="label">Total Trades</div>
        <div class="value">${m.totalTrades}</div>
      </div>
      <div class="summary-card">
        <div class="label">Sharpe Ratio</div>
        <div class="value">${m.sharpeRatio.toFixed(1)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Max Drawdown</div>
        <div class="value" style="color:#FF1744">${formatPercent(m.maxDrawdownPercent)}</div>
      </div>
    </div>
  </div>

  <!-- ── P&L Details ── -->
  <div class="section">
    <div class="section-title">P&amp;L Details</div>
    <div class="two-col">
      <div>
        <table>
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Realized P&amp;L</td><td class="${m.realizedPnl >= 0 ? 'green' : 'red'}">${formatCurrency(m.realizedPnl, true)}</td></tr>
          <tr><td>Unrealized P&amp;L</td><td class="${m.unrealizedPnl >= 0 ? 'green' : 'red'}">${formatCurrency(m.unrealizedPnl, true)}</td></tr>
          <tr><td>Day Change</td><td class="${m.dayChange >= 0 ? 'green' : 'red'}">${formatCurrency(m.dayChange, true)}</td></tr>
          <tr><td>Best Trade</td><td class="green">${formatCurrency(m.bestTrade, true)}</td></tr>
          <tr><td>Worst Trade</td><td class="red">${formatCurrency(Math.abs(m.worstTrade), true)}</td></tr>
        </table>
      </div>
      <div>
        <table>
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Avg Win</td><td class="green">${formatCurrency(m.avgWin, true)}</td></tr>
          <tr><td>Avg Loss</td><td class="red">${formatCurrency(m.avgLoss, true)}</td></tr>
          <tr><td>Profit Factor</td><td class="${m.profitFactor >= 2 ? 'green' : m.profitFactor >= 1 ? 'orange' : 'red'}">${m.profitFactor.toFixed(2)}</td></tr>
          <tr><td>Avg Holding Days</td><td>${m.avgHoldingDays} days</td></tr>
          <tr><td>Winning Trades</td><td class="green">${m.winningTrades}</td></tr>
          <tr><td>Losing Trades</td><td class="red">${m.losingTrades}</td></tr>
        </table>
      </div>
    </div>
  </div>

  <!-- ── Tax Summary ── -->
  <div class="section">
    <div class="section-title">Tax Summary</div>
    <div class="tax-row">
      <span class="tax-label">STCG (${cg.shortTerm.taxRate}%) — ${cg.shortTerm.count} trades</span>
      <span class="tax-value green">${formatCurrency(cg.shortTerm.gains, true)}</span>
      <span style="font-size:8px;color:#6E6E9A">Est. Tax: ${formatCurrency(cg.shortTerm.estimatedTax, true)}</span>
    </div>
    <div class="tax-row">
      <span class="tax-label">LTCG (${cg.longTerm.taxRate}%) — ${cg.longTerm.count} trades</span>
      <span class="tax-value green">${formatCurrency(cg.longTerm.gains, true)}</span>
      <span style="font-size:8px;color:#6E6E9A">Est. Tax: ${formatCurrency(cg.longTerm.estimatedTax, true)}</span>
    </div>
    <div class="tax-total">
      <span>Estimated Tax</span>
      <span style="color:${cg.totalEstimatedTax > 0 ? '#FF9800' : '#00C853'}">${formatCurrency(cg.totalEstimatedTax, true)}</span>
    </div>
    <div style="display:flex;gap:12px;font-size:8px;color:#6E6E9A;padding-top:2px">
      <span>STT: ${formatCurrency(cg.sttPaid, true)}</span>
      <span>Brokerage: ${formatCurrency(cg.totalBrokerage, true)}</span>
    </div>
  </div>

  ${alertHTML ? `
  <!-- ── Behavioral Alerts ── -->
  <div class="section">
    <div class="section-title">Behavioral Insights</div>
    ${alertHTML}
  </div>` : ''}

  ${periods.length > 0 ? `
  <!-- ── Period Breakdown ── -->
  <div class="section">
    <div class="section-title">Period Breakdown (Last ${Math.min(periods.length, 12)})</div>
    <table>
      <tr><th>Period</th><th>P&amp;L</th><th>Trades</th><th>Wins</th><th>Losses</th></tr>
      ${periodRows}
    </table>
    ${periods.length > 12 ? `<p style="font-size:8px;color:#9A9AB0">Showing last 12 of ${periods.length} periods</p>` : ''}
  </div>` : ''}

  ${sectorLosers.length > 0 ? `
  <!-- ── Loss Breakdown by Sector ── -->
  <div class="section">
    <div class="section-title">Loss Breakdown by Sector (${sectorLosers.length} sector${sectorLosers.length > 1 ? 's' : ''} in loss)</div>
    ${lossSectorRows}
  </div>` : ''}

  ${sectorMetrics.length > 0 ? `
  <!-- ── Sector-wise Trade Metrics ── -->
  <div class="section">
    <div class="section-title">Sector-wise Trade Metrics</div>
    <table>
      <tr><th>Sector</th><th>Trades</th><th>Wins</th><th>Losses</th><th>Avg Win</th><th>Avg Loss</th><th>PF</th></tr>
      ${sectorMetricRows}
    </table>
  </div>` : ''}

  ${holdings.length > 0 ? `
  <!-- ── Holdings Summary ── -->
  <div class="section">
    <div class="section-title">Holdings (${holdings.length})</div>
    <table>
      <tr><th>Symbol</th><th>Name</th><th>Qty</th><th>Value</th><th>P&amp;L</th><th>Return</th></tr>
      ${holdings.map(h => `
        <tr>
          <td>${h.symbol}</td>
          <td>${h.name}</td>
          <td>${h.quantity}</td>
          <td>${formatCurrency(h.currentValue, true)}</td>
          <td class="${h.pnl >= 0 ? 'green' : 'red'}">${h.pnl >= 0 ? '+' : ''}${formatCurrency(h.pnl, true)}</td>
          <td class="${h.pnl >= 0 ? 'green' : 'red'}">${h.pnlPercent.toFixed(1)}%</td>
        </tr>
      `).join('')}
    </table>
  </div>` : ''}

  <div class="footer">
    Toroloom — AI-powered trading &amp; investment platform<br>
    Report generated on ${todayStr()} · Data is for informational purposes only.
  </div>
</body>
</html>`;
}
