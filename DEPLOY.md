# Toroloom Backend — Production Deployment Guide

## Architecture

```
                         ┌──────────────────────┐
                         │    Reverse Proxy      │
                         │  (nginx / Caddy /     │
                         │   Cloudflare Tunnel)  │
                         │  TLS termination      │
                         └──────┬───────────────┘
                                │
                    ┌───────────┴───────────┐
                    │   :3000 /api + /ws    │
                    ▼                       ▼
            ┌──────────────┐     ┌──────────────────┐
            │   Backend    │◄───►│  Prometheus /     │
            │  (Node.js)   │     │  Grafana (opt.)   │
            └──────┬───────┘     └──────────────────┘
                   │
          ┌────────┴────────┐
          ▼                 ▼
    ┌──────────┐    ┌──────────┐
    │PostgreSQL│    │ MongoDB  │
    │ (opt.)   │    │ (opt.)   │
    └──────────┘    └──────────┘
```

## Quick Start (Docker Compose — Single Server)

### Prerequisites

- Docker Engine ≥ 24.x + Docker Compose v2
- Git (to clone the repo)
- (Optional) A domain with DNS pointing to your server for TLS

### 1. Clone and configure

```bash
git clone <your-repo-url> toroloom
cd toroloom

# Copy the example env and edit with secure values
cp .env.example .env
# Edit .env: at minimum set JWT_SECRET to a strong random value
```

### 2. Start production stack

```bash
docker compose -f docker-compose.prod.yml up -d
```

This starts:
- **backend** — the Node.js API + WebSocket server on port 3000
- **postgres** — PostgreSQL 16 (optional, only if `STORAGE_BACKEND=postgres`)
- **mongodb** — MongoDB 7 (optional, only if `STORAGE_BACKEND=mongodb`)

### 3. Verify health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "broker": "mock",
  "storageBackend": "memory",
  "storageHealthy": false,
  "uptime": 12.34
}
```

> `storageHealthy: false` is normal when `STORAGE_BACKEND=memory`. Switch to `postgres` or `mongodb` for persistence.

### 4. Check logs

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## Environment Configuration

Create a `.env` file in the project root with your settings:

```bash
# ── Required ─────────────────────────────────────────────────────
JWT_SECRET=your-strong-random-secret-here    # Generate: openssl rand -hex 32

# ── Storage (choose one) ─────────────────────────────────────────
STORAGE_BACKEND=postgres                      # memory | postgres | mongodb
DATABASE_URL=postgresql://toroloom:password@postgres:5432/toroloom

# ── Broker (optional, for live trading) ──────────────────────────
BROKER=mock                                   # mock | zerodha | angel
DATA_SOURCE=mock                              # mock | live
```

### Important
> **`JWT_SECRET`** must be a cryptographically random string.  
> Generate one: `openssl rand -hex 32` (64 chars) or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## Production Hardening

### Reverse Proxy (TLS Termination)

**Never expose the backend directly to the internet.** Use a reverse proxy for TLS, rate limiting, and DDoS protection.

#### Option A: Caddy (simplest, auto-TLS)

Create `Caddyfile`:
```
api.toroloom.dev {
    reverse_proxy backend:3000
    # WebSocket support (Caddy handles this automatically)
}
```

```bash
docker run -d --name caddy \
  -p 80:80 -p 443:443 \
  -v ./Caddyfile:/etc/caddy/Caddyfile \
  -v caddy_data:/data \
  caddy:2
```

Add `backend` to the same Docker network:
```yaml
# In docker-compose.prod.yml, add a network:
networks:
  default:
    name: toroloom-network

# Run Caddy on the same network:
# docker network connect toroloom-network caddy
```

#### Option B: nginx

```nginx
server {
    listen 443 ssl;
    server_name api.toroloom.dev;

    ssl_certificate /etc/letsencrypt/live/api.toroloom.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.toroloom.dev/privkey.pem;

    # REST API
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }

    # Health check (internal only)
    location /health {
        proxy_pass http://backend:3000;
    }
}
```

#### Option C: Cloudflare Tunnel (no open ports)

```bash
# Install cloudflared and authenticate
docker run -d --name cloudflare-tunnel \
  cloudflare/cloudflared tunnel --no-autoupdate run --token YOUR_TUNNEL_TOKEN
