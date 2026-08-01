import fs from 'fs';

const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const f of report) {
  if (!f.messages.length) continue;
  for (const x of f.messages) {
    console.log(
      `${f.filePath.replace(/\\/g, '/')} | ${x.line}:${x.column} | ${x.ruleId || 'parse'} | ${x.message.split('\n')[0]}`
    );
  }
}
