# Toroloom — Scaling Blueprint

> **From:** Single-instance Railway container (10–15 beta users)
> **To:** Auto-scaling microservices cluster on Kubernetes / AWS ECS
> **Capacity target:** Millions of concurrent users, sub-100ms P99 latency

---

## Overview

More than just "deploy bigger." This blueprint sequences every layer you need to
touch — database, cache, compute, WebSocket fan-out, observability — so each
phase is independently deployable and testable.

---

## Phase 0 — Current State (Railway Monolith)

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Expo App     │────▶│  Railway Docker  │────▶│  PostgreSQL  │
│  (EAS Build)  │     │  (1 replica)     │     │  (1 node)    │
└──────────────┘     │  Express + WS    │     └──────────────┘
                     │  InMemory Cache  │
                     │  Broker Plugins  │
                     └──────────────────┘
```

| Component | Current | Target |
|-----------|---------|--------|
| Compute | 1 Railway container (512 MB) | N × K8s pods (auto-scaled) |
| Database | 1 PostgreSQL node (in-memory fallback) | RDS Multi-AZ + read replicas |
| Cache | InMemory (lost on restart) | Redis Cluster (ElastiCache) |
| WebSocket | Single-process (IPC only) | Redis Pub/Sub + WS gateway |
| File storage | Local disk | S3 / Cloudflare R2 |
| CDN | None | CloudFront / Cloudflare |
| Observability | Prometheus + Grafana (Docker) | Managed Prometheus (AMP) + Grafana Cloud |

---

## Phase 1 — PostgreSQL Production Hardening (Week 1)

Before adding replicas, make the single node bulletproof.

### 1a. PgBouncer Connection Pooling

```
App ──▶ PgBouncer (transaction mode) ──▶ PostgreSQL
```

- PgBouncer sits BETWEEN the app and PostgreSQL.
- **Transaction mode** — connections are returned to the pool after each
  transaction, not after the client disconnects. This lets 200 app connections
  share a pool of 20–50 actual DB connections.
- Deploy PgBouncer via Railway sidecar or as a separate service.
- Set `pool_mode = transaction`, `default_pool_size = 20` (or higher).

**Configuration** (`pgbouncer.ini`):

```ini
[databases]
toroloom = host=postgres port=5432 dbname=toroloom

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
pool_mode = transaction
default_pool_size = 20
max_client_conn = 200
client_idle_timeout = 120
```

**Application changes**: The existing `backend/src/lib/database.provider.ts`
already handles PgBouncer-compatible connection strings. Just point DATABASE_URL
to `localhost:6432` instead of the direct PG port.

### 1b. Migration to Managed RDS

| Step | Action | Railway | AWS |
|------|--------|---------|-----|
| 1 | Provision RDS instance | Railway PostgreSQL plugin | AWS RDS PostgreSQL (db.t4g.medium) |
| 2 | Enable automated backups | Backup configured | 7-day retention, point-in-time recovery |
| 3 | Enable Performance Insights | — | Default on RDS |
| 4 | Set `statement_timeout = 30s` | Parameter group | RDS parameter group |
| 5 | Point DATABASE_URL to RDS | Railway Variables | Secrets Manager |

**Railway → RDS migration** is zero-downtime:
1. Spin up RDS alongside Railway PG
2. Run `pg_dump | pg_restore` to sync data
3. Flip DATABASE_URL env var → Railway redeploys
4. Deprovision Railway PG after confirmation

### 1c. Read Replicas (Analytics Offload)

```sql
-- Create read replica via RDS console (or Terraform)
-- Point read-only queries to the replica endpoint
```

- The `parsed_ledgers` table is the largest and most queried for analytics.
- Route `SELECT` queries for reports, tax summaries, and AI cognitive
  analytics to the read replica.
- Route `INSERT` / `UPDATE` / `DELETE` to the writer.

**Implementation**: Add a `getReadReplica()` export in
`backend/src/lib/database.provider.ts` that uses a secondary DATABASE_URL_READER
env var. Defaults to the writer when not set.

---

## Phase 2 — Redis Caching Layer (Week 2)

The `backend/src/middleware/cacheService.ts` is already built with
cache-aside pattern, graceful degradation, and key namespacing.

### Deployment

| Env | Redis Target | Connection |
|-----|-------------|------------|
| Local dev | `docker compose up redis` | `redis://localhost:6379` |
| Railway | Railway Redis Plugin | `RAILWAY_REDIS_URL` (auto-injected) |
| Production | AWS ElastiCache (Redis Cluster) | `REDIS_URL` env var |

