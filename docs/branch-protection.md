# Branch Protection Setup — E2E as a Required Check

Goal: make **"E2E — Full Suite (master)"** a required status check so a red E2E job can never be merged/landed unnoticed. This guide covers both UI mechanisms (rulesets and classic branch protection), the skipped-run tolerance rule that our `paths-ignore: docs/**` setup interacts with, and the enforcement caveats for direct pushes.

Repo facts (verified 2026-10-02): repo is **public** (both mechanisms available on the free plan), default branch **`master`**, CI workflow `.github/workflows/ci.yml`, docs-only pushes skip CI entirely (`810a985`).

---

## 1. Exact check names (copy these exactly)

A required check is matched by the **job's `name:`** — not the job id. Names contain em dashes (`—`); **select them from the picker list** instead of hand-typing, or the match will silently fail.

| Job id | Check name (exact) | Require? |
| --- | --- | --- |
| `e2e` | `E2E — Full Suite (master)` | **Yes — the headline check** |
| `dependency-audit` | `Dependency Audit Gate` | **Yes** (the registry-advisory gate that bit us in runs 31–34) |
| `backend` | `Backend` | Yes |
| `frontend-test-merge` | `Frontend Tests — Merge & Coverage Gates` | Yes (require this **merge job**, never the `Frontend Tests (n/m)` shards) |
| `frontend` | `Frontend — Static Checks (typecheck, lint, i18n parity)` | Optional |
| `e2e-pr` | `E2E — Critical Flows (PR)` | Optional (PR-only; runs only on `pull_request`) |
| `coverage-badge` | `Coverage Badge` | Optional |
| `bundle-size` | `Frontend — Bundle Size Guard (…)` | Avoid — matrix job; each platform reports its own name |
| `cross-file-isolation` / `backend-integration` / `stress` | `Backend — …` | Optional |

> Matrix jobs (shards/platforms) report **one check per matrix entry**. Require summary/merge jobs (`frontend-test-merge`), not shards — a required shard name is fragile and changes with the shard count.

---

## 2. Recommended: a ruleset (newer mechanism)

1. Repo → **Settings → Rules → Rulesets** → **New ruleset → New branch ruleset**.
2. **Ruleset name:** `master-protection`.
3. **Enforcement status:** `Active` (draft = evaluates nothing).
4. **Target branches:** *Add target* → **Include by pattern** → `master`.
5. **Bypass list** (optional but recommended for you): *Add bypass* → your own account with mode `Always` — lets you push emergency fixes without disabling protection. For a solo repo this is the sane default; skip it if you want the rule to bind even you.
6. Rules → tick **Require a pull request before merging** *only if* you want to move off direct pushes to `master` (see §5 — this changes your workflow).
7. Rules → tick **Require status checks to pass before merging**:
   - *Add status check* → type `E2E` → select **`E2E — Full Suite (master)`**.
   - Repeat for **`Dependency Audit Gate`**, **`Backend`**, **`Frontend Tests — Merge & Coverage Gates`**.
   - Leave **Require branches to be up to date before merging** unticked unless you want strict freshness (it forces re-runs after every master update).
8. (Optional) Also tick **Block force pushes** and **Restrict deletions** (both are cheap wins).
9. **Create** (the button at the bottom of the page).

## 3. Alternative: classic branch protection rule

1. Repo → **Settings → Branches → Branch protection rules → Add rule** (or *Add classic branch protection rule*).
2. **Branch name pattern:** `master`.
3. Tick **Require status checks to pass before merging**:
   - In the search box type `E2E` and select **`E2E — Full Suite (master)`** from the dropdown; add `Dependency Audit Gate`, `Backend`, `Frontend Tests — Merge & Coverage Gates` the same way.
4. Tick **Include administrators** if you want the rule to bind you too (otherwise repo admins bypass everything — the rule becomes decoration for a solo repo).
5. Leave **Require a pull request before merging** unticked to keep the current direct-push style.
6. **Create** / **Save changes**.

### API one-shot (alternative to both UIs)

Requires a token with **admin** on the repo. Classic-rule equivalent of §3:

```bash
curl -X PUT \
  -H "Authorization: token <YOUR_TOKEN>" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/ksjii666777-bit/toroloom/branches/master/protection \
  -d '{
    "required_status_checks": {
      "strict": false,
      "contexts": [
        "E2E — Full Suite (master)",
        "Dependency Audit Gate",
        "Backend",
        "Frontend Tests — Merge & Coverage Gates"
      ]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": null,
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
  }'
```

