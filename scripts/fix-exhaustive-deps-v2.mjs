/**
 * fix-exhaustive-deps-v2.mjs
 *
 * Reads ESLint JSON output and fixes react-hooks/exhaustive-deps warnings
 * by adding missing dependencies and removing unnecessary ones.
 *
 * Usage: node scripts/fix-exhaustive-deps-v2.mjs <eslint-report.json>
 */

import fs from 'fs';
import path from 'path';

const reportPath = process.argv[2] || 'eslint_final2.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const LINE_BREAK = '\n';
const projectRoot = process.cwd();

// Collect all warnings by file
const fileWarnings = new Map();
for (const result of report) {
  for (const msg of result.messages || []) {
    if (msg.ruleId !== 'react-hooks/exhaustive-deps') continue;
    const fp = result.filePath;
    if (!fileWarnings.has(fp)) fileWarnings.set(fp, []);
    fileWarnings.get(fp).push({ line: msg.line, column: msg.column, message: msg.message });
  }
}

let totalFixed = 0;
let totalFiles = 0;

for (const [filePath, warnings] of fileWarnings) {
  // Read file content
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(LINE_BREAK);

  // Process warnings from bottom to top to preserve line numbers
  const sorted = [...warnings].sort((a, b) => b.line - a.line);
  let modified = false;

  for (const warn of sorted) {
    const { line: targetLine, message } = warn;
    const lineIdx = targetLine - 1;
    const line = lines[lineIdx];
    if (!line) continue;

    // Check if this is a dep array line (ends with ] or has [...])
    const depArrayMatch = line.match(/\[([^\]]*)\]$/);
    if (!depArrayMatch) continue;

    let depsStr = depArrayMatch[1].trim();
    const deps = depsStr ? depsStr.split(',').map(d => d.trim()).filter(d => d.length > 0) : [];

    // Parse the warning message
    const isUnnecessary = message.includes('unnecessary dependency');
    const isMissing = message.includes('missing dependenc');

    if (isUnnecessary) {
      // Extract the unnecessary dependency name
      const unnecMatch = message.match(/'([^']+)'/);
      const unnecDep = unnecMatch ? unnecMatch[1] : null;
      if (unnecDep) {
        const newDeps = deps.filter(d => d !== unnecDep);
        if (newDeps.length !== deps.length) {
          const newDepsStr = newDeps.length > 0 ? ' ' + newDeps.join(', ') + ' ' : '';
          lines[lineIdx] = line.replace(/\[([^\]]*)\]$/, `[${newDepsStr}]`);
          modified = true;
          totalFixed++;
          console.log(`  REMOVED unnecessary dep '${unnecDep}' in ${path.basename(filePath)}:${targetLine}`);
        }
      }
    } else if (isMissing) {
      // Extract all missing dependencies
      const missingDeps = [...message.matchAll(/'([^']+)'/g)].map(m => m[1]);
      if (missingDeps.length === 0) continue;

      // Add only missing deps that aren't already in the array
      const existingSet = new Set(deps);
      const toAdd = missingDeps.filter(d => !existingSet.has(d));
      if (toAdd.length === 0) continue;

      const newDeps = [...deps, ...toAdd];
      // Determine indentation from the original line
      const indent = line.match(/^\s*/)[0];
      // Calculate if the new deps array fits on one line
      const newDepsStr = newDeps.join(', ');
      // Replace the dep array
      lines[lineIdx] = line.replace(/\[([^\]]*)\]$/, `[${newDepsStr}]`);
      modified = true;
      totalFixed++;
      console.log(`  ADDED deps [${toAdd.join(', ')}] in ${path.basename(filePath)}:${targetLine}`);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, lines.join(LINE_BREAK), 'utf8');
    totalFiles++;
  }
}

console.log(`\n✅ Fixed ${totalFixed} exhaustive-deps warnings across ${totalFiles} files`);
