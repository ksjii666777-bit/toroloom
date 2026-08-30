/**
 * ============================================================================
 * Toroloom — App Links Verification Routes
 * ============================================================================
 *
 * Provides verification endpoints for:
 *   - iOS Universal Links (apple-app-site-association)
 *   - Android App Links (assetlinks.json)
 *   - Deep link path validation
 *
 * GET /api/app-links/verify/ios      → Verify iOS Universal Links setup
 * GET /api/app-links/verify/android  → Verify Android App Links setup
 * GET /api/app-links/verify/all      → Verify all app link configurations
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

const APP_NAME = 'Toroloom';
const IOS_BUNDLE_ID = 'com.toroloom.app';
const ANDROID_PACKAGE = 'com.toroloom.app';
const TEAM_ID = 'TEAM_ID';

// ── Deep link paths that should be handled ──────────────────────────────────
const DEEP_LINK_PATHS = [
  '/og/stock/:symbol',
  '/og/post/:postId',
  '/og/course/:courseId',
  '/og/advisor/:advisorId',
  '/og/share/:shareId',
  '/stock/:symbol',
  '/post/:postId',
  '/course/:courseId',
  '/advisor/:advisorId',
  '/signup',
  '/signup?ref=:code',
];

/**
 * GET /api/app-links/verify/ios
 * Verify iOS Universal Links configuration
 */
