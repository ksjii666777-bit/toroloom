#!/usr/bin/env node
/**
 * ============================================================================
 * Toroloom — AppScreen Migration Codemod
 * ============================================================================
 *
 * Migrates legacy screen scaffolding to the shared <AppScreen> component
 * (src/components/ui/AppScreen.tsx). The legacy pattern is:
 *
 *   <View style={styles.container}>                    (or [styles.container, …])
 *     [pinned header block(s)]
 *     <ScrollView contentContainerStyle={styles.X} refreshControl={…}>
 *       …content…
 *       <View style={{ height: N }} />                 (trailing spacer)
 *     </ScrollView>
 *   </View>
 *
 * The codemod is intentionally CONSERVATIVE: it only transforms screens that
 * match a recognized pattern exactly, and VERIFIES the result (no dangling
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
 *   2. Drops `RefreshControl`/`ScrollView`/`useSafeAreaInsets` imports that are
 *      no longer referenced after the transform
 *   3. Transforms every legacy `return (…)` block in the file:
 *      - main scroll return  → <AppScreen padded={false} refreshing onRefresh
 *        contentStyle header={…}>, header/pinned elements moved to the header
 *        prop (fragment-wrapped when there are several), trailing spacer removed
 *      - loading/empty/error  → <AppScreen scroll={false} padded={false}>
 *      - KeyboardAvoidingView → wrapper keeps `style={{ flex: 1 }}`, AppScreen
 *        scroll={false} + header prop inside
 *   4. Drops the now-unused `container` style, re-keys header padding
 *      (`paddingTop: 60` / insets-based inline padding → `SPACING.xl`), and
 *      removes dead `const insets = useSafeAreaInsets();` + import
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
// Optional directory override (defaults to src/screens). Useful for testing
// the codemod against pre-migration snapshots or other screen trees.
const dirArg = (() => {
  const i = args.indexOf('--dir');
  return i !== -1 && args[i + 1] ? path.resolve(PROJECT_ROOT, args[i + 1]) : SCREENS_DIR;
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

const allFiles = walk(dirArg).sort();
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

/**
 * Remove an import specifier (RefreshControl / ScrollView / useSafeAreaInsets)
 * from the react-native / safe-area imports — but ONLY when the identifier is
 * no longer referenced anywhere in the file.
 */
function removeUnusedImport(content, name) {
  if (new RegExp(`\\b${name}\\b`).test(content.replace(/import\s*\{[^}]*\}/g, ''))) {
    return content; // still referenced in JSX — keep the import
  }
  let out = content;
  // standalone line inside a multi-line import: `  Name,`
  out = out.replace(new RegExp(`\\n[ \\t]*${name},\\n`, 'g'), '\n');
  // inline within a one-line import: `…, Name }` (drop the comma too)
  out = out.replace(new RegExp(`,\\s*${name}\\b`, 'g'), '');
  // bare single-name import line: `import { Name } from …`
  out = out.replace(new RegExp(`import\\s*\\{\\s*${name}\\s*\\}\\s*from`, 'g'), 'import {  } from');
  return out;
}

/** Remove `const insets = useSafeAreaInsets();` when `insets` is unused. */
function removeUnusedInsetsHook(content) {
  if (/\binsets\b/.test(content.replace(/\bconst\s+insets\s*=\s*useSafeAreaInsets\(\);/g, ''))) {
    return content;
  }
  return content.replace(/\n[ \t]*const\s+insets\s*=\s*useSafeAreaInsets\(\);?\n/g, '\n');
}

// ── JSX block scanners (operate on the \n-normalized content string) ────────

/**
 * A `'` between two word characters (e.g. the apostrophe in `doesn't`) is
 * JSX text, not a string delimiter. Treat it as text so scanners don't get
 * derailed by contractions inside JSX bodies.
 */
function isContractionApostrophe(content, j) {
  return (
    content[j] === "'" &&
    /\w/.test(content[j - 1] || '') &&
    /\w/.test(content[j + 1] || '')
  );
}

/** Given content[i] === '{', return the index just after the matching '}'. */
function skipBrace(content, i) {
  let depth = 0;
  let inStr = null;
  for (let j = i; j < content.length; j++) {
    const c = content[j];
    if (inStr) {
      if (c === inStr && content[j - 1] !== '\\') inStr = null;
      continue;
    }
    if (c === '"' || c === '`' || (c === "'" && !isContractionApostrophe(content, j))) {
      inStr = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return j + 1;
    }
  }
  return content.length;
}

