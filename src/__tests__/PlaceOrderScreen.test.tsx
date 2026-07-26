/**
 * ============================================================================
 * Toroloom — PlaceOrderScreen Integration Tests
 * ============================================================================
 *
 * Verifies that PlaceOrderScreen renders correctly with buy/sell toggle,
 * order type selectors, quantity input, price fields, order summary,
 * balance indicators, and confirmation flow.
 *
 * Uses testID-based queries for reliable element finding.
 */


// ==================== Mock useT hook ====================
const trading = {
  "buySecurities": "Buy Securities",
  "sellSecurities": "Sell Securities",
  "productType": "Product Type",
  "marketDesc": "Buy/Sell at current market price",
  "limitDesc": "Execute only at your specified price or better",
  "stopLossDesc": "Convert to market order when trigger price is hit",
  "stopLossMarketDesc": "Market order that activates at trigger price",
  "cncDesc": "Delivery — settle with actual shares",
  "misDesc": "Intraday — square off by EOD",
  "nrmlDesc": "Normal — for futures & options",
  "owned": "(Owned: {{count}})",
  "max": "Max",
  "limitPrice": "Limit Price (₹)",
  "triggerPrice": "Trigger Price (₹)",
  "enterTriggerPrice": "Enter trigger price",
  "triggerPriceRequired": "Trigger price is required for Stop Loss orders",
  "pricePerShare": "Price per share",
  "shares": "shares",
  "estimatedTotal": "Estimated Total",
  "estCharges": "Est. Charges (brokerage + taxes)",
  "grandTotal": "Grand Total",
  "balanceAvailable": "Available: {{amount}}",
  "insufficientBalance": "Insufficient balance — need {{amount}} more",
  "availableBalance": "Available Balance",
  "stockNotFound": "Stock not found",
  "goBack": "Go Back",
  "processing": "Processing...",
  "triggerPriceRequiredTitle": "Trigger Price Required",
  "triggerPriceRequiredMsg": "Please enter a trigger price for Stop Loss orders.",
  "bioConfirm": "Confirm {{action}} order with {{label}}",
  "orderCancelled": "Order Cancelled",
  "biometricFailed": "Biometric verification failed.",
  "orderBlocked": "Order Blocked",
  "orderPlacedSuccessfully": "Order Placed Successfully!",
  "bought": "Bought",
  "sold": "Sold",
  "of": "of",
  "price": "Price",
  "time": "Time",
  "done": "Done",
  "riskEngineBlocked": "Order blocked by risk engine.",
  "error": "Error",
  "errorNoHolding": "No holding found to sell.",
  "errorGeneric": "There was an error placing your order.",
  "errorInsufficientMargin": "Insufficient margin.",
  "errorInsufficientHoldings": "Insufficient holdings to sell.",
  "errorLimitExceeded": "Position limit exceeded.",
  "errorRejected": "Order rejected by broker.",
  "errorNetwork": "Network error.",
  "errorSessionExpired": "Broker session expired.",
  "errorBroker": "Broker error ({{status}}): {{message}}",
  "orderFailed": "Order Failed",
  "quantityLabel": "Quantity",
  "orderTypeLabel": "Order Type"
};

