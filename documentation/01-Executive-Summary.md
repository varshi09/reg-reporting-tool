# 01 — Executive Summary

**Project:** CBUAE Banking Return Framework (BRF) Regulatory Reporting Tool
**Repository:** `reg-reporting-tool` (Next.js application)
**Audit date:** 2026-08-12
**Audit basis:** Direct inspection of the source code on disk. No claim in this document set is based on memory of prior conversations — every statement is traceable to a specific file.

## What this system is

This is a **working prototype** of an internal web portal intended to help a bank prepare and track submissions of CBUAE (Central Bank of the UAE) Banking Return Framework (BRF) regulatory returns. It is built on Next.js 16 (App Router), TypeScript, and an Oracle Database 21 XE backend, styled with Tailwind CSS v4.

It is **not** a finished product and is **not connected to any CBUAE system**. It is best described as a functional proof-of-concept that demonstrates the intended workflow — data upload, report generation, and submission tracking — for two specific report types out of the roughly 90 CBUAE return types catalogued in the application's navigation.

## What actually works today

- **Login** — a simple username/password gate (`src/app/login/page.tsx`) with **hardcoded placeholder credentials** (`admin` / `Admin@123`), no password hashing, no user database. Session state is a `sessionStorage` flag only, not a server-verified session.
- **Home dashboard** (`src/app/dashboard/page.tsx`) — shows live counts pulled from Oracle via `src/app/api/dashboard/stats/route.ts`.
- **Data upload** (`src/app/upload/page.tsx`, `src/app/api/upload/route.ts`) — accepts `.xlsx`/`.csv` files, routes them to an Oracle table based on a strict file-naming convention, and logs every upload attempt to an `UPLOAD_LOG` table. Only one destination table (`DIM_CUSTOMER`) is currently configured (`src/lib/uploadTables.ts`).
- **Two real reports**: "BRF 01 - Assets" (`src/app/reports/brf01/page.tsx`) and "BRF 1.1 - Assets" — a Sup Tech variant (`src/app/reports/brf01-suptech/page.tsx`). Both render a filterable on-screen table sourced from Oracle summary tables and offer an Excel (`.xlsx`) export built with `exceljs`.
- **Submissions tracking** (`src/app/submissions/page.tsx`, `src/app/api/submissions/route.ts`) — lets a user manually mark a report/period as "submitted to CBUAE," with a confirmation modal and a backdateable timestamp, recorded in a `REPORT_SUBMISSIONS` Oracle table.

## What is a placeholder / not built

- **Validation** (`src/app/validation/page.tsx`), **Reconciliation** (`src/app/reconciliation/page.tsx`), **Report Library** (`src/app/report-library/page.tsx`), and **Settings** (`src/app/settings/page.tsx`) are all "Coming soon" stub pages rendered via the shared `src/components/ComingSoonPage.tsx` component. They contain **no backend logic whatsoever**.
- Of the ~90 report entries listed in the "Central Bank Reporting" catalog (`src/lib/reportCategories.ts`), **only 2 are functional** (BRF 01 - Assets and BRF 1.1 - Assets). The other ~88 are static, non-clickable `comingSoon: true` catalog entries with no page, no API route, and no database table behind them.
- **No integration with CBUAE exists anywhere in the code.** There is no outbound API call, SFTP client, file-submission gateway, or webhook to any Central Bank system.

## The #1 question management will ask, answered directly

**Are reports actually transmitted to CBUAE by this system, or only tracked internally?**

**Only tracked internally.** The "Submissions" feature (`src/app/api/submissions/route.ts`) is a manual logging mechanism: a user generates/downloads the Excel report, presumably submits it to CBUAE through whatever channel the bank uses today (e.g., the CBUAE's own portal, email, etc.), and then comes back into this tool to click "Mark as submitted" and record that fact in the `REPORT_SUBMISSIONS` table. There is no code path in this repository that sends data to CBUAE. The submission record is a self-reported audit note, not proof of transmission, and nothing in the system validates that the marked submission actually happened.

## Overall assessment

The engineering foundation is reasonably clean for a prototype: modern framework choices, mostly parameterized SQL (see `06-Security-Assessment.md`), and a sensible component/API structure. However, the system as it stands is **not production-ready** for a regulated banking environment. Authentication, authorization, audit trail depth, validation logic, reconciliation logic, deployment tooling (no Dockerfile, no CI/CD, no tests), and 98% of the report catalog remain to be built. See `12-Risks-and-Roadmap.md` for the full gap list and a production-readiness score.

## Document map

See `README.md` in this folder for the full index of the documentation set.
