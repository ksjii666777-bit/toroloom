/**
 * Batch fix for react-hooks/exhaustive-deps warnings.
 * Adds missing dependencies to hook dependency arrays.
 *
 * Safe deps (add to array):
 *   - t, CONSTANTS, functions from stores, state variables
 *   - Not animated value refs (fadeAnim, slideAnim, etc.) or styles.*
 *
 * Usage: node scripts/fix-exhaustive-deps.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

const reportPath = process.argv[2] || 'eslint_final2.json';
if (!existsSync(reportPath)) reportPath = 'eslint_final2.json';
if (!existsSync(reportPath)) {
  console.error('Report not found. Run: npx eslint . --format json > eslint_final2.json');
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));

// Deps that should NOT be added (stable refs, StyleSheet objects)
const SKIP_DEPS = new Set([
  'fadeAnim', 'slideAnim', 'glowAnim', 'glowProgress',
  'codeOpacity', 'codeScale', 'pulseAnim', 'countUpProgress',
  'index',
]);

// Deps that start with these prefixes should be skipped
const SKIP_PREFIXES = ['styles.', 'anim', 'Anim', 'animation'];

function shouldSkip(dep) {
  if (SKIP_DEPS.has(dep)) return true;
  for (const prefix of SKIP_PREFIXES) {
    if (dep.startsWith(prefix)) return true;
  }
  return false;
}

let totalFixed = 0;
let totalFiles = 0;

for (const entry of report) {
  const messages = (entry.messages || []).filter(
    m => m.ruleId === 'react-hooks/exhaustive-deps'
  );
  if (messages.length === 0) continue;

  const filePath = entry.filePath;
  if (!filePath) continue;

  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    continue;
  }

  const lines = content.split('\n');
  let changed = false;

  // Collect missing deps by line, from bottom to top
  const byLine = {};
  for (const m of messages) {
    const line = m.line || 1;
    // Extract missing deps from the message
    const deps = (m.message.match(/'([^']+)'/g) || [])
      .map(d => d.replace(/'/g, ''))
      .filter(d => !shouldSkip(d));
    
    if (deps.length === 0) continue;
    if (!byLine[line]) byLine[line] = [];
    byLine[line].push(deps);
  }

  const sortedLines = Object.keys(byLine).map(Number).sort((a, b) => b - a);

  for (const lineNum of sortedLines) {
    const depsList = byLine[lineNum];
    const idx = lineNum - 1;
    if (idx >= lines.length) continue;

    const line = lines[idx];
    
    // Find the dependency array: [...] at the end of the line or on the same line
    const depArrayMatch = line.match(/(\.[a-zA-Z]+)?\([^)]*\)[\s\S]*?,\s*\[([^\]]*)\](\s*\))?/);
    if (!depArrayMatch) continue;

    const existingDeps = depArrayMatch[2].trim();
    const existingSet = existingDeps ? new Set(existingDeps.split(',').map(d => d.trim())) : new Set();

    // Add all safe missing deps
    let added = false;
    for (const deps of depsList) {
      for (const dep of deps) {
        if (dep && !existingSet.has(dep)) {
          existingSet.add(dep);
          added = true;
        }
      }
    }

    if (!added) continue;

    const newDeps = Array.from(existingSet).filter(d => d).join(', ');
    const fullMatch = depArrayMatch[0];
    const newFullMatch = fullMatch.replace(/\[([^\]]*)\]/, '[' + newDeps + ']');
    lines[idx] = line.replace(fullMatch, newFullMatch);
    changed = true;
    totalFixed++;
  }

  if (changed) {
    writeFileSync(filePath, lines.join('\n'), 'utf8');
    totalFiles++;
    console.log('Fixed: ' + filePath.split(/[/\\]/).slice(-2).join('/') + ' (' + Object.keys(byLine).length + ' hooks)');
  }
}

console.log(`\nTotal: ${totalFixed} hooks fixed across ${totalFiles} files`);
