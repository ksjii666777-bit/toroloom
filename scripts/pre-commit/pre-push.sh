#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Toroloom — Pre-push hook: validate Grafana config files before pushing
#
# Runs scripts/validate-grafana-configs.py on Grafana config files that
# have changed in the commits about to be pushed. Aborts the push if any
# file fails validation.
#
# This is the final safety gate — it catches anything that bypassed the
# pre-commit hook (e.g. --no-verify, --amend, merge commits).
#
# Installation:
#   bash scripts/install-hooks.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
VALIDATOR="$REPO_ROOT/scripts/validate-grafana-configs.py"

# ── Collect files about to be pushed ─────────────────────────────────────
# The pre-push hook receives ref info on stdin:
#   <local-ref> <local-sha1> <remote-ref> <remote-sha1>
# We calculate the commit range for each ref being pushed.
PUSH_FILES=""

while read -r local_ref local_sha remote_ref remote_sha; do
    # Skip ref deletions (local_sha is 000...)
    if [[ "$local_sha" == "0000000000000000000000000000000000000000" ]]; then
        continue
    fi

    # Determine the commit range to examine
    # For new branches (remote_sha is 000...), diff against HEAD
    if [[ "$remote_sha" == "0000000000000000000000000000000000000000" ]]; then
        range_start="$(git merge-base "$local_sha" HEAD 2>/dev/null || echo '')"
        if [ -z "$range_start" ]; then
            # Fallback: diff against empty tree
            range_start="$(git hash-object -t tree /dev/null 2>/dev/null || echo '4b825dc642cb6eb9a060e54bf899d153f2b8c8c0')"
        fi
    else
        range_start="$remote_sha"
    fi

    # Collect changed files in the range
    range_files=$(git diff-tree --no-commit-id --name-only -r "$range_start..$local_sha" 2>/dev/null || true)
    PUSH_FILES="$PUSH_FILES"$'\n'"$range_files"
done

if [ -z "$PUSH_FILES" ]; then
    exit 0
fi

# ── Filter for Grafana config files ──────────────────────────────────────
GRAFANA_FILES=$(echo "$PUSH_FILES" | grep -E '^backend/grafana/.*\.(yml|yaml|json)$' || true)

if [ -z "$GRAFANA_FILES" ]; then
    # No Grafana files in the push — skip validation
    exit 0
fi

# ── Resolve to absolute paths ────────────────────────────────────────────
FILES=()
while IFS= read -r line; do
    [ -z "$line" ] && continue
    FILES+=("$REPO_ROOT/$line")
done <<< "$GRAFANA_FILES"

echo "🔍 Pre-push hook: validating ${#FILES[@]} Grafana config files..."
echo ""

# ── Run validation ───────────────────────────────────────────────────────
python3 "$VALIDATOR" "${FILES[@]}"
RESULT=$?

if [ $RESULT -ne 0 ]; then
    echo ""
    echo "❌ Pre-push hook: Grafana config validation FAILED."
    echo "   Fix the errors above, commit the fixes, then retry the push."
    echo ""
    exit 1
fi

exit 0
