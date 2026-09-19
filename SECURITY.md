# Security Policy — Toroloom

Toroloom is a trading-discipline platform: users connect real broker accounts, log real trades, and store financial analytics. We treat the security of that data — and of the broker-session tokens that touch real money — as a production-grade responsibility.

**Live deployment:** [`https://toroloom-production.up.railway.app`](https://toroloom-production.up.railway.app)
**Repository:** `ksjii666777-bit/toroloom`

---

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

### Preferred channel: GitHub Private Vulnerability Reporting

1. Open the repository → **Security** tab → **Report a vulnerability**
   (direct link: `https://github.com/ksjii666777-bit/toroloom/security/advisories/new`)
2. Describe the issue, impact, and — if possible — reproduction steps or a proof of concept.
3. Attach logs/screenshots only if they contain **no real user data or credentials**.

### Alternate channel

If GitHub is not an option, open a **security-specific** private contact via the maintainer account: `ksjii666777-bit`. Prefix the subject with `[SECURITY]` so it is never triaged as general support.

### What to include (helps us move fast)

| Field | Example |
|---|---|
| Affected area | `POST /api/auth/login`, `expo` app deep-link handler, WebSocket auth |
| Vulnerability type | SSRF, auth bypass, IDOR, token leakage, XSS, injection |
| Severity (your estimate) | CVSS v3.1 score or low/medium/high/critical |
| Reproduction | Steps, minimal request payload, PoC script |
| Impact | What an attacker gains (data access, account takeover, fund risk) |

### Our response commitments

| Stage | Target |
|---|---|
| Acknowledgement | **within 48 hours** |
| Initial assessment (severity + validity) | **within 5 business days** |
| Fix or mitigation for critical issues | **within 7 days** of confirmation |
| Fix for high/medium issues | **within 30 days** of confirmation |
| Public disclosure (coordinated advisory) | after the fix ships, credited to the reporter |

We will keep you informed at every stage and credit you in the advisory unless you prefer to stay anonymous. We ask for the standard 90-day coordinated disclosure window before any public detail is published. We do not pursue legal action against good-faith research that respects user data and this policy.

### Scope

**In scope:**
- `backend/` — Express API, WebSocket server, auth, payments webhooks, broker integrations
- Root Expo app (`src/`) — auth flows, deep links, secure token storage, WebView usage
- CI/CD configuration — workflow injection, supply-chain attacks against our pipelines
- The live deployment at `toroloom-production.up.railway.app`

**Out of scope:**
- Volumetric DoS / DDoS (report via your hosting provider's abuse channel instead)
- Social engineering of the maintainer, hosting provider, or app stores
- Automated scanner output without a demonstrated, reproducible impact
- Missing security headers on purely static marketing pages
- Vulnerabilities in third-party broker platforms (report those to the broker/SnapTrade)

### Safe testing rules

- Use **test accounts you created**; never access, modify, or exfiltrate real user data.
- No actions that degrade service availability for other users (no flooding, no resource exhaustion).
- Do not run proof-of-concepts that place real trades or touch real broker order endpoints.
- Stop and report immediately if you accidentally access real user data — do not download or retain it.

---

## Supported Versions

Toroloom deploys continuously from `master` — there are no maintained release branches.

| Version | Supported |
|---|---|
| `master` (live deployment) | ✅ Security fixes land here first |
| Older commits / local checkouts | ❌ Upgrade to latest `master` |

---

## Security Controls (current posture)

For transparency, and so security researchers know what is already hardened:

**Authentication & sessions**
- Passwords hashed with scrypt; timing-safe comparison.
- JWT on every REST route **and** every WebSocket connection.
- Two-factor authentication (TOTP + backup codes): login issues tokens only after both password **and** a valid second factor — the first leg returns no token (2FA bypass hardened).
- Client-supplied `role` fields are ignored at login — privilege escalation via request tampering is blocked (regression-tested).

**Token & secret storage**
- Mobile auth tokens live in the device's hardware-backed SecureStore (Keychain/Keystore), never plaintext AsyncStorage; legacy plaintext copies are auto-migrated and deleted.
- Broker session secrets (SnapTrade `userSecret`) are encrypted at rest with AES-256-GCM; production refuses to start without `SNAPTRADE_ENCRYPTION_KEY`.
- Secrets are validated at startup; the app fails closed on missing production config.

**API hardening**
- Helmet, strict CORS, per-route rate limiters with correct proxy trust for Railway.
- Input sanitization middleware on user-controlled fields.
- Payments webhook payloads verified with HMAC signatures.
- OTP flows: hashed storage, expiry, attempt limits.

**CI/CD supply chain**
- Dependencies install with `npm ci --ignore-scripts`; every package install script must be on a documented allowlist (`scripts/install-scripts-allowlist.mjs`) or CI fails.
- Dependency audit gate (`scripts/audit-gate.mjs`) fails CI on new high/critical CVEs in production dependencies and posts the exact CVE table on PRs.
- Dependabot keeps dependencies updated (weekly npm, monthly Actions).

---

## Security Update Process (maintainers)

1. Triage the report → confirm severity (CVSS v3.1) → open a private advisory.
2. Develop the fix on a private branch; add a regression test.
3. Verify: `npm run audit:gate`, full test suites, typecheck, lint.
4. Merge to `master` (Railway auto-deploys), confirm production health.
5. Publish the GitHub Security Advisory with credit; bump any affected dependency floors.
