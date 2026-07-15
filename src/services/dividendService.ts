/**
 * Dividend Service — Computes upcoming, historical, and summary dividend data
 * from the user's portfolio holdings and available stock dividend yields.
 *
 * Since real dividend data requires a data provider (e.g. MarketStack, BSE API),
 * this service computes ESTIMATED dividend events:
 *   - Uses the stock's dividend yield % to estimate annual per-share payouts
 *   - Distributes payments based on frequency (quarterly = 4x/yr, etc.)
 *   - Generates next 12 months of estimated upcoming events
 *   - Creates mock historical data for the past 12 months
 *
 * When a real dividend data API is integrated, replace the mock generators
 * with API calls while keeping the same return types.
 */

import type {
  Holding,
  DividendEvent,
  DividendFrequency,
  MonthlyDividend,
  AnnualDividendSummary,
  DividendTrackerState,
} from '../types';

// ── Sector-specific frequency defaults ──────────────────────────────────────

const SECTOR_FREQUENCIES: Record<string, DividendFrequency> = {
  'Banking': 'quarterly',
  'Financial Services': 'quarterly',
  'IT': 'semi_annual',
  'Pharma': 'quarterly',
  'FMCG': 'quarterly',
  'Automobile': 'quarterly',
  'Oil & Gas': 'quarterly',
  'Power': 'quarterly',
  'Metals': 'semi_annual',
  'Telecom': 'irregular',
  'Realty': 'irregular',
  'Consumer Durables': 'quarterly',
  'Infrastructure': 'semi_annual',
  'Textiles': 'irregular',
  'Chemicals': 'quarterly',
  'Media': 'quarterly',
  'Healthcare': 'quarterly',
};

const DEFAULT_FREQUENCY: DividendFrequency = 'quarterly';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getMonthsForFrequency(freq: DividendFrequency): number[] {
  switch (freq) {
    case 'monthly': return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    case 'quarterly': return [2, 5, 8, 11]; // Mar, Jun, Sep, Dec
    case 'semi_annual': return [5, 11];     // Jun, Dec
    case 'annual': return [11];             // Dec
    case 'irregular': return [2, 8];        // Mar, Sep (conservative)
    default: return [2, 5, 8, 11];
  }
}

/**
 * Calculate per-share annual dividend from the stock's yield percentage.
 * yieldPercent is stored as a percentage of price (e.g. 1.5 = 1.5%).
 * So annualDividendPerShare = price * (yieldPercent / 100)
 */
function calcAnnualPerShare(price: number, yieldPercent: number): number {
  return price * (yieldPercent / 100);
}

// ── Generate Upcoming Dividends ─────────────────────────────────────────────

/**
 * Generate upcoming dividend events for the next 12 months
 * based on holdings and their stock dividend data.
 */
export function generateUpcomingDividends(
  holdings: Holding[],
  stocks: { id: string; symbol: string; name: string; price: number; dividend: number; sector: string }[],
): DividendEvent[] {
  const events: DividendEvent[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  for (const holding of holdings) {
    const stock = stocks.find(s => s.id === holding.stockId);
    if (!stock || stock.dividend <= 0) continue;

    const freq = SECTOR_FREQUENCIES[stock.sector] || DEFAULT_FREQUENCY;
    const months = getMonthsForFrequency(freq);
    const annualPerShare = calcAnnualPerShare(stock.price, stock.dividend);
    const paymentPerOccurrence = annualPerShare / months.length;

    // Generate next 4 payment occurrences (upcoming)
    let occurrencesFound = 0;
    for (let m = 0; m < 18 && occurrencesFound < 4; m++) {
      const checkMonth = (currentMonth + m) % 12;
      const checkYear = currentYear + Math.floor((currentMonth + m) / 12);

      if (months.includes(checkMonth)) {
        occurrencesFound++;
        const exDay = 15; // Approximate ex-date (15th of month)
        const payDay = 25; // Approximate pay date (25th of month, ~10 days after ex)

        const exDate = new Date(checkYear, checkMonth, exDay);
        const payDate = new Date(checkYear, checkMonth, payDay);
        const id = `div_${stock.symbol}_${exDate.toISOString().slice(0, 10)}`;

        const totalAmount = paymentPerOccurrence * holding.quantity;

        events.push({
          id,
          symbol: stock.symbol,
          name: stock.name,
          exDate: exDate.toISOString(),
          payDate: payDate.toISOString(),
          amountPerShare: Math.round(paymentPerOccurrence * 100) / 100,
          quantity: holding.quantity,
          totalAmount: Math.round(totalAmount * 100) / 100,
          yieldPercent: stock.dividend,
          frequency: freq,
          confidence: 'estimated',
          sector: stock.sector,
        });
      }
    }
  }

  // Sort by ex-date ascending
  return events.sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime());
}

