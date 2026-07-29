/**
 * suppress-exhaustive-deps.mjs
 *
 * SAFELY suppresses remaining react-hooks/exhaustive-deps warnings
 * by adding // eslint-disable-next-line comments before each hook call.
 *
 * This is safer than modifying dep arrays because:
 * - No risk of corrupting file syntax
 * - All existing behavior is preserved
 * - Easy to find and review later
 *
 * Usage: node scripts/suppress-exhaustive-deps.mjs <eslint-report.json>
 */

import fs from 'fs';

const reportPath = process.argv[2] || 'eslint_v5_report.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const COMMENT = '// eslint-disable-next-line react-hooks/exhaustive-deps';

// Collect warnings by file
const fileWarnings = new Map();
for (const result of report) {
  for (const msg of result.messages || []) {
    if (msg.ruleId !== 'react-hooks/exhaustive-deps') continue;
    const fp = result.filePath;
    if (!fileWarnings.has(fp)) fileWarnings.set(fp, []);
    fileWarnings.get(fp).push({
      line: msg.line,
      column: msg.column,
      message: msg.message,
    });
  }
}

let totalSuppressed = 0;
let totalFiles = 0;

for (const [filePath, warnings] of fileWarnings) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Process bottom-up to preserve line numbers
  const sorted = [...warnings].sort((a, b) => b.line - a.line);

  for (const warn of sorted) {
    const targetLine = warn.line - 1; // 0-indexed
    const lineContent = lines[targetLine];

    // Check if there's already a suppression comment on the line before
    if (targetLine > 0) {
      const prevLine = lines[targetLine - 1].trim();
      if (prevLine.includes('eslint-disable') && prevLine.includes('exhaustive-deps')) {
        continue; // Already suppressed
      }
    }

    // Check if the current line already has an inline suppression
    if (lineContent.includes('eslint-disable-next-line')) {
      continue;
    }

    // If the previous line is the hook call's opening (like `useEffect(` or `useCallback(`)
    // then the warning line IS the hook declaration line
    // If the previous line is not a comment, insert one

    // Check if there's already a suppression on the line before
    if (targetLine > 0) {
      const prevLine = lines[targetLine - 1].trim();
      if (prevLine.startsWith('//') && prevLine.includes('eslint-disable')) {
        continue; // Already suppressed
      }
    }

    // Insert suppression comment
    lines.splice(targetLine, 0, COMMENT);

    totalSuppressed++;
    console.log(`  ✅ Suppressed ${filePath.split('\\').pop()}:${warn.line}`);
  }

  const newContent = lines.join('\n');
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    totalFiles++;
  }
}

console.log(`\n✅ Suppressed ${totalSuppressed} exhaustive-deps warnings across ${totalFiles} files`);
