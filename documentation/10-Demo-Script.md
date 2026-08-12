# 10 — Demo Script

A walkthrough script for demonstrating the working parts of the prototype to stakeholders. Every step below corresponds to a real, functioning feature — nothing scripted here is aspirational. Total time: ~12-15 minutes.

## Before you start

- Confirm the Oracle database is reachable and has at least some rows in `BRF01_SUMMARY` and/or `BRF01_SUPTECH_SUMMARY` (the app does not seed this data itself — see `05-Data-Flow-and-Report-Generation.md`), so the report screens aren't empty during the demo.
- Start the app: `npm run dev` (or `start-dev.bat` on the reference dev machine) and open the app URL in a browser.
- Have a correctly-named sample file ready for the upload demo, e.g. `DIM_CUSTOMER_20260810.xlsx` with columns `CustomerName` and `CustomerNumber`.

## 1. Login (2 min)

- Navigate to `/login`.
- Point out the split-screen branding ("Banking Return Framework Reporting Portal") and the checklist of intended capabilities.
- Log in with `admin` / `Admin@123`.
- **Talking point:** call out explicitly that this is a placeholder login — the page itself says so — and that real authentication is a required next step before any pilot with real data (ties into `06-Security-Assessment.md`).

## 2. Home dashboard (2 min)

- Land on `/dashboard`. Point out the four stat tiles: "Reports generated," "Pending validation" (shown as "—", intentionally not available), "Submitted to CBUAE," and "Next deadline" (also "—").
- **Talking point:** the two live numbers ("Reports generated," "Submitted to CBUAE") are real, computed live from Oracle (`src/app/api/dashboard/stats/route.ts`) — not mock data. The two "—" tiles are honest placeholders for features not yet built.
- Click through one of the "Quick actions" cards to segue into the next section.

## 3. Data upload (3 min)

- Go to `/upload`.
- Select the prepared `DIM_CUSTOMER_20260810.xlsx` file, set a reporting date, click "Upload."
- Show the confirmation modal ("This file will be loaded into DIM_CUSTOMER...") — **talking point:** this is a deliberate safety check before any data is written.
- Confirm, show the success summary (rows loaded), and scroll to "Upload history" to show the new entry appear.
- **Talking point:** every upload attempt — success or failure — is logged with who did it and when, which is the seed of the audit trail (`UPLOAD_LOG` table).
- Optionally demonstrate a rejection: try uploading a file with the wrong name (e.g., `random.xlsx`) to show the filename-convention safety check.

## 4. Generate a report — BRF 01 (3 min)

- Go to `/reports`, then into "Central Bank Reporting" → "Monthly reports" → "BRF 01 - Assets" (or navigate directly to `/reports/brf01`).
- Show the filter bar: time key (date), entity group, data source — all multi-select and live-querying.
- Change a filter and click "Apply filter" to show the table update.
- **Talking point:** this table mirrors the official CBUAE BRF 01 form's exact row structure (90+ lines: Cash & Balances, Due from Head Office, Balances Due from Other Banks, etc.) — this isn't a generic table, it's the actual regulatory form layout.
- Click "Download Report" and open the resulting `.xlsx` — show that the Excel file visually matches the on-screen table, including the filter summary written at the top of the sheet.

## 5. Generate a report — BRF 1.1 (Sup Tech) (2 min)

- Navigate to `/reports/brf01-suptech`.
- **Talking point:** this is a second, independent report built against CBUAE's newer "Sup Tech" submission template — same underlying data shape, but with the additional Row No / Column No reference numbers CBUAE's newer format requires, shown as an extra header row in both the on-screen table and the Excel export.
- Briefly show the filter/download flow mirrors BRF 01, since the two are deliberately built the same way for consistency.

## 6. Submissions tracking (3 min)

- Go to `/submissions`.
- Show the filter row (version, frequency, month, year, status, submitted by) and the "Submitted" / "Yet to submit" summary tiles.
- Find a "Not submitted" row, click "Mark as submitted."
- Show the confirmation modal, including the editable "When was it submitted?" field — **talking point:** this supports logging a submission that already happened (e.g., filed with CBUAE yesterday through their own portal), which is the honest framing of what this feature does.
- Confirm, and show the row flip to "Submitted" with the current user's name and timestamp.
- **This is the moment to be explicit with the audience:** "This records that a submission happened — it does not perform the submission. Nothing in this application talks to CBUAE directly." This preempts the most likely audience question.

## 7. What's not built yet (2 min) — set expectations deliberately

- Click through `/validation`, `/reconciliation`, `/report-library`, and `/settings` to show the "Coming soon" state honestly.
- **Talking point:** these aren't hidden or broken — they're clearly labeled placeholders, and the app's own report catalog (under "Generate Report") shows dozens of other CBUAE report types as "Coming soon" tiles too, so the audience can see the full scope of what remains versus what's done.

## Closing talking points

- What works, works end-to-end and touches a real database.
- What doesn't work is clearly and honestly labeled, not hidden.
- The most important open item before any real pilot is authentication and access control (see `06-Security-Assessment.md` and `12-Risks-and-Roadmap.md`) — this should be the team's next priority, ahead of building more report types on an insecure foundation.
