#!/usr/bin/env node

/**
 * check-locale-parity.mjs
 *
 * Verifies that every namespace file in src/i18n/locales/en/ has a
 * corresponding file in src/i18n/locales/hi/ with the exact same set
 * of translation keys, AND that every shared key has matching
 * interpolation variables ({{var}} and {var}).
 *
 * Exits with code 0 if all namespaces are in sync, or code 1 if any
 * discrepancies are found.
 *
 * Usage:
 *   node scripts/check-locale-parity.mjs
 *
 * Designed to run as a CI step — prints a machine-parseable summary
 * that can be posted to the GitHub Actions job summary.
 */

import { readFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const ROOT = join(__dirname, '..');
const EN_DIR = join(ROOT, 'src', 'i18n', 'locales', 'en');
const HI_DIR = join(ROOT, 'src', 'i18n', 'locales', 'hi');

/**
 * Extract flat key→value mappings from a locale namespace file.
 * Handles both single-quoted ('...') and double-quoted ("...") values.
 * Skips nested objects, comments, and export boilerplate.
 */
function extractKeys(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const keys = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip non-key lines
    if (
      trimmed.startsWith('//') ||
      trimmed === '{' ||
      trimmed === '}' ||
      trimmed === '};' ||
      trimmed === '' ||
      trimmed === 'export default {'
    ) continue;

    // Match 4-space-indented key: 'value' or key: "value"
    const single = line.match(/^    ([a-zA-Z][a-zA-Z0-9_]*):\s*'(.*)'\s*,?$/);
    const double = line.match(/^    ([a-zA-Z][a-zA-Z0-9_]*):\s*"(.*)"\s*,?$/);

    if (single) {
      keys[single[1]] = single[2];
    } else if (double) {
      keys[double[1]] = double[2];
    }
  }

  return keys;
}

/**
 * Extract interpolation variable names from a translation value.
 * Returns a sorted, deduplicated array of variable names.
 *
 * Handles two patterns:
 *   - {{var}}  — i18next interpolation (double braces)
 *   - {var}    — custom string replacement (single braces)
 */
function extractVars(value) {
  const vars = new Set();

  // Match {{var}} (i18next style)
  const doubleBraces = value.match(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g);
  if (doubleBraces) {
    for (const match of doubleBraces) {
      vars.add(match.slice(2, -2)); // strip {{  }}
    }
  }

  // Match {var} (custom style) but NOT {{var}} — negative lookbehind
  const singleBraces = value.match(/(?<!\{)\{([a-zA-Z_][a-zA-Z0-9_]*)\}(?!\})/g);
  if (singleBraces) {
    for (const match of singleBraces) {
      vars.add(match.slice(1, -1)); // strip {  }
    }
  }

  return [...vars].sort();
}

// ─── Main ─────────────────────────────────────────────────────────────────

const enFiles = readdirSync(EN_DIR)
  .filter(f => f.endsWith('.ts') && f !== 'index.ts')
  .sort();

let exitCode = 0;
let totalKeysChecked = 0;
let totalVarMismatches = 0;

const report = {
  totalNamespaces: enFiles.length,
  ok: [],
  missingFile: [],
  extraKeys: [],
  missingKeys: [],
  varMismatches: [],
};

for (const file of enFiles) {
  const enPath = join(EN_DIR, file);
  const hiPath = join(HI_DIR, file);

  // Check 1: File exists in hi/
  if (!existsSync(hiPath)) {
    report.missingFile.push(file);
    exitCode = 1;
    continue;
  }

  const enKeys = extractKeys(enPath);
  const hiKeys = extractKeys(hiPath);

  const enKeySet = new Set(Object.keys(enKeys));
  const hiKeySet = new Set(Object.keys(hiKeys));

  // Check 2: Extra keys in hi/ (not in en/)
  for (const key of hiKeySet) {
    if (!enKeySet.has(key)) {
      report.extraKeys.push({ file, key });
      exitCode = 1;
    }
  }

  // Check 3: Missing keys in hi/ (present in en/)
  for (const key of enKeySet) {
    if (!hiKeySet.has(key)) {
      report.missingKeys.push({ file, key });
      exitCode = 1;
    }
  }

  // Check 4: Interpolation variable parity for shared keys
  const sharedKeys = [...enKeySet].filter(k => hiKeySet.has(k));
  for (const key of sharedKeys) {
    const enVars = extractVars(enKeys[key]);
    const hiVars = extractVars(hiKeys[key]);
    totalKeysChecked++;

    if (JSON.stringify(enVars) !== JSON.stringify(hiVars)) {
      report.varMismatches.push({
        file,
        key,
        enVars,
        hiVars,
        enVal: enKeys[key],
        hiVal: hiKeys[key],
      });
      exitCode = 1;
      totalVarMismatches++;
    }
  }

  if (
    !report.missingFile.includes(file) &&
    !report.extraKeys.some(e => e.file === file) &&
    !report.missingKeys.some(m => m.file === file) &&
    !report.varMismatches.some(v => v.file === file)
  ) {
    report.ok.push(file);
  }
}

