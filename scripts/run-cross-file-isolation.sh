#!/bin/bash
# ============================================================================
# Toroloom — Cross-File Isolation Test Runner
# ============================================================================
#
# Runs two separate test files sequentially in the SAME vitest process
# (singleFork) to verify that riskEngine.resetForTesting() in File A's
# afterAll properly isolates File B from File A's state.
#
# Without singleFork=true, each test file gets its own worker process
# and the riskEngine singleton is naturally isolated — the test would
# pass even if resetForTesting() were broken.
#
# Usage:
#   bash scripts/run-cross-file-isolation.sh
#
# Windows (Git Bash / WSL):
#   bash scripts/run-cross-file-isolation.sh
#
# Returns:
#   0 — Both files pass (isolation verified)
#   1 — One or both files fail (isolation broken)
# ============================================================================

set -euo pipefail

echo "═══════════════════════════════════════════════════════════════"
echo "  Toroloom — Cross-File Isolation Test"
echo "═══════════════════════════════════════════════════════════════"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"

cd "$BACKEND_DIR"

# ──── Step 1: Run both files using the dedicated config ──────────────

echo "▶  Running File A → File B (shared process via singleFork)..."
echo ""

npx vitest run \
  --config vitest.cross-file.config.ts \
  --reporter=verbose \
  "src/__tests__/riskCrossFileA.test.ts" \
  "src/__tests__/riskCrossFileB.test.ts"

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "═══════════════════════════════════════════════════════════════"
  echo "  ✅ PASS — Cross-file isolation verified"
  echo "  File A wrote state → afterAll(resetForTesting) →"
  echo "  File B started clean → wrote own state independently"
  echo "═══════════════════════════════════════════════════════════════"
else
  echo "═══════════════════════════════════════════════════════════════"
  echo "  ❌ FAIL — Cross-file isolation broken"
  echo "  Check File B's isolation assertions for details"
  echo "═══════════════════════════════════════════════════════════════"
fi

exit $EXIT_CODE