`"enforce_admins": true` is the classic rule's *Include administrators* switch. Verify with `GET /repos/…/branches/master/protection` (404 = no protection yet).

---

## 4. The skipped-run rule (paths-ignore interplay) — read before enabling

GitHub's documented behavior for required checks:

| Situation | Check reports | Required-check effect |
| --- | --- | --- |
| Workflow **skipped by path/branch filtering or commit message** (our `paths-ignore: docs/**`) | Stays **Pending** — no check run is ever created | **Blocks PR merging** ("Waiting for status to be reported") |
| **Job** skipped by a job-level `if:` condition | Reports **Success** | Satisfies the requirement ✅ |
| Check run state `success`, `skipped`, or `neutral` | — | All count as passing |
| Check exists and **failed** on the commit | `failure` | Blocks merge; direct push of that commit → `GH006: Protected branch update failed … Required status check "…" is failing` |

**What this means for this repo:**

- **Direct pushes to `master`** (current style): docs-only pushes simply don't create a run; there is no PR to block, so nothing gets stuck. Required checks + `paths-ignore` coexist fine here.
- **PRs that touch only docs**: once `E2E — Full Suite (master)` is required, such PRs would sit blocked forever with a pending E2E check. This is the trap the docs warn about: *"Avoid requiring workflows that can be skipped."*

**Tolerance options, best first:**

1. **Job-level skip instead of workflow-level skip** (recommended when you adopt PR flow): remove `paths-ignore` from the `on:` block and gate expensive jobs on a paths-filter condition — a skipped **job** reports Success, which *satisfies* required checks:

   ```yaml
   jobs:
     changes:
       runs-on: ubuntu-latest
       outputs:
         code: ${{ steps.f.outputs.code }}
       steps:
         - uses: actions/checkout@v4
         - uses: dorny/paths-filter@v3
           id: f
           with:
             filters: |
               code:
                 - '!(docs/**)'

     e2e:
       needs: changes
       if: needs.changes.outputs.code == 'true'
       # …existing e2e job unchanged…
   ```

   (Sketch only — gate the other heavy jobs the same way. Ask to have this implemented and dogfooded.)
2. **Keep `paths-ignore`, never require the E2E check** — require only always-running jobs (`Dependency Audit Gate`, `Backend`). Zero changes, weaker gate.
3. **Keep `paths-ignore` and require E2E anyway** — acceptable only while merges to `master` stay direct-push; breaks docs-only PRs (see above).

## 5. Enforcement reality — direct pushes vs PRs

Required status checks bite hardest on **PR merges**: pending (never-reported) or failed checks block the merge button. For **direct pushes**:

- A fresh commit's checks don't exist yet when you push → the push is **not** blocked; checks run after it lands.
- A commit whose required checks already **failed** is rejected on push (GH006, see table).
- Net: with direct pushes, protection is mostly *visibility* (the check is formally attached to master's head) — the hard block remains the workflow's own `::error::…BLOCKING` summary and the hard gate.

**Recommendation:** solo dev + fast iteration → enable §3 (or the API one-shot) now, keep direct pushes, tick *Include administrators* so the status is at least always enforced-visible on the branch. Move to ruleset + *Require a pull request before merging* (§2 step 6) + the §4 Option-1 job-level skip when you want true pre-merge enforcement — the suite is stable enough now (runs 30–36) that a ~2h pre-merge gate is a real option, especially with `cancel-in-progress` trimming superseded runs.

## 6. Verification checklist

1. **Non-docs change**: open a test PR touching `.maestro/**` → the PR's *Checks* tab must show `E2E — Full Suite (master)` running, and the merge box must list it as *required*.
2. **Docs-only change**: PR touching only `docs/**` → with §4 Option 1 the E2E job must report **Skipped (Success)**; without it, expect the pending-check block (expected behavior, not a bug).
3. **Failure path**: on a scratch branch, break a flow (e.g. an assert that can't match) → PR merge button must stay blocked while E2E is red.
4. **API check**: `GET /repos/ksjii666777-bit/toroloom/branches/master/protection` returns the rule; `GET /repos/…/commits/<sha>/check-runs` shows the check attached to master's head.

## 7. Rollback

- Ruleset: **Settings → Rules → Rulesets → master-protection → Edit** → set *Enforcement status* to `Disabled` (keeps the config) or delete the ruleset.
- Classic rule: **Settings → Branches → Edit** → *Delete rule*.
- API: `DELETE /repos/ksjii666777-bit/toroloom/branches/master/protection`.
