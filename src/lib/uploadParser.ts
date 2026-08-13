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

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    // Row 1 is the header, so file row 2 is record 1.
    const recordNumber = rowNumber - 1;
    const row = worksheet.getRow(rowNumber);
    const record: UploadRow = {};
    let hasAnyValue = false;
    // Named so the user is told exactly which column caused the problem,
    // rather than a generic "missing field" message.
    const missingColumns: string[] = [];
    const oversizedColumns: string[] = [];

    for (const col of table.columns) {
      const colIndex = columnIndexes.get(col.column)!;
      const value = String(row.getCell(colIndex).value ?? "").trim();
      if (value) {
        hasAnyValue = true;
        // Caught here rather than letting Oracle reject the row later with a
        // cryptic ORA- error the user can't act on.
        if (value.length > col.maxSize) {
          oversizedColumns.push(
            `${col.column} (${value.length} chars, max ${col.maxSize})`
          );
        }
      } else {
        missingColumns.push(col.column);
      }
      record[col.column] = value;
    }

    // Entirely blank row — not an error, just skip it silently.
    if (!hasAnyValue) continue;

    if (missingColumns.length > 0) {
      skipped.push({
        record: recordNumber,
        reason: `Missing a value for ${missingColumns.join(", ")}.`,
      });
      continue;
    }

    if (oversizedColumns.length > 0) {
      skipped.push({
        record: recordNumber,
        reason: `Value too long for ${oversizedColumns.join(", ")}.`,
      });
      continue;
    }

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
