# E2E Full-Suite Stabilization — Runbook

> **Problem this solves:** The master-only `E2E — Full Suite` job failed on every
> run since the workflow existed with "Login screen never appeared" — the release
> APK installed fine, then the app died at cold start.
>
> **ROOT CAUSE (fixed):** NOT emulator flake — a deterministic JS crash. The
> metro resolver stub for Sentry's browser-only packages
> (`metro/sentry-browser-stub.js`) did not export `buildFeedbackIntegration`,
> which `@sentry/browser`'s feedbackAsync/feedbackSync modules CALL at module
> init. Result: `TypeError: undefined is not a function` during module
> evaluation → runtime killed before first paint → no login screen, every
> launch, every device. Diagnosed via the hardened boot script's crash-buffer
> capture + `metro-symbolicate`; fixed by exporting an inert integration from
> the stub, with a regression guard in `src/__tests__/sentryBrowserStub.test.ts`.
>
> The levers below remain valuable: the boot hardening is what made the
> diagnosis possible, and Maestro Cloud / a KVM runner still removes the
> shared-emulator variability from the equation.

---

## What changed in CI (`.github/workflows/ci.yml`)

| Layer | Mechanism | Default |
|---|---|---|
| **1. Runner escape hatch** | `runs-on: ${{ vars.E2E_RUNNER_LABELS || 'ubuntu-latest' }}` | GitHub-hosted ubuntu |
| **2. Maestro Cloud path** | Secret `MAESTRO_CLOUD_API_KEY` set → local emulator step **skipped entirely**; release APK built with plain gradle (no device needed) and flows run on Maestro Cloud | inactive (secret unset) |
| **3. Visible soft-fail** | `if: always()` step appends the *real* outcome to the GitHub run summary table + `::warning::` annotation on failure | always on |
| **4. Hardened local boot** | `.github/scripts/e2e-boot.sh`: up to 6 launch attempts, per-attempt UI polling (90s), process-death detection, `logcat -b crash` stack capture **including the JS Abort message**, `pm clear` between attempts | always on (emulator mode) |

The same summary row was added to `e2e-pr` (the PR blocking job), so its merge
gate is auditable at a glance.

---

## Activation lever A — Maestro Cloud (recommended first)

No emulator ever boots on the runner; Maestro runs the flows on real/cloud
devices and reports results.

1. Sign up at [maestro.mobile.dev/cloud](https://maestro.mobile.dev/cloud) (has a
   free tier; usage-based after).
2. Get the API key (Maestro Console → API Keys).
3. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `MAESTRO_CLOUD_API_KEY`
   - Secret: the key from step 2
4. (`TEST_EMAIL` / `TEST_PASSWORD` already exist — the cloud run passes them via
   `--env`, and the flows already read them.)
5. Push anything to master → the `e2e` job now shows
   `Build release APK and run full suite on Maestro Cloud` instead of the
   emulator boot.

**Rollback:** delete the secret — next run falls back to the (hardened) local
emulator automatically. No code change in either direction.

## Activation lever B — self-hosted KVM runner

Stable hardware KVM removes the shared-CPU emulator boot flakiness entirely.

1. Provision a Linux box/VM with nested KVM (`/dev/kvm` present), 4+ cores,
   8 GB+ RAM, Docker or the runner agent installed.
2. Register a GitHub Actions runner on the repo, and label it, e.g.
   `self-hosted,linux,kvm`.
3. GitHub repo → **Settings → Secrets and variables → Actions → Variables tab → New repository variable**
   - Name: `E2E_RUNNER_LABELS`
   - Value: `self-hosted,linux,kvm` (must be a valid `runs-on` expression)
4. From the next push, the `e2e` job queues on that runner. The job's
   `Enable KVM` step is idempotent and safe on real KVM hosts.

**Rollback:** delete the `E2E_RUNNER_LABELS` variable.

---

## Reading the results

Every `e2e` run appends a row to the run summary:

| E2E Full Suite | status | mode |
|---|---|---|
| ✅ success | boot + all flows passed | local emulator *or* Maestro Cloud |
| ❌ failed (soft-fail) | flows failed or app crashed | mode shown |

A failure row means: open the job logs, scroll to
`---- CRASH buffer (logcat -b crash, last 80) ----` — the actual exception stack
is printed there (previously this was the missing evidence).

> ⚠️ The job remains `continue-on-error: true` **by design** until lever A or B
> is active: emulator flake must not block releases. Once on Maestro Cloud or a
> KVM runner, consider flipping `continue-on-error` to `false` and making E2E a
> real release gate (see `docs/BRANCH_PROTECTION.md`).

---

## Related files

- `.github/workflows/ci.yml` — `e2e:` and `e2e-pr:` jobs
- `.github/scripts/e2e-boot.sh` — hardened boot + launch cycle (emulator mode)
- `.maestro/flows/` — the flow suite the job executes
