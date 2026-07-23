/**
 * Company Fundamentals Route
 *
 * Provides detailed financial data for stocks including:
 * - Valuation Ratios (P/E, P/B, P/S, EV/EBITDA)
 * - Profitability Ratios (ROE, ROA, ROCE, margins)
 * - Efficiency & Liquidity Ratios
 * - Growth Metrics
 * - Cash Flow & Dividend Data
 * - Shareholding Pattern
 * - Quarterly & Annual Results
 *
 * Currently returns mock data; extend with real data source as needed.
 */

import { Router, Request, Response } from 'express';

const router = Router();

// ──── Types (defined locally to avoid cross-package import) ──

interface FinancialQuarter {
  quarter: string;
  date: string;
  revenue: number;
  netProfit: number;
  eps: number;
  margin: number;
}

interface CompanyFundamentals {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  peRatio: number;
  pbRatio: number;
  psRatio: number;
  evEbitda: number;
  roe: number;
  roa: number;
  roce: number;
  operatingMargin: number;
  netMargin: number;
  assetTurnover: number;
  inventoryTurnover: number;
  receivablesDays: number;
  currentRatio: number;
  quickRatio: number;
  debtToEquity: number;
  interestCoverage: number;
  revenueGrowth: number;
  profitGrowth: number;
  epsGrowth: number;
  operatingCashFlow: number;
  freeCashFlow: number;
  dividendYield: number;
  dividendPayout: number;
  promotersHolding: number;
  fiiHolding: number;
  mutualFundHolding: number;
  publicHolding: number;
  quarterlyResults: FinancialQuarter[];
  annualResults: FinancialQuarter[];
  sectorAvgPe: number;
  sectorAvgPb: number;
  sectorAvgRoce: number;
  sectorAvgDebtEquity: number;
  website: string;
  about: string;
  strengths: string[];
  risks: string[];
}

// ──── Mock Fundamentals Data ─────────────────────────────────

