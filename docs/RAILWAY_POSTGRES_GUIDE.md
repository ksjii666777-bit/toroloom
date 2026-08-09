# 🚀 Toroloom — Railway PostgreSQL Production Guide

> **Goal:** Backend ko Railway ke built-in PostgreSQL plugin par migrate karna — abhi `STORAGE_BACKEND=memory` hai, matlab saara data in-memory hai aur har deploy/restart par gayab ho jata hai.

> **🗂 Canonical Production Project (IMPORTANT):**
> - **Project:** `friendly-consideration` (production)
> - **Service:** `toroloom` (backend) + `Postgres` (database)
> - **URL:** `https://<your-domain>.up.railway.app`
> - **⚠️ In dono services ko DELETE mat karna** — yeh LIVE production hain. `toroloom` service domain mapping carry karti hai; delete karne par backend offline + domain loss hota hai.
> - Purana `toroloom-backend` project (FAILED deploys wala) delete ho chuka hai — usse confuse mat hona.

---

## 📋 Current State (kyun zaroori hai)

| Component | Abhi (memory) | Target (postgres) |
|-----------|---------------|-------------------|
| Storage | In-memory (restart par data loss) | Railway PostgreSQL (persistent) |
| `STORAGE_BACKEND` | `memory` | `postgres` |
| `DATABASE_URL` | unset | Railway plugin se milta hai |

Backend code **pehle se Postgres-ready hai**: `PostgreSQLStorage` engine (pool + retry/backoff + auto-migrate) aur `migrationRunner` (numbered SQL files) dono complete hain. Sirf Railway par vars set karna aur ek Postgres service add karna baaki hai.

---

## 🪜 Step-by-Step

### Step 1: Railway Postgres service add karo