### Cache Strategy

| Endpoint | Key Pattern | TTL | Invalidation |
|----------|-------------|-----|-------------|
| Win/Loss metrics | `winLoss:{userId}` | 5 min | On ledger import |
| P&L aggregation | `portfolioPnL:{userId}` | 5 min | On trade or price update |
| Sector concentration | `sectorConc:{userId}` | 5 min | On holding change |
| Tax summary | `taxSummary:{userId}:{fy}` | 5 min | On new trade import |
| Broker session | `brokerSession:{userId}:{type}` | 30 s | On connect/disconnect |
| AI cognitive summary | `aiCognitive:{userId}` | 10 min | On demand refresh |

### Cache Warming

For the top 1% of users (by request volume), pre-warm the cache after
deployment:

```bash
# After deploy, run a warm-up script
node scripts/warm-cache.mjs
```

---

## Phase 3 — Horizontal Compute Scaling (Week 3)

### 3a. Stateless Application

The backend is already stateless:
- Broker state persisted to PostgreSQL (`broker_state` table)
- WebSocket state synchronized via Redis Pub/Sub (or cluster IPC)
- File uploads go to S3 (not local disk)

This means you can add more pods without worrying about session affinity.

### 3b. Railway → Kubernetes Migration

| Step | Action | Details |
|------|--------|---------|
| 1 | Containerize | Already done (Dockerfile) |
| 2 | Set resource requests/limits | `requests: { cpu: 250m, memory: 256Mi }` — `limits: { cpu: 1, memory: 512Mi }` |
| 3 | Add liveness probe | `GET /health` — 200 OK = alive |
| 4 | Add readiness probe | `GET /health` — plus DB pool health |
| 5 | HPA (Horizontal Pod Autoscaler) | CPU > 70% triggers scale-up |

**Kubernetes Deployment sample** (`k8s/deployment.yaml`):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: toroloom-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: toroloom-api
  template:
    metadata:
      labels:
        app: toroloom-api
    spec:
      containers:
        - name: api
          image: ghcr.io/ksjii666777-bit/toroloom:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: toroloom-db
                  key: DATABASE_URL
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: toroloom-redis
                  key: REDIS_URL
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 1
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: toroloom-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: toroloom-api
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### 3c. WebSocket Fan-out

When running multiple pods, a WebSocket message received by pod A must be
broadcast to clients connected to pod B.

**Solution**: Redis Pub/Sub.

```
Client A ──▶ Pod A ──▶ Redis Pub/Sub ──▶ Pod B ──▶ Client B
```

The existing `ioredis` dependency already supports Pub/Sub.
The cache service can be extended with a `subscribe`/`publish` wrapper
for real-time data (ticks, order updates, notifications).

---

## Phase 4 — Database at Scale (Weeks 4–6)

### 4a. Table Partitioning

When `parsed_ledgers` exceeds 10M rows, partition by month:

```sql
-- Convert parsed_ledgers to partitioned table
CREATE TABLE parsed_ledgers_partitioned (
  LIKE parsed_ledgers INCLUDING ALL,
  execution_timestamp TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (execution_timestamp);

-- Monthly partitions
CREATE TABLE parsed_ledgers_2026_01
  PARTITION OF parsed_ledgers_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE parsed_ledgers_2026_02
  PARTITION OF parsed_ledgers_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ...auto-create via pg_partman or a cron job
```

### 4b. Connection Scaling (RDS Proxy)

AWS RDS Proxy replaces PgBouncer in the AWS environment:

```text
App ──▶ RDS Proxy (AWS-managed) ──▶ RDS Writer + Read Replicas
```

- Handles failover automatically (no connection drops)
- IAM authentication (no passwords in connection strings)
- Auto-scaling connection pool

