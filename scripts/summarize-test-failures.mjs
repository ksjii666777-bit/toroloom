#!/usr/bin/env node
/**
 * Summarize vitest JSON output: group failed tests by file, print
 * first failure message per file. Usage:
 *   npx vitest run --reporter=json --outputFile=results.json
 *   node scripts/summarize-test-failures.mjs results.json
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2] || 'results.json';
const j = JSON.parse(readFileSync(file, 'utf8'));

const byFile = new Map();
for (const suite of j.testResults) {
  const path = suite.name.split(/[/\\]toroloom_repo[/\\]/).pop() || suite.name;
  const failed = suite.assertionResults.filter(a => a.status === 'failed');
  if (failed.length === 0) continue;
  byFile.set(path, failed);
}

let total = 0;
for (const [path, failed] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  total += failed.length;
  console.log(`\n=== ${path} — ${failed.length} failed ===`);
  const first = failed[0];
  const msg = (first.failureMessages[0] || '').split('\n').slice(0, 6).join('\n');
  console.log(msg);
}
console.log(`\nTOTAL FAILED: ${total} across ${byFile.size} files`);
