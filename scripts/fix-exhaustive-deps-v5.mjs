/**
 * fix-exhaustive-deps-v5.mjs
 *
 * SIMPLE batch fix for react-hooks/exhaustive-deps warnings.
 * - For single-line dep arrays: inserts into [dep1, dep2]
 * - For multi-line dep arrays: inserts before closing ]
 * - NEVER reformats the array structure
 *
 * Usage: node scripts/fix-exhaustive-deps-v5.mjs <eslint-report.json>
 */

import fs from 'fs';

const reportPath = process.argv[2] || 'eslint_v5_report.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// Collect warnings by file
const fileWarnings = new Map();
for (const result of report) {
  for (const msg of result.messages || []) {
    if (msg.ruleId !== 'react-hooks/exhaustive-deps') continue;
    const fp = result.filePath;
    if (!fileWarnings.has(fp)) fileWarnings.set(fp, []);
    fileWarnings.get(fp).push({ line: msg.line, column: msg.column, message: msg.message });
  }
}

function findArrayBounds(lines, startLineIdx) {
  // Scan forward to find the dep array [...]
  for (let i = Math.max(0, startLineIdx - 1); i < lines.length && i < startLineIdx + 25; i++) {
    const line = lines[i];
    let searchFrom = 0;
    while (true) {
      const bracketIdx = line.indexOf('[', searchFrom);
      if (bracketIdx < 0) break;

      // Check if this [ starts a dep array (preceded by , or ( or =>
      const before = line.substring(0, bracketIdx).trimEnd();
      if (!before.endsWith(',') && !before.endsWith('(') && !before.endsWith(')') && !before.endsWith('=>') && bracketIdx > 0) {
        searchFrom = bracketIdx + 1;
        continue;
      }

      // Track brackets to find matching ]
      let depth = 1;
      for (let j = i; j < lines.length && j < i + 25; j++) {
        const l = j === i ? line.substring(bracketIdx + 1) : lines[j];
        for (let k = 0; k < l.length; k++) {
          if (l[k] === '[') depth++;
          if (l[k] === ']') {
            depth--;
            if (depth === 0) {
              // Found array end
              const contentParts = [];
              for (let m = i; m <= j; m++) {
                if (m === i && m === j) {
                  contentParts.push(line.substring(bracketIdx + 1, bracketIdx + 1 + k));
                } else if (m === i) {
                  contentParts.push(line.substring(bracketIdx + 1));
                } else if (m === j) {
                  contentParts.push(lines[m].substring(0, k));
                } else {
                  contentParts.push(lines[m]);
                }
              }
              return {
                startLine: i,
                endLine: j,
                startCol: bracketIdx,
                endCol: k,
                content: contentParts.join('\n'),
              };
            }
          }
        }
        if (depth === 0) break;
      }
      searchFrom = bracketIdx + 1;
    }
  }
  return null;
}

function parseDepsSimple(content) {
  // Split by top-level commas only
  const parts = [];
  let cur = '';
  let depth = 0;
  for (const ch of content) {
    if (ch === ',' && depth === 0) {
      const trimmed = cur.trim();
      if (trimmed) parts.push(trimmed);
      cur = '';
    } else {
      if ('{[('.includes(ch)) depth++;
      if (']})'.includes(ch)) depth--;
      cur += ch;
    }
  }
  const trimmed = cur.trim();
  if (trimmed) parts.push(trimmed);
  return parts;
}

let totalFixed = 0;
let totalFiles = 0;

