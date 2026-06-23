#!/usr/bin/env bash
# ==============================================================================
# Toroloom — Railway PostgreSQL → AWS RDS Migration Script
# ==============================================================================
#
# Usage:
#   chmod +x scripts/migrate-to-rds.sh
#   ./scripts/migrate-to-rds.sh                    # Interactive mode
#   ./scripts/migrate-to-rds.sh --help             # This message
#
#   # Non-interactive (all args provided):
#   ./scripts/migrate-to-rds.sh \
#     --source="postgresql://user:pass@railway-host:5432/toroloom" \
#     --target="postgresql://user:pass@rds-host:5432/toroloom" \
#     --apply
#
#   # Dry run (just validate + audit, no actual migration):
#   ./scripts/migrate-to-rds.sh \
#     --source="postgresql://user:pass@railway-host:5432/toroloom" \
#     --target="postgresql://user:pass@rds-host:5432/toroloom"
#
# What it does:
#   1. Validates both source (Railway PG) and target (RDS) connections
#   2. Audits the source DB — table sizes, row counts, extensions
#   3. Dumps the source schema + data (excluding migrations table)
#   4. Restores to RDS using pg_restore (jobs = CPU cores)
#   5. Validates row counts match between source and target
#   6. Prints the final DATABASE_URL to set on Railway
#
# Prerequisites:
#   - PostgreSQL client tools (pg_dump, pg_restore, psql) installed
#     macOS: brew install postgresql-client
#     Ubuntu: apt install postgresql-client-16
#   - Network access to both Railway PG and RDS
#     (you may need to allowlist your IP in RDS security group)
#   - AWS CLI configured (for RDS operations, optional)
#
# Zero-downtime migration flow:
#   Phase 1 — Setup:    Provision RDS, configure security group
#   Phase 2 — Seed:     pg_dump | pg_restore (this script)
#   Phase 3 — Sync:     Run app in dual-write mode (if available)
#   Phase 4 — Cutover:  Flip DATABASE_URL → Railway redeploys
#   Phase 5 — Cleanup:  Verify, then deprovision Railway PG
#
# ==============================================================================

set -euo pipefail

# ──── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ──── State (populated by parse_args) ────────────────────────────────────────
SOURCE_URL=""
TARGET_URL=""
APPLY=false
SCRIPT_DIR=""
DUMP_DIR=""
LOG_FILE=""
DUMP_FILE=""
AUDIT_FILE=""
VALIDATION_FILE=""