### 4c. Query Performance Targets

| Query | Current | Target (Indexed) | Index Used |
|-------|---------|-----------------|------------|
| User login by email | Sequential scan | ~1 ms | `idx_users_email_password` |
| Active broker session | Seq scan on status | ~2 ms | `idx_broker_sessions_active` |
| Ledger for P&L chart | Seq scan on user_id | ~3 ms | `idx_parsed_ledgers_user_time` |
| Win/Loss by type | Seq scan | ~5 ms | `idx_parsed_ledgers_user_type_time` |
| Dedup check | Seq scan on raw_text | ~1 ms | `idx_parsed_ledgers_raw_hash` |

---

## Phase 5 — Observability & Incident Response (Ongoing)

### 5a. Metrics (Already Deployed)

| Tool | Purpose | Endpoint |
|------|---------|----------|
| Prometheus | Metric collection | `/metrics` (scraped every 15s) |
| Grafana | Dashboards + alerting | `:3001` (behind Caddy) |
| Sentry | Error tracking | Backend SDK initialized |

### 5b. Key Alerts

| Alert | Condition | Channel |
|-------|-----------|---------|
| P99 latency > 500ms | Histogram p99 exceeded | Slack + PagerDuty |
| DB connection pool exhausted | `pool.idleCount < 2` | Slack |
| Redis unreachable | `cacheService.getDiagnostics().connected = false` | Slack (warning) |
| 5xx rate > 1% | Error count / total requests | PagerDuty |
| Certificate expiry < 7 days | Caddy TLS expiry | Slack |

### 5c. Tracing (Phase 5+)

Add OpenTelemetry instrumentation for distributed tracing:

```bash
npm install @opentelemetry/instrumentation-express \
            @opentelemetry/instrumentation-pg \
            @opentelemetry/instrumentation-ioredis
```

Export traces to AWS X-Ray or Grafana Tempo.

---

## Phase 6 — Cost Projections

| Tier | Monthly Cost | Users | Architecture |
|------|-------------|-------|-------------|
| 🟢 **Free (current)** | $0 | 10–15 | Railway free tier, in-memory DB |
| 🔵 **Starter** | ~$50 | 100–1K | Railway Pro + PostgreSQL plugin + Redis |
| 🟡 **Growth** | ~$300 | 1K–10K | Railway Scale + RDS db.t4g.medium + Redis ElastiCache |
| 🟠 **Scale** | ~$1,200 | 10K–100K | EKS (2–10 pods) + RDS db.r6g.large + ElastiCache cluster |
| 🔴 **Enterprise** | $5K+ | 100K+ | EKS (10+ pods) + RDS Multi-AZ + read replicas + CDN |

---

## Error Containment Strategy

Every infrastructure layer has a clear containment boundary:

```
                     ┌─────────────────────────┐
                     │      L7: API Gateway     │
                     │  Rate limit, auth, cors  │
                     └─────────┬───────────────┘
                               │
                     ┌─────────▼───────────────┐
                     │   L6: Application        │
                     │   Circuit breakers        │
                     │   Graceful degradation    │
                     └─────────┬───────────────┘
                               │
               ┌───────────────┼───────────────┐
               │               │               │
     ┌─────────▼─────┐ ┌──────▼──────┐ ┌──────▼──────┐
     │ L5: PostgreSQL│ │ L5: Redis   │ │ L5: Broker  │
     │ Query timeout │ │  Fail-open  │ │  API timeout│
     │ Pool overflow │ │  (returns   │ │  Circuit    │
     │ → fallback    │ │  null)      │ │  breaker    │
     └───────────────┘ └─────────────┘ └─────────────┘
```

### Key containment rules:

1. **Database failure** → The app does NOT crash. `getDb()` returns `null`,
   and each route handles the null case by returning stale data or a
   graceful error message. See `backend/src/lib/database.provider.ts`.

2. **Redis failure** → The cache service returns `null` for all reads and
   `false` for all writes. The app falls through to direct database queries
   with no observable impact except increased latency.
   See `backend/src/middleware/cacheService.ts`.

