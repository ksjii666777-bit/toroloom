/**
 * Fix specific lint warnings based on eslint output.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const cwd = process.cwd();
const output = execSync(`cd "${cwd}" && npm run lint 2>&1`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

// Parse warnings with all details
const warnings = [];
for (const line of output.split('\n')) {
  const m = line.match(/^(.+?):(\d+):(\d+)\s+warning\s+(.+?)\s+@typescript-eslint\/no-unused-vars$/);
  if (m) warnings.push({ file: m[1], line: parseInt(m[2]), col: parseInt(m[3]), msg: m[4].trim(), rule: 'no-unused-vars' });
  
  const m2 = line.match(/^(.+?):(\d+):(\d+)\s+warning\s+(.+?)\s+prefer-const$/);
  if (m2) warnings.push({ file: m2[1], line: parseInt(m2[2]), col: parseInt(m2[3]), msg: m2[4].trim(), rule: 'prefer-const' });
  
  const m3 = line.match(/^(.+?):(\d+):(\d+)\s+warning\s+(.+?)\s+no-useless-escape$/);
  if (m3) warnings.push({ file: m3[1], line: parseInt(m3[2]), col: parseInt(m3[3]), msg: m3[4].trim(), rule: 'no-useless-escape' });
  
  const m4 = line.match(/^(.+?):(\d+):(\d+)\s+warning\s+(.+?)\s+no-empty$/);
  if (m4) warnings.push({ file: m4[1], line: parseInt(m4[2]), col: parseInt(m4[3]), msg: m4[4].trim(), rule: 'no-empty' });
}

// Group by file
const byFile = {};
for (const w of warnings) {
  if (!byFile[w.file]) byFile[w.file] = [];
  byFile[w.file].push(w);
}

console.log(`Total warnings to fix: ${warnings.length}`);
console.log(`Files to process: ${Object.keys(byFile).length}`);

let fixed = 0;
const errors = [];

for (const [file, fileWarnings] of Object.entries(byFile)) {
  if (!existsSync(file)) {
    errors.push(`File not found: ${file}`);
    continue;
  }
  
  let content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  let changed = false;
  
  for (const w of fileWarnings) {
    const idx = w.line - 1;
    if (idx >= lines.length) {
      errors.push(`${file}:${w.line} - line out of range`);
      continue;
    }
    const lineStr = lines[idx];
    
    try {
      if (w.rule === 'no-useless-escape') {
        // Remove unnecessary backslash before -
        const newLine = lineStr.replace(/\\-/g, '-');
        if (newLine !== lineStr) {
          lines[idx] = newLine;
          changed = true;
          fixed++;
          console.log(`  ${file}:${w.line} fixed no-useless-escape`);
        }
      }
      else if (w.rule === 'prefer-const') {
        const newLine = lineStr.replace(/^(const|let)\s+/, 'const ');
        // Only fix if it was 'let' (already const is fine)
        if (lineStr.trimStart().startsWith('let ') && !lineStr.trimStart().startsWith('let ' + w.msg.split("'")[1])) {
          // Try replacing let with const
          const trimmed = lineStr.trimStart();
          const indent = lineStr.slice(0, lineStr.length - trimmed.length);
          const afterLet = trimmed.replace(/^let\s+/, 'const ');
          if (afterLet !== trimmed) {
            lines[idx] = indent + afterLet;
            changed = true;
            fixed++;
            console.log(`  ${file}:${w.line} fixed prefer-const`);
          }
        }
      }
      else if (w.rule === 'no-empty') {
        // Add a comment inside empty blocks
        const newLine = lineStr.replace(/\{\s*\}$/, '{ /* noop */ }');
        if (newLine !== lineStr) {
          lines[idx] = newLine;
          changed = true;
          fixed++;
          console.log(`  ${file}:${w.line} fixed no-empty`);
        }
      }
      else if (w.rule === 'no-unused-vars') {
        const msg = w.msg;
        
        // Pattern 1: Unused import
        const importMatch = lineStr.match(/^(import\s*\{[^}]+\}\s*from\s)/);
        if (importMatch) {
          // Extract the variable name from the warning message
          const varName = msg.match(/'([^']+)'/)?.[1];
          if (varName) {
            // Check if we can safely remove it from the import
            // Remove the variable name from the import braces
            const importContent = lineStr.match(/import\s*\{([^}]+)\}\s*from/);
            if (importContent) {
              const vars = importContent[1].split(',').map(v => v.trim());
              const filtered = vars.filter(v => v !== varName && v !== `type ${varName}`);
              if (filtered.length < vars.length) {
                if (filtered.length === 0) {
                  // Remove the entire line
                  lines[idx] = '';
                  changed = true;
                  fixed++;
                  console.log(`  ${file}:${w.line} removed unused import '${varName}'`);
                } else {
                  const newImport = lineStr.replace(importContent[1], filtered.join(', '));
                  lines[idx] = newImport;
                  changed = true;
                  fixed++;
                  console.log(`  ${file}:${w.line} removed '${varName}' from import`);
                }
              }
            }
          }
          continue;
        }
        
        // Pattern 2: Unused import type
        const importTypeMatch = lineStr.match(/^import\s+type\s*\{[^}]+\}\s*from\s/);
        if (importTypeMatch) {
          const varName = msg.match(/'([^']+)'/)?.[1];
          if (varName) {
            const importContent = lineStr.match(/import\s+type\s*\{([^}]+)\}\s*from/);
            if (importContent) {
              const vars = importContent[1].split(',').map(v => v.trim());
              const filtered = vars.filter(v => v !== varName);
              if (filtered.length < vars.length) {
                if (filtered.length === 0) {
                  lines[idx] = '';
                  changed = true;
                  fixed++;
                  console.log(`  ${file}:${w.line} removed unused type import '${varName}'`);
                } else {
                  const newImport = lineStr.replace(importContent[1], filtered.join(', '));
                  lines[idx] = newImport;
                  changed = true;
                  fixed++;
                  console.log(`  ${file}:${w.line} removed '${varName}' from type import`);
                }
              }
            }
          }
          continue;
        }
        
        // Pattern 3: Unused destructured variable in const/let
        const destMatch = lineStr.match(/^(const|let)\s+\{\s*([^}]+)\s*\}\s*=\s*(.+)$/);
        if (destMatch) {
          const varName = msg.match(/'([^']+)'/)?.[1];
          if (varName) {
            const vars = destMatch[2].split(',').map(v => v.trim());
            const filtered = vars.filter(v => v !== varName);
            if (filtered.length < vars.length) {
              const indent = lineStr.slice(0, lineStr.length - lineStr.trimStart().length);
              if (filtered.length === 0) {
                // Remove entire line (or replace with just the RHS)
                const rhs = destMatch[3].trim();
                lines[idx] = indent + rhs + ';';
                changed = true;
                fixed++;
                console.log(`  ${file}:${w.line} removed unused destructured '${varName}'`);
              } else {
                const newLine = lineStr.replace(/\{[^}]+\}/, `{ ${filtered.join(', ')} }`);
                lines[idx] = newLine;
                changed = true;
                fixed++;
                console.log(`  ${file}:${w.line} removed '${varName}' from destructuring`);
              }
            }
          }
          continue;
        }
        
        // Pattern 4: Unused function parameter (prefix with _)
        const paramName = msg.match(/'([^']+)'/)?.[1];
        if (paramName) {
          // Check if it's a function parameter
          const paramRegex = new RegExp(`\\b${escapeRegex(paramName)}\\b`);
          if (paramRegex.test(lineStr)) {
            // Prefix with underscore
            lines[idx] = lineStr.replace(paramRegex, `_${paramName}`);
            changed = true;
            fixed++;
            console.log(`  ${file}:${w.line} renamed '${paramName}' to '_${paramName}'`);
          }
        }
      }
    } catch (e) {
      errors.push(`${file}:${w.line} - ${e.message}`);
    }
  }
  
  if (changed) {
    writeFileSync(file, lines.join('\n'), 'utf8');
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

console.log(`\nFixed: ${fixed} warnings`);
if (errors.length > 0) {
  console.log(`Errors: ${errors.length}`);
  for (const e of errors.slice(0, 20)) {
    console.log(`  ${e}`);
  }
}
console.log('\nDone!');
