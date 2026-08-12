# 04 — API Documentation

Every file matching `src/app/api/**/route.ts` in the repository is documented below. There are **12 route files** implementing **13 HTTP method handlers** (one route, `/api/submissions`, implements both `GET` and `POST`). This is the complete API surface of the application — nothing else exists.

**Authentication on every route: NONE.** No route reads a cookie, header, or token to identify or authorize the caller. Any client that can reach the Next.js server (e.g., via `curl`) can call every one of these endpoints directly, with no login required — the `sessionStorage` gate in `src/lib/useRequireAuth.ts` only hides navigation links in the browser UI; it does not protect the API.

---

## 1. `GET /api/dashboard/stats`

- **File:** `src/app/api/dashboard/stats/route.ts`
- **Purpose:** Powers the four stat tiles on the Home dashboard.
- **Request:** No parameters.
- **Logic:** Counts all rows in `UPLOAD_LOG`; for every report in the static catalog (`REPORT_CATEGORIES` in `src/lib/reportCategories.ts`) that has both an `href` and a `table`, checks whether that report's table has any row for the current calendar month (`hasDataForPeriod`) and whether `REPORT_SUBMISSIONS` has an entry for that report/month (`hasSubmissionForPeriod`).
- **Response:** `{ filesUploaded: number, reportsGenerated: number, submittedToCbuae: number, totalReports: number }`
- **Auth:** None.
- **Frontend caller:** `src/app/dashboard/page.tsx` (`fetch("/api/dashboard/stats")` on mount).
- **Note:** `submittedToCbuae` reflects internal tracking only — see the Executive Summary for why this is not proof of actual transmission to CBUAE.

## 2. `GET /api/reports/category-stats`

- **File:** `src/app/api/reports/category-stats/route.ts`
- **Purpose:** Powers the stat tiles on a report-category landing page (e.g., `/reports/central-bank-reporting`).
- **Request:** Query param `category` (category slug, e.g. `central-bank-reporting`).
- **Logic:** Looks up the category via `getCategory()` in `src/lib/reportCategories.ts`; 404s with `{ error: "Unknown category." }` if not found. For each report in that category with a `table`, checks `SELECT COUNT(*) ... WHERE ROWNUM = 1` to see if the table has data.
- **Response:** `{ totalReports: number, availableToDownload: number, awaitingInput: number, pending: number | null }` (`pending` is always `null` — comment in code: "Not computable yet — needs a reporting-calendar/due-date concept.")
- **Auth:** None.
- **Frontend caller:** `src/app/reports/[category]/page.tsx`.

## 3. `GET /api/brf01`

- **File:** `src/app/api/brf01/route.ts`
- **Purpose:** Returns the on-screen BRF 01 - Assets report data.
- **Request:** Query params — `timeKey` (single, `YYYYMMDD`), `entityGroup` (repeatable), `dataSource` (repeatable).
- **Logic:** Builds a parameterized `WHERE` clause (bind variables via `buildInClause`), runs `SELECT ... SUM(...) FROM BRF01_SUMMARY ... GROUP BY line_no`, then maps results onto the fixed 90+ row template defined in `src/lib/brf01Template.ts` (`BRF01_TEMPLATE`), filling missing rows with `EMPTY_METRICS` (all-null).
- **Response:** `{ entries: [{ code, description, isHeader, metrics: {resAedAccounts, resAedAmount, resFcyAccounts, resFcyAmount, nonresAedAccounts, nonresAedAmount, nonresFcyAccounts, nonresFcyAmount, totalAccounts, totalAmount} }] }`
- **Auth:** None.
- **Frontend caller:** `src/app/reports/brf01/page.tsx`.
- **SQL safety:** Fully parameterized — table/column names are static literals, filter values are bind variables.

## 4. `GET /api/brf01/export`