for (const [filePath, warnings] of fileWarnings) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  const lines = content.split('\n');

  const sorted = [...warnings].sort((a, b) => b.line - a.line);

  for (const warn of sorted) {
    const { line: warnLine, message } = warn;
    const isUnnecessary = message.includes('unnecessary dependency');
    const isMissing = message.includes('missing dependenc');
    if (!isUnnecessary && !isMissing) continue;

    const arr = findArrayBounds(lines, warnLine - 1);
    if (!arr) {
      console.log(`  ⚠️ No array found in ${filePath.split('\\').pop()}:${warnLine}`);
      continue;
    }

    const deps = parseDepsSimple(arr.content);
    const existingSet = new Set(deps.map(d => d.replace(/\s+/g, '')));

    let changed = false;

    if (isUnnecessary) {
      const unnecMatches = [...message.matchAll(/'([^']+)'/g)];
      const toRemove = unnecMatches.map(m => m[1]);
      // Find the deps that aren't being removed
      const remaining = deps.filter(d => {
        const clean = d.replace(/\s+/g, '');
        return !toRemove.some(r => clean === r || clean === r.replace(/\s+/g, ''));
      });
      if (remaining.length !== deps.length) {
        // Rebuild the array
        const isSingleLine = arr.startLine === arr.endLine;
        if (isSingleLine) {
          const newStr = '[' + remaining.join(', ') + ']';
          const line = lines[arr.startLine];
          lines[arr.startLine] = line.substring(0, arr.startCol) + newStr + line.substring(arr.endCol + 1);
        } else {
          // Multi-line: rebuild
          const newLines = [];
          if (remaining.length === 0) {
            newLines.push('[]');
          } else {
            newLines.push('[');
            remaining.forEach(d => newLines.push('  ' + d + ','));
            newLines.push(']');
          }
          const indent = lines[arr.startLine].match(/^\s*/)[0];
          const before = lines[arr.startLine].substring(0, arr.startCol);
          const after = lines[arr.endLine].substring(arr.endCol + 1);
          lines[arr.startLine] = before + newLines[0] + after;
          // Clear middle lines or add/remove as needed
          if (newLines.length > 1) {
            for (let i = 1; i < newLines.length; i++) {
              const targetIdx = arr.startLine + i;
              if (targetIdx <= arr.endLine) {
                lines[targetIdx] = indent + newLines[i];
              } else {
                // Need more lines than original - shouldn't happen for removal
              }
            }
            // If original had more lines than new array, clear remaining
            for (let i = arr.startLine + newLines.length; i <= arr.endLine; i++) {
              lines[i] = '';
            }
          }
        }
        changed = true;
        totalFixed++;
        console.log(`  ✅ REMOVED [${toRemove.join(', ')}] in ${filePath.split('\\').pop()}:${warnLine}`);
      }
    } else if (isMissing) {
      const missingMatches = [...message.matchAll(/'([^']+)'/g)];
      const missingDeps = missingMatches.map(m => m[1]);
      const toAdd = missingDeps.filter(d => !existingSet.has(d.replace(/\s+/g, '')));

      if (toAdd.length > 0) {
        const isSingleLine = arr.startLine === arr.endLine;

        if (isSingleLine) {
          // Insert into existing single-line array
          const newContent = arr.content.trim();
          if (newContent.length === 0) {
            const newStr = '[' + toAdd.join(', ') + ']';
            const line = lines[arr.startLine];
            lines[arr.startLine] = line.substring(0, arr.startCol) + newStr + line.substring(arr.endCol + 1);
          } else {
            const newStr = '[' + newContent + ', ' + toAdd.join(', ') + ']';
            const line = lines[arr.startLine];
            lines[arr.startLine] = line.substring(0, arr.startCol) + newStr + line.substring(arr.endCol + 1);
          }
        } else {
          // Multi-line: insert before the last line (which has ])
          // The ] is on the last line
          const closeLine = lines[arr.endLine];
          // Insert new deps as new lines before the closing ]
          const indent = lines[arr.startLine].match(/^\s*/)[0];
          const newLines = toAdd.map(d => indent + '  ' + d + ',');
          
          // Insert into array
          const newLinesArr = [];
          newLinesArr.push(lines[arr.endLine]); // save closing ]
          lines[arr.endLine] = newLines[0]; // put first dep on current last line
          for (let i = 1; i < newLines.length; i++) {
            lines.splice(arr.endLine + i, 0, newLines[i]);
          }
          // Put ] after all new lines
          lines.splice(arr.endLine + newLines.length, 0, closeLine);
        }

        changed = true;
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

console.log(`\n✅ Fixed ${totalFixed} exhaustive-deps warnings across ${totalFiles} files`);
