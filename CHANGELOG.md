# Changelog

All notable module releases, newest first. Each entry corresponds to a git
tag on `main`. The full pipeline is `dev-agent` → `test-agent` → `uat-agent`
→ human signoff → `release-agent`; where a release bypassed any of those
stages, the entry says so explicitly.

---

## v0.3.0-upload-redesign — 12 August 2026

**Module:** Upload data — data-type dropdown and pre-import preview

> **Verification note:** this release was approved by the user to skip the
> `test-agent` and `uat-agent` stages. It has no signoff package and no
> independent review. Verification was limited to informal checks by the
> lead agent — see "Not verified" below.

Replaces filename-convention routing with an explicit data-type dropdown, so
any `.xlsx`/`.csv` file can be uploaded regardless of its name. Adds drag and
drop, and splits the upload into two phases: a preview that reports what will
happen, then a confirmed load.

- `src/lib/uploadParser.ts` (new) — parsing logic extracted so preview and
  commit share one implementation.
- `src/app/api/upload/preview/route.ts` (new) — parses the file and returns
  row count, resolved target table, column-match count, and a `validations`
  array. Does not write to the database.
- `src/app/api/upload/route.ts` — takes the target table from the request
  and resolves it via `getUploadTable()`, a whitelist lookup against
  `UPLOAD_TABLES`, replacing filename-based detection.
- `src/app/upload/page.tsx` — dropdown, drag-and-drop zone, preview
  confirmation modal, and post-load status card.
- Bug fixed during review: `handleConfirmUpload` called `clearFile()`
  immediately after `setResult()`, and `clearFile()` reset the result to
  null — the success status card could never render. Split out
  `resetFileSelection()`.

**Verified (informal):** CSV upload with a non-conventional filename resolves
to the correct table; preview reported 3 rows / 2-of-2 columns matched;
confirm-and-load inserted correctly and the status card displayed; upload
history updated. `getUploadTable()` confirmed to whitelist against
`UPLOAD_TABLES`, so no unvalidated value reaches the interpolated
`INSERT INTO` statement.

**Not verified:** Excel (`.xlsx`) uploads, malformed or missing headers,
oversized-file rejection, the Cancel path from the preview modal, duplicate
loads of the same reporting period, and responsive layout. Recommend running
`test-agent` and `uat-agent` against `main` as a follow-up.

**Validation placeholder:** the preview response includes an empty
`validations` array and the modal renders "No validation rules configured for
this data type yet." No rules engine is implemented — this is a deliberate
hook for future rules, not working validation.

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
