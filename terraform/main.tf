# ==============================================================================
# Toroloom — AWS RDS PostgreSQL (Terraform)
# ==============================================================================
#
# Provisions a production-grade PostgreSQL instance with:
#   - Custom parameter group (statement_timeout = 30s)
#   - Security group (PostgreSQL access from specified sources)
#   - DB subnet group (for Multi-AZ readiness)
#   - Automated backups (7-day retention)
#   - Performance Insights (free tier: 7-day retention)
#   - Enhanced Monitoring (60s granularity)
#   - CloudWatch metric alarms (CPU, connections, storage, replica lag)
#   - Optional read replica for analytics offload
#   - Deletion protection enabled by default
#
# Usage:
#   terraform init
#   terraform plan
#   terraform apply
#
# After provisioning, run the migration script:
#   ./scripts/migrate-to-rds.sh --source="$RAILWAY_URL" --target="$DATABASE_URL" --apply
# ==============================================================================

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = var.tags
  }
}

locals {
  name_prefix         = "${var.project_name}-${var.environment}"
  db_identifier       = "${var.project_name}-db"
  reader_identifier   = "${var.project_name}-db-reader"
  subnet_group_name   = "${local.name_prefix}-subnet-group"
  param_group_name    = "${local.name_prefix}-pg16"
  security_group_name = "${local.name_prefix}-rds-sg"

  # Construct the DATABASE_URL for the app (with SSL enforcement)
  ssl_param = "sslmode=require"

  database_url = "postgresql://${var.db_username}:${urlencode(var.db_password)}@${aws_db_instance.primary.address}:${var.db_port}/${var.db_name}?${local.ssl_param}"

  reader_url = var.create_read_replica ? try(
    "postgresql://${var.db_username}:${urlencode(var.db_password)}@${aws_db_instance.replica[0].address}:${var.db_port}/${var.db_name}?${local.ssl_param}",
    ""
  ) : ""

  # Default read replica values
  reader_class   = var.read_replica_instance_class != "" ? var.read_replica_instance_class : var.db_instance_class
  reader_storage = var.read_replica_allocated_storage > 0 ? var.read_replica_allocated_storage : var.db_allocated_storage
}

# ──── DB Parameter Group ────────────────────────────────────────────────────
resource "aws_db_parameter_group" "main" {
  name        = local.param_group_name
  family      = var.db_parameter_group_family
  description = "Toroloom PostgreSQL ${var.db_engine_version} parameters"

  parameter {
    name         = "statement_timeout"
    value        = var.statement_timeout
    apply_method = "immediate"
  }

  parameter {
    name         = "log_min_duration_statement"
    value        = "1000"
    apply_method = "immediate"
  }

  parameter {
    name         = "log_connections"
    value        = "1"
    apply_method = "immediate"
  }

  parameter {
    name         = "log_disconnections"
    value        = "1"
    apply_method = "immediate"
  }
}

# ──── DB Subnet Group ───────────────────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name        = local.subnet_group_name
  subnet_ids  = local.resolved_subnet_ids
  description = "Toroloom DB subnet group"
}

# ──── Security Group ────────────────────────────────────────────────────────
resource "aws_security_group" "rds" {
  name        = local.security_group_name
  description = "Toroloom RDS PostgreSQL access"
  vpc_id      = local.resolved_vpc_id

  tags = {
    Name = local.security_group_name
  }
}

# Allow PostgreSQL from specified security groups (e.g., EKS nodes)
resource "aws_security_group_rule" "ingress_sg" {
  count                    = length(var.allowed_security_group_ids)
  type                     = "ingress"
  from_port                = var.db_port
  to_port                  = var.db_port
  protocol                 = "tcp"
  source_security_group_id = var.allowed_security_group_ids[count.index]
  security_group_id        = aws_security_group.rds.id
  description              = "PostgreSQL from security group ${var.allowed_security_group_ids[count.index]}"
}

# Allow PostgreSQL from specified CIDR blocks (for migration window)
resource "aws_security_group_rule" "ingress_cidr" {
  count             = length(var.allowed_cidr_blocks)
  type              = "ingress"
  from_port         = var.db_port
  to_port           = var.db_port
  protocol          = "tcp"
  cidr_blocks       = [var.allowed_cidr_blocks[count.index]]
  security_group_id = aws_security_group.rds.id
  description       = "PostgreSQL from CIDR ${var.allowed_cidr_blocks[count.index]}"
}

