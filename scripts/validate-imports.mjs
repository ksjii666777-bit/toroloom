#!/usr/bin/env node
/**
 * ==============================================================================
 * Toroloom — Import Path Validator
 * ==============================================================================
 *
 * Scans test files for `vi.mock(...)` calls and AppNavigator for screen imports,
 * then verifies every relative path resolves to an actual file on disk.
 *
 * This catches issues like:
 *   - `vi.mock('../screens/broker/BrokerConnectScreen')` when the real path
 *     is `ConnectBrokerView` — TypeScript doesn't validate vi.mock paths
 *   - Importing a screen that was deleted or renamed
 *   - Typos in import paths
 *
 * Usage:
 *   node scripts/validate-imports.mjs
 *
 * Exit code: 0 if all paths valid, 1 if any path is invalid.
 * ==============================================================================
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Collected errors
const errors = [];

// ──── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns true if the given path looks like an npm package (not a relative path).
 */
function isNpmPackage(p) {
  return !p.startsWith('./') && !p.startsWith('../') && !p.startsWith('/');
}

/**
 * Given a relative path from a test file's location, resolve it and check
 * if the file exists (trying .ts, .tsx, /index.ts, /index.tsx extensions).
 */
function validateRelativePath(relativePath, fromDir, context) {
  // Resolve the path relative to the source file
  const resolved = path.resolve(fromDir, relativePath);
  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    `${resolved}.jsx`,
    path.join(resolved, 'index.ts'),
    path.join(resolved, 'index.tsx'),
    path.join(resolved, 'index.js'),
    path.join(resolved, 'index.jsx'),
  ];

  const found = candidates.some(c => existsSync(c));
  if (!found) {
    // Show the relative path from project root for readability
    const relToProject = path.relative(projectRoot, resolved);
    errors.push(`  ✗ ${context}: path "${relativePath}" → ${relToProject} not found (tried .ts, .tsx, /index.ts, etc.)`);
  }
  return found;
}

// ──── 1. Validate vi.mock() paths in all test files ──────────────────────────

console.log('\n🔍 Validating vi.mock() paths in test files...\n');

/**
 * Recursively find all test files in a directory.
 * Uses only built-in Node.js fs — no external dependencies.
 */
function findTestFiles(dir) {
  const results = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(fullPath));
    } else if (entry.isFile() && /\.test\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

// Find all test files (frontend + backend)
const testFiles = [
  ...findTestFiles(path.join(projectRoot, 'src', '__tests__')),
  ...findTestFiles(path.join(projectRoot, 'backend', 'src', '__tests__')),
];

let mockCount = 0;
let validMockCount = 0;
let invalidMockCount = 0;

for (const testFile of testFiles) {
  const content = readFileSync(testFile, 'utf-8');
  const testDir = path.dirname(testFile);

  // Match vi.mock('...') — handle both single and double quotes
  const mockRegex = /vi\.mock\(['"]([^'"]+)['"]/g;
  let match;

  while ((match = mockRegex.exec(content)) !== null) {
    mockCount++;
    const importPath = match[1];

    // Skip npm packages
    if (isNpmPackage(importPath)) {
      validMockCount++;
      continue;
    }

    // Skip vi.hoisted mocks (they wrap mock factories, not paths)
    if (importPath.startsWith('vi.')) continue;

    const context = `${testFile}`;
    if (validateRelativePath(importPath, testDir, context)) {
      validMockCount++;
    } else {
      invalidMockCount++;
    }
  }
}

console.log(`  Checked ${mockCount} vi.mock() calls — ${validMockCount} valid, ${invalidMockCount} invalid`);

// ──── 2. Validate screen imports in AppNavigator.tsx ──────────────────────────

console.log('\n🔍 Validating screen imports in AppNavigator.tsx...\n');

const navigatorPath = path.join(projectRoot, 'src', 'navigation', 'AppNavigator.tsx');
if (existsSync(navigatorPath)) {
  const content = readFileSync(navigatorPath, 'utf-8');
  const navigatorDir = path.dirname(navigatorPath);

  // Match import ... from '...'
  const importRegex = /import\s+(?:\{[^}]*\}|[^;{]+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  let importCount = 0;
  let validImportCount = 0;
  let invalidImportCount = 0;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];

    // Skip npm packages and type-only imports (they don't affect module resolution)
    if (isNpmPackage(importPath)) {
      importCount++;
      validImportCount++;
      continue;
    }

    importCount++;
    if (validateRelativePath(importPath, navigatorDir, `AppNavigator.tsx`)) {
      validImportCount++;
    } else {
      invalidImportCount++;
    }
  }

  console.log(`  Checked ${importCount} imports — ${validImportCount} valid, ${invalidImportCount} invalid`);
} else {
  console.log('  ⚠ AppNavigator.tsx not found, skipping screen import validation');
}

// ──── Summary ────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
if (errors.length === 0) {
  console.log('✅ All import paths are valid!');
  process.exit(0);
} else {
  console.log(`❌ Found ${errors.length} invalid import path(s):\n`);
  for (const err of errors) {
    console.log(err);
  }
  console.log('\n💡 Fix: update the vi.mock() path or import statement to match the actual file path.\n');
  process.exit(1);
}
