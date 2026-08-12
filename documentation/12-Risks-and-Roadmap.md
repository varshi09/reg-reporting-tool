# 12 — Risks, Gaps, and Roadmap

## Gap register, by severity

Severity reflects impact if this system were deployed to handle real regulatory/customer data as-is, not the effort to fix it.

### Critical

| # | Gap | Evidence | Why it's critical |
|---|---|---|---|
| C1 | Hardcoded, shared, unhashed login credentials | `src/app/login/page.tsx` (`admin`/`Admin@123`) | Anyone who knows or guesses the credentials has full access; the page even displays the credentials publicly |
| C2 | No server-side session or API authorization | `src/lib/useRequireAuth.ts`, all files in `src/app/api/**` | All 13 API endpoints are callable by anyone reaching the server, logged in or not |
| C3 | No RBAC / permission model | No role concept found in any file | No maker/checker separation, which is a standard control expectation for regulatory submissions |
| C4 | No HTTPS/TLS configuration | `next.config.ts`, repo-wide search | Data (including credentials, if ever real) would transit in plaintext without infrastructure remediation |
| C5 | Plaintext database credentials on disk | `.env.local` | Not a secure secrets-management practice, even though the file is gitignored |
| C6 | No verified linkage from uploaded data into the two live reports' source tables | No `INSERT`/`UPDATE`/`MERGE` into `BRF01_SUMMARY`/`BRF01_SUPTECH_SUMMARY` found anywhere in `src/` | Whoever assumes "upload → automatically reflected in the report" today is assuming something the code does not do |

### High

| # | Gap | Evidence | Why it's high |
|---|---|---|---|
| H1 | 88 of ~90 catalogued CBUAE report types are unbuilt placeholders | `src/lib/reportCategories.ts` (`comingSoon: true`) | The core business value proposition (comprehensive BRF reporting) is ~2% delivered by report-type count |
| H2 | No validation engine | `src/app/validation/page.tsx` (stub) | No automated protection against submitting an incorrect regulatory return |
| H3 | No reconciliation logic | `src/app/reconciliation/page.tsx` (stub) | No GL-vs-BRF break detection, a standard control in bank regulatory reporting |
| H4 | No CI/CD pipeline | No workflow files found in repo | Every change ships without automated build/lint/test verification |
| H5 | No automated test coverage | No test files or `test` script found | Regressions can only be caught manually |
| H6 | No containerization / reproducible deployment | No `Dockerfile` found | Deployment is manual and not repeatable across environments |
| H7 | No CSRF protection or rate limiting | No such middleware/tokens found in `src/` | Standard web-app hardening missing across all forms and API calls |
| H8 | Audit trail covers only uploads and submissions, not logins/views/downloads | `UPLOAD_LOG`, `REPORT_SUBMISSIONS` tables only | Insufficient for a full forensic/compliance audit trail |

### Medium

| # | Gap | Evidence | Why it's medium |
|---|---|---|---|
| M1 | Table/column identifiers built via string interpolation (from static config only, not user input) | `src/app/api/reports/category-stats/route.ts`, `src/app/api/dashboard/stats/route.ts`, `src/app/api/upload/route.ts`, `src/app/api/brf01-suptech/*` | Not currently exploitable, but a fragile pattern worth hardening with an explicit allow-list |
| M2 | Report catalog is hardcoded in TypeScript, not database-driven | `src/lib/reportCategories.ts` | Every new report type requires a code change and redeploy |
| M3 | Export routes duplicate the on-screen query logic rather than reusing it | `src/app/api/brf01/export/route.ts` vs. `src/app/api/brf01/route.ts` (near-identical SQL) | Maintenance risk — a future query change could be applied to one and not the other |
| M4 | No health-check endpoint or graceful shutdown for the DB pool | `src/lib/db.ts` | Complicates operational monitoring and clean restarts |
| M5 | `submittedBy` is client-supplied and unverified | `src/app/api/submissions/route.ts` | Audit field can be spoofed without a real authentication layer (dependent on C1/C2) |
| M6 | No structured logging/monitoring | No logging library in dependencies | Harder to diagnose issues in a live environment |