function resolveT(key: string, params?: Record<string, any>): string {
  const parts = key.split('.');
  const rootNs = parts[0];
  const subKey = parts.slice(1).join('.');
  
  const translations: Record<string, any> = { trading };
  const obj = translations[rootNs];
  if (!obj) {
    const parts2 = key.split('.');
    const lastSeg = parts2[parts2.length - 1] || key;
    return lastSeg
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s: string) => s.toUpperCase())
      .trim();
  }
  
  // Check for plural variant FIRST when count !== 1
  if (params && params.count !== undefined && params.count !== 1) {
    const pluralKey = subKey + '_plural';
    if (pluralKey in obj && typeof obj[pluralKey] === 'string') {
      let result: string = obj[pluralKey];
      result = result.replace(/\{\{(\w+)\}\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
      return result;
    }
  }
  
  // Fall back to singular
  if (subKey in obj && typeof obj[subKey] === 'string') {
    let result: string = obj[subKey];
    if (params) {
      result = result.replace(/\{\{(\w+)\}\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
    }
    return result;
  }
  
  // Fallback: return last key segment as readable text
  const lastSeg = subKey || key;
  return lastSeg
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s: string) => s.toUpperCase())
    .trim();
}

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: resolveT,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
  default: () => ({
    t: resolveT,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { mockStocks, mockHoldings } from '../constants/mockData';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const mockBuyStock = vi.fn(() => Promise.resolve());
const mockSellStock = vi.fn(() => Promise.resolve());
const navMock = { navigate: mockNavigate, goBack: mockGoBack };

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      primaryLight: '#8B83FF',
      primaryDark: '#4A42CC',
      primaryGradient: ['#6C63FF', '#4834D4'] as const,
      secondary: '#FF6B6B',
      secondaryGradient: ['#FF6B6B', '#EE5A24'] as const,
      success: '#00C853',
      successGradient: ['#00C853', '#009624'] as const,
      danger: '#FF1744',
      warning: '#FFC107',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      marketNeutral: '#FFC107',
      text: '#FFFFFF',
      textSecondary: '#B0B0D0',
      textMuted: '#6E6E9A',
      white: '#FFFFFF',
      bg: '#0D0D2B',
      bgSecondary: '#1A1A3E',
      bgCard: '#222255',
      bgCardLight: '#2A2A5E',
      bgInput: '#1E1E4A',
      bgDark: '#070720',
      bgOverlay: 'rgba(0,0,0,0.5)',
      border: '#2A2A5E',
      borderLight: '#3A3A7E',
      divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

vi.mock('../store/marketStore', () => ({
  useMarketStore: vi.fn(() => ({
    stocks: mockStocks,
  })),
}));

vi.mock('../store/portfolioStore', () => ({
  usePortfolioStore: vi.fn(() => ({
    buyStock: mockBuyStock,
    sellStock: mockSellStock,
    holdings: mockHoldings,
  })),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: {
      id: 'user_1',
      name: 'Rahul Sharma',
      email: 'rahul.sharma@email.com',
      balance: 2500000,
    },
  })),
}));

vi.mock('../hooks/useStaggeredAnimation', () => ({
  useStaggeredAnimation: vi.fn(() => ({
    animatedStyles: [{ opacity: 1, transform: [{ translateY: 0 }] }],
    reset: vi.fn(),
    startAnimation: vi.fn(),
  })),
}));

// ==================== Imports ====================

import PlaceOrderScreen from '../screens/trade/PlaceOrderScreen';

// ==================== Helpers ====================

const defaultRoute = {
  params: { stockId: 'RELIANCE', symbol: 'RELIANCE', tradeType: 'buy' },
};

function renderScreen() {
  return render(<PlaceOrderScreen route={defaultRoute} navigation={navMock} />);
}

/** Check if a rendered element's joined text children contain the given string. */
function hasText(instance: any, text: string): boolean {
  const children = instance.props?.children;
  if (typeof children === 'string') return children.includes(text);
  if (Array.isArray(children)) {
    const joined = children.filter((c: any) => typeof c === 'string').join('');
    return joined.includes(text);
  }
  return JSON.stringify(instance.props).includes(text);
}

// ==================== Tests ====================

describe('PlaceOrderScreen — Header & Stock Info', () => {
  afterEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  it('renders without crashing', () => {
    const { toJSON } = renderScreen();
    expect(toJSON).not.toBeNull();
  });

  it('renders header title with Buy Securities by default', () => {
    const { getByTestId } = renderScreen();
    const title = getByTestId('headerTitle');
    expect(hasText(title, 'Buy Securities')).toBe(true);
  });

  it('renders header title with Sell Securities when tradeType is sell', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE', tradeType: 'sell' } };
    const { getByTestId } = render(
      <PlaceOrderScreen route={route} navigation={navMock} />
    );
    const title = getByTestId('headerTitle');
    expect(hasText(title, 'Sell Securities')).toBe(true);
  });

  it('renders stock symbol in header', () => {
    const { getByText } = renderScreen();
    expect(getByText('RELIANCE')).toBeDefined();
  });

  it('renders stock name', () => {
    const { getByText } = renderScreen();
    expect(getByText('Reliance Industries Ltd.')).toBeDefined();
  });

  it('renders stock price', () => {
    const { getByText } = renderScreen();
    expect(getByText('₹2,890.50')).toBeDefined();
  });

  it('renders change percent in header', () => {
    const { getByText } = renderScreen();
    expect(getByText(/\+1\.59%/)).toBeDefined();
  });

  it('navigates back when close button is pressed', () => {
    const { getByTestId } = renderScreen();
    act(() => {
      fireEvent.press(getByTestId('backBtn'));
    });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders stock not found fallback — defaults to first stock', () => {
    const route = { params: { stockId: 'NONEXISTENT', symbol: 'NONEXISTENT', tradeType: 'buy' } };
    const { getByText } = render(
      <PlaceOrderScreen route={route} navigation={navMock} />
    );
    expect(getByText('RELIANCE')).toBeDefined();
  });
});

