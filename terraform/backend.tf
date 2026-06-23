# ==============================================================================
# Toroloom — Terraform Remote State Backend
# ==============================================================================
#
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  ACTIVATE by running terraform init with a backend config override:     ║
# ║                                                                          ║
# ║    terraform init -backend-config=backend.hcl                            ║
# ║                                                                          ║
# ║  Or using individual overrides:                                          ║
# ║    terraform init                                                        ║
# ║      -backend-config="bucket=toroloom-terraform-state-production"        ║
# ║      -backend-config="key=rds/terraform.tfstate"                         ║
# ║      -backend-config="region=ap-south-1"                                 ║
# ║      -backend-config="dynamodb_table=toroloom-terraform-locks"           ║
# ║      -backend-config="encrypt=true"                                      ║
# ║                                                                          ║
# ║  First-time setup:                                                        ║
# ║    1. Run terraform/bootstrap/ to create S3 bucket + DynamoDB table      ║
# ║    2. cp backend.hcl.example backend.hcl  (edit values)                  ║
# ║    3. terraform init -backend-config=backend.hcl                         ║
# ║    4. terraform apply                                                    ║
# ╚══════════════════════════════════════════════════════════════════════════╝
# ==============================================================================

terraform {
  # The backend configuration itself is passed via -backend-config or
  # backend.hcl to keep it outside version control (bucket names and keys
  # are not sensitive, but the pattern allows different dev/team members
  # to use different backends without editing shared files).

  # backend "s3" {
  #   # ----- Set via backend.hcl or -backend-config flags -------------------
  #   # bucket         = "toroloom-terraform-state-production"
  #   # key            = "rds/terraform.tfstate"
  #   # region         = "ap-south-1"
  #   # dynamodb_table = "toroloom-terraform-locks"
  #   # encrypt        = true
  # }
}
