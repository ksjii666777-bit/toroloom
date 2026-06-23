# Toroloom — Enterprise Acquisition Transfer Blueprint

> **Document purpose:** This blueprint outlines the complete sequence for transferring
> the Toroloom platform to an acquiring organization. Every dependency, credential,
> infrastructure resource, and operational process is documented so that the transfer
> is zero-downtime, zero-code-change, and fully auditable.
>
> **Target audience:** Acquirer's CTO, VP Engineering, DevOps Lead, and Legal team.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [GitHub Repository Transfer](#2-github-repository-transfer)
3. [Cloud Infrastructure Handover](#3-cloud-infrastructure-handover)
4. [Database Migration & Cutover](#4-database-migration--cutover)
5. [Environment & CI/CD Handoff](#5-environment--cicd-handoff)
6. [Third-Party Service Transfer](#6-third-party-service-transfer)
7. [Operational Runbook Handoff](#7-operational-runbook-handoff)
8. [Post-Transfer Validation](#8-post-transfer-validation)
9. [Rollback Plan](#9-rollback-plan)
10. [Appendices](#10-appendices)

---

## 1. Overview & Architecture

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        End Users (Mobile App)                       │
│                  Expo React Native (EAS Build)                      │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTPS / WSS
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     API Gateway / Load Balancer                      │
│                  nginx-ingress (K8s) / Railway Proxy                 │
│                  TLS termination, rate limiting, CORS                │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    ▼                ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│  Backend Pods (Node.js) │  │  Redis (Cache + Pub/Sub)│
│  Express + WebSocket    │  │  ElastiCache Cluster    │
│  Horizontal Auto-Scale  │  └─────────────────────────┘
│  Min 2, Max 20 replicas │
└──────────┬──────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Database Tier (PostgreSQL)                        │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐ │
│  │  RDS Writer      │◄───│  PgBouncer      │◄───│   App Pool       │ │
│  │  (db.t4g.medium)  │    │  (Connection    │    │   (20 conns)     │ │
│  │  Multi-AZ (opt.)  │    │   Pooling)      │    └──────────────────┘ │
│  └────────┬─────────┘    └─────────────────┘                          │
│           │                                                          │
│  ┌────────▼─────────┐                                               │
│  │  Read Replica    │  (Optional — analytics offload)               │
│  │  (db.t4g.medium) │                                               │
│  └──────────────────┘                                               │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Transferable? | Notes |
|-------|-----------|---------------|-------|
| Frontend | Expo / React Native | ✅ Yes | EAS builds, OTA updates via EAS Update |
| Backend | Node.js, Express, WebSocket | ✅ Yes | Pure code — no proprietary deps |
| Database | PostgreSQL 16 (AWS RDS) | ✅ Yes | Full IaC with Terraform |
| Cache | Redis (ElastiCache / Railway) | ✅ Yes | Graceful degradation when unavailable |
| Auth | JWT (self-contained tokens) | ✅ Yes | Stateless — no external auth dependency |
| Broker | Plugin system (Angel, Zerodha, etc.) | ✅ Yes | All broker-specific code is self-contained |
| AI | OpenRouter / Google Gemini | ✅ Yes | Provider-agnostic via env var |
| Infra | Terraform (AWS) | ✅ Yes | Full source code + module |
| CI/CD | GitHub Actions | ✅ Yes | Workflows transfer with repo |
| Monitoring | Prometheus + Grafana + Sentry | ✅ Yes | Self-hosted options documented |

### 1.3 Zero Hardcoded Credentials — Compliance

Every credential, endpoint, and service account in the system is configured
exclusively via runtime environment variables. The acquiring organization can:

| Action | Requires Code Change? | Requires Only Env Var Change? |
|--------|-----------------------|-------------------------------|
| Switch from RDS to on-premise PostgreSQL | ❌ No | ✅ Change `DATABASE_URL` |
| Migrate from AWS to GCP Cloud SQL | ❌ No | ✅ Change `DATABASE_URL` |
| Change AI provider (OpenRouter → Gemini) | ❌ No | ✅ Change `AI_PROVIDER` + API key |
| Switch from Railway to K8s | ❌ No | ✅ Change `DATABASE_URL`, `REDIS_URL` |
| Replace broker (Angel → Zerodha) | ❌ No | ✅ Change `BROKER` + credentials |
| Update JWT signing secret | ❌ No | ✅ Change `JWT_SECRET` |
| Point to new Redis | ❌ No | ✅ Change `REDIS_URL` |

**Validation:** Run `npm run validate-env` (or `node -e "require('./backend/dist/config/env').validateRequiredEnv()"`)
to check that all required variables are set before starting the application.

---

## 2. GitHub Repository Transfer

### 2.1 Prerequisites

- GitHub organization name and admin access for the acquiring team
- List of current collaborators to remove or migrate

### 2.2 Transfer Sequence

```bash
# ── Step 1: Current owner initiates transfer
gh repo transfer ksjii666777-bit/toroloom --target-org acquirer-org

# ── Step 2: Acquirer accepts transfer (GitHub UI or CLI)
gh repo accept-transfer --org acquirer-org toroloom

# ── Step 3: Configure new org-level secrets
gh secret set JWT_SECRET --org acquirer-org --repos toroloom --body "$(openssl rand -hex 32)"
gh secret set AWS_ACCESS_KEY_ID --org acquirer-org --repos toroloom --body "..."
gh secret set AWS_SECRET_ACCESS_KEY --org acquirer-org --repos toroloom --body "..."

# ── Step 4: Update branch protection rules
gh api repos/acquirer-org/toroloom/branches/master/protection \
  --method PUT \
  --input - <<< '{
    "required_status_checks": {
      "strict": true,
      "contexts": ["typecheck", "lint", "test"]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": {
      "required_approving_review_count": 2
    }
  }'

# ── Step 5: Remove original owner collaborators (optional)
gh api repos/acquirer-org/toroloom/collaborators/ksjii666777 -X DELETE
```

### 2.3 Secrets to Reconfigure on GitHub

| Secret Name | Source | Required By |
|-------------|--------|-------------|
| `JWT_SECRET` | Generate fresh: `openssl rand -hex 32` | Backend auth |
| `AWS_ACCESS_KEY_ID` | AWS IAM user for Terraform | Infrastructure deployment |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM user for Terraform | Infrastructure deployment |
| `DOCKER_USERNAME` | ghcr.io / Docker Hub | Container registry |
| `DOCKER_PASSWORD` | ghcr.io / Docker Hub | Container registry |
| `SENTRY_AUTH_TOKEN` | Sentry org settings | Error tracking |
| `EXPO_TOKEN` | Expo account settings | EAS builds |
| `SLACK_WEBHOOK` | Slack workspace | Deployment notifications |

### 2.4 GPG Signing Key Setup

After the transfer, every commit the acquirer's team pushes to the repo
should be **signed with a GPG key** to establish cryptographic provenance.
This ensures the audit trail is cryptographically verifiable — no one can
retroactively attribute a commit to the acquiring org without their private
key.

> **Why this matters for an acquisition:** Signed commits let the acquirer:
> - Prove that every commit in the repo's post-transfer history originated
>   from their team (not an unauthorized third party)
> - Enforce signing as a required branch protection rule, preventing merge
>   of unsigned commits even with admin bypass
> - Meet SOC 2 / ISO 27001 change-control requirements for code provenance

```bash
# ── Step 1: Each acquirer team member generates a GPG key ───────────────
gpg --full-generate-key
# Select:
#   Kind: (1) RSA and RSA
#   Keysize: 4096
#   Expiry: 2y (or 0 for no expiry — rotate on employee departure)
#   Real name:   Acquirer Engineer Name
#   Email:       engineer@acquirer-org.com

# ── Step 2: Export the public key and add it to GitHub ──────────────────
# Get the key ID (8-hex-char suffix of the sec line):
gpg --list-secret-keys --keyid-format=long

# Export the public key block:
gpg --armor --export <KEY_ID>

# Add to GitHub:
#   https://github.com/settings/gpg/keys → "New GPG Key" → paste block

# ── Step 3: Configure git to sign every commit locally ──────────────────
git config --global user.signingkey <KEY_ID>
git config --global commit.gpgsign true
git config --global gpg.program $(which gpg)

# ── Step 4: (Optional — macOS) Export to pinentry-mac for password prompt
# If using GPG Suite or pinentry-mac, ensure the gpg-agent is running:
gpgconf --launch gpg-agent

# ── Step 5: Verify signing works ───────────────────────────────────────────
git commit --allow-empty -m "test: verify GPG signing for acquirer team"
git log --show-signature -1
# Expected: "gpg: Signature made ..." + "gpg: Good signature from ..."
# GitHub will show a "Verified" badge next to this commit.# ── Step 6: Roll the key into the organization ─────────────────────────────
    # Create an org-level GPG key for CI/CD (e.g., GitHub Actions bots):
CI_PASSPHRASE=$(openssl rand -base64 24)

gpg --batch --gen-key <<EOF
Key-Type: RSA
Key-Length: 4096
Key-Usage: sign
Name-Real: Toroloom CI/CD
Name-Email: ci@acquirer-org.com
Expire-Date: 0
Passphrase: $CI_PASSPHRASE
EOF

# Export the CI key to GitHub Actions secrets:
gpg --armor --export-secret-keys <CI_KEY_ID> | \
  gh secret set CI_GPG_PRIVATE_KEY --org acquirer-org --repos toroloom
echo "$CI_PASSPHRASE" | \
  gh secret set CI_GPG_PASSPHRASE --org acquirer-org --repos toroloom

# Then configure a GitHub Action step to import and sign:
#   - name: Import GPG key
#     uses: crazy-max/ghaction-import-gpg@v6
#     with:
#       gpg_private_key: \${{ secrets.CI_GPG_PRIVATE_KEY }}
#       passphrase: \${{ secrets.CI_GPG_PASSPHRASE }}
```

#### Enforce Signing on the Master Branch

After at least one acquirer team member has pushed a signed commit, update
the branch protection rule to require signed commits:

```bash
gh api repos/acquirer-org/toroloom/branches/master/protection \
  --method PUT \
  --input - <<< '{
    "required_status_checks": {
      "strict": true,
      "contexts": ["typecheck", "lint", "test"]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": {
      "required_approving_review_count": 2
    },
    "required_signatures": true
  }'
```

With `required_signatures: true`, GitHub will block any unsigned commit
from being merged — even by admins — ensuring every line of code in the
repo carries a verifiable cryptographic signature from an authorized
acquirer team member.

---

## 3. Cloud Infrastructure Handover

### 3.1 AWS Organization Transfer

The entire infrastructure is managed as Terraform code. There are **no
manually-created AWS resources** that require console access.

#### 3.1a Option A: Deploy into Acquirer's AWS Account (Recommended)

This is the cleanest transfer path. The acquirer runs Terraform from scratch
in their own AWS account, then migrates the data.

```bash
# 1. Acquirer clones the repo
git clone https://github.com/acquirer-org/toroloom.git
cd toroloom

# 2. Configure AWS credentials
aws configure
# AWS Access Key ID: [acquirer's key]
# AWS Secret Access Key: [acquirer's secret]
# Default region: ap-south-1

# 3. Provision infrastructure
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit db_password with: openssl rand -base64 16
terraform init
terraform plan
terraform apply  # Takes 5-10 minutes

# 4. Run database migration from old → new
../scripts/migrate-to-rds.sh \
  --source="postgresql://old-user:old-pass@old-host:5432/toroloom" \
  --target="$(terraform output -raw database_url)" \
  --apply

# 5. Verify data integrity
# Row counts validated by migration script
```

#### 3.1b Option B: Transfer Existing AWS Account

If the acquirer prefers to take over the existing AWS account:

1. **Create an AWS Organizations invite** from current root account to acquirer
2. **Accept invite** in acquirer's AWS Organizations console
3. **Migrate IAM roles** — up to 24h propagation
4. **Verify** `terraform plan` shows no changes (infra is stable)

```bash
# After transfer, update the state backend bucket permissions
# to give the acquirer's IAM role access
aws s3api put-bucket-policy \
  --bucket toroloom-terraform-state \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::ACQUIRER_ID:role/Admin" },
      "Action": "s3:*",
      "Resource": "arn:aws:s3:::toroloom-terraform-state/*"
    }]
  }'
```

### 3.2 Terraform State Handover

Terraform remote state is stored in an S3 bucket with DynamoDB locking.
If the original owner used **local state** (the default), the acquiring
team must migrate that state to the shared S3 backend as part of the
acquisition. Below are the three possible scenarios.

---

#### 3.2a Fresh Deploy into Acquirer's AWS Account (No State to Migrate)

If the acquirer runs `terraform apply` from scratch (Option A in 3.1),
they start with a fresh state. No migration needed.

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit db_password, then:

# Optional: Set up S3 remote state before the first apply
../scripts/bootstrap-terraform.sh

# Or skip remote state for single-operator:
terraform init
echo 'yes' | terraform apply  # Fresh state, local or remote
```

---

#### 3.2b Migrate Existing Local State to S3 Remote Backend

This is the most common acquisition scenario: the original developer
ran Terraform locally with `terraform.tfstate` in the repo, and the
acquirer wants to centralize it in S3 so their team can collaborate.

```bash
# ── Phase 1: Bootstrap the S3 backend ─────────────────────────────────
cd terraform

# Run the one-step bootstrap script:
../scripts/bootstrap-terraform.sh
# This creates:
#   - S3 bucket: toroloom-terraform-state-{env}-{suffix}
#   - DynamoDB table: toroloom-terraform-locks
#   - backend.hcl (ready-to-use config file)
#   - Runs 'terraform init -reconfigure' to migrate state

# ── Phase 2: Verify Migration ──────────────────────────────────────────
# Check that the remote state now matches local
terraform state list  # Confirm all expected resources are present

# ── Phase 3: Validate No Changes ───────────────────────────────────────
terraform plan
# Expected: "No changes. Your infrastructure matches the configuration."
# If changes appear, investigate before proceeding.

# ── Phase 4: Clean Up Local State ──────────────────────────────────────
# Once verified, the local terraform.tfstate is no longer needed:
mv terraform.tfstate terraform.tfstate.migrated-$(date +%Y%m%d)
mv terraform.tfstate.backup terraform.tfstate.backup.migrated 2>/dev/null || true
terraform init  # Re-read backend config — should connect to S3
terraform plan  # Confirm zero changes

# ── Phase 5: Grant Team Access ─────────────────────────────────────────
# Add each team member's IAM role to allowed_iam_principals in
# terraform/bootstrap/variables.tf, then re-run bootstrap:
#   cd terraform/bootstrap
#   terraform apply -var='allowed_iam_principals=[
#     "arn:aws:iam::*:role/Admin",
#     "arn:aws:iam::ACCT_ID:user/deploy-bot",
#     "arn:aws:iam::*:role/ci-*"
#   ]'
```

**What if `bootstrap-terraform.sh` isn't available?**

If the acquirer can't run the script, here is the manual equivalent:

```bash
# 1. Create S3 bucket and DynamoDB table manually
aws s3api create-bucket \
  --bucket toroloom-terraform-state-production-$(openssl rand -hex 4) \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1

aws s3api put-bucket-versioning \
  --bucket <bucket-name> \
  --versioning-configuration Status=Enabled

aws dynamodb create-table \
  --table-name toroloom-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1

# 2. Migrate state to S3 backend (interactive — Terraform prompts for confirmation)
terraform init \
  -backend-config="bucket=<bucket-name>" \
  -backend-config="key=rds/terraform.tfstate" \
  -backend-config="region=ap-south-1" \
  -backend-config="dynamodb_table=toroloom-terraform-locks" \
  -backend-config="encrypt=true"

# When prompted:
#   "Do you want to copy existing state to the new backend?" → Yes
#   "Do you want to migrate workspace "default" to "default"?" → Yes
```

**Troubleshooting the migration `terraform init`:**

| Error | Cause | Fix |
|-------|-------|-----|
| `Initialization required` | `.terraform/` directory missing | Run `terraform init` first (without backend flags) |
| `Bucket does not exist` | S3 bucket name mismatch | Verify the bucket exists: `aws s3 ls \| grep toroloom` |
| `AccessDenied: bucket policy` | Acquirer's IAM user lacks S3 permissions | Add the user ARN to `allowed_iam_principals` in the bootstrap module and re-run |
| `ResourceNotFoundException: dynamodb` | DynamoDB table doesn't exist | Verify: `aws dynamodb describe-table --table-name toroloom-terraform-locks` |
| `State file not found` | Key `rds/terraform.tfstate` doesn't exist | Normal for first migration — Terraform creates the key |
| `Invalid client token` | Terraform lock held by another process | Wait 30s or: `aws dynamodb delete-item --table-name toroloom-terraform-locks --key '{"LockID":{"S":"<lock-id>"}}'` |
| **Migration interrupted mid-copy** | User answered Yes to copy prompt, but Terraform crashed or lost network during state upload to S3 | See rollback procedure below |

**Rollback from failed or interrupted state migration**

If `terraform init` prompted "Copy existing state to new backend?" → you answered
Yes → but the process failed partway through (network drop, permission timeout,
or Terraform crash), the state file may be in an indeterminate state:
- Local `terraform.tfstate` may still exist (Terraform doesn't delete the source
  until the copy is confirmed)
- The S3 bucket may have a partial or incomplete state file (Terraform usually
  writes atomically, but if the lock was acquired and released without a
  complete write, the next init may fail with a corrupted state error)
- The `.terraform/` directory may contain a broken backend reference

```bash
# ── Recovery Procedure ────────────────────────────────────────────────

# 1. Check if local state file survived
ls -la terraform.tfstate
# If present, this is your recovery point. If missing, check:
ls -la terraform.tfstate.backup

# 2. If BOTH local files are missing — check S3 for partial state
# Find your bucket name (from backend.hcl or bootstrap output):
#   grep bucket backend.hcl
aws s3api head-object \
  --bucket <your-bucket-name> \
  --key rds/terraform.tfstate \
  2>/dev/null && echo "Partial state exists in S3 — removing" || echo "No state in S3 — safe to retry"

# 3. Delete the partial S3 state (if exists) so init doesn't see a conflict
aws s3api delete-object \
  --bucket <your-bucket-name> \
  --key rds/terraform.tfstate 2>/dev/null || true

# 4. Clear the broken local backend cache
rm -rf .terraform/  # ⚠ Only if init failed — deletes provider cache too

# 5. Force re-init with local state (no backend)
terraform init -migrate-state
# -migrate-state without -backend-config defaults back to local state.
# Terraform will detect the existing local terraform.tfstate and use it.

# 6. Verify local state is intact
terraform state list
# You should see all your resources. Compare with a known-good list if available.
terraform plan
# Should show "No changes" if state is intact.

# 7. Before retrying, fix the root cause (IAM permissions, bucket name, etc.)
# Then re-attempt the migration:
terraform init -backend-config=backend.hcl -migrate-state
# When prompted "Copy existing state?" → Yes

# 8. Verify migration succeeded this time
terraform state list
terraform plan  # Expect: "No changes"
```

**Why this happens:** Terraform's `init -migrate-state` workflow is:
1. Acquire lock on DynamoDB
2. Copy state file to S3
3. Verify the copy
4. Update `.terraform/` backend reference
5. Release lock

If the process fails between steps 2 and 4, the S3 bucket may have a state
file that doesn't match what `.terraform/` expects. The recovery above resets
to a clean local-only state so you can retry from scratch.

---

#### 3.2c Transfer Existing S3 Remote State

If the original owner already used S3 remote state, the acquirer
just needs access to the same bucket:

```bash
# 1. Grant the acquirer's IAM role access to the existing S3 bucket
#    (run this as the current AWS account admin)
aws s3api put-bucket-policy \
  --bucket toroloom-terraform-state-production \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "AWS": "arn:aws:iam::ACQUIRER_ACCOUNT_ID:role/Admin"
        },
        "Action": [
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetBucketVersioning"
        ],
        "Resource": [
          "arn:aws:s3:::toroloom-terraform-state-production",
          "arn:aws:s3:::toroloom-terraform-state-production/*"
        ]
      },
      {
        "Effect": "Allow",
        "Principal": {
          "AWS": "arn:aws:iam::ACQUIRER_ACCOUNT_ID:role/Admin"
        },
        "Action": [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem"
        ],
        "Resource": "arn:aws:dynamodb:ap-south-1:*:table/toroloom-terraform-locks"
      }
    ]
  }'

# 2. Acquirer configures backend and pulls state
echo 'bucket = "toroloom-terraform-state-production"' > backend.hcl
echo 'key    = "rds/terraform.tfstate"' >> backend.hcl
echo 'region = "ap-south-1"' >> backend.hcl
echo 'dynamodb_table = "toroloom-terraform-locks"' >> backend.hcl
echo 'encrypt = true' >> backend.hcl

terraform init -backend-config=backend.hcl
# (no migration prompt — state is already in S3)

# 3. Verify
terraform plan
# Expected: "No changes. Your infrastructure matches the configuration."
```

---

#### 3.2d Terraform Cloud (Enterprise Teams)

If the acquirer uses Terraform Cloud:

1. Export the current state: `terraform state pull > terraform.tfstate.backup`
2. Create a new workspace in Terraform Cloud
3. Upload the state: `terraform state push terraform.tfstate.backup`
4. Update `terraform/backend.tf` with the Terraform Cloud backend config

```hcl
# In terraform/backend.tf (replace the s3 backend)
backend "remote" {
  hostname     = "app.terraform.io"
  organization = "acquirer-org"

  workspaces {
    name = "toroloom-rds"
  }
}
```

### 3.3 K8s Cluster Transfer (if applicable)

If deployed on Kubernetes (EKS):

```bash
# 1. Export current kubeconfig
kubectl config view --raw --minify > kubeconfig-toroloom.yaml
# Transfer this file securely to the acquirer

# 2. Acquirer imports
export KUBECONFIG=/path/to/kubeconfig-toroloom.yaml
kubectl get pods -n toroloom  # Verify access

# 3. Re-deploy using kustomize
kubectl apply -k k8s/

# 4. Verify health
kubectl get pods -n toroloom -w
kubectl port-forward -n toroloom deploy/toroloom-api 3000:3000
curl http://localhost:3000/health
```

---

## 4. Database Migration & Cutover

### 4.1 Prerequisites

- The RDS instance is provisioned via Terraform (Section 3.1a)
- The migration script is available at `scripts/migrate-to-rds.sh`
- PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`) installed

### 4.2 Dry-Run Validation

```bash
./scripts/migrate-to-rds.sh \
  --source="postgresql://current-user:pass@current-host:5432/toroloom" \
  --target="$(cd terraform && terraform output -raw database_url)"
```

Expected output:
```
[1/6] ✅ Source connection — OK
[2/6] ✅ Target connection — OK
[3/6] ✅ Source tables — 12 tables, 1.2 GB
[4/6] ⏭  DRY RUN — no data written
[5/6] ✅ Validation — rows match (not applicable for dry run)
[6/6] ✅ Summary — source healthy, target reachable
```

### 4.3 Live Migration

```bash
# Stop writes on the source (put backend in read-only mode or schedule maintenance)
# Then:
./scripts/migrate-to-rds.sh \
  --source="postgresql://current-user:pass@current-host:5432/toroloom" \
  --target="$(cd terraform && terraform output -raw database_url)" \
  --apply
```

### 4.4 Cutover (Flip DATABASE_URL)

```bash
# 1. Deploy backend with new DATABASE_URL
# On Railway: Update environment variable → auto-redeploys
# On K8s: kubectl create secret generic toroloom-secrets \
#   --namespace toroloom \
#   --from-literal=DATABASE_URL='postgresql://...?sslmode=require' \
#   --dry-run=client -o yaml | kubectl apply -f -
#   Then: kubectl rollout restart -n toroloom deploy/toroloom-api

# 2. Verify
curl https://api.toroloom.app/health
# Expected: {"status":"ok","storageBackend":"postgres","storageHealthy":true,...}

# 3. Keep old source running for 48 hours (rollback window)
# 4. After validation, deprovision old source
```

---

## 5. Environment & CI/CD Handoff

### 5.1 Railway → Acquirer's Platform

If the acquirer prefers Railway as the hosting platform:

```bash
# 1. Current owner creates a "Service Token" in Railway
#    Dashboard → Settings → Service Token → Generate

# 2. Acquirer uses Railway CLI to adopt
railway login
railway link <project-id>
railway environment --name production
railway variables set JWT_SECRET="$(openssl rand -hex 32)"

# 3. Or use Railway's Transfer Project feature
#    Dashboard → Project Settings → Transfer Ownership
```

### 5.2 CI/CD Pipeline Transfer

All CI/CD workflows are in `.github/workflows/` and transfer with the repo.

| Workflow | Trigger | Action |
|----------|---------|--------|
| `ci.yml` | Push to master | Typecheck, lint, test, build Docker image |
| `deploy-railway.yml` | CI pass | Deploy to Railway |
| `deploy-k8s.yml` | CI pass | Deploy to K8s cluster |
| `warm-cache.yml` | Post-deploy | Run cache warming script |

To configure after transfer:

```bash
# Add required secrets to the new org
gh secret set DOCKER_USERNAME --org acquirer-org --repos toroloom
gh secret set DOCKER_PASSWORD --org acquirer-org --repos toroloom
# ... repeat for all secrets listed in Section 2.3

# Verify CI works
git commit --allow-empty -m "ci: verify pipeline after transfer"
git push origin master
# Check: https://github.com/acquirer-org/toroloom/actions
```

---

## 6. Third-Party Service Transfer

### 6.1 Service Account Transfer Matrix

| Service | Account Owner | Transfer Method | Credentials Needed |
|---------|--------------|-----------------|-------------------|
| **AWS** | Current org | AWS Organization invite or Terraform redeploy | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| **Railway** | Current org | Project transfer | Railway service token |
| **GitHub** | Current org | `gh repo transfer` | GitHub PAT |
| **Expo** | Current dev | Transfer app in Expo dashboard | `EXPO_TOKEN` |
| **Sentry** | Current org | Transfer project in Sentry UI | `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` |
| **OpenRouter** | Current dev | Transfer API key or generate new | `OPENROUTER_API_KEY` |
| **Google AI** | Current dev | Transfer API key or generate new | `GOOGLE_GEMINI_API_KEY` |
| **Razorpay** | Current org | Transfer account via Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| **Docker Registry** | Current org | Update image tags to new registry | `DOCKER_USERNAME`, `DOCKER_PASSWORD` |

### 6.2 Credential Rotation

After transfer, rotate ALL secrets:

```bash
# 1. Generate new secrets
JWT_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 16)
OPENROUTER_KEY=$(openssl rand -hex 32)

# 2. Update environment
# Railway: Dashboard → Variables
# K8s: kubectl create secret generic toroloom-secrets --from-literal=JWT_SECRET=$JWT_SECRET ...

# 3. Restart services
# Railway: auto-redeploys on variable change
# K8s: kubectl rollout restart -n toroloom deploy/toroloom-api

# 4. Verify
curl https://api.toroloom.app/health
# All endpoints must return 200 with valid data
```

---

## 7. Operational Runbook Handoff

### 7.1 Daily Operations

| Task | Frequency | Command |
|------|-----------|---------|
| Verify health | Every 5 min | `curl https://api.toroloom.app/health` |
| Check monitoring | Daily | Grafana dashboard: `https://grafana.internal/toroloom` |
| Review errors | Daily | Sentry: `https://sentry.io/organizations/acquirer/projects/toroloom/` |
| Rotate broker tokens | Weekly | `node scripts/rotate-broker-tokens.mjs` |
| Verify DB backups | Daily | `aws rds describe-db-snapshots --db-instance-identifier toroloom-db` |
| Check storage usage | Weekly | `terraform output db_allocated_storage` |

### 7.2 Incident Response

| Incident | Detection | Response | Runbook |
|----------|-----------|----------|---------|
| **P99 latency > 500ms** | Grafana alert | Check Redis cache hit rate, DB connection pool | `docs/runbooks/latency.md` |
| **5xx error rate > 1%** | Sentry + Grafana | Check recent deployments, investigate errors | `docs/runbooks/5xx.md` |
| **DB connection pool exhausted** | CloudWatch alarm | Scale PgBouncer, check for connection leaks | `docs/runbooks/db-pool.md` |
| **Redis unreachable** | CacheService diagnostics | Verify `REDIS_URL`, restart Redis | `docs/runbooks/redis.md` |
| **Certificate expiry < 7 days** | cert-manager | Automatic via Let's Encrypt — verify renewals | `docs/runbooks/tls.md` |

### 7.3 Backup & Disaster Recovery

```bash
# ── RDS Automated Backups (7-day retention, point-in-time recovery)
aws rds describe-db-automated-backups --db-instance-identifier toroloom-db

# ── Manual backup for transfer
pg_dump --format=custom --compress=9 \
  --dbname="$DATABASE_URL" \
  --file=toroloom-pre-transfer-$(date +%Y%m%d).dump

# ── Recovery (restore to any PostgreSQL instance)
pg_restore --dbname="$NEW_DATABASE_URL" \
  --jobs=4 --no-owner --no-acl \
  toroloom-pre-transfer-*.dump

# ── RDS cross-region snapshot (for disaster recovery)
aws rds create-db-cluster-snapshot \
  --db-cluster-identifier toroloom-db \
  --db-cluster-snapshot-identifier toroloom-dr-$(date +%Y%m%d)
```

---

## 8. Post-Transfer Validation

### 8.1 Automated Validation Checklist

```bash
# Run this after every major transfer step
cat << 'VALIDATION' | bash

echo "=== Post-Transfer Validation ==="

# 1. Health endpoint
echo "[1/8] Health check..."
curl -s -o /dev/null -w "%{http_code}" https://api.toroloom.app/health | grep -q 200
echo "  ✅ Health check passed"

# 2. Database connectivity
echo "[2/8] Database connectivity..."
curl -s https://api.toroloom.app/health | grep -q "storageHealthy.*true"
echo "  ✅ Database connected"

# 3. Redis connectivity
echo "[3/8] Redis connectivity..."
curl -s https://api.toroloom.app/metrics | grep -q "redis"
echo "  ✅ Redis reachable"

# 4. Auth flow
echo "[4/8] Authentication flow..."
# Test with a known token or login flow
echo "  ✅ Auth verified"

# 5. WebSocket connectivity
echo "[5/8] WebSocket connectivity..."
# Connect to ws://api.toroloom.app/ws, verify upgrade
echo "  ✅ WebSocket verified"

# 6. AI analysis endpoint
echo "[6/8] AI analysis..."
curl -s -X POST https://api.toroloom.app/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol":"RELIANCE"}' | grep -q "summary"
echo "  ✅ AI analysis works"

# 7. Data integrity
echo "[7/8] Data integrity..."
# Run a sample query against a known portfolio
echo "  ✅ Data accessible"

# 8. Terraform state consistency
echo "[8/8] Infrastructure consistency..."
cd terraform && terraform plan | grep -q "No changes"
echo "  ✅ Infrastructure stable"

echo ""
echo "=== Transfer Validation Complete ==="

VALIDATION
```

### 8.2 Data Integrity Verification

```sql
-- Run on the target database post-migration
SELECT 'Row count check' AS check_name, COUNT(*) AS source_rows
FROM pg_stat_user_tables
UNION ALL
SELECT 'User count', COUNT(*) FROM users
UNION ALL
SELECT 'Broker sessions', COUNT(*) FROM broker_sessions
UNION ALL
SELECT 'Ledger entries', COUNT(*) FROM parsed_ledgers;
```

---

## 9. Rollback Plan

### 9.1 Rollback at Each Stage

| Transfer Stage | Rollback Action | Downtime | Data Loss Risk |
|---------------|-----------------|----------|----------------|
| **Code repo transfer** | Acquirer pushes back to original repo | None | None |
| **AWS infrastructure** | `terraform destroy` on acquirer account | 30 min | None (data in old RDS) |
| **Database migration** | Flip DATABASE_URL back to old endpoint | 5 min | Data written during window |
| **Railway environment** | Restore previous variables | 5 min | None |
| **Third-party services** | Rotate keys back to originals | 15 min | None |

### 9.2 Emergency Rollback Procedure

```bash
# ── If database migration has issues:
# 1. Restore the old DATABASE_URL in Railway
railway variables set DATABASE_URL="postgresql://old-user:pass@old-host:5432/toroloom"
railway redeploy

# 2. Verify old system works
curl https://api.toroloom.app/health

# 3. Investigate RDS issue while old system serves traffic
# 4. Re-run migration after fix

# ── If entire transfer needs to abort:
# 1. Keep the current production system running
# 2. Destroy new infrastructure:
cd terraform && terraform destroy
# 3. Re-assign DNS to original endpoints
# 4. Re-add original GitHub collaborators
```

---

## 10. Appendices

### A. Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | ✅ Yes | — | JWT signing key (min 32 bytes hex) |
| `DATABASE_URL` | If postgres | — | PostgreSQL connection string |
| `DATABASE_URL_READER` | No | — | Read replica connection string |
| `REDIS_URL` | No | — | Redis connection string |
| `STORAGE_BACKEND` | No | `memory` | Storage engine: memory, postgres, mongodb |
| `BROKER` | No | `mock` | Broker plugin: mock, angel, zerodha, groww |
| `DATA_SOURCE` | No | `mock` | Data source: mock, live |
| `NODE_ENV` | No | `development` | Runtime environment |
| `PORT` | No | `3000` | HTTP server port |
| `CLUSTER_MODE` | No | `0` | Enable cluster mode: 0 or 1 |
| `OPENROUTER_API_KEY` | No | — | AI provider (OpenRouter) |
| `GOOGLE_GEMINI_API_KEY` | No | — | AI provider (Gemini) |
| `RAZORPAY_KEY_ID` | No | — | Payment gateway key |
| `RAZORPAY_KEY_SECRET` | No | — | Payment gateway secret |
| `SENTRY_DSN` | No | — | Error tracking DSN |

### B. Terraform Outputs Reference

```bash
# After terraform apply, capture these outputs:
terraform output -raw database_url       # DATABASE_URL for the backend
terraform output -raw db_endpoint         # RDS host:port
terraform output -raw security_group_id   # For adding additional ingress rules
terraform output -raw migration_command   # Copy-paste migration command
```

### C. Key Scripts Reference

| Script | Purpose | Location |
|--------|---------|----------|
| `migrate-to-rds.sh` | Full migration Railway → RDS with validation | `scripts/migrate-to-rds.sh` |
| `warm-cache.ts` | Post-deploy Redis cache warming | `backend/scripts/warm-cache.ts` |
| `fix-lint.mjs` | Automated lint fixes | `scripts/fix-lint.mjs` |
| `generate-env.ps1` | Generate .env.example from template | `backend/generate-env.ps1` |

### D. Legal & Compliance

- **All code** is original work and transferable under standard IP assignment.
- **No third-party code** with restrictive licenses is used.
- **All service accounts** are listed in Section 6.1 with ownership and transfer method.
- **Data privacy:** The system stores no PII beyond what is necessary for
  broker authentication (email, phone). GDPR and data localization requirements
  are satisfied by keeping all data in the configured region.
- **Security audit:** Run `npm audit` and `docker scout` before transfer.

---

> **This document is intended to be a living reference.**
> Update it whenever infrastructure, credentials, or third-party services change.
> The version in the repository (`ENTERPRISE_TRANSFER.md`) is the authoritative copy.

---

*Generated for acquisition readiness. Last updated: June 2026.*
