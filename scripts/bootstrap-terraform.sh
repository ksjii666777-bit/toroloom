#!/usr/bin/env bash
# ==============================================================================
# Toroloom — Terraform Remote State Backend Bootstrap
# ==============================================================================
#
# One-step bootstrap for team-managed Terraform infrastructure:
#   ./scripts/bootstrap-terraform.sh
#
# What it does:
#   1. Creates an S3 bucket (with versioning + encryption) for Terraform state
#   2. Creates a DynamoDB table (PAY_PER_REQUEST) for state locking
#   3. Generates backend.hcl in terraform/ ready for terraform init
#   4. Initializes the main Terraform module with S3 remote state
#
# Prerequisites:
#   - AWS CLI installed and configured (aws configure)
#   - Terraform >= 1.6.0 installed
#   - Appropriate IAM permissions:
#       - s3:CreateBucket, s3:PutBucketVersioning, s3:PutEncryptionConfig
#       - s3:PutBucketPublicAccessBlock, s3:PutLifecycleConfiguration
#       - dynamodb:CreateTable, dynamodb:PutResourcePolicy
#       - s3:GetObject, s3:PutObject (for state files)
#       - dynamodb:GetItem, dynamodb:PutItem, dynamodb:DeleteItem (for locks)
#
# Usage:
#   ./scripts/bootstrap-terraform.sh                          # Interactive
#   ./scripts/bootstrap-terraform.sh --non-interactive        # Use defaults
#   BUCKET_NAME=my-state-bucket ./scripts/bootstrap.sh        # Custom bucket
# ==============================================================================

set -euo pipefail

# ──── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ──── Defaults ────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"
BOOTSTRAP_DIR="$TERRAFORM_DIR/bootstrap"
BACKEND_HCL="$TERRAFORM_DIR/backend.hcl"

AWS_REGION="${AWS_REGION:-ap-south-1}"
BUCKET_NAME="${BUCKET_NAME:-}"
ENVIRONMENT="${ENVIRONMENT:-production}"
NON_INTERACTIVE=false

# ──── Helpers ─────────────────────────────────────────────────────────────────
log()     { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
section() { echo ""; echo -e "${CYAN}━━━ $* ━━━${NC}"; }

check_deps() {
  local missing=false
  for cmd in aws terraform; do
    if ! command -v "$cmd" &>/dev/null; then
      error "$cmd is not installed."
      missing=true
    fi
  done

  if $missing; then
    info "Install AWS CLI:   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    info "Install Terraform: https://developer.hashicorp.com/terraform/downloads"
    exit 1
  fi

  # Verify AWS credentials
  if ! aws sts get-caller-identity &>/dev/null; then
    error "AWS credentials not configured. Run 'aws configure' first."
    exit 1
  fi

  local identity
  identity=$(aws sts get-caller-identity --query 'Arn' --output text 2>/dev/null)
  log "✓ AWS identity: $identity"
}

generate_bucket_name() {
  local suffix
  # Cross-platform unique suffix: openssl works on both Linux and macOS
  suffix=$(openssl rand -hex 4 2>/dev/null || echo "$(date +%s | md5sum 2>/dev/null | head -c 8 || date +%s)")
  echo "toroloom-terraform-state-${ENVIRONMENT}-${suffix}"
}

# ──── Parse arguments ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --non-interactive) NON_INTERACTIVE=true; shift ;;
    --help|-h)
      sed -n '2,/^$/p' "${BASH_SOURCE[0]}" | sed 's/^# //; s/^#$//; s/^#//'
      exit 0
      ;;
    *) error "Unknown option: $1"; exit 1 ;;
  esac
done

