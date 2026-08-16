/**
 * ============================================================================
 * Toroloom — Economic Calendar Mock Data
 * ============================================================================
 *
 * Fallback data used when no live economic calendar API is configured.
 * Dates are generated relative to "today" so the calendar always shows a
 * sensible mix of upcoming / released events.
 *
 * The shape matches the frontend `EconomicEvent` type (src/types/index.ts)
 * so the API client can map responses 1:1.
 *
 * Endpoints in routes/economicCalendar.ts:
 *   GET /api/economic-calendar                 — All events (filters supported)
 *   GET /api/economic-calendar/upcoming        — Events in the next N days
 *   GET /api/economic-calendar/summary         — Category / importance stats
 *
 * ============================================================================
 */

export type EconomicEventCategory =
  | 'central_bank'
  | 'gdp'
  | 'inflation'
  | 'employment'
  | 'trade'
  | 'fiscal'
  | 'industry'
  | 'consumer'
  | 'housing'
  | 'other';

export interface EconomicEvent {
  id: string;
  title: string;
  description: string;
  /** ISO date (YYYY-MM-DD) */
  date: string;
  /** Local time of the release, e.g. '10:00 AM' */
  time: string;
  /** Timezone abbreviation, e.g. 'IST' / 'ET' */
  timezone: string;
  category: EconomicEventCategory;
  country: string;
  countryCode: string;
  importance: 'high' | 'medium' | 'low';
  previous: string;
  forecast: string;
  actual?: string;
  isCompleted: boolean;
  impact: 'positive' | 'negative' | 'neutral' | 'unknown';
  affectedAssets: string[];
  source: string;
  notes?: string;
}

// ──── Date helpers ─────────────────────────────────────────────────────────

function dateStr(daysFromToday: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().split('T')[0];
}

// ──── Events (built relative to today) ─────────────────────────────────────

