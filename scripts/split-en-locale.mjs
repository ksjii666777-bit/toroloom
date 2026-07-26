#!/usr/bin/env node

/**
 * Splits a locale .ts file into per-namespace files under a directory.
 * Usage: node scripts/split-en-locale.mjs [lang] [--verbose]
 *   lang:     'en' (default) or 'hi'
 *   --verbose  Print detailed per-line debug info
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Parse arguments: lang is the first non-flag arg, --verbose enables debug output
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const lang = args.find(a => !a.startsWith('--')) || 'en';

function debug(...msg) {
  if (verbose) console.log(`[DEBUG]`, ...msg);
}

const srcTs = path.join(projectRoot, 'src', 'i18n', 'locales', `${lang}.ts`);
const outDir = path.join(projectRoot, 'src', 'i18n', 'locales', lang);

const content = fs.readFileSync(srcTs, 'utf8');
const lines = content.split(/\r?\n/);

const namespaces = [];
let braceDepth = 0;
let currentNamespace = null;

function extractPropertyName(line) {
  const match = line.match(/^  ([a-zA-Z][a-zA-Z0-9_]*): {$/);
  return match ? match[1] : null;
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Count braces in the line, respecting strings
  let lineBraces = 0;
  let inString = false;
  let stringChar = null;
  
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (inString) {
      if (ch === '\\') { j++; continue; }
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inString = true; stringChar = ch; continue; }
    if (ch === '{') lineBraces++;
    if (ch === '}') lineBraces--;
  }
  
  const newDepth = braceDepth + lineBraces;
  
  // Detect `const <lang> = {` — handles both `const en = {` and `const hi = {`
  if (line.trimStart().startsWith(`const ${lang} = {`)) {
    debug(`Line ${i+1}: found const ${lang} = {`);
    braceDepth = 1;
    continue;
  }
  
  // Detect `};` closing the object — only when braceDepth is 1
  // (the `}` on this line will reduce it to 0, so we check for 1)
  if (braceDepth === 1 && line.trimStart() === '};') {
    debug(`Line ${i+1}: found closing };, object complete`);
    braceDepth = 0;
    break;
  }
  
  // Top-level property start: depth 1 -> 2, line matches "  name: {"
  if (braceDepth === 1 && newDepth === 2) {
    const name = extractPropertyName(line);
    if (name) {
      debug(`Line ${i+1}: found property "${name}"`);
      if (currentNamespace) namespaces.push(currentNamespace);
      currentNamespace = { name, contentLines: [] };
      braceDepth = newDepth;
      continue;
    }
  }
  
  // Top-level property end: depth goes from 2 to 1
  if (currentNamespace && braceDepth === 2 && newDepth === 1) {
    debug(`Line ${i+1}: closing property "${currentNamespace.name}"`);
    namespaces.push(currentNamespace);
    currentNamespace = null;
    braceDepth = newDepth;
    continue;
  }
  
  // Inside a namespace - collect content lines (between opening `{` and closing `},`)
  if (currentNamespace && braceDepth >= 2) {
    currentNamespace.contentLines.push(line);
  }
  
  braceDepth = newDepth;
}

if (currentNamespace) namespaces.push(currentNamespace);

// Always print summary
console.log(`\n${lang}: ${namespaces.length} namespaces found`);
if (verbose) {
  namespaces.forEach(ns => console.log(`  ${ns.name} (${ns.contentLines.length} lines)`));
}

// Create output directory
fs.mkdirSync(outDir, { recursive: true });

const importLines = [];
const exportLines = [];

for (const ns of namespaces) {
  const fileName = `${ns.name}.ts`;
  const filePath = path.join(outDir, fileName);
  
  let contentLines = ns.contentLines;
  while (contentLines.length > 0 && contentLines[contentLines.length - 1].trim() === '') {
    contentLines = contentLines.slice(0, -1);
  }
  
  const fileContent = `// Auto-generated from ${lang}.ts — ${ns.name} namespace\nexport default {\n${contentLines.join('\n')}\n};\n`;
  fs.writeFileSync(filePath, fileContent, 'utf8');
  
  importLines.push(`import ${ns.name} from './${ns.name}';`);
  exportLines.push(`  ${ns.name},`);
}

// Create index.ts
const indexContent = `// Auto-generated — merges all namespace files into a single export
${importLines.join('\n')}

const ${lang} = {
${exportLines.join('\n')}
};

export default ${lang};
`;

fs.writeFileSync(path.join(outDir, 'index.ts'), indexContent, 'utf8');

console.log(`\n✅ Created ${namespaces.length} namespace files in ${outDir}`);
console.log(`✅ Created index.ts`);