- **File:** `src/app/api/brf01/export/route.ts`
- **Purpose:** Same query/aggregation as `/api/brf01`, but returns a generated `.xlsx` workbook instead of JSON.
- **Request:** Same query params as `/api/brf01`.
- **Logic:** Builds the workbook with `exceljs`, using shared helpers from `src/lib/excelReportTemplate.ts` (`writeFilterSummaryBlock`, `writeBrfMetricHeader`, `applySubtotalRowStyle`, `applyDataRowBorder`) so the exported file visually matches the on-screen table (same sky-blue header bands, subtotal shading).
- **Response:** Binary `.xlsx` file, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="BRF01_Assets_<timeKey|all>.xlsx"`.
- **Auth:** None.
- **Frontend caller:** `src/app/reports/brf01/page.tsx` — `handleDownload()` sets `window.location.href` to this URL with the current filter querystring.

## 5. `GET /api/brf01/latest-time-key`

- **File:** `src/app/api/brf01/latest-time-key/route.ts`
- **Purpose:** Finds the most recent reporting date available, to default the date picker.
- **Request:** None.
- **Logic:** `SELECT MAX(time_key) AS "LATEST" FROM BRF01_SUMMARY`.
- **Response:** `{ timeKey: string | null }`
- **Auth:** None.
- **Frontend caller:** `src/app/reports/brf01/page.tsx` on mount, to initialize `draftTimeKey`.

## 6. `GET /api/brf01-suptech`

- **File:** `src/app/api/brf01-suptech/route.ts`
- **Purpose:** Same as `/api/brf01`, but for the independent "BRF 1.1 - Assets" (Sup Tech) report/table.
- **Request:** Same query params as `/api/brf01`.
- **Logic:** Identical aggregation pattern against `BRF01_SUPTECH_SUMMARY` (referenced via the `BRF01_SUPTECH_TABLE` constant in `src/lib/brf01SupTechTemplate.ts`), mapped onto `BRF01_SUPTECH_TEMPLATE`, which additionally carries a CBUAE `rowNo` reference per row.
- **Response:** `{ entries: [{ code, description, isHeader, rowNo, metrics: {...} }] }`
- **Auth:** None.
- **Frontend caller:** `src/app/reports/brf01-suptech/page.tsx`.

## 7. `GET /api/brf01-suptech/export`

- **File:** `src/app/api/brf01-suptech/export/route.ts`
- **Purpose:** Excel export of the Sup Tech report, including the extra CBUAE "Column No" reference row (`0010`, `0020`, ... `0100`) via `BRF01_SUPTECH_COLUMNS`.
- **Request:** Same query params as above.
- **Response:** Binary `.xlsx`, filename `BRF1_1_Assets_SupTech_<timeKey|all>.xlsx`.
- **Auth:** None.
- **Frontend caller:** `src/app/reports/brf01-suptech/page.tsx` — `handleDownload()`.

## 8. `GET /api/brf01-suptech/latest-time-key`

- **File:** `src/app/api/brf01-suptech/latest-time-key/route.ts`
- **Purpose:** Same role as endpoint 5, for the Sup Tech table.
- **Response:** `{ timeKey: string | null }`
- **Auth:** None.
- **Frontend caller:** `src/app/reports/brf01-suptech/page.tsx`.

## 9. `GET /api/submissions`

- **File:** `src/app/api/submissions/route.ts`
- **Purpose:** Lists every (report, reporting-period) combination that has data, with its submission status.
- **Request:** None.
- **Logic:** Derives the "submittable reports" list from `REPORT_CATEGORIES` (any report with both `href` and `table`); reads all rows from `REPORT_SUBMISSIONS`, keeps the newest row per `(report_key, time_key)`; for each submittable report, queries `SELECT DISTINCT time_key FROM <table>` and joins against the submission map.
- **Response:** `{ periods: [{ reportKey, reportTitle, version, frequency, timeKey, month, year, submitted, submittedBy, submittedAt }] }`
- **Auth:** None.
- **Frontend caller:** `src/app/submissions/page.tsx`.

## 10. `POST /api/submissions`

- **File:** `src/app/api/submissions/route.ts` (same file as above, `POST` export)
- **Purpose:** Records that a user has manually marked a report/period as submitted to CBUAE.
- **Request body (JSON):** `{ reportKey: string, timeKey: string, submittedBy: string, submittedAt?: string (ISO datetime) }`
- **Validation:** 400 if `reportKey`, `timeKey`, or `submittedBy` missing; 400 if `reportKey` isn't in the known-reports list; 400 if `submittedAt` is present but not a parseable date.
- **Logic:** `INSERT INTO REPORT_SUBMISSIONS (report_key, time_key, submitted_by, submitted_at) VALUES (:reportKey, :timeKey, :submittedBy, :submittedAt)`, `autoCommit: true`. `submittedAt` defaults to "now" but the UI allows backdating it (see `src/app/submissions/page.tsx`, the "When was it submitted?" field in the confirmation modal).
- **Response:** `{ success: true }` or `{ error: string }`.
- **Auth:** None — `submittedBy` is taken verbatim from the request body, which the frontend populates from the client-side `username` state (itself just the string typed into the login form). **Nothing server-side verifies that the caller is who they claim to be.**
- **Frontend caller:** `src/app/submissions/page.tsx` — `handleConfirmSubmitted()`.

## 11. `GET /api/upload-log/filters`

- **File:** `src/app/api/upload-log/filters/route.ts`
- **Purpose:** Supplies the distinct dropdown options (users, time keys) for the upload-history filter UI.
- **Request:** Optional query param `targetTable`.
- **Logic:** Two `SELECT DISTINCT` queries against `UPLOAD_LOG`, optionally filtered by `target_table`.
- **Response:** `{ users: string[], timeKeys: string[] }`
- **Auth:** None.
- **Frontend caller:** `src/app/reports/upload-activity/page.tsx`.

## 12. `GET /api/upload-log`

- **File:** `src/app/api/upload-log/route.ts`
- **Purpose:** Returns paginated upload history rows.
- **Request:** Optional query params — `targetTable`, `timeKey`, `uploadedBy`, `limit` (default 20).
- **Logic:** Parameterized `WHERE` clause, `ORDER BY uploaded_at DESC`, `FETCH FIRST :fetchLimit ROWS ONLY`.
- **Response:** `{ entries: [{ id, target_table, file_name, time_key, uploaded_by, uploaded_at, total_rows, inserted_count, failed_count }] }` (raw Oracle column-name casing, e.g. `TARGET_TABLE`, per `oracledb.OUT_FORMAT_OBJECT`).
- **Auth:** None.
- **Frontend callers:** `src/app/upload/page.tsx` (recent history), `src/app/reports/upload-activity/page.tsx` (filtered report, `limit=100`).

## 13. `POST /api/upload`

- **File:** `src/app/api/upload/route.ts`
- **Purpose:** Accepts an uploaded `.xlsx`/`.csv` file, routes it to an Oracle table by filename convention, validates headers, and bulk-inserts rows.
- **Request:** `multipart/form-data` — `file` (File), `timeKey` (string, must match `^\d{8}$`), `uploadedBy` (string), `confirmedTable` (string — must match the table auto-detected from the filename, an extra confirmation step).
- **Logic:**
  1. Validates file extension (`.xlsx`/`.csv` only) and `timeKey` format.
  2. `detectUploadTable()` (`src/lib/uploadTables.ts`) matches the filename against `^<TABLE_KEY>_\d{8}\.(xlsx|csv)$` (case-insensitive) — currently only `DIM_CUSTOMER` is configured.
  3. Rejects if `confirmedTable` doesn't match the detected table (belt-and-suspenders check against the UI's own confirmation modal).
  4. Parses the file with `exceljs` (`.xlsx` via `workbook.xlsx.load`, `.csv` via `workbook.csv.read`), normalizes headers (`normalizeHeader`: lowercase, strip non-alphanumerics), and matches them against the configured column list.
  5. 400s if any required header column is missing.
  6. Iterates data rows; a row is skipped (logged, not inserted) if any configured column is blank.
  7. Bulk-inserts valid rows with `connection.executeMany(insertSql, rows, { autoCommit: true, batchErrors: true, bindDefs })` — `insertSql` interpolates the table name and column list (both sourced only from the static `UPLOAD_TABLES` config, never from user input) but binds all row values as parameters.
  8. Always logs the attempt to `UPLOAD_LOG` (`logUpload()`), win or fail.
- **Response:** `{ targetTable, totalRows, insertedCount, skipped: [{row, reason}], errors: [{row, reason}] }`, or `{ error: string }` with 400 on validation failure.
- **Auth:** None.
- **Frontend caller:** `src/app/upload/page.tsx` — `handleConfirmUpload()`.

---

## API summary table

| # | Method | Path | Handler file | Auth | Reads/Writes Oracle |
|---|---|---|---|---|---|
| 1 | GET | `/api/dashboard/stats` | `src/app/api/dashboard/stats/route.ts` | None | Read |
| 2 | GET | `/api/reports/category-stats` | `src/app/api/reports/category-stats/route.ts` | None | Read |
| 3 | GET | `/api/brf01` | `src/app/api/brf01/route.ts` | None | Read |
| 4 | GET | `/api/brf01/export` | `src/app/api/brf01/export/route.ts` | None | Read |
| 5 | GET | `/api/brf01/latest-time-key` | `src/app/api/brf01/latest-time-key/route.ts` | None | Read |
| 6 | GET | `/api/brf01-suptech` | `src/app/api/brf01-suptech/route.ts` | None | Read |
| 7 | GET | `/api/brf01-suptech/export` | `src/app/api/brf01-suptech/export/route.ts` | None | Read |
| 8 | GET | `/api/brf01-suptech/latest-time-key` | `src/app/api/brf01-suptech/latest-time-key/route.ts` | None | Read |
| 9 | GET | `/api/submissions` | `src/app/api/submissions/route.ts` | None | Read |
| 10 | POST | `/api/submissions` | `src/app/api/submissions/route.ts` | None | Write (INSERT) |
| 11 | GET | `/api/upload-log/filters` | `src/app/api/upload-log/filters/route.ts` | None | Read |
| 12 | GET | `/api/upload-log` | `src/app/api/upload-log/route.ts` | None | Read |
| 13 | POST | `/api/upload` | `src/app/api/upload/route.ts` | None | Write (INSERT, batch) |

**Total: 12 route files, 13 endpoints, 0 with authentication or authorization checks.**

## Notably absent endpoints

- No `/api/auth/*` — login is entirely client-side.
- No `POST`/`PUT`/`DELETE` for reports other than the two BRF01 variants' upload path.
- No endpoint for validation or reconciliation results — matches the fact that those pages are UI-only stubs.
- No CBUAE-facing endpoint of any kind (no submission gateway, no status callback receiver).
