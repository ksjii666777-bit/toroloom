#!/usr/bin/env node
// Temporary helper: print exact hardcoded-string lines for given files (same heuristics as audit-i18n.mjs)
import { readFileSync } from 'node:fs';

const STRING_PROPS = [
  'title', 'label', 'placeholder', 'headerTitle', 'buttonText',
  'message', 'subtitle', 'description', 'confirmText', 'cancelText',
  'successText', 'errorText', 'hint', 'helperText', 'emptyText',
  'footerText', 'submitText', 'sectionTitle', 'badgeText', 'tooltip',
  'alertTitle', 'alertMessage', 'dialogTitle', 'dialogMessage',
  'rightLabel', 'leftLabel', 'toggleLabel', 'screenTitle',
  'text1', 'text2', 'heading',
];

const STRIP_RE = [
  /\btestID\s*=\s*["'][^"']*["']/g,
  /\baccessibilityLabel\s*=\s*["'][^"']*["']/g,
  /\baccessibilityHint\s*=\s*["'][^"']*["']/g,
  /\baccessibilityRole\s*=\s*["'][^"']*["']/g,
  /\bkey\s*=\s*["'][^"']*["']/g,
  /\bname\s*=\s*["'][^"']*["']/g,
  /data-testid="[^"]*"/g,
];

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
  const jsxText = line.match(/>\s*([A-Za-z][A-Za-z0-9 ,.'&()%₹/-]{2,})\s*</);
  if (jsxText && !/^[0-9%₹.\s-]+$/.test(jsxText[1])) {
    const words = jsxText[1].trim().split(/\s+/);
    if (words.some((w) => w.length >= 4) || words.length >= 2) return true;
  }
  const jsxExpr = line.match(/>\s*\{\s*['"]([^'"{}\]]{3,})['"]\s*\}\s*</);
  if (jsxExpr && /[A-Za-z]{4,}/.test(jsxExpr[1]) && !/^[0-9%₹.\s-]+$/.test(jsxExpr[1])) return true;
  const propRe = new RegExp(`\\b(${STRING_PROPS.join('|')})\\s*=\\s*["']([^"'` + '`' + `]{3,})["']`);
  const propMatch = line.match(propRe);
  if (propMatch) {
    const value = propMatch[2];
    if (/^[A-Za-z]/.test(value) && value.split(/\s+/).some((w) => w.length >= 4)) return true;
  }
  const alertMatch = line.match(/Alert\.(alert|show)\s*\(\s*["']([^"']{3,})["']/);
  if (alertMatch && /[A-Za-z]{4,}/.test(alertMatch[2])) return true;
  return false;
}

for (const file of process.argv.slice(2)) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  console.log(`\n===== ${file} =====`);
  lines.forEach((raw, i) => {
    const line = stripProps(raw.trim());
    if (IGNORE_PATTERNS.some((re) => re.test(line))) return;
    if (hasHardcodedText(line)) console.log(`${i + 1}: ${raw.trim()}`);
  });
}
