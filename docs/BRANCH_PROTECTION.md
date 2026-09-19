# Branch Protection Setup — Pre-Beta Launch Checklist

> **Goal:** After this setup, **nothing reaches `master`** (and therefore production, via Railway auto-deploy) unless the full CI gauntlet is green and reviewed.

---

## 1. Prerequisites

- [ ] Repo admin access: `github.com/ksjii666777-bit/toroloom`
- [ ] All CI workflows have run at least once on the default branch (required checks only become selectable after their first run)
- [ ] Latest `SECURITY.md` and Dependabot config are on `master`
- [ ] No direct pushes to `master` needed for hotfixes — document the emergency-bypass plan (below) first

---

## 2. Exact required checks (check name → what it guards)

Path: **Settings → Branches → Add branch protection rule** → branch name pattern `master`.

Mark these as **Require status checks to pass before merging**:

### Tier 1 — must be required (blocking)

| # | Check name (exact) | Guards |
|---|---|---|
| 1 | `Dependency Audit Gate` | New high/critical CVEs in production deps |
| 2 | `Backend` | Backend typecheck + full unit suite |
| 3 | `Frontend — Static Checks (typecheck, lint, i18n parity)` | TS errors, lint, EN/HI i18n drift |
| 4 | `Frontend Tests (1/4)` | Frontend vitest shard 1 |
| 5 | `Frontend Tests (2/4)` | Frontend vitest shard 2 |
| 6 | `Frontend Tests (3/4)` | Frontend vitest shard 3 |
| 7 | `Frontend Tests (4/4)` | Frontend vitest shard 4 |
| 8 | `Frontend Tests — Merge & Coverage Gates` | Coverage thresholds + merged shard status |
| 9 | `Backend — Integration (PG + Mongo)` | Real Postgres/Mongo persistence flows |
| 10 | `Broker Integration Tests` | Angel One integration suite |
| 11 | `Calculator / Chat / Broker Tests` | Calculator + AI chat + broker units |
| 12 | `Public API Integration Tests` | Live market-data API contract |

### Tier 2 — required (same list, continued)

| # | Check name (exact) | Guards |
|---|---|---|
| 13 | `Backend — Cross-File Isolation` | Singleton state leaks across test files |
| 14 | `Backend — WebSocket Stress` | Concurrency/stress regressions |
| 15 | `E2E — Critical Flows (PR)` | Maestro flows on PRs (login, trade, journal) |
| 16 | `Frontend — Bundle Size Guard (android)` | Bundle growth ≤ +5% (Android baseline) |
| 17 | `Frontend — Bundle Size Guard (ios)` | Bundle growth ≤ +5% (iOS baseline) |
| 18 | `Locale Parity Check` | `hi/` locale keeps key parity with `en/` |

### Tier 3 — NOT required (context-only)

| Check name | Why not required |
|---|---|
| `E2E — Full Suite (master)` | Runs **only on master** (push) — it never reports on PRs; requiring it would hang merges in "Expected" state forever |
| `Coverage Badge` | Publishes badges post-merge; not a gate |
| `react-doctor` | Advisory code-quality hints; informational |
| `Grafana Config Validation` | Ops tooling only |

> **Note:** Job display names include matrix interpolations (`${{ matrix.shard }}` → `1/4`). GitHub registers the **rendered** names — the ones above are the rendered forms. Verify the exact list against the latest PR's checks sidebar before saving.

---

## 3. Branch protection rule settings

- [ ] **Require a pull request before merging** ✅
  - Required approvals: **1** (solo maintainer beta; raise to 2 at scale)
  - Dismiss stale pull request approvals when new commits are pushed ✅
  - Require approval from someone other than the last pusher ✅ (auto-enforced for solo accounts)
- [ ] **Require status checks to pass before merging** ✅ — add all Tier 1 + Tier 2 checks above
  - Require branches to be up to date before merging ✅ (prevents stale merges after a security fix lands)
- [ ] **Require conversation resolution before merging** ✅
- [ ] **Require signed commits** — optional; enable if you sign locally
- [ ] **Require linear history** ✅ — keeps `git revert` semantics clean for incident response
- [ ] **Include administrators** ✅ — **the single most important toggle**: the owner is also blocked from bypassing the gauntlet
- [ ] **Restrict force pushes** ✅ and **Restrict deletions** ✅ (defaults on)
- [ ] Do NOT add bypass list entries for beta (no "Admins bypass" exceptions)

---

## 4. Repository security toggles (Settings → Code security)

- [ ] **Dependabot security updates** → Enable (CVE fix PRs flow automatically)
- [ ] **Dependabot alerts** → Enable (dashboard visibility)
- [ ] **Secret scanning** → Enable
- [ ] **Push protection** → Enable (blocks pushes containing detected secrets)
- [ ] **Private vulnerability reporting** → Enable (powers the `SECURITY.md` flow)

---

## 5. Emergency-bypass plan (documented, not enabled)

For a production-incident hotfix when the gauntlet is red for unrelated reasons:

1. Temporarily edit the branch rule → uncheck **Include administrators** (or disable the rule).
2. Ship the minimal hotfix PR with the fastest green subset (Tier 1 checks only).
3. Deploy + confirm production health.
4. **Re-enable full protection immediately** and open a post-incident note in the repo.

The bypass window is minutes, not hours — and it leaves an audit trail in the repo's settings history.

---

## 6. Post-setup verification

- [ ] Open a trivial PR (typo fix) → confirm **all** required checks appear as "Expected/Required"
- [ ] Merge it → confirm `E2E — Full Suite (master)` runs on the merge commit
- [ ] Try a direct push to `master` → confirm it is rejected
- [ ] Confirm Railway deploy triggered by the merge commit (production = master parity)

---

*Maintain this checklist: whenever a workflow job is added/renamed, update the tables above in the same PR.*
