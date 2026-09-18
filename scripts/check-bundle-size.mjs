#!/usr/bin/env node
/**
 * ============================================================================
 * Toroloom — Bundle Size Guard
 * ============================================================================
 *
 * Builds the production JS bundle with `expo export` and compares its size
 * against the recorded baseline (scripts/bundle-size-baseline-<platform>.json).
 *
 * Fails when the bundle grew more than BUNDLE_GROWTH_THRESHOLD % (default 5)
 * versus the baseline — catching accidental dependency bloat before release.
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs                  # check vs baseline
 *   node scripts/check-bundle-size.mjs update-baseline  # re-record baseline
 *
 * Env:
 *   BUNDLE_GROWTH_THRESHOLD  max allowed growth % (default: 5)
 *   BUNDLE_PLATFORM          ios | android (default: ios)
 * ============================================================================
 */

import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const MODE = process.argv[2] === 'update-baseline' ? 'update-baseline' : 'check';
const PLATFORM = process.env.BUNDLE_PLATFORM || 'ios';
// Per-platform baselines keep each leg's budget independent (Android and iOS
// bundles differ in size and drift at different rates).
const BASELINE_PATH = path.join(ROOT, 'scripts', `bundle-size-baseline-${PLATFORM}.json`);
const THRESHOLD = Number(process.env.BUNDLE_GROWTH_THRESHOLD ?? 5);

if (!Number.isFinite(THRESHOLD) || THRESHOLD <= 0) {
  console.error(`✖ Invalid BUNDLE_GROWTH_THRESHOLD: "${process.env.BUNDLE_GROWTH_THRESHOLD}"`);
  process.exit(2);
}

const mb = b => (b / 1024 / 1024).toFixed(2) + ' MB';

function measureBundle() {
  const outDir = mkdtempSync(path.join(tmpdir(), 'toroloom-bundle-'));
  console.log(`▸ Building production bundle (platform=${PLATFORM}) …`);
  // Single command string (not args array) to avoid DEP0190 with shell:true.
  // Double quotes around outDir are safe in both cmd.exe and POSIX shells.
  const result = spawnSync(
    `npx expo export --platform ${PLATFORM} --output-dir "${outDir}"`,
    { stdio: ['ignore', 'pipe', 'inherit'], shell: true, cwd: ROOT },
  );

  try {
    if (result.status !== 0) {
      console.error('✖ expo export failed — see output above.');
      process.exit(2);
    }

    const hbcFiles = [];
    const walk = dir => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.name.endsWith('.hbc')) hbcFiles.push(p);
      }
    };
    walk(outDir);

    if (hbcFiles.length === 0) {
      console.error('✖ No .hbc bundle found in export output.');
      process.exit(2);
    }

    return hbcFiles.reduce((sum, f) => sum + statSync(f).size, 0);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch (error) {
    console.error(`✖ Could not parse baseline (${BASELINE_PATH}): ${error.message}`);
    process.exit(2);
  }
}

const currentBytes = measureBundle();

if (MODE === 'update-baseline') {
  const baseline = {
    platform: PLATFORM,
    bytes: currentBytes,
    thresholdPct: THRESHOLD,
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`✔ Baseline updated: ${PLATFORM} = ${mb(currentBytes)} (${currentBytes} bytes)`);
  process.exit(0);
}

const baseline = loadBaseline();
if (!baseline || typeof baseline.bytes !== 'number') {
  console.error(`✖ No valid baseline found (${BASELINE_PATH}). Run: BUNDLE_PLATFORM=${PLATFORM} npm run bundle:size:update`);
  process.exit(2);
}
if (baseline.platform !== PLATFORM) {
  console.error(`✖ Baseline platform mismatch: baseline=${baseline.platform}, requested=${PLATFORM}`);
  process.exit(2);
}

const growthPct = ((currentBytes - baseline.bytes) / baseline.bytes) * 100;
console.log(
  `▸ Baseline: ${mb(baseline.bytes)}  ·  Current: ${mb(currentBytes)}  ·  Growth: ${growthPct.toFixed(2)}%  (limit ${THRESHOLD}%)`,
);

// Expose results to GitHub Actions step outputs (used by the PR comment step).
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    [
      `platform=${PLATFORM}`,
      `baseline_bytes=${baseline.bytes}`,
      `current_bytes=${currentBytes}`,
      `baseline_mb=${(baseline.bytes / 1024 / 1024).toFixed(2)}`,
      `current_mb=${(currentBytes / 1024 / 1024).toFixed(2)}`,
      `growth_pct=${growthPct.toFixed(2)}`,
      `threshold_pct=${THRESHOLD}`,
      `verdict=${growthPct > THRESHOLD ? 'fail' : 'pass'}`,
      '',
    ].join('\n'),
  );
}

if (growthPct > THRESHOLD) {
  console.error(
    `\n✖ Bundle grew ${growthPct.toFixed(2)}% — over the ${THRESHOLD}% limit.\n` +
      `  Check recent dependency additions, or intentionally re-baseline with:\n` +
      `  BUNDLE_PLATFORM=${PLATFORM} npm run bundle:size:update\n`,
  );
  process.exit(1);
}

console.log('✔ Bundle size within limit.');
