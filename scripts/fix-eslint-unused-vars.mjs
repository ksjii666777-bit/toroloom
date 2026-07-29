/**
 * Batch fix script for @typescript-eslint/no-unused-vars
 *
 * Reads ESLint JSON output and for each file with unused-vars warnings:
 * - Removes unused named imports from import statements
 * - Prefixes unused variables with underscore (_)
 *
 * Usage: node scripts/fix-eslint-unused-vars.mjs <eslint_report.json>
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { sep } from 'path';

const reportPath = process.argv[2] || 'eslint_remaining.json';
if (!existsSync(reportPath)) {
  console.error('Report file not found:', reportPath);
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));

let totalFixed = 0;
let totalFiles = 0;

for (const entry of report) {
  const unusedVars = (entry.messages || []).filter(
    m => m.ruleId === '@typescript-eslint/no-unused-vars'
  );
  if (unusedVars.length === 0) continue;

  const filePath = entry.filePath;
  if (!filePath) continue;

  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    continue;
  }

  let changed = false;
  const lines = content.split('\n');

  // Group warnings by line
  const byLine = {};
  for (const w of unusedVars) {
    const line = w.line || 1;
    if (!byLine[line]) byLine[line] = [];
    byLine[line].push(w);
  }

  // Process from bottom to top to preserve line numbers
  const sortedLines = Object.keys(byLine).map(Number).sort((a, b) => b - a);

  for (const lineNum of sortedLines) {
    const warnings = byLine[lineNum];
    const idx = lineNum - 1;
    if (idx >= lines.length) continue;

    const originalLine = lines[idx];
    let modifiedLine = originalLine;

    for (const w of warnings) {
      const varName = extractVarName(w.message);
      if (!varName) continue;

      // Strategy 1: Remove unused named import from import statement
      if (modifiedLine.includes('import ')) {
        const newLine = removeFromImport(modifiedLine, varName);
        if (newLine !== modifiedLine) {
          modifiedLine = newLine;
          changed = true;
          totalFixed++;
          continue;
        }
      }

      // Strategy 2: Prefix with underscore (for non-import params/vars)
      if (!varName.startsWith('_')) {
        const prefixed = '_' + varName;
        const re = new RegExp('\\b' + escapeRegex(varName) + '\\b');
        modifiedLine = modifiedLine.replace(re, prefixed);
        changed = true;
        totalFixed++;
      }
    }

    if (modifiedLine !== originalLine) {
      lines[idx] = modifiedLine;
    }
  }

  if (changed) {
    writeFileSync(filePath, lines.join('\n'), 'utf8');
    totalFiles++;
    console.log('Fixed: ' + filePath.split(sep).slice(-3).join('/'));
  }
}

console.log(`\nTotal: ${totalFixed} warnings fixed across ${totalFiles} files`);

function extractVarName(message) {
  const match = message.match(/'([^']+)'/);
  return match ? match[1] : null;
}

function removeFromImport(line, varName) {
  // Pattern: import { ..., VAR, ... } from '...'
  const escapedName = escapeRegex(varName);
  
  // Remove the var name + optional comma from within import { }
  const importMatch = line.match(/^(\s*import\s*\{)([^}]*)(\}.*)/);
  if (!importMatch) return line;

  const prefix = importMatch[1];
  let inner = importMatch[2];
  const suffix = importMatch[3];

  // Check if the varName exists in the inner part
  const nameRe = new RegExp('\\s*' + escapedName + '\\s*,?\\s*|\\s*,\\s*' + escapedName + '\\s*');
  if (!new RegExp('\\b' + escapedName + '\\b').test(inner)) return line;

  inner = inner.replace(nameRe, ' ').trim();
  
  // If inner is empty, check if it was the only import
  if (!inner) {
    // Remove the entire import line for a side-effect import
    return ''; // Will skip this line
  }

  return prefix + ' ' + inner + ' ' + suffix;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
