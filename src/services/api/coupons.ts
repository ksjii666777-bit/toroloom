/**
 * ============================================================================
 * Toroloom Coupon API Client
 * ============================================================================
 *
 * Communicates with the backend /api/coupons endpoints for coupon
 * validation, application, and management.
 *
 *   validateCoupon(code, planTier, price)  → POST /api/coupons/validate
 *   applyCoupon(code, planId, prices)      → POST /api/coupons/apply
 *   getCoupons()                           → GET  /api/coupons
 *   createCoupon(data)                     → POST /api/coupons
 *   getCoupon(code)                        → GET  /api/coupons/:code
 *   updateCoupon(code, data)               → PUT  /api/coupons/:code
 *   deleteCoupon(code)                     → DELETE /api/coupons/:code
 *   seedCoupons()                          → POST /api/coupons/seed
 * ============================================================================
 */

import { api } from './client';
import type { CouponCode, CouponDiscountResult } from '../../types';

const BASE = '/coupons';

export const couponApi = {
  /**
   * Validate a coupon code for a given plan tier and price.
   * Returns the discount result (valid or invalid).
   */
  async validateCoupon(
    code: string,
    planTier?: string,
    price?: number,
  ): Promise<CouponDiscountResult> {
    try {
      const response: any = await api.post(`${BASE}/validate`, {
        code,
        planTier,
        price,
      });
      return response as CouponDiscountResult;
    } catch {
      return {
        code: code.toUpperCase(),
        valid: false,
        type: 'percentage',
        discountAmount: 0,
        originalPrice: price || 0,
        finalPrice: price || 0,
        message: 'Failed to validate coupon. Please try again.',
      };
    }
  },

  /**
   * Apply a coupon and record usage (called after successful payment).
   */
  async applyCoupon(
    code: string,
    planId: string,
    discountAmount: number,
    originalPrice: number,
    finalPrice: number,
  ): Promise<boolean> {
    try {
      await api.post(`${BASE}/apply`, {
        code,
        planId,
        discountAmount,
        originalPrice,
        finalPrice,
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get all coupons (admin only).
   */
  async getCoupons(): Promise<{ coupons: CouponCode[] }> {
    const response: any = await api.get(BASE);
    return response as { coupons: CouponCode[] };
  },

  /**
   * Create a new coupon (admin only).
   */
  async createCoupon(data: Partial<CouponCode>): Promise<boolean> {
    try {
      await api.post(BASE, data);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get a single coupon by code.
   */
  async getCoupon(code: string): Promise<CouponCode | null> {
    try {
      const response: any = await api.get(`${BASE}/${code.toUpperCase()}`);
      return (response as { coupon: CouponCode }).coupon;
    } catch {
      return null;
    }
  },

  /**
   * Update a coupon (admin only).
   */
  async updateCoupon(code: string, data: Partial<CouponCode>): Promise<boolean> {
    try {
      await api.put(`${BASE}/${code.toUpperCase()}`, data);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Delete a coupon (admin only).
   */
  async deleteCoupon(code: string): Promise<boolean> {
    try {
      await api.delete(`${BASE}/${code.toUpperCase()}`);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Seed default coupons (dev only).
   */
  async seedCoupons(): Promise<number> {
    try {
      const response: any = await api.post(`${BASE}/seed`);
      return (response as { seeded: number }).seeded || 0;
    } catch {
      return 0;
    }
  },
};
