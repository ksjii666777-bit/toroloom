# Toroloom — Terraform for AWS RDS PostgreSQL

This directory contains Terraform configuration to provision a production-grade
AWS RDS PostgreSQL instance for Toroloom, replacing the manual AWS Console steps
with repeatable infrastructure-as-code.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) ≥ 1.6.0
- [AWS CLI](https://aws.amazon.com/cli/) configured with appropriate credentials
- An existing **VPC** and **subnets** in your AWS account
- (If migrating from Railway) The Railway PostgreSQL `DATABASE_URL` handy

## Quick Start

### 1. Create `terraform.tfvars`

```hcl
# terraform.tfvars — fill in your values
aws_region = "ap-south-1"          # Mumbai — closest to India

vpc_id     = "vpc-xxxxxxxx"        # Your VPC ID
subnet_ids = ["subnet-xxxxx", "subnet-yyyyy"]  # At least 2 subnets

# Security groups allowed to connect to PostgreSQL
allowed_security_group_ids = [
  "sg-xxxxx",  # EKS node security group
]

# For migration window only — lock down after
# allowed_cidr_blocks = ["0.0.0.0/0"]

db_password = "your-strong-password-here"  # openssl rand -base64 16

# Optional: enable read replica
# create_read_replica = true
```

### 2. Deploy

```bash
# Initialize providers
terraform init

# Preview
terraform plan

# Provision RDS (takes 5-10 minutes)
terraform apply -auto-approve

# View outputs
terraform output
terraform output -raw database_url
```

### 3. Run Migration

```bash
# Use the migration command from terraform output
./scripts/migrate-to-rds.sh \
  --source="postgresql://railway-user:railway-pass@railway-host:5432/toroloom" \
  --target="$(terraform output -raw database_url)" \
  --apply
```

### 4. Configure Backend

Copy the `DATABASE_URL` from `terraform output -raw database_url` to your
Railway backend service's Variables, or use it directly in your K8s secrets:

```bash
kubectl create secret generic toroloom-secrets \
  --namespace toroloom \
  --from-literal=DATABASE_URL="$(terraform output -raw database_url)"
```

## Architecture

```
                    ┌──────────────────────┐
                    │   Security Group      │
                    │  (PostgreSQL :5432)   │
                    └──────┬───────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
  ┌─────▼──────┐    ┌─────▼──────┐    ┌─────▼──────┐
  │  EKS Nodes  │    │  Railway   │    │  Dev/admin  │
  │  (internal) │    │  (migrate) │    │  (migrate)  │
  └─────────────┘    └────────────┘    └────────────┘
                           │
                    ┌──────▼──────┐
                    │  RDS Primary│───▶ Read Replica (optional)
                    │  db.t4g     │     (analytics offload)
                    └─────────────┘
```

## Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `aws_region` | `ap-south-1` | AWS region |
| `vpc_id` | **(required)** | VPC ID |
| `subnet_ids` | **(required)** | Subnet IDs (≥ 2) |
| `db_instance_class` | `db.t4g.medium` | Instance class |
| `db_allocated_storage` | `100` | Storage in GB |
| `db_engine_version` | `16.6` | PostgreSQL version |
| `db_password` | **(required)** | Master password |
| `multi_az` | `false` | Enable Multi-AZ |
| `backup_retention_period` | `7` | Backup retention in days |
| `deletion_protection` | `true` | Prevent accidental deletion |
| `performance_insights_enabled` | `true` | Enable Performance Insights |
| `create_read_replica` | `false` | Create read replica |
| `create_cloudwatch_alarms` | `true` | Create monitoring alarms |
| `alarm_cpu_threshold` | `80` | CPU alarm threshold (%) |
| `alarm_connections_threshold` | `80` | Connections alarm threshold |

See [variables.tf](./variables.tf) for the full list with descriptions.

## Outputs

| Output | Description |
|--------|-------------|
| `database_url` | Full DATABASE_URL for the backend (sensitive) |
| `database_url_reader` | Read replica URL if created (sensitive) |
| `db_endpoint` | RDS host:port |
| `migration_command` | Ready-to-use migration script command |
| `env_vars_for_railway` | Environment variables to copy to Railway |

## CloudWatch Alarms

The following metric alarms are created (when `create_cloudwatch_alarms = true`):

| Alarm | Metric | Threshold |
|-------|--------|-----------|
| CPU high | `CPUUtilization` | > 80% for 10 min |
| Connections high | `DatabaseConnections` | > 80 for 10 min |
| Storage low | `FreeStorageSpace` | < 5 GB |
| Replica lag | `ReplicaLag` | > 30s (read replica only) |

Set `sns_topic_arn` to get notified via email/Slack/PagerDuty.

## Cleanup

```bash
# Destroy all resources (creates final snapshot first)
terraform destroy

# To destroy without a final snapshot (dev/staging only):
terraform destroy -var="skip_final_snapshot=true" -var="deletion_protection=false"
```

## Remote State (Team Use)

For team deployments, store state in S3 with DynamoDB locking:

```hcl
# terraform/versions.tf — uncomment the backend block
backend "s3" {
  bucket         = "toroloom-terraform-state"
  key            = "rds/terraform.tfstate"
  region         = "ap-south-1"
  encrypt        = true
  dynamodb_table = "toroloom-terraform-locks"
}
```

Create the state bucket and lock table once:

```bash
aws s3 mb s3://toroloom-terraform-state --region ap-south-1
aws dynamodb create-table \
  --table-name toroloom-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1
```