```

### Secrets Management

**Never commit secrets to Git.** Use one of these approaches:

1. **`.env` file** (simplest for single-server):
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env up -d
   ```

2. **Docker secrets** (Swarm):
   ```yaml
   secrets:
     jwt_secret:
       file: ./secrets/jwt_secret.txt
   ```

3. **External vault** (HashiCorp Vault, AWS Secrets Manager):
   - Inject via environment variables at container startup
   - The app reads from `process.env` at boot time (no hot-reload of secrets)

### Resource Limits

Uncomment and adjust the `deploy.resources.limits` section in `docker-compose.prod.yml`:

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '1'
        memory: 512M
```

### Graceful Shutdown

The backend handles `SIGTERM` and `SIGINT`:
1. Closes the WebSocket server (drains active connections)
2. Disconnects from storage (flushes pending writes)
3. Closes the HTTP server
4. Exits with code 0

Docker Compose sends `SIGTERM` on `docker compose down` or `docker stop`.

---

## Building the Image Manually

```bash
# Build
docker build -t toroloom-backend:latest -f backend/Dockerfile backend/

# Tag for your registry
docker tag toroloom-backend:latest ghcr.io/your-org/toroloom-backend:latest

# Push
docker push ghcr.io/your-org/toroloom-backend:latest
```

### Registry Options

| Registry | Example Tag |
|----------|-------------|
| GitHub Container Registry | `ghcr.io/your-org/toroloom-backend:latest` |
| Docker Hub | `your-user/toroloom-backend:latest` |
| AWS ECR | `123456789012.dkr.ecr.us-east-1.amazonaws.com/toroloom-backend:latest` |
| Google Artifact Registry | `us-east1-docker.pkg.dev/your-project/toroloom/toroloom-backend:latest` |

---

## Deployment to a VPS (Manual)

```bash
# 1. SSH in
ssh user@your-server

# 2. Install Docker
curl -fsSL https://get.docker.com | sh

# 3. Clone the repo
git clone <your-repo-url> toroloom
cd toroloom

# 4. Configure environment
cp .env.example .env
nano .env  # Set JWT_SECRET and other values

# 5. Start
docker compose -f docker-compose.prod.yml up -d

# 6. Verify
curl http://localhost:3000/health

# 7. Set up a reverse proxy (see "Reverse Proxy" section above)
```

---

## Deployment to a Container Orchestrator

### Kubernetes (K8s) — Minimal Manifest

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: toroloom-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: toroloom-backend
  template:
    metadata:
      labels:
        app: toroloom-backend
    spec:
      containers:
      - name: backend
        image: ghcr.io/your-org/toroloom-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: toroloom-secrets
              key: jwt_secret
        - name: STORAGE_BACKEND
          value: "postgres"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: toroloom-secrets
              key: database_url
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 15
          periodSeconds: 15
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: toroloom-backend
spec:
  selector:
    app: toroloom-backend
  ports:
  - port: 3000
    targetPort: 3000
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: toroloom-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.toroloom.dev
    secretName: toroloom-tls
  rules:
  - host: api.toroloom.dev
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: toroloom-backend
            port:
              number: 3000
      - path: /ws
        pathType: Prefix
        backend:
          service:
            name: toroloom-backend
            port:
              number: 3000
```

### Platform-Specific Guides

| Platform | Guide |
|----------|-------|
| Railway | See detailed guide below |
| Render | Create a "Web Service" pointing to `backend/`. Build command: `npm ci && npm run build`. Start command: `node dist/index.js` |
| Fly.io | `fly launch` from `backend/`. Auto-detects Node. Set secrets with `fly secrets set JWT_SECRET=...` |
| AWS ECS | Push image to ECR. Create task definition with env vars. Use ALB for TLS termination |

---

## Railway Deployment

Railway is the recommended PaaS for Toroloom. It supports Dockerfile-based deployments, WebSockets, and provides a managed PostgreSQL service.

