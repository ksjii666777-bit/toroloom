import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from './testUtils';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', marketUp: '#00C853', bgCard: '#1A1A2E',
      bgCardLight: '#25253D', bgInput: '#1E1E32', border: '#2A2A44', divider: '#2A2A44',
      bgSecondary: '#16162A', warning: '#FFC107', borderLight: '#3A3A54',
    },
  }),
}));

const mockNavigate = vi.fn();
const mockAddTransaction = vi.fn();
const mockUpdateBalance = vi.fn();

vi.mock('../store/fundStore', () => ({
  useFundStore: () => ({
    addTransaction: mockAddTransaction,
  }),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user1', username: 'TraderJoe', email: 'trader@example.com', balance: 25000 },
    updateBalance: mockUpdateBalance,
  }),
}));

import AddFundsScreen from '../screens/funds/AddFundsScreen';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddFundsScreen', () => {
  it('renders the screen title', () => {
    const { getByText } = render(<AddFundsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Add Funds')).toBeDefined();
  });

  it('renders current balance', () => {
    const { getByText } = render(<AddFundsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('₹25,000')).toBeDefined();
  });

  it('renders the amount input', () => {
    const { getByPlaceholderText } = render(<AddFundsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByPlaceholderText('Enter custom amount')).toBeDefined();
  });

  it('renders preset amount buttons', () => {
    const { getByText } = render(<AddFundsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('₹5.0K')).toBeDefined();
    expect(getByText('₹10.0K')).toBeDefined();
  });

  it('renders UPI payment option', () => {
    const { getByText } = render(<AddFundsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('UPI')).toBeDefined();
  });

  it('renders Net Banking option', () => {
    const { getByText } = render(<AddFundsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Net Banking')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<AddFundsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(toJSON()).toBeTruthy();
  });
});