// ── Generate Mock Historical Data ───────────────────────────────────────────

/**
 * Generate mock historical dividend events for the past 12 months.
 * Uses the same estimation logic as upcoming but back-dated.
 */
export function generateMockHistory(
  holdings: Holding[],
  stocks: { id: string; symbol: string; name: string; price: number; dividend: number; sector: string }[],
): DividendEvent[] {
  const events: DividendEvent[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  for (const holding of holdings) {
    const stock = stocks.find(s => s.id === holding.stockId);
    if (!stock || stock.dividend <= 0) continue;

    const freq = SECTOR_FREQUENCIES[stock.sector] || DEFAULT_FREQUENCY;
    const months = getMonthsForFrequency(freq);
    const annualPerShare = calcAnnualPerShare(stock.price, stock.dividend);
    const paymentPerOccurrence = annualPerShare / months.length;

    // Look back 12 months for historical payment months
    for (let m = 1; m <= 12; m++) {
      const checkMonth = (currentMonth - m + 12) % 12;
      const checkYear = currentYear - (m > currentMonth ? 1 : 0);

      if (months.includes(checkMonth)) {
        const exDay = 15;
        const payDay = 25;

        const exDate = new Date(checkYear, checkMonth, exDay);
        const payDate = new Date(checkYear, checkMonth, payDay);
        const id = `div_hist_${stock.symbol}_${exDate.toISOString().slice(0, 10)}`;

        const totalAmount = paymentPerOccurrence * holding.quantity;

        events.push({
          id,
          symbol: stock.symbol,
          name: stock.name,
          exDate: exDate.toISOString(),
          payDate: payDate.toISOString(),
          amountPerShare: Math.round(paymentPerOccurrence * 100) / 100,
          quantity: holding.quantity,
          totalAmount: Math.round(totalAmount * 100) / 100,
          yieldPercent: stock.dividend,
          frequency: freq,
          confidence: 'paid',
          sector: stock.sector,
        });
      }
    }
  }

  return events.sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime());
}

// ── Monthly Breakdown ───────────────────────────────────────────────────────

/**
 * Group dividend events into monthly buckets.
 */