export const economicCalendarEvents: EconomicEvent[] = [
  // ── Released (past) ────────────────────────────────────────────────────
  {
    id: 'ec_cpi_india',
    title: 'India CPI Inflation Data (Monthly)',
    description: 'Consumer Price Index released by MoSPI — the RBI\u2019s primary inflation gauge across urban and rural India.',
    date: dateStr(-4),
    time: '5:30 PM',
    timezone: 'IST',
    category: 'inflation',
    country: 'India',
    countryCode: 'IN',
    importance: 'high',
    previous: '5.1%',
    forecast: '5.0%',
    actual: '4.9%',
    isCompleted: true,
    impact: 'positive',
    affectedAssets: ['NIFTY', 'BANKNIFTY', 'INR', 'G-Secs'],
    source: 'MoSPI',
    notes: 'Sub-5% print keeps the RBI on hold and supports rate-cut expectations.',
  },
  {
    id: 'ec_india_gdp',
    title: 'India GDP Growth Rate (Quarterly)',
    description: 'Quarterly Gross Domestic Product data measuring the value of all goods and services produced in India.',
    date: dateStr(-6),
    time: '5:30 PM',
    timezone: 'IST',
    category: 'gdp',
    country: 'India',
    countryCode: 'IN',
    importance: 'high',
    previous: '8.4%',
    forecast: '7.5%',
    actual: '7.8%',
    isCompleted: true,
    impact: 'positive',
    affectedAssets: ['NIFTY', 'SENSEX', 'INR'],
    source: 'MoSPI',
    notes: 'India remains the fastest-growing major economy, though momentum is cooling from the FY25 peak.',
  },
  {
    id: 'ec_fed_rate',
    title: 'US Federal Reserve Interest Rate Decision',
    description: 'FOMC announces its decision on the federal funds rate target and forward guidance.',
    date: dateStr(-2),
    time: '2:00 PM',
    timezone: 'ET',
    category: 'central_bank',
    country: 'United States',
    countryCode: 'US',
    importance: 'high',
    previous: '5.50%',
    forecast: '5.50%',
    actual: '5.50%',
    isCompleted: true,
    impact: 'neutral',
    affectedAssets: ['S&P 500', 'NASDAQ', 'DXY', 'Gold', 'INR'],
    source: 'Federal Reserve',
    notes: 'Rates held steady; dot plot suggests one cut later this year.',
  },
  {
    id: 'ec_iip',
    title: 'India Index of Industrial Production (IIP YoY)',
    description: 'Factory output growth across mining, manufacturing, and electricity sectors.',
    date: dateStr(-8),
    time: '5:30 PM',
    timezone: 'IST',
    category: 'industry',
    country: 'India',
    countryCode: 'IN',
    importance: 'medium',
    previous: '5.0%',
    forecast: '5.2%',
    actual: '5.4%',
    isCompleted: true,
    impact: 'positive',
    affectedAssets: ['NIFTY', 'SENSEX'],
    source: 'MoSPI',
  },

  // ── Upcoming (next 14 days) ─────────────────────────────────────────────
  {
    id: 'ec_rbi_mpc',
    title: 'RBI Monetary Policy Committee Decision',
    description: 'The MPC announces its bi-monthly repo rate decision. A hold is widely expected as core inflation stays within the tolerance band.',
    date: dateStr(2),
    time: '10:00 AM',
    timezone: 'IST',
    category: 'central_bank',
    country: 'India',
    countryCode: 'IN',
    importance: 'high',
    previous: '6.50%',
    forecast: '6.50%',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['NIFTY', 'BANKNIFTY', 'INR', 'G-Secs'],
    source: 'RBI',
  },
  {
    id: 'ec_auto_sales',
    title: 'India Auto Sales (Monthly — OEM data)',
    description: 'Monthly vehicle wholesales from SIAM — passenger vehicles, two-wheelers, and commercial vehicles.',
    date: dateStr(1),
    time: '11:00 AM',
    timezone: 'IST',
    category: 'consumer',
    country: 'India',
    countryCode: 'IN',
    importance: 'medium',
    previous: '3.85 Mn units',
    forecast: '3.95 Mn units',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['TATAMOTORS', 'M&M', 'MARUTI'],
    source: 'SIAM',
  },
  {
    id: 'ec_gst_collection',
    title: 'India GST Collection (Monthly)',
    description: 'Monthly GST revenue collection — a key gauge of domestic consumption and tax buoyancy.',
    date: dateStr(1),
    time: '5:30 PM',
    timezone: 'IST',
    category: 'fiscal',
    country: 'India',
    countryCode: 'IN',
    importance: 'medium',
    previous: '₹1.72 Lakh Cr',
    forecast: '₹1.78 Lakh Cr',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['NIFTY', 'SENSEX'],
    source: 'Ministry of Finance',
  },
  {
    id: 'ec_forex_reserves',
    title: 'India Foreign Exchange Reserves (Weekly)',
    description: 'Weekly update on India\u2019s FX reserves. Rising reserves cushion the rupee against global shocks.',
    date: dateStr(3),
    time: '6:00 PM',
    timezone: 'IST',
    category: 'other',
    country: 'India',
    countryCode: 'IN',
    importance: 'medium',
    previous: '$654.2 Bn',
    forecast: '$658.0 Bn',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['USDINR', 'INR'],
    source: 'RBI',
  },
  {
    id: 'ec_wpi',
    title: 'India WPI Inflation (YoY)',
    description: 'Wholesale Price Index inflation for the previous month. Food and fuel components drive the headline number.',
    date: dateStr(4),
    time: '12:00 PM',
    timezone: 'IST',
    category: 'inflation',
    country: 'India',
    countryCode: 'IN',
    importance: 'medium',
    previous: '2.5%',
    forecast: '2.8%',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['NIFTY', 'INR'],
    source: 'MoSPI',
  },
  {
    id: 'ec_manufacturing_pmi',
    title: 'India Manufacturing PMI (Final)',
    description: 'Final Manufacturing PMI print. Readings above 50 indicate expansion; 58+ signals a strong factory sector.',
    date: dateStr(5),
    time: '10:30 AM',
    timezone: 'IST',
    category: 'industry',
    country: 'India',
    countryCode: 'IN',
    importance: 'medium',
    previous: '57.9',
    forecast: '58.5',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['TATASTEEL', 'HINDALCO', 'LT'],
    source: 'HSBC / S&P Global',
  },
  {
    id: 'ec_trade_deficit',
    title: 'India Trade Deficit (Monthly)',
    description: 'Monthly merchandise trade balance. A narrower deficit is rupee-positive.',
    date: dateStr(5),
    time: '7:00 PM',
    timezone: 'IST',
    category: 'trade',
    country: 'India',
    countryCode: 'IN',
    importance: 'medium',
    previous: '$23.1 Bn',
    forecast: '$21.5 Bn',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['USDINR'],
    source: 'Ministry of Commerce',
  },
  {
    id: 'ec_us_cpi',
    title: 'US CPI Inflation (MoM & YoY)',
    description: 'Consumer Price Index — the Fed\u2019s primary inflation gauge. A hot print could delay rate-cut expectations globally.',
    date: dateStr(6),
    time: '8:30 AM',
    timezone: 'ET',
    category: 'inflation',
    country: 'United States',
    countryCode: 'US',
    importance: 'high',
    previous: '3.1%',
    forecast: '3.0%',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['^IXIC', '^GSPC', 'DXY'],
    source: 'BLS',
  },
  {
    id: 'ec_us_nfp',
    title: 'US Non-Farm Payrolls & Unemployment Rate',
    description: 'Monthly jobs report. Strong job growth keeps the Fed hawkish; weak numbers revive rate-cut bets.',
    date: dateStr(8),
    time: '8:30 AM',
    timezone: 'ET',
    category: 'employment',
    country: 'United States',
    countryCode: 'US',
    importance: 'high',
    previous: '206K',
    forecast: '180K',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['^GSPC', '^IXIC', 'DXY', 'Gold'],
    source: 'BLS',
  },
  {
    id: 'ec_india_unemployment',
    title: 'India Unemployment Rate (Monthly)',
    description: 'CMIE urban unemployment data — a key consumption indicator.',
    date: dateStr(9),
    time: '6:00 PM',
    timezone: 'IST',
    category: 'employment',
    country: 'India',
    countryCode: 'IN',
    importance: 'medium',
    previous: '8.0%',
    forecast: '7.8%',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['NIFTY', 'SENSEX'],
    source: 'CMIE',
  },
  {
    id: 'ec_ecb_rate',
    title: 'ECB Main Refinancing Rate Decision',
    description: 'European Central Bank rate decision and press conference by the ECB President.',
    date: dateStr(10),
    time: '2:15 PM',
    timezone: 'CET',
    category: 'central_bank',
    country: 'Eurozone',
    countryCode: 'EU',
    importance: 'high',
    previous: '3.65%',
    forecast: '3.65%',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['EURINR'],
    source: 'ECB',
  },
  {
    id: 'ec_services_pmi',
    title: 'India Services PMI (Final)',
    description: 'Final Services PMI — 60+ readings signal strong services-led growth.',
    date: dateStr(11),
    time: '10:30 AM',
    timezone: 'IST',
    category: 'industry',
    country: 'India',
    countryCode: 'IN',
    importance: 'medium',
    previous: '61.2',
    forecast: '60.2',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['NIFTYIT', 'INFY', 'TCS'],
    source: 'HSBC / S&P Global',
  },
  {
    id: 'ec_us_gdp',
    title: 'US GDP Growth (QoQ Annualized)',
    description: 'US advance GDP estimate — signals the health of the world\u2019s largest economy.',
    date: dateStr(12),
    time: '8:30 AM',
    timezone: 'ET',
    category: 'gdp',
    country: 'United States',
    countryCode: 'US',
    importance: 'high',
    previous: '2.0%',
    forecast: '2.1%',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['^GSPC', 'DXY'],
    source: 'BEA',
  },
  {
    id: 'ec_boe_mpc',
    title: 'BoE Interest Rate Decision',
    description: 'Bank of England rate decision and vote split.',
    date: dateStr(14),
    time: '12:00 PM',
    timezone: 'GMT',
    category: 'central_bank',
    country: 'United Kingdom',
    countryCode: 'GB',
    importance: 'high',
    previous: '4.50%',
    forecast: '4.50%',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['GBPINR'],
    source: 'Bank of England',
  },

  // ── Further out (2-4 weeks) ─────────────────────────────────────────────
  {
    id: 'ec_china_gdp',
    title: 'China GDP Growth (YoY)',
    description: 'China\u2019s growth print — softness here pressures commodity prices and EM equities.',
    date: dateStr(15),
    time: '10:00 AM',
    timezone: 'CST',
    category: 'gdp',
    country: 'China',
    countryCode: 'CN',
    importance: 'medium',
    previous: '5.2%',
    forecast: '5.0%',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['CNYINR', 'VEDL', 'HINDALCO'],
    source: 'NBS',
  },
  {
    id: 'ec_retail_sales',
    title: 'US Retail Sales (MoM)',
    description: 'US consumer spending gauge — resilience here supports the \u2018no landing\u2019 narrative.',
    date: dateStr(16),
    time: '8:30 AM',
    timezone: 'ET',
    category: 'consumer',
    country: 'United States',
    countryCode: 'US',
    importance: 'medium',
    previous: '0.1%',
    forecast: '0.3%',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['^GSPC', '^IXIC'],
    source: 'Census Bureau',
  },
  {
    id: 'ec_uk_cpi',
    title: 'UK CPI Inflation (YoY)',
    description: 'UK inflation print — services inflation is the BoE\u2019s key watch item.',
    date: dateStr(18),
    time: '7:00 AM',
    timezone: 'GMT',
    category: 'inflation',
    country: 'United Kingdom',
    countryCode: 'GB',
    importance: 'medium',
    previous: '2.3%',
    forecast: '2.2%',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['GBPINR'],
    source: 'ONS',
  },
  {
    id: 'ec_us_trade',
    title: 'US Trade Balance',
    description: 'US trade deficit in goods and services.',
    date: dateStr(20),
    time: '8:30 AM',
    timezone: 'ET',
    category: 'trade',
    country: 'United States',
    countryCode: 'US',
    importance: 'low',
    previous: '-$73.4 Bn',
    forecast: '-$72.0 Bn',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['DXY'],
    source: 'Census Bureau',
  },
  {
    id: 'ec_steel_production',
    title: 'India Steel Production (Monthly)',
    description: 'Monthly crude steel output from the Joint Plant Committee — an industrial activity barometer.',
    date: dateStr(21),
    time: '5:30 PM',
    timezone: 'IST',
    category: 'industry',
    country: 'India',
    countryCode: 'IN',
    importance: 'low',
    previous: '12.4 Mn tonnes',
    forecast: '12.8 Mn tonnes',
    isCompleted: false,
    impact: 'unknown',
    affectedAssets: ['TATASTEEL', 'JSWSTEEL'],
    source: 'Joint Plant Committee',
  },
];

// ──── Category metadata (icons / colors used by clients) ──────────────────

export const economicCalendarCategories: Record<
  EconomicEventCategory,
  { label: string; icon: string; color: string }
> = {
  central_bank: { label: 'Central Bank', icon: '🏦', color: '#8B5CF6' },
  gdp: { label: 'GDP & Growth', icon: '📊', color: '#3B82F6' },
  inflation: { label: 'Inflation', icon: '📈', color: '#EF4444' },
  employment: { label: 'Employment', icon: '💼', color: '#00E676' },
  trade: { label: 'Trade', icon: '🌍', color: '#06B6D4' },
  fiscal: { label: 'Fiscal & Budget', icon: '🏛️', color: '#F59E0B' },
  industry: { label: 'Industry & PMI', icon: '🏭', color: '#F97316' },
  consumer: { label: 'Consumer', icon: '🛒', color: '#EC4899' },
  housing: { label: 'Housing', icon: '🏠', color: '#14B8A6' },
  other: { label: 'Other', icon: '📌', color: '#64748B' },
};
