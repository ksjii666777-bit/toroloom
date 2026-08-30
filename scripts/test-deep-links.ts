#!/usr/bin/env ts-node
/**
 * ============================================================================
 * Toroloom — Deep Link Test Script
 * ============================================================================
 *
 * Tests all deep link routes, OG previews, and .well-known endpoints.
 * Simulates iOS Universal Links and Android App Links behavior.
 *
 * Usage:
 *   npx ts-node scripts/test-deep-links.ts                    # Run all tests
 *   npx ts-node scripts/test-deep-links.ts --base-url=http://localhost:3000
 *   npx ts-node scripts/test-deep-links.ts --ios               # iOS-specific tests
 *   npx ts-node scripts/test-deep-links.ts --android           # Android-specific tests
 *   npx ts-node scripts/test-deep-links.ts --og                # OG preview tests only
 *
 * ============================================================================
 */

import http from 'http';
import https from 'https';

// ── Configuration ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const baseUrl = args.find(a => a.startsWith('--base-url='))?.split('=')[1] || 'https://toroloom.com';
const testIOS = args.includes('--ios') || !args.includes('--android');
const testAndroid = args.includes('--android') || !args.includes('--ios');
const testOG = args.includes('--og');
const verbose = args.includes('--verbose');

// ── Test Results ───────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  details?: string;
  duration?: number;
}

const results: TestResult[] = [];

function test(name: string, fn: () => Promise<void>) {
  return async () => {
    const start = Date.now();
    try {
      await fn();
      results.push({ name, status: 'pass', duration: Date.now() - start });
      console.log(`  ✅ ${name}`);
    } catch (error) {
      results.push({
        name,
        status: 'fail',
        details: (error as Error).message,
        duration: Date.now() - start,
      });
      console.log(`  ❌ ${name}`);
      if (verbose) console.log(`     ${chalk.gray((error as Error).message)}`);
    }
  };
}

// ── HTTP Client ────────────────────────────────────────────────────────────

interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

function request(url: string, options: { userAgent?: string; method?: string } = {}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHTTPS = parsedUrl.protocol === 'https:';
    const client = isHTTPS ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHTTPS ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': options.userAgent || 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      },
    };

    const req = client.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers as Record<string, string>,
          body,
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// ── Color Helpers (simplified) ─────────────────────────────────────────────

const chalk = {
  gray: (s: string) => s,
  green: (s: string) => s,
  red: (s: string) => s,
  yellow: (s: string) => s,
  cyan: (s: string) => s,
  bold: (s: string) => s,
};

// ── Crawler User Agents ────────────────────────────────────────────────────

const CRAWLER_AGENTS = {
  facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  twitter: 'Twitterbot/1.0',
  whatsapp: 'WhatsApp/2.23.24.82',
  discord: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
  linkedin: 'LinkedInBot/1.0',
  telegram: 'TelegramBot (like TwitterBot)',
  google: 'Googlebot/2.1 (+http://www.google.com/bot.html)',
};

const REAL_USER_AGENTS = {
  ios_safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  android_chrome: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
  desktop_chrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
};

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ═════════════════════════════════════════════════════════════════════════════

// ── .well-known Endpoints ──────────────────────────────────────────────────

