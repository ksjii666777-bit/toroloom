# 📚 Toroloom — Master Index

> **Buyer ke liye ek hi jagah sab guides.** Toroloom ka backend deploy karna ho, app store par submit karna ho, ya scaling karni ho — neeche se relevant guide dhundho.

---

## 🚀 Quick Start — Pehle Yeh Karo

| Step | Kya karna hai? | Guide |
|:----:|----------------|-------|
| 1️⃣ | **Backend deploy karo** (Railway ya Docker) | [`DEPLOY.md`](./DEPLOY.md) |
| 2️⃣ | **Health check karo** | `curl https://your-service.up.railway.app/health` |
| 3️⃣ | **Frontend config karo** (BASE_URL set) | [`DEPLOY.md` → Frontend Connect](./DEPLOY.md) |
| 4️⃣ | **App Store submit karo** | [`docs/STORE_SUBMISSION.md`](./docs/STORE_SUBMISSION.md) |

> ⏱️ **Total time:** 10-15 minutes (Railway deploy) + 1-2 days (App Store review)

---

## 📖 Guide Directory

### 📄 0. Project Overview

| # | Guide | Kya covered hai? |
|:-:|-------|------------------|
| 0 | [`README.md`](./README.md) | Project overview, architecture diagram, CI/CD badges, quick start commands |

### 🏗️ 1. Deployment Guides

