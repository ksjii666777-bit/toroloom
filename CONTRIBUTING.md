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
- **Testing** — Vitest with `@testing-library/react-native` for frontend. Integration tests use real DB instances (no mocking the storage layer). End-to-end tests use Maestro (see below).

---

## End-to-End Testing (Maestro)

Maestro provides declarative YAML-based E2E tests that run against a real Android emulator or device. All test flows are in `.maestro/flows/`.

### Quick Start

```bash
# Install Maestro CLI (macOS/Linux)
curl -Ls "https://get.maestro.mobile.dev" | bash

# Run all E2E flows
npx maestro test .maestro/flows

# Open Maestro Studio (interactive recorder)
npx maestro studio
```

### Test Flows

| Flow File | What It Tests |
|-----------|---------------|
| `auth/login.yaml` | Login with test credentials, verify Home screen |
| `auth/signup.yaml` | Navigate from Login → Signup, fill all fields, submit |
| `navigation/tabNavigation.yaml` | Navigate through all 5 bottom tabs, verify each screen |
| `smoke/smokeTest.yaml` | Full app smoke test: login → quick actions → markets → portfolio → logout |

```bash
# Run a single flow
npx maestro test .maestro/flows/auth/login.yaml

# Run tests against a specific app
npx maestro test .maestro/flows --app-id com.yourcompany.toroloom
```

### Configuration

The `.maestro/config.yaml` file sets:
- `appId` — The app bundle to test against (defaults to `host.exp.exponent` for Expo Go)
- `env` — Environment variables like `TEST_EMAIL` and `TEST_PASSWORD`

For development builds, change the `appId` to your production bundle.

### Writing Tests

Use Maestro Studio to record interactions, or write YAML flows manually:

```yaml
appId: host.exp.exponent
---
- assertVisible: "Welcome Back! 👋"
- tapOn: "Enter your email"
- inputText: "test@example.com"
- tapOn: "Log In"
- waitForAnimationToEnd
- assertVisible: "Good Morning,"
```

### Test IDs

The `Input` component accepts a `testID` prop for more robust element targeting in Maestro flows. You can also target elements by their visible text, placeholder, or accessibility label.

### Running on CI

The E2E suite runs as the `E2E — Maestro (Android)` job in CI, which:
1. Spins up an Android emulator (API 34) via `reactivecircus/android-emulator-runner`
2. Starts the Expo dev server (`npx expo start --android`)
3. Runs `maestro test .maestro/flows` against the emulator

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