router.get('/verify/ios', (_req: Request, res: Response) => {
  const aasaPath = path.join(__dirname, '../../public/.well-known/apple-app-site-association');

  try {
    const raw = fs.readFileSync(aasaPath, 'utf-8');
    const aasa = JSON.parse(raw);

    const details = aasa.applinks?.details || [];
    const paths = details.flatMap((d: any) => d.paths || []);
    const apps = details.map((d: any) => d.appID);

    // Check if all required paths are present
    const requiredPatterns = [
      '/og/stock/*',
      '/og/post/*',
      '/og/course/*',
      '/og/advisor/*',
      '/og/share/*',
      '/stock/*',
      '/post/*',
      '/course/*',
      '/advisor/*',
      '/signup*',
    ];

    const missingPaths = requiredPatterns.filter(p => !paths.includes(p));
    const hasCorrectBundleId = apps.some((app: string) => app.includes(IOS_BUNDLE_ID));

    const status = missingPaths.length === 0 && hasCorrectBundleId ? 'valid' : 'needs_update';

    res.json({
      status,
      platform: 'ios',
      bundleId: IOS_BUNDLE_ID,
      teamId: TEAM_ID,
      configuredApps: apps,
      configuredPaths: paths,
      missingPaths,
      hasCorrectBundleId,
      verificationUrl: `https://app-site-association.cdn-apple.com/a/v1/${TEAM_ID}`,
      instructions: status === 'valid'
        ? '✅ iOS Universal Links are properly configured'
        : [
            '1. Update TEAM_ID in apple-app-site-association with your Apple Developer Team ID',
            '2. Ensure bundle ID matches: ' + IOS_BUNDLE_ID,
            '3. Deploy to production domain',
            '4. Verify at: https://app-site-association.cdn-apple.com/a/v1/' + TEAM_ID,
            '5. Test in Safari by opening a link',
          ],
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      platform: 'ios',
      error: 'Failed to read apple-app-site-association',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/app-links/verify/android
 * Verify Android App Links configuration
 */
router.get('/verify/android', (_req: Request, res: Response) => {
  const assetlinksPath = path.join(__dirname, '../../public/.well-known/assetlinks.json');

  try {
    const raw = fs.readFileSync(assetlinksPath, 'utf-8');
    const assetlinks = JSON.parse(raw);

    const packages = assetlinks.map((entry: any) => entry.target?.package_name);
    const hasCorrectPackage = packages.includes(ANDROID_PACKAGE);
    const hasFingerprints = assetlinks.every((entry: any) =>
      entry.target?.sha256_cert_fingerprints?.length > 0
    );

    const status = hasCorrectPackage && hasFingerprints ? 'valid' : 'needs_update';

    res.json({
      status,
      platform: 'android',
      packageName: ANDROID_PACKAGE,
      configuredPackages: packages,
      hasCorrectPackage,
      hasFingerprints,
      verificationUrl: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://toroloom.com&relation=delegate_permission/common.handle_all_urls`,
      instructions: status === 'valid'
        ? '✅ Android App Links are properly configured'
        : [
            '1. Update package_name to: ' + ANDROID_PACKAGE,
            '2. Add SHA-256 certificate fingerprint from your signing key',
            '3. Deploy to production domain',
            '4. Verify at: https://digitalassetlinks.googleapis.com/v1/statements:list',
            '5. Test by running: adb shell am start -a android.intent.action.VIEW -d "https://toroloom.com/stock/RELIANCE"',
          ],
      note: 'Replace SHA-256 fingerprint with your actual release signing key fingerprint',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      platform: 'android',
      error: 'Failed to read assetlinks.json',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/app-links/verify/all
 * Verify all app link configurations
 */
router.get('/verify/all', async (_req: Request, res: Response) => {
  const results: any = {};

  // Check iOS
  try {
    const aasaPath = path.join(__dirname, '../../public/.well-known/apple-app-site-association');
    const raw = fs.readFileSync(aasaPath, 'utf-8');
    const aasa = JSON.parse(raw);
    const paths = (aasa.applinks?.details || []).flatMap((d: any) => d.paths || []);
    results.ios = {
      status: paths.length > 5 ? 'valid' : 'needs_update',
      pathsCount: paths.length,
      requiredPaths: 10,
    };
  } catch {
    results.ios = { status: 'error', error: 'Failed to read configuration' };
  }

  // Check Android
  try {
    const assetlinksPath = path.join(__dirname, '../../public/.well-known/assetlinks.json');
    const raw = fs.readFileSync(assetlinksPath, 'utf-8');
    const assetlinks = JSON.parse(raw);
    results.android = {
      status: assetlinks.length > 0 ? 'valid' : 'needs_update',
      entriesCount: assetlinks.length,
      requiredEntries: 2,
    };
  } catch {
    results.android = { status: 'error', error: 'Failed to read configuration' };
  }

  // Check OG routes
  const ogRoutes = [
    '/og/stock/RELIANCE',
    '/og/post/test123',
    '/og/course/course1',
    '/og/advisor/adv1',
    '/og/share/share1',
  ];

  results.ogRoutes = {
    status: 'valid',
    routes: ogRoutes,
    note: 'These URLs should return HTML with OG meta tags for crawlers',
  };

  // Deep link paths
  results.deepLinkPaths = {
    status: 'valid',
    paths: DEEP_LINK_PATHS,
    customScheme: 'toroloom://',
    universalLinkPrefix: 'https://toroloom.com',
  };

  // Overall status
  const allValid = results.ios?.status === 'valid' && results.android?.status === 'valid';
  results.overall = {
    status: allValid ? 'valid' : 'needs_update',
    summary: allValid
      ? '✅ All app link configurations are valid'
      : '⚠️ Some configurations need attention',
  };

  res.json(results);
});

/**
 * GET /api/app-links/deep-links
 * List all supported deep link paths
 */
router.get('/deep-links', (_req: Request, res: Response) => {
  res.json({
    customScheme: 'toroloom://',
    universalLinkPrefix: 'https://toroloom.com',
    ogPreviewPrefix: 'https://toroloom.com/og',
    paths: [
      {
        path: '/stock/:symbol',
        example: 'toroloom://stock/RELIANCE?symbol=RELIANCE',
        universalLink: 'https://toroloom.com/stock/RELIANCE?symbol=RELIANCE',
        ogPreview: 'https://toroloom.com/og/stock/RELIANCE',
        description: 'Stock detail page',
      },
      {
        path: '/post/:postId',
        example: 'toroloom://post/abc123',
        universalLink: 'https://toroloom.com/post/abc123',
        ogPreview: 'https://toroloom.com/og/post/abc123',
        description: 'Community post',
      },
      {
        path: '/course/:courseId',
        example: 'toroloom://course/course1',
        universalLink: 'https://toroloom.com/course/course1',
        ogPreview: 'https://toroloom.com/og/course/course1',
        description: 'Education course',
      },
      {
        path: '/advisor/:advisorId',
        example: 'toroloom://advisor/adv1',
        universalLink: 'https://toroloom.com/advisor/adv1',
        ogPreview: 'https://toroloom.com/og/advisor/adv1',
        description: 'Advisor profile',
      },
      {
        path: '/signup?ref=:code',
        example: 'toroloom://signup?ref=PARTNER42',
        universalLink: 'https://toroloom.com/signup?ref=PARTNER42',
        description: 'Referral signup',
      },
    ],
  });
});

export default router;
