#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Toroloom — Git hooks installer
#
# Copies tracked hook scripts into .git/hooks/ so they run automatically
# on git events (commit, push, etc.).
#
# Usage:
#   bash scripts/install-hooks.sh
#
# This runs automatically on `npm install` via the "postinstall" script.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Fallback: resolve REPO_ROOT from the script location if git rev-parse fails
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
    REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi

HOOKS_SRC="$REPO_ROOT/scripts/pre-commit"
HOOKS_DST="$REPO_ROOT/.git/hooks"

if [ ! -d "$HOOKS_DST" ]; then
    echo "⚠  Skipping hook installation — not a git repository or .git missing."
    exit 0
fi

INSTALLED=0

for hook in "$HOOKS_SRC"/*.sh; do
    [ -f "$hook" ] || continue

    hook_name="$(basename "$hook" .sh)"
    dest="$HOOKS_DST/$hook_name"

    # Append .sample extension for safety? No — install as the real hook.
    cp "$hook" "$dest"
    chmod +x "$dest"

    echo "  ✅ Installed git hook: $hook_name"
    INSTALLED=$((INSTALLED + 1))
done

if [ $INSTALLED -gt 0 ]; then
    echo "✅ Git hooks installed ($INSTALLED total). Grafana configs will be validated on every commit."
else
    echo "ℹ️  No hook scripts found in $HOOKS_SRC"
fi
