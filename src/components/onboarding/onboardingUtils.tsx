// ============================================================================
// Toroloom — Onboarding Utility Functions
// ============================================================================
//
// Non-component exports moved here so the illustration component files
// export only components and Fast Refresh can track them.
// ============================================================================

import React from 'react';
import {
  RocketIllustration,
  PortfolioIllustration,
  MarketsIllustration,
  TradingIllustration,
  BrokerIllustration,
  LearnIllustration,
} from './OnboardingIllustrations';

interface IllustrationProps {
  stepId: string;
  gradient: readonly [string, string];
}

export function renderIllustration({ stepId, gradient }: IllustrationProps) {
  switch (stepId) {
    case 'welcome':
      return <RocketIllustration colors={gradient} />;
    case 'portfolio':
      return <PortfolioIllustration colors={gradient} />;
    case 'markets':
      return <MarketsIllustration colors={gradient} />;
    case 'trading':
      return <TradingIllustration colors={gradient} />;
    case 'broker':
      return <BrokerIllustration colors={gradient} />;
    case 'learn':
      return <LearnIllustration colors={gradient} />;
    default:
      return null;
  }
}
