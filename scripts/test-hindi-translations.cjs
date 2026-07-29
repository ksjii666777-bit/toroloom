const fs = require('fs');
const path = require('path');

// Check each Hindi translation file for Devanagari script content
const hiDir = 'src/i18n/locales/hi';
const files = fs.readdirSync(hiDir).filter(f => f.endsWith('.ts') && f !== 'index.ts');

let totalKeys = 0;
let totalWithHindi = 0;
let totalWithoutHindi = 0;
let issues = [];

console.log('=== HINDI TRANSLATION QUALITY CHECK ===\n');

for (const file of files) {
  const content = fs.readFileSync(path.join(hiDir, file), 'utf8');
  
  // Extract all translation values (strings between quotes after colon)
  const regex = /:\s*'([^']+)'/g;
  let match;
  let fileKeys = 0;
  let fileHindi = 0;
  
  while ((match = regex.exec(content)) !== null) {
    const value = match[1];
    fileKeys++;
    totalKeys++;
    
    // Check if it contains Devanagari characters (Hindi script)
    const hasDevanagari = /[\u0900-\u097F]/.test(value);
    
    if (hasDevanagari) {
      fileHindi++;
      totalWithHindi++;
    } else {
      totalWithoutHindi++;
      // Only report if it seems like it should be translated (not a symbol or number)
      if (/[a-zA-Z]{3,}/.test(value) && !value.includes('{{')) {
        issues.push(`${file}: '${value}' (English text, needs Hindi translation)`);
      }
    }
  }
  
  const pct = fileKeys > 0 ? Math.round((fileHindi / fileKeys) * 100) : 100;
  console.log(`${file.replace('.ts', '')}: ${fileHindi}/${fileKeys} Hindi (${pct}%)`);
}

console.log(`\n=== SUMMARY ===`);
console.log(`Total translation keys: ${totalKeys}`);
console.log(`Hindi text: ${totalWithHindi}`);
console.log(`Non-Hindi text: ${totalWithoutHindi}`);
console.log(`Coverage: ${Math.round((totalWithHindi / totalKeys) * 100)}%`);

if (issues.length > 0) {
  console.log(`\n⚠ Potential issues (${issues.length}):`);
  issues.forEach(i => console.log(`  • ${i}`));
} else {
  console.log('\n✅ No obvious issues found!');
}

// Also check a few key strings
console.log('\n=== SAMPLE TRANSLATIONS ===');

const keySamples = [
  ['home.ts', 'morning'],
  ['home.ts', 'afternoon'],
  ['home.ts', 'evening'],
  ['auth.ts', 'welcomeBack'],
  ['auth.ts', 'email'],
  ['auth.ts', 'login'],
  ['trading.ts', 'buy'],
  ['trading.ts', 'sell'],
  ['trading.ts', 'market'],
  ['risk.ts', 'ironLock'],
  ['risk.ts', 'ironLockActive'],
  ['risk.ts', 'dailyLossLimit'],
  ['riskSettings.ts', 'lockdownStatus'],
  ['ai.ts', 'recommendedStopLoss'],
  ['brokerConnect.ts', 'title'],
  ['app.ts', 'loading'],
  ['app.ts', 'error'],
  ['app.ts', 'cancel'],
];

for (const [file, key] of keySamples) {
  const content = fs.readFileSync(path.join(hiDir, file), 'utf8');
  const regex = new RegExp(`${key}:\\s*'([^']+)'`);
  const m = content.match(regex);
  if (m) {
    console.log(`  ${file.replace('.ts', '')}.${key} → '${m[1]}'`);
  } else {
    console.log(`  ${file.replace('.ts', '')}.${key} → NOT FOUND`);
  }
}

