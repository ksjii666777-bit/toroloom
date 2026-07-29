/**
 * fix-exhaustive-deps-v4.mjs
 *
 * SAFELY fixes react-hooks/exhaustive-deps warnings by:
 * 1. Parsing ESLint JSON report for exact warnings
 * 2. For each file, finding dep arrays using bracket-depth tracking
 * 3. Adding missing deps / removing unnecessary deps
 * 4. Modifying only the dep array content, preserving all other formatting
 *
 * Usage: node scripts/fix-exhaustive-deps-v4.mjs <eslint-report.json>
 * If no argument given, runs ESLint fresh and reads from temp file.
 */

import fs from 'fs';
import { execSync } from 'child_process';

// ── 1. Get ESLint report ──────────────────────────────────────────────
let reportPath = process.argv[2];
if (!reportPath) {
  console.log('Generating fresh ESLint report...');
  execSync('npx eslint . --max-warnings=-1 --format json > eslint_v4_report.json', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  reportPath = 'eslint_v4_report.json';
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// ── 2. Collect warnings by file ───────────────────────────────────────
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
      endLine: msg.endLine || msg.line,
      endColumn: msg.endColumn || msg.column + 10,
    });
  }
}

// ── 3. Helpers ────────────────────────────────────────────────────────
function findDepArray(lines, startLineIdx) {
  // Scan forward from startLineIdx to find a [...] that looks like a dep array
  // The dep array is always the last argument to the hook function
  // and starts after a `,` or `(`

  let arrayStart = -1;
  let arrayEnd = -1;

  for (let i = startLineIdx; i < lines.length && i < startLineIdx + 30; i++) {
    const line = lines[i];
    // Find '[' in this line
    let searchFrom = 0;
    while (true) {
      const bracketIdx = line.indexOf('[', searchFrom);
      if (bracketIdx < 0) break;

      // Check if this looks like a dep array start:
      // It should be preceded by `,` or `(` or `=>` at end of previous logical content
      const beforeBracket = line.substring(0, bracketIdx).trimEnd();

      // Candidate: line ends with `,` or `(` before `[`
      // Or: `[` is on its own line (line starts with `[`)
      const isDepArrayCandidate =
        beforeBracket.endsWith(',') ||
        beforeBracket.endsWith('(') ||
        beforeBracket.endsWith('=>') ||
        beforeBracket.endsWith('=> ') ||
        bracketIdx === 0 ||
        beforeBracket.endsWith(')'); // handle `useEffect(() => ..., [...]`

      if (!isDepArrayCandidate) {
        searchFrom = bracketIdx + 1;
        continue;
      }

      // Now verify: scan forward to find matching ']' within reasonable range
      let depth = 1;
      let foundEnd = -1;
      for (let j = i; j < lines.length && j < i + 30 && depth > 0; j++) {
        const l = j === i ? line.substring(bracketIdx + 1) : lines[j];
        for (let k = 0; k < l.length && depth > 0; k++) {
          if (l[k] === '[') depth++;
          else if (l[k] === ']') {
            depth--;
            if (depth === 0) {
              foundEnd = j;
              break;
            }
          }
        }
        if (foundEnd >= 0) break;
      }

      if (foundEnd >= 0) {
        // Extract the array content
        const contentBetween = [];
        for (let j = i; j <= foundEnd; j++) {
          if (j === i) {
            contentBetween.push(line.substring(bracketIdx + 1));
          } else if (j === foundEnd) {
            // Find the ']' in this line
            const closeIdx = lines[j].indexOf(']');
            contentBetween.push(lines[j].substring(0, closeIdx));
          } else {
            contentBetween.push(lines[j]);
          }
        }
        const arrayContent = contentBetween.join('\n');

        // Sanity check: dep arrays should only contain simple identifiers, not objects
        // (unless it's extremely simple like {label: 'string'})
        const hasComplexContent = arrayContent.includes('=>') || 
          (arrayContent.includes('{') && !arrayContent.match(/^\s*\{/));

        if (!hasComplexContent || arrayContent.split(',').length <= 5) {
          arrayStart = i;
          arrayEnd = foundEnd;
          return { start: i, end: foundEnd, startCol: bracketIdx, content: arrayContent };
        }
      }

      searchFrom = bracketIdx + 1;
    }
  }

  return null;
}

function parseDeps(arrayContent) {
  // Split by commas, respecting potential nested brackets
  const parts = [];
  let current = '';
  let depth = 0;
  for (const ch of arrayContent) {
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      if (ch === '{' || ch === '[') depth++;
      if (ch === '}' || ch === ']') depth--;
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.filter(d => d.length > 0);
}

function reconstructArray(deps, originalLinesArray) {
  // Determine if original was single-line or multi-line
  const originalStr = originalLinesArray.join('\n').trim();
  const isMultiLine = originalStr.includes('\n');
  
  if (deps.length === 0) return '[]';
  
  if (isMultiLine) {
    // Preserve multi-line formatting
    return '[\n' + deps.map(d => '  ' + d).join(',\n') + ',\n]';
  }
  
  return '[' + deps.join(', ') + ']';
}

// ── 4. Process files ──────────────────────────────────────────────────
let totalFixed = 0;
let totalFiles = 0;

for (const [filePath, warnings] of fileWarnings) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  const lines = content.split('\n');

  // Process bottom-up to preserve line numbers
  const sorted = [...warnings].sort((a, b) => b.line - a.line);

  for (const warn of sorted) {
    const { line: warnLine, message } = warn;

    const isUnnecessary = message.includes('unnecessary dependency');
    const isMissing = message.includes('missing dependenc');
    if (!isUnnecessary && !isMissing) continue;

    // Find dep array starting from warnLine
    const startIdx = Math.max(0, warnLine - 2); // Search 1 line before too
    const arrayInfo = findDepArray(lines, startIdx);

    if (!arrayInfo) {
      console.log(`  ⚠️ Could not find dep array in ${filePath.split('\\').pop()} near line ${warnLine}`);
      continue;
    }

    // Extract deps from array
    const deps = parseDeps(arrayInfo.content);
    const existingSet = new Set(deps);

    if (isUnnecessary) {
      const unnecMatches = [...message.matchAll(/'([^']+)'/g)];
      let changed = false;

      for (const match of unnecMatches) {
        const unnecDep = match[1];
        const filtered = deps.filter(d => d !== unnecDep);
        if (filtered.length !== deps.length) {
          deps.length = 0; // Clear and refill
          deps.push(...filtered);
          changed = true;
          totalFixed++;
          console.log(`  ✅ REMOVED '${unnecDep}' in ${filePath.split('\\').pop()}:${warnLine}`);
        }
      }

      if (changed) {
        const arrayLines = lines.slice(arrayInfo.start, arrayInfo.end + 1);
        const newArrayStr = reconstructArray(deps, arrayLines);
        replaceInFile(lines, arrayInfo, newArrayStr);
      }
    } else if (isMissing) {
      const missingMatches = [...message.matchAll(/'([^']+)'/g)];
      const missingDeps = missingMatches.map(m => m[1]);
      const toAdd = missingDeps.filter(d => !existingSet.has(d));

      if (toAdd.length > 0) {
        deps.push(...toAdd);
        const arrayLines = lines.slice(arrayInfo.start, arrayInfo.end + 1);
        const newArrayStr = reconstructArray(deps, arrayLines);
        replaceInFile(lines, arrayInfo, newArrayStr);
        totalFixed++;
        console.log(`  ✅ ADDED [${toAdd.join(', ')}] in ${filePath.split('\\').pop()}:${warnLine}`);
      }
    }
  }

  const newContent = lines.join('\n');
  if (newContent !== originalContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    totalFiles++;
  }
}

function replaceInFile(lines, arrayInfo, newArrayStr) {
  const { start, end, startCol } = arrayInfo;
  
  if (start === end) {
    // Single line: replace [ ... ] on that line
    const line = lines[start];
    const beforeBracket = line.substring(0, startCol);
    // Find the matching ]
    const afterBracket = line.substring(startCol);
    const closeIdx = afterBracket.indexOf(']');
    if (closeIdx >= 0) {
      const afterClose = afterBracket.substring(closeIdx + 1);
      lines[start] = beforeBracket + newArrayStr + afterClose;
    }
  } else {
    // Multi-line: replace the entire range
    // First line: keep content before [
    const firstLine = lines[start];
    const beforeBracket = firstLine.substring(0, startCol);
    const afterFirstBracket = firstLine.substring(startCol);
    const firstCloseIdx = afterFirstBracket.indexOf('[');
    const afterFirstPart = firstCloseIdx >= 0 ? afterFirstBracket.substring(firstCloseIdx + 1) : '';
    
    // Last line: find ] and keep content after it
    const lastLine = lines[end];
    const closeIdx = lastLine.indexOf(']');
    const afterLast = closeIdx >= 0 ? lastLine.substring(closeIdx + 1) : lastLine;
    
    // Rebuild with new array content
    // Determine indentation from the first line
    const indent = firstLine.match(/^\s*/)[0];
    const arrayContentStr = newArrayStr;
    
    lines[start] = beforeBracket + arrayContentStr.split('\n')[0];
    // If multi-line, replace middle lines
    if (newArrayStr.includes('\n')) {
      const parts = newArrayStr.split('\n');
      lines[start] = beforeBracket + parts[0];
      for (let i = start + 1; i <= end; i++) {
        const partIdx = i - start;
        if (partIdx < parts.length) {
          lines[i] = indent + parts[partIdx];
        }
      }
      // If we have more parts than lines, we need to add lines
      // If we have fewer parts than lines, need to remove
      if (parts.length > (end - start + 1)) {
        // Add new lines
        for (let i = start + 1; i < parts.length; i++) {
          if (i - start < parts.length) {
            // Insert if enough room, otherwise use existing
            if (i <= end) {
              lines[i] = indent + parts[i - start];
            }
          }
        }
        // Handle the last line
        lines[end] = parts[parts.length - 1] + afterLast;
      } else {
        // Overwrite existing lines
        for (let i = start + 1; i <= end; i++) {
          const partIdx = i - start;
          if (partIdx < parts.length) {
            lines[i] = indent + parts[partIdx];
          }
        }
        // Handle the last line
        lines[end] = parts[parts.length - 1] + afterLast;
      }
    } else {
      // Single-line result replacing multi-line array
      lines[start] = beforeBracket + newArrayStr + afterLast;
      // Clear intervening lines
      for (let i = start + 1; i <= end; i++) {
        lines[i] = '';
      }
    }
  }
}

console.log(`\n✅ Fixed ${totalFixed} exhaustive-deps warnings across ${totalFiles} files`);
