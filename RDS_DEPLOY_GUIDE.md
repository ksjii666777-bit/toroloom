# 🚀 Toroloom — RDS PostgreSQL Deployment Guide

> **Buyer ke liye simple guide:** Is guide mein aap sikhenge ki kaise Toroloom ke backend ko Railway se AWS RDS PostgreSQL par migrate karna hai.

---

> **Step 0 — Pehle repo clone karo (agar abhi nahi kiya):**
> ```bash
> git clone <repo-url> toroloom
> cd toroloom
> ```

## 📋 Prerequisites (पहले ये चीज़ें चाहिए)

| चीज़ | कहाँ से मिलेगा |
|------|---------------|
| **AWS Account** | [aws.amazon.com](https://aws.amazon.com) — Free Tier bhi chalega |
| **AWS CLI** | `aws configure` karke Access Key + Secret set karo |
| **Terraform** | `terraform --version` se check karo |
| **PostgreSQL Tools** | `pg_dump`, `pg_restore`, `psql` — yeh install hone chahiye |

### 🔧 Tools Install karo (ek baar mein)

**Windows (PowerShell as Admin):**
```powershell
# AWS CLI
winget install Amazon.AWSCLI

# PostgreSQL tools (pg_dump, psql)
winget install PostgreSQL.PostgreSQL16
```

**macOS:**
```bash
brew install awscli terraform postgresql-client
```

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install awscli postgresql-client-16
# Terraform: https://developer.hashicorp.com/terraform/downloads
```

---

## 🪜 Step-by-Step Guide

### Step 1: AWS Credentials Set karo

AWS Console se Access Key banao:
1. [AWS Console](https://console.aws.amazon.com) → IAM → Users → **Create user**
2. User ko `AmazonRDSFullAccess` + `AmazonVPCFullAccess` permission do
3. **Security credentials** → Create access key
4. Copy **Access Key ID** aur **Secret Access Key**

Ab CLI mein set karo:
```bash
aws configure
# Enter:
#   AWS Access Key ID: [paste karo]
#   AWS Secret Access Key: [paste karo]
#   Default region: ap-south-1 (Mumbai — India ke liye best)
#   Default output format: json
```

Verify karo:
```bash
aws sts get-caller-identity
# Output aana chahiye — Account ID, User ID, ARN
```

---

### Step 2: RDS Password Generate karo

```bash
openssl rand -base64 16
```
Yeh 16 character ka strong password degi. Copy karke rakh lo.

---

### Step 3: Terraform se RDS Provision karo

Toroloom ke saath Terraform code already aata hai. Yeh RDS, VPC, Security Group sab automatically create karega.

```bash
# 1. Project folder mein jao
cd toroloom

# 2. Terraform variables file copy karo
cp terraform/terraform.tfvars.example terraform/terraform.tfvars

# 3. terraform.tfvars edit karo (Notepad ya VS Code mein)
```

`terraform.tfvars` mein yeh fill karo:

```hcl
# Sabse zaroori — strong password (Step 2 se copy karo)
db_password = "aB3$xR9#mP2$vK7!"    # ← apna password yahan paste karo

# Region — India ke liye ap-south-1 (Mumbai)
aws_region = "ap-south-1"

# Database size (production ke liye)
db_instance_class    = "db.t4g.medium"     # 2 CPU, 4GB RAM (~$60/mo)
db_allocated_storage = 100                  # 100 GB storage (~$12/mo)
```

> ⚠️ **Security Note:** `terraform.tfvars` mein aapka DB password plaintext mein save hota hai.
> Yeh file pehle se `.gitignore` mein hai, isliye commit nahi hogi. Phir bhi dhyaan rakhna.
>
> ⚠️ **Baaki sab default pe chhod do** — Terraform apne aap VPC, subnet, security group sab bana lega.

Ab deploy karo:

```bash
# 4. Terraform initialize
cd terraform
terraform init

# 5. Preview — kya bane ga dikhata hai
terraform plan

# 6. Apply — asli RDS banega (5-10 min lagte hain)
terraform apply -auto-approve
```

**✅ RDS ready hone ke baad, yeh output milega:**

```
Outputs:
database_url = "postgresql://toroloom:password@toroloom-db.xxxxxx.ap-south-1.rds.amazonaws.com:5432/toroloom?sslmode=require"
db_endpoint = "toroloom-db.xxxxxx.ap-south-1.rds.amazonaws.com:5432"
```

**database_url** copy karo — yeh next step mein chahiye.

---

### Step 4: Data Migrate karo (Railway PG → RDS)

Ab jo data Railway PostgreSQL mein hai, use RDS mein copy karo.

**Railway se DATABASE_URL nikaalo:**
1. [Railway Dashboard](https://railway.app/dashboard) mein jao
2. PostgreSQL service → **Variables** tab
3. `DATABASE_URL` copy karo (woh `postgresql://` se start hota hai)

**Migration script chalao:**

> **Simple tarika (interactive mode):** Sirf script chalao, URLs manually enter karo:
> ```bash
> ./scripts/migrate-to-rds.sh
> # Script poochhegi — pehle SOURCE URL (Railway), phir TARGET URL (RDS)
> ```

**Ya phir ek line mein (advanced):**

```bash
# Pehle dry run karo (sirf check karega, actual copy nahi karega)
./scripts/migrate-to-rds.sh \
  --source="postgresql://railway-user:railway-pass@railway-host:5432/toroloom" \
  --target="postgresql://toroloom:password@toroloom-db.xxxxxx.ap-south-1.rds.amazonaws.com:5432/toroloom?sslmode=require"

# Output dekho — connections validate hue? tables dikhe?
# Agar sab sahi hai, to --apply ke saath run karo:
./scripts/migrate-to-rds.sh \
  --source="postgresql://railway-user:railway-pass@railway-host:5432/toroloom" \
  --target="postgresql://toroloom:password@toroloom-db.xxxxxx.ap-south-1.rds.amazonaws.com:5432/toroloom?sslmode=require" \
  --apply
```

**Script kya karega:**
1. ✅ Dono DB connections check karega
2. 📊 Source DB ka audit karega (kitni tables, kitna data)
3. 💾 Railway PG ka dump lega
4. 📤 RDS par restore karega
5. ✅ Row counts match karega (data sahi aaya ya nahi)

---

### Step 5: Backend ko RDS se Connect karo

Railway backend mein `DATABASE_URL` update karo:

1. [Railway Dashboard](https://railway.app/dashboard) → Backend service
2. **Variables** tab → `DATABASE_URL` edit karo
3. Naya RDS `DATABASE_URL` paste karo (jo Step 3 mein mila tha)
4. `STORAGE_BACKEND = postgres` set karo
5. Railway auto-redeploy karega ✅

**Verify karo:**
```bash
curl https://your-service.up.railway.app/health
```
Expected:
```json
{"status":"ok","storageBackend":"postgres","storageHealthy":true}
```

---

### Step 6: Security Lock Down 🔒

Migration ke baad, RDS ko public access se bachao:

```bash
# Terraform se CIDR block hatao — sirf specific IPs allow karo
cd terraform
```

`terraform.tfvars` mein `allowed_cidr_blocks` ko hatao/specific IP daalo:

```hcl
allowed_cidr_blocks = [
  "YOUR_STATIC_IP/32"  # Sirf apne server ka IP
]
# Ya khaali chhodo:
# allowed_cidr_blocks = []
```

```bash
terraform apply -auto-approve
```

---

### Step 7: Rollback Plan (अगर कुछ गलत हो जाए)

Koi issue aaye to wapas Railway PG par ja sakte ho:

```bash
# 1. Railway Dashboard → Backend → Variables
# 2. DATABASE_URL wapas purani Railway PG URL daal do
# 3. Railway redeploy ho jayega
# 4. RDS issue fix karo, phir se migration chalao
```

> ⚠️ **Railway PG ko 48 hours mat hatao** — rollback window ke liye.

---

## 📊 Cost Estimate (Monthly)

| Resource | Cost (aprox) |
|----------|-------------|
| RDS db.t4g.medium (2 CPU, 4GB RAM) | ~$60/mo |
| Storage 100GB gp3 | ~$12/mo |
| Automated backups | ~$2/mo |
| **Total** | **~$74/mo** |

> **Free Tier mein:** `db.t4g.micro` use karo (1 CPU, 1GB RAM, 20GB storage — free for 12 months)

---

## 🛠 Quick Commands Reference

| Kaam | Command |
|------|---------|
| RDS banayein | `cd terraform && terraform apply -auto-approve` |
| RDS delete karein | `cd terraform && terraform destroy` |
| DATABASE_URL dekhein | `cd terraform && terraform output -raw database_url` |
| Migration chalao | `./scripts/migrate-to-rds.sh --source="SRC_URL" --target="DST_URL" --apply` |
| Railway PG dump lo | `pg_dump "$RAILWAY_URL" --format=custom -f backup.dump` |
| RDS par restore | `pg_restore --dbname="$RDS_URL" backup.dump` |

---

## 🆘 Help / Issues

| Problem | Solution |
|---------|----------|
| `terraform init` fail | Check: `aws configure` kiya? |
| RDS create ho raha hai 10+ min | Normal hai — RDS banne mein 5-10 min lagte hain |
| Connection timeout | Security group mein `0.0.0.0/0` allow karo (temporary) |
| `pg_dump` not found | PostgreSQL client tools install karo |
| Railway redeploy fail | `STORAGE_BACKEND=postgres` set hai? `DATABASE_URL` sahi hai? |

---

> 💡 **Zero-downtime migration:** Production mein ho to pehle Railway PG par traffic serve karte raho. RDS ready hone par DATABASE_URL flip karo. 48 hours tak Railway PG rakho — koi issue aaye to wapas switch kar sakte ho.