# ──── Main ────────────────────────────────────────────────────────────────────
main() {
  echo -e "${CYAN}"
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║     Toroloom — Terraform Remote State Bootstrap            ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"

  # ── Prerequisites ──────────────────────────────────────────────────────────
  section "Step 0 — Prerequisites"
  check_deps

  # ── Bucket name ────────────────────────────────────────────────────────────
  section "Step 1 — S3 Bucket"
  if [[ -z "$BUCKET_NAME" ]]; then
    if $NON_INTERACTIVE; then
      BUCKET_NAME=$(generate_bucket_name)
      info "Using auto-generated bucket name: $BUCKET_NAME"
    else
      local default_name
      default_name=$(generate_bucket_name)
      echo ""
      info "Enter a globally unique S3 bucket name for Terraform state."
      echo -e "  ${YELLOW}Press Enter to use: $default_name${NC}"
      read -r -p "  Bucket name: " input_name
      BUCKET_NAME="${input_name:-$default_name}"
    fi
  fi
  log "✓ Bucket name: $BUCKET_NAME"

  # ── DynamoDB table name ──────────────────────────────────────────────────
  section "Step 2 — DynamoDB Table"
  local TABLE_NAME="toroloom-terraform-locks"
  if ! $NON_INTERACTIVE; then
    echo ""
    info "Enter DynamoDB table name for state locking."
    echo -e "  ${YELLOW}Press Enter to use: $TABLE_NAME${NC}"
    read -r -p "  Table name: " input_table
    TABLE_NAME="${input_table:-$TABLE_NAME}"
  fi
  log "✓ Table name: $TABLE_NAME"

  # ── Create S3 bucket and DynamoDB table via bootstrap Terraform ──────────
  section "Step 3 — Bootstrap Terraform Module"

  if [[ ! -d "$BOOTSTRAP_DIR" ]]; then
    error "Bootstrap directory not found: $BOOTSTRAP_DIR"
    info "Are you running from the project root?"
    exit 1
  fi

  pushd "$BOOTSTRAP_DIR" > /dev/null

  info "Initializing bootstrap module..."
  terraform init -quiet

  info "Applying bootstrap module (S3 bucket + DynamoDB table)..."
  terraform apply \
    -auto-approve \
    -var="state_bucket_name=$BUCKET_NAME" \
    -var="lock_table_name=$TABLE_NAME" \
    -var="aws_region=$AWS_REGION"

  local bucket_output
  bucket_output=$(terraform output -raw state_bucket_name 2>/dev/null || echo "$BUCKET_NAME")
  local table_output
  table_output=$(terraform output -raw lock_table_name 2>/dev/null || echo "$TABLE_NAME")

  popd > /dev/null

  log "✓ S3 bucket created:  s3://$bucket_output"
  log "✓ DynamoDB table created: $table_output"

  # ── Generate backend.hcl ────────────────────────────────────────────────
  section "Step 4 — Generate backend.hcl"

  cat > "$BACKEND_HCL" <<EOF
# backend.hcl — Generated by bootstrap-terraform.sh on $(date)
# Terraform remote state backend configuration

bucket         = "${bucket_output}"
key            = "rds/terraform.tfstate"
region         = "${AWS_REGION}"
dynamodb_table = "${table_output}"
encrypt        = true
EOF

  log "✓ Generated: $BACKEND_HCL"

  # ── Init main Terraform module with remote state ─────────────────────────
  section "Step 5 — Initialize Main Terraform Module"

  pushd "$TERRAFORM_DIR" > /dev/null

  if [[ -f ".terraform/terraform.tfstate" ]]; then
    warn "Local state file detected. Migrating to S3 remote state..."
  fi

  info "Initializing with S3 remote backend..."
  terraform init \
    -backend-config="bucket=${bucket_output}" \
    -backend-config="key=rds/terraform.tfstate" \
    -backend-config="region=${AWS_REGION}" \
    -backend-config="dynamodb_table=${table_output}" \
    -backend-config="encrypt=true" \
    -reconfigure

  popd > /dev/null

  # ── Summary ─────────────────────────────────────────────────────────────
  echo ""
  section "✅ Bootstrap Complete"
  echo ""
  echo -e "${GREEN}"
  echo "  S3 bucket:       s3://${bucket_output}"
  echo "  DynamoDB table:  ${table_output}"
  echo "  State key:       rds/terraform.tfstate"
  echo "  backend.hcl:     ${BACKEND_HCL}"
  echo ""
  echo "  Your team can now run:"
  echo "    cd terraform"
  echo "    terraform plan"
  echo "    terraform apply"
  echo ""
  echo "  Other team members just need:"
  echo "    1. AWS CLI credentials (same account)"
  echo "    2. cp backend.hcl.example backend.hcl (or use the generated one)"
  echo "    3. terraform init -backend-config=backend.hcl"
  echo -e "${NC}"
  echo ""
}

# ──── Entry point ──────────────────────────────────────────────────────────────
main "$@"