# ──── Primary RDS Instance ──────────────────────────────────────────────────
resource "aws_db_instance" "primary" {
  identifier = local.db_identifier
  db_name    = var.db_name

  engine               = "postgres"
  engine_version       = var.db_engine_version
  parameter_group_name = aws_db_parameter_group.main.name

  instance_class         = var.db_instance_class
  multi_az               = var.multi_az
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = var.db_storage_type
  iops                  = var.db_iops > 0 ? var.db_iops : null
  storage_throughput    = var.db_storage_throughput > 0 ? var.db_storage_throughput : null

  username = var.db_username
  password = var.db_password
  port     = var.db_port

  backup_retention_period = var.backup_retention_period
  backup_window           = var.backup_window
  maintenance_window      = var.maintenance_window

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : var.final_snapshot_identifier

  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_retention_period

  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.monitoring_interval > 0 ? aws_iam_role.rds_monitoring[0].arn : null

  storage_encrypted         = true
  publicly_accessible       = length(var.allowed_cidr_blocks) > 0
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot     = true

  tags = {
    Name = local.db_identifier
  }

  lifecycle {
    ignore_changes = [
      password,
    ]
  }
}

# ──── IAM Role for Enhanced Monitoring ──────────────────────────────────────
resource "aws_iam_role" "rds_monitoring" {
  count = var.monitoring_interval > 0 ? 1 : 0
  name  = "${local.name_prefix}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  managed_policy_arns = [
    "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
  ]

  tags = {
    Name = "${local.name_prefix}-rds-monitoring"
  }
}

# ──── Read Replica (optional) ──────────────────────────────────────────────
resource "aws_db_instance" "replica" {
  count = var.create_read_replica ? 1 : 0

  identifier          = local.reader_identifier
  replicate_source_db = aws_db_instance.primary.identifier

  instance_class         = local.reader_class
  allocated_storage      = local.reader_storage
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 0
  backup_window           = null
  maintenance_window      = null

  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_retention_period

  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.monitoring_interval > 0 ? aws_iam_role.rds_monitoring[0].arn : null

  deletion_protection   = var.deletion_protection
  skip_final_snapshot   = true
  copy_tags_to_snapshot = true

  tags = {
    Name = local.reader_identifier
    Role = "read-replica"
  }
}

# ──── CloudWatch Metric Alarms ──────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "cpu" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${local.db_identifier}-cpu-high"
  alarm_description   = "RDS CPU utilization exceeds ${var.alarm_cpu_threshold}%"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.alarm_cpu_threshold
  evaluation_periods  = 2
  period              = 300
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.primary.id
  }

  alarm_actions = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []
  ok_actions    = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []
}

resource "aws_cloudwatch_metric_alarm" "connections" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${local.db_identifier}-connections-high"
  alarm_description   = "RDS database connections exceed ${var.alarm_connections_threshold}"
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  statistic           = "Average"
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.alarm_connections_threshold
  evaluation_periods  = 2
  period              = 300
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.primary.id
  }

  alarm_actions = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []
  ok_actions    = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []
}

resource "aws_cloudwatch_metric_alarm" "free_storage" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${local.db_identifier}-storage-low"
  alarm_description   = "RDS free storage space below threshold"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Average"
  comparison_operator = "LessThanThreshold"
  threshold           = var.alarm_free_storage_threshold
  evaluation_periods  = 1
  period              = 600
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.primary.id
  }

  alarm_actions = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []
  ok_actions    = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []
}

resource "aws_cloudwatch_metric_alarm" "replica_lag" {
  count = var.create_cloudwatch_alarms && var.create_read_replica ? 1 : 0

  alarm_name          = "${local.db_identifier}-replica-lag"
  alarm_description   = "RDS read replica lag exceeds ${var.alarm_replica_lag_threshold}s"
  namespace           = "AWS/RDS"
  metric_name         = "ReplicaLag"
  statistic           = "Average"
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.alarm_replica_lag_threshold
  evaluation_periods  = 2
  period              = 300
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = try(aws_db_instance.replica[0].id, "")
  }

  alarm_actions = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []
  ok_actions    = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []
}
