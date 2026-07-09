# Toroloom — Scaling Blueprint

> **From:** Single-instance Railway container (10–15 beta users)
> **To:** Auto-scaling microservices cluster on Kubernetes / AWS ECS
> **Capacity target:** Millions of concurrent users, sub-100ms P99 latency

---

## Architecture Overview

```
Phase 0 (Current)              Phase 3+ (Target)
┌──────────────┐              ┌──────────────────────┐
│  Expo App     │              │  CDN (CloudFront)     │
│  (EAS Build)  │              └──────────┬───────────┘
└──────┬───────┘                          │
       │                         ┌────────▼────────┐
       ▼                         │  API Gateway     │
┌──────────────┐                 │  (Rate limit +   │
│  Railway     │                 │   WAF + Auth)    │
│  Docker      │                 └────────┬────────┘
│  (1 replica) │                          │
│  Express+WS  │                 ┌────────▼────────┐
│  Memory      │                 │  K8s Pods        │
│  (no DB)     │                 │  (auto-scaled)   │
└──────────────┘                 └────────┬────────┘
                                          │
                          ┌───────────────┼───────────────┐
                          │               │               │
                    ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
                    │ RDS Multi-│   │  Redis     │   │  S3 / R2  │
                    │ AZ PG     │   │  Cluster   │   │  Storage  │
                    │ + Reader  │   │  + Pub/Sub │   │           │
                    └───────────┘   └───────────┘   └───────────┘
```

---

## Phase 0 — Current State (Railway Monolith)

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

## Phase 1 — PostgreSQL Production Hardening

### Goals
- Replace Railway PG with AWS RDS (Multi-AZ)
- Add PgBouncer for connection pooling
- Add read replica for analytics offload

### Implementation
1. **Terraform se RDS provision** → `terraform/` directory ready
2. **Data migration** → `scripts/migrate-to-rds.sh` script ready
3. **PgBouncer** → Config in `backend/pgbouncer/`
4. **Read replica** → `DATABASE_URL_READER` env var supported

### Status
- ✅ All code/config ready
- ⏳ Buyer ko AWS account + `terraform apply` karna hai
- 📖 Detailed guide: [`RDS_DEPLOY_GUIDE.md`](./RDS_DEPLOY_GUIDE.md)

---

## Phase 2 — Redis Caching Layer

### Goals
- Cache-aside pattern for analytics/AI endpoints
- Redis Pub/Sub for cross-worker WebSocket sync
- Graceful degradation (Redis down → direct DB query)

### Cache Strategy

| Data | TTL | Invalidation |
|------|-----|-------------|
| Win/Loss metrics | 5 min | On ledger import |
| P&L aggregation | 5 min | On trade or price update |
| Sector concentration | 5 min | On holding change |
| Tax summary | 5 min | On new trade import |
| Broker session | 30 s | On connect/disconnect |
| AI cognitive summary | 10 min | On demand refresh |

### Status
- ✅ `cacheService.ts` — wired into AI insights (L1→L2→L3 chain)
- ✅ Cache warming script: `backend/scripts/warm-cache.ts`
- ✅ Graceful degradation — Redis unavailable → AI API fallback
- ✅ Keys namespaced under `toroloom:cache:`
- ⏳ Buyer ko Railway Redis Plugin ya AWS ElastiCache add karna hai

---

## Phase 3 — Horizontal Compute Scaling

### Prerequisites (already done)
- ✅ App is stateless (broker state in PG, WS via IPC/Redis)
- ✅ Dockerfile with resource limits
- ✅ K8s manifests ready (`k8s/` directory)

### Deployment Options

| Option | When to use | Setup Time |
|--------|-------------|------------|
| **Railway Scale** | Up to 10K users | 5 min |
| **K8s (EKS/GKE)** | 10K+ users, multi-region | 1-2 days |
| **AWS ECS** | Simpler than K8s, same power | 1 day |

### WebSocket Fan-out (Multi-pod)

```
Client A ──▶ Pod A ──▶ Redis Pub/Sub ──▶ Pod B ──▶ Client B
```

Redis Pub/Sub already supported via `ioredis` dependency.

---

## Phase 4 — Database at Scale

| Milestone | Action |
|-----------|--------|
| 10M+ rows | Table partitioning for `parsed_ledgers` (by month) |
| Connection scaling | AWS RDS Proxy (replaces PgBouncer) |
| Analytics offload | Read replica + `DATABASE_URL_READER` |
| High availability | RDS Multi-AZ (auto-failover) |

---

## Phase 5 — Observability

### Already Deployed
| Tool | Purpose |
|------|---------|
| Prometheus | Metric collection (`/metrics` endpoint) |
| Grafana | Dashboards + alerting (`:3001`) |
| Sentry | Error tracking (backend SDK initialized) |

### Future
- OpenTelemetry distributed tracing (X-Ray / Grafana Tempo)
- Grafana Cloud for managed alerting

---

## Cost Projections

| Tier | Monthly Cost | Users | Architecture |
|------|-------------|-------|-------------|
| 🟢 **Free (current)** | $0 | 10–15 | Railway free tier, in-memory DB |
| 🔵 **Starter** | ~$50 | 100–1K | Railway Pro + PostgreSQL plugin + Redis |
| 🟡 **Growth** | ~$300 | 1K–10K | Railway Scale + RDS db.t4g.medium + Redis ElastiCache |
| 🟠 **Scale** | ~$1,200 | 10K–100K | EKS (2–10 pods) + RDS db.r6g.large + ElastiCache cluster |
| 🔴 **Enterprise** | $5K+ | 100K+ | EKS (10+ pods) + RDS Multi-AZ + read replicas + CDN |

---

## Error Containment Strategy

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
1. **Database failure** → App does NOT crash. `getDb()` returns null, routes handle gracefully.
2. **Redis failure** → Cache returns null, falls through to direct DB query.
3. **Broker API failure** → Circuit breakers prevent cascading failures (60s cooldown).
4. **Missing env vars** → Logs diagnostic message, defaults to safe no-op mode.

---

## Quick Reference

| Kaam | Resource |
|------|----------|
| **RDS deploy** | [`RDS_DEPLOY_GUIDE.md`](./RDS_DEPLOY_GUIDE.md) |
| **Terraform vars** | `terraform/terraform.tfvars.example` |
| **K8s manifests** | `k8s/` directory |
| **Load tests** | `scripts/load-test.mjs` |
| **Full benchmark report** | `load-test-report.json` |