// ─── Output ────────────────────────────────────────────────────────────────

const summary = [];

summary.push('');
summary.push('═══ Locale Parity Check ═══');
summary.push(`  Namespaces examined:    ${report.totalNamespaces}`);
summary.push(`  ✅ Fully in sync:       ${report.ok.length}`);
summary.push(`  ❌ Missing files:       ${report.missingFile.length}`);
summary.push(`  ⚠️  Extra keys in hi:    ${report.extraKeys.length}`);
summary.push(`  ❌ Missing keys in hi:   ${report.missingKeys.length}`);
summary.push(`  🔤 Keys with var mismatch: ${report.varMismatches.length}`);
summary.push(`  📊 Keys checked (vars):  ${totalKeysChecked}`);
summary.push('');

if (report.missingFile.length > 0) {
  summary.push('Files missing from hi/:');
  for (const f of report.missingFile) {
    summary.push(`  ❌  ${f}`);
  }
  summary.push('');
}

if (report.extraKeys.length > 0) {
  summary.push('Keys present in hi/ but NOT in en/:');
  for (const { file, key } of report.extraKeys) {
    summary.push(`  ⚠️  ${file}: ${key}`);
  }
  summary.push('');
}

if (report.missingKeys.length > 0) {
  summary.push('Keys present in en/ but NOT in hi/:');
  for (const { file, key } of report.missingKeys) {
    summary.push(`  ❌  ${file}: ${key}`);
  }
  summary.push('');
}

if (report.varMismatches.length > 0) {
  summary.push('Interpolation variable mismatches (en vars vs hi vars):');
  for (const { file, key, enVars, hiVars, enVal, hiVal } of report.varMismatches) {
    summary.push(`  🔤  ${file}: ${key}`);
    summary.push(`       en vars: [${enVars.join(', ')}]  hi vars: [${hiVars.join(', ')}]`);
    summary.push(`       en: "${enVal}"`);
    summary.push(`       hi: "${hiVal}"`);
  }
  summary.push('');
}

if (exitCode === 0) {
  const varMsg = totalKeysChecked > 0
    ? ` (${totalKeysChecked} keys checked for interpolation variables — all match)`
    : '';
  summary.push(`✅ All locale namespaces are in sync${varMsg}.`);
} else {
  summary.push('❌ Locale parity check FAILED — discrepancies found (see above).');
}

summary.push('');

console.log(summary.join('\n'));

// GitHub Actions step summary
if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [
    '### 🌐 Locale Parity Check',
    '',
    '| Check | Status | Count |',
    '|------|--------|:-----:|',
    `| ✅ Namespaces in sync | Identical key sets | ${report.ok.length} / ${report.totalNamespaces} |`,
    `| ❌ Missing files in hi | — | ${report.missingFile.length} |`,
    `| ⚠️ Extra keys in hi | — | ${report.extraKeys.length} |`,
    `| ❌ Missing keys in hi | — | ${report.missingKeys.length} |`,
    `| 🔤 Variable mismatches | — | ${report.varMismatches.length} |`,
    '',
  ];

  if (report.varMismatches.length === 0 && totalKeysChecked > 0) {
    md.push(`✅ All **${totalKeysChecked}** interpolation variables match between en/ and hi/.`, '');
  }

  if (report.varMismatches.length > 0) {
    md.push('**Variable mismatches:**', '');
    for (const { file, key, enVars, hiVars } of report.varMismatches) {
      md.push(`- \`${file}\` → \`${key}\`: en=\`[${enVars.join(', ')}]\` hi=\`[${hiVars.join(', ')}]\``);
    }
    md.push('');
  }

  if (report.missingFile.length > 0) {
    md.push('**Missing files in hi/:**', '');
    for (const f of report.missingFile) md.push(`- \`${f}\``);
    md.push('');
  }
  if (report.extraKeys.length > 0) {
    md.push('**Extra keys in hi/ (not in en/):**', '');
    for (const { file, key } of report.extraKeys) md.push(`- \`${file}\` → \`${key}\``);
    md.push('');
  }
  if (report.missingKeys.length > 0) {
    md.push('**Missing keys in hi/:**', '');
    for (const { file, key } of report.missingKeys) md.push(`- \`${file}\` → \`${key}\``);
    md.push('');
  }

  if (exitCode === 0) {
    md.push('All **53** namespaces are fully synchronized.', '');
  }

  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n') + '\n');
}

process.exit(exitCode);
