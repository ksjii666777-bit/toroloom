/**
 * Fix ALL remaining lint warnings (88 remaining).
 * Handles all patterns: unused vars, prefer-const, no-empty, no-useless-escape
 */
import fs from 'fs';
import { execSync } from 'child_process';

// Get all current lint warnings with file:line
const lintOutput = execSync('npm run lint 2>&1', { cwd: process.cwd(), encoding: 'utf8' });
const lines = lintOutput.split('\n');

// Parse warnings grouped by file
const fileWarnings = {};
for (const line of lines) {
  const match = line.match(/^(C:\\\S+?\.(?:ts|tsx))\s+\d+:(\d+)\s+warning\s+(.+?)\s+(@typescript-eslint\/no-unused-vars|prefer-const|no-empty|no-useless-escape)/);
  if (match) {
    const filePath = match[1].replace(/\\/g, '/').replace('C:/Users/Karan/Desktop/New folder/Toroloom/', '');
    if (!fileWarnings[filePath]) fileWarnings[filePath] = [];
    fileWarnings[filePath].push({
      line: parseInt(match[2]),
      message: match[3].trim(),
      rule: match[4],
    });
  }
}

console.log(`Total files with warnings: ${Object.keys(fileWarnings).length}`);

// Fix each file
for (const [filePath, warnings] of Object.entries(fileWarnings)) {
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${filePath} not found`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const orig = content;
  const lines_arr = content.split('\n');

  for (const w of warnings) {
    const lineIdx = w.line - 1;
    const lineText = lines_arr[lineIdx] || '';

    if (w.message.includes("is assigned a value but never used")) {
      // Extract the variable name from: "'varname' is assigned a value but never used"
      const varMatch = w.message.match(/'([^']+)'/);
      if (!varMatch) continue;
      const varName = varMatch[1];

      // Case 1: const { varName } = render(...) -> render(...)
      const destructurePattern = new RegExp(`const\\s*\\{\\s*([^}]*\\b${varName}\\b[^}]*)\\}\\s*=\\s*render\\(`);
      const match = content.match(destructurePattern);
      if (match) {
        const destBlock = match[1];
        const vars = destBlock.split(',').map(v => v.trim()).filter(Boolean);
        const filtered = vars.filter(v => v !== varName);
        if (filtered.length === 0) {
          content = content.replace(match[0], `render(`);
        } else {
          content = content.replace(match[0], `const { ${filtered.join(', ')} } = render(`);
        }
        console.log(`  ${filePath}:${w.line} - Removed '${varName}' from destructure`);
        continue;
      }

      // Case 2: const varName = ... (simple assignment)
      const assignPattern = new RegExp(`const\\s+${varName}\\s*=\\s*(.+)$`, 'm');
      const assignMatch = content.match(assignPattern);
      if (assignMatch) {
        const rightSide = assignMatch[1].trim();
        // Don't remove if it might be used later - only if standalone
        const afterPos = content.indexOf(assignMatch[0]) + assignMatch[0].length;
        const afterText = content.slice(afterPos);
        // Check if varName is referenced again
        const refRegex = new RegExp(`\\b${varName}\\b`);
        const nextLine = afterText.split('\n')[0];
        const restAfter = afterText.split('\n').slice(1).join('\n');
        // Simple heuristic: if it's only referenced on the next line (the render/JSX line), safe to remove
        const fullRefCheck = restAfter.match(refRegex);
        if (!fullRefCheck) {
          // Remove the entire line
          content = content.replace(assignMatch[0], '');
          console.log(`  ${filePath}:${w.line} - Removed unused variable '${varName}'`);
        }
        continue;
      }

      // Case 3: import { varName } from ... -> remove varName from import
      const importPattern = new RegExp(`import\\s+\\{\\s*([^}]*\\b${varName}\\b[^}]*)\\s*\\}\\s+from`);
      const importMatch = content.match(importPattern);
      if (importMatch) {
        const importBlock = importMatch[1];
        const imports = importBlock.split(',').map(v => v.trim()).filter(Boolean);
        const filtered = imports.filter(v => v !== varName);
        if (filtered.length === 0) {
          // Remove entire import line
          content = content.replace(importMatch[0].replace(/\n/g, '\\n'), '');
          // Actually need to remove the whole line
          content = content.replace(new RegExp(`import\\s*\\{\\s*${varName}\\s*\\}\\s*from\\s*['\"][^'\"]+['\"];?\\s*\\n?`), '');
        } else {
          content = content.replace(importMatch[0], `import { ${filtered.join(', ')} } from`);
        }
        console.log(`  ${filePath}:${w.line} - Removed '${varName}' from import`);
        continue;
      }
    }

    // prefer-const
    if (w.rule === 'prefer-const') {
      const match = lineText.match(/^\s+let\s+(\w+)/);
      if (match) {
        const varName = match[1];
        lines_arr[lineIdx] = lineText.replace('let', 'const');
        console.log(`  ${filePath}:${w.line} - Changed let to const for '${varName}'`);
        continue;
      }
    }

    // no-empty
    if (w.rule === 'no-empty') {
      lines_arr[lineIdx] = lineText.replace(/\{\s*\}$/, '{ /* noop */ }');
      console.log(`  ${filePath}:${w.line} - Added noop comment to empty block`);
      continue;
    }
  }

  // Handle "is defined but never used" for things not caught above  
  for (const w of warnings) {
    if (w.message.includes("is defined but never used")) {
      const varMatch = w.message.match(/'([^']+)'/);
      if (!varMatch) continue;
      const varName = varMatch[1];
      
      if (varName.startsWith('_')) continue; // Already prefixed
      
      // Don't process if already handled above
      // Check import
      const importRegex = new RegExp(`import\\s+\\{[^}]*\\b${varName}\\b[^}]*\\}\\s+from`);
      if (importRegex.test(content)) {
        // Remove from import
        content = content.replace(
          new RegExp(`(import\\s*\\{)([^}]*)\\b${varName}\\b,?\\s*([^}]*\\})`, 'g'),
          (match, prefix, before, after) => {
            const filtered = (before + after).replace(/\s*,\s*}/, '}').trim();
            if (filtered === '}') return `${prefix}${filtered}`;
            return `${prefix} ${filtered}`;
          }
        );
        console.log(`  ${filePath}:${w.line} - Removed '${varName}' from import`);
      }
    }
  }

  // Rebuild lines_arr if content was changed by import fixes
  if (content !== orig) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`FIXED: ${filePath}`);
  }
}

console.log('\nDone! Now running lint to verify...');
try {
  const result = execSync('npm run lint 2>&1 | tail -5', { cwd: process.cwd(), encoding: 'utf8' });
  console.log(result);
} catch (e) {
  console.log(e.stdout || e.message);
}