1. [Railway Dashboard](https://railway.app/dashboard) → **`friendly-consideration`** project
2. **New → Database → PostgreSQL** (ya `+` button → `PostgreSQL`)
3. Railway Postgres service create karega aur ek `DATABASE_URL` variable generate karega
4. Database ready hone ke liye 1-2 min wait karo (status `Healthy` hona chahiye)

> 💡 **Postgres service aur backend service (`toroloom`) ek hi project/environment mein** hone chahiye taaki Railway `DATABASE_URL` auto-link ho sake.
> **CLI tip:** `railway link -p friendly-consideration -e production -s toroloom` — sahi service par link karo, warna galat project ke FAILED deploys dikhenge.

### Step 2: `toroloom` service par vars set karo

Railway Dashboard → **`toroloom` service** → **Variables** tab:

| Variable | Value |
|----------|-------|
| `STORAGE_BACKEND` | `postgres` |
| `DATABASE_URL` | Postgres service se auto-linked (ya manually `postgresql://...` paste karo) |
| `JWT_SECRET` | Already set hona chahiye (production mein required) |

Railway auto-redeploy hoga.

### Step 3: Verify migration chala

Railway **Deployments** tab → backend logs dekho. Startup par yeh lines dikhni chahiye:

```
Storage:    POSTGRES
Migrations: 2 applied, 0 skipped
```

Agar `Migrations:` line dikhe — 001 + 002 SQL files apply ho gayi (`_migrations` table track karta hai). Agar DB pehle se tables rakhta hai toh `0 applied` aayega (idempotent — safe).

### Step 4: Health check verify karo

Railway ka `healthcheckPath` ab **`/ready`** hai (liveness `/health` se alag readiness endpoint). Dono verify karo:

```bash
# Readiness — Railway healthcheck yahi hit karta hai
curl https://<your-domain>.up.railway.app/ready

# Liveness — process up hai ya nahi
curl https://<your-domain>.up.railway.app/health
```

Expected:
```json
// /ready → HTTP 200
{"status":"ready","storageBackend":"postgres","storageHealthy":true,...}

// /health → HTTP 200
{"status":"ok","storageBackend":"postgres","storageHealthy":true,...}
```

- `storageBackend: "postgres"` → postgres active
- `storageHealthy: true` → DB connection + schema OK
- `/ready` ka `status: "ready"` + HTTP 200 → Railway healthcheck pass

#### 🚨 `/ready` 503 ka matlab (fail-fast design)

`/ready` **503 return karta hai jab real storage backend (postgres/mongodb) configured ho par DB unreachable ho** (`!storageHealthy`). Memory backend hamesha ready — kabhi 503 nahi.

Railway `healthcheckPath: /ready` + `restartPolicyType: ON_FAILURE` + `restartPolicyMaxRetries: 10` hone se:
- DB down → `/ready` 503 → Railway **container restart** karta hai (up to 10)
- 10 restart ke baad deployment **failed** mark hota hai

> Yeh **intentional fail-fast** hai — degraded-but-200 wali misleading health khatam. Outage ke time Railway dashboard mein restart churn dikhega — expected hai.

Config source: [`backend/railway.json`](../backend/railway.json) + [`backend/Dockerfile`](../backend/Dockerfile) (HEALTHCHECK bhi `/ready` hit karta hai).

### Step 5: Data persistence test

1. App mein kuch data banao (risk profile / notification / coupon etc.)
2. Backend ko Railway par **redeploy** karo (ya restart)
3. Data abhi bhi wapas aana chahiye (memory jaisa data loss nahi)

---

## 🧠 Migration architecture (kya kya chalta hai)

```
Backend startup
   │
   ├─ getStorage() → PostgreSQLStorage.connect()
   │     └─ inline migrate()  → CREATE TABLE IF NOT EXISTS (sab base tables + stock_alerts)
   │
   ├─ runMigrations() → backend/migrations/*.sql
   │     ├─ 001_initial_schema.sql
   │     └─ 002_add_stock_alerts.sql
   │     └─ _migrations tracking table (future migrations auto-apply)
   │
   └─ Services wire ho jate hain (audit, risk, broker, notifications, subscriptions...)
```

**Dual-schema source of truth:**
- `PostgreSQLStorage.migrate()` — inline base schema (connect par chalta hai)
- `migrationRunner` — numbered SQL files (startup par chalta hai, future migrations ke liye)

Dono idempotent hain (`CREATE TABLE IF NOT EXISTS`) — conflict nahi karte.

**Stock alerts:** `stock_alerts` table postgres mode mein PostgreSQL par persist hoti hai — `configureStockAlertPersistence()` startup par pool se wire hota hai aur `startStockAlertPoller()` (60s interval) chalta hai. Memory fallback sirf tab use hota hai jab koi DB configured na ho.

---

## 🔄 Rollback Plan

Kuch galat ho toh wapas memory par jao:

1. Railway → `toroloom` service → Variables
2. `STORAGE_BACKEND = memory` set karo
3. Railway redeploy — server memory mode mein chalega
4. Postgres issue fix karo, phir Step 2-4 repeat karo

> ⚠️ Postgres service ko 48 hours tak mat delete karo — rollback window ke liye.

---

## 🛠 Local Development (optional — docker-compose)

```bash
# Postgres + PgBouncer + Redis + Mongo local mein chalu karo
docker compose up -d

# Backend .env mein:
#   STORAGE_BACKEND=postgres
#   DATABASE_URL=postgresql://toroloom:toroloom_dev@localhost:5432/toroloom

cd backend
npm run dev
```

---

## 🆘 Common Issues

| Problem | Solution |
|---------|----------|
| `Storage: MEMORY` dikh raha | `STORAGE_BACKEND` var sahi set hai? Backend redeploy hua? |
| `storageHealthy: false` | `DATABASE_URL` sahi hai? Postgres service Healthy hai? |
| `Migrations: 0 applied` | Normal hai — schema already hai ya koi pending nahi |
| `Migration runner failed` | Logs dekho — URL galat ya permission issue |
| Startup crash `DATABASE_URL is required` | Postgres service se link nahi hua — URL manually paste karo |
| `/ready` 503 + Railway restart loop | DB down hai — fail-fast by design. Postgres service Healthy hai check karo |
| `/ready` 404 | Purana container chal raha hai — redeploy complete hone par dobara check karo |
| `storageBackend: "postgres "` (space) | Railway var mein trailing whitespace — env.ts ab `.trim()` karta hai, redeploy karo |

---

## ✅ Done Checklist

- [ ] Railway Postgres service create (`friendly-consideration` project)
- [ ] `STORAGE_BACKEND=postgres` set (bina trailing space)
- [ ] `DATABASE_URL` set/linked
- [ ] Logs mein `Storage: POSTGRES` + `Migrations:` line
- [ ] `/ready` → HTTP 200, `status: "ready"`, `storageHealthy: true` (Railway healthcheck path)
- [ ] `/health` → `storageBackend: postgres`, `storageHealthy: true` (liveness)
- [ ] Redeploy ke baad data persist
- [ ] `toroloom` + `Postgres` services intact (delete nahi hui)

---

> 🔒 **Future hardening:** Scale ke liye AWS RDS path ready hai — [`RDS_DEPLOY_GUIDE.md`](./RDS_DEPLOY_GUIDE.md) + [`SCALING_BLUEPRINT.md`](./SCALING_BLUEPRINT.md) dekho.
