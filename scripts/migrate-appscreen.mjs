#!/usr/bin/env node
/**
 * ============================================================================
 * Toroloom — AppScreen Migration Codemod
 * ============================================================================
 *
 * Migrates legacy screen scaffolding to the shared <AppScreen> component
 * (src/components/ui/AppScreen.tsx). The legacy pattern is:
 *
 *   <View style={styles.container}>
 *     <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={...}>
 *       ...content...
 *     </ScrollView>
 *   </View>
 *
 * The codemod is intentionally CONSERVATIVE: it only transforms screens that
 * match the canonical pattern exactly, and VERIFIES the result (no dangling
 * `styles.container` / `RefreshControl` references, balanced JSX tags) before
 * writing. Anything ambiguous is skipped and reported — handle those by hand.
 *
 * Usage:
 *   node scripts/migrate-appscreen.mjs                  # audit only (default)
 *   node scripts/migrate-appscreen.mjs --apply          # transform canonical screens
 *   node scripts/migrate-appscreen.mjs --file <path>    # restrict to one file
 *   node scripts/migrate-appscreen.mjs --apply --file <path>
 *
 * What it does for each auto-migratable screen:
 *   1. Adds `import AppScreen from '…/components/ui/AppScreen'`
 *   2. Removes `RefreshControl` from the react-native import
 *   3. Wraps the main return (and optional loading return) in <AppScreen
 *      hasTabBar? padded={false} refreshing={…} onRefresh={…} contentStyle={styles.scrollContent}>
 *   4. Removes the trailing `<View style={{ height: 100 }} />` spacer
 *   5. Drops the now-unused `container` style and re-keys `header.paddingTop: 60 → SPACING.xl`
 *
 * `hasTabBar` is inferred from the screen importing BottomTabScreenProps/TabParamList.
 *
 * EOL: the file is normalized to \n while transforming and restored to its
 * dominant EOL (\n or \r\n) on write. Mixed-EOL files are silently
 * normalized to their dominant EOL — check the diff when applying to such
 * files to avoid noisy unrelated changes.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCREENS_DIR = path.join(PROJECT_ROOT, 'src', 'screens');

// ── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const fileArg = (() => {
  const i = args.indexOf('--file');
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
})();

// ── Files ───────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const allFiles = walk(SCREENS_DIR).sort();
const targets = fileArg
  ? (() => {
      const resolved = path.resolve(PROJECT_ROOT, fileArg);
      if (!allFiles.includes(resolved)) {
        console.error(`[ERROR] --file path not found under src/screens: ${fileArg}`);
        process.exit(1);
      }
      return [resolved];
    })()
  : allFiles;

// ── Helpers ─────────────────────────────────────────────────────────────────
const count = (str, re) => (str.match(re) || []).length;

/** Insert the AppScreen import after the last `import` line. */
function addAppScreenImport(content, file) {
  if (/^import\s+AppScreen\b/m.test(content)) return { content, ok: true };
  const rel = path
    .relative(path.dirname(file), path.join(PROJECT_ROOT, 'src/components/ui/AppScreen'))
    .split(path.sep)
    .join('/')
    .replace(/\.tsx$/, '');
  const importLine = `import AppScreen from '${rel}';`;
  const lines = content.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) if (/^import\s/.test(lines[i])) lastImport = i;
  if (lastImport === -1) return { content, ok: false };
  lines.splice(lastImport + 1, 0, importLine);
  return { content: lines.join('\n'), ok: true };
}

/** Remove RefreshControl from the react-native import (standalone line, then inline). */
function removeRefreshControlImport(content) {
  let out = content;
  // standalone line: `  RefreshControl,` on its own line
  out = out.replace(/\n[ \t]*RefreshControl,\n/g, '\n');
  // inline within a one-line import: `…, RefreshControl }` (drop the comma too)
  out = out.replace(/,\s*RefreshControl\b/g, '');
  return out;
}

// ── Canonical transform regexes ─────────────────────────────────────────────
// Main return opening: <View container> → <ScrollView …refreshControl…>
const MAIN_OPEN_RE =
  /  return \(\n    <View style=\{styles\.container\}>\n      <ScrollView\n(?:        [^\n]*\n)*?        refreshControl=\{\n          <RefreshControl\n(?:            .*\n)*?          \/>\n        \}\n      >/;

// Loading-state opening — two canonical variants (single-line / multi-line)
const LOAD_OPEN_SINGLE_RE =
  /      <View style=\{styles\.container\}>\n        <ScrollView showsVerticalScrollIndicator=\{false\} contentContainerStyle=\{styles\.scrollContent\}>\n/;
const LOAD_OPEN_MULTI_RE =
  /      <View style=\{styles\.container\}>\n        <ScrollView\n          showsVerticalScrollIndicator=\{false\}\n          contentContainerStyle=\{styles\.scrollContent\}\n        >\n/;

// Closing tags — exact indentation disambiguates loading (8/6/4/2) from main (6/4/2/0)
const LOAD_CLOSE_RE = /        <\/ScrollView>\n      <\/View>\n    \);\n  \}/;
const MAIN_CLOSE_SPACER_RE =
  /        <View style=\{\{ height: 100 \}\} \/>\n      <\/ScrollView>\n    <\/View>\n  \);\n\}/;
