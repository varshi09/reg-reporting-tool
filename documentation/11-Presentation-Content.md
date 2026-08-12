# 11 — Presentation Content (12–15 slide structure with speaker notes)

Structure for a management/stakeholder deck. Each slide entry gives the headline, the on-slide content, and speaker notes. All facts are grounded in the codebase (cross-referenced to the relevant doc file).

---

### Slide 1 — Title
**Headline:** CBUAE Regulatory Reporting Tool — Prototype Status Review
**Content:** Project name, date, presenter, "Code-grounded technical & business review."
**Speaker notes:** Frame the deck up front as based on direct code inspection, not on memory or assumptions — this sets an honest, credible tone for the harder slides later.

### Slide 2 — What we set out to build
**Headline:** A portal to generate and track CBUAE Banking Return Framework (BRF) submissions
**Content:** One-line mission; mention the ~90-report CBUAE catalog as the eventual target scope.
**Speaker notes:** Establish scope before showing how much of it is done — avoids the "wait, only 2 reports?" reaction landing as a surprise later.

### Slide 3 — What works today
**Headline:** A real, working foundation
**Content:** Bullet list: login flow, live dashboard, file upload with validation, two full CBUAE reports (BRF 01, BRF 1.1 Sup Tech) with filtering and Excel export, submission tracking.
**Speaker notes:** Everything on this slide is backed by real code and a real database connection — not mockups. Reference `01-Executive-Summary.md`.

### Slide 4 — Live demo
**Headline:** [Demo]
**Content:** Screenshot or link out to a live walkthrough — use `10-Demo-Script.md` as the run-of-show.
**Speaker notes:** Follow the 7-step demo script; keep to ~12 minutes; end on the submissions feature so the "does this talk to CBUAE?" question can be answered proactively before it's asked.

### Slide 5 — The #1 question, answered directly
**Headline:** Does this system submit reports to CBUAE?
**Content:** Big, unambiguous: **No.** The app tracks that a submission happened; it does not perform it. Diagram: Excel file → [manual, external] → CBUAE, with "Mark as submitted" as a self-reported log entry.
**Speaker notes:** Lead with this rather than waiting for it to come up — it's the single most consequential fact in the whole review and burying it undermines trust.

### Slide 6 — What's not built yet
**Headline:** Clearly labeled gaps, not hidden ones
**Content:** Validation engine, reconciliation, report library, settings — all "Coming soon" stubs with zero backend logic. 88 of ~90 catalog report types are placeholders.
**Speaker notes:** Emphasize these are honestly labeled in the product itself (`ComingSoonPage.tsx`) — this reflects disciplined, non-deceptive prototype development.

### Slide 7 — Security posture: the hard truth
**Headline:** Not production-ready for real data yet
**Content:** Hardcoded shared login, no password hashing, no roles/permissions, no HTTPS configured, no API-level access control, plaintext DB credentials in a config file.
**Speaker notes:** State plainly that none of this is unusual for an early prototype, but all of it is a hard blocker before real customer/regulatory data touches the system. Reference `06-Security-Assessment.md`.

### Slide 8 — Security posture: the good news
**Headline:** The database layer was built carefully
**Content:** Consistent use of parameterized SQL queries across all 13 API endpoints — no SQL injection vulnerabilities identified in code review.
**Speaker notes:** Balance slide 7 — give credit where the engineering discipline is genuinely solid, so the team doesn't feel the whole thing was dismissed.

### Slide 9 — Technology choices
**Headline:** Modern, maintainable stack
**Content:** Next.js 16 + TypeScript + Tailwind CSS v4 (frontend/backend in one framework), Oracle Database 21 XE, Excel generation via `exceljs`. Small, well-known dependency list (4 runtime packages).
**Speaker notes:** Reference `02-Technology-Stack.md`. Note the stack is current/modern, which is a maintainability asset, but also newer than most engineers' existing familiarity — factor ramp-up time into planning.

### Slide 10 — Architecture snapshot
**Headline:** Simple today, by design — but not yet scale- or security-ready
**Content:** Single Next.js process, direct-to-database API routes, no caching, no queueing, client-side-only session. Show the "current architecture" Mermaid diagram from `03-System-Architecture.md`.
**Speaker notes:** This is appropriate for a prototype and should not be read as a criticism on its own — the concern is only that none of the production-hardening layers exist yet.

### Slide 11 — What production requires
**Headline:** The path from prototype to production
**Content:** Side-by-side table (condensed from `08-Prototype-vs-Production.md`): auth, HTTPS, RBAC, secrets management, CI/CD, containerization, testing, monitoring.
**Speaker notes:** Present as a roadmap, not a criticism — each row is a known, solvable engineering task, not a fundamental flaw in the approach.

### Slide 12 — Risk summary
**Headline:** Where the risk actually sits
**Content:** Critical / High / Medium / Low gap counts (from `12-Risks-and-Roadmap.md`), with the top 3 Critical items called out by name (auth, API access control, HTTPS/secrets).
**Speaker notes:** Keep this slide short and specific — avoid a wall of bullets; the goal is for the room to leave knowing the top 3 blockers by name.

### Slide 13 — Production-readiness score
**Headline:** Where we stand, numerically
**Content:** The overall score out of 100 and its category breakdown (Functionality, Security, Architecture/Code Quality, DevOps/Deployment, Audit/Compliance) — see `12-Risks-and-Roadmap.md` for the exact numbers and rationale; do not round up.
**Speaker notes:** Explain the scoring methodology briefly so the number isn't read as arbitrary — it's a direct reflection of the gap list on the previous slides, not a separate judgment call.

### Slide 14 — Recommended next steps
**Headline:** What we recommend doing first
**Content:** Ordered list: (1) real authentication + API access control, (2) HTTPS + secrets management, (3) decide and resource the report-catalog build-out priority, (4) containerize + CI, (5) validation/reconciliation engines.
**Speaker notes:** Anchor this explicitly to `12-Risks-and-Roadmap.md`'s Critical/High list so it's clear the sequencing isn't arbitrary — security fixes come before feature breadth.

### Slide 15 — Questions
**Headline:** Discussion
**Content:** Contact/owner info; pointer to the full documentation set in `documentation/README.md` for anyone who wants the underlying detail.
**Speaker notes:** Have `09-Management-QA.md` open during Q&A — it was built to answer the most likely follow-up questions with the same rigor as the rest of the deck.
