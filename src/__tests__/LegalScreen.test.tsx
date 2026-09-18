/**
 * ============================================================================
 * Toroloom — LegalScreen Tests
 * ============================================================================
 *
 * Verifies the in-app legal screen renders:
 *   - the section picker when no route param is given
 *   - Terms of Service, Privacy Policy and SEBI disclaimer sections
 *     (headings + bodies) when navigated with a section param
 *   - the back button returns to the picker before leaving the screen
 *
 * i18n, theme and navigation are mocked; the screen component is real.
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react-test-renderer';
import { render } from './testUtils';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', bgCard: '#1A1A2E', border: '#2A2A44',
    },
  }),
}));

const mockSetParams = vi.fn();
const mockGoBack = vi.fn();

vi.mock('../../src/hooks/useT', () => ({
  useT: () => ({
    t: (key: string) => {
      // Flat key → string lookup mirroring the real en bundle for legal.* keys.
      const strings: Record<string, string> = {
        'legal.title': 'Legal & Disclosures',
        'legal.subtitle': 'Policies, terms and regulatory disclosures',
        'legal.updated': 'Last updated: September 2026',
        'legal.navToc': 'Terms of Service',
        'legal.navPrivacy': 'Privacy Policy',
        'legal.navSebi': 'SEBI Disclaimer',
        'legal.tocTitle': 'Terms of Service',
        'legal.tocAccept': 'Acceptance of Terms',
        'legal.tocAcceptBody': 'By accessing Toroloom you accept these Terms.',
        'legal.ppTitle': 'Privacy Policy',
        'legal.ppCollect': 'Data We Collect',
        'legal.ppCollectBody': 'Identity and KYC data you submit.',
        'legal.sebiTitle': 'SEBI Disclaimer',
        'legal.sebiNotAdvice': 'No Investment Advice',
        'legal.sebiNotAdviceBody': 'Nothing here is investment advice.',
        'legal.contactIntro': 'Questions? Write to us:',
        'legal.contactEmail': 'legal@toroloom.com',
        'app.goBack': 'Go back',
      };
      return strings[key] ?? key;
    },
  }),
}));

import LegalScreen from '../screens/legal/LegalScreen';

type Nav = {
  navigate: ReturnType<typeof vi.fn>;
  goBack: ReturnType<typeof vi.fn>;
  setParams: ReturnType<typeof vi.fn>;
};

function makeNav(): Nav {
  return { navigate: vi.fn(), goBack: mockGoBack, setParams: mockSetParams };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/** Find a node by accessibilityLabel (testUtils has no getByLabelText). */
function getByLabelText(result: { root: any }, label: string) {
  const found: any[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (node.props?.accessibilityLabel === label) found.push(node);
    (node.children ?? []).forEach(walk);
  };
  walk(result.root);
  if (found.length === 0) throw new Error(`No node with accessibilityLabel "${label}"`);
  return found[0];
}

async function renderAndFlush(jsx: React.ReactElement) {
  const result = render(jsx);
  await act(async () => {});
  return result;
}

describe('LegalScreen', () => {
  it('renders the picker with all three sections when no param is given', async () => {
    const { getByText } = await renderAndFlush(
      <LegalScreen navigation={makeNav() as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Legal & Disclosures')).toBeDefined();
    expect(getByText('Terms of Service')).toBeDefined();
    expect(getByText('Privacy Policy')).toBeDefined();
    expect(getByText('SEBI Disclaimer')).toBeDefined();
  });

  it('renders Terms of Service section content from the route param', async () => {
    const { getByText } = await renderAndFlush(
      <LegalScreen
        navigation={makeNav() as any}
        route={{ params: { section: 'terms' } } as any}
      />,
    );
    expect(getByText('Acceptance of Terms')).toBeDefined();
    expect(getByText('By accessing Toroloom you accept these Terms.')).toBeDefined();
  });

  it('renders Privacy Policy section content from the route param', async () => {
    const { getByText } = await renderAndFlush(
      <LegalScreen
        navigation={makeNav() as any}
        route={{ params: { section: 'privacy' } } as any}
      />,
    );
    expect(getByText('Data We Collect')).toBeDefined();
    expect(getByText('Identity and KYC data you submit.')).toBeDefined();
  });

  it('renders SEBI disclaimer section content from the route param', async () => {
    const { getByText } = await renderAndFlush(
      <LegalScreen
        navigation={makeNav() as any}
        route={{ params: { section: 'sebi' } } as any}
      />,
    );
    expect(getByText('No Investment Advice')).toBeDefined();
    expect(getByText('Nothing here is investment advice.')).toBeDefined();
  });

  it('back button returns to the picker first, then leaves the screen', async () => {
    const nav = makeNav();
    const result = await renderAndFlush(
      <LegalScreen
        navigation={nav as any}
        route={{ params: { section: 'sebi' } } as any}
      />,
    );
    const back = getByLabelText(result, 'Go back');
    act(() => {
      back.props.onPress?.();
    });
    expect(mockSetParams).toHaveBeenCalledWith({ section: undefined });
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('back button leaves the screen when the picker is open', async () => {
    const nav = makeNav();
    const result = await renderAndFlush(
      <LegalScreen navigation={nav as any} route={{ params: {} } as any} />,
    );
    const back = getByLabelText(result, 'Go back');
    act(() => {
      back.props.onPress?.();
    });
    expect(mockGoBack).toHaveBeenCalled();
    expect(mockSetParams).not.toHaveBeenCalled();
  });
});