const wellKnownTests = [
  test('apple-app-site-association is accessible', async () => {
    const res = await request(`${baseUrl}/.well-known/apple-app-site-association`);
    if (res.status !== 200) throw new Error(`Status ${res.status}, expected 200`);

    const contentType = res.headers['content-type'] || '';
    if (!contentType.includes('json')) {
      console.log(`     Note: Content-Type is "${contentType}", should be "application/json"`);
    }

    const aasa = JSON.parse(res.body);
    if (!aasa.applinks) throw new Error('Missing applinks section');
    if (!aasa.applinks.details?.length) throw new Error('No app details configured');
  }),

  test('assetlinks.json is accessible', async () => {
    const res = await request(`${baseUrl}/.well-known/assetlinks.json`);
    if (res.status !== 200) throw new Error(`Status ${res.status}, expected 200`);

    const assetlinks = JSON.parse(res.body);
    if (!Array.isArray(assetlinks)) throw new Error('Not a valid JSON array');
    if (assetlinks.length === 0) throw new Error('No entries configured');

    const entry = assetlinks[0];
    if (!entry.target?.package_name) throw new Error('Missing package_name');
    if (!entry.target?.sha256_cert_fingerprints?.length) throw new Error('No SHA-256 fingerprints');
  }),

  test('apple-app-site-association has required paths', async () => {
    const res = await request(`${baseUrl}/.well-known/apple-app-site-association`);
    const aasa = JSON.parse(res.body);
    const paths = aasa.applinks?.details?.flatMap((d: any) => d.paths || []) || [];

    const required = ['/og/stock/*', '/og/post/*', '/stock/*', '/post/*', '/signup*'];
    const missing = required.filter(p => !paths.includes(p));

    if (missing.length > 0) {
      throw new Error(`Missing paths: ${missing.join(', ')}`);
    }
  }),

  test('assetlinks.json has correct package name', async () => {
    const res = await request(`${baseUrl}/.well-known/assetlinks.json`);
    const assetlinks = JSON.parse(res.body);

    const hasCorrectPackage = assetlinks.some(
      (e: any) => e.target?.package_name === 'com.toroloom.app'
    );

    if (!hasCorrectPackage) {
      throw new Error('Package name "com.toroloom.app" not found');
    }
  }),
];

// ── OG Preview Routes (Crawler Behavior) ───────────────────────────────────

const ogTests = [
  test('OG stock preview returns HTML with meta tags (Facebook crawler)', async () => {
    const res = await request(`${baseUrl}/og/stock/RELIANCE`, {
      userAgent: CRAWLER_AGENTS.facebook,
    });

    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!res.body.includes('og:title')) throw new Error('Missing og:title meta tag');
    if (!res.body.includes('og:description')) throw new Error('Missing og:description meta tag');
    if (!res.body.includes('og:image')) throw new Error('Missing og:image meta tag');
    if (!res.body.includes('RELIANCE')) throw new Error('Missing RELIANCE in content');
  }),

  test('OG stock preview returns HTML for Twitter bot', async () => {
    const res = await request(`${baseUrl}/og/stock/TCS`, {
      userAgent: CRAWLER_AGENTS.twitter,
    });

    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!res.body.includes('twitter:card')) throw new Error('Missing twitter:card meta tag');
    if (!res.body.includes('summary_large_image')) throw new Error('Not using summary_large_image card');
  }),

  test('OG stock preview includes stock data in description', async () => {
    const res = await request(`${baseUrl}/og/stock/INFY`, {
      userAgent: CRAWLER_AGENTS.google,
    });

    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    // Googlebot should also get OG tags
    if (!res.body.includes('og:title')) throw new Error('Missing og:title');
  }),

  test('OG post preview returns HTML', async () => {
    const res = await request(`${baseUrl}/og/post/test123`, {
      userAgent: CRAWLER_AGENTS.whatsapp,
    });

    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!res.body.includes('og:title')) throw new Error('Missing og:title');
    if (!res.body.includes('Community Post')) throw new Error('Missing community post title');
  }),

  test('OG course preview returns HTML', async () => {
    const res = await request(`${baseUrl}/og/course/course1`, {
      userAgent: CRAWLER_AGENTS.discord,
    });

    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!res.body.includes('og:title')) throw new Error('Missing og:title');
  }),

  test('OG advisor preview returns HTML', async () => {
    const res = await request(`${baseUrl}/og/advisor/adv1`, {
      userAgent: CRAWLER_AGENTS.linkedin,
    });

    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!res.body.includes('og:title')) throw new Error('Missing og:title');
  }),

  test('OG share preview returns HTML', async () => {
    const res = await request(`${baseUrl}/og/share/share1`, {
      userAgent: CRAWLER_AGENTS.telegram,
    });

    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!res.body.includes('og:title')) throw new Error('Missing og:title');
  }),

  test('OG preview includes Cache-Control header', async () => {
    const res = await request(`${baseUrl}/og/stock/RELIANCE`, {
      userAgent: CRAWLER_AGENTS.facebook,
    });

    const cacheControl = res.headers['cache-control'] || '';
    if (!cacheControl.includes('max-age')) throw new Error('Missing Cache-Control max-age');
  }),

  test('OG preview includes app deep link meta tags', async () => {
    const res = await request(`${baseUrl}/og/stock/RELIANCE`, {
      userAgent: CRAWLER_AGENTS.facebook,
    });

    if (!res.body.includes('al:ios:url')) throw new Error('Missing iOS deep link meta');
    if (!res.body.includes('al:android:url')) throw new Error('Missing Android deep link meta');
    if (!res.body.includes('toroloom://')) throw new Error('Missing custom scheme URL');
  }),
];

