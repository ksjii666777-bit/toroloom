/**
 * ============================================================================
 * 🏷️ Toroloom Rebranding Script
 * ============================================================================
 *
 * Automated search-and-replace for all brand references in the codebase.
 * After running this script, edit src/config/brandConfig.ts (and backend
 * version) to set your new brand name, then run this script to propagate
 * changes across all source files, tests, and documentation.
 *
 * USAGE:
 *   node scripts/rebrand.mjs [--dry-run] [--new-name "YourBrand"]
 *
 * EXAMPLES:
 *   # Preview what would change (no files modified)
 *   node scripts/rebrand.mjs --dry-run --new-name "TradePro"
 *
 *   # Actually apply the rebrand
 *   node scripts/rebrand.mjs --new-name "TradePro"
 *
 * WHAT IT REPLACES:
 *   - "Toroloom" → "NewBrand" (case-sensitive)
 *   - "toroloom" → "newbrand" (lowercase: package names, URLs, keys)
 *   - "TOROLOOM" → "NEWBRAND" (uppercase: constants, env vars)
 *   - "com.toroloom" → "com.newbrand" (bundle IDs)
 *   - "Toloom" → "NewBrand" (API key prefix)
 *
 * WHAT IT DOES NOT TOUCH:
 *   - brandConfig.ts (you edit this manually)
 *   - .git directory
 *   - node_modules
 *   - Binary files (images, fonts, etc.)
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ──── Configuration ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const newNameFlag = args.find(a => a.startsWith('--new-name='));
const NEW_NAME = newNameFlag ? newNameFlag.split('=')[1] : null;

if (!NEW_NAME) {
  console.log(`
  🏷️  Toroloom Rebranding Script

  USAGE:
    node scripts/rebrand.mjs [--dry-run] --new-name="YourBrand"

  EXAMPLES:
    node scripts/rebrand.mjs --dry-run --new-name="TradePro"
    node scripts/rebrand.mjs --new-name="TradePro"

  WHAT IT DOES:
    Replaces all "Toroloom" / "toroloom" / "TOROLOOM" references
    across the entire codebase (except brandConfig.ts, .git, node_modules).

  ${DRY_RUN ? '  ⚡ RUNNING IN DRY-RUN MODE — No files will be modified\n' : ''}
  `);
  process.exit(1);
}

const NEW_SLUG = NEW_NAME.toLowerCase().replace(/[^a-z0-9]/g, '');
const NEW_UPPER = NEW_NAME.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

// Replacement rules: [pattern, replacement]
const REPLACEMENTS = [
  // Full brand name (Title Case)
  [/Toroloom/g, NEW_NAME],

  // Lowercase slug
  [/toroloom/g, NEW_SLUG],

  // Uppercase constant
  [/TOROLOOM/g, NEW_UPPER],

  // Bundle ID / package
  [/com\.toroloom/g, `com.${NEW_SLUG}`],

  // API key prefix
  [/tol_/g, `${NEW_SLUG.substring(0, 3)}_`],
];

// ──── File Discovery ───────────────────────────────────────────────────

const IGNORE_DIRS = new Set([
  '.git', 'node_modules', '.expo', 'storybook-static',
  '.maestro', 'coverage', '.nyc_output', 'dist',
]);

const IGNORE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot',
  '.mp4', '.mov', '.avi',
  '.zip', '.tar', '.gz',
  '.keystore', '.p12',
]);

const IGNORE_FILES = new Set([
  'brandConfig.ts', 'rebrand.mjs',
  'package-lock.json', 'yarn.lock',
]);

let totalFiles = 0;
let modifiedFiles = 0;
let totalReplacements = 0;

function shouldIgnore(filePath) {
  const ext = path.extname(filePath);
  if (IGNORE_EXTENSIONS.has(ext)) return true;
  const basename = path.basename(filePath);
  if (IGNORE_FILES.has(basename)) return true;

  const parts = filePath.replace(ROOT, '').split(path.sep);
  for (const part of parts) {
    if (IGNORE_DIRS.has(part)) return true;
  }
  return false;
}

function walkDir(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      const itemPath = path.join(dir, item);
      if (shouldIgnore(itemPath)) continue;

      try {
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          results = results.concat(walkDir(itemPath));
        } else if (stat.isFile()) {
          results.push(itemPath);
        }
      } catch { /* skip unreadable */ }
    }
  } catch { /* skip unreadable dirs */ }
  return results;
}

// ──── Process Files ────────────────────────────────────────────────────

console.log(`\n  🔍 Scanning for brand references...`);

const files = walkDir(ROOT);
console.log(`  📂 Found ${files.length} files to scan\n`);

for (const file of files) {
  totalFiles++;
  try {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    let fileReplacements = 0;

    for (const [pattern, replacement] of REPLACEMENTS) {
      const matches = content.match(pattern);
      if (matches) {
        content = content.replace(pattern, replacement);
        fileReplacements += matches.length;
      }
    }

    if (content !== original) {
      modifiedFiles++;
      totalReplacements += fileReplacements;
      const relPath = path.relative(ROOT, file);

      if (DRY_RUN) {
        console.log(`  [DRY-RUN] Would update: ${relPath} (${fileReplacements} replacements)`);
      } else {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`  ✅ Updated: ${relPath} (${fileReplacements} replacements)`);
      }
    }
  } catch (err) {
    console.error(`  ❌ Error processing ${path.relative(ROOT, file)}: ${err.message}`);
  }
}

// ──── Summary ──────────────────────────────────────────────────────────

console.log(`\n  ═══════════════════════════════════════`);
console.log(`  🏷️  Rebranding Summary`);
console.log(`  ═══════════════════════════════════════`);
console.log(`  Old name:    Toroloom`);
console.log(`  New name:    ${NEW_NAME}`);
console.log(`  Files scanned:  ${totalFiles}`);
console.log(`  Files modified: ${modifiedFiles}`);
console.log(`  Replacements:   ${totalReplacements}`);
console.log(`  Mode:        ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
console.log(`  ═══════════════════════════════════════\n`);

if (!DRY_RUN && modifiedFiles > 0) {
  console.log(`  📝 NEXT STEPS:`);
  console.log(`  1. Verify:  git diff --stat`);
  console.log(`  2. Test:    npm test`);
  console.log(`  3. Commit:  git add . && git commit -m "rebrand: Toroloom → ${NEW_NAME}"`);
  console.log(``);
}