const MAIN_CLOSE_RE = /      <\/ScrollView>\n    <\/View>\n  \);\n\}/;

// Style tweaks
const CONTAINER_STYLE_MULTI_RE = /\n  container: \{\n    flex: 1,\n    backgroundColor: colors\.bg,\n  \},\n/;
const CONTAINER_STYLE_ONE_RE = /\n  container: \{ flex: 1, backgroundColor: colors\.bg \},\n/;
const HEADER_PAD_MULTI_RE = /\n  header: \{\n    paddingTop: 60,\n/;
const HEADER_PAD_ONE_RE = /\n  header: \{ paddingTop: 60,/;

// ── Blocking markers (auto-apply is unsafe) ─────────────────────────────────
const BLOCK_MARKERS = [
  [/<KeyboardAvoidingView\b/, 'KeyboardAvoidingView wrapper'],
  [/style=\{\[styles\.container\b/, 'container used inside a style array'],
  [/style=\{styles\.scrollContent\b/, 'scrollContent used as <ScrollView style> (not contentContainerStyle)'],
];

function firstBlockMarker(content) {
  for (const [re, reason] of BLOCK_MARKERS) {
    if (re.test(content)) return reason;
  }
  return null;
}

// ── Transform a single canonical file ───────────────────────────────────────
function transform(content, file) {
  let out = content;

  // 1. AppScreen import
  const imp = addAppScreenImport(out, file);
  if (!imp.ok) return { ok: false, reason: 'could not locate import block' };
  out = imp.content;

  // 2. Drop the now-unused RefreshControl import (JSX usage dies with the wrapper)
  out = removeRefreshControlImport(out);

  // 3. hasTabBar inference (props are indented per return context)
  const hasTabBar = /BottomTabScreenProps|TabParamList/.test(out);
  const mainTab = hasTabBar ? '      hasTabBar\n' : '';
  const loadTab = hasTabBar ? '        hasTabBar\n' : '';

  // 4. Main return opening
  const mainMatch = out.match(MAIN_OPEN_RE);
  if (!mainMatch) return { ok: false, reason: 'main return does not match canonical pattern' };
  const block = mainMatch[0];
  const refreshingMatch = block.match(/refreshing=\{([^}]+)\}/);
  const onRefreshMatch = block.match(/onRefresh=\{([^}]+)\}/);
  if (!refreshingMatch || !onRefreshMatch) {
    return { ok: false, reason: 'refreshControl missing refreshing/onRefresh props' };
  }
  const refreshing = refreshingMatch[1].trim();
  const onRefresh = onRefreshMatch[1].trim();
  // Conservative: preserve the exact expression, but bail on nested braces
  // (truncated capture would produce broken code — e.g. onRefresh={() => ({...})}).
  if (/[{}\]\[]/.test(refreshing) || /[{}\]\[]/.test(onRefresh)) {
    return { ok: false, reason: `non-trivial refresh expression (${onRefresh}) — migrate by hand` };
  }
  out = out.replace(
    MAIN_OPEN_RE,
    `  return (\n    <AppScreen\n${mainTab}      padded={false}\n      refreshing={${refreshing}}\n      onRefresh={${onRefresh}}\n      contentStyle={styles.scrollContent}\n    >`
  );

  // 5. Loading state opening (either variant, if present)
  if (LOAD_OPEN_SINGLE_RE.test(out)) {
    out = out.replace(
      LOAD_OPEN_SINGLE_RE,
      `      <AppScreen\n${loadTab}        padded={false}\n        contentStyle={styles.scrollContent}\n      >\n`
    );
  } else if (LOAD_OPEN_MULTI_RE.test(out)) {
    out = out.replace(
      LOAD_OPEN_MULTI_RE,
      `      <AppScreen\n${loadTab}        padded={false}\n        contentStyle={styles.scrollContent}\n      >\n`
    );
  } else if (/<View style=\{styles\.container\}>/.test(out)) {
    return { ok: false, reason: 'loading state container found but not in canonical shape' };
  }

  // 6. Closing tags
  out = out.replace(LOAD_CLOSE_RE, '      </AppScreen>\n    );\n  }');
  if (MAIN_CLOSE_SPACER_RE.test(out)) {
    out = out.replace(MAIN_CLOSE_SPACER_RE, '    </AppScreen>\n  );\n}');
  } else if (MAIN_CLOSE_RE.test(out)) {
    out = out.replace(MAIN_CLOSE_RE, '    </AppScreen>\n  );\n}');
  } else {
    return { ok: false, reason: 'main return closing tags not in canonical shape' };
  }

  // 7. Style tweaks
  if (CONTAINER_STYLE_MULTI_RE.test(out)) out = out.replace(CONTAINER_STYLE_MULTI_RE, '\n');
  else if (CONTAINER_STYLE_ONE_RE.test(out)) out = out.replace(CONTAINER_STYLE_ONE_RE, '\n');
  if (HEADER_PAD_MULTI_RE.test(out)) {
    out = out.replace(HEADER_PAD_MULTI_RE, '\n  header: {\n    // AppScreen already pads for the status-bar/safe-area inset\n    paddingTop: SPACING.xl,\n');
  } else if (HEADER_PAD_ONE_RE.test(out)) {
    out = out.replace(HEADER_PAD_ONE_RE, '\n  header: { paddingTop: SPACING.xl,');
  }

  // ── Verification (revert on any doubt) ──────────────────────────────
  if (out.includes('styles.container')) return { ok: false, reason: 'dangling styles.container reference remains' };
  // References are gone, but a non-canonical `container:` style body may have
  // survived the removal regexes → dead code. Reject and migrate by hand.
  if (/\n\s+container:\s*\{/.test(out)) return { ok: false, reason: 'unremoved container: style definition (non-canonical body)' };
  if (out.includes('RefreshControl')) return { ok: false, reason: 'RefreshControl still referenced or imported (import shape unsupported)' };
  if (count(out, /<AppScreen\b/g) !== count(out, /<\/AppScreen>/g)) {
    return { ok: false, reason: 'unbalanced <AppScreen> tags' };
  }
  if (count(out, /<ScrollView\b/g) !== count(out, /<\/ScrollView>/g)) {
    return { ok: false, reason: 'unbalanced <ScrollView> tags' };
  }
  if (!/contentStyle=\{styles\.scrollContent\}/.test(out)) {
    return { ok: false, reason: 'contentStyle reference missing' };
  }
  return { ok: true, content: out };
}

// ── Main ────────────────────────────────────────────────────────────────────
function dominantEol(content) {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

const report = { migrated: 0, clean: 0, auto: 0, applied: 0, skipped: [] };

for (const file of targets) {
  const raw = readFileSync(file, 'utf8');
  const eol = dominantEol(raw);
  const content = raw.replace(/\r\n/g, '\n');
  const rel = path.relative(PROJECT_ROOT, file).split(path.sep).join('/');

  if (/^import\s+AppScreen\b/m.test(content)) {
    report.migrated++;
    if (APPLY) console.log(`[SKIP ] ${rel} — already migrated`);
    continue;
  }

  const isLegacy = /\bRefreshControl\b/.test(content) && /<ScrollView\b/.test(content) && /styles\.container/.test(content);
  if (!isLegacy) {
    report.clean++;
    continue;
  }

  const blocker = firstBlockMarker(content);
  if (blocker) {
    report.skipped.push([rel, blocker]);
    continue;
  }
  // The transform injects `SPACING.xl` only when it rewrites `header.paddingTop: 60`,
  // so require a real named import of SPACING from constants/theme exactly in that case.
  const rewritesHeaderPad = HEADER_PAD_MULTI_RE.test(content) || HEADER_PAD_ONE_RE.test(content);
  const spacingImported = /import\s*\{[^}]*\bSPACING\b[^}]*\}\s*from\s*['"][^'"]*constants\/theme['"]/.test(content);
  if (rewritesHeaderPad && !spacingImported) {
    report.skipped.push([rel, 'header.paddingTop rewrite needs SPACING from constants/theme (not imported)']);
    continue;
  }

  // Run the real transform in BOTH modes so the dry-run audit exactly matches
  // what --apply would do (no optimistic "auto" claims that later fail).
  const result = transform(content, file);
  if (!result.ok) {
    report.skipped.push([rel, result.reason]);
    continue;
  }

  if (!APPLY) {
    report.auto++;
    console.log(`[AUTO ] ${rel}`);
    continue;
  }

  writeFileSync(file, result.content.replace(/\n/g, eol), 'utf8');
  report.applied++;
  console.log(`[APPLY] ${rel}`);
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('\n=== SUMMARY ===');
console.log(`screens scanned : ${targets.length}`);
console.log(`already migrated: ${report.migrated}`);
console.log(`no pattern      : ${report.clean}`);
console.log(`auto-migratable : ${report.auto}`);
console.log(`applied         : ${report.applied}`);
console.log(`skipped         : ${report.skipped.length}`);
for (const [rel, reason] of report.skipped) console.log(`   - ${rel}: ${reason}`);
if (!APPLY) {
  console.log('\nDry-run only. Re-run with --apply to transform auto-migratable screens.');
}
