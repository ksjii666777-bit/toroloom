#!/usr/bin/env bash
# ==============================================================================
# Toroloom — Local Integration Test Runner
# ==============================================================================
# Usage:
#   bash scripts/run-integration-tests.sh                     # Run + teardown
#   bash scripts/run-integration-tests.sh --coverage          # Run with coverage + teardown
#   bash scripts/run-integration-tests.sh --keep              # Run + keep services
#   bash scripts/run-integration-tests.sh --coverage --keep   # Run with coverage + keep
#   bash scripts/run-integration-tests.sh --down              # Stop + remove services
#   bash scripts/run-integration-tests.sh --help              # Show this message
#
# Prerequisites:
#   - Docker + Docker Compose (v2.20+)
#   - Node.js 20+
# ==============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
BACKEND_DIR="$ROOT_DIR/backend"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info()  { echo -e "${CYAN}[info]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[ok]${NC}   $1"; }
log_warn()  { echo -e "${YELLOW}[warn]${NC} $1"; }
log_err()   { echo -e "${RED}[err]${NC}  $1"; }

# ──── Parse flags ────────────────────────────────────────────────────────────

SHOW_HELP=false
DO_DOWN=false
KEEP_SERVICES=false
COVERAGE=false

for arg in "$@"; do
  case "$arg" in
    --help|-h)      SHOW_HELP=true ;;
    --down)         DO_DOWN=true ;;
    --keep)         KEEP_SERVICES=true ;;
    --coverage)     COVERAGE=true ;;
    *)
      log_err "Unknown option: $arg"
      log_info "Run 'bash scripts/run-integration-tests.sh --help' for usage."
      exit 1
      ;;
  esac
done

# ──── Help ────────────────────────────────────────────────────────────────────

if $SHOW_HELP; then
  cat <<USAGE
Usage: bash scripts/run-integration-tests.sh [FLAGS]

Flags (combinable):
  --coverage    Run tests with vitest coverage reporting
  --keep        Keep Docker services running after tests
  --down        Stop and remove Docker services (cleanup only)
  --help, -h    Show this help message

Examples:
  bash scripts/run-integration-tests.sh
  bash scripts/run-integration-tests.sh --coverage
  bash scripts/run-integration-tests.sh --coverage --keep
  bash scripts/run-integration-tests.sh --keep
  bash scripts/run-integration-tests.sh --down
USAGE
  exit 0
fi

# ──── Down (cleanup only) ─────────────────────────────────────────────────────

if $DO_DOWN; then
  log_info "Tearing down Docker services..."
  (cd "$ROOT_DIR" && docker compose down 2>/dev/null) || true
  log_ok "Docker services stopped and removed."
  exit 0
fi

# ──── Cleanup trap (catches Ctrl+C and normal exit) ──────────────────────────

cleanup() {
  if [[ "$KEEP_SERVICES" != "true" ]]; then
    log_info "Tearing down Docker services..."
    (cd "$ROOT_DIR" && docker compose down 2>/dev/null) || true
    log_ok "Docker services stopped and removed."
  fi
}
trap cleanup EXIT

# ──── Pre-flight checks ───────────────────────────────────────────────────────

if ! command -v docker &>/dev/null; then
  log_err "Docker is not installed. Please install Docker Desktop first."
  exit 1
fi

if ! docker info &>/dev/null; then
  log_err "Docker daemon is not running. Please start Docker Desktop and try again."
  exit 1
fi

if ! docker compose version &>/dev/null; then
  log_err "Docker Compose v2 is required. Run 'docker compose version' to check."
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  log_err "docker-compose.yml not found at $COMPOSE_FILE"
  exit 1
fi

if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  log_warn "Backend dependencies not installed. Running npm ci..."
  (cd "$BACKEND_DIR" && npm ci)
  log_ok "Dependencies installed."
fi

# ──── Start services ──────────────────────────────────────────────────────────

log_info "Starting PostgreSQL and MongoDB via Docker Compose..."
(cd "$ROOT_DIR" && docker compose up -d postgres mongodb)

log_info "Waiting for services to become healthy..."

# Helper: poll a container's Docker health status.
# Uses Docker's own health checks (defined in docker-compose.yml) via inspect.
wait_for_health() {
  local container_name="$1"
  local service_label="$2"
  local max_attempts=45   # 45 × 2s = 90s timeout (generous for first-time DB init)
  local attempt=0

  while [ $attempt -lt $max_attempts ]; do
    attempt=$((attempt + 1))
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "starting")
    if [ "$status" = "healthy" ]; then
      log_ok "$service_label is healthy."
      return 0
    fi
    if [ "$status" = "unhealthy" ]; then
      log_err "$service_label is marked unhealthy by Docker."
      log_err "Run 'docker compose logs $container_name' for details."
      return 1
    fi
    sleep 2
  done

  log_err "$service_label failed to become healthy within $((max_attempts * 2)) seconds."
  log_err "Run 'docker compose logs $container_name' for details."
  return 1
}

wait_for_health "toroloom-postgres" "PostgreSQL" || { exit 1; }
wait_for_health "toroloom-mongodb" "MongoDB" || { exit 1; }

echo ""
log_info "Both databases are ready. Running integration tests..."
echo ""

# ──── Run integration tests ───────────────────────────────────────────────────

VITEST_CMD="npx vitest run --reporter=verbose src/__tests__/*.int.test.ts"

if $COVERAGE; then
  VITEST_CMD="$VITEST_CMD --coverage"
  log_info "Coverage reporting is enabled."
fi

set +e
(cd "$BACKEND_DIR" && eval "$VITEST_CMD")
TEST_EXIT_CODE=$?
set -e

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
  log_ok "All integration tests passed!"
else
  log_err "Some integration tests failed (exit code: $TEST_EXIT_CODE)."
fi
echo ""

# ──── Teardown (handled by trap) ──────────────────────────────────────────────

if $KEEP_SERVICES; then
  log_info "Services left running (--keep). Stop them anytime with:"
  echo -e "  ${CYAN}bash $ROOT_DIR/scripts/run-integration-tests.sh --down${NC}"
  echo -e "  ${CYAN}docker compose -f $COMPOSE_FILE down${NC}"
  echo ""
fi

exit $TEST_EXIT_CODE
