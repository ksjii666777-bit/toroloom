#!/usr/bin/env node
/**
 * ============================================================================
 * Toroloom — Web Screenshot Capture Script (Puppeteer)
 * ============================================================================
 * Captures screenshots of the Toroloom web app running locally via Chrome.
 * Falls back gracefully if Puppeteer is not installed.
 *
 * Usage:
 *   node scripts/capture-web-screenshots.mjs [--port 8083]
 *
 * Output: store/screenshots/raw/*.png
 * ============================================================================
 */

const BASE_URL = process.argv.includes('--port')
  ? `http://localhost:${process.argv[process.argv.indexOf('--port') + 1]}`
  : 'http://localhost:8083';

const OUTPUT_DIR = 'store/screenshots/raw';

const SCREENS = [
  { name: '01-Splash',     path: '/Splash'     },
  { name: '02-Login',      path: '/Login'      },
  { name: '03-Signup',     path: '/Signup'     },
  { name: '04-Onboarding', path: '/Onboarding'  },
  { name: '05-Home',       path: '/Home'       },
  { name: '06-Markets',    path: '/Markets'    },
  { name: '07-Portfolio',  path: '/Portfolio'  },
  { name: '08-Watchlist',  path: '/Watchlist'  },
  { name: '09-More',       path: '/More'       },
  { name: '10-StockDetail',path: '/StockDetail' },
  { name: '11-AIInsights', path: '/AIInsights'  },
  { name: '12-Subscription',path: '/Subscription'},
  { name: '13-Learn',      path: '/Learn'       },
  { name: '14-Calculators', path: '/Calculators'},
];

async function captureScreenshots() {
  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch {
    console.log('Puppeteer not installed. Trying via npx...');
    // Dynamic import might not work with npx; we'll try a fallback
    const { execSync } = await import('child_process');
    execSync('npm install --no-save puppeteer 2>/dev/null', { stdio: 'ignore' });
    puppeteer = await import('puppeteer');
  }

  const fs = await import('fs');
  const path = await import('path');

  // Ensure output dir
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Launching browser...`);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 }); // iPhone 14 Pro size
  await page.setDefaultNavigationTimeout(15000);

  let captured = 0;
  let failed = 0;

  for (const screen of SCREENS) {
    const url = `${BASE_URL}${screen.path}`;
    try {
      console.log(`  📸 ${screen.name}... ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      // Wait a moment for animations
      await new Promise(r => setTimeout(r, 2000));

      const outputPath = path.join(OUTPUT_DIR, `${screen.name}.png`);
      await page.screenshot({ path: outputPath, fullPage: false });
      const stats = fs.statSync(outputPath);
      console.log(`     ✅ ${(stats.size / 1024).toFixed(1)} KB`);
      captured++;
    } catch (err) {
      console.log(`     ❌ ${err.message.slice(0, 60)}`);
      failed++;
    }
  }

  await browser.close();

  console.log(`\n✅ Done! ${captured} captured, ${failed} failed`);
  console.log(`📁 Output: ${OUTPUT_DIR}/`);
}

captureScreenshots().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
