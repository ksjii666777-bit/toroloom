# ==============================================================================
# Toroloom — Terraform Provider Versions
# ==============================================================================
#
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  REMOTE STATE: See backend.tf and backend.hcl.example                  ║
# ║                                                                          ║
# ║  terraform init -backend-config=backend.hcl                              ║
# ╚══════════════════════════════════════════════════════════════════════════╝
#
# Usage:
#   terraform init          # Initialize providers
#   terraform plan          # Preview changes
#   terraform apply         # Provision RDS (takes 5-10 min)
#   terraform destroy       # Tear down (creates final snapshot first)
#
# First-time S3 backend setup:
#   1. cd terraform/bootstrap && terraform init && terraform apply
#   2. cd terraform && cp backend.hcl.example backend.hcl
#   3. terraform init -backend-config=backend.hcl
# ==============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
