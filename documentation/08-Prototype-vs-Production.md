# 08 — Prototype vs. Production Comparison

Every "Prototype (today)" cell below is grounded in a specific file; every "Production requirement" cell is a recommendation, clearly separated.

| Area | Prototype (today) | Evidence | Production requirement |
|---|---|---|---|
| **Authentication** | Hardcoded `admin`/`Admin@123`, client-side only | `src/app/login/page.tsx` | Bank SSO/LDAP/OIDC integration; server-verified identity |
| **Password storage** | None — no user store exists | N/A | Hashed (bcrypt/argon2) credential store, or delegate entirely to SSO |
| **Session** | `sessionStorage` flags, forgeable, no server session | `src/lib/useRequireAuth.ts` | Server-issued session (signed cookie/JWT), expiry, revocation |
| **Authorization** | None — every user has identical access | No role concept found anywhere in `src/` | RBAC: maker/checker workflow, report-level and action-level permissions |
| **API security** | 0 of 13 endpoints check caller identity | `04-API-Documentation.md` | Every route validates session + role before executing |
| **Transport** | Plain HTTP; no TLS config in repo | `next.config.ts` | TLS everywhere, HSTS, TLS termination at proxy/load balancer |
| **Secrets** | Plaintext `.env.local` on disk (gitignored, not committed) | `.env.local`, `.gitignore` | Centralized secret manager (Vault/KMS), rotated credentials |
| **SQL construction** | Bind variables used consistently for values; table/column identifiers interpolated only from static app config | All `src/app/api/**/route.ts` | Keep bind-variable discipline; replace remaining string-interpolated identifiers with an allow-list lookup as defense-in-depth |
| **Report catalog coverage** | 2 of ~90 listed CBUAE report types functional | `src/lib/reportCategories.ts` (`comingSoon: true` on ~88 entries) | Build out remaining report types per bank's actual regulatory obligations and priority |
| **Validation engine** | Does not exist; upload-time field-presence checks only | `src/app/validation/page.tsx` (stub), `src/app/api/upload/route.ts` (basic checks) | Rule engine validating generated reports against CBUAE business rules before submission |
| **Reconciliation** | Does not exist | `src/app/reconciliation/page.tsx` (stub) | GL-vs-BRF break analysis and resolution workflow |
| **Report Library** | Does not exist | `src/app/report-library/page.tsx` (stub) | Historical archive of generated/submitted reports with retrieval |
| **Settings** | Does not exist | `src/app/settings/page.tsx` (stub) | User/account management, system configuration UI |
| **CBUAE submission** | Manual, entirely outside the app; app only records a self-reported flag | `src/app/api/submissions/route.ts` | Either formalize the manual process with stronger controls, or build a real CBUAE submission gateway per their integration spec (business decision required) |
| **Audit trail** | Upload log and submission log only | `UPLOAD_LOG`, `REPORT_SUBMISSIONS` tables | Full, tamper-evident audit of logins, views, downloads, and all data changes |
| **Data load into report tables** | No ETL code found; `BRF01_SUMMARY`/`BRF01_SUPTECH_SUMMARY` are read-only from the app's perspective | Repo-wide search found no `INSERT`/`UPDATE`/`MERGE` targeting these tables | A documented, owned, auditable data pipeline from source systems into these tables |
| **Deployment** | `npm run dev` via a hardcoded local batch script | `start-dev.bat` | Containerized (Docker), orchestrated, environment-separated deployment |
| **CI/CD** | None | No workflow/pipeline files found in repo | Automated build/lint/test/scan/deploy pipeline |
| **Testing** | None — no test files, no test framework, no `test` script | `package.json` has no `test` script; no `*.test.ts`/`*.spec.ts` files found | Unit, integration, and end-to-end test coverage, run in CI |
| **Monitoring/Logging** | None — default console output only | No logging library in dependencies | Structured logging, APM, alerting |
| **Scalability** | Single process, single Oracle connection pool (min 1, max 5) | `src/lib/db.ts` | Horizontally scaled app tier, tuned connection pooling, load balancing |
| **Disaster recovery** | Not addressed anywhere in the app | N/A | DB backup/restore policy, app redeployability, documented RTO/RPO |
| **UI/UX chrome** | Functional, styled with Tailwind v4 + IBM Plex Sans, custom SVG icon set | `src/components/icons.tsx`, `src/app/globals.css` | Largely reusable as-is; minor fix needed (Tabler icon classes referenced but no Tabler stylesheet loaded — see `02-Technology-Stack.md`) |

## What should NOT need to change

To be fair to the existing work: the **code organization is sound** and much of it can carry forward into a production build without a rewrite —
- The App Router page/API structure.
- The `withConnection()` pooling pattern in `src/lib/db.ts` (though pool size and lifecycle handling need production tuning).
- The bind-variable SQL discipline.
- The shared Excel-generation helpers in `src/lib/excelReportTemplate.ts`.
- The static report-catalog data model in `src/lib/reportCategories.ts` (though it should likely move to the database once the catalog grows, to avoid a code deploy for every new report type).

The gap is overwhelmingly in **security, breadth of functionality, and operational tooling**, not in the core architecture's shape.
