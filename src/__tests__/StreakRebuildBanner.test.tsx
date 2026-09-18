/**
 * ============================================================================
 * Toroloom — StreakRebuildBanner Component Tests
 * ============================================================================
 *
 * Covers:
 *   1. Renders the subtle banner while the streak is broken (count in body)
 *   2. Renders nothing when nothing broke (brokenStreakWeeks = 0/undefined)
 *   3. Dismiss tap hides it immediately AND persists today's date key
 *   4. A same-day dismissal hides the banner on remount (no nagging)
 *   5. A previous-day dismissal does NOT hide it (returns tomorrow)
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => React.createElement('Ionicons', { name }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', danger: '#FF5252', warning: '#FFAB40',
      marketUp: '#00E676', success: '#00E676',
      text: '#FFFFFF', textSecondary: '#9CA3AF', textMuted: '#6B7280',
      bgCard: '#111827', border: '#1F2937',
    },
  }),
}));

const journalMap: Record<string, string> = {
  'journal.streakRebuildBannerTitle': 'Your streak is waiting',
  'journal.streakRebuildBannerBody': 'One clean trade at your committed R:R rebuilds your {{weeks}}-week streak. Journal it to bring the chain back.',
  'journal.streakRebuildBannerDismiss': 'Maybe later',
};

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      let text = journalMap[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
      }
      return text;
    },
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import StreakRebuildBanner from '../components/journal/StreakRebuildBanner';

const DISMISS_KEY = 'toroloom_streak_rebuild_banner_dismissed_on';

function localDateKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

describe('StreakRebuildBanner', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();
  });

  /** Flush the AsyncStorage lookup + resulting setState inside act(). */
  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('renders the subtle banner with the broken streak count', async () => {
    const { getByText, getByTestId } = render(<StreakRebuildBanner brokenStreakWeeks={3} />);

    // Wait for the dismissal lookup to resolve
    await flush();

    expect(getByTestId('streak-rebuild-banner')).toBeDefined();
    expect(getByText('Your streak is waiting')).toBeDefined();
    expect(getByText('One clean trade at your committed R:R rebuilds your 3-week streak. Journal it to bring the chain back.')).toBeDefined();
    expect(getByText('Maybe later')).toBeDefined();
  });

  it('renders nothing when nothing broke', async () => {
    const { queryByTestId } = render(<StreakRebuildBanner brokenStreakWeeks={0} />);
    await flush();
    expect(queryByTestId('streak-rebuild-banner')).toBeNull();
  });

  it('renders nothing when the prop is missing', async () => {
    const { queryByTestId } = render(<StreakRebuildBanner />);
    await flush();
    expect(queryByTestId('streak-rebuild-banner')).toBeNull();
  });

  it('dismiss tap hides the banner and persists today\'s date key', async () => {
    const first = render(<StreakRebuildBanner brokenStreakWeeks={2} />);
    await flush();

    fireEvent.press(first.getByText('Maybe later'));

    // Hidden immediately in this session
    expect(first.queryByTestId('streak-rebuild-banner')).toBeNull();
    // Persisted for the rest of the day
    const dismissedOn = await AsyncStorage.getItem(DISMISS_KEY);
    expect(dismissedOn).toBe(localDateKey());
  });

  it('stays hidden after remount on the same day (no nagging within a day)', async () => {
    await AsyncStorage.setItem(DISMISS_KEY, localDateKey());

    const { queryByTestId } = render(<StreakRebuildBanner brokenStreakWeeks={2} />);
    await flush();

    expect(queryByTestId('streak-rebuild-banner')).toBeNull();
  });

  it('reappears when the stored dismissal is from a previous day', async () => {
    await AsyncStorage.setItem(DISMISS_KEY, localDateKey(-1)); // dismissed yesterday

    const { getByTestId } = render(<StreakRebuildBanner brokenStreakWeeks={2} />);
    await flush();

    expect(getByTestId('streak-rebuild-banner')).toBeDefined();
  });

  // ── One-tap rebuild: the title is a link ─────────────────────

  it('title tap fires onTitlePress (one-tap rebuild flow)', async () => {
    const onTitlePress = vi.fn();
    const { getByTestId } = render(
      <StreakRebuildBanner brokenStreakWeeks={2} onTitlePress={onTitlePress} />,
    );
    await flush();

    fireEvent.press(getByTestId('streak-rebuild-banner-title'));
    expect(onTitlePress).toHaveBeenCalledTimes(1);
  });

  it('without onTitlePress the title renders as plain text and is not pressable', async () => {
    const { getByTestId } = render(<StreakRebuildBanner brokenStreakWeeks={2} />);
    await flush();

    const title = getByTestId('streak-rebuild-banner-title');
    expect(title.props.accessibilityRole).toBe('text');
    expect(title.props.disabled).toBe(true);
  });

  it('dismiss still works when a title link is present', async () => {
    const onTitlePress = vi.fn();
    const screen = render(
      <StreakRebuildBanner brokenStreakWeeks={2} onTitlePress={onTitlePress} />,
    );
    await flush();

    fireEvent.press(screen.getByTestId('streak-rebuild-banner-title'));
    expect(onTitlePress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('streak-rebuild-banner')).toBeDefined(); // link ≠ dismiss

    fireEvent.press(screen.getByText('Maybe later'));
    expect(screen.queryByTestId('streak-rebuild-banner')).toBeNull();
    const dismissedOn = await AsyncStorage.getItem(DISMISS_KEY);
    expect(dismissedOn).toBe(localDateKey());
  });
});
