#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Toroloom — Post-checkout hook: validate Grafana config files after checkout
#
# Runs scripts/validate-grafana-configs.py on Grafana config files that
# changed between the previous and current HEAD after a branch checkout
# or switch. Skips individual file checkouts.
#
# Switching branches can pull in broken configs from another branch that
# weren't caught by that branch's hooks. This hook catches those early.
#
# Unlike the pre-commit / pre-push hooks, this is a WARNING only — it
# does NOT block the checkout (the checkout has already completed).
#
# Installation:
#   bash scripts/install-hooks.sh
#
# Hook arguments (set by git):
#   $1 — previous HEAD ref
#   $2 — new HEAD ref
#   $3 — flag: 1 = branch checkout, 0 = file checkout
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Only validate on branch/commit checkouts, not individual file checkouts
if [ "${3:-0}" != "1" ]; then
    exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
VALIDATOR="$REPO_ROOT/scripts/validate-grafana-configs.py"

PREV_HEAD="${1:-HEAD}"
NEW_HEAD="${2:-HEAD}"

# ── Detect files changed by the checkout ────────────────────────────────
# First checkout: PREV_HEAD might not exist (detached HEAD or fresh clone)
CHECKOUT_GRAFANA_FILES=""

if git rev-parse --verify "$PREV_HEAD" 2>/dev/null && \
   git rev-parse --verify "$NEW_HEAD" 2>/dev/null; then
    CHECKOUT_GRAFANA_FILES=$(git diff-tree --name-only -r "$PREV_HEAD..$NEW_HEAD" 2>/dev/null | \
        grep -E '^backend/grafana/.*\.(yml|yaml|json)$' || true)
fi

if [ -z "$CHECKOUT_GRAFANA_FILES" ]; then
    # Fallback: validate ALL Grafana files on disk
    CHECKOUT_GRAFANA_FILES=$(find "$REPO_ROOT/backend/grafana" \
        -type f \
        \( -name '*.yml' -o -name '*.yaml' -o -name '*.json' \) \
        ! -path '*/node_modules/*' \
        2>/dev/null || true)
fi

if [ -z "$CHECKOUT_GRAFANA_FILES" ]; then
    exit 0
fi

# Convert to array
FILES=()
while IFS= read -r line; do
    [ -z "$line" ] && continue
    # Resolve relative paths to absolute; skip if already absolute
    # (Unix: /path, Windows: C:/path or C:\path)
    if [[ "$line" != /* ]] && [[ ! "$line" =~ ^[A-Za-z]:[/\\] ]]; then
        line="$REPO_ROOT/$line"
    fi
    FILES+=("$line")
done <<< "$CHECKOUT_GRAFANA_FILES"

echo "🔍 Post-checkout hook: validating ${#FILES[@]} Grafana config files..."

# Run validation
python3 "$VALIDATOR" "${FILES[@]}"
RESULT=$?

if [ $RESULT -ne 0 ]; then
    echo ""
    echo "⚠  Post-checkout hook: Grafana config validation found issues."
    echo "   The checkout completed successfully, but the new branch's Grafana"
    echo "   configuration files have errors. Fix them before deploying or"
    echo "   restarting Grafana."
    echo ""
fi

# Always exit 0 — the checkout has already completed and we should not block it
exit 0
