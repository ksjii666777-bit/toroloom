import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react-test-renderer';
import { render } from './testUtils';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', marketUp: '#00C853', bgCard: '#1A1A2E',
      bgCardLight: '#25253D', bgInput: '#1E1E32', border: '#2A2A44', divider: '#2A2A44',
      bgSecondary: '#16162A', warning: '#FFC107', borderLight: '#3A3A54',
      danger: '#FF1744', white: '#FFFFFF', transparent: 'transparent', success: '#00C853',
    },
  }),
}));

const mockNavigate = vi.fn();
const mockLogout = vi.fn();

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user1', name: 'TraderJoe', email: 'trader@example.com', balance: 2500000 },
    isLoggedIn: true,
    logout: mockLogout,
  }),
}));

vi.mock('../store/gamificationStore', () => ({
  useGamificationStore: () => ({
    userLevel: { level: 1, xp: 0, xpToNext: 1000 },
    badges: [
      { id: 'b1', icon: '🏆', name: 'First Trade', unlocked: true },
      { id: 'b2', icon: '⭐', name: 'Quick Learner', unlocked: false },
    ],
  }),
}));

import MoreScreen from '../screens/tabs/MoreScreen';

beforeEach(() => {
  vi.clearAllMocks();
});

function renderWithTimeTravel(jsx: React.ReactElement) {
  vi.useFakeTimers();
  const result = render(jsx);
  act(() => { vi.advanceTimersByTime(500); });
  return { ...result, cleanup: () => { result.unmount(); vi.useRealTimers(); } };
}

describe('MoreScreen', () => {
  it('renders the screen title', () => {
    const { getByText, cleanup } = renderWithTimeTravel(<MoreScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('More')).toBeDefined();
    cleanup();
  });

  it('renders the user name', () => {
    const { getByText, cleanup } = renderWithTimeTravel(<MoreScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('TraderJoe')).toBeDefined();
    cleanup();
  });

  it('renders the user email', () => {
    const { getByText, cleanup } = renderWithTimeTravel(<MoreScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('trader@example.com')).toBeDefined();
    cleanup();
  });

  it('renders quick action buttons', () => {
    const { getByText, cleanup } = renderWithTimeTravel(<MoreScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Add Funds')).toBeDefined();
    expect(getByText('Withdraw')).toBeDefined();
    expect(getByText('Transfer')).toBeDefined();
    expect(getByText('UPI')).toBeDefined();
    cleanup();
  });

  it('renders menu section titles', () => {
    const { getByText, cleanup } = renderWithTimeTravel(<MoreScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Investments')).toBeDefined();
    expect(getByText('Learn & Grow')).toBeDefined();
    expect(getByText('Account')).toBeDefined();
    cleanup();
  });

  it('renders menu items', () => {
    const { getByText, cleanup } = renderWithTimeTravel(<MoreScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Fund Dashboard')).toBeDefined();
    expect(getByText('Mutual Funds')).toBeDefined();
    expect(getByText('Reports')).toBeDefined();
    expect(getByText('Help & Support')).toBeDefined();
    cleanup();
  });

  it('renders Log Out button', () => {
    const { getByText, cleanup } = renderWithTimeTravel(<MoreScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Log Out')).toBeDefined();
    cleanup();
  });

  it('renders Achievements card', () => {
    const { getByText, cleanup } = renderWithTimeTravel(<MoreScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Achievements')).toBeDefined();
    cleanup();
  });

  it('renders available balance', () => {
    const { getByText, cleanup } = renderWithTimeTravel(<MoreScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText(/Available Balance/)).toBeDefined();
    cleanup();
  });

  it('renders without crashing', () => {
    const { toJSON, cleanup } = renderWithTimeTravel(<MoreScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(toJSON()).toBeTruthy();
    cleanup();
  });
});
