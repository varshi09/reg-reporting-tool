# 06 — Security Assessment

This assessment is based entirely on reading the source in `src/` and the configuration files in the repo root. It is written for a management audience but every claim is backed by a specific file.

## 1. Authentication — Critical gap

- **Hardcoded placeholder credentials.** `src/app/login/page.tsx` defines:
  ```
  const DEFAULT_USERNAME = "admin";
  const DEFAULT_PASSWORD = "Admin@123";
  ```
  These are compared directly in `handleSubmit()`. The code comment above them reads "Temporary placeholder credentials until real authentication is built," and the login form itself displays the text "Default credentials: admin / Admin@123 (placeholder — real authentication coming later)" to anyone who visits the page. **This is a self-documented prototype limitation, not a hidden vulnerability, but it must not reach a real deployment as-is.**
- **No password hashing.** There is no password store at all — no user table, no bcrypt/argon2/scrypt, nothing. The only "credential check" is a plaintext string comparison in client-side JavaScript.
- **No server-side login verification.** The credential check happens entirely in the browser (`src/app/login/page.tsx` runs client-side, marked `"use client"`). A user could bypass the login page entirely by manually setting `sessionStorage.setItem("rrt_logged_in", "true")` in the browser console — no server ever validates this.
- **No account lockout, no rate limiting, no MFA.**

## 2. Authorization — Critical gap

- **No RBAC or permission model exists anywhere in the code.** Every logged-in "session" (i.e., every browser with the `sessionStorage` flag set) has identical access to every page and every API route. There is no admin/maker/checker/viewer distinction, despite the UI labeling the single hardcoded user "Administrator" (`src/components/AppShell.tsx`, hardcoded text: `<p className="text-xs text-indigo-300">Administrator</p>`).
- **No API-level authorization at all.** As documented in `04-API-Documentation.md`, all 13 endpoints are callable by anyone who can reach the server, logged in or not — the frontend's `useRequireAuth` redirect only affects page navigation, not API access.

## 3. Session management — Critical gap

- Session state is two `sessionStorage` keys: `rrt_logged_in` and `rrt_username` (`src/lib/useRequireAuth.ts`). `sessionStorage` is:
  - Client-side only, trivially readable/writable via browser devtools.
  - Not sent to the server automatically (unlike cookies), so **the server has no concept of "who is logged in" at all** — it's purely a UI-layer convenience for showing/hiding nav and redirecting.
  - Cleared when the tab closes, but that's the only "expiry" — there is no session timeout, no idle-logout, no server-side revocation.
- **`submittedBy` in the submissions feature is taken from this same unverified client-side value** and written directly into the audit-relevant `REPORT_SUBMISSIONS` table (`src/app/api/submissions/route.ts`) — meaning the "who submitted this" audit field can be trivially spoofed by anyone editing `sessionStorage` before calling the API directly.

## 4. Transport security — Critical gap (by omission)

- **No HTTPS/TLS configuration exists in the repository.** `next.config.ts` only sets `allowedDevOrigins` for local dev hostnames (`regulatoryreporting`, `regulatoryreporting.localhost`, `regulatoryreporting.test`). `next start` (the production server script in `package.json`) serves plain HTTP by default; there is no reverse proxy config, no certificate handling, and no `Strict-Transport-Security` header logic anywhere in the code. TLS termination, if ever added, would need to happen at an external layer (load balancer/reverse proxy) not currently present in this repo — see `07-Deployment-Guide.md`.

## 5. Secrets management — Critical finding

- `.env.local` in the repo root contains Oracle database credentials as **plaintext environment variables** (`ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_CONNECT_STRING`). **Sensitive credential detected in source/configuration — must be moved to secure secret management.** The actual values are not reproduced in this document.
- To the repo's credit, `.gitignore` includes `.env*`, so this file is (correctly) excluded from version control — it will not be committed to git. However, it still sits on disk in plaintext with no encryption-at-rest and no access control beyond filesystem permissions, which is not adequate for a production secret in a regulated environment.
- `src/lib/db.ts` reads these directly via `process.env.ORACLE_USER` / `ORACLE_PASSWORD` / `ORACLE_CONNECT_STRING` — there is no integration with any secret manager (Vault, AWS/Azure/GCP secret stores, etc.).

## 6. SQL injection — Good practice, with one pattern worth flagging

This is the strongest part of the current security posture. Every `src/app/api/**/route.ts` file and `src/lib/db.ts` were inspected line-by-line for how SQL is constructed:

