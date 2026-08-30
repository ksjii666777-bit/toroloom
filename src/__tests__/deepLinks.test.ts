import { describe, it, expect } from 'vitest';
import {
  stockDeepLink,
  postDeepLink,
  courseDeepLink,
  referralDeepLink,
  advisorDeepLink,
  parseDeepLink,
  getNavigationRoute,
  getNavigationParams,
} from '../utils/deepLinks';

describe('Deep Link URL Utility', () => {
  describe('stockDeepLink', () => {
    it('generates custom scheme deep link for stock', () => {
      const link = stockDeepLink('RELIANCE', '123');
      expect(link).toBe('toroloom://stock/RELIANCE?symbol=RELIANCE&id=123');
    });

    it('generates universal link for stock', () => {
      const link = stockDeepLink('RELIANCE', '123', { universal: true });
      expect(link).toBe('https://toroloom.com/stock/RELIANCE?symbol=RELIANCE&id=123');
    });

    it('generates deep link without stockId', () => {
      const link = stockDeepLink('TCS');
      expect(link).toBe('toroloom://stock/TCS?symbol=TCS');
    });
  });

  describe('postDeepLink', () => {
    it('generates custom scheme deep link for post', () => {
      const link = postDeepLink('abc123');
      expect(link).toBe('toroloom://post/abc123');
    });

    it('generates universal link for post', () => {
      const link = postDeepLink('abc123', { universal: true });
      expect(link).toBe('https://toroloom.com/post/abc123');
    });
  });

  describe('courseDeepLink', () => {
    it('generates custom scheme deep link for course', () => {
      const link = courseDeepLink('course1');
      expect(link).toBe('toroloom://course/course1');
    });

    it('generates universal link for course', () => {
      const link = courseDeepLink('course1', { universal: true });
      expect(link).toBe('https://toroloom.com/course/course1');
    });
  });

  describe('referralDeepLink', () => {
    it('generates custom scheme deep link for referral', () => {
      const link = referralDeepLink('PARTNER42');
      expect(link).toBe('toroloom://signup?ref=PARTNER42');
    });

    it('generates universal link for referral', () => {
      const link = referralDeepLink('PARTNER42', { universal: true });
      expect(link).toBe('https://toroloom.com/signup?ref=PARTNER42');
    });
  });

  describe('advisorDeepLink', () => {
    it('generates custom scheme deep link for advisor', () => {
      const link = advisorDeepLink('adv1');
      expect(link).toBe('toroloom://advisor/adv1');
    });

    it('generates universal link for advisor', () => {
      const link = advisorDeepLink('adv1', { universal: true });
      expect(link).toBe('https://toroloom.com/advisor/adv1');
    });
  });

  describe('parseDeepLink', () => {
    it('parses custom scheme stock deep link', () => {
      const result = parseDeepLink('toroloom://stock/RELIANCE?id=123&symbol=RELIANCE');
      expect(result).toEqual({
        route: 'stock',
        params: { id: '123', symbol: 'RELIANCE' },
      });
    });

    it('parses universal stock deep link', () => {
      const result = parseDeepLink('https://toroloom.com/stock/RELIANCE?id=123&symbol=RELIANCE');
      expect(result).toEqual({
        route: 'stock',
        params: { id: '123', symbol: 'RELIANCE' },
      });
    });

    it('parses custom scheme post deep link', () => {
      const result = parseDeepLink('toroloom://post/abc123');
      expect(result).toEqual({
        route: 'post',
        params: { postId: 'abc123' },
      });
    });

    it('parses universal post deep link', () => {
      const result = parseDeepLink('https://toroloom.com/post/abc123');
      expect(result).toEqual({
        route: 'post',
        params: { postId: 'abc123' },
      });
    });

    it('parses referral deep link', () => {
      const result = parseDeepLink('toroloom://signup?ref=PARTNER42');
      expect(result).toEqual({
        route: 'signup',
        params: { ref: 'PARTNER42' },
      });
    });

    it('parses course deep link', () => {
      const result = parseDeepLink('toroloom://course/course1');
      expect(result).toEqual({
        route: 'course',
        params: { courseId: 'course1' },
      });
    });

    it('parses advisor deep link', () => {
      const result = parseDeepLink('toroloom://advisor/adv1');
      expect(result).toEqual({
        route: 'advisor',
        params: { advisorId: 'adv1' },
      });
    });

    it('returns null for invalid URL', () => {
      const result = parseDeepLink('not-a-valid-url');
      expect(result).toBeNull();
    });

    it('returns null for unknown prefix', () => {
      const result = parseDeepLink('http://example.com/stock/RELIANCE');
      expect(result).toBeNull();
    });
  });

  describe('getNavigationRoute', () => {
    it('maps stock route to StockDetail', () => {
      expect(getNavigationRoute('stock')).toBe('StockDetail');
    });

    it('maps post route to CommunityPost', () => {
      expect(getNavigationRoute('post')).toBe('CommunityPost');
    });

    it('maps course route to CourseDetail', () => {
      expect(getNavigationRoute('course')).toBe('CourseDetail');
    });

    it('maps signup route to Signup', () => {
      expect(getNavigationRoute('signup')).toBe('Signup');
    });

    it('maps advisor route to AdvisorDetail', () => {
      expect(getNavigationRoute('advisor')).toBe('AdvisorDetail');
    });

    it('returns null for unknown route', () => {
      expect(getNavigationRoute('unknown')).toBeNull();
    });
  });

  describe('getNavigationParams', () => {
    it('returns correct params for StockDetail', () => {
      const params = getNavigationParams('StockDetail', { id: '123', symbol: 'RELIANCE' });
      expect(params).toEqual({ stockId: '123', symbol: 'RELIANCE' });
    });

    it('returns correct params for CommunityPost', () => {
      const params = getNavigationParams('CommunityPost', { postId: 'abc123' });
      expect(params).toEqual({ postId: 'abc123' });
    });

    it('returns correct params for CourseDetail', () => {
      const params = getNavigationParams('CourseDetail', { id: 'course1' });
      expect(params).toEqual({ courseId: 'course1' });
    });

    it('returns correct params for AdvisorDetail', () => {
      const params = getNavigationParams('AdvisorDetail', { id: 'adv1' });
      expect(params).toEqual({ advisorId: 'adv1' });
    });

    it('returns original params for unknown route', () => {
      const params = getNavigationParams('Unknown', { foo: 'bar' });
      expect(params).toEqual({ foo: 'bar' });
    });
  });
});
