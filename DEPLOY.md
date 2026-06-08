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