const mockFundamentals: Record<string, CompanyFundamentals> = {
  RELIANCE: {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    sector: 'Energy',
    industry: 'Oil & Gas / Telecom / Retail',
    peRatio: 28.5,
    pbRatio: 3.2,
    psRatio: 1.8,
    evEbitda: 16.2,
    roe: 12.4,
    roa: 6.8,
    roce: 14.2,
    operatingMargin: 18.5,
    netMargin: 8.2,
    assetTurnover: 0.85,
    inventoryTurnover: 12.5,
    receivablesDays: 32,
    currentRatio: 1.2,
    quickRatio: 0.85,
    debtToEquity: 0.45,
    interestCoverage: 8.5,
    revenueGrowth: 12.3,
    profitGrowth: 15.8,
    epsGrowth: 14.2,
    operatingCashFlow: 145000,
    freeCashFlow: 85000,
    dividendYield: 0.85,
    dividendPayout: 12.5,
    promotersHolding: 50.6,
    fiiHolding: 24.2,
    mutualFundHolding: 15.8,
    publicHolding: 9.4,
    quarterlyResults: [
      { quarter: 'Q4 FY26', date: '2026-03-31', revenue: 245600, netProfit: 21345, eps: 31.2, margin: 8.7 },
      { quarter: 'Q3 FY26', date: '2025-12-31', revenue: 238900, netProfit: 20560, eps: 30.1, margin: 8.6 },
      { quarter: 'Q2 FY26', date: '2025-09-30', revenue: 231200, netProfit: 19800, eps: 29.0, margin: 8.6 },
      { quarter: 'Q1 FY26', date: '2025-06-30', revenue: 225000, netProfit: 18900, eps: 27.8, margin: 8.4 },
    ],
    annualResults: [
      { quarter: 'FY26', date: '2026-03-31', revenue: 940700, netProfit: 80605, eps: 118.1, margin: 8.6 },
      { quarter: 'FY25', date: '2025-03-31', revenue: 856000, netProfit: 72150, eps: 106.5, margin: 8.4 },
      { quarter: 'FY24', date: '2024-03-31', revenue: 768000, netProfit: 63200, eps: 93.8, margin: 8.2 },
    ],
    sectorAvgPe: 22.5,
    sectorAvgPb: 2.8,
    sectorAvgRoce: 12.0,
    sectorAvgDebtEquity: 0.6,
    website: 'https://www.ril.com',
    about: 'Reliance Industries Limited is an Indian multinational conglomerate with businesses spanning energy, petrochemicals, telecommunications (Jio), retail, and digital services.',
    strengths: ['Diversified business model', 'Strong balance sheet', 'Market leader in telecom', 'Vertical integration', 'Strong R&D'],
    risks: ['Regulatory changes', 'Crude oil price volatility', 'High capex requirements', 'Intense competition', 'Geopolitical risks'],
  },
  TCS: {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    sector: 'Technology',
    industry: 'IT Services & Consulting',
    peRatio: 35.2,
    pbRatio: 12.5,
    psRatio: 4.8,
    evEbitda: 24.5,
    roe: 38.5,
    roa: 18.2,
    roce: 42.0,
    operatingMargin: 26.5,
    netMargin: 21.2,
    assetTurnover: 1.2,
    inventoryTurnover: 0,
    receivablesDays: 68,
    currentRatio: 3.8,
    quickRatio: 3.8,
    debtToEquity: 0.05,
    interestCoverage: 85.5,
    revenueGrowth: 8.5,
    profitGrowth: 10.2,
    epsGrowth: 9.5,
    operatingCashFlow: 45200,
    freeCashFlow: 38500,
    dividendYield: 1.20,
    dividendPayout: 55.0,
    promotersHolding: 72.4,
    fiiHolding: 12.8,
    mutualFundHolding: 8.5,
    publicHolding: 6.3,
    quarterlyResults: [
      { quarter: 'Q4 FY26', date: '2026-03-31', revenue: 64200, netProfit: 12450, eps: 34.2, margin: 19.4 },
      { quarter: 'Q3 FY26', date: '2025-12-31', revenue: 63800, netProfit: 12100, eps: 33.1, margin: 19.0 },
      { quarter: 'Q2 FY26', date: '2025-09-30', revenue: 62500, netProfit: 11800, eps: 32.4, margin: 18.9 },
      { quarter: 'Q1 FY26', date: '2025-06-30', revenue: 61200, netProfit: 11500, eps: 31.5, margin: 18.8 },
    ],
    annualResults: [
      { quarter: 'FY26', date: '2026-03-31', revenue: 251700, netProfit: 47850, eps: 131.2, margin: 19.0 },
      { quarter: 'FY25', date: '2025-03-31', revenue: 232000, netProfit: 43400, eps: 119.8, margin: 18.7 },
      { quarter: 'FY24', date: '2024-03-31', revenue: 215000, netProfit: 40200, eps: 110.5, margin: 18.7 },
    ],
    sectorAvgPe: 30.5,
    sectorAvgPb: 10.2,
    sectorAvgRoce: 35.0,
    sectorAvgDebtEquity: 0.1,
    website: 'https://www.tcs.com',
    about: 'Tata Consultancy Services is an Indian multinational technology company specializing in IT services, consulting, and business solutions.',
    strengths: ['Global brand recognition', 'Industry-leading margins', 'Deep domain expertise', 'Fortune 500 clients', 'Strong talent pipeline'],
    risks: ['US client spending slowdown', 'Hiring and attrition pressures', 'Rupee appreciation impact', 'AI disruption', 'Visa policy changes'],
  },
  HDFCBANK: {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    sector: 'Finance',
    industry: 'Banking',
    peRatio: 18.9,
    pbRatio: 2.8,
    psRatio: 4.2,
    evEbitda: 0,
    roe: 16.2,
    roa: 1.9,
    roce: 0,
    operatingMargin: 58.5,
    netMargin: 22.5,
    assetTurnover: 0.08,
    inventoryTurnover: 0,
    receivablesDays: 0,
    currentRatio: 0,
    quickRatio: 0,
    debtToEquity: 4.8,
    interestCoverage: 0,
    revenueGrowth: 18.5,
    profitGrowth: 15.2,
    epsGrowth: 14.8,
    operatingCashFlow: 0,
    freeCashFlow: 0,
    dividendYield: 1.05,
    dividendPayout: 18.5,
    promotersHolding: 0,
    fiiHolding: 45.2,
    mutualFundHolding: 22.8,
    publicHolding: 32.0,
    quarterlyResults: [
      { quarter: 'Q4 FY26', date: '2026-03-31', revenue: 42500, netProfit: 10250, eps: 18.5, margin: 24.1 },
      { quarter: 'Q3 FY26', date: '2025-12-31', revenue: 41200, netProfit: 9850, eps: 17.8, margin: 23.9 },
      { quarter: 'Q2 FY26', date: '2025-09-30', revenue: 39800, netProfit: 9500, eps: 17.2, margin: 23.9 },
      { quarter: 'Q1 FY26', date: '2025-06-30', revenue: 38500, netProfit: 9200, eps: 16.6, margin: 23.9 },
    ],
    annualResults: [
      { quarter: 'FY26', date: '2026-03-31', revenue: 162000, netProfit: 38800, eps: 70.1, margin: 23.9 },
      { quarter: 'FY25', date: '2025-03-31', revenue: 138000, netProfit: 33800, eps: 61.5, margin: 24.5 },
      { quarter: 'FY24', date: '2024-03-31', revenue: 118000, netProfit: 29200, eps: 53.2, margin: 24.7 },
    ],
    sectorAvgPe: 16.5,
    sectorAvgPb: 2.4,
    sectorAvgRoce: 0,
    sectorAvgDebtEquity: 5.2,
    website: 'https://www.hdfcbank.com',
    about: 'HDFC Bank is Indias largest private sector bank by assets and market capitalization.',
    strengths: ['Largest private sector bank', 'Consistent profit growth', 'Industry-leading asset quality', 'Extensive branch network', 'Strong retail deposits'],
    risks: ['NIM compression', 'Regulatory changes', 'Economic slowdown', 'Fintech competition', 'HDFC merger integration'],
  },
  INFY: {
    symbol: 'INFY', name: 'Infosys Ltd.', sector: 'Technology', industry: 'IT Services & Consulting',
    peRatio: 28.1, pbRatio: 7.9, psRatio: 4.1, evEbitda: 20.5,
    roe: 32.5, roa: 16.8, roce: 38.2, operatingMargin: 24.2, netMargin: 18.5,
    assetTurnover: 1.1, inventoryTurnover: 0, receivablesDays: 72,
    currentRatio: 3.5, quickRatio: 3.5, debtToEquity: 0.02, interestCoverage: 95.2,
    revenueGrowth: 7.8, profitGrowth: 8.5, epsGrowth: 9.2,
    operatingCashFlow: 28500, freeCashFlow: 23500, dividendYield: 1.80, dividendPayout: 68.5,
    promotersHolding: 14.8, fiiHolding: 38.5, mutualFundHolding: 24.2, publicHolding: 22.5,
    quarterlyResults: [
      { quarter: 'Q4 FY26', date: '2026-03-31', revenue: 39850, netProfit: 7350, eps: 17.5, margin: 18.4 },
      { quarter: 'Q3 FY26', date: '2025-12-31', revenue: 39200, netProfit: 7100, eps: 16.8, margin: 18.1 },
      { quarter: 'Q2 FY26', date: '2025-09-30', revenue: 38500, netProfit: 6850, eps: 16.2, margin: 17.8 },
      { quarter: 'Q1 FY26', date: '2025-06-30', revenue: 37800, netProfit: 6650, eps: 15.8, margin: 17.6 },
    ],
    annualResults: [
      { quarter: 'FY26', date: '2026-03-31', revenue: 155350, netProfit: 27950, eps: 66.3, margin: 18.0 },
      { quarter: 'FY25', date: '2025-03-31', revenue: 144000, netProfit: 25800, eps: 61.5, margin: 17.9 },
      { quarter: 'FY24', date: '2024-03-31', revenue: 135000, netProfit: 24200, eps: 57.8, margin: 17.9 },
    ],
    sectorAvgPe: 30.5, sectorAvgPb: 10.2, sectorAvgRoce: 35.0, sectorAvgDebtEquity: 0.1,
    website: 'https://www.infosys.com',
    about: 'Infosys is an Indian multinational IT company providing business consulting, IT services, and digital transformation solutions.',
    strengths: ['Digital transformation capabilities', 'Global delivery model', 'Strong client relationships', 'Employee training programs', 'Strong balance sheet'],
    risks: ['US recession fears', 'Wage inflation', 'AI disruption', 'Visa policy uncertainty', 'Currency fluctuations'],
  },
  SBIN: {
    symbol: 'SBIN', name: 'State Bank of India', sector: 'Finance', industry: 'Banking - Public Sector',
    peRatio: 10.2, pbRatio: 1.5, psRatio: 2.8, evEbitda: 0,
    roe: 15.8, roa: 1.2, roce: 0, operatingMargin: 52.0, netMargin: 18.2,
    assetTurnover: 0.06, inventoryTurnover: 0, receivablesDays: 0,
    currentRatio: 0, quickRatio: 0, debtToEquity: 6.2, interestCoverage: 0,
    revenueGrowth: 22.5, profitGrowth: 35.2, epsGrowth: 38.5,
    operatingCashFlow: 0, freeCashFlow: 0, dividendYield: 2.15, dividendPayout: 22.0,
    promotersHolding: 56.9, fiiHolding: 15.2, mutualFundHolding: 10.5, publicHolding: 17.4,
    quarterlyResults: [
      { quarter: 'Q4 FY26', date: '2026-03-31', revenue: 112500, netProfit: 18500, eps: 20.8, margin: 16.4 },
      { quarter: 'Q3 FY26', date: '2025-12-31', revenue: 108200, netProfit: 16800, eps: 18.9, margin: 15.5 },
      { quarter: 'Q2 FY26', date: '2025-09-30', revenue: 104500, netProfit: 15200, eps: 17.1, margin: 14.5 },
      { quarter: 'Q1 FY26', date: '2025-06-30', revenue: 101200, netProfit: 14200, eps: 16.0, margin: 14.0 },
    ],
    annualResults: [
      { quarter: 'FY26', date: '2026-03-31', revenue: 426400, netProfit: 64700, eps: 72.8, margin: 15.2 },
      { quarter: 'FY25', date: '2025-03-31', revenue: 365000, netProfit: 47800, eps: 53.8, margin: 13.1 },
      { quarter: 'FY24', date: '2024-03-31', revenue: 312000, netProfit: 38500, eps: 43.2, margin: 12.3 },
    ],
    sectorAvgPe: 16.5, sectorAvgPb: 2.4, sectorAvgRoce: 0, sectorAvgDebtEquity: 5.2,
    website: 'https://www.sbi.co.in',
    about: 'State Bank of India is the largest bank in India with over 50,000 branches.',
    strengths: ['Largest bank in India', 'Government backing', 'Improving asset quality', 'Rural banking dominance', 'Low-cost CASA deposits'],
    risks: ['Government ownership limits', 'Stressed sector exposure', 'PSB wage revision', 'Technology modernization', 'Private bank competition'],
  },
  TATAMOTORS: {
    symbol: 'TATAMOTORS', name: 'Tata Motors Ltd.', sector: 'Automobile', industry: 'Automotive Manufacturing',
    peRatio: 8.5, pbRatio: 2.1, psRatio: 0.6, evEbitda: 5.8,
    roe: 18.5, roa: 5.2, roce: 14.8, operatingMargin: 11.5, netMargin: 5.8,
    assetTurnover: 1.2, inventoryTurnover: 8.5, receivablesDays: 28,
    currentRatio: 0.85, quickRatio: 0.55, debtToEquity: 0.65, interestCoverage: 4.5,
    revenueGrowth: 14.2, profitGrowth: 22.5, epsGrowth: 25.8,
    operatingCashFlow: 38500, freeCashFlow: 12500, dividendYield: 0.35, dividendPayout: 5.0,
    promotersHolding: 46.4, fiiHolding: 22.8, mutualFundHolding: 16.2, publicHolding: 14.6,
    quarterlyResults: [
      { quarter: 'Q4 FY26', date: '2026-03-31', revenue: 115800, netProfit: 7200, eps: 19.5, margin: 6.2 },
      { quarter: 'Q3 FY26', date: '2025-12-31', revenue: 108500, netProfit: 6200, eps: 16.8, margin: 5.7 },
      { quarter: 'Q2 FY26', date: '2025-09-30', revenue: 102300, netProfit: 5500, eps: 14.9, margin: 5.4 },
      { quarter: 'Q1 FY26', date: '2025-06-30', revenue: 98500, netProfit: 4800, eps: 13.0, margin: 4.9 },
    ],
    annualResults: [
      { quarter: 'FY26', date: '2026-03-31', revenue: 425100, netProfit: 23700, eps: 64.2, margin: 5.6 },
      { quarter: 'FY25', date: '2025-03-31', revenue: 372000, netProfit: 19400, eps: 52.5, margin: 5.2 },
      { quarter: 'FY24', date: '2024-03-31', revenue: 325000, netProfit: 15800, eps: 42.8, margin: 4.9 },
    ],
    sectorAvgPe: 15.2, sectorAvgPb: 3.1, sectorAvgRoce: 11.5, sectorAvgDebtEquity: 0.45,
    website: 'https://www.tatamotors.com',
    about: 'Tata Motors Limited is an Indian multinational automotive manufacturer producing passenger cars, trucks, and luxury cars under Jaguar Land Rover.',
    strengths: ['JLR brand', 'Growing EV portfolio', 'CV market leadership', 'Tata Group synergies', 'Improving JLR margins'],
    risks: ['JLR demand cycles', 'EV investment needs', 'Supply chain risks', 'Domestic competition', 'Raw material volatility'],
  },
  BAJFINANCE: {
    symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd.', sector: 'Finance', industry: 'NBFC',
    peRatio: 32.4, pbRatio: 5.2, psRatio: 6.5, evEbitda: 0,
    roe: 18.5, roa: 3.8, roce: 0, operatingMargin: 65.2, netMargin: 28.5,
    assetTurnover: 0.12, inventoryTurnover: 0, receivablesDays: 0,
    currentRatio: 0, quickRatio: 0, debtToEquity: 3.5, interestCoverage: 0,
    revenueGrowth: 25.5, profitGrowth: 22.8, epsGrowth: 21.5,
    operatingCashFlow: 0, freeCashFlow: 0, dividendYield: 0.60, dividendPayout: 12.5,
    promotersHolding: 0, fiiHolding: 42.5, mutualFundHolding: 28.2, publicHolding: 29.3,
    quarterlyResults: [
      { quarter: 'Q4 FY26', date: '2026-03-31', revenue: 16800, netProfit: 4650, eps: 7.8, margin: 27.7 },
      { quarter: 'Q3 FY26', date: '2025-12-31', revenue: 16200, netProfit: 4450, eps: 7.4, margin: 27.5 },
      { quarter: 'Q2 FY26', date: '2025-09-30', revenue: 15500, netProfit: 4200, eps: 7.0, margin: 27.1 },
      { quarter: 'Q1 FY26', date: '2025-06-30', revenue: 14800, netProfit: 3950, eps: 6.6, margin: 26.7 },
    ],
    annualResults: [
      { quarter: 'FY26', date: '2026-03-31', revenue: 63300, netProfit: 17250, eps: 28.8, margin: 27.2 },
      { quarter: 'FY25', date: '2025-03-31', revenue: 52000, netProfit: 14500, eps: 24.2, margin: 27.9 },
      { quarter: 'FY24', date: '2024-03-31', revenue: 42500, netProfit: 11800, eps: 19.8, margin: 27.8 },
    ],
    sectorAvgPe: 25.8, sectorAvgPb: 4.2, sectorAvgRoce: 0, sectorAvgDebtEquity: 3.8,
    website: 'https://www.bajajfinserv.in',
    about: 'Bajaj Finance is one of the most valuable NBFCs in India, offering a wide range of lending and wealth management products.',
    strengths: ['Consumer finance leader', 'Superior risk management', 'Diversified product portfolio', 'Industry-leading NIMs', 'Digital lending platform'],
    risks: ['Unsecured lending exposure', 'Regulatory tightening', 'Rising interest rates', 'Fintech competition', 'Regional concentration'],
  },
};

// ──── GET /api/market/fundamentals/:symbol ───────────────────
// Returns full company fundamentals data for a given stock symbol

router.get('/:symbol', (req: Request, res: Response) => {
  const symbolParam = req.params.symbol;
  const upperSymbol = (typeof symbolParam === 'string' ? symbolParam : symbolParam[0]).toUpperCase();
  const data = mockFundamentals[upperSymbol];

  if (!data) {
    res.status(404).json({
      error: 'Fundamentals data not found',
      symbol: upperSymbol,
    });
    return;
  }

  res.json(data);
});

export default router;
