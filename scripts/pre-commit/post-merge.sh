#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Toroloom — Post-merge hook: validate Grafana config files after merge
#
# Runs scripts/validate-grafana-configs.py on Grafana config files that
# were changed by a git merge or pull. Falls back to validating ALL Grafana
# files if ORIG_HEAD is unavailable (first pull, shallow clone, rebase).
#
# Merge conflict resolutions can introduce invalid YAML/JSON that the
# pre-commit hook may not catch (pre-commit only checks staged files).
#
# Unlike the pre-commit hook, this is a WARNING only — it does NOT block
# the merge (the merge has already completed).
#
# Installation:
#   bash scripts/install-hooks.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
VALIDATOR="$REPO_ROOT/scripts/validate-grafana-configs.py"

# ── Detect files changed by the merge ────────────────────────────────────
# ORIG_HEAD points to the commit we were at before the merge.
# If unset (first pull, shallow clone, rebase), fall back to all files.
MERGED_GRAFANA_FILES=""

if git rev-parse --verify ORIG_HEAD 2>/dev/null; then
    # Get files changed between pre-merge HEAD and current HEAD
    MERGED_GRAFANA_FILES=$(git diff-tree --name-only -r HEAD ORIG_HEAD 2>/dev/null | \
        grep -E '^backend/grafana/.*\.(yml|yaml|json)$' || true)
fi

if [ -z "$MERGED_GRAFANA_FILES" ]; then
    # Fallback: validate ALL Grafana files on disk
    MERGED_GRAFANA_FILES=$(find "$REPO_ROOT/backend/grafana" \
        -type f \
        \( -name '*.yml' -o -name '*.yaml' -o -name '*.json' \) \
        ! -path '*/node_modules/*' \
        2>/dev/null || true)
fi

if [ -z "$MERGED_GRAFANA_FILES" ]; then
    exit 0
fi

# Convert to array
FILES=()
while IFS= read -r line; do
    [ -z "$line" ] && continue
    # Resolve relative paths from git diff-tree to absolute
    # Convert relative paths to absolute; skip paths that already are absolute
    # (Unix: /path, Windows: C:/path or C:\path)
    if [[ "$line" != /* ]] && [[ ! "$line" =~ ^[A-Za-z]:[/\\] ]]; then
        line="$REPO_ROOT/$line"
    fi
    FILES+=("$line")
done <<< "$MERGED_GRAFANA_FILES"

echo "🔍 Post-merge hook: validating ${#FILES[@]} Grafana config files..."

# Run validation
python3 "$VALIDATOR" "${FILES[@]}"
RESULT=$?

if [ $RESULT -ne 0 ]; then
    echo ""
    echo "⚠  Post-merge hook: Grafana config validation found issues."
    echo "   The merge completed successfully, but some Grafana configuration"
    echo "   files have errors. Fix them before deploying or restarting Grafana."
    echo ""
fi

# Always exit 0 — the merge has already completed and we should not block it
exit 0