// ==================== Buy/Sell Toggle ====================

describe('PlaceOrderScreen — Buy/Sell Toggle', () => {
  afterEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  it('renders Buy and Sell toggle buttons', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('buyToggle')).toBeDefined();
    expect(getByTestId('sellToggle')).toBeDefined();
  });

  it('toggles to Sell when Sell button is pressed', () => {
    const { getByTestId } = renderScreen();
    act(() => {
      fireEvent.press(getByTestId('sellToggle'));
    });
    const title = getByTestId('headerTitle');
    expect(hasText(title, 'Sell Securities')).toBe(true);
  });

  it('toggles back to Buy when Buy button is pressed after Sell', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE', tradeType: 'sell' } };
    const { getByTestId } = render(
      <PlaceOrderScreen route={route} navigation={navMock} />
    );
    act(() => {
      fireEvent.press(getByTestId('buyToggle'));
    });
    const title = getByTestId('headerTitle');
    expect(hasText(title, 'Buy Securities')).toBe(true);
  });
});

// ==================== Order Type Selector ====================

describe('PlaceOrderScreen — Order Type Selector', () => {
  it('renders Order Type section label', () => {
    const { getByText } = renderScreen();
    expect(getByText('Order Type')).toBeDefined();
  });

  it('renders all order type chips', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('orderType_MARKET')).toBeDefined();
    expect(getByTestId('orderType_LIMIT')).toBeDefined();
    expect(getByTestId('orderType_SL')).toBeDefined();
    expect(getByTestId('orderType_SL-M')).toBeDefined();
  });

  it('shows MARKET order type description by default', () => {
    const { getByText } = renderScreen();
    expect(getByText('Buy/Sell at current market price')).toBeDefined();
  });

  it('shows Limit Price input when LIMIT is selected', () => {
    const { getByTestId, getByText } = renderScreen();
    act(() => {
      fireEvent.press(getByTestId('orderType_LIMIT'));
    });
    // After selecting LIMIT, the Limit Price field label should appear
    expect(getByText('Limit Price (₹)')).toBeDefined();
  });

  it('shows Limit Price and Trigger Price when SL is selected', () => {
    const { getByTestId, getByText } = renderScreen();
    act(() => {
      fireEvent.press(getByTestId('orderType_SL'));
    });
    expect(getByText('Limit Price (₹)')).toBeDefined();
    expect(getByText('Trigger Price (₹)')).toBeDefined();
  });

  it('shows Trigger Price when SL-M is selected', () => {
    const { getByTestId, getByText } = renderScreen();
    act(() => {
      fireEvent.press(getByTestId('orderType_SL-M'));
    });
    expect(getByText('Trigger Price (₹)')).toBeDefined();
  });

  it('does not show limit or trigger price inputs when MARKET is selected (default)', () => {
    const { queryByText } = renderScreen();
    expect(queryByText('Limit Price (₹)')).toBeNull();
    expect(queryByText('Trigger Price (₹)')).toBeNull();
  });
});

// ==================== Product Type Selector ====================

describe('PlaceOrderScreen — Product Type Selector', () => {
  it('renders Product Type section label', () => {
    const { getByText } = renderScreen();
    expect(getByText('Product Type')).toBeDefined();
  });

  it('renders all product type chips', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('productType_CNC')).toBeDefined();
    expect(getByTestId('productType_MIS')).toBeDefined();
    expect(getByTestId('productType_NRML')).toBeDefined();
  });

  it('shows CNC description by default', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Delivery — settle with actual shares/)).toBeDefined();
  });
});

// ==================== Quantity Input ====================

describe('PlaceOrderScreen — Quantity Input', () => {
  it('renders Quantity section label', () => {
    const { getByText } = renderScreen();
    expect(getByText('Quantity')).toBeDefined();
  });

  it('renders quick quantity preset buttons', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('quickQty_10')).toBeDefined();
    expect(getByTestId('quickQty_50')).toBeDefined();
    expect(getByTestId('quickQty_100')).toBeDefined();
    expect(getByTestId('quickQty_Max')).toBeDefined();
  });
});

// ==================== Order Summary ====================

