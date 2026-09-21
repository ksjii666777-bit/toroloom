/**
 * ============================================================================
 * Toroloom — US Markets Screen Tests
 * ============================================================================
 *
 * Tests that USMarketsScreen renders correctly with mock data, tabs,
 * search functionality, live data status badge, crypto navigation,
 * and market hours info card.
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mocks ====================

const mockNavigate = vi.fn();
const mockGetStatus = vi.fn();
const mockGetHolidays = vi.fn().mockResolvedValue({
  success: true,
  data: {
    india: { year: 2026, holidays: [{ date: '2026-08-17', name: 'Parsi New Year' }] },
  },
  fetchedAt: '2026-01-01T00:00:00Z',
});

const mockGetIndexHistory = vi.fn().mockResolvedValue({
  success: true,
  data: {
    SENSEX: Array.from({ length: 30 }, (_, i) => ({
      timestamp: 1700000000000 + i * 86400000,
      price: 75000 + i * 100,
    })),
    NIFTY: Array.from({ length: 30 }, (_, i) => ({
      timestamp: 1700000000000 + i * 86400000,
      price: 23000 + i * 50,
    })),
  },
  generatedAt: '2026-01-01T00:00:00Z',
});

vi.mock('../services/api/globalMarkets', () => ({
  globalMarketsApi: {
    getStatus: (...args: any[]) => mockGetStatus(...args),
    getStocks: vi.fn().mockResolvedValue(null),
    getIndices: vi.fn().mockResolvedValue(null),
    getCrypto: vi.fn().mockResolvedValue(null),
    getEuropeanStocks: vi.fn().mockResolvedValue(null),
    getAsianStocks: vi.fn().mockResolvedValue(null),
    getHolidays: (...args: any[]) => mockGetHolidays(...args),
    getIndexHistory: (...args: any[]) => mockGetIndexHistory(...args),
  },
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', primaryLight: '#8B83FF',
      secondary: '#FF6B6B', success: '#00C853', danger: '#FF1744',
      marketUp: '#00C853', marketDown: '#FF1744',
      text: '#FFFFFF', textSecondary: '#B0B0D0', textMuted: '#6E6E9A',
      bg: '#0D0D2B', bgSecondary: '#1A1A3E',
      bgCard: '#222255', bgInput: '#1E1E4A',
      border: '#2A2A5E', divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
// ==================== Imports ====================

import USMarketsScreen from '../screens/markets/USMarketsScreen';

// ==================== Helpers ====================

async function advanceAndFlush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
  // flush microtasks for fetchLiveData rejection/resolution
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

// ==================== Tests ====================

describe('USMarketsScreen — Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Default: API is not available (mock mode)
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders the screen title', async () => {
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();
    const title = queryByText('Global Markets');
    expect(title).not.toBeNull();
  });

  it('renders subtitle with market categories', async () => {
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();
    const subtitle = queryByText(/US.*ETFs.*Crypto/);
    expect(subtitle).not.toBeNull();
  });

  it('renders search bar', async () => {
    const { queryByPlaceholderText } = render(<USMarketsScreen />);
    await advanceAndFlush();
    const search = queryByPlaceholderText('Search symbols...');
    expect(search).not.toBeNull();
  });
});

describe('USMarketsScreen — Tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders all 4 tab buttons', async () => {
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();
    expect(queryByText('Indices')).not.toBeNull();
    expect(queryByText('Stocks')).not.toBeNull();
    expect(queryByText('ETFs')).not.toBeNull();
    expect(queryByText('Crypto')).not.toBeNull();
  });

  it('shows indices by default', async () => {
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();
    // Indices tab is active by default — should show US Market Hours card
    const hoursCard = queryByText(/US Market Hours/);
    expect(hoursCard).not.toBeNull();
  });

  it('shows market hours info card with correct text', async () => {
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();
    const nyse = queryByText(/NYSE/);
    expect(nyse).not.toBeNull();
  });
});

describe('USMarketsScreen — Live/Mock Badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => { vi.useRealTimers(); });

  it('shows Mock badge when backend reports no APIs configured', async () => {
    // Backend returns { marketstackConfigured: false, coinGeckoConfigured: false } from /api/global-markets/status
    mockGetStatus.mockResolvedValue({ marketstackConfigured: false, coinGeckoConfigured: false });
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();

    const mockBadge = queryByText('Mock');
    expect(mockBadge).not.toBeNull();
  });

  it('shows Live badge when backend APIs are configured', async () => {
    // Backend returns { marketstackConfigured: true, coinGeckoConfigured: true } from /api/global-markets/status
    mockGetStatus.mockResolvedValue({ marketstackConfigured: true, coinGeckoConfigured: true });
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();

    const liveBadge = queryByText('Live');
    expect(liveBadge).not.toBeNull();
  });
});

describe('USMarketsScreen — Indices Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders index cards with names like S&P 500', async () => {
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();
    const sp = queryByText('S&P 500');
    const nasdaq = queryByText('NASDAQ');
    expect(sp).not.toBeNull();
    expect(nasdaq).not.toBeNull();
  });
});

describe('USMarketsScreen — Search Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('filters stocks when search query is entered', async () => {
    const { getByText } = render(<USMarketsScreen />);
    await advanceAndFlush();

    // Switch to Stocks tab
    const stocksTab = getByText('Stocks');
    await act(async () => {
      // Find the stock tab and trigger onPress
      const parents = stocksTab.parent;
      if (parents) {
        const parentPressable = parents.parent;
        if (parentPressable) {
          fireEvent.press(parentPressable);
        }
      }
    });
    await advanceAndFlush();

    // The stocks tab should render stock symbols from mock data
    const stockSymbol = getByText('AAPL');
    expect(stockSymbol).not.toBeNull();
  });
});

describe('USMarketsScreen — Crypto Tab Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('navigates to CryptoDetail when a crypto is tapped', async () => {
    const { getByText } = render(<USMarketsScreen />);
    await advanceAndFlush();

    // Switch to Crypto tab
    const cryptoTab = getByText('Crypto');
    await act(async () => {
      const parents = cryptoTab.parent;
      if (parents) {
        const parentPressable = parents.parent;
        if (parentPressable) {
          fireEvent.press(parentPressable);
        }
      }
    });
    await advanceAndFlush();

    // Now crypto list is shown — tap on Bitcoin row
    const bitcoin = getByText('BTC');
    await act(async () => {
      fireEvent.press(bitcoin);
    });

    // Should navigate to CryptoDetail with bitcoin params
    expect(mockNavigate).toHaveBeenCalledWith('CryptoDetail', {
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      coinName: 'Bitcoin',
    });
  });
});

describe('USMarketsScreen — ETFs Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('shows ETFs tab with info card', async () => {
    const { getByText, queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();

    // Switch to ETFs tab
    const etfsTab = getByText('ETFs');
    await act(async () => {
      const parents = etfsTab.parent;
      if (parents) {
        const parentPressable = parents.parent;
        if (parentPressable) {
          fireEvent.press(parentPressable);
        }
      }
    });
    await advanceAndFlush();

    const infoText = queryByText(/AUM over/);
    expect(infoText).not.toBeNull();
  });
});

describe('USMarketsScreen — Country Picker (Global tab)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
  });

  afterEach(() => { vi.useRealTimers(); });

  async function openGlobalTab() {
    const utils = render(<USMarketsScreen />);
    await advanceAndFlush();
    await act(async () => {
      const globalTab = utils.getByTestId('market-tab-global');
      fireEvent.press(globalTab);
    });
    await advanceAndFlush();
    return utils;
  }

  it('renders 11 country chips on the Global tab', async () => {
    const { getByText, getByTestId } = await openGlobalTab();
    expect(getByText('India')).not.toBeNull();
    expect(getByText('US')).not.toBeNull();
    expect(getByText('UK')).not.toBeNull();
    expect(getByText('Japan')).not.toBeNull();
    expect(getByText('Germany')).not.toBeNull();
    expect(getByText('China')).not.toBeNull();
    expect(getByText('Singapore')).not.toBeNull();
    expect(getByText('Australia')).not.toBeNull();
    expect(getByText('Hong Kong')).not.toBeNull();
    expect(getByText('Switzerland')).not.toBeNull();
    expect(getByText('South Korea')).not.toBeNull();
    // testIDs present for each chip
    expect(getByTestId('country-chip-india')).not.toBeNull();
    expect(getByTestId('country-chip-japan')).not.toBeNull();
    expect(getByTestId('country-chip-singapore')).not.toBeNull();
    expect(getByTestId('country-chip-southkorea')).not.toBeNull();
  });

  it('Japan view shows Nikkei index, Japanese stocks, yen pairs and Japan market hours', async () => {
    const { getByTestId, queryByText } = await openGlobalTab();

    await act(async () => {
      fireEvent.press(getByTestId('country-chip-japan'));
    });
    await advanceAndFlush();

    // Index (IndexCard renders shortName)
    expect(queryByText('NIKKEI')).not.toBeNull();
    // Top stocks (StockRow renders symbol)
    expect(queryByText('TM')).not.toBeNull();   // Toyota
    expect(queryByText('SONY')).not.toBeNull();
    // Currency pairs relevant to Japan
    expect(queryByText('USD/JPY')).not.toBeNull();
    expect(queryByText('JPY/INR')).not.toBeNull();
    // Market hours card
    expect(queryByText('Japan Market Hours')).not.toBeNull();
    // Default grouping headers are hidden
    expect(queryByText('Asia-Pacific')).toBeNull();
  });

  it('India view shows Sensex/Nifty, Indian stocks and INR pairs', async () => {
    const { getByTestId, queryByText } = await openGlobalTab();

    await act(async () => {
      fireEvent.press(getByTestId('country-chip-india'));
    });
    await advanceAndFlush();

    expect(queryByText('SENSEX')).not.toBeNull();
    expect(queryByText('NIFTY')).not.toBeNull();
    expect(queryByText('RELIANCE')).not.toBeNull();
    expect(queryByText('TCS')).not.toBeNull();
    expect(queryByText('USD/INR')).not.toBeNull();
    expect(queryByText('Indian Market Hours')).not.toBeNull();
  });

  it('tapping the active chip again returns to the default Europe/Asia grouping', async () => {
    const { getByTestId, queryByText } = await openGlobalTab();

    await act(async () => {
      fireEvent.press(getByTestId('country-chip-japan'));
    });
    await advanceAndFlush();
    expect(queryByText('Japan Market Hours')).not.toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('country-chip-japan'));
    });
    await advanceAndFlush();

    // Default grouping restored
    expect(queryByText('European Market Hours')).not.toBeNull();
    expect(queryByText('Asia-Pacific Market Hours')).not.toBeNull();
    expect(queryByText('Japan Market Hours')).toBeNull();
  });
});

describe('USMarketsScreen — Market open/closed badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Freeze the clock at Mon 2026-07-13 10:30 IST (05:00 UTC):
    // India = open, Japan = open (afternoon), US = closed (1:00 AM ET Monday)
    vi.useFakeTimers({ now: new Date('2026-07-13T05:00:00Z') });
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
  });

  afterEach(() => { vi.useRealTimers(); });

  async function openGlobal(u: ReturnType<typeof render>) {
    await act(async () => {
      const globalTab = u.getByTestId('market-tab-global');
      fireEvent.press(globalTab);
    });
    await advanceAndFlush();
  }

  it('shows a green "Market Open" badge on the India country view', async () => {
    const utils = render(<USMarketsScreen />);
    await advanceAndFlush();
    await openGlobal(utils);
    await act(async () => {
      fireEvent.press(utils.getByTestId('country-chip-india'));
    });
    await advanceAndFlush();

    expect(utils.getByText('Market Open')).not.toBeNull();
  });

  it('shows "Market Closed" + "Opens in ..." on the US country view', async () => {
    const utils = render(<USMarketsScreen />);
    await advanceAndFlush();
    await openGlobal(utils);
    await act(async () => {
      fireEvent.press(utils.getByTestId('country-chip-us'));
    });
    await advanceAndFlush();

    expect(utils.getByText('Market Closed')).not.toBeNull();
    // 1:00 AM ET Monday → opens 9:30 AM = 8h 30m later
    expect(utils.getByText(/Opens in 8h 30m/)).not.toBeNull();
  });

  it('shows the Pre-Open badge for India at 9:05 IST', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-13T03:35:00Z') });
    const utils = render(<USMarketsScreen />);
    await advanceAndFlush();
    await act(async () => {
      const globalTab = utils.getByTestId('market-tab-global');
      fireEvent.press(globalTab);
    });
    await advanceAndFlush();
    await act(async () => {
      fireEvent.press(utils.getByTestId('country-chip-india'));
    });
    await advanceAndFlush();

    expect(utils.getByText('Pre-Open')).not.toBeNull();
  });
});

describe('USMarketsScreen — Holiday badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Freeze at Mon 2026-08-17 10:30 IST — India has 'Parsi New Year' in the
    // mocked holiday calendar, so the India view must show the holiday badge
    vi.useFakeTimers({ now: new Date('2026-08-17T05:00:00Z') });
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('shows the amber "Market Holiday" badge with the holiday name on a holiday', async () => {
    const utils = render(<USMarketsScreen />);
    await advanceAndFlush();
    await act(async () => {
      const globalTab = utils.getByTestId('market-tab-global');
      fireEvent.press(globalTab);
    });
    await advanceAndFlush();
    await act(async () => {
      fireEvent.press(utils.getByTestId('country-chip-india'));
    });
    await advanceAndFlush();

    expect(utils.getByText('Market Holiday')).not.toBeNull();
    expect(utils.getByText('Parsi New Year')).not.toBeNull();
  });
});

describe('USMarketsScreen — Index sparklines (country view)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-08-18T05:00:00Z') }); // Tuesday
  });

  afterEach(() => { vi.useRealTimers(); });

  async function openIndiaView(utils: ReturnType<typeof render>) {
    await advanceAndFlush();
    await act(async () => {
      const globalTab = utils.getByTestId('market-tab-global');
      fireEvent.press(globalTab);
    });
    await advanceAndFlush();
    await act(async () => {
      fireEvent.press(utils.getByTestId('country-chip-india'));
    });
    await advanceAndFlush();
  }

  // The testID lands on BOTH the TrendSparkline component and its inner Svg
  // (the prop is forwarded), so count only inner Svg instances — those carry
  // children (the Polyline), the outer component does not.
  const sparklineSvgs = (utils: ReturnType<typeof render>, testID: string) =>
    utils.root.findAll(
      (n) => n.props.testID === testID && n.props.children != null,
    );

  it('renders sparklines on India index cards once history loads', async () => {
    const utils = render(<USMarketsScreen />);
    await openIndiaView(utils);

    // India has 2 indices (SENSEX + NIFTY), both get a trend line
    expect(sparklineSvgs(utils, 'index-sparkline').length).toBe(2);
  });

  it('shows the primary index trend sparkline beside the status badge', async () => {
    const utils = render(<USMarketsScreen />);
    await openIndiaView(utils);

    expect(sparklineSvgs(utils, 'header-sparkline').length).toBe(1);
  });

  it('hides sparklines gracefully when the history API fails', async () => {
    mockGetIndexHistory.mockRejectedValueOnce(new Error('History unavailable'));
    const utils = render(<USMarketsScreen />);
    await openIndiaView(utils);

    expect(sparklineSvgs(utils, 'index-sparkline').length).toBe(0);
    // Index cards themselves still render (SENSEX card present)
    expect(utils.getByText('SENSEX')).not.toBeNull();
  });
});

describe('USMarketsScreen — New countries (Global tab)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
    vi.useFakeTimers({ now: new Date('2026-08-18T05:00:00Z') }); // Tuesday 10:30 IST
  });

  afterEach(() => { vi.useRealTimers(); });

  async function openCountry(utils: ReturnType<typeof render>, key: string) {
    await advanceAndFlush();
    await act(async () => {
      const globalTab = utils.getByTestId('market-tab-global');
      fireEvent.press(globalTab);
    });
    await advanceAndFlush();
    await act(async () => {
      fireEvent.press(utils.getByTestId(`country-chip-${key}`));
    });
    await advanceAndFlush();
  }

  it('Singapore view shows STI, SGX-listed stocks, SGD pair and market hours', async () => {
    const utils = render(<USMarketsScreen />);
    await openCountry(utils, 'singapore');

    expect(utils.getByText('STI')).not.toBeNull();
    expect(utils.getByText('DBS Group Holdings')).not.toBeNull();
    expect(utils.getByText('SGD/INR')).not.toBeNull();
    expect(utils.getByText('Singapore Market Hours')).not.toBeNull();
  });

  it('Hong Kong view shows Hang Seng, HKEX stocks and HKD pair', async () => {
    const utils = render(<USMarketsScreen />);
    await openCountry(utils, 'hongkong');

    expect(utils.getByText('HSI')).not.toBeNull();
    expect(utils.getByText('Alibaba Group')).not.toBeNull();
    expect(utils.getByText('HKD/INR')).not.toBeNull();
    expect(utils.getByText('Hong Kong Market Hours')).not.toBeNull();
  });

  it('Switzerland view shows SMI, SIX stocks and market hours (no INR pair available)', async () => {
    const utils = render(<USMarketsScreen />);
    await openCountry(utils, 'switzerland');

    expect(utils.getByText('SMI')).not.toBeNull();
    expect(utils.getByText('Swiss Market Hours')).not.toBeNull();
    // No currency-pairs section is rendered when the country has none
    expect(utils.queryByText('Currency Rates')).toBeNull();
  });

  it('South Korea view shows KOSPI and KRX stocks', async () => {
    const utils = render(<USMarketsScreen />);
    await openCountry(utils, 'southkorea');

    expect(utils.getByText('KOSPI')).not.toBeNull();
    expect(utils.getByText('Samsung Electronics')).not.toBeNull();
    expect(utils.getByText('South Korean Market Hours')).not.toBeNull();
  });

  it('Australia view shows ASX 200 and ASX stocks', async () => {
    const utils = render(<USMarketsScreen />);
    await openCountry(utils, 'australia');

    expect(utils.getByText('ASX 200')).not.toBeNull();
    expect(utils.getByText('Australian Market Hours')).not.toBeNull();
  });
});

describe('USMarketsScreen — World clock strip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
    vi.useFakeTimers({ now: new Date('2026-08-18T05:00:00Z') }); // Tue 10:30 IST
  });

  afterEach(() => { vi.useRealTimers(); });

  async function openGlobalTab(utils: ReturnType<typeof render>) {
    await advanceAndFlush();
    await act(async () => {
      const globalTab = utils.getByTestId('market-tab-global');
      fireEvent.press(globalTab);
    });
    await advanceAndFlush();
  }

  it('renders a world-clock card for all 11 markets on the Global tab', async () => {
    const utils = render(<USMarketsScreen />);
    await openGlobalTab(utils);

    // The RN View mock nests instances sharing a testID — count distinct ids
    const ids = new Set(
      utils.root
        .findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('world-clock-'))
        .map((n) => n.props.testID as string),
    );
    expect(ids.size).toBe(11);
    expect(ids.has('world-clock-india')).toBe(true);
    expect(ids.has('world-clock-singapore')).toBe(true);
    expect(ids.has('world-clock-southkorea')).toBe(true);
  });

  it('shows India local time (10:30) in OPEN state on Tuesday 10:30 IST', async () => {
    const utils = render(<USMarketsScreen />);
    await openGlobalTab(utils);

    expect(utils.getByText('10:30')).not.toBeNull();
  });

  it('shows the next-open countdown for closed markets (US opens in 8h 30m)', async () => {
    const utils = render(<USMarketsScreen />);
    await openGlobalTab(utils);

    // Tue 10:30 IST = Tue 01:00 EDT → NYSE opens 09:30 EDT = 8h 30m later
    expect(utils.getByText('Opens in 8h 30m')).not.toBeNull();
  });
});