export function groupByMonth(events: DividendEvent[]): MonthlyDividend[] {
  const monthMap = new Map<string, DividendEvent[]>();

  for (const event of events) {
    const date = new Date(event.payDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthMap.get(key) || [];
    existing.push(event);
    monthMap.set(key, existing);
  }

  return Array.from(monthMap.entries())
    .map(([key, evts]) => {
      const [yearStr, monthStr] = key.split('-');
      const year = parseInt(yearStr, 10);
      const monthIdx = parseInt(monthStr, 10) - 1;
      const label = new Date(year, monthIdx, 1).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
      });
      return {
        month: key,
        label,
        totalAmount: Math.round(evts.reduce((s, e) => s + e.totalAmount, 0) * 100) / 100,
        events: evts,
        count: evts.length,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ── Annual Summary ──────────────────────────────────────────────────────────

/**
 * Generate annual dividend summaries from historical data.
 */
export function generateAnnualSummaries(
  history: DividendEvent[],
  monthlyHistory: MonthlyDividend[],
): AnnualDividendSummary[] {
  const yearMap = new Map<number, MonthlyDividend[]>();

  for (const month of monthlyHistory) {
    const year = parseInt(month.month.split('-')[0], 10);
    const existing = yearMap.get(year) || [];
    existing.push(month);
    yearMap.set(year, existing);
  }

  return Array.from(yearMap.entries())
    .map(([year, months]) => {
      const totalIncome = months.reduce((s, m) => s + m.totalAmount, 0);

      // Aggregate top payers for this year
      const payerMap = new Map<string, { name: string; totalAmount: number }>();
      for (const month of months) {
        for (const event of month.events) {
          const existing = payerMap.get(event.symbol) || { name: event.name, totalAmount: 0 };
          existing.totalAmount += event.totalAmount;
          payerMap.set(event.symbol, existing);
        }
      }

      const topPayers = Array.from(payerMap.entries())
        .map(([symbol, data]) => ({ symbol, ...data }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 5);

      return {
        year,
        totalIncome: Math.round(totalIncome * 100) / 100,
        monthlyAverage: Math.round((totalIncome / 12) * 100) / 100,
        months,
        topPayers,
      };
    })
    .sort((a, b) => b.year - a.year);
}

// ── Current Year Projection ─────────────────────────────────────────────────

/**
 * Compute current year projection from upcoming events + past history
 * in the current year.
 */
export function computeCurrentYearProjection(
  upcoming: DividendEvent[],
  history: DividendEvent[],
  holdings: Holding[],
  totalPortfolioCost: number,
  totalPortfolioValue: number,
): DividendTrackerState['currentYearProjection'] {
  const currentYear = new Date().getFullYear();

  // Upcoming events + already-paid events in current year
  const currentYearEvents = [
    ...upcoming,
    ...history.filter(e => new Date(e.payDate).getFullYear() === currentYear),
  ];
  // Remove duplicates by id
  const seen = new Set<string>();
  const uniqueEvents = currentYearEvents.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  const totalEstimated = uniqueEvents.reduce((s, e) => s + e.totalAmount, 0);
  const monthlyAverage = totalEstimated / 12;

  // Top payers
  const payerMap = new Map<string, { name: string; totalAmount: number; yieldPercent: number }>();
  for (const event of uniqueEvents) {
    const existing = payerMap.get(event.symbol) || {
      name: event.name,
      totalAmount: 0,
      yieldPercent: event.yieldPercent,
    };
    existing.totalAmount += event.totalAmount;
    payerMap.set(event.symbol, existing);
  }

  const topPayers = Array.from(payerMap.entries())
    .map(([symbol, data]) => ({ symbol, ...data }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5);

  const yieldOnCost = totalPortfolioCost > 0
    ? (totalEstimated / totalPortfolioCost) * 100
    : 0;
  const portfolioYield = totalPortfolioValue > 0
    ? (totalEstimated / totalPortfolioValue) * 100
    : 0;

  return {
    totalEstimated: Math.round(totalEstimated * 100) / 100,
    monthlyAverage: Math.round(monthlyAverage * 100) / 100,
    yieldOnCost: Math.round(yieldOnCost * 100) / 100,
    portfolioYield: Math.round(portfolioYield * 100) / 100,
    topPayers,
  };
}

// ── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Compute the full DividendTrackerState from holdings and stock data.
 * - upcoming: next 12 months of estimated dividends
 * - history: past 12 months of mock historical dividends
 * - monthlyHistory: grouped by month
 * - annualSummaries: yearly breakdown
 * - currentYearProjection: total estimated, yield, top payers
 * - lifetimeIncome: all historical + upcoming total
 * - totalPayments: count of all events
 */
export function computeDividendState(
  holdings: Holding[],
  stocks: { id: string; symbol: string; name: string; price: number; dividend: number; sector: string }[],
): DividendTrackerState {
  const upcoming = generateUpcomingDividends(holdings, stocks);
  const history = generateMockHistory(holdings, stocks);
  const monthlyHistory = groupByMonth([...history, ...upcoming]);
  const annualSummaries = generateAnnualSummaries(history, monthlyHistory);

  const totalPortfolioCost = holdings.reduce((s, h) => s + h.totalInvested, 0);
  const totalPortfolioValue = holdings.reduce((s, h) => s + h.currentValue, 0);

  const currentYearProjection = computeCurrentYearProjection(
    upcoming,
    history,
    holdings,
    totalPortfolioCost,
    totalPortfolioValue,
  );

  const lifetimeIncome = history.reduce((s, e) => s + e.totalAmount, 0);
  const totalPayments = history.length;

  return {
    upcoming,
    history,
    monthlyHistory,
    annualSummaries,
    currentYearProjection,
    lifetimeIncome: Math.round(lifetimeIncome * 100) / 100,
    totalPayments,
  };
}
