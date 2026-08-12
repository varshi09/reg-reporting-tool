# 09 — Management Q&A

Plain-language answers for a non-technical audience, grounded in the actual codebase. Grouped by theme; 40+ questions total.

## General / What is this

**Q1. What is this system, in one sentence?**
A. A prototype web portal that lets bank staff upload data, generate two specific CBUAE regulatory reports, and track (not perform) their submission to the Central Bank.

**Q2. Is this live / in production anywhere?**
A. Not identifiable from the current codebase — there is no deployment configuration, no production URL, and no CI/CD pipeline present in the repository. Everything points to this being run locally by a developer (`start-dev.bat`).

**Q3. What bank regulatory framework does this target?**
A. CBUAE's Banking Return Framework (BRF) — the login page and navigation are explicitly branded "CBUAE Regulatory Reporting" / "Banking Return Framework Reporting Portal."

**Q4. How many of the ~90 report types listed in the app actually work?**
A. Two: "BRF 01 - Assets" and "BRF 1.1 - Assets" (a Sup Tech variant). Everything else in the catalog (`src/lib/reportCategories.ts`) is a labeled placeholder.

**Q5. Are reports actually sent to CBUAE by this system?**
A. No. The app only lets a user record, after the fact, that they submitted a report through some other channel. There is no code anywhere that transmits data to CBUAE.

**Q6. Who built this and how long did it take?**
A. Not identifiable from the current codebase — no commit history, changelog, or authorship metadata was reviewed as part of this audit (this audit is based on the code as it exists on disk today).

## Functionality

**Q7. What can a user actually do today?**
A. Log in (with a shared placeholder password), see dashboard stats, upload a customer data file, view/filter/download two BRF reports, and mark report periods as submitted.

**Q8. What file types can be uploaded?**
A. `.xlsx` and `.csv` only, and only for one destination table (customer data) — enforced by a strict filename pattern (`DIM_CUSTOMER_YYYYMMDD.xlsx`).

**Q9. What happens if I upload a file with the wrong name?**
A. It's rejected before any data is written — the app can't determine which table it belongs to.

**Q10. What happens if some rows in my upload are incomplete?**
A. Those specific rows are skipped and logged with a reason; the rest of the valid rows are still inserted.

**Q11. Does uploading data automatically make it appear in the BRF reports?**
A. No — for the two live reports, no code path was found that moves uploaded data into the tables those reports read from. That linkage, if it exists, happens outside this application today.

**Q12. Can I download reports as Excel files?**
A. Yes, for the two live reports, with formatting that matches CBUAE's expected layout.

**Q13. Is there a way to see historical reports that were generated in the past?**
A. Not yet — the "Report Library" page is a placeholder with no logic behind it.

**Q14. Can the system check a report for errors before I submit it?**
A. No — there is no validation engine. The "Validation" page is a placeholder.

**Q15. Can the system compare the report against our general ledger?**
A. No — there is no reconciliation logic. The "Reconciliation" page is a placeholder.

**Q16. Is there an audit trail of who submitted what and when?**
A. Partially — uploads and "marked as submitted" events are logged with a user name and timestamp, but that user name is self-reported and not verified by any login system, and no other user actions (logins, report views, downloads) are logged.

## Security

**Q17. Is the login secure?**
A. No. It's a single hardcoded username/password shared by everyone, checked in the browser, with no password hashing and no server-side verification.

**Q18. Can two different employees have different access levels (e.g., preparer vs. approver)?**
A. No — there is no concept of user roles or permissions anywhere in the system. Everyone who logs in has identical access to everything.

**Q19. Is our data encrypted in transit (HTTPS)?**
A. Not currently configured in this codebase. It would need to be added at the infrastructure layer before any real deployment.

**Q20. Where are the database credentials stored?**
A. In a plaintext configuration file (`.env.local`) on the server's filesystem. It is excluded from version control, but that's not equivalent to secure secret management — see `06-Security-Assessment.md`.

**Q21. Is the system vulnerable to SQL injection?**
A. Based on code review, no evidence of an exploitable SQL injection vulnerability was found — the code consistently uses parameterized queries for all user-supplied values. One structural pattern (table names built from static internal config, not user input) is flagged as worth hardening further as a precaution, not because it's currently exploitable.

**Q22. Can someone use the API directly, bypassing the login screen?**
A. Yes. None of the 13 backend API endpoints check who is calling them — the login screen only controls what's shown in the browser UI, not what the server will accept.

**Q23. What's the single biggest security risk today?**
A. The combination of no real authentication and no API-level access control — anyone who can reach the server can read and write regulatory data without logging in at all.