### Low

| # | Gap | Evidence | Why it's low |
|---|---|---|---|
| L1 | Tabler icon CSS classes referenced but no stylesheet loaded | `src/lib/reportCategories.ts` `icon` fields, `src/app/reports/[category]/page.tsx` | Cosmetic only — icons simply don't render, no functional impact |
| L2 | `Geist Mono` font loaded but not visibly applied anywhere | `src/app/layout.tsx`, `src/app/globals.css` | Unused asset, negligible overhead |
| L3 | `"pending"` stat always returns `null` | `src/app/api/reports/category-stats/route.ts` (explicit comment: "Not computable yet") | Already honestly represented as "—" in the UI, not a bug so much as an unbuilt feature |

## Production-readiness score: **28 / 100**

This score reflects the system's readiness to handle real customer and regulatory data in a production banking environment. It is intentionally not inflated — a prototype with a sound architecture is still far from production-ready if authentication, authorization, and 98% of the feature scope remain unbuilt.

| Category | Score | Max | Rationale |
|---|---|---|---|
| **Functionality / feature completeness** | 7 | 25 | 2 of ~90 report types work end-to-end; no validation, reconciliation, report library, or settings; no verified data pipeline into the two live reports' source tables |
| **Security** | 5 | 25 | Strong SQL-injection hygiene is the one bright spot; everything else (auth, sessions, RBAC, transport, secrets, CSRF/rate limiting) is missing or placeholder |
| **Architecture / code quality** | 10 | 15 | Clean, modern, consistently organized codebase with TypeScript throughout; loses points for no caching/scaling design, some query duplication, and a hardcoded (non-DB-driven) report catalog |
| **DevOps / deployment readiness** | 1 | 15 | No Dockerfile, no CI/CD, no tests, no monitoring, no health checks — only a local dev convenience script exists |
| **Audit trail / compliance readiness** | 5 | 20 | Basic upload and submission logging exists and is a real foundation; missing login/access audit, tamper-evidence, and any validation/reconciliation control evidence expected in a regulatory context |
| **Total** | **28** | **100** | |

## Roadmap (sequenced by risk reduction per unit of effort)

### Phase 1 — Make it safe to pilot with real data (address all Critical items)
1. Replace hardcoded login with real authentication (bank SSO/LDAP/OIDC), server-verified sessions.
2. Add authorization checks to every API route; introduce a basic role model (at minimum: viewer vs. preparer vs. submitter).
3. Put TLS in front of the app (reverse proxy/load balancer) and enforce HTTPS.
4. Move DB credentials to a proper secret manager.
5. Document/confirm the actual data pipeline that populates `BRF01_SUMMARY`/`BRF01_SUPTECH_SUMMARY` — if none exists yet, this blocks any real-data pilot regardless of the other fixes.

### Phase 2 — Operational hardening (High items)
6. Containerize the app; stand up CI (lint, build, then tests as they're written).
7. Add automated tests, starting with the upload and report-generation paths (highest business risk).
8. Expand the audit trail to cover logins, report views, and downloads.
9. Add CSRF protection and basic rate limiting.

### Phase 3 — Close the functional gap (High/Medium items)
10. Prioritize and build out the highest-priority remaining report types from the ~88 placeholders, based on the bank's actual regulatory calendar.
11. Build the validation engine.
12. Build the reconciliation engine.
13. Build the Report Library (historical archive).
14. Move the report catalog from hardcoded TypeScript to a database-driven config.

### Phase 4 — Polish (Medium/Low items)
15. Deduplicate export vs. on-screen query logic.
16. Add health-check endpoint, graceful DB pool shutdown, structured logging.
17. Fix the missing Tabler icon stylesheet (or replace with the existing hand-rolled icon set for consistency).

## Closing assessment

This is a credible, honestly-labeled prototype with a sound technical foundation and one genuine strength (SQL injection hygiene) that should be preserved and extended, not thrown away. The distance to production is real and should be communicated plainly to stakeholders: it is measured in security fundamentals that are entirely missing today, and in feature breadth that is roughly 2% delivered against the full CBUAE BRF catalog referenced in the app's own navigation.
