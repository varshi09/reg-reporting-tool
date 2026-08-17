import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import { normalizeHeader, type UploadTableConfig } from "@/lib/uploadTables";

export type UploadRow = Record<string, string>;

/**
 * `record` is the data-record number, not the spreadsheet row: row 1 is the
 * header, so file row 2 is record 1.
 */
export type SkippedRow = { record: number; reason: string };

/**
 * A single problem found while validating parsed rows.
 * Surfaced in the pre-import preview modal under "Validations".
 */
export type ValidationIssue = {
  severity: "error" | "warning";
  message: string;
  /** Data-record number (file row 2 is record 1), matching SkippedRow. */
  record?: number;
  column?: string;
};

export type ParsedUpload = {
  /** Valid data rows, ready to be inserted. */
  rows: UploadRow[];
  /** Rows that were read but will not be inserted, with the reason. */
  skipped: SkippedRow[];
};

export type ParseUploadFileResult =
  | { ok: true; parsed: ParsedUpload }
  | { ok: false; error: string };

/**
 * Both xlsx date cells and ExcelJS's csv reader (which auto-detects
 * date-like text) surface as JS Date objects. Plain String(date) produces a
 * verbose form like "Fri Jul 31 2026 00:00:00 GMT+0400 (...)", which blows
 * past any reasonable column size and isn't a format Oracle recognizes
 * either — format explicitly instead.
 */
function cellValueToString(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value ?? "");
}

/**
 * Reads an uploaded .xlsx/.csv file into rows for `table`.
 *
 * Both POST /api/upload/preview and POST /api/upload go through this function
 * so that the preview shown to the user and the rows actually inserted can
 * never disagree. Do not re-implement parsing in a route handler.
 */
export async function parseUploadFile(
  file: File,
  table: UploadTableConfig
): Promise<ParseUploadFileResult> {
  const lowerFileName = file.name.toLowerCase();
  const isXlsx = lowerFileName.endsWith(".xlsx");
  const isCsv = lowerFileName.endsWith(".csv");

  if (!isXlsx && !isCsv) {
    return { ok: false, error: "Only .xlsx or .csv files are accepted." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  let worksheet: ExcelJS.Worksheet | undefined;

  if (isXlsx) {
    await workbook.xlsx.load(buffer);
    worksheet = workbook.worksheets[0];
  } else {
    worksheet = await workbook.csv.read(Readable.from(buffer));
  }

  if (!worksheet) {
    return { ok: false, error: "The file has no worksheet." };
  }

  const headerRow = worksheet.getRow(1);
  const columnIndexes = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const header = normalizeHeader(cell.value);
    const match = table.columns.find((c) => normalizeHeader(c.column) === header);
    if (match) columnIndexes.set(match.column, colNumber);
  });

  const missingColumns = table.columns.filter(
    (c) => !columnIndexes.has(c.column)
  );
  if (missingColumns.length > 0) {
    return {
      ok: false,
      error: `The file must have header columns: ${table.columns
        .map((c) => c.column)
        .join(", ")}.`,
    };
  }

  const rows: UploadRow[] = [];
  const skipped: SkippedRow[] = [];

  // No per-row content validation: a column being blank or long doesn't
  // block the load. The only requirement is that the file has the expected
  // headers (checked above). Anything the database itself can't accept
  // (e.g. a value too long for its column) surfaces later at approval time,
  // through the same failure_reasons path used for any other insert error.
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    // Row 1 is the header, so file row 2 is record 1.
    const row = worksheet.getRow(rowNumber);
    const record: UploadRow = {};
    let hasAnyValue = false;

    for (const col of table.columns) {
      const colIndex = columnIndexes.get(col.column)!;
      const value = cellValueToString(row.getCell(colIndex).value).trim();
      if (value) hasAnyValue = true;
      record[col.column] = value;
    }

    // Entirely blank row — not an error, just skip it silently.
    if (!hasAnyValue) continue;

    rows.push(record);
  }

  return {
    ok: true,
    parsed: { rows, skipped },
  };
}

/**
 * Extension point for per-data-type business validation rules.
 *
 * Intentionally a stub: no rules are configured yet, so this returns an empty
 * list and the preview modal renders its empty state. Add rules here (e.g.
 * duplicate customer numbers, reference-data lookups, format checks) and both
 * the preview API shape and the modal will pick them up without further
 * changes — `validations` is already part of the response contract.
 */
export function runUploadValidations(
  rows: UploadRow[],
  table: UploadTableConfig
): ValidationIssue[] {
  void rows;
  void table;
  return [];
}
