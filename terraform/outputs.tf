# ==============================================================================
# Toroloom — Terraform Outputs
# ==============================================================================
#
# After terraform apply, these values are displayed. Use them to configure
# the backend's DATABASE_URL and run the migration script.
# ==============================================================================

output "db_endpoint" {
  description = "RDS primary endpoint (host:port)"
  value       = "${aws_db_instance.primary.address}:${aws_db_instance.primary.port}"
}

output "db_host" {
  description = "RDS primary hostname"
  value       = aws_db_instance.primary.address
}

output "db_port" {
  description = "RDS port"
  value       = aws_db_instance.primary.port
}

output "db_name" {
  description = "Database name"
  value       = aws_db_instance.primary.db_name
}

output "db_username" {
  description = "Master database username"
  value       = aws_db_instance.primary.username
  sensitive   = true
}

output "db_password" {
  description = "Master database password (show with: terraform output -raw db_password)"
  value       = var.db_password
  sensitive   = true
}

output "database_url" {
  description = "Full DATABASE_URL for the backend (with sslmode=require)"
  value       = local.database_url
  sensitive   = true
}

output "database_url_reader" {
  description = "DATABASE_URL_READER for analytics offload (empty if no reader)"
  value       = local.reader_url
  sensitive   = true
}

output "db_instance_class" {
  description = "RDS instance class"
  value       = aws_db_instance.primary.instance_class
}

output "db_allocated_storage" {
  description = "Allocated storage in GB"
  value       = aws_db_instance.primary.allocated_storage
}

output "db_parameter_group" {
  description = "DB parameter group name"
  value       = aws_db_parameter_group.main.name
}

output "security_group_id" {
  description = "RDS security group ID"
  value       = aws_security_group.rds.id
}

output "read_replica_endpoint" {
  description = "Read replica endpoint (empty if not created)"
  value       = try("${aws_db_instance.replica[0].address}:${aws_db_instance.replica[0].port}", "")
}

# ── Migration helper ─────────────────────────────────────────────────────────
output "migration_command" {
  description = "Ready-to-use migration command (fill in the Railway source URL)"
  value       = <<-EOF
./scripts/migrate-to-rds.sh \
  --source="postgresql://YOUR_RAILWAY_USER:YOUR_RAILWAY_PASS@railway-host:5432/toroloom" \
  --target="${local.database_url}" \
  --apply
EOF
  sensitive = true
}

output "env_vars_for_railway" {
  description = "Environment variables to set on Railway backend (sensitive — contains passwords)"
  value       = <<-EOF
# Copy these to Railway Dashboard → Backend service → Variables
DATABASE_URL="${local.database_url}"
${var.create_read_replica ? "DATABASE_URL_READER=\"${local.reader_url}\"" : "# DATABASE_URL_READER=(optional)"}
STORAGE_BACKEND=postgres
EOF
  sensitive = true
}
