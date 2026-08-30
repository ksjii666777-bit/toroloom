/**
 * ============================================================================
 * Toroloom — GDPR Compliance Routes
 * ============================================================================
 *
 * Implements GDPR Articles 15-20 (Right to Access, Rectification, Erasure,
 * Data Portability). Provides data export and account deletion functionality.
 *
 * Endpoints:
 *   POST /api/gdpr/export          — Export all user data (JSON/CSV)
 *   POST /api/gdpr/delete          — Delete user account and data
 *   POST /api/gdpr/check-retention — Check what data would be retained
 *
 * Authentication: Required for all endpoints
 *
 * Reference: GDPR Articles 15, 17, 20
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { exportDataSchema, deleteDataSchema } from '../schemas/gdpr';
import { exportUserData, deleteUserData, checkRetainedData } from '../services/gdpr';
import { auditTrail } from '../services/auditTrail';

const router = Router();
router.use(authMiddleware);

// ──── POST /api/gdpr/export ──────────────────────────────────────────────
/**
 * Export all user data (GDPR Art. 15 - Right of Access).
 *
 * Returns a comprehensive JSON object with all user data categories.
 * Supports filtering by specific categories.
 *
 * Response:
 *   - 200: { success: true, data: GDPRUserData }
 *   - 400: { error: "Validation failed", details: [...] }
 *   - 401: { error: "Authentication required" }
 *   - 500: { error: "Failed to export data" }
 */
router.post('/export', validate(exportDataSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { format, categories } = req.body;

    console.log(`[GDPR] Data export requested by user ${userId}`);

    const userData = await exportUserData(userId);

    // Filter categories if specified
    let exportData = userData;
    if (categories.length > 0) {
      exportData = {
        ...userData,
        // Only include requested categories
        portfolio: categories.includes('portfolio') ? userData.portfolio : { holdings: [], totalInvested: 0, currentValue: 0 },
        tradeHistory: categories.includes('tradeHistory') ? userData.tradeHistory : { trades: [], totalTrades: 0, totalBuyValue: 0, totalSellValue: 0 },
        watchlists: categories.includes('watchlists') ? userData.watchlists : { watchlists: [], totalStocks: 0 },
        subscription: categories.includes('subscription') ? userData.subscription : { current: null, history: [] },
        notifications: categories.includes('notifications') ? userData.notifications : { preferences: [], alertRules: [] },
        apiKeys: categories.includes('apiKeys') ? userData.apiKeys : { keys: [], totalKeys: 0 },
        community: categories.includes('community') ? userData.community : { posts: [], totalPosts: 0 },
        education: categories.includes('education') ? userData.education : { completedCourses: 0, completedLessons: 0, certificates: [] },
        analytics: categories.includes('analytics') ? userData.analytics : { winRate: 0, totalPnL: 0, averageTradeSize: 0 },
      };
    }

    // Log the export
    await auditTrail.append({
      userId,
      eventType: 'SYSTEM_ERROR', // Using SYSTEM_ERROR as GDPR events are system-level
      data: {
        action: 'DATA_EXPORT',
        format,
        categories: categories.length > 0 ? categories : 'all',
        exportedAt: new Date().toISOString(),
      },
    });

    // Set appropriate headers for file download
    if (format === 'csv') {
      // TODO: Implement CSV conversion
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="toroloom_data_export_${userId}.json"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="toroloom_data_export_${userId}.json"`);
    }

    res.json({
      success: true,
      data: exportData,
    });
  } catch (error: unknown) {
    console.error('[GDPR] Export error:', error);
    res.status(500).json({
      error: 'Failed to export data',
      message: (error as Error).message || 'Internal server error',
    });
  }
});

// ──── POST /api/gdpr/delete ──────────────────────────────────────────────
/**
 * Delete user account and data (GDPR Art. 17 - Right to Erasure).
 *
 * Anonymizes user data while retaining financial records as required by law.
 * Requires explicit confirmation with email.
 *
 * Response:
 *   - 200: { success: true, message, deletedAt, retainedData, anonymizedUserId }
 *   - 400: { error: "Validation failed", details: [...] }
 *   - 401: { error: "Authentication required" }
 *   - 500: { error: "Failed to delete data" }
 */
router.post('/delete', validate(deleteDataSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { confirmEmail, confirmDeletion, reason } = req.body;

    console.log(`[GDPR] Account deletion requested by user ${userId}`);

    // Verify email matches
    const storedEmail = req.user!.email;
    if (confirmEmail.toLowerCase() !== storedEmail.toLowerCase()) {
      res.status(400).json({
        error: 'Email confirmation does not match your account email',
      });
      return;
    }

    const result = await deleteUserData(userId, confirmDeletion);

    if (!result.success) {
      res.status(400).json({
        error: result.message,
      });
      return;
    }

    // Log the deletion reason if provided
    if (reason) {
      await auditTrail.append({
        userId: result.anonymizedUserId,
        eventType: 'SYSTEM_ERROR', // Using SYSTEM_ERROR as GDPR events are system-level
        data: {
          action: 'DELETION_REASON',
          reason,
          deletedAt: result.deletedAt,
        },
      });
    }

    res.json({
      success: true,
      message: result.message,
      deletedAt: result.deletedAt,
      retainedData: result.retainedData,
      anonymizedUserId: result.anonymizedUserId,
    });
  } catch (error: unknown) {
    console.error('[GDPR] Deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete account',
      message: (error as Error).message || 'Internal server error',
    });
  }
});

// ──── POST /api/gdpr/check-retention ──────────────────────────────────────
/**
 * Check what data would be retained after deletion.
 * Useful for informing users before they proceed with deletion.
 *
 * Response:
 *   - 200: { success: true, hasRetainedData, retainedCategories, estimatedRetainedRecords }
 *   - 401: { error: "Authentication required" }
 *   - 500: { error: "Failed to check retention" }
 */
router.post('/check-retention', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const result = await checkRetainedData(userId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    console.error('[GDPR] Check retention error:', error);
    res.status(500).json({
      error: 'Failed to check data retention',
      message: (error as Error).message || 'Internal server error',
    });
  }
});

export default router;