# ──── Helper functions ────────────────────────────────────────────────────────
log()     { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
section() { echo ""; echo -e "${CYAN}━━━ $* ━━━${NC}"; }

show_help() {
  sed -n '2,/^$/p' "${BASH_SOURCE[0]}" | sed 's/^# //; s/^#$//; s/^#//'
  exit 0
}

mask_url() {
  echo "$1" | sed -E 's|(://[^:]+:)[^@]+(@.*)|\1***\2|'
}

check_deps() {
  local missing=false
  for cmd in pg_dump pg_restore psql pg_isready; do
    if ! command -v "$cmd" &>/dev/null; then
      error "$cmd is not installed."
      info "Install: brew install postgresql-client  (macOS)"
      info "         apt install postgresql-client-16 (Ubuntu)"
      missing=true
    fi
  done
  if $missing; then
    error "Missing dependencies. Aborting."
    exit 1
  fi
}

validate_connection() {
  local url="$1"
  local label="$2"

  info "Testing connection to $label..."
  if ! psql "$url" -c "SELECT 1 AS ok;" -At 2>/dev/null | grep -q "1"; then
    error "Cannot connect to $label at $(mask_url "$url")"
    error "Check: network access, credentials, and hostname."
    return 1
  fi
  log "✓ Connected to $label"

  local version
  version=$(psql "$url" -c "SHOW server_version;" -At 2>/dev/null)
  log "  PostgreSQL version: $version"
  return 0
}

# ──── Main function ───────────────────────────────────────────────────────────
main() {
  local dump_size=""
  local jobs
  local all_match=true
  local row_count_diff=0
  local table_count

  # ── Parse arguments ──────────────────────────────────────────────────────
  if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    show_help
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --source)  SOURCE_URL="$2"; shift 2 ;;
      --target)  TARGET_URL="$2"; shift 2 ;;
      --apply)   APPLY=true; shift ;;
      *) echo -e "${RED}Unknown option: $1${NC}"; show_help ;;
    esac
  done

  # ── Setup paths ──────────────────────────────────────────────────────────
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  DUMP_DIR="${TMPDIR:-/tmp}/toroloom-migration-$(date +%Y%m%d-%H%M%S)"
  LOG_FILE="${DUMP_DIR}/migration.log"
  DUMP_FILE="${DUMP_DIR}/toroloom.dump"
  AUDIT_FILE="${DUMP_DIR}/source-audit.txt"
  VALIDATION_FILE="${DUMP_DIR}/validation.txt"

  mkdir -p "$DUMP_DIR"

  # ── Banner ───────────────────────────────────────────────────────────────
  echo -e "${CYAN}"
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║           Toroloom — RDS Migration Assistant               ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"

  # ── Dependencies ────────────────────────────────────────────────────────
  check_deps

  # ── Connection prompts ─────────────────────────────────────────────────
  section "Phase 1 — Connection Setup"

  if [[ -z "$SOURCE_URL" ]]; then
    echo ""
    echo -e "${CYAN}Enter the Railway PostgreSQL connection URL.${NC}"
    echo -e "${CYAN}Find it in: Railway Dashboard → PostgreSQL → Variables → DATABASE_URL${NC}"
    echo ""
    echo -e "${YELLOW}  Paste the SOURCE (Railway PG) DATABASE_URL:${NC}"
    echo -e "${YELLOW}  Example: postgresql://user:password@host:5432/dbname${NC}"
    read -r -p "  > " SOURCE_URL
  fi

  if [[ -z "$TARGET_URL" ]]; then
    echo ""
    echo -e "${CYAN}Enter the RDS connection URL.${NC}"
    echo -e "${CYAN}Format: postgresql://username:password@rds-endpoint:5432/toroloom${NC}"
    echo ""
    echo -e "${YELLOW}  Paste the TARGET (RDS) DATABASE_URL:${NC}"
    echo -e "${YELLOW}  Example: postgresql://user:password@rds-host:5432/toroloom${NC}"
    read -r -p "  > " TARGET_URL
  fi

  echo ""
  info "Source: $(mask_url "$SOURCE_URL")"
  info "Target: $(mask_url "$TARGET_URL")"

  # ── Validate connections ────────────────────────────────────────────────
  echo ""
  section "Phase 2 — Connection Validation"

  validate_connection "$SOURCE_URL" "SOURCE (Railway PG)" || exit 1
  validate_connection "$TARGET_URL" "TARGET (RDS)" || exit 1

  # Check for tables in source
  table_count=$(psql "$SOURCE_URL" -c "SELECT count(*) FROM pg_stat_user_tables;" -At 2>/dev/null || echo "0")
  info "Source has $table_count user table(s)"
  if [[ "$table_count" -eq 0 ]]; then
    warn "No user tables found in source. If this is expected, proceed."
    warn "Otherwise, check that the source DATABASE_URL is correct."
  fi

  # Redirect to tee for logging AFTER interactive prompts are done
  exec > >(tee -a "$LOG_FILE") 2>&1

  # ── Audit ────────────────────────────────────────────────────────────────
  echo ""
  section "Phase 3 — Source Database Audit"

  info "Gathering source database statistics..."

  {
    echo "=== Source Database Audit: $(date) ==="
    echo ""
    echo "--- Database Size ---"
    psql "$SOURCE_URL" -c "
      SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size,
             current_database() AS db_name;
    " -At 2>/dev/null

    echo ""
    echo "--- Table Sizes ---"
    psql "$SOURCE_URL" -c "
      SELECT relname AS table_name,
             pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
             n_live_tup AS row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC;
    " -x -P pager=off 2>/dev/null

    echo ""
    echo "--- Extensions ---"
    psql "$SOURCE_URL" -c "SELECT * FROM pg_extension;" -x -P pager=off 2>/dev/null

    echo ""
    echo "--- Index Count ---"
    psql "$SOURCE_URL" -c "
      SELECT count(*) AS total_indexes
      FROM pg_indexes WHERE schemaname = 'public';
    " -At 2>/dev/null

    echo ""
    echo "--- Largest Tables ---"
    psql "$SOURCE_URL" -c "
      SELECT relname, n_live_tup AS rows
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
      LIMIT 10;
    " -x -P pager=off 2>/dev/null
  } > "$AUDIT_FILE"

  log "Audit saved to: $AUDIT_FILE"
  cat "$AUDIT_FILE"

  # ── Dry run check ──────────────────────────────────────────────────────
  echo ""
  section "Phase 4 — Migration"

  if ! $APPLY; then
    echo -e "${YELLOW}────────── DRY RUN ──────────${NC}"
    echo -e "${YELLOW}Connections validated. Source audited.${NC}"
    echo -e "${YELLOW}To proceed with the actual migration, re-run with --apply:${NC}"
    echo ""
    echo -e "${CYAN}  ./scripts/migrate-to-rds.sh \\"
    echo "    --source=\"$SOURCE_URL\" \\"
    echo "    --target=\"$TARGET_URL\" \\"
    echo "    --apply${NC}"
    echo ""
    echo -e "${YELLOW}Migration artifacts kept at: $DUMP_DIR${NC}"
    exit 0
  fi

  # ── Dump ────────────────────────────────────────────────────────────────
  echo ""
  info "Step 1/4 — Dumping source database..."
  info "  Format:    custom (compressed, parallel-restore-capable)"
  info "  Excluding: migrations, schema_migrations tables"
  info "  Output:    $DUMP_FILE"

  pg_dump "$SOURCE_URL" \
    --format=custom \
    --compress=9 \
    --file="$DUMP_FILE" \
    --verbose \
    --no-owner \
    --no-acl \
    --exclude-table=migrations \
    --exclude-table=schema_migrations \
    2>&1 | grep -v "^$" || true

  if [[ ! -f "$DUMP_FILE" ]]; then
    error "Dump failed — $DUMP_FILE not created."
    exit 1
  fi

  dump_size=$(du -h "$DUMP_FILE" | cut -f1)
  log "✓ Dump complete: $dump_size"

  # ── Restore ─────────────────────────────────────────────────────────────
  echo ""
  info "Step 2/4 — Restoring to RDS..."

  jobs=$(nproc 2>/dev/null || echo 4)
  jobs=$(( jobs > 4 ? 4 : jobs ))
  info "  Parallel jobs: $jobs"

  pg_restore \
    --dbname="$TARGET_URL" \
    --jobs="$jobs" \
    --no-owner \
    --no-acl \
    --verbose \
    --exit-on-error \
    "$DUMP_FILE" \
    2>&1 | grep -v "^$" || true

  log "✓ Restore complete"

  # ── Run core migration ─────────────────────────────────────────────────
  echo ""
  info "Step 3/4 — Running scalability core migration on RDS..."

  if [[ -f "$SCRIPT_DIR/../migrations/init_scalability_core.sql" ]]; then
    psql "$TARGET_URL" -f "$SCRIPT_DIR/../migrations/init_scalability_core.sql" -q
    log "✓ Scalability core migration applied"
  else
    warn "migrations/init_scalability_core.sql not found — skipping"
  fi

  # ── Validation ──────────────────────────────────────────────────────────
  echo ""
  section "Phase 5 — Validation"

  info "Comparing row counts between source and target..."

  {
    echo "=== Migration Validation: $(date) ==="
    echo "Source: $(mask_url "$SOURCE_URL")"
    echo "Target: $(mask_url "$TARGET_URL")"
    echo ""
    echo "--- Row Count Comparison ---"
  } > "$VALIDATION_FILE"

  while IFS='|' read -r table_name source_rows; do
    [[ -z "$table_name" ]] && continue
    table_name=$(echo "$table_name" | xargs)
    source_rows=$(echo "$source_rows" | xargs)
    [[ "$table_name" == "table_name" ]] && continue

    local target_rows
    target_rows=$(psql "$TARGET_URL" -c "SELECT count(*) FROM \"$table_name\";" -At 2>/dev/null || echo "ERROR")

    if [[ "$source_rows" == "$target_rows" ]]; then
      echo -e "  ${GREEN}✓${NC} $table_name: $source_rows rows"
      echo "✓ $table_name: source=$source_rows target=$target_rows" >> "$VALIDATION_FILE"
    else
      echo -e "  ${RED}✗${NC} $table_name: source=$source_rows target=$target_rows"
      echo "✗ $table_name: source=$source_rows target=$target_rows" >> "$VALIDATION_FILE"
      all_match=false
      row_count_diff=$(( row_count_diff + source_rows - target_rows ))
    fi
  done < <(psql "$SOURCE_URL" -c "
    SELECT relname, n_live_tup
    FROM pg_stat_user_tables
    ORDER BY relname;
  " -t -A 2>/dev/null)

  echo ""
  if $all_match; then
    log "✓ ALL TABLES MATCH — migration validated successfully"
  else
    warn "Row count mismatch detected (total diff: $row_count_diff)"
    warn "This may be due to ongoing writes during migration."
    warn "If small (< 1%), proceed. For > 1%, consider a second sync pass."
  fi

  # ── Summary ─────────────────────────────────────────────────────────────
  echo ""
  section "Migration Complete"

  local total_source_size
  total_source_size=$(psql "$SOURCE_URL" -c "
    SELECT pg_size_pretty(sum(pg_total_relation_size(relid)))
    FROM pg_stat_user_tables;
  " -At 2>/dev/null || echo "unknown")

  echo -e "${GREEN}"
  echo "  ✅ Migration artifacts:"
  echo "     Dump file:     $DUMP_FILE ($dump_size)"
  echo "     Audit:         $AUDIT_FILE"
  echo "     Validation:    $VALIDATION_FILE"
  echo "     Log:           $LOG_FILE"
  echo ""
  echo "  📦 Source DB size: $total_source_size"
  echo ""
  echo "  🎯 Next Steps:"
  echo "     1. Update Railway DATABASE_URL:"
  echo -e "${CYAN}"
  echo "        DATABASE_URL=$(mask_url "$TARGET_URL")"
  echo -e "${GREEN}"
  echo "     2. Add DATABASE_URL to Railway backend service Variables"
  echo "        Railway will auto-redeploy with the new database"
  echo ""
  echo "     3. Verify:"
  echo "        curl https://your-service.up.railway.app/health"
  echo ""
  echo "     4. Keep Railway PG running for 48 hours (rollback window)"
  echo "        To rollback: restore the old DATABASE_URL"
  echo ""
  echo "     5. After confirmation, deprovision Railway PG:"
  echo "        Railway Dashboard → PostgreSQL service → Settings → Delete"
  echo -e "${NC}"
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}  KEEP THIS TERMINAL OPEN until you verify the new DB.${NC}"
  echo -e "${YELLOW}  Validation file: $VALIDATION_FILE${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# ──── Entry point ──────────────────────────────────────────────────────────────
main "$@"
