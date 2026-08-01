// Precise removal of unused `const { t } = useT();` lines (and one import)
// across the 4 files that got corrupted by a fuzzy multi-line str_replace.
// Preserves CRLF line endings.
const fs = require('fs');

function edit(desc, file, regex, replacement) {
  const p = file;
  const s = fs.readFileSync(p, 'utf8');
  const out = s.replace(regex, replacement);
  if (out === s) {
    console.log('NO MATCH: ' + desc);
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(p, out);
  console.log('OK: ' + desc);
}

// 1. RevenueDashboardScreen — remove the `const { t } = useT();` inside PayoutRow only
edit(
  'RevenueDashboard PayoutRow t-line',
  'src/screens/social/RevenueDashboardScreen.tsx',
  /(function PayoutRow\(\{ payout, colors, styles \}: \{ payout: PayoutRequest; colors: any; styles: any \}\) \{\r?\n)[^\r\n]*const \{ t \} = useT\(\);\r?\n/,
  '$1'
);

// 2. CryptoTradingScreen — remove the `const { t } = useT();` in MAIN SCREEN only
//    (CoinCard at ~line 122 still uses t, so the import stays)
edit(
  'CryptoTrading main-screen t-line',
  'src/screens/trade/CryptoTradingScreen.tsx',
  /(export default function CryptoTradingScreen\(\{ navigation \}: any\) \{\r?\n[^\r\n]*const \{ colors \} = useTheme\(\);\r?\n)[^\r\n]*const \{ t \} = useT\(\);\r?\n/,
  '$1'
);

// 3. USStocksTradingScreen — remove unused import AND the main-screen t-line
edit(
  'USStocks useT import',
  'src/screens/trade/USStocksTradingScreen.tsx',
  /import \{ useT \} from '\.\.\/\.\.\/hooks\/useT';\r?\n/,
  ''
);
edit(
  'USStocks main-screen t-line',
  'src/screens/trade/USStocksTradingScreen.tsx',
  /(export default function USStocksTradingScreen\(\{ navigation \}: any\) \{\r?\n[^\r\n]*const \{ colors \} = useTheme\(\);\r?\n)[^\r\n]*const \{ t \} = useT\(\);\r?\n/,
  '$1'
);

// 4. AlgoTradingScreen — remove unused import AND the main-screen t-line
edit(
  'Algo useT import',
  'src/screens/trading/AlgoTradingScreen.tsx',
  /import \{ useT \} from '\.\.\/\.\.\/hooks\/useT';\r?\n/,
  ''
);
edit(
  'Algo main-screen t-line',
  'src/screens/trading/AlgoTradingScreen.tsx',
  /(export default function AlgoTradingScreen\(\) \{\r?\n[^\r\n]*const \{ colors \} = useTheme\(\);\r?\n)[^\r\n]*const \{ t \} = useT\(\);\r?\n/,
  '$1'
);

console.log('Done.');