/**
 * Given content[i] === '<' of a JSX open/self-closing tag, return the index
 * just after that tag's '>' (strings and {…} attribute expressions handled).
 */
function findTagEnd(content, i) {
  let inStr = null;
  let brace = 0;
  for (let j = i + 1; j < content.length; j++) {
    const c = content[j];
    if (inStr) {
      if (c === inStr && content[j - 1] !== '\\') inStr = null;
      continue;
    }
    if (c === '"' || c === '`' || (c === "'" && !isContractionApostrophe(content, j))) {
      inStr = c;
      continue;
    }
    if (c === '{') brace++;
    else if (c === '}') brace--;
    else if (c === '>' && brace === 0) return j + 1;
  }
  return content.length;
}

/**
 * Given content[i] === '<' of an open JSX tag (`tagName`), return the index of
 * the matching `</tagName>` (the '<'). Handles nesting, self-closing tags, and
 * treats {…} expressions as opaque (their internal JSX is balanced).
 */
function findMatchingClose(content, openIdx, tagName) {
  let depth = 0;
  let i = openIdx;
  while (i < content.length) {
    const c = content[i];
    if (c === '{') {
      i = skipBrace(content, i);
      continue;
    }
    if (c !== '<') {
      i++;
      continue;
    }
    const rest = content.slice(i);
    const closeMatch = rest.match(/^<\/\s*([A-Za-z][\w.]*)\s*>/);
    if (closeMatch) {
      if (closeMatch[1] === tagName) {
        depth--;
        if (depth === 0) return i;
      }
      i += closeMatch[0].length;
      continue;
    }
    const openMatch = rest.match(/^<([A-Za-z][\w.]*)/);
    if (openMatch) {
      if (openMatch[1] === tagName) {
        const end = findTagEnd(content, i);
        const tagText = content.slice(i, end);
        if (!/\/\s*>$/.test(tagText)) depth++;
        i = end;
        continue;
      }
      i = findTagEnd(content, i);
      continue;
    }
    i++;
  }
  return -1;
}

/** Re-indent every non-empty line of `text` by prepending `delta` spaces. */
function reindent(text, delta) {
  return text
    .split('\n')
    .map(l => (l.trim() ? ' '.repeat(delta) + l : l))
    .join('\n');
}

/**
 * Classify a `return (…)` block root.
 *  - 'kav'    : <KeyboardAvoidingView style={styles.container}
 *  - 'scroll' : <View style={…container…}> containing a direct-child
 *               <ScrollView … refreshControl={…}>
 *  - 'static' : <View style={…container…}> with no refreshControl ScrollView
 */
function classifyReturn(rootTag) {
  if (rootTag.startsWith('<KeyboardAvoidingView')) return 'kav';
  return null; // caller distinguishes scroll vs static by content
}

// ── Block transforms ────────────────────────────────────────────────────────

/**
 * Extract the `refreshing={…}` / `onRefresh={…}` / `contentContainerStyle={styles.X}`
 * values from a <ScrollView …> open tag. Returns null when the shape is off.
 */
function extractScrollProps(scrollTag) {
  const refreshing = scrollTag.match(/refreshing=\{([^{}]+)\}/);
  const onRefresh = scrollTag.match(/onRefresh=\{([^{}]+)\}/);
  const contentStyle = scrollTag.match(/contentContainerStyle=\{styles\.([A-Za-z0-9_]+)\}/);
  if (!refreshing || !onRefresh) return null;
  const r = refreshing[1].trim();
  const o = onRefresh[1].trim();
  if (/[{}[\]]/.test(r) || /[{}[\]]/.test(o)) return null;
  return {
    refreshing: r,
    onRefresh: o,
    contentStyle: contentStyle ? contentStyle[1] : null,
  };
}

/**
 * Transform a main scroll return:
 *   <View style={[styles.container, …]}>
 *     [pinned header element(s)]
 *     <ScrollView … refreshControl={<RefreshControl refreshing onRefresh/>}>
 *       …body…
 *       <View style={{ height: N }} />
 *     </ScrollView>
 *   </View>
 * → <AppScreen padded={false} refreshing onRefresh contentStyle header={…}>
 */