3. **Broker API failure** → Circuit breakers (`backend/src/services/circuitBreaker.ts`)
   prevent cascading failures. After N consecutive failures, the broker is
   skipped in the fallback chain for 60 seconds.

4. **Missing environment variables** → The app logs a structured diagnostic
   message (ASCII-bordered box for readability) but does NOT crash.
   Each component defaults to a safe no-op mode.

---

## Migration Checklist

### Pre-migration (Current)
- [x] PostgreSQL storage engine with auto-migration
- [x] PgBouncer-compatible database provider (database.provider.ts)
- [x] Redis cache service with graceful degradation
- [x] Scalability core migration script (users, broker_sessions, parsed_ledgers)
- [x] Prometheus + Grafana dashboards
- [x] Sentry error tracking
- [x] Railway deploy config
- [x] Multi-broker plugin system with circuit breakers

### Phase 1 — Production DB
- [x] PgBouncer container added to Docker Compose (dev + prod)
- [x] PgBouncer config (pgbouncer.ini + userlist.txt) in `backend/pgbouncer/`
- [x] PgBouncer-compatible database provider with read replica support
- [x] `getReader()` / `queryReader()` exports for analytics offload
- [x] `DATABASE_URL_READER` env var + fallback to writer
- [x] `detectPgbouncerPort()` warning when using port 5432 directly
- [x] Enhanced diagnostics (reader pool stats, PgBouncer port detection)
- [x] RDS provisioning guide in DEPLOY.md (AWS Console + CLI)
- [x] Migration script `scripts/migrate-to-rds.sh` — dry-run + apply modes
- [x] Migration documentation in DEPLOY.md (dump, restore, validate, cutover, rollback)
- [x] Post-migration hardening guide (lockdown security group, monitoring alerts)
- [ ] Enable RDS automated backups (via AWS Console — one click)
- [ ] Provision RDS instance (db.t4g.medium) — run `aws rds create-db-instance`
- [ ] Run migration script: `./scripts/migrate-to-rds.sh --source=... --target=... --apply`
- [ ] Flip DATABASE_URL to RDS endpoint on Railway
- [ ] Set up CloudWatch alarms for connection pool

### Phase 2 — Caching
- [x] Redis service in docker-compose.yml (dev + prod)
- [x] cacheService.ts wired into AI insights route (L1: in-memory → L2: Redis → L3: AI API)
- [x] Cache warming script (`backend/scripts/warm-cache.ts`) — CLI with --users, --prefix, --dry-run flags
- [x] Auto-TTL per key pattern (aiCognitive: 600s, brokerSession: 30s, aggregates: 300s)
- [x] Graceful degradation: Redis unavailable → falls through to AI API directly
- [x] Batch analyze endpoint uses Redis (per-symbol L2 lookups in parallel)
- [x] Cache keys namespaced under `toroloom:cache:` prefix
- [ ] Add Redis plugin to Railway project
- [ ] Set `REDIS_URL` in Railway Variables (already used for pub/sub)
- [ ] Verify cache hits on analytics endpoints via logs
- [ ] Run warm-cache.ts as post-deploy hook

### Phase 3 — Compute Scaling
- [x] Containerize with resource limits (Dockerfile + deployment.yaml requests/limits)
- [x] Set up GitHub Container Registry (ghcr.io) — image: ghcr.io/ksjii666777-bit/toroloom
- [x] Create K8s manifests — namespace, configmap, secrets, deployment, service (ClusterIP + headless), HPA, PDB, ingress
- [x] Kustomize configuration — configMapGenerator, secretGenerator, commonLabels, image overrides
- [x] Ingress with TLS (cert-manager), WebSocket timeouts, CORS, rate limiting (nginx annotations)
- [ ] Configure Redis Pub/Sub for WebSocket fan-out

### Phase 4 — Database at Scale
- [ ] Migrate to RDS Multi-AZ
- [ ] Add read replicas for analytics
- [ ] Configure RDS Proxy
- [ ] Implement table partitioning for parsed_ledgers

### Phase 5 — Observability
- [ ] Add OpenTelemetry tracing
- [ ] Set up Grafana Cloud alerts
- [ ] Run load tests with k6 or artillery.io
- [ ] Document runbooks for each alert