// ── Real User Redirects ────────────────────────────────────────────────────

const redirectTests = [
  test('Real iOS user gets redirect to deep link', async () => {
    const res = await request(`${baseUrl}/og/stock/RELIANCE`, {
      userAgent: REAL_USER_AGENTS.ios_safari,
    });

    // Should redirect (302) or show HTML with redirect script
    if (res.status === 302) {
      const location = res.headers['location'] || '';
      if (!location.includes('toroloom://')) {
        throw new Error(`Redirect location doesn't contain deep link: ${location}`);
      }
    } else if (res.status === 200) {
      // HTML page with JavaScript redirect
      if (!res.body.includes('window.location.replace')) {
        throw new Error('No JavaScript redirect found for real user');
      }
    } else {
      throw new Error(`Unexpected status ${res.status}`);
    }
  }),

  test('Real Android user gets redirect to deep link', async () => {
    const res = await request(`${baseUrl}/og/stock/TCS`, {
      userAgent: REAL_USER_AGENTS.android_chrome,
    });

    if (res.status === 302) {
      const location = res.headers['location'] || '';
      if (!location.includes('toroloom://')) {
        throw new Error(`Redirect location doesn't contain deep link: ${location}`);
      }
    } else if (res.status === 200) {
      if (!res.body.includes('window.location.replace')) {
        throw new Error('No JavaScript redirect found for real user');
      }
    } else {
      throw new Error(`Unexpected status ${res.status}`);
    }
  }),
];

// ── iOS Universal Links Simulation ─────────────────────────────────────────

const iosTests = [
  test('iOS Universal Link: /stock/RELIANCE', async () => {
    // iOS would send request with Safari UA and check for AASA
    const res = await request(`${baseUrl}/stock/RELIANCE`, {
      userAgent: REAL_USER_AGENTS.ios_safari,
    });

    // Should either redirect or serve content
    if (res.status !== 200 && res.status !== 302) {
      throw new Error(`Status ${res.status}`);
    }
  }),

  test('iOS Universal Link: /post/abc123', async () => {
    const res = await request(`${baseUrl}/post/abc123`, {
      userAgent: REAL_USER_AGENTS.ios_safari,
    });

    if (res.status !== 200 && res.status !== 302) {
      throw new Error(`Status ${res.status}`);
    }
  }),

  test('iOS AASA file is valid JSON (not v2 format)', async () => {
    const res = await request(`${baseUrl}/.well-known/apple-app-site-association`);
    const aasa = JSON.parse(res.body);

    // Apple recommends v2 format (applinks.details)
    if (!aasa.applinks?.details) {
      throw new Error('Missing applinks.details (v2 format required)');
    }

    // Check appID format: TEAM_ID.bundle_id
    const details = aasa.applinks.details;
    for (const d of details) {
      if (!d.appID?.includes('.')) {
        throw new Error(`Invalid appID format: ${d.appID}`);
      }
    }
  }),
];

// ── Android App Links Simulation ───────────────────────────────────────────

