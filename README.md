# Toroloom

[![CI](https://github.com/ksjii666777-bit/toroloom/actions/workflows/ci.yml/badge.svg)](https://github.com/ksjii666777-bit/toroloom/actions/workflows/ci.yml)
[![Coverage — Frontend](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ksjii666777-bit/toroloom/gh-pages/badges/frontend-coverage.json)](https://github.com/ksjii666777-bit/toroloom/actions/workflows/ci.yml)
[![Coverage — Backend](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ksjii666777-bit/toroloom/gh-pages/badges/backend-coverage.json)](https://github.com/ksjii666777-bit/toroloom/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A full-stack trading platform built with **React Native (Expo)** and **Node.js**, featuring real-time WebSocket market data, multi-broker support (Zerodha, Angel One), a risk engine with automatic lockdown, and an immutable audit trail.

> **⚠️ Disclaimer:** This project is for **educational and experimental purposes only**. Not intended for live trading without thorough review and customization.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              Mobile Client                   │
│     React Native / Expo + Zustand           │
│     WebSocket P&L Bridge                    │
└──────────────┬──────────────────────────────┘
               │  HTTP (REST) + WebSocket
               ▼
┌─────────────────────────────────────────────┐
│              Backend (Node.js)               │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐ │
│  │  REST   │ │WebSocket │ │  Risk Engine │ │
│  │  API    │ │ Handler  │ │  + Lockdown  │ │
│  └────┬────┘ └────┬─────┘ └──────┬───────┘ │
│       │           │              │          │
│  ┌────┴───────────┴──────────────┴───────┐  │
│  │         Storage Abstraction           │  │
│  │    (In-Memory / PostgreSQL / MongoDB)  │  │
│  └───────────────────────────────────────┘  │
└──────────────┬──────────────────────────────┘
               │
     ┌─────────┴─────────┐
     ▼                   ▼
┌──────────┐     ┌──────────────┐
│PostgreSQL│     │   MongoDB    │
│ (Audit)  │     │ (Risk,State) │
└──────────┘     └──────────────┘
```

### Key Components

- **React Native (Expo)** — Cross-platform mobile app with TypeScript, Zustand state management
- **Multi-Broker Interface** — Zerodha Kite, Angel One SmartAPI, plus a mock broker for development
- **Risk Engine** — Real-time P&L tracking, configurable daily loss limits, automatic lockdown
- **Immutable Audit Trail** — Cryptographic chain of order events (append-only)
- **Flexible Storage** — In-memory (dev), PostgreSQL (audit trail), MongoDB (risk profiles, broker state)

---

## Badges

The coverage badges above are updated automatically by CI. They reflect the **lines** coverage percentage from the latest `master` build.

---

## Quick Start

```bash
# Install frontend dependencies
npm ci

# Install backend dependencies
cd backend && npm ci && cd ..

# Start Expo dev server
npm start

# Run tests
npm test                          # Frontend unit tests
cd backend && npm test            # Backend unit tests
npm run test:int                  # Integration tests (requires Docker)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full development setup and [DEPLOY.md](DEPLOY.md) for production deployment.

---

## CI/CD

Every push to `master`/`main` triggers a GitHub Actions workflow with 4 parallel jobs:

| Job | Status |
|-----|--------|
| **Backend** | TypeScript check + unit tests with coverage |
| **Frontend** | TypeScript check + unit tests with coverage |
| **Integration (PG + Mongo)** | Integration tests against real databases |
| **WebSocket Stress** | Long-running P&L bridge load test |

---

## License

MIT
