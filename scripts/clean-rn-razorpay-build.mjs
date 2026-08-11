/**
 * ============================================================================
 * 🧹 CLEAN RN-RAZORPAY STALE BUILD ARTIFACTS (postinstall hook)
 * ============================================================================
 *
 * PROBLEM:
 *   react-native-razorpay@3.0.0 is published to npm WITH its `android/build/`
 *   directory included. That folder contains stale compiled artifacts (e.g.
 *   `RazorpayWebViewClient.class` / `.dex`) that no longer exist in the
 *   package source. Gradle trips over these during EAS/local Android builds:
 *
 *     Unable to read file .../RazorpayWebViewClient.dex
 *
 * FIX:
 *   This script runs automatically after every `npm install` (via the
 *   `postinstall` lifecycle hook) and removes the stale build folder so
 *   Gradle regenerates everything from the actual (correct) source.
 *
 * USAGE:
 *   npm run clean:razorpay   # manual cleanup
 *   npm install              # runs automatically via postinstall
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const staleDirs = [
  'node_modules/react-native-razorpay/android/build',
  'node_modules/react-native-razorpay/android/.gradle',
];

let removed = 0;

for (const rel of staleDirs) {
  const target = path.join(projectRoot, rel);
  if (fs.existsSync(target)) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`[clean-razorpay] ✅ removed ${rel}`);
      removed++;
    } catch (err) {
      console.warn(`[clean-razorpay] ⚠️ could not remove ${rel}: ${err.message}`);
    }
  }
}

if (removed === 0) {
  console.log('[clean-razorpay] ✅ nothing to clean (no stale build artifacts)');
}
