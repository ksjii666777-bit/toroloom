import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { mockNews } from '../constants/mockData';

// ── Local theme mock ────────────────────────────────────────
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: true,
    mode: 'dark',
    colors: {
      bg: '#0B0F19', text: '#FFFFFF', textSecondary: '#9CA3AF', textMuted: '#6B7280',
      primary: '#3B82F6', accent: '#10B981', marketUp: '#10B981',
      bgCard: '#111827', bgCardLight: '#1A2235', bgInput: '#0F131E',
      border: '#1F2937', divider: '#1E293B', bgSecondary: '#0E121D',
      warning: '#F59E0B', danger: '#EF4444', white: '#FFFFFF',
      borderLight: '#374151',
    },
    gradients: {},
    shadows: {},
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock newsApi.getNews to reject so component falls back to mockNews data
vi.mock('../services/api', () => ({
  newsApi: {
    getNews: vi.fn(() => Promise.reject(new Error('API not configured'))),
  },
}));

vi.mock('../components/ui/AnimatedPressable', () => ({
  default: 'TouchableOpacity',
}));

// Override setup.ts Ionicons mock so icon names render as text children.
vi.mock('@expo/vector-icons', () => {
  const React = require('react');
  const IconComponent = function(props: any) {
    return React.createElement('Text', null, props.name || '');
  };
  return {
    Ionicons: IconComponent,
    AntDesign: IconComponent,
    MaterialIcons: IconComponent,
    MaterialCommunityIcons: IconComponent,
    Feather: IconComponent,
    FontAwesome: IconComponent,
    FontAwesome5: IconComponent,
  };
});

import NewsFeedScreen from '../screens/news/NewsFeedScreen';

const mockNavigate = vi.fn();
const mockNavigation = { navigate: mockNavigate };

/** Flush pending promises so async effects (like newsApi fetch) resolve */
async function flushPromises() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe('NewsFeedScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the screen title', () => {
    const { getByText } = render(<NewsFeedScreen navigation={mockNavigation} />);
    expect(getByText('Market News')).toBeDefined();
  });

  it('renders article count after loading', async () => {
    const { getByText } = render(<NewsFeedScreen navigation={mockNavigation} />);
    await flushPromises();
    expect(getByText(/articles/)).toBeDefined();
  });

  it('renders all category chips', async () => {
    const { getByText } = render(<NewsFeedScreen navigation={mockNavigation} />);
    await flushPromises();
    expect(getByText('All')).toBeDefined();
    expect(getByText('Markets')).toBeDefined();
    expect(getByText('Corporate')).toBeDefined();
    expect(getByText('Economy')).toBeDefined();
    expect(getByText('Policy')).toBeDefined();
    expect(getByText('IPO')).toBeDefined();
    expect(getByText('Global')).toBeDefined();
  });

  it('renders a news card title', async () => {
    const { getByText } = render(<NewsFeedScreen navigation={mockNavigation} />);
    await flushPromises();
    expect(getByText(mockNews[0].title)).toBeDefined();
  });

  it('filters articles by market category', async () => {
    const { getByText } = render(<NewsFeedScreen navigation={mockNavigation} />);
    await flushPromises();
    fireEvent.press(getByText('Markets'));
    const marketsArticles = mockNews.filter(function(n) { return n.category === 'markets'; });
    expect(getByText(marketsArticles[0].title)).toBeDefined();
  });

  it('shows empty state when search yields no matches', async () => {
    const { getByText, getByPlaceholderText } = render(
      <NewsFeedScreen navigation={mockNavigation} />
    );
    await flushPromises();

    // The search bar is hidden by default. Press the search icon to open it.
    // Ionicons mock renders icon name as text, so we can press by the name text.
    fireEvent.press(getByText('search'));

    // Type impossible text into the search input
    const searchInput = getByPlaceholderText('Search news, symbols, sources...');
    act(() => {
      fireEvent.changeText(searchInput, 'zzzzimpossible');
    });

    expect(getByText('No articles found')).toBeDefined();
  });

  it('renders sentiment badges', async () => {
    const { getByText } = render(<NewsFeedScreen navigation={mockNavigation} />);
    await flushPromises();
    expect(getByText('Positive')).toBeDefined();
    expect(getByText('Negative')).toBeDefined();
    expect(getByText('Neutral')).toBeDefined();
  });

  it('switches category and returns to all', async () => {
    const { getByText } = render(<NewsFeedScreen navigation={mockNavigation} />);
    await flushPromises();
    fireEvent.press(getByText('IPO'));
    fireEvent.press(getByText('All'));
    expect(getByText(mockNews[0].title)).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<NewsFeedScreen navigation={mockNavigation} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders Breaking News banner with BREAKING badge', async () => {
    const { getByText } = render(<NewsFeedScreen navigation={mockNavigation} />);
    await flushPromises();
    expect(getByText('BREAKING')).toBeDefined();
  });

  it('renders Trending Symbols section', async () => {
    const { getByText } = render(<NewsFeedScreen navigation={mockNavigation} />);
    await flushPromises();
    expect(getByText('Trending')).toBeDefined();
  });

  it('renders Trending symbol chips from mock data', async () => {
    const { getByText } = render(<NewsFeedScreen navigation={mockNavigation} />);
    await flushPromises();
    // At least one trending symbol should be displayed
    const trendingSymbolsFromMock = new Set(mockNews.filter(n => n.symbol).map(n => n.symbol));
    const firstSymbol = Array.from(trendingSymbolsFromMock)[0];
    if (firstSymbol) {
      expect(getByText(firstSymbol)).toBeDefined();
    }
  });

  it('renders Saved (bookmark) filter chip', async () => {
    const { getByText } = render(<NewsFeedScreen navigation={mockNavigation} />);
    await flushPromises();
    expect(getByText('Saved')).toBeDefined();
  });

  it('renders Hero Featured Card with Read Now', async () => {
    const { getByText } = render(<NewsFeedScreen navigation={mockNavigation} />);
    await flushPromises();
    expect(getByText('Read Now')).toBeDefined();
    // Hero card shows the first article's title
    expect(getByText(mockNews[0].title)).toBeDefined();
  });

  it('filters news by bookmarked when Saved chip is toggled', async () => {
    const { getByText } = render(<NewsFeedScreen navigation={mockNavigation} />);
    await flushPromises();
    // Toggle the Saved bookmark filter
    fireEvent.press(getByText('Saved'));
    // Bookmarked article should still be visible
    const bookmarkedArticle = mockNews.find(n => n.bookmarked);
    if (bookmarkedArticle) {
      expect(getByText(bookmarkedArticle.title)).toBeDefined();
    }
    // Count should reflect only bookmarked items (1 bookmarked in mock data)
    expect(getByText(/Showing 1 article/)).toBeDefined();
  });

  it('filters by trending symbol chip', async () => {
    const { getByText } = render(<NewsFeedScreen navigation={mockNavigation} />);
    await flushPromises();
    // Find a trending symbol chip and press it
    const trendingSymbolsFromMock = new Set(mockNews.filter(n => n.symbol).map(n => n.symbol));
    const firstSymbol = Array.from(trendingSymbolsFromMock)[0];
    if (firstSymbol) {
      const symbolChip = getByText(firstSymbol);
      fireEvent.press(symbolChip);
      // Article with this symbol should still be visible
      const matchingArticle = mockNews.find(n => n.symbol === firstSymbol);
      if (matchingArticle) {
        expect(getByText(matchingArticle.title)).toBeDefined();
      }
    }
  });
});
