#!/usr/bin/env node

/**
 * audit-i18n.mjs
 *
 * Audits all src/screens and src/components files for i18n conversion status.
 * For each file, reports:
 *   - uses useT()? (converted indicator)
 *   - estimated count of hardcoded user-facing English string LINES
 *
 * Heuristic-based line scan — NOT a full parser. Use for ranking which
 * screens still need conversion, not for exact string counts.
 *
 * Usage:
 *   node scripts/audit-i18n.mjs [--json]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');

// Directories to audit
const TARGETS = [
  join(SRC, 'screens'),
  join(SRC, 'components'),
];

// Props commonly holding user-facing strings
const STRING_PROPS = [
  'title', 'label', 'placeholder', 'headerTitle', 'buttonText',
  'message', 'subtitle', 'description', 'confirmText', 'cancelText',
  'successText', 'errorText', 'hint', 'helperText', 'emptyText',
  'footerText', 'submitText', 'sectionTitle', 'badgeText', 'tooltip',
  'alertTitle', 'alertMessage', 'dialogTitle', 'dialogMessage',
  'rightLabel', 'leftLabel', 'toggleLabel', 'screenTitle',
  'text1', 'text2', 'heading',
];

// Props holding technical (non-translatable) values — strip them so the
// rest of the line can still be scanned.
const STRIP_RE = [
  /\btestID\s*=\s*["'][^"']*["']/g,
  /\baccessibilityLabel\s*=\s*["'][^"']*["']/g,
  /\baccessibilityHint\s*=\s*["'][^"']*["']/g,
  /\baccessibilityRole\s*=\s*["'][^"']*["']/g,
  /\bkey\s*=\s*["'][^"']*["']/g,
  /\bname\s*=\s*["'][^"']*["']/g, // Ionicons names etc.
  /data-testid="[^"]*"/g,
];

// Regexes for whole lines that are definitely NOT user-facing
const IGNORE_PATTERNS = [
  /^\s*[)}],?$/,
  /^\s*[({]/,
  /\bicon\s*=\s*["']/,
  /\broute\s*=/,
  /navigation\.(navigate|push|replace|pop)/,
];

function stripProps(line) {
  let out = line;
  for (const re of STRIP_RE) out = out.replace(re, ' ');
  return out;
}

function hasHardcodedText(line) {
  if (line.includes('t(') || line.includes('useT(')) return false;

  // 1. JSX text content: <Text>Hello World</Text> or >Hello<
  //    Excludes {expressions} and numbers/currency-only
  const jsxText = line.match(/>\s*([A-Za-z][A-Za-z0-9 ,.'&()%₹/-]{2,})\s*</);
  if (jsxText && !/^[0-9%₹.\s-]+$/.test(jsxText[1])) {
    const words = jsxText[1].trim().split(/\s+/);
    if (words.some((w) => w.length >= 4) || words.length >= 2) return true;
  }

  // 1b. JSX string-literal text: <Text>{'Loading...'}</Text>
  const jsxExpr = line.match(/>\s*\{\s*['"]([^'"{}]{3,})['"]\s*\}\s*</);
  if (jsxExpr && /[A-Za-z]{4,}/.test(jsxExpr[1]) && !/^[0-9%₹.\s-]+$/.test(jsxExpr[1])) return true;

  // 2. String props
  const propRe = new RegExp(
    `\\b(${STRING_PROPS.join('|')})\\s*=\\s*["']([^"'` + '`' + `]{3,})["']`,
  );
  const propMatch = line.match(propRe);
  if (propMatch) {
    const value = propMatch[2];
    if (/^[A-Za-z]/.test(value) && value.split(/\s+/).some((w) => w.length >= 4)) return true;
  }

  // 3. Alert.alert('Title', 'Message')
  const alertMatch = line.match(/Alert\.(alert|show)\s*\(\s*["']([^"']{3,})["']/);
  if (alertMatch && /[A-Za-z]{4,}/.test(alertMatch[2])) return true;

  return false;
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, acc);
    } else if (/\.(tsx|ts)$/.test(entry) && !entry.endsWith('.test.tsx') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

const files = [];
for (const dir of TARGETS) {
  if (statSync(dir).isDirectory()) walk(dir, files);
}

const mapped = files
  .map((file) => {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const usesUseT = /\buseT\s*\(/.test(content) || /from ['"].*useT['"]/.test(content);
    const hardcoded = lines
      .map((line) => stripProps(line.trim()))
      .filter((line) => !IGNORE_PATTERNS.some((re) => re.test(line)))
      .filter(hasHardcodedText)
      .length;
    return { file: relative(ROOT, file), usesUseT, hardcoded };
  })
  .filter((r) => !r.file.includes('.stories.'));

const results = [...mapped]
  .filter((r) => !r.usesUseT || r.hardcoded > 0)
  .sort((a, b) => b.hardcoded - a.hardcoded);

const json = process.argv.includes('--json');
if (json) {
  console.log(JSON.stringify(results, null, 2));
} else {
  const totalFiles = mapped.length;
  const converted = mapped.filter((f) => f.usesUseT).length;
  const notConverted = results.filter((r) => !r.usesUseT);
  const partial = results.filter((r) => r.usesUseT && r.hardcoded > 0);

  console.log('═══ i18n Audit ═══');
  console.log(`Files scanned:        ${totalFiles}`);
  console.log(`Use useT (converted): ${converted}`);
  console.log(`NOT converted:        ${notConverted.length}`);
  console.log(`Converted but hardcoded left: ${partial.length}`);
  console.log('');

  console.log('── 🔴 NOT converted (no useT) ──');
  for (const r of notConverted) {
    console.log(`  ${String(r.hardcoded).padStart(4)}  ${r.file}`);
  }

  console.log('');
  console.log('── 🟡 Converted but still has hardcoded strings ──');
  for (const r of partial) {
    console.log(`  ${String(r.hardcoded).padStart(4)}  ${r.file}`);
  }

  console.log('');
  console.log('Tip: heuristics count string LINES, not exact strings. Review each file to confirm.');
}