function transformMainReturn(content, openIdx, hasTabBar) {
  const openTagEnd = findTagEnd(content, openIdx);
  if (content[openTagEnd] !== '\n') return null;
  const closeIdx = findMatchingClose(content, openIdx, 'View');
  if (closeIdx === -1) return null;
  const closeEnd = closeIdx + '</View>'.length;

  // Find the <ScrollView> that carries refreshControl inside the container
  // (skip horizontal filter ScrollViews). Only consider ScrollViews fully
  // inside the container (svIdx < closeIdx).
  let scrollOpenIdx = -1;
  let cursor = openTagEnd;
  while (cursor < closeIdx) {
    const m = content.slice(cursor).match(/<ScrollView\b/);
    if (!m) break;
    const svIdx = cursor + m.index;
    if (svIdx >= closeIdx) break; // past the container — no matching ScrollView inside
    const tagEnd = findTagEnd(content, svIdx);
    const tag = content.slice(svIdx, tagEnd);
    if (/refreshControl=/.test(tag)) {
      scrollOpenIdx = svIdx;
      break;
    }
    cursor = tagEnd;
  }
  if (scrollOpenIdx === -1) return null;

  // Is the refreshControl ScrollView a DIRECT child of the container? If it
  // sits inside an expression (ternary / conditional), the screen uses nested
  // vertical ScrollViews (e.g. NFODashboard) → scroll={false} instead, with
  // the RefreshControls staying on the inner ScrollViews.
  const regionToScroll = content.slice(openTagEnd, scrollOpenIdx);
  const braceDepthInRegion = (() => {
    let depth = 0;
    let inStr = null;
    for (let j = 0; j < regionToScroll.length; j++) {
      const c = regionToScroll[j];
      if (inStr) {
        if (c === inStr && regionToScroll[j - 1] !== '\\') inStr = null;
        continue;
      }
      if (c === '"' || c === '`' || (c === "'" && !isContractionApostrophe(regionToScroll, j))) {
        inStr = c;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') depth--;
    }
    return depth;
  })();
  if (braceDepthInRegion > 0) {
    return transformNestedScrollReturn(content, openIdx, hasTabBar);
  }

  const scrollTagEnd = findTagEnd(content, scrollOpenIdx);
  const scrollTag = content.slice(scrollOpenIdx, scrollTagEnd);
  const props = extractScrollProps(scrollTag);
  if (!props) return null;

  const scrollCloseIdx = findMatchingClose(content, scrollOpenIdx, 'ScrollView');
  if (scrollCloseIdx === -1) return null;

  const headerRegion = content.slice(openTagEnd, scrollOpenIdx);
  const body = content.slice(scrollTagEnd, scrollCloseIdx);

  // Trailing spacer removal: last <View style={{ height: N }} /> before </ScrollView>
  const spacerRe = /[ \t]*<View style=\{\{ height: \d+ \}\} \/>[ \t]*\n?$/;
  const bodyTrimmed = body.replace(spacerRe, '\n');

  // Header region → header prop. Count top-level pinned elements (lines at the
  // container-child indent that start an element or expression, ignoring
  // comment markers). >1 → fragment.
  let headerText = headerRegion.trim();
  // Drop the leading {/* Header */}-style comment marker (matches committed migration)
  headerText = headerText.replace(/^\/\*[^*]*\*\/\s*/, '');
  headerText = headerText.replace(/\{\/\*[^*]*\*\/\s*\}/, '').trim();
  const topLevelCount = (headerRegion.match(/^ {6,8}(<[A-Za-z]|\{)/gm) || []).length;
  const hasHeader = headerText.length > 0;
  const headerProp = hasHeader
    ? (topLevelCount > 1
        ? `      header={\n        <>\n${reindent(headerText, 4)}\n        </>\n      }\n`
        : `      header={\n${reindent(headerText, 2)}\n      }\n`)
    : '';

  const contentStyleLine = props.contentStyle
    ? `      contentStyle={styles.${props.contentStyle}}\n`
    : '';

  // The rebuilt block carries its own `return ( … );` wrapper, so strip the
  // original `return (` prefix and `);` suffix that surround the container.
  const prefix = content.slice(0, openIdx).replace(/\n[ \t]*return\s*\(\s*\n[ \t]*$/, '\n');
  const suffix = content.slice(closeEnd).replace(/^\n[ \t]*\);/ , '\n');

  const rebuilt = `  return (
    <AppScreen
${hasTabBar ? '      hasTabBar\n' : ''}      padded={false}
      refreshing={${props.refreshing}}
      onRefresh={${props.onRefresh}}
${contentStyleLine}${headerProp}    >
${bodyTrimmed}    </AppScreen>
  );`;

  return prefix + rebuilt + suffix;
}

/**
 * Transform a screen whose refreshControl ScrollView is nested inside a
 * conditional / ternary (NFODashboard pattern):
 *   <View style={[styles.container, …]}>
 *     <View style={styles.header}>…</View>
 *     {cond ? <ScrollView refreshControl={…}>…</ScrollView> : …}
 *   </View>
 * → <AppScreen scroll={false} header={…}> with the inner ScrollViews (and
 *   their RefreshControls) kept in the body.
 */
function transformNestedScrollReturn(content, openIdx, hasTabBar) {
  const openTagEnd = findTagEnd(content, openIdx);
  if (content[openTagEnd] !== '\n') return null;
  const closeIdx = findMatchingClose(content, openIdx, 'View');
  if (closeIdx === -1) return null;
  const closeEnd = closeIdx + '</View>'.length;

  const inner = content.slice(openTagEnd, closeIdx);
  // Leading header element (first direct child View with styles.header)
  const hOpen = inner.indexOf('<View style=');
  if (hOpen === -1) return null;
  const absHOpen = openTagEnd + hOpen;
  const hClose = findMatchingClose(content, absHOpen, 'View');
  if (hClose === -1) return null;
  // hClose is an ABSOLUTE index into `content`; convert to an offset into `inner`.
  const hCloseRel = hClose - openTagEnd;
  let headerText = inner.slice(0, hCloseRel + '</View>'.length).trim();
  headerText = headerText.replace(/\{\/\*[^*]*\*\/\s*\}/, '').trim();
  const body = inner.slice(hCloseRel + '</View>'.length);

  const headerProp = `      header={\n${reindent(headerText, 2)}\n      }\n`;

  const prefix = content.slice(0, openIdx).replace(/\n[ \t]*return\s*\(\s*\n[ \t]*$/, '\n');
  const suffix = content.slice(closeEnd).replace(/^\n[ \t]*\);/ , '\n');

  const rebuilt = `  return (\n    <AppScreen\n${hasTabBar ? '      hasTabBar\n' : ''}      scroll={false}\n      padded={false}\n${headerProp}    >\n${reindent(body, 2)}\n    </AppScreen>\n  );`;

  return prefix + rebuilt + suffix;
}

/**
 * Transform a static (loading / empty / error) return:
 *   <View style={[styles.container, { justifyContent: 'center', … }]}>
 *     …content…
 *   </View>
 * → <AppScreen scroll={false} padded={false}> (centered body wrapped in a
 *   flex:1 View; a leading header element moves to the header prop).
 */
function transformStaticReturn(content, openIdx, hasTabBar) {
  const openTagEnd = findTagEnd(content, openIdx);
  const openTag = content.slice(openIdx, openTagEnd);
  const closeIdx = findMatchingClose(content, openIdx, 'View');
  if (closeIdx === -1) return null;
  const closeEnd = closeIdx + '</View>'.length;

  const inner = content.slice(openTagEnd, closeIdx);
  // Leading header element?
  const headerMatch = inner.match(/^\s*<View style=\{\[?styles\.header/);
  let headerText = '';
  let body = inner;
  if (headerMatch) {
    const hOpen = inner.indexOf('<View style=');
    const hEnd = findTagEnd(content, openTagEnd + hOpen);
    const hClose = findMatchingClose(content, openTagEnd + hOpen, 'View');
    if (hClose !== -1) {
      // hClose is absolute into `content`; convert to an offset into `inner`.
      const hCloseRel = hClose - openTagEnd;
      headerText = inner.slice(0, hCloseRel + '</View>'.length).trim();
      headerText = headerText.replace(/\{\/\*[^*]*\*\/\s*\}/, '').trim();
      body = inner.slice(hCloseRel + '</View>'.length);
    }
  }

  const headerProp = headerText
    ? `      header={\n${reindent(headerText, 2)}\n      }\n`
    : '';

  const isCentered = /justifyContent: 'center'|justifyContent: "center"|styles\.center/.test(openTag);
  let bodyOut = body.trim();
  if (!bodyOut && headerProp) bodyOut = '<View />';
  let innerOut;
  if (isCentered) {
    const wrapStyle = /styles\.center/.test(openTag)
      ? '[styles.center, { flex: 1 }]'
      : "{ flex: 1, justifyContent: 'center', alignItems: 'center' }";
    innerOut = bodyOut ? `        <View style={${wrapStyle}}>\n${reindent(bodyOut, 2)}\n        </View>\n` : '';
  } else {
    innerOut = bodyOut ? `${reindent(bodyOut, 2)}\n` : '';
  }

  const rebuilt = `      <AppScreen scroll={false} padded={false}\n${headerProp}      >\n${innerOut}      </AppScreen>`;

  return content.slice(0, openIdx) + rebuilt + content.slice(closeEnd);
}

/**
 * Transform a KeyboardAvoidingView main return (PostDetail pattern):
 *   <KeyboardAvoidingView style={styles.container} …>
 *     <View style={[styles.header, …]}>…</View>
 *     <ScrollView …>…</ScrollView>
 *     [pinned footer]
 *   </KeyboardAvoidingView>
 * → KAV keeps `style={{ flex: 1 }}`, AppScreen scroll={false} + header prop
 *   wraps everything inside.
 */
function transformKavReturn(content, openIdx, hasTabBar) {
  const openTagEnd = findTagEnd(content, openIdx);
  const openTag = content.slice(openIdx, openTagEnd);
  if (!/style=\{styles\.container\}/.test(openTag)) return null;
  const closeIdx = findMatchingClose(content, openIdx, 'KeyboardAvoidingView');
  if (closeIdx === -1) return null;
  const closeEnd = closeIdx + '</KeyboardAvoidingView>'.length;

  const inner = content.slice(openTagEnd, closeIdx);
  // Two KAV shapes exist:
  //  A) header View + ScrollView as SIBLINGS (PostDetail) → header prop
  //  B) a single ScrollView that CONTAINS the header (form screens like
  //     CreateCourse) → wrap-only, keep the ScrollView + header in the body.
  // Detect by looking at the first non-whitespace child of the KAV.
  const firstChild = inner.match(/^\s*(?:\{\/\*[^*]*\*\/\s*)?<([A-Za-z][\w.]*)/);
  if (firstChild && firstChild[1] === 'ScrollView') {
    const openTagNew = openTag.replace(/style=\{styles\.container\}/, "style={{ flex: 1 }}");
    const rebuiltInner =
      `      <AppScreen scroll={false} padded={false}>\n${reindent(inner, 2)}\n      </AppScreen>`;
    return (
      content.slice(0, openIdx) +
      openTagNew +
      '\n' +
      rebuiltInner +
      content.slice(closeIdx)
    );
  }

  // Shape A: leading header View (the first direct child)
  const hOpen = inner.indexOf('<View style=');
  if (hOpen === -1) return null;
  const absHOpen = openTagEnd + hOpen;
  const hClose = findMatchingClose(content, absHOpen, 'View');
  if (hClose === -1) return null;
  // hClose is absolute into `content`; convert to an offset into `inner`.
  const hCloseRel = hClose - openTagEnd;
  let headerText = inner.slice(0, hCloseRel + '</View>'.length).trim();
  headerText = headerText.replace(/\{\/\*[^*]*\*\/\s*\}/, '').trim();
  const body = inner.slice(hCloseRel + '</View>'.length);

  const openTagNew = openTag.replace(/style=\{styles\.container\}/, "style={{ flex: 1 }}");
  const rebuiltInner =
    `      <AppScreen scroll={false} padded={false} header={\n${reindent(headerText, 2)}\n      }>\n${reindent(body, 2)}\n      </AppScreen>`;

  return (
    content.slice(0, openIdx) +
    openTagNew +
    content.slice(openTagEnd, openTagEnd) + // nothing between open tag and inner
    '\n' +
    rebuiltInner +
    content.slice(closeIdx)
  );
}

// ── Style cleanup ───────────────────────────────────────────────────────────

/** Remove the legacy `container` style definition (all observed shapes). */
function removeContainerStyle(content) {
  let out = content;
  // multi-line with backgroundColor
  out = out.replace(/\n[ \t]*container: \{\n[ \t]*flex: 1,\n[ \t]*backgroundColor: colors\.bg,\n[ \t]*\},\n/g, '\n');
  // multi-line without backgroundColor
  out = out.replace(/\n[ \t]*container: \{\n[ \t]*flex: 1,\n[ \t]*\},\n/g, '\n');
  // one-line
  out = out.replace(/\n[ \t]*container: \{ flex: 1(?:, backgroundColor: colors\.bg)? \},\n/g, '\n');
  return out;
}

/**
 * Normalize header top padding. `paddingTop: 60` in the style → SPACING.xl +
 * comment. Inline `paddingTop: N + insets.top` / `insets.top + M` in header
 * JSX → removed, and the header style gains `paddingTop: SPACING.xl`.
 */
function fixHeaderPadding(content) {
  let out = content;

  // 1. style-based: `paddingTop: 60` → SPACING.xl + comment (multi-line)
  out = out.replace(
    /\n([ \t]*)header: \{\n([ \t]*)paddingTop: 60,\n/g,
    '\n$1header: {\n$2// AppScreen already pads for the status-bar/safe-area inset\n$2paddingTop: SPACING.xl,\n'
  );
  // one-line `header: { paddingTop: 60, … }`
  out = out.replace(
    /\n([ \t]*)header: \{\n?([ \t]*)paddingTop: 60,\n/g,
    '\n$1header: {\n$2// AppScreen already pads for the status-bar/safe-area inset\n$2paddingTop: SPACING.xl,\n'
  );

  // 2. inline insets-based header padding: `[styles.header, { paddingTop: … }]`
  //    → remove the paddingTop entry (keep other props)
  const inlinePadRe =
    /(\[styles\.header)(, \{\s*paddingTop:\s*(?:\d+\s*\+\s*insets\.top|insets\.top\s*\+\s*\d+)\s*\})/g;
  out = out.replace(inlinePadRe, '$1');
  out = out.replace(
    /(\[styles\.header, \{[^}]*?)(,?\s*paddingTop:\s*(?:\d+\s*\+\s*insets\.top|insets\.top\s*\+\s*\d+))([^}]*?\})/g,
    (m, pre, _pad, post) => {
      const cleaned = post.trim().replace(/^,/, '').trim();
      return cleaned ? `${pre}, ${cleaned}` : pre;
    }
  );
  // collapse now-empty inline objects
  out = out.replace(/\[styles\.header, \{\s*\}\]/g, 'styles.header');

  // 3. if the header style has no paddingTop at all, add SPACING.xl (covers
  //    headers that previously relied on inline insets padding)
  const needsPad = /\binsets\.top\b/.test(out.replace(/\bconst\s+insets\s*=\s*useSafeAreaInsets\(\);/g, ''));
  if (needsPad) {
    out = out.replace(
      /\n([ \t]*)header: \{\n/g,
      '\n$1header: {\n$1  // AppScreen already pads for the status-bar/safe-area inset\n$1  paddingTop: SPACING.xl,\n'
    );
    out = out.replace(
      /\n([ \t]*)header: \{ ([^}\n]*),\n/g,
      '\n$1header: {\n$1  // AppScreen already pads for the status-bar/safe-area inset\n$1  paddingTop: SPACING.xl,\n$1  $2,\n'
    );
  }

  return out;
}

// ── Transform a single file ─────────────────────────────────────────────────

function transform(content, file) {
  let out = content;

  // 1. AppScreen import
  const imp = addAppScreenImport(out, file);
  if (!imp.ok) return { ok: false, reason: 'could not locate import block' };
  out = imp.content;

  // 2. hasTabBar inference
  const hasTabBar = /BottomTabScreenProps|TabParamList/.test(out);

  // 3. Transform every legacy return block. Scan from the top; each transform
  //    returns updated content, so re-scan for the next container after each.
  //    KAV matches only while it still carries styles.container — once
  //    transformKavReturn rewrites it to style={{ flex: 1 }} it drops out of
  //    the scan, so the loop terminates instead of re-matching the wrapper.
  const containerRe =
    /<View style=\{\[?styles\.container|<KeyboardAvoidingView\b[^>]*?style=\{\s*styles\.container\s*\}/g;
  let guard = 0;
  while (guard++ < 50) {
    const m = containerRe.exec(out);
    if (!m) break;
    const openIdx = m.index;
    const before = out.slice(0, openIdx);

    // Only transform containers that are the root of a `return ( … )`
    if (!/return\s*\(\s*$/.test(before.replace(/\s+$/, ' ')) && !/\breturn\s*\(\s*\n\s*$/.test(before)) {
      // not a return root — skip it and continue scanning after this match
      continue;
    }

    const openTagEnd = findTagEnd(out, openIdx);
    const openTag = out.slice(openIdx, openTagEnd);

    let next;
    if (openTag.startsWith('<KeyboardAvoidingView')) {
      next = transformKavReturn(out, openIdx, hasTabBar);
    } else {
      const closeIdx = findMatchingClose(out, openIdx, 'View');
      const inner = closeIdx === -1 ? '' : out.slice(openTagEnd, closeIdx);
      const isScroll = /<ScrollView\b[\s\S]*?refreshControl=/.test(inner) || /<ScrollView\b/.test(inner);
      const directScroll = (() => {
        let c = openTagEnd;
        while (c < (closeIdx === -1 ? out.length : closeIdx)) {
          const sm = out.slice(c).match(/<ScrollView\b/);
          if (!sm) break;
          const sv = c + sm.index;
          if (closeIdx !== -1 && sv >= closeIdx) break; // past the container bounds
          const tagEnd = findTagEnd(out, sv);
          if (/refreshControl=/.test(out.slice(sv, tagEnd))) return true;
          c = tagEnd;
        }
        return false;
      })();
      if (directScroll) {
        next = transformMainReturn(out, openIdx, hasTabBar);
      } else if (/<View style=\{\[?styles\.container/.test(openTag)) {
        // style-array container with no refreshControl ScrollView → static
        next = transformStaticReturn(out, openIdx, hasTabBar);
      } else {
        // plain container: canonical loading/main shapes (existing behavior)
        const canonical = transformCanonical(out, file, hasTabBar);
        next = canonical.ok ? canonical.content : null;
      }
    }

    if (next === null) {
      return { ok: false, reason: 'container matched but transform could not be applied' };
    }
    if (next === out) {
      // no progress — avoid infinite loop
      out = before + openTag + out.slice(openTagEnd);
      continue;
    }
    out = next;
    // content changed — restart the scan from the top so shifted containers
    // are still caught (the skipped non-return-root occurrences keep lastIndex).
    containerRe.lastIndex = 0;
  }

  // 4. Style cleanup
  out = removeContainerStyle(out);
  out = fixHeaderPadding(out);

  // 5. Import cleanup (only when unused)
  out = removeUnusedImport(out, 'RefreshControl');
  out = removeUnusedImport(out, 'ScrollView');
  out = removeUnusedImport(out, 'useSafeAreaInsets');
  out = removeUnusedInsetsHook(out);

  // 6. Verification (revert on any doubt)
  if (out.includes('styles.container')) {
    return { ok: false, reason: 'dangling styles.container reference remains' };
  }
  // Only the root container style (flex: 1) must be gone. Other StyleSheets
  // may legitimately define their own `container` key (e.g. chartStyles).
  if (/\n\s+container:\s*\{\s*flex: 1/.test(out)) {
    return { ok: false, reason: 'unremoved container: style definition (non-canonical body)' };
  }
  if (count(out, /<AppScreen\b/g) !== count(out, /<\/AppScreen>/g)) {
    return { ok: false, reason: 'unbalanced <AppScreen> tags' };
  }
  // Count JSX <ScrollView …> open tags only — `useRef<ScrollView>(null)` is a
  // TS generic, not a JSX tag, and must not count as an open tag.
  const svOpens = (out.match(/<ScrollView\b/g) || []).filter((m, i, arr) => {
    // find position of this match
    const pos = (() => {
      let p = -1;
      for (let k = 0; k <= i; k++) p = out.indexOf('<ScrollView', p + 1);
      return p;
    })();
    // preceded by a word char ⇒ TS generic (useRef<ScrollView>, Array<ScrollView>)
    return !/[\w.]/.test(out[pos - 1] || '');
  }).length;
  if (svOpens !== count(out, /<\/ScrollView>/g)) {
    return { ok: false, reason: 'unbalanced <ScrollView> tags' };
  }
  if (!/import\s+AppScreen\b/.test(out)) {
    return { ok: false, reason: 'AppScreen import missing' };
  }
  return { ok: true, content: out };
}

/**
 * Canonical transform for plain `<View style={styles.container}>` roots whose
 * direct child is a <ScrollView … refreshControl> — preserved from the first
 * codemod generation so previously-auto-migratable screens still work.
 */
function transformCanonical(content, file, hasTabBar) {
  let out = content;
  const mainTab = hasTabBar ? '      hasTabBar\n' : '';
  const loadTab = hasTabBar ? '        hasTabBar\n' : '';

  const MAIN_OPEN_RE =
    /  return \(\n    <View style=\{styles\.container\}>\n      <ScrollView\n(?:        [^\n]*\n)*?        refreshControl=\{\n          <RefreshControl\n(?:            .*\n)*?          \/>\n        \}\n      >/;
  const LOAD_OPEN_SINGLE_RE =
    /      <View style=\{styles\.container\}>\n        <ScrollView showsVerticalScrollIndicator=\{false\} contentContainerStyle=\{styles\.scrollContent\}>\n/;
  const LOAD_OPEN_MULTI_RE =
    /      <View style=\{styles\.container\}>\n        <ScrollView\n          showsVerticalScrollIndicator=\{false\}\n          contentContainerStyle=\{styles\.scrollContent\}\n        >\n/;
  const LOAD_CLOSE_RE = /        <\/ScrollView>\n      <\/View>\n    \);\n  \}/;
  const MAIN_CLOSE_SPACER_RE =
    /        <View style=\{\{ height: 100 \}\} \/>\n      <\/ScrollView>\n    <\/View>\n  \);\n\}/;
  const MAIN_CLOSE_RE = /      <\/ScrollView>\n    <\/View>\n  \);\n\}/;
  const CONTAINER_STYLE_MULTI_RE = /\n  container: \{\n    flex: 1,\n    backgroundColor: colors\.bg,\n  \},\n/;
  const CONTAINER_STYLE_ONE_RE = /\n  container: \{ flex: 1, backgroundColor: colors\.bg \},\n/;
  const HEADER_PAD_MULTI_RE = /\n  header: \{\n    paddingTop: 60,\n/;
  const HEADER_PAD_ONE_RE = /\n  header: \{ paddingTop: 60,/;

  // 1. Main return opening
  const mainMatch = out.match(MAIN_OPEN_RE);
  if (!mainMatch) return { ok: false, reason: 'main return does not match canonical pattern' };
  const block = mainMatch[0];
  const refreshingMatch = block.match(/refreshing=\\{([^}]+)\\}/);
  const onRefreshMatch = block.match(/onRefresh=\\{([^}]+)\\}/);
  if (!refreshingMatch || !onRefreshMatch) {
    return { ok: false, reason: 'refreshControl missing refreshing/onRefresh props' };
  }
  const refreshing = refreshingMatch[1].trim();
  const onRefresh = onRefreshMatch[1].trim();
  if (/[{}\\]\\[]/.test(refreshing) || /[{}\\]\\[]/.test(onRefresh)) {
    return { ok: false, reason: `non-trivial refresh expression (${onRefresh}) — migrate by hand` };
  }
  out = out.replace(
    MAIN_OPEN_RE,
    `  return (\n    <AppScreen\n${mainTab}      padded={false}\n      refreshing={${refreshing}}\n      onRefresh={${onRefresh}}\n      contentStyle={styles.scrollContent}\n    >`
  );

  // 2. Loading state opening (either variant, if present)
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

  // 3. Closing tags
  out = out.replace(LOAD_CLOSE_RE, '      </AppScreen>\n    );\n  }');
  if (MAIN_CLOSE_SPACER_RE.test(out)) {
    out = out.replace(MAIN_CLOSE_SPACER_RE, '    </AppScreen>\n  );\n}');
  } else if (MAIN_CLOSE_RE.test(out)) {
    out = out.replace(MAIN_CLOSE_RE, '    </AppScreen>\n  );\n}');
  } else {
    return { ok: false, reason: 'main return closing tags not in canonical shape' };
  }

  // 4. Style tweaks
  if (CONTAINER_STYLE_MULTI_RE.test(out)) out = out.replace(CONTAINER_STYLE_MULTI_RE, '\n');
  else if (CONTAINER_STYLE_ONE_RE.test(out)) out = out.replace(CONTAINER_STYLE_ONE_RE, '\n');
  if (HEADER_PAD_MULTI_RE.test(out)) {
    out = out.replace(HEADER_PAD_MULTI_RE, '\n  header: {\n    // AppScreen already pads for the status-bar/safe-area inset\n    paddingTop: SPACING.xl,\n');
  } else if (HEADER_PAD_ONE_RE.test(out)) {
    out = out.replace(HEADER_PAD_ONE_RE, '\n  header: { paddingTop: SPACING.xl,');
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

  const isLegacy =
    /styles\.container/.test(content) &&
    (/\bRefreshControl\b/.test(content) || /<ScrollView\b/.test(content) || /<KeyboardAvoidingView\b/.test(content));
  if (!isLegacy) {
    report.clean++;
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

// Exported for testing (unit / regression checks).
export {
  transform,
  transformMainReturn,
  transformStaticReturn,
  transformKavReturn,
  transformNestedScrollReturn,
  addAppScreenImport,
  findTagEnd,
  findMatchingClose,
  skipBrace,
};