> **Prerequisites:** A [Railway account](https://railway.app/) connected to your GitHub account.

### Step 1: Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard) → **+ New Project**
2. Select **Deploy from GitHub repo** → Choose `ksjii666777-bit/toroloom`
3. Railway will auto-detect the repo and attempt to build from the root — the first build will fail (expected, since the Dockerfile is in `backend/`)

### Step 2: Configure Root Directory

1. Click the newly created service → **Settings** tab
2. Find **Root Directory** → Change from `/` to `/backend`
3. Railway will **automatically trigger a new deployment**
4. The build uses the Dockerfile at `backend/Dockerfile` (also configured in `railway.json`)

### Step 3: Set Environment Variables

Go to the service's **Variables** tab and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `JWT_SECRET` | (generate: `openssl rand -hex 32`) | **Required** — sign auth tokens |
| `NODE_ENV` | `production` | Production mode |
| `BROKER` | `mock` | Change to `angel` when ready |
| `DATA_SOURCE` | `mock` | Change to `live` for real data |
| `STORAGE_BACKEND` | `memory` | `memory` works without any database |
| `CLUSTER_MODE` | `0` | Single-process (Railway handles scaling) |

> Railway provides the `PORT` variable automatically — the backend reads it via `process.env.PORT`.

### Step 4: Verify Deployment

1. Wait for the build to complete (green checkmark)
2. Railway assigns a `.railway.app` domain automatically
3. Test the health endpoint:
   ```bash
   curl https://your-service.up.railway.app/health
   ```
   Expected:
   ```json
   {"status":"ok","broker":"mock","storageBackend":"memory","storageHealthy":true,"uptime":...}
   ```

### Step 5 (Optional): Add PostgreSQL

1. Click **+ New** in your Railway project → **Database** → **PostgreSQL**
2. Railway creates a PostgreSQL service and auto-injects `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` into your backend service
3. Update your backend's `STORAGE_BACKEND` variable to `postgres`
4. Railway will redeploy automatically — tables are created on first startup via auto-migration

### Auto-Deploy from Git

Railway connects to your GitHub repo and auto-deploys on every push to `master`:
1. Push code → Railway detects the push → builds Docker image → deploys
2. Check deployment status in Railway dashboard (live logs available)
3. No CI pipeline needed — Railway handles build + deploy

### Troubleshooting Railway

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `ERR_CONNECTION_REFUSED` | App not listening on Railway's PORT | Verify `PORT` env var is read in `env.ts` (it is: `process.env.PORT || '3000'`) |
| Build fails: `Dockerfile not found` | Root Directory not set | Update service Settings → Root Directory to `/backend` |
| WebSocket disconnects | Railway idle timeout | Railway's free tier has a timeout. Upgrade or use a keepalive. |
| App crashes with exit code 137 | Out of memory | Upgrade to a paid plan or add swap ([docs](https://docs.railway.com/deployments/swap)) |
| `401` on API calls | JWT_SECRET mismatch | Verify the Railway `JWT_SECRET` matches the frontend's config

### Step 6 (Optional): Add PgBouncer Connection Pooling

PgBouncer sits between the backend and PostgreSQL, multiplexing many short-lived
connections into a smaller pool of persistent DB connections. This is critical
when using `STORAGE_BACKEND=postgres` with the Railway PostgreSQL plugin, because
Railway's free tier limits you to **10 concurrent connections** — and each
WebSocket user, AI analysis request, or analytics query opens a new pool slot.

> **Without PgBouncer:** 20 app connections → 20 direct DB connections (exhausts pool)
> **With PgBouncer:** 20 app connections → multiplexed into 5-10 actual DB connections

```
App ──▶ PgBouncer (port 6432, transaction mode) ──▶ Railway PostgreSQL (:5432, managed)
```

The backend's database provider (`database.provider.ts`) already has built-in
PgBouncer compatibility:
- `detectPgbouncerPort()` warns when connecting directly to port 5432 in production
- `getReader()` / `queryReader()` support read-replica offload (optional)
- Connection pool auto-sizing works with both pooled and direct connections

---

#### Option A: Host PgBouncer as a separate Railway Service

This is the recommended approach — PgBouncer runs in its own container on
Railway's network, and the backend connects to it via an internal URL.

**Step 1 — Add a PgBouncer service to your Railway project:**

Use Railway's **Deploy from Docker image** feature — no repo files needed:

1. In Railway Dashboard, click **+ New** → **Empty Service** → name it `pgbouncer`
2. Click **Deploy from Docker image** → enter `bitnami/pgbouncer:1.23`
3. Railway pulls the image and creates the service

> **Important:** Enable **Private Networking** in Railway project settings
> (Project Settings → Networking → Private Networking → Enable).
> Without this, services cannot resolve each other by name and
> `pgbouncer:6432` from the backend will fail to connect.

**Step 2 — Set environment variables on the PgBouncer service:**

Railway's PostgreSQL plugin injects `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` into the
**backend** service, but not into the PgBouncer service. You must copy the values
manually from the Railway dashboard (PostgreSQL service → Variables tab):

| Variable | Value | Notes |
|----------|-------|-------|
| `PGBOUNCER_PORT` | `6432` | Listen port |
| `PGBOUNCER_DATABASE` | `*` | Accept all DB names |
| `POSTGRESQL_HOST` | (Railway PG `PGHOST` value) | Copy from Railway PostgreSQL variables |
| `POSTGRESQL_PORT` | `5432` | Standard PostgreSQL port |
| `POSTGRESQL_USERNAME` | (Railway PG `PGUSER` value) | Copy from Railway variables |
| `POSTGRESQL_PASSWORD` | (Railway PG `PGPASSWORD` value) | Copy from Railway variables |
| `POSTGRESQL_DATABASE` | `toroloom` or Railway PG DB name | |
| `PGBOUNCER_POOL_MODE` | `transaction` | **Required** — safe for REST + WebSocket |
| `PGBOUNCER_DEFAULT_POOL_SIZE` | `20` | Matches PostgreSQL's max_connections |
| `PGBOUNCER_MAX_CLIENT_CONN` | `200` | How many app connections to accept |
| `PGBOUNCER_CLIENT_IDLE_TIMEOUT` | `120` | Close idle client connections after 2 min |
| `PGBOUNCER_QUERY_TIMEOUT` | `30` | Cancel queries running longer than 30s |
| `PGBOUNCER_AUTH_TYPE` | `scram-sha-256` | Use SCRAM (not `trust`) in production |

**Step 3 — Update the backend's `DATABASE_URL`:**

Go to your backend service → **Variables** → change:

```
# BEFORE (direct to Railway PG):
DATABASE_URL=postgresql://user:pass@railway-pg-host:5432/toroloom

# AFTER (through PgBouncer):
DATABASE_URL=postgresql://user:pass@pgbouncer:6432/toroloom
```

The internal Railway DNS (`pgbouncer`) resolves to the PgBouncer service container.

**Step 4 — Verify:**

```bash
# Check deployment logs — should show PgBouncer connecting
# Railway will auto-inject the internal hostname into both services
```

---

#### Option B: Railway PostgreSQL Plugin with Native Pooling

If running a separate PgBouncer container is too much overhead, you can keep
the backend's pool size small to stay within Railway's free-tier limits.
The Pool configuration is in `backend/src/lib/database.provider.ts` —
`initializePool()` creates a `pg.Pool` with default max=20. Edit that file
to reduce the max to 5:

```typescript
const pool = new Pool({
  connectionString: url,
  max: 5,                // Was 20 — keep within Railway's 10-connection limit
  idleTimeoutMillis: 10_000,  // Return idle connections after 10s
  connectionTimeoutMillis: 5_000, // Fail fast if DB is unreachable
});
```

Then:
1. **Add Railway PostgreSQL** via **+ New** → **Database** → **PostgreSQL**
2. Railway auto-injects `DATABASE_URL` into the backend
3. Set `STORAGE_BACKEND=postgres` on the backend service

> **Trade-off:** Without PgBouncer, every pool slot is a real DB connection.
> With 5 slots and 200 concurrent app requests, requests queue up waiting
> for a free slot. This is acceptable for low-traffic deployments (< 50
> concurrent users). Beyond that, use Option A.

> **Future:** The `database.provider.ts` can be extended to read `PG_MAX_POOL_SIZE`
> from environment variables. Track this in the SCALING_BLUEPRINT.md.

---

#### Option C: Railway + External RDS with PgBouncer

For production-scale deployments (see SCALING_BLUEPRINT.md Phase 1):

1. **Provision RDS** (or any managed PostgreSQL)
2. **Deploy PgBouncer** on Railway (Option A above) pointing to RDS instead of Railway PG
3. **Set backend env vars:**

```bash
DATABASE_URL=postgresql://toroloom:password@pgbouncer:6432/toroloom
# DATABASE_URL_READER=postgresql://toroloom:password@reader-endpoint:6432/toroloom  # optional
```

This gives you the Railway deployment experience (auto-build, auto-deploy,
logging) with the production-grade database reliability of AWS RDS.

---

#### Config Reference

The full PgBouncer configuration is maintained at:

| File | Purpose |
|------|---------|
| `backend/pgbouncer/pgbouncer.ini` | Connection pool, timeouts, auth mode |
| `backend/pgbouncer/userlist.txt` | User authentication entries (for `md5`/`scram` auth) |
| `docker-compose.yml` | Dev: PgBouncer via Bitnami env vars |
| `docker-compose.prod.yml` | Prod: PgBouncer with resource limits + health checks |

Key settings for Railway:

```ini
# backend/pgbouncer/pgbouncer.ini
[pgbouncer]
pool_mode = transaction          # Must be 'transaction' for REST+WS workloads
listen_port = 6432
default_pool_size = 20           # Matches Railway PG's max_connections
max_client_conn = 200            # Number of app connections to pool
reserve_pool_size = 5            # Extra slots for admin/health queries
reserve_pool_timeout = 5         # Seconds before reserve pool activates
query_timeout = 30               # Kill runaway queries after 30s
client_idle_timeout = 120        # Reclaim idle client connections after 2 min
server_idle_timeout = 600        # Return server connections to pool after 10 min
auth_type = scram-sha-256        # Use SCRAM auth in production
```

> **Important:** On Railway, set `auth_type = scram-sha-256` (not `trust`)
> because Railway PostgreSQL requires password authentication.
> The `userlist.txt` must contain the user-password SCRAM hash.
> Generate one with:
> ```bash
> # Generate a SCRAM-SHA-256 hash for userlist.txt:
> echo -n "toroloom" | openssl dgst -sha256 -hmac "your_postgres_password"
> ```
> Then add to `userlist.txt`:
> ```
> "toroloom" "SCRAM-SHA-256$<hash>"
> ```

---

## RDS Provisioning & Migration

This section covers provisioning an AWS RDS PostgreSQL instance and migrating
data from Railway PostgreSQL to RDS with zero downtime.

### 1. Provision RDS via Terraform (preferred)

> **Prerequisites:** Terraform ≥ 1.6, AWS CLI configured, and PostgreSQL client tools
> (`pg_dump`, `pg_restore`, `psql`) installed on your machine.

The [`terraform/`](../terraform/) directory contains a complete Terraform module
that provisions everything you need — VPC, subnets, security group, RDS instance,
parameter group, enhanced monitoring, Performance Insights, and CloudWatch alarms.

```bash
# 1. Navigate to the terraform directory
cd terraform

# 2. Copy the example vars file and edit with your password
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — you only need to set db_password:
#   db_password = "$(openssl rand -base64 16)"
#
# vpc_id and subnet_ids are OPTIONAL — leave them commented out to
# auto-create a new VPC with public/private subnets.

# 3. Initialize Terraform
terraform init

# 4. Preview what will be created
terraform plan

# 5. Apply (takes 5-10 minutes)
terraform apply -auto-approve

# 6. Get the DATABASE_URL
terraform output -raw database_url
```

**What the Terraform module creates:**

| Resource | Details |
|----------|---------|
| VPC | New VPC (10.0.0.0/16) with public + private subnets across 2 AZs |
| Internet Gateway | For public subnet outbound access |
| Security Group | PostgreSQL port 5432 — allowlisted via `allowed_cidr_blocks` and `allowed_security_group_ids` |
| DB Subnet Group | Private subnets for Multi-AZ readiness |
| DB Parameter Group | `statement_timeout=30s`, slow query logging enabled |
| RDS Instance | `db.t4g.medium`, 100GB gp3, auto-scaling to 500GB |
| Automated Backups | 7-day retention, point-in-time recovery |
| Performance Insights | 7-day retention (free tier) |
| Enhanced Monitoring | 60s granularity |
| IAM Role | For Enhanced Monitoring (RDS pushes metrics to CloudWatch) |
| CloudWatch Alarms | CPU > 80%, connections > 80, storage < 5GB |
| Read Replica (opt.) | Optional read replica for analytics offload |

**Outputs after apply:**

| Output | Description |
|--------|-------------|
| `database_url` | Full DATABASE_URL with `?sslmode=require` (sensitive) |
| `database_url_reader` | Read replica URL (if created) |
| `db_endpoint` | RDS host:port |
| `migration_command` | Ready-to-use migration script command |
| `env_vars_for_railway` | Variables to copy to Railway Dashboard |

**Cost estimate (single-AZ):**

| Resource | Monthly Cost |
|----------|-------------|
| RDS db.t4g.medium | ~$60 |
| Storage 100GB gp3 | ~$12 |
| Backup storage | ~$2 |
| Performance Insights | Free (7-day retention) |
| **Total** | **~$74/month** |

> To use an existing VPC instead of auto-creating one, set `vpc_id` and
> `subnet_ids` in your `terraform.tfvars`. See [`terraform/README.md`](../terraform/README.md)
> for all available configuration options.

---

### Alternative: Provision RDS via AWS CLI

If you prefer not to use Terraform, you can provision RDS directly via the
AWS CLI. This requires a pre-existing VPC with subnets.

**Step 1 — Create a parameter group:**

```bash
aws rds create-db-parameter-group \
  --db-parameter-group-family postgres16 \
  --db-parameter-group-name toroloom-pg16 \
  --description "Toroloom PostgreSQL 16 parameters"

aws rds modify-db-parameter-group \
  --db-parameter-group-name toroloom-pg16 \
  --parameters "ParameterName=statement_timeout,ParameterValue=30000,ApplyMethod=immediate"
```

**Step 2 — Provision the instance:**

```bash
aws rds create-db-instance \
  --db-instance-identifier toroloom-db \
  --db-instance-class db.t4g.medium \
  --engine postgres \
  --engine-version 16.6 \
  --master-username toroloom \
  --master-user-password "$(openssl rand -base64 16)" \
  --db-name toroloom \
  --allocated-storage 100 \
  --storage-type gp3 \
  --backup-retention-period 7 \
  --db-parameter-group-name toroloom-pg16 \
  --enable-performance-insights \
  --performance-insights-retention-period 7 \
  --publicly-accessible \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name your-subnet-group
```

> Provisioning takes **5–10 minutes**. The endpoint will be available as
> `toroloom-db.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com:5432`.

**Step 3 — Allowlist Railway IPs:**

```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0
```

> **Important:** Remove this wide-open rule after migration is complete.

---

### 2. Migration: Railway PG → RDS

Use the automated migration script:

```bash
# 1. Run in dry-run mode first (validates connections + audits source)
./scripts/migrate-to-rds.sh \
  --source="postgresql://toroloom:password@railway-host:5432/toroloom" \
  --target="$(cd terraform && terraform output -raw database_url)"

# 2. Review the audit output, then run with --apply
./scripts/migrate-to-rds.sh \
  --source="postgresql://toroloom:password@railway-host:5432/toroloom" \
  --target="$(cd terraform && terraform output -raw database_url)" \
  --apply
```

**What the script does:**

| Step | Action | Details |
|------|--------|---------|
| 1 | Validates connections | Tests both source and target are reachable |
| 2 | Audits source DB | Table sizes, row counts, extensions, index count |
| 3 | Dumps source | `pg_dump --format=custom --compress=9` (excludes migration tracking tables) |
| 4 | Restores to RDS | `pg_restore --jobs=$(nproc)` — parallel restore capped at 4 CPUs |
| 5 | Runs core migration | Applies `migrations/init_scalability_core.sql` on RDS |
| 6 | Validates | Row count comparison across all tables |

**Manual approach (if you prefer step-by-step):**

```bash
# 1. Dump schema + data from Railway PG (custom format, compressed)
pg_dump "$RAILWAY_DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --exclude-table=migrations \
  --file=toroloom.dump

# 2. Restore to RDS (parallel restore)
pg_restore \
  --dbname="$RDS_DATABASE_URL" \
  --jobs=4 \
  --no-owner \
  --no-acl \
  --exit-on-error \
  toroloom.dump

# 3. Apply scalability core migration
psql "$RDS_DATABASE_URL" -f migrations/init_scalability_core.sql

# 4. Verify row counts
psql "$RDS_DATABASE_URL" -c "
  SELECT schemaname, relname, n_live_tup
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC;
"
```

---

### 3. Cutover: Flip DATABASE_URL

Once the migration is validated:

1. **Update the backend's `DATABASE_URL`** on Railway:
   - Go to Railway Dashboard → Backend service → **Variables**
   - Change `DATABASE_URL` to the RDS endpoint
   - Railway auto-redeploys the backend

2. **Verify the deployment:**

```bash
curl https://your-service.up.railway.app/health
# Expected: {"status":"ok","storageBackend":"postgres","storageHealthy":true,...}

# Verify data is accessible (try a few endpoints)
curl https://your-service.up.railway.app/api/portfolio/holdings \
  -H "Authorization: Bearer $TOKEN"
```

3. **Keep Railway PG running for 48 hours** as rollback window.
   To rollback: restore the old `DATABASE_URL` and redeploy.

4. **Deprovision Railway PG** after confirmation:
   - Railway Dashboard → PostgreSQL service → **Settings** → **Delete**

---

### 4. Post-Migration Hardening

**Lock down RDS security group:**

```bash
# Remove the wide-open rule
aws ec2 revoke-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0

# Allow only the backend's egress IP (or use RDS Proxy)
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp \
  --port 5432 \
  --cidr YOUR_BACKEND_IP/32
```

**Enable PgBouncer (if not already):**

After migrating to RDS, point PgBouncer at RDS instead of Railway PG:

```bash
# Update PgBouncer env vars to point to RDS endpoint
POSTGRESQL_HOST=toroloom-db.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com
POSTGRESQL_PORT=5432
```

**Set up monitoring alerts:**

| Alert | Condition | Recommended Action |
|-------|-----------|-------------------|
| CPU > 80% | `rds.cpu_utilization > 80` | Scale up instance class |
| Connections > 80% of max | `rds.database_connections > 80` | Add PgBouncer or scale |
| Free storage < 5 GB | `rds.free_storage_space < 5GB` | Increase allocated storage |
| Replica lag > 30s | `rds.replica_lag > 30` | Check reader workload |

---

### 5. Rollback Plan

If the RDS migration causes issues, rollback is straightforward:

```bash
# 1. Restore old DATABASE_URL on Railway backend
#    Point back to Railway PostgreSQL
DATABASE_URL=postgresql://toroloom:password@railway-host:5432/toroloom

# 2. Railway redeploys — verify health endpoint

# 3. Investigate RDS issue while Railway PG serves traffic

# 4. After fix, re-run the migration script
```

> **Note:** Any data written to RDS during the window between cutover and
> rollback will be lost. To avoid this, run in dual-write mode if available,
> or schedule a maintenance window with read-only mode.

---

## Database Setup

### PostgreSQL

When `STORAGE_BACKEND=postgres`, the init script (`backend/scripts/init-postgres.sql`) auto-creates tables on first startup.

For standalone PostgreSQL (outside Docker):

```bash
createdb toroloom
psql -d toroloom -f backend/scripts/init-postgres.sql
```

### MongoDB

When `STORAGE_BACKEND=mongodb`, collections are created on-demand by the driver.

For standalone MongoDB (outside Docker):

```bash
mongosh --eval '
  use toroloom;
  db.createCollection("audit_events");
  db.createCollection("risk_profiles");
  db.createCollection("broker_state");
'
```

---

## Monitoring & Observability

### Health Checks

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Overall health (returns `ok` or `degraded`) |
| `GET /metrics` | Prometheus metrics (prom-client) |

### Docker Health Check

The backend has a built-in `HEALTHCHECK` that pings `/health` every 15s.
Docker Compose shows health status:

```bash
docker compose -f docker-compose.prod.yml ps
```

### Prometheus + Grafana

The `/metrics` endpoint exposes:
- HTTP request duration, rate, errors
- Active WebSocket connections
- Broker call latency
- Circuit breaker state transitions
- Lockdown trigger count
- Tick processing rate

A sample Grafana dashboard is available at `backend/grafana/toroloom-ws-dashboard.json`.

### Logging

Logs are written to stdout (Docker-friendly). Structured format:

```
[WS] User abc123 authenticated (connections: 1)
[RiskEngine] Lockdown TRIGGERED for user abc123 — loss ₹12,450, breached: daily_loss
```

For production, ship logs to:
- **Docker logs**: `docker compose logs -f backend`
- **Loki + Grafana**: Use Promtail to scrape Docker logs
- **AWS CloudWatch**: Use the `awslogs` driver in Docker
- **Datadog**: Use the Datadog Agent

---

## Backup & Restore

### PostgreSQL

```bash
# Backup
docker exec toroloom-postgres pg_dump -U toroloom toroloom > backup_$(date +%Y%m%d).sql

# Restore
cat backup.sql | docker exec -i toroloom-postgres psql -U toroloom toroloom
```

### MongoDB

```bash
# Backup
docker exec toroloom-mongodb mongodump --username toroloom --password $MONGO_PASSWORD --db toroloom --out /tmp/backup
docker cp toroloom-mongodb:/tmp/backup ./backup_$(date +%Y%m%d)

# Restore
docker cp ./backup_20250101 toroloom-mongodb:/tmp/restore
docker exec toroloom-mongodb mongorestore --username toroloom --password $MONGO_PASSWORD --db toroloom /tmp/restore/toroloom
```

### Automated Backups

Add to crontab (runs daily at 2 AM):

```bash
0 2 * * * cd /opt/toroloom && ./scripts/backup.sh
```

Create `scripts/backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR=/var/backups/toroloom
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)
docker exec toroloom-postgres pg_dump -U toroloom toroloom | gzip > $BACKUP_DIR/pg_$DATE.sql.gz
docker exec toroloom-mongodb mongodump --username toroloom --password $MONGO_PASSWORD --db toroloom --archive --gzip > $BACKUP_DIR/mongo_$DATE.archive.gz
# Keep 30 days of backups
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
```

---

## Upgrading

```bash
# 1. Pull latest code
git pull origin main

# 2. Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build backend

# 3. Verify health
curl http://localhost:3000/health
```

For zero-downtime updates, scale to 2 replicas:

```bash
docker compose -f docker-compose.prod.yml up -d --scale backend=2 --no-recreate
# Wait for new instance to pass health check
# Then stop the old one:
docker compose -f docker-compose.prod.yml up -d --scale backend=1 --no-recreate
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `ECONNREFUSED` to database | Database container not healthy | `docker compose logs postgres` — check init script |
| `401` on API calls | Missing/invalid JWT in `Authorization` header | Verify `JWT_SECRET` matches between backend and client |
| WebSocket disconnects | Proxy not forwarding `Upgrade` header | Ensure `proxy_set_header Upgrade $http_upgrade` in nginx |
| Health check fails | Backend not fully started | Increase `start_period` in `docker-compose.prod.yml` |
| High memory usage | Many concurrent WebSocket connections | Reduce `MAX_CONNECTIONS_PER_USER` in `state.ts`, or add `ulimits` to container |
| `(node) warning: possible EventEmitter memory leak` | Many subscribe/unsubscribe cycles | Check for client-side reconnect loops in the frontend |

---

## Security Checklist

- [ ] `JWT_SECRET` is a strong random value (≥ 32 bytes hex)
- [ ] TLS is enabled (reverse proxy or Cloudflare Tunnel)
- [ ] Database ports (5432, 27017) are NOT exposed to the internet
- [ ] Container runs as non-root user (already configured in Dockerfile)
- [ ] Rate limiting is enabled (already configured per-route)
- [ ] Logging is configured (stdout for Docker, no sensitive data logged)
- [ ] Regular backups are scheduled
- [ ] Docker images are scanned for vulnerabilities (`docker scout`)
- [ ] `.env` file is in `.gitignore` (already done)
- [ ] API key rotation policy for broker credentials
