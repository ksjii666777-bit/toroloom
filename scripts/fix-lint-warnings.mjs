import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const cwd = process.cwd();
const output = execSync(`npx eslint src/ --format json 2>&1 || true`, { encoding: 'utf8', cwd, maxBuffer: 50 * 1024 * 1024 });

// Parse the JSON output
let results;
try {
  // Find JSON in output (eslint outputs messages before JSON sometimes)
  const jsonStart = output.indexOf('[');
  if (jsonStart >= 0) {
    results = JSON.parse(output.slice(jsonStart));
  } else {
    console.log("No JSON output found from eslint");
    process.exit(1);
  }
} catch (e) {
  console.log("Failed to parse JSON:", e.message);
  // Try running with a different approach
  console.log("Trying alternate approach...");
  const output2 = execSync(`npx eslint src/ --format compact 2>&1 || true`, { encoding: 'utf8', cwd, maxBuffer: 50 * 1024 * 1024 });
  console.log("Compact output:", output2.slice(0, 2000));
  process.exit(1);
}

let totalFixed = 0;
let totalFiles = 0;

for (const file of results) {
  if (!file.messages || file.messages.length === 0) continue;
  
  const filePath = file.filePath;
  if (!existsSync(filePath)) continue;
  
  const warnings = file.messages.filter(m => m.severity === 1);
  if (warnings.length === 0) continue;
  
  let content = readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let changed = false;
  
  for (const w of warnings) {
    const lineIdx = w.line - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) continue;
    
    const rule = w.ruleId;
    const lineText = lines[lineIdx];
    
    try {
      if (rule === 'no-useless-escape') {
        // Fix unnecessary escape characters in regex/hybrid
        const newLine = lineText.replace(/\\-(?=[^\\])/g, '-');
        if (newLine !== lineText) {
          lines[lineIdx] = newLine;
          changed = true;
          totalFixed++;
        }
      }
      
      else if (rule === 'prefer-const') {
        // Change let to const
        const trimmed = lineText.trimStart();
        if (trimmed.startsWith('let ')) {
          const indent = lineText.slice(0, lineText.length - trimmed.length);
          lines[lineIdx] = indent + 'const ' + trimmed.slice(4);
          changed = true;
          totalFixed++;
        }
      }
      
      else if (rule === 'no-empty') {
        // Add comment inside empty block
        const newLine = lineText.replace(/\{\s*\}$/, '{ /* noop */ }');
        if (newLine !== lineText) {
          lines[lineIdx] = newLine;
          changed = true;
          totalFixed++;
        }
      }
      
      else if (rule === '@typescript-eslint/no-unused-vars') {
        const msg = w.message;
        const varNameMatch = msg.match(/'([^']+)'/);
        if (!varNameMatch) continue;
        const varName = varNameMatch[1];
        
        if (msg.includes('never used')) {
          // Pattern: unused import - remove from import statement
          if (lineText.includes('import ')) {
            // Try to remove the variable from the import
            const importMatch = lineText.match(/(import\s+(?:type\s+)?\{)([^}]+)(\}\s*from)/);
            if (importMatch) {
              const vars = importMatch[2].split(',').map(v => v.trim());
              const filtered = vars.filter(v => v !== varName && v !== `type ${varName}`);
              if (filtered.length < vars.length) {
                if (filtered.length === 0) {
                  lines[lineIdx] = ''; // Remove entire line
                } else {
                  lines[lineIdx] = lineText.replace(importMatch[0], importMatch[1] + ' ' + filtered.join(', ') + importMatch[3]);
                }
                changed = true;
                totalFixed++;
                continue;
              }
            }
          }
          
          // Pattern: unused destructured variable
          const destMatch = lineText.match(/^(const|let)\s*\{\s*([^}]+)\s*\}\s*=\s*/);
          if (destMatch) {
            const vars = destMatch[2].split(',').map(v => v.trim());
            const filtered = vars.filter(v => v !== varName);
            if (filtered.length < vars.length) {
              if (filtered.length === 0) {
                // Remove whole destructuring, keep the RHS
                const rhs = lineText.replace(/^(const|let)\s*\{[^}]+\}\s*=\s*/, '');
                const indent = lineText.slice(0, lineText.length - lineText.trimStart().length);
                lines[lineIdx] = indent + rhs;
              } else {
                lines[lineIdx] = lineText.replace(/\{[^}]+\}/, '{ ' + filtered.join(', ') + ' }');
              }
              changed = true;
              totalFixed++;
              continue;
            }
          }
          
          // Pattern: unused function parameter (prefix with _)
          // Check if the warning says "Allowed unused args must match /^_/u"
          if (msg.includes('_') || msg.includes('args')) {
            const paramRegex = new RegExp('\\b' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
            if (paramRegex.test(lineText) && !lineText.includes('_' + varName)) {
              lines[lineIdx] = lineText.replace(paramRegex, '_' + varName);
              changed = true;
              totalFixed++;
            }
          }
        }
        
        else if (msg.includes('assigned a value but never used')) {
          // Unused assignment - find the variable declaration and remove it
          // Pattern: const { X } = ... or const X = ...
          const assignedMatch = lineText.match(new RegExp('\\b' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*'));
          if (assignedMatch) continue; // skip complex cases
          
          // Simple: const X = ... or let X = ...
          if (lineText.includes('const ' + varName) || lineText.includes('let ' + varName)) {
            // Find if it's in a destructuring
            const inDestruct = lineText.match(/\{([^}]+)\}/);
            if (inDestruct) {
              const vars = inDestruct[1].split(',').map(v => v.trim());
              const filtered = vars.filter(v => {
                const parts = v.split(':').map(p => p.trim());
                return parts[0] !== varName;
              });
              if (filtered.length < vars.length) {
                if (filtered.length === 0) {
                  // Remove whole line
                  lines[lineIdx] = '';
                } else {
                  lines[lineIdx] = lineText.replace(inDestruct[0], '{ ' + filtered.join(', ') + ' }');
                }
                changed = true;
                totalFixed++;
                continue;
              }
            }
            
            // Simple variable declaration that's unused - just comment it out or leave it
            // These are often assignments that can't be safely removed
          }
        }
      }
    } catch (e) {
      // Skip errors
    }
  }
  
  if (changed) {
    writeFileSync(filePath, lines.join('\n'), 'utf8');
    totalFiles++;
  }
}

console.log(`Fixed ${totalFixed} warnings across ${totalFiles} files`);