describe('PlaceOrderScreen — Order Summary', () => {
  it('shows Order Summary card when quantity is entered via quick preset', () => {
    const { getByTestId, getByText } = renderScreen();
    act(() => {
      fireEvent.press(getByTestId('quickQty_10'));
    });
    expect(getByText('Order Summary')).toBeDefined();
    expect(getByText('10 shares')).toBeDefined();
  });

  it('shows Estimated Total in summary', () => {
    const { getByTestId, getByText } = renderScreen();
    act(() => {
      fireEvent.press(getByTestId('quickQty_10'));
    });
    expect(getByText('Estimated Total')).toBeDefined();
  });

  it('shows Grand Total in summary', () => {
    const { getByTestId, getByText } = renderScreen();
    act(() => {
      fireEvent.press(getByTestId('quickQty_10'));
    });
    expect(getByText('Grand Total')).toBeDefined();
  });

  it('shows available balance in summary for buy mode', () => {
    const { getByTestId, getByText } = renderScreen();
    act(() => {
      fireEvent.press(getByTestId('quickQty_10'));
    });
    expect(getByText(/Available/)).toBeDefined();
  });
});

// ==================== Bottom Action Bar ====================

describe('PlaceOrderScreen — Bottom Action Bar', () => {
  it('shows Available Balance label when quantity is empty', () => {
    const { getByText } = renderScreen();
    expect(getByText('Available Balance')).toBeDefined();
  });

  it('shows Total label when quantity is entered', () => {
    const { getByTestId, getByText } = renderScreen();
    act(() => {
      fireEvent.press(getByTestId('quickQty_10'));
    });
    expect(getByText('Total')).toBeDefined();
  });

  it('renders place order button', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('placeOrderBtn')).toBeDefined();
  });
});

// ==================== Sell Mode ====================

describe('PlaceOrderScreen — Sell Mode', () => {
  it('shows owned quantity in sell mode', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE', tradeType: 'sell' } };
    const { getByText } = render(
      <PlaceOrderScreen route={route} navigation={navMock} />
    );
    expect(getByText(/Owned: 50/)).toBeDefined();
  });

  it('renders Sell Securities header in sell mode', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE', tradeType: 'sell' } };
    const { getByTestId } = render(
      <PlaceOrderScreen route={route} navigation={navMock} />
    );
    const title = getByTestId('headerTitle');
    expect(hasText(title, 'Sell Securities')).toBe(true);
  });
});

// ==================== Order Placement Flow ====================

describe('PlaceOrderScreen — Order Placement Flow (async)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockBuyStock.mockClear();
    mockSellStock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls buyStock and shows confirmation when Buy button is pressed with quantity', async () => {
    mockBuyStock.mockResolvedValue(undefined);
    const { getByTestId } = renderScreen();

    act(() => {
      fireEvent.press(getByTestId('quickQty_10'));
    });
    act(() => {
      fireEvent.press(getByTestId('placeOrderBtn'));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(mockBuyStock).toHaveBeenCalled();
    expect(getByTestId('confirmationModal')).toBeDefined();
  });

  it('shows order placed successfully message after buy', async () => {
    mockBuyStock.mockResolvedValue(undefined);
    const { getByTestId, getByText } = renderScreen();

    act(() => {
      fireEvent.press(getByTestId('quickQty_10'));
    });
    act(() => {
      fireEvent.press(getByTestId('placeOrderBtn'));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(getByText('Order Placed Successfully!')).toBeDefined();
  });

  it('calls sellStock when Sell mode with quantity', async () => {
    mockSellStock.mockResolvedValue(undefined);
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE', tradeType: 'sell' } };
    const { getByTestId } = render(
      <PlaceOrderScreen route={route} navigation={navMock} />
    );

    act(() => {
      fireEvent.press(getByTestId('quickQty_10'));
    });
    act(() => {
      fireEvent.press(getByTestId('placeOrderBtn'));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(mockSellStock).toHaveBeenCalled();
  });

  it('navigates back via goBack when Done is pressed on confirmation', async () => {
    mockBuyStock.mockResolvedValue(undefined);
    const { getByTestId } = renderScreen();

    act(() => {
      fireEvent.press(getByTestId('quickQty_10'));
    });
    act(() => {
      fireEvent.press(getByTestId('placeOrderBtn'));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(getByTestId('doneBtn')).toBeDefined();

    act(() => {
      fireEvent.press(getByTestId('doneBtn'));
    });

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('does not call buyStock until order processing completes', async () => {
    mockBuyStock.mockClear();
    const { getByTestId } = renderScreen();

    act(() => {
      fireEvent.press(getByTestId('quickQty_10'));
    });
    act(() => {
      fireEvent.press(getByTestId('placeOrderBtn'));
    });

    // buyStock should NOT be called yet (still processing the 1500ms delay)
    expect(mockBuyStock).not.toHaveBeenCalled();

    // Advance past the delay — now it should be called
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(mockBuyStock).toHaveBeenCalled();
  });
});
