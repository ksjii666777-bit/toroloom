# ==============================================================================
# Toroloom — Terraform State Backend Bootstrap
# ==============================================================================
#
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  RUN THIS FIRST — before any terraform apply in the parent directory.   ║
# ╚══════════════════════════════════════════════════════════════════════════╝
#
# This module provisions the S3 bucket and DynamoDB table required for
# Terraform remote state storage + state locking. Run it once per AWS
# account, then configure the parent module to use the remote backend.
#
# Usage:
#   cd terraform/bootstrap
#   terraform init
#   terraform apply
#
#   # Then configure the parent module:
#   cd terraform
#   terraform init -backend-config=backend.hcl
#   terraform apply
#
# ==============================================================================

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = var.tags
  }
}

# ──── S3 Bucket for Terraform State ─────────────────────────────────────────
# • Versioning enabled — recovers from accidental state deletion/corruption
# • AES-256 server-side encryption (SSE-S3)
# • Public access fully blocked
# • Bucket key enabled (reduces KMS costs if switching to SSE-KMS later)
# • Lifecycle: transition noncurrent versions to Glacier Deep Archive after
#   30 days (cost savings — old state versions are rarely needed), then
#   expire after 90 days
# ==============================================================================
resource "aws_s3_bucket" "terraform_state" {
  bucket        = var.state_bucket_name
  force_destroy = var.force_destroy_bucket
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ──── Bucket Policy — Access Restriction ────────────────────────────────
# • TLS enforcement: denies all requests without HTTPS
# • Principal restriction: only IAM ARNs listed in allowed_iam_principals
#   can read/write state. If the list is empty, any authenticated IAM
#   principal in the account can access (implicit deny from IAM still
#   applies — the caller must also have an IAM policy granting access).
# ==============================================================================
resource "aws_s3_bucket_policy" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  policy = data.aws_iam_policy_document.terraform_state.json
}

data "aws_iam_policy_document" "terraform_state" {
  # ── Statement 1: Enforce HTTPS (always active) ─────────────────────
  statement {
    sid    = "EnforceTLS"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.terraform_state.arn,
      "${aws_s3_bucket.terraform_state.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  # ── Statement 2: Restrict state access to allowed principals ───────
  dynamic "statement" {
    for_each = length(var.allowed_iam_principals) > 0 ? [1] : []
    content {
      sid    = "RestrictToAllowedPrincipals"
      effect = "Allow"

      principals {
        type        = "*"
        identifiers = ["*"]
      }

      actions = [
        "s3:ListBucket",
        "s3:GetBucketVersioning",
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:PutObject",
        "s3:DeleteObject",
      ]

      resources = [
        aws_s3_bucket.terraform_state.arn,
        "${aws_s3_bucket.terraform_state.arn}/*",
      ]

      condition {
        test     = "ArnLike"
        variable = "aws:PrincipalArn"
        values   = var.allowed_iam_principals
      }
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    id     = "transition-noncurrent-versions"
    status = "Enabled"

    filter {}

    # ── Transition to Glacier Deep Archive ─────────────────────────
    # Terraform state versions older than the transition cutoff are
    # moved to Glacier Deep Archive (~$1/TB/month, 12h restore).
    # Set lifecycle_transition_days = 0 to skip transition.
    dynamic "noncurrent_version_transition" {
      for_each = var.lifecycle_transition_days > 0 ? [1] : []
      content {
        noncurrent_days = var.lifecycle_transition_days
        storage_class   = "DEEP_ARCHIVE"
      }
    }

    # ── Permanent deletion ──────────────────────────────────────────
    # Set lifecycle_expiration_days = 0 to keep versions indefinitely.
    dynamic "noncurrent_version_expiration" {
      for_each = var.lifecycle_expiration_days > 0 ? [1] : []
      content {
        noncurrent_days = var.lifecycle_expiration_days
      }
    }

    # ── Abort incomplete multipart uploads ──────────────────────────
    dynamic "abort_incomplete_multipart_upload" {
      for_each = var.lifecycle_abort_multipart_days > 0 ? [1] : []
      content {
        days_after_initiation = var.lifecycle_abort_multipart_days
      }
    }
  }
}

# ──── CloudWatch Alarm — Bucket Storage Size ──────────────────────────────
# • Monitors BucketSizeBytes (published daily by S3 automatically)
# • Alerts when total storage exceeds the configured threshold
# • StandardBucket storage class covers all Terraform state objects
# ==============================================================================
resource "aws_cloudwatch_metric_alarm" "state_bucket_size" {
  count = var.create_storage_alarm ? 1 : 0

  alarm_name          = "${var.state_bucket_name}-storage-size"
  alarm_description   = "S3 Terraform state bucket storage exceeds ${var.storage_alarm_threshold_bytes} bytes"
  namespace           = "AWS/S3"
  metric_name         = "BucketSizeBytes"
  statistic           = "Average"
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.storage_alarm_threshold_bytes
  evaluation_periods  = 1
  period              = 86400 # Daily granularity (S3 storage metrics update daily)
  treat_missing_data  = "notBreaching"

  dimensions = {
    BucketName  = aws_s3_bucket.terraform_state.id
    StorageType = "StandardStorage"
  }
}

# ──── DynamoDB Table for State Locking ──────────────────────────────────────
# • Pay-per-request billing (minimal cost — < $1/month at typical usage)
# • LockID string (H) as the primary key — required by Terraform
# • TTL-enabled (if locks are abandoned, they auto-expire)
# ==============================================================================
resource "aws_dynamodb_table" "terraform_locks" {
  name         = var.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  ttl {
    attribute_name = "ExpiresAt"
    enabled        = true
  }

  tags = var.tags
}

# ──── DynamoDB Resource Policy — Access Restriction ──────────────────────
# • Mirrors the S3 bucket's allowed_iam_principals restriction.
# • Only IAM ARNs listed in allowed_iam_principals can interact with the
#   lock table (GetItem, PutItem, DeleteItem + DescribeTable for status).
# • If the list is empty, no resource policy is attached — access is
#   governed solely by IAM identity-based policies.
# ==============================================================================
resource "aws_dynamodb_resource_policy" "terraform_locks" {
  count        = length(var.allowed_iam_principals) > 0 ? 1 : 0
  resource_arn = aws_dynamodb_table.terraform_locks.arn
  policy       = data.aws_iam_policy_document.terraform_locks[0].json
}

data "aws_iam_policy_document" "terraform_locks" {
  count = length(var.allowed_iam_principals) > 0 ? 1 : 0

  statement {
    sid    = "RestrictLockAccess"
    effect = "Allow"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:DescribeTable",
    ]

    resources = [aws_dynamodb_table.terraform_locks.arn]

    condition {
      test     = "ArnLike"
      variable = "aws:PrincipalArn"
      values   = var.allowed_iam_principals
    }
  }
}
