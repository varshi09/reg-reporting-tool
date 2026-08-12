# Changelog

All notable module releases, newest first. Each entry corresponds to a git
tag on `main` and represents a module that passed the full pipeline
(`dev-agent` → `test-agent` → `uat-agent` → human signoff → `release-agent`).

---

## v0.2.0-reports-generated-modal — 12 August 2026

**Module:** Reports Generated modal (Home dashboard)

Clicking the "Reports generated" tile on the Home dashboard now opens a dialog
listing each functional BRF report for the current reporting period, showing
whether it has data ("Generated") or not ("Not yet generated"). Report titles
link straight into the report.

- `src/app/api/dashboard/stats/route.ts` — added a `reportDetails` field to
  the existing response, derived from the row-existence check already being
  performed. No new queries, no change to existing stat values.
- `src/app/dashboard/page.tsx` — added the modal and made only the "Reports
  generated" tile clickable.

Verified by `test-agent` (diff review, lint/build baseline, functional,
responsive, console/network — all pass) and `uat-agent` (six business
acceptance criteria — all pass). Signoff package:
`signoff/reports-generated-modal-signoff.md`.

Known follow-ups logged, none blocking: clickable tile lacks
`role="button"`/keyboard handling (pre-existing app-wide pattern gap), and
report pages have no explicit "no data for this period" empty state.

---

## v0.1.0 — baseline (untagged)

Pre-pipeline prototype: login, Home dashboard, data upload, BRF 01 and
BRF 1.1 (Sup Tech) reports with Excel export, submissions tracking, and the
report catalog hub. Documentation set added under `documentation/`.
