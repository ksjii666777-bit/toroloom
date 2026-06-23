# ==============================================================================
# Toroloom — Terraform State Backend Bootstrap — Provider Versions
# ==============================================================================
#
# Pinned to match the parent module's AWS provider version to avoid
# unexpected provider upgrades when bootstrapping.
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