const androidTests = [
  test('Android App Link: /stock/RELIANCE', async () => {
    const res = await request(`${baseUrl}/stock/RELIANCE`, {
      userAgent: REAL_USER_AGENTS.android_chrome,
    });

    if (res.status !== 200 && res.status !== 302) {
      throw new Error(`Status ${res.status}`);
    }
  }),

  test('Android App Link: /post/abc123', async () => {
    const res = await request(`${baseUrl}/post/abc123`, {
      userAgent: REAL_USER_AGENTS.android_chrome,
    });

    if (res.status !== 200 && res.status !== 302) {
      throw new Error(`Status ${res.status}`);
    }
  }),

  test('assetlinks.json has valid SHA-256 fingerprint format', async () => {
    const res = await request(`${baseUrl}/.well-known/assetlinks.json`);
    const assetlinks = JSON.parse(res.body);

    const fingerprintRegex = /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/i;

    for (const entry of assetlinks) {
      const fingerprints = entry.target?.sha256_cert_fingerprints || [];
      for (const fp of fingerprints) {
        if (!fingerprintRegex.test(fp)) {
          throw new Error(`Invalid fingerprint format: ${fp}`);
        }
      }
    }
  }),
];

// ── Verification Endpoints ─────────────────────────────────────────────────

const verificationTests = [
  test('GET /api/app-links/verify/all returns valid response', async () => {
    const res = await request(`${baseUrl}/api/app-links/verify/all`);

    if (res.status !== 200) throw new Error(`Status ${res.status}`);

    const data = JSON.parse(res.body);
    if (!data.ios) throw new Error('Missing ios verification');
    if (!data.android) throw new Error('Missing android verification');
    if (!data.overall) throw new Error('Missing overall status');
  }),

  test('GET /api/app-links/verify/ios returns iOS config', async () => {
    const res = await request(`${baseUrl}/api/app-links/verify/ios`);

    if (res.status !== 200) throw new Error(`Status ${res.status}`);

    const data = JSON.parse(res.body);
    if (data.platform !== 'ios') throw new Error('Not iOS platform');
    if (!data.configuredPaths?.length) throw new Error('No paths configured');
  }),

  test('GET /api/app-links/verify/android returns Android config', async () => {
    const res = await request(`${baseUrl}/api/app-links/verify/android`);

    if (res.status !== 200) throw new Error(`Status ${res.status}`);

    const data = JSON.parse(res.body);
    if (data.platform !== 'android') throw new Error('Not Android platform');
    if (!data.configuredPackages?.length) throw new Error('No packages configured');
  }),

  test('GET /api/app-links/deep-links lists all paths', async () => {
    const res = await request(`${baseUrl}/api/app-links/deep-links`);

    if (res.status !== 200) throw new Error(`Status ${res.status}`);

    const data = JSON.parse(res.body);
    if (!data.paths?.length) throw new Error('No paths listed');
    if (!data.customScheme) throw new Error('Missing custom scheme');
    if (!data.universalLinkPrefix) throw new Error('Missing universal link prefix');
  }),
];

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n🔗 Toroloom Deep Link Test Suite\n');
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   Testing: ${testIOS ? 'iOS' : ''}${testIOS && testAndroid ? ' + ' : ''}${testAndroid ? 'Android' : ''}`);
  console.log('');

  const allTests: Array<() => Promise<void>> = [];

  // .well-known endpoints
  console.log('📋 .well-known Endpoints');
  allTests.push(...wellKnownTests);

  // OG Preview routes
  if (testOG || (!testIOS && !testAndroid)) {
    console.log('\n🌐 OG Preview Routes');
    allTests.push(...ogTests);
  }

  // Redirect behavior
  console.log('\n↪️  Redirect Behavior');
  allTests.push(...redirectTests);

  // iOS tests
  if (testIOS) {
    console.log('\n📱 iOS Universal Links');
    allTests.push(...iosTests);
  }

  // Android tests
  if (testAndroid) {
    console.log('\n🤖 Android App Links');
    allTests.push(...androidTests);
  }

  // Verification endpoints
  console.log('\n🔍 Verification Endpoints');
  allTests.push(...verificationTests);

  // Run all tests
  console.log('\n⏳ Running tests...\n');

  for (const testFn of allTests) {
    await testFn();
  }

  // Summary
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  const total = results.length;

  console.log('\n' + '═'.repeat(60));
  console.log(`📊 Results: ${passed}/${total} passed, ${failed} failed, ${skipped} skipped`);
  console.log('═'.repeat(60) + '\n');

  if (failed > 0) {
    console.log('❌ Failed tests:');
    results
      .filter(r => r.status === 'fail')
      .forEach(r => console.log(`   • ${r.name}: ${r.details}`));
    console.log('');
  }

  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
