import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync(process.argv[2] || 'eslint_remaining.json', 'utf8'));

const byFile = {};
for (const x of data) {
  for (const m of x.messages || []) {
    const parts = x.filePath.split(/[/\\]/);
    const fp = parts.slice(-3).join('/');
    const k = m.ruleId || 'u';
    if (!byFile[fp]) byFile[fp] = {};
    byFile[fp][k] = (byFile[fp][k] || 0) + 1;
  }
}

const sorted = Object.entries(byFile).sort(
  (a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0)
);

for (const [f, rules] of sorted) {
  const total = Object.values(rules).reduce((s, v) => s + v, 0);
  console.log(total + '  ' + f);
  for (const [rule, count] of Object.entries(rules).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + rule + ': ' + count);
  }
}
console.log('\nTOTAL FILES: ' + sorted.length);
