import { describe, it, expect } from 'vitest';
import { stockOGUrl, postOGUrl } from '../utils/deepLinks';

describe('OG Preview URLs', () => {
  describe('stockOGUrl', () => {
    it('generates OG URL for stock', () => {
      const url = stockOGUrl('RELIANCE');
      expect(url).toBe('https://toroloom.com/og/stock/RELIANCE');
    });

    it('generates OG URL for stock with special characters', () => {
      const url = stockOGUrl('M&M');
      expect(url).toBe('https://toroloom.com/og/stock/M%26M');
    });
  });

  describe('postOGUrl', () => {
    it('generates OG URL for post', () => {
      const url = postOGUrl('abc123');
      expect(url).toBe('https://toroloom.com/og/post/abc123');
    });

    it('generates OG URL for post with alphanumeric ID', () => {
      const url = postOGUrl('abc-123-def');
      expect(url).toBe('https://toroloom.com/og/post/abc-123-def');
    });
  });
});
