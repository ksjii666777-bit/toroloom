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
    },
  }),
}));

const mockNavigate = vi.fn();

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user1', username: 'TraderJoe', email: 'trader@example.com' },
  }),
}));

// Mock supportApi to reject immediately so fallback FAQs are used
vi.mock('../services/api/support', () => ({
  supportApi: {
    getFAQs: () => Promise.reject(new Error('API unavailable')),
  },
}));

import HelpScreen from '../screens/support/HelpScreen';

beforeEach(() => {
  vi.clearAllMocks();
});

async function renderAndFlush(jsx: React.ReactElement) {
  const result = render(jsx);
  await act(async () => {});
  return result;
}

describe('HelpScreen', () => {
  it('renders the screen title', async () => {
    const { getByText } = await renderAndFlush(<HelpScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Help & Support')).toBeDefined();
  });

  it('renders FAQ section header', async () => {
    const { getByText } = await renderAndFlush(<HelpScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Frequently Asked Questions')).toBeDefined();
  });

  it('renders FAQ questions', async () => {
    const { getByText } = await renderAndFlush(<HelpScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('How do I start investing?')).toBeDefined();
    expect(getByText('How do I withdraw money from my account?')).toBeDefined();
  });

  it('renders help categories', async () => {
    const { getByText } = await renderAndFlush(<HelpScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Open Account')).toBeDefined();
    expect(getByText('Add Funds')).toBeDefined();
  });

  it('renders contact options', async () => {
    const { getByText } = await renderAndFlush(<HelpScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Email Us')).toBeDefined();
    expect(getByText('Live Chat')).toBeDefined();
  });

  it('renders contact email', async () => {
    const { getByText } = await renderAndFlush(<HelpScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('support@toroloom.com')).toBeDefined();
  });

  it('renders without crashing', async () => {
    const { toJSON } = await renderAndFlush(<HelpScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(toJSON()).toBeTruthy();
  });
});
