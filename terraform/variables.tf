# ==============================================================================
# Toroloom — Terraform Variables
# ==============================================================================
# All configurable parameters for the RDS PostgreSQL deployment.
# Customize these in a terraform.tfvars file or pass via -var flags.
# ==============================================================================

# ── General ──────────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment (e.g., production, staging)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name used in resource tags and names"
  type        = string
  default     = "toroloom"
}

variable "tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default = {
    Project     = "Toroloom"
    ManagedBy   = "Terraform"
    Environment = "production"
  }
}

# ── AWS Region & VPC ─────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region to deploy resources (e.g., ap-south-1 for Mumbai)"
  type        = string
  default     = "ap-south-1"
}

variable "vpc_id" {
  description = "VPC ID where RDS will be deployed (leave empty to auto-create VPC)"
  type        = string
  default     = ""
}

variable "subnet_ids" {
  description = "Subnet IDs for DB subnet group (leave empty to auto-create from new VPC)"
  type        = list(string)
  default     = []
}

variable "allowed_security_group_ids" {
  description = "Security group IDs allowed to connect to PostgreSQL (e.g., EKS nodes, Railway egress)"
  type        = list(string)
  default     = []
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to connect to PostgreSQL (use for migration only — lock down after)"
  type        = list(string)
  default     = []
}

# ── RDS Instance ─────────────────────────────────────────────────────────────

variable "db_instance_class" {
  description = "RDS instance class (https://aws.amazon.com/rds/instance-types/)"
  type        = string
  default     = "db.t4g.medium"  # 2 vCPU, 4 GB RAM, burstable
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 100
}

variable "db_max_allocated_storage" {
  description = "Maximum storage for autoscaling (0 to disable)"
  type        = number
  default     = 500
}

variable "db_storage_type" {
  description = "Storage type: gp3, io1, io2, standard"
  type        = string
  default     = "gp3"
}

variable "db_iops" {
  description = "Provisioned IOPS (0 for gp3 default which provides 3000 IOPS)"
  type        = number
  default     = 0  # gp3 default: 3000 IOPS
}

variable "db_storage_throughput" {
  description = "Storage throughput in MB/s (gp3 only, 0 for default which is 125 MB/s)"
  type        = number
  default     = 0  # gp3 default: 125 MB/s
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "16.6"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "toroloom"
}

variable "db_username" {
  description = "Master database username"
  type        = string
  default     = "toroloom"
  sensitive   = true
}

variable "db_password" {
  description = "Master database password (generate with: openssl rand -base64 16)"
  type        = string
  sensitive   = true
}

variable "db_port" {
  description = "Database port"
  type        = number
  default     = 5432
}

variable "db_parameter_group_family" {
  description = "PostgreSQL parameter group family"
  type        = string
  default     = "postgres16"
}

variable "statement_timeout" {
  description = "Query timeout in milliseconds (0 to disable)"
  type        = number
  default     = 30000  # 30 seconds
}

# ── High Availability ────────────────────────────────────────────────────────

variable "multi_az" {
  description = "Enable Multi-AZ deployment for high availability"
  type        = bool
  default     = false  # Start with single-AZ for cost; enable when scaling
}

variable "backup_retention_period" {
  description = "Days to retain automated backups (0 to disable)"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Daily backup window (UTC). Must not overlap with maintenance_window."
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Weekly maintenance window (UTC). Must not overlap with backup_window."
  type        = string
  default     = "sun:05:00-sun:06:00"
}

variable "deletion_protection" {
  description = "Enable deletion protection to prevent accidental RDS deletion"
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot when destroying RDS (set to true for dev/staging only)"
  type        = bool
  default     = false
}

variable "final_snapshot_identifier" {
  description = "Name of the final snapshot before deletion (ignored if skip_final_snapshot is true)"
  type        = string
  default     = "toroloom-final-snapshot"
}

# ── Performance Insights ─────────────────────────────────────────────────────

variable "performance_insights_enabled" {
  description = "Enable Performance Insights"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "Performance Insights retention in days (7 = free tier, 731 = max)"
  type        = number
  default     = 7
}

# ── Monitoring ───────────────────────────────────────────────────────────────

variable "monitoring_interval" {
  description = "Enhanced Monitoring interval in seconds (0 to disable, 1, 5, 10, 15, 30, 60)"
  type        = number
  default     = 60
}

variable "create_cloudwatch_alarms" {
  description = "Create CloudWatch metric alarms for RDS monitoring"
  type        = bool
  default     = true
}

variable "alarm_cpu_threshold" {
  description = "CPU utilization alarm threshold (percentage)"
  type        = number
  default     = 80
}

variable "alarm_connections_threshold" {
  description = "Database connections alarm threshold (absolute count)"
  type        = number
  default     = 80
}

variable "alarm_free_storage_threshold" {
  description = "Free storage space alarm threshold in bytes (5 GB)"
  type        = number
  default     = 5_368_709_120  # 5 GB in bytes
}

variable "alarm_replica_lag_threshold" {
  description = "Replica lag alarm threshold in seconds"
  type        = number
  default     = 30
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarm notifications (empty = no notifications)"
  type        = string
  default     = ""
}

# ── Read Replica ─────────────────────────────────────────────────────────────

variable "create_read_replica" {
  description = "Create a read replica for analytics query offloading"
  type        = bool
  default     = false
}

variable "read_replica_instance_class" {
  description = "Read replica instance class (defaults to the same as primary)"
  type        = string
  default     = ""
}

variable "read_replica_allocated_storage" {
  description = "Read replica storage in GB (defaults to the same as primary)"
  type        = number
  default     = 0
}
