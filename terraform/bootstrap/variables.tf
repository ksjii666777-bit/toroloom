# ==============================================================================
# Toroloom — Terraform State Backend Bootstrap — Variables
# ==============================================================================

variable "aws_region" {
  description = "AWS region for the Terraform state backend resources"
  type        = string
  default     = "ap-south-1"
}

variable "state_bucket_name" {
  description = <<EOF
    Globally unique name for the S3 bucket storing Terraform state files.
    Convention: {project}-terraform-state-{env}
    Example:    toroloom-terraform-state-production
EOF
  type        = string
}

variable "lock_table_name" {
  description = "Name of the DynamoDB table for Terraform state locking"
  type        = string
  default     = "toroloom-terraform-locks"
}

variable "force_destroy_bucket" {
  description = "Allow destruction of the S3 bucket even if it contains state files (use with extreme caution)"
  type        = bool
  default     = false
}

variable "lifecycle_transition_days" {
  description = "Days after which noncurrent state versions transition to Glacier Deep Archive (0 to disable transition)"
  type        = number
  default     = 30
}

variable "lifecycle_expiration_days" {
  description = "Days after which noncurrent state versions are permanently deleted (0 to disable expiration)"
  type        = number
  default     = 90
}

variable "lifecycle_abort_multipart_days" {
  description = "Days after which incomplete multipart uploads are aborted"
  type        = number
  default     = 7
}

variable "create_storage_alarm" {
  description = "Create a CloudWatch alarm on S3 bucket storage size"
  type        = bool
  default     = true
}

variable "storage_alarm_threshold_bytes" {
  description = "S3 bucket storage size alarm threshold in bytes (default: 1 GB)"
  type        = number
  # 1 GB
  default = 1073741824
}

variable "allowed_iam_principals" {
  description = <<EOF
    List of IAM principal ARN patterns allowed to access Terraform state files.
    Uses ArnLike condition — supports wildcards.
    Examples:
      ["arn:aws:iam::123456789012:role/TerraformAdmin"]
      ["arn:aws:iam::*:role/terraform-*"]
      ["arn:aws:iam::*:user/terraform-*", "arn:aws:iam::*:role/ci-*"]
    Leave empty to allow any authenticated IAM principal (still enforces TLS).
EOF
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Common tags applied to all bootstrap resources"
  type        = map(string)
  default = {
    Project   = "Toroloom"
    ManagedBy = "Terraform"
    Component = "terraform-state-backend"
  }
}