- **User-supplied values are consistently passed as Oracle bind parameters (`:paramName`)**, never string-concatenated into SQL text. Examples: `src/app/api/brf01/route.ts`'s `buildInClause()` helper builds `column IN (:eg0, :eg1, ...)` with each value placed in a `binds` object; `src/app/api/upload/route.ts` uses `connection.executeMany(insertSql, rows, { bindDefs })` with typed bind definitions (`oracledb.STRING` with explicit `maxSize`); `src/app/api/submissions/route.ts`'s `INSERT` and `src/app/api/upload-log/route.ts`'s filtered `SELECT` both bind every user-controlled value.
- **The only place table/column *identifiers* (not values) are interpolated into SQL strings** is in `src/app/api/reports/category-stats/route.ts` and `src/app/api/dashboard/stats/route.ts` (`` `SELECT COUNT(*) AS "CNT" FROM ${table} WHERE ROWNUM = 1` ``, `` `FROM ${table} WHERE time_key LIKE :prefix` ``) and in `src/app/api/brf01-suptech/*` (interpolating the `BRF01_SUPTECH_TABLE` constant) and `src/app/api/upload/route.ts` (interpolating `table.key` and column names into the `INSERT` statement). **In every one of these cases, the interpolated value originates only from the app's own static, hardcoded configuration** (`src/lib/reportCategories.ts` or `src/lib/uploadTables.ts`), never from request input — the code even has comments to this effect (e.g., `src/app/api/reports/category-stats/route.ts`: "Table names here come only from our own static config ..., never from user input, so interpolating them into SQL is safe"). **This is not an active SQL injection vulnerability today**, but it is a fragile pattern: if a future change ever lets a table/column name reach one of these code paths from user input (directly or indirectly), it would become one. Recommend migrating to an explicit allow-list lookup (e.g., a `Map` keyed by a validated enum) rather than raw string interpolation, even of "trusted" config values, as defense-in-depth.
- **No stored procedures** are used; all SQL is inline in route files.

## 7. Input validation

- Present but basic: file extension checks, `timeKey` regex (`^\d{8}$`), required-field presence checks in `src/app/api/upload/route.ts`; type checks (`typeof body.x === "string"`) in `src/app/api/submissions/route.ts`.
- **No request size limits, no rate limiting, no CSRF protection** were found anywhere in the codebase (no CSRF token generation/verification, no middleware for this).
- File upload accepts any `.xlsx`/`.csv` content up to whatever Next.js's default body size allows — no explicit virus/malware scanning, no file-size cap observed in code.

## 8. Audit trail

- Two tables provide **partial** audit capability: `UPLOAD_LOG` (who uploaded what file, when, and the outcome) and `REPORT_SUBMISSIONS` (who marked what as submitted, and when — though back-datable and self-reported, see above).
- **No audit trail exists for**: logins/logouts, page views, report generation/viewing, report downloads, or any read access to sensitive financial data. There is no "who looked at this report" record.
- No tamper-evidence (no hashing/chaining of audit records, no write-once storage).

## 9. Dependency/supply-chain posture

- Dependency list is small and from well-known publishers (`next`, `react`, `oracledb`, `exceljs`) — see `02-Technology-Stack.md`. No automated dependency scanning (Dependabot, `npm audit` in CI, Snyk, etc.) was found configured in the repo (no CI config exists at all — see `07-Deployment-Guide.md`).

## 10. Summary table

| Control area | Status | Evidence |
|---|---|---|
| Authentication | **Critical — placeholder only** | `src/app/login/page.tsx` hardcoded creds |
| Password hashing | **Not implemented** | No user table, no hashing library |
| Authorization / RBAC | **Not implemented** | No role concept in any file |
| Session management | **Critical — client-side only** | `src/lib/useRequireAuth.ts`, `sessionStorage` |
| API authorization | **Not implemented** | No route checks caller identity (`04-API-Documentation.md`) |
| Transport security (HTTPS) | **Not configured** | No TLS handling in `next.config.ts` or elsewhere |
| Secrets management | **Critical — plaintext** | `.env.local` (gitignored, but on-disk plaintext) |
| SQL injection protection | **Good** | Bind variables used consistently for all user-supplied values |
| CSRF protection | **Not implemented** | No CSRF tokens/middleware found |
| Rate limiting | **Not implemented** | None found |
| Audit trail | **Partial** | `UPLOAD_LOG`, `REPORT_SUBMISSIONS` only; no login/access audit |
| Dependency scanning | **Not implemented** | No CI, no `npm audit` automation |

## Bottom line

The application's SQL-handling discipline is genuinely good and should be preserved as the codebase grows. Everything else in this list — authentication, authorization, session integrity, transport security, and secrets handling — is either missing or explicitly a placeholder, and **all of it must be addressed before this system could hold real customer or regulatory financial data in a production environment.** See `12-Risks-and-Roadmap.md` for prioritization.