| # | Guide | Kya covered hai? | Pages |
|:-:|-------|------------------|:-----:|
| 1 | [`DEPLOY.md`](./DEPLOY.md) | Backend deploy — Railway (recommended) + Docker (VPS). Env vars, security, troubleshooting | ~80 |
| 2 | [`RDS_DEPLOY_GUIDE.md`](./RDS_DEPLOY_GUIDE.md) | AWS RDS PostgreSQL migrate karna (Railway PG → RDS). Terraform + migration script | ~60 |
| 3 | [`SCALING_BLUEPRINT.md`](./SCALING_BLUEPRINT.md) | Phase-wise scaling plan: 0 users → millions. Cost projections, error containment | ~50 |
| 4 | [`docs/STORE_SUBMISSION.md`](./docs/STORE_SUBMISSION.md) | App Store + Play Store submit kaise karein. EAS build, screenshots, metadata | ~40 |
| 5 | [`docs/APPLE_CONFIG.md`](./docs/APPLE_CONFIG.md) | Apple Developer config — Team ID, ascAppId, Firebase iOS setup, EAS credentials | ~30 |
| 6 | [`terraform/README.md`](./terraform/README.md) | Terraform deep-dive — RDS vars, outputs, CloudWatch alarms, cleanup | ~40 |
| 7 | [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Dev setup, tests kaise chalayein (unit + integration + E2E), code style | ~50 |

### 📊 2. Product & Feature Docs

| # | Guide | Kya covered hai? | Pages |
|:-:|-------|------------------|:-----:|
| 8 | [`docs/FEATURE_CHECKLIST.md`](./docs/FEATURE_CHECKLIST.md) | 28 feature categories ka overview. Frontend, backend, tests, E2E — sab ka summary | ~60 |
| 9 | [`docs/DASHBOARD.md`](./docs/DASHBOARD.md) | Project dashboard — 97% progress, 58 screens, 236 test files, coverage stats | ~80 |
| 10 | [`docs/zero-api-gateway.md`](./docs/zero-api-gateway.md) | Zero-API broker gateway — WebView session extraction, proxy client, add new broker | ~70 |
| 11 | [`FUTURE.md`](./FUTURE.md) | Future roadmap — education platform, social trading, advanced analytics, monetization | ~100 |
| 12 | [`docs/SESSION-SUMMARY-2026-06-06.md`](./docs/SESSION-SUMMARY-2026-06-06.md) | Technical deep-dive: storage consistency, cross-file isolation, integration test fixes | ~100 |

### 🏢 3. Business & Legal

| # | Guide | Kya covered hai? | Pages |
|:-:|-------|------------------|:-----:|
| 13 | [`ENTERPRISE_TRANSFER.md`](./ENTERPRISE_TRANSFER.md) | Enterprise acquisition blueprint — repo transfer, AWS handover, DB migration, CI/CD | ~100 |
| 14 | [`docs/privacy-policy.html`](./docs/privacy-policy.html) | Privacy Policy — DPDP Act, GDPR compliant. Data collection, sharing, retention | 1 page |
| 15 | [`docs/terms-of-service.html`](./docs/terms-of-service.html) | Terms of Service — SEBI compliance, risk disclosure, dispute resolution | 1 page |
| 16 | [`LICENSE`](./LICENSE) | MIT License | 1 page |

### 🛠️ 4. Infrastructure & Config

| # | Resource | Kya hai? |
|:-:|----------|----------|
| 17 | [`docker-compose.yml`](./docker-compose.yml) | Dev compose — PostgreSQL + MongoDB + Redis + PgBouncer |
| 18 | [`docker-compose.prod.yml`](./docker-compose.prod.yml) | Production compose — Backend + Caddy + Prometheus + Grafana |
| 19 | [`k8s/`](./k8s/) | Kubernetes manifests — Deployment, Service, Ingress, HPA, ConfigMap, Secrets |
| 20 | [`terraform/`](./terraform/) | Terraform IaC — RDS provisioning, VPC, bootstrap module |
| 21 | [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) | CI/CD pipeline — 7 parallel jobs (typecheck, test, integration, E2E) |

### 📱 5. App Store Assets

| # | Resource | Kya hai? |
|:-:|----------|----------|
| 22 | [`store/ios/listing.txt`](./store/ios/listing.txt) | App Store description + keywords |
| 23 | [`store/screenshots/README.md`](./store/screenshots/README.md) | Screenshots capture guide |
| 24 | [`app.json`](./app.json) | Expo app config — bundle ID, privacy descriptions, plugins |

---

## 🔀 Quick Decision Flowchart

```
Kya karna chahte ho?
│
├── **Sirf backend deploy karna hai?**
│   → [`DEPLOY.md`](./DEPLOY.md) — Railway (5 min)
│
├── **Production-grade DB chahiye?**
│   → [`RDS_DEPLOY_GUIDE.md`](./RDS_DEPLOY_GUIDE.md) — AWS RDS (15 min)
│
├── **App Store / Play Store submit karna hai?**
│   → [`docs/STORE_SUBMISSION.md`](./docs/STORE_SUBMISSION.md)
│
├── **Puri app ka feature list dekhna hai?**
│   → [`docs/FEATURE_CHECKLIST.md`](./docs/FEATURE_CHECKLIST.md)
│
├── **Scaling / future planning?**
│   → [`SCALING_BLUEPRINT.md`](./SCALING_BLUEPRINT.md)
│   → [`FUTURE.md`](./FUTURE.md)
│
└── **Enterprise acquisition / code transfer?**
    → [`ENTERPRISE_TRANSFER.md`](./ENTERPRISE_TRANSFER.md)
```

---

## 📊 Guide Summary Table

| Guide | Audience | Difficulty | Time Required | Pages |
|-------|----------|:----------:|:-------------:|:-----:|
| `DEPLOY.md` | Buyer | 🟢 Easy | 5-10 min | 80 |
| `RDS_DEPLOY_GUIDE.md` | Buyer/DevOps | 🟡 Medium | 15-30 min | 60 |
| `SCALING_BLUEPRINT.md` | CTO/Architect | 🟡 Medium | 10 min read | 50 |
| `docs/STORE_SUBMISSION.md` | Buyer | 🟢 Easy | 1-2 days (review) | 40 |
| `docs/APPLE_CONFIG.md` | Buyer | 🟢 Easy | 30 min | 30 |
| `terraform/README.md` | DevOps | 🟡 Medium | 30 min | 40 |
| `docs/FEATURE_CHECKLIST.md` | Buyer/Investor | 🟢 Easy | 5 min read | 60 |
| `docs/DASHBOARD.md` | Buyer/Investor | 🟢 Easy | 5 min read | 80 |
| `docs/zero-api-gateway.md` | Developer | 🔴 Advanced | 20 min read | 70 |
| `ENTERPRISE_TRANSFER.md` | CTO/Legal | 🔴 Advanced | 30 min read | 100 |
| `FUTURE.md` | Buyer/Investor | 🟢 Easy | 10 min read | 100 |
| `CONTRIBUTING.md` | Developer | 🟡 Medium | 15 min | 50 |

---

## 🏷️ Tags

| Tag | Guides |
|-----|--------|
| `deployment` | DEPLOY, RDS_DEPLOY_GUIDE, SCALING_BLUEPRINT, terraform/README |
| `app-store` | STORE_SUBMISSION, APPLE_CONFIG |
| `feature-overview` | FEATURE_CHECKLIST, DASHBOARD |
| `technical` | zero-api-gateway, SESSION-SUMMARY, CONTRIBUTING |
| `business` | ENTERPRISE_TRANSFER, FUTURE |
| `legal` | privacy-policy, terms-of-service, LICENSE |

---

> 💡 **Pehle Railway par deploy karo** (5 minute ka kaam hai). Phir store submit karo. Scaling aur RDS baad mein — jab tak users na aayein, zaroorat nahi hai.
>
> Koi guide chhoot gayi? Pull request bhejo ya issue kholo!
