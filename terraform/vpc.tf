# ==============================================================================
# Toroloom — VPC Module
# ==============================================================================
#
# Creates a VPC with public and private subnets across 2 AZs.
# RDS is deployed in the private subnets. NAT Gateway enables outbound
# access from private subnets for software updates.
#
# When var.vpc_id is empty, this module creates everything from scratch.
# When var.vpc_id is set, all resources here are skipped (use existing VPC).
# ==============================================================================

locals {
  create_vpc = var.vpc_id == "" || var.vpc_id == null
  azs        = slice(data.aws_availability_zones.available.names, 0, 2)
}

data "aws_availability_zones" "available" {
  state = "available"
}

# ──── VPC ───────────────────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  count = local.create_vpc ? 1 : 0

  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

# ──── Public Subnets (for NAT Gateway + bastion) ────────────────────────────
resource "aws_subnet" "public" {
  count = local.create_vpc ? 2 : 0

  vpc_id            = aws_vpc.main[0].id
  cidr_block        = cidrsubnet("10.0.0.0/16", 8, count.index)
  availability_zone = local.azs[count.index]

  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-${local.azs[count.index]}"
    Tier = "public"
  }
}

# ──── Private Subnets (for RDS + backend) ───────────────────────────────────
resource "aws_subnet" "private" {
  count = local.create_vpc ? 2 : 0

  vpc_id            = aws_vpc.main[0].id
  cidr_block        = cidrsubnet("10.0.0.0/16", 8, count.index + 10)
  availability_zone = local.azs[count.index]

  tags = {
    Name = "${var.project_name}-private-${local.azs[count.index]}"
    Tier = "private"
  }
}

# ──── Internet Gateway ───────────────────────────────────────────────────────
resource "aws_internet_gateway" "main" {
  count = local.create_vpc ? 1 : 0

  vpc_id = aws_vpc.main[0].id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# ──── Route Tables ───────────────────────────────────────────────────────────

# Public route table — direct internet access (for bastion hosts if needed)
resource "aws_route_table" "public" {
  count = local.create_vpc ? 1 : 0

  vpc_id = aws_vpc.main[0].id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main[0].id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count = local.create_vpc ? 2 : 0

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public[0].id
}

# Private subnets: no NAT Gateway needed since:
# - RDS is accessed via its public endpoint during migration
# - The app runs on Railway (external to this VPC)
# - No backend compute is deployed in private subnets
# If you later deploy the app in this VPC, add a NAT Gateway via:
#   resource "aws_nat_gateway" and private route with nat_gateway_id

# ──── Outputs for referencing from main.tf ──────────────────────────────────
locals {
  resolved_vpc_id     = local.create_vpc ? aws_vpc.main[0].id : var.vpc_id
  resolved_subnet_ids = local.create_vpc ? aws_subnet.private[*].id : var.subnet_ids
}
