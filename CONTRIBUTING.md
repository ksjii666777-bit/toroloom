# Contributing to Toroloom

## Prerequisites

- **Node.js** 20+
- **npm** 10+
- **Docker Desktop** (with Docker Compose v2.20+) — required only for integration tests
- **Git Bash** (Windows) or a bash-compatible shell

---

## Getting Started

```bash
# Clone the repo
git clone <your-repo-url> toroloom
cd toroloom

# Install frontend dependencies
npm ci

# Install backend dependencies
cd backend && npm ci && cd ..
```

> If you're adding **new dependencies**, use `npm install <pkg>` instead of `npm ci`.
> The lockfile is regenerated automatically during install.

---

## Running Tests

### Frontend Unit Tests

Runs TypeScript compilation check + all 1,300+ frontend unit tests:

```bash
npm test
```

### Backend Unit Tests

Runs TypeScript compilation check + backend unit tests (excludes integration tests):

```bash
cd backend
npm test     # or: npx vitest run --exclude='**/*.int.test.ts'
```

### Backend Integration Tests (Requires Docker)

Integration tests exercise the full data persistence layer against real PostgreSQL and MongoDB instances. Both databases are started automatically via Docker Compose.

**Quick one-liner** (start services → run tests → teardown):

```bash
npm run test:int
```

Or from the backend directory:

```bash
cd backend && npm run test:int
```

**Run with coverage** (start services → run tests with vitest coverage → teardown):

```bash
npm run test:int:coverage
```

**Keep services running** (for debugging or repeated test runs):

```bash
npm run test:int:up
```

**Run with coverage and keep services running:**

```bash
npm run test:int:coverage:up
```

Then rerun tests as many times as needed:

```bash
cd backend && npx vitest run --reporter=verbose src/__tests__/*.int.test.ts
```

Or with coverage:

```bash
cd backend && npx vitest run --reporter=verbose --coverage src/__tests__/*.int.test.ts
```

**Stop services** when done:

```bash
npm run test:int:down
```

> **Behind the scenes:** `scripts/run-integration-tests.sh` starts `postgres` and `mongodb` via `docker compose`, waits for Docker's built-in health checks to pass, runs `vitest *.int.test.ts`, then tears down. Flags are **combinable** — e.g., `--coverage --keep` runs with coverage and leaves services up. Use `--help` to see all options:
>
> ```bash
> bash scripts/run-integration-tests.sh --help
> ```
>
> **Available npm scripts:** `test:int`, `test:int:coverage`, `test:int:up`, `test:int:coverage:up`, `test:int:down`

### What Integration Tests Cover

| Test File | What It Tests |
|-----------|---------------|
| `storageMongoDB.int.test.ts` | Audit trail CRUD, risk profiles, broker state, health |
| `storagePostgres.int.test.ts` | Same as MongoDB, but against PostgreSQL |
| `auditTrail.*.int.test.ts` | Immutable audit log append/query across both backends |
| `brokerState.*.int.test.ts` | Broker dedup cache persistence |
| `brokerFactoryFlow.*.int.test.ts` | End-to-end broker creation and failover |
| `communityPersistence.*.int.test.ts` | Community posts/comments persistence |
| `notificationPersistence.*.int.test.ts` | Notification delivery state persistence |
| `orderExecutionPipeline.*.int.test.ts` | Full order lifecycle through risk engine + broker |
| `websocketPnLBridge.*.int.test.ts` | WebSocket → risk engine P&L updates and lockdown |
| `routes.int.test.ts` | REST API route handlers (auth, market, portfolio, etc.) |

All integration tests run in a **single process** (`fileParallelism: false` in `vitest.config.ts`) to prevent data races across test files that share the same database.

---

## CI/CD

Every push to `master`/`main` triggers a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs in parallel:

| Job | What It Does |
|-----|-------------|
| **Backend** | TypeScript check + unit tests (no DB) |
| **Frontend** | TypeScript check + frontend unit tests |
| **Backend — Integration (PG + Mongo)** | Integration tests against real PostgreSQL + MongoDB services |
| **Backend — WebSocket Stress** | Long-running (25 min) WebSocket P&L bridge load test |

> Running `npm run test:int` locally replicates what the **Backend — Integration (PG + Mongo)** CI job does, just on your machine.

---

## Code Style

- **TypeScript** — Strict mode. No `any` casts unless unavoidable.
- **React Native / Expo** — Functional components with hooks. Zustand for state management.
- **Backend** — Express with Zod validation. Broker interface pattern for Zerodha/Angel One.
- **Testing** — Vitest with `@testing-library/react-native` for frontend. Integration tests use real DB instances (no mocking the storage layer).

Before submitting a PR, make sure:

```bash
# Frontend
npx tsc --noEmit
npm test

# Backend
cd backend
npx tsc --noEmit
npm test

# Integration (requires Docker)
npm run test:int
```
