# 🚀 Toroloom — Railway PostgreSQL Production Guide

> **Goal:** Backend ko Railway ke built-in PostgreSQL plugin par migrate karna — abhi `STORAGE_BACKEND=memory` hai, matlab saara data in-memory hai aur har deploy/restart par gayab ho jata hai.

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

1. [Railway Dashboard](https://railway.app/dashboard) → apna **Toroloom project**
2. **New → Database → PostgreSQL** (ya `+` button → `PostgreSQL`)
3. Railway Postgres service create karega aur ek `DATABASE_URL` variable generate karega
4. Database ready hone ke liye 1-2 min wait karo (status `Healthy` hona chahiye)

> 💡 **Postgres service aur backend service ek hi project/environment mein** hone chahiye taaki Railway `DATABASE_URL` auto-link ho sake.

### Step 2: Backend service par vars set karo

Railway Dashboard → **Backend service** → **Variables** tab:

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

```bash
curl https://toroloom-production.up.railway.app/health
```

Expected:
```json
{"status":"ok","storageBackend":"postgres","storageHealthy":true,...}
```

- `storageBackend: "postgres"` → postgres active
- `storageHealthy: true` → DB connection + schema OK
- `status: "ok"` → sab kuch healthy

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

1. Railway → Backend → Variables
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

---

## ✅ Done Checklist

- [ ] Railway Postgres service create
- [ ] `STORAGE_BACKEND=postgres` set
- [ ] `DATABASE_URL` set/linked
- [ ] Logs mein `Storage: POSTGRES` + `Migrations:` line
- [ ] `/health` → `storageBackend: postgres`, `storageHealthy: true`
- [ ] Redeploy ke baad data persist

---

> 🔒 **Future hardening:** Scale ke liye AWS RDS path ready hai — [`RDS_DEPLOY_GUIDE.md`](./RDS_DEPLOY_GUIDE.md) + [`SCALING_BLUEPRINT.md`](./SCALING_BLUEPRINT.md) dekho.
