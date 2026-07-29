// Period Report — Weekly & Monthly P&L, Tax, and Behavioral Alerts
export default {
  title: 'Period Report',
  subtitle: 'Weekly & monthly performance overview',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  all: 'All',

  // P&L Summary
  pnlSummary: 'P&L Summary',
  totalPnl: 'Total P&L',
  realizedPnl: 'Realized P&L',
  unrealizedPnl: 'Unrealized P&L',
  dayPnl: 'Day P&L',
  periodReturn: 'Period Return',
  bestTrade: 'Best Trade',
  worstTrade: 'Worst Trade',
  winRate: 'Win Rate',
  totalTrades: 'Total Trades',

  // Tax Section
  taxSummary: 'Tax Summary',
  estimatedTax: 'Estimated Tax',
  stcgLabel: 'STCG (15%)',
  ltcgLabel: 'LTCG (10%)',
  taxableGains: 'Taxable Gains',
  taxExemptLimit: '₹1L Exempt',
  taxHarvestingTip: 'Harvest unrealized losses before year-end to offset capital gains.',

  // Behavioral / Overtrading
  behavioralInsights: 'Behavioral Insights',
  overTradingAlert: 'Over-Trading Alert',
  overTradingDesc: 'Daily trade count exceeds recommended limit',
  brokerageLeakage: 'Brokerage Leakage',
  brokerageLeakageDesc: 'Charges consuming significant portion of P&L',
  concentrationRisk: 'Concentration Risk',
  concentrationRiskDesc: 'Portfolio over-concentrated in one sector',
  behavioralCritique: 'Behavioral Critique',
  noAlerts: 'No behavioral alerts — balanced trading',

  // Period breakdown
  weekLabel: 'Week {{label}}',
  monthLabel: '{{month}} {{year}}',
  profitLabel: 'Profit',
  lossLabel: 'Loss',
  tradesCount: '{{count}} trades',
  pnlAmount: '₹{{amount}}',
  returnPercent: '{{percent}}%',

  // Period details
  periodDetails: 'Period Details',
  noData: 'No trade data for this period',
  loading: 'Loading report...',
  refresh: 'Pull to refresh',
  avgWin: 'Avg Win',
  avgLoss: 'Avg Loss',
  profitFactor: 'Profit Factor',
  sharpeRatio: 'Sharpe Ratio',
  maxDrawdown: 'Max Drawdown',
  avgHoldingDays: 'Avg Holding Days',
  bestPerformer: 'Best Performer',
  worstPerformer: 'Worst Performer',

  // Period comparison
  comparison: 'Period Comparison',
  previousPeriod: 'Previous Period',
  currentPeriod: 'Current Period',
  changeLabel: 'Change',
  improving: 'Improving',
  declining: 'Declining',

  // Loss breakdown
  lossBreakdown: 'Loss Breakdown',
  lossByStock: 'Loss by Stock',
  topLosers: 'Top Losers',
  lossBySector: 'Loss by Sector',
  totalSectorLoss: 'Total Sector Loss',
  sectorsWithLoss: '{{count}} sectors in loss',
  noLosers: 'No losing positions this period',
  lossAmount: 'Loss: {{amount}}',
  lossPercent: '{{percent}}% down',
  sectorLossAmount: '{{sector}}: {{amount}}',
  tapToExpand: 'Tap to expand',
  tapToCollapse: 'Tap to collapse',
  showDetails: 'Show details',
  hideDetails: 'Hide details',
  holdingDays: '{{days}} days held',

  // Sector-wise metrics
  sectorMetrics: 'Sector-wise Metrics',
  sectorWins: 'W',
  sectorLosses: 'L',
  winLossLabel: 'W/L',
  sectorAvgWin: 'Avg Win',
  sectorAvgLoss: 'Avg Loss',
  sectorProfitFactor: 'PF',
  noTradeData: 'No sector trade data',

  // Export PDF
  exportPdf: 'Export PDF',
  exportingPdf: 'Generating PDF...',
  pdfGenerated: 'PDF saved successfully',
  pdfFailed: 'Could not generate PDF',
  pdfSharingUnavailable: 'Sharing not available on this device',

  // Empty state
  emptyTitle: 'No Data Yet',
  emptySubtitle: 'Start trading to see your period report',
};
