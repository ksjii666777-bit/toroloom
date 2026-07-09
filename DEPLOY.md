# 🚀 Toroloom — Deployment Guide

> **Buyer ke liye simple guide:** Is guide mein aap sikhenge ki kaise Toroloom backend ko deploy karna hai. Do main options hain:

| Option | Kiske liye? | Complexity |
|--------|------------|------------|
| **Railway (Recommended)** ⭐ | Jo log simple, serverless PaaS chahte hain | Low |
| **Docker (VPS/Dedicated Server)** | Jo log apne VPS ya server par host karna chahte hain | Medium |

---

## 🏠 Architecture (Ek Nazar Mein)

```
User (Mobile App) ──▶ Railway / VPS ──▶ Backend (Node.js :3000)
                                              │
                                              ├──▶ PostgreSQL (Database)
                                              ├──▶ Redis (Cache, optional)
                                              └──▶ MongoDB (optional)
```

> **Frontend (React Native app)** — alag se deploy karna padta hai. Yeh guide sirf **backend** ke liye hai.

---

# Option 1: Railway Deploy (Recommended) ⭐

Railway sabse simple tarika hai — GitHub se connect karo, auto-deploy ho jayega.

## 📋 Prerequisites

| Cheez | Kaise milegi |
|-------|-------------|
| **Railway Account** | [railway.app](https://railway.app) — Google/GitHub se signup karo |
| **GitHub Account** | Railway ko GitHub se link karna hoga |
| **Ye repo (Toroloom)** | Buyer ko ye repo mil gaya hoga |

## 🪜 Step-by-Step

### Step 1: Railway mein Project banao

1. [Railway Dashboard](https://railway.app/dashboard) → **+ New Project**
2. **Deploy from GitHub repo** → Apna repo select karo
3. Pehli build fail hogi (expected hai) — chalte raho

### Step 2: Root Directory set karo

1. Railway mein service par click karo → **Settings** tab
2. **Root Directory** dhundho → `/` se change karo → `/backend`
3. Railway auto-deploy trigger karega

### Step 3: Environment Variables set karo

Service ke **Variables** tab mein yeh add karo:

| Variable | Value | Kyun chahiye? |
|----------|-------|---------------|
| `JWT_SECRET` | `openssl rand -hex 32` se generate karo | Auth tokens sign karne ke liye |
| `NODE_ENV` | `production` | Production mode |
| `STORAGE_BACKEND` | `memory` | Bina DB ke bhi chalega pehle |
| `CLUSTER_MODE` | `0` | **Zaroori!** Railway single-container ke liye 0 hona chahiye |

> **JWT_SECRET generate karo:** Terminal mein `openssl rand -hex 32` chalao aur copy karo.

### Step 4: Verify karo

1. Railway ek domain dega (jaise `toroloom.up.railway.app`)
2. Health check karo:
   ```bash
   curl https://your-service.up.railway.app/health
   ```
   Output aana chahiye:
   ```json
   {"status":"ok","broker":"mock","storageBackend":"memory"}
   ```

### Step 5: PostgreSQL Add karo (Optional)

> Jab tak tumhe persistent data nahi chahiye, `STORAGE_BACKEND=memory` kaafi hai.

1. Railway project mein **+ New** → **Database** → **PostgreSQL**
2. Railway automatically `DATABASE_URL` inject karega
3. Backend service → Variables → `STORAGE_BACKEND` ko `postgres` set karo
4. Railway redeploy karega — tables auto-create ho jayenge

---

## ✅ Deployment Verify Karne Ke Liye

```bash
# Health check
curl https://your-service.up.railway.app/health

# Agar PostgreSQL connected hai to:
# {"status":"ok","storageBackend":"postgres","storageHealthy":true}
```

## 📱 Frontend ko Backend se Connect karo

Mobile app ko backend se connect karne ke liye API URL set karo:

```bash
# src/services/api/client.ts mein BASE_URL ko Railway domain se update karo
BASE_URL: "https://your-service.up.railway.app"
```

Railway domain mil gaya hoga Step 4 mein (jaise `toroloom.up.railway.app`). Yeh URL frontend config mein daalo.

---

# Option 2: Docker Deploy (VPS / Dedicated Server)

Agar apna khud ka server hai (DigitalOcean, AWS EC2, Linode, etc.) to Docker use karo.

## Prerequisites

```bash
# Server par Docker install karo
curl -fsSL https://get.docker.com | sh

# Git se repo clone karo
git clone <your-repo-url> toroloom
cd toroloom
```

## Setup

```bash
# .env file banao
cp .env.example .env
# Edit karo — minimum JWT_SECRET set karo
nano .env

# Production stack start karo
docker compose -f docker-compose.prod.yml up -d

# Verify
curl http://localhost:3000/health
```

### Useful Docker Commands

| Kaam | Command |
|------|---------|
| Logs dekho | `docker compose -f docker-compose.prod.yml logs -f backend` |
| Restart karo | `docker compose -f docker-compose.prod.yml restart` |
| Update karo | `docker compose -f docker-compose.prod.yml up -d --build backend` |
| Stop karo | `docker compose -f docker-compose.prod.yml down` |

---

# 🔒 JWT_SECRET Kaise Banayein

```bash
# Terminal mein chalao:
openssl rand -hex 32
# Output copy karo aur JWT_SECRET mein daalo
```

> **Yeh sabse important step hai!** Bina strong JWT_SECRET ke app secure nahi hai.

---

# 📦 Persistent Database (PostgreSQL)

Jab bhi app restart ho, data save rehna chahiye to PostgreSQL use karo.

| Scenario | STORAGE_BACKEND | Requirement |
|----------|----------------|-------------|
| **Demo / Testing** | `memory` | Koi DB nahi chahiye |
| **Production (small)** | `postgres` + Railway PG | Railway mein PostgreSQL add karo |
| **Production (scale)** | `postgres` + AWS RDS | RDS alag se provision karo |

### Railway PostgreSQL ke saath:

1. Railway Dashboard → **+ New** → **Database** → **PostgreSQL**
2. `STORAGE_BACKEND=postgres` set karo
3. Ho gay — Railway auto-inject karega DATABASE_URL

### AWS RDS ke saath:

Alag guide hai — dekho 👉 [`RDS_DEPLOY_GUIDE.md`](./RDS_DEPLOY_GUIDE.md)

---

# 🛠 Environment Variables

Sabse zaroori variables jo set karne hain:

| Variable | Default | Kya Hai? |
|----------|---------|----------|
| `JWT_SECRET` | **(REQUIRED)** | Auth tokens sign karne ke liye |
| `NODE_ENV` | `development` | Production mein `production` daalo |
| `STORAGE_BACKEND` | `memory` | `memory` / `postgres` / `mongodb` |
| `DATABASE_URL` | `""` | PostgreSQL connection string |
| `BROKER` | `mock` | `mock` / `zerodha` / `angel` |
| `DATA_SOURCE` | `mock` | `mock` / `live` |
| `CLUSTER_MODE` | `0` (Railway) / `1` (VPS) | Single process = 0 (Railway ke liye). Multi-core = 1 (VPS ke liye) |

> **Safe defaults:** Bina kuch change kiye bhi app chalegi — `STORAGE_BACKEND=memory` mode mein.

---

# ⚠️ Common Issues & Solutions

| Problem | Reason | Fix |
|---------|--------|-----|
| Railway build fail: `Dockerfile not found` | Root Directory wrong | Settings → Root Directory → `/backend` |
| `ERR_CONNECTION_REFUSED` | App PORT par listen nahi kar rahi | Railway PORT auto-inject karta hai — check karo |
| Health check: `storageHealthy: false` | DB connected nahi hai | Normal hai agar `STORAGE_BACKEND=memory` hai |
| App crash: exit code 137 | Memory khatam ho gayi | Railway paid plan mein upgrade karo |
| `401 Unauthorized` | JWT_SECRET mismatch | Frontend aur backend dono mein same JWT_SECRET daalo |
| WebSocket disconnect | Idle timeout | Railway free tier mein hota hai — upgrade karo |

---

# 🔐 Security Checklist

- [ ] `JWT_SECRET` strong hai (32+ characters, random)
- [ ] Railway mein `STORAGE_BACKEND=memory` hai to DB ports public nahi hain
- [ ] `.env` file `.gitignore` mein hai (already hai)
- [ ] Production mein `NODE_ENV=production` set hai

---

# 📖 Related Guides

| Guide | Link |
|-------|------|
| **AWS RDS PostgreSQL Setup** (production DB) | [`RDS_DEPLOY_GUIDE.md`](./RDS_DEPLOY_GUIDE.md) |
| **Terraform Infrastructure** (IaC for AWS) | [`terraform/README.md`](./terraform/README.md) |
| **Kubernetes Deployment** (advanced) | [`k8s/`](./k8s/) directory |
| **Full Scaling Blueprint** | [`SCALING_BLUEPRINT.md`](./SCALING_BLUEPRINT.md) |

---

> 💡 **Pehle Railway par deploy karo — 5 minute mein chal jayega.**
> `CLUSTER_MODE=0` set karna mat bhoolna, warna Railway container crash karega!
> Baad mein zaroorat ho to RDS ya scaling ka sochna.
