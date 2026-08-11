/**
 * ============================================================================
 * 🚀 DEPLOY WEB-DEMO TO GITHUB PAGES (docs/web-demo)
 * ============================================================================
 *
 * One-command redeploy of the browser demo to the GitHub Pages source folder.
 *
 * WHY A NODE SCRIPT?
 *   The demo is served from the `docs/` folder of the `master` branch
 *   (Repo Settings → Pages → Source: Deploy from a branch → master → /docs).
 *   Vite needs `base: '/toroloom/web-demo/'` so assets resolve under the
 *   project-site subpath. Passing `--base=/...` through npm on Git Bash
 *   (Windows) gets mangled by MSYS path conversion, so we drive Vite's JS
 *   API instead — this works identically on cmd, PowerShell, Git Bash,
 *   macOS and Linux.
 *
 * USAGE:
 *   npm run deploy:pages          # build + copy to docs/web-demo
 *   npm run deploy:pages -- --skip-build   # just re-copy the last build
 *
 * AFTER RUNNING (manual, on purpose — no auto-commit):
 *   git add docs/web-demo
 *   git commit -m "docs: redeploy web-demo"
 *   git push origin master
 *   # live in ~30s at https://<owner>.github.io/toroloom/web-demo/
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'web-demo', 'dist');
const targetDir = path.join(projectRoot, 'docs', 'web-demo');
const basePath = '/toroloom/web-demo/';

const skipBuild = process.argv.includes('--skip-build');

// ── 1. Build with the Pages base path ─────────────────────────────────────
if (!skipBuild) {
  console.log(`[deploy-pages] 🏗️  building web-demo (base: "${basePath}", sourcemaps off)...`);
  const { build } = await import('vite');
  await build({
    configFile: path.join(projectRoot, 'web-demo', 'vite.config.ts'),
    base: basePath,
    build: {
      sourcemap: false,
    },
  });
} else {
  if (!fs.existsSync(distDir)) {
    throw new Error('[deploy-pages] web-demo/dist not found — run `npm run deploy:pages` (without --skip-build) once first');
  }
  console.log('[deploy-pages] ⏭️  --skip-build: using existing web-demo/dist');
}

// ── 2. Replace the Pages source folder ────────────────────────────────────
fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });
fs.cpSync(distDir, targetDir, { recursive: true });

// Strip sourcemaps — vite.config.ts sets build.sourcemap: true, but the
// Pages bundle doesn't need maps (adds ~5 MB). Robust regardless of config.
const all = fs.readdirSync(targetDir, { recursive: true });
for (const f of all) {
  if (f.endsWith('.map')) fs.rmSync(path.join(targetDir, f), { force: true });
}

const files = fs.readdirSync(targetDir, { recursive: true }).filter((f) => fs.statSync(path.join(targetDir, f)).isFile());
const totalBytes = files.reduce((sum, f) => sum + fs.statSync(path.join(targetDir, f)).size, 0);
console.log(`[deploy-pages] ✅ copied ${files.length} files → docs/web-demo/ (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);

// ── 3. Next steps ─────────────────────────────────────────────────────────
function liveUrl() {
  try {
    const remote = execSync('git remote get-url origin', { cwd: projectRoot, encoding: 'utf8' }).trim();
    const m = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (m) return `https://${m[1]}.github.io/${m[2].replace(/\.git$/, '')}/web-demo/`;
  } catch {
    /* no origin remote — fall through to placeholder */
  }
  return 'https://<owner>.github.io/toroloom/web-demo/';
}

console.log('\n[deploy-pages] Next steps (no auto-commit by design):');
console.log('  git add docs/web-demo');
console.log('  git commit -m "docs: redeploy web-demo"');
console.log('  git push origin master');
console.log(`  → live in ~30s at ${liveUrl()}\n`);
