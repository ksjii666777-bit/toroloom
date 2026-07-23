#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Toroloom — Pre-commit hook: validate changed Grafana config files
#
# Runs scripts/validate-grafana-configs.py on all staged Grafana provisioning
# YAML files and dashboard JSON files. Aborts the commit if any file fails
# validation.
#
# Installation:
#   bash scripts/install-hooks.sh
#
# The hook is also auto-installed on `npm install` via the "postinstall" script.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
VALIDATOR="$REPO_ROOT/scripts/validate-grafana-configs.py"

# Collect staged Grafana config files (YAML + JSON under backend/grafana/)
# Diff filters: Added, Copied, Modified, Renamed
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR | \
    grep -E '^backend/grafana/.*\.(yml|yaml|json)$' || true)

if [ -z "$STAGED_FILES" ]; then
    # No Grafana files staged — nothing to validate
    exit 0
fi

# Resolve to absolute paths relative to repo root
FILES=()
while IFS= read -r line; do
    [ -z "$line" ] && continue
    FILES+=("$REPO_ROOT/$line")
done <<< "$STAGED_FILES"

# Run validation
python3 "$VALIDATOR" "${FILES[@]}"
RESULT=$?

if [ $RESULT -ne 0 ]; then
    echo ""
    echo "❌ Pre-commit hook: Grafana config validation FAILED."
    echo "   Fix the errors above and stage the corrected files, then retry the commit."
    echo ""
    exit 1
fi

exit 0
