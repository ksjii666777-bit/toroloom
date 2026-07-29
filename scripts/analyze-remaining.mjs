import { readFileSync } from 'fs';

const filePath = process.argv[2] || 'eslint_final2.json';
const data = JSON.parse(readFileSync(filePath, 'utf8'));

const byFile = {};
const rules = {};

for (const x of data) {
  for (const m of x.messages || []) {
    const ri = m.ruleId || 'u';
    rules[ri] = (rules[ri] || 0) + 1;
    
    // Get filename from path
    const sep = x.filePath.includes('/') ? '/' : '\\';
    const parts = x.filePath.split(sep);
    const fp = parts.slice(-2).join('/');
    
    if (!byFile[fp]) byFile[fp] = {};
    byFile[fp][ri] = (byFile[fp][ri] || 0) + 1;
    
    if (ri === 'react-hooks/exhaustive-deps') {
      if (!byFile[fp]._deps) byFile[fp]._deps = [];
      const deps = m.message.match(/'([^']+)'/g) || [];
      byFile[fp]._deps.push(deps.map(d => d.replace(/'/g, '')).join(', '));
    }
  }
}

console.log('=== BY RULE ===');
Object.entries(rules).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(v, k));
console.log('\nTOTAL:', Object.values(rules).reduce((s, v) => s + v, 0));

console.log('\n=== BY FILE (sorted by count) ===');
const sorted = Object.entries(byFile).sort(
  (a, b) => Object.entries(b[1]).filter(([k]) => k !== '_deps').reduce((s, [, v]) => s + v, 0) -
             Object.entries(a[1]).filter(([k]) => k !== '_deps').reduce((s, [, v]) => s + v, 0)
);

for (const [f, fileRules] of sorted) {
  const total = Object.entries(fileRules).filter(([k]) => k !== '_deps').reduce((s, [, v]) => s + v, 0);
  console.log(total, f);
  for (const [rule, count] of Object.entries(fileRules)) {
    if (rule === '_deps') continue;
    console.log('  ' + rule + ': ' + count);
  }
  if (fileRules._deps) {
    for (const dep of fileRules._deps) {
      console.log('    → missing: [' + dep + ']');
    }
  }
}