**Q24. Is this system compliant with banking data protection standards today?**
A. No — it lacks the baseline controls (real authentication, encryption in transit, access control, comprehensive audit logging) that banking data protection standards typically require. This must be remediated before handling real customer/regulatory data.

## Data & Compliance

**Q25. Where does the actual regulatory data come from?**
A. Uploaded files (for customer data) and — for the two live reports — from database tables that, per this codebase, must be populated by some process outside the application. That external process was not part of this audit.

**Q26. Is there a record of every value that ever appeared in a submitted report?**
A. No versioning/history of report contents was found — reports are generated live from current database state each time they're viewed or exported.

**Q27. What database technology holds the data?**
A. Oracle Database (21 XE, per the environment naming), accessed via the `oracledb` Node.js driver.

**Q28. Is customer data being sent anywhere outside the bank's own database?**
A. No third-party or external service integrations of any kind were found in the code — everything stays within the app and its Oracle database.

**Q29. How is "who submitted this to CBUAE" recorded — can we trust it?**
A. It's recorded as a self-reported entry (a user clicks "Mark as submitted" and can even backdate the timestamp). It should be treated as a tracking convenience, not as verified proof of transmission.

## Technical / Architecture

**Q30. What is this built with?**
A. Next.js 16 (a modern React web framework), TypeScript, Tailwind CSS for styling, and an Oracle database. Full inventory in `02-Technology-Stack.md`.

**Q31. Is the code quality good?**
A. For a prototype, yes — it's organized consistently, uses modern TypeScript, and follows a coherent pattern across similar features (e.g., the BRF01 and BRF01 Sup Tech reports mirror each other closely). It lacks tests and some production hardening.

**Q32. How many screens/pages does the app have?**
A. 15 distinct page routes, 8 of which appear in the main navigation menu; of those 8, 4 are fully functional flows (Home, Upload, Generate Report, Submissions) and 4 are placeholders (Validation, Report Library, Reconciliation, Settings).

**Q33. How many backend API endpoints exist?**
A. 13, across 12 route files. Full list in `04-API-Documentation.md`.

**Q34. Does the system scale to many concurrent users?**
A. Not tested as part of this audit, and the current setup (a single app process, a database connection pool capped at 5 connections) is sized for light/prototype use, not high concurrency.

**Q35. Is there a mobile app or is this web-only?**
A. Web-only; the UI is responsive (adapts to smaller screens) but there is no native mobile app.

## Deployment & Operations

**Q36. Can we deploy this today?**
A. Technically it can be run (`npm run build && npm run start`), but there's no containerization, no CI/CD, no TLS setup, and no process-management/monitoring configured — deploying "as-is" to production is not recommended given the security gaps above.

**Q37. Do we need Docker/Kubernetes to run this?**
A. Not strictly, but it's recommended for a supportable production deployment. Neither exists in the repo today; see `07-Deployment-Guide.md` for options.

**Q38. Is there automated testing before changes go live?**
A. No — there is no test suite and no CI pipeline in the repository.

**Q39. What happens if the app crashes — does it restart automatically?**
A. Not currently — that would require a process manager or container orchestrator, neither of which is configured yet.

**Q40. Is there a backup of the data?**
A. Not addressed by this codebase — database backup/DR is an infrastructure responsibility outside the application and wasn't found documented anywhere in the repo.

## Roadmap / Investment

**Q41. What's the fastest way to make this safe for a limited pilot?**
A. Replace the hardcoded login with real authentication tied to the bank's existing identity system, add API-level access checks, put it behind HTTPS, and move secrets to a proper secret manager — before any real data touches it. See `12-Risks-and-Roadmap.md`.

**Q42. What's the biggest remaining functional gap?**
A. Coverage — 88 of the ~90 listed report types, plus validation, reconciliation, and report history, are not built yet.

**Q43. How production-ready is this today, on a 0-100 scale?**
A. See `12-Risks-and-Roadmap.md` for the full scored breakdown; the headline number reflects a working prototype foundation with critical security and functional gaps still open.

**Q44. Should we keep building on this codebase or start over?**
A. The architectural foundation (framework choice, code organization, SQL discipline) is sound enough to build on — the gaps are in breadth of features and production hardening, not in needing a rewrite. This is a judgment call for the engineering lead, informed by the specifics in `08-Prototype-vs-Production.md`.

**Q45. What should management ask for next from the engineering team?**
A. A prioritized remediation plan against the Critical/High items in `12-Risks-and-Roadmap.md`, with authentication and API access control first, before any additional report types are built on top of an insecure foundation.
