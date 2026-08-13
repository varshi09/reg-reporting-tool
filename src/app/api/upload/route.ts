import { NextResponse } from "next/server";
import oracledb from "oracledb";
import { withConnection } from "@/lib/db";
import { getUploadTable } from "@/lib/uploadTables";
import { parseUploadFile } from "@/lib/uploadParser";

/**
 * Turns a raw Oracle driver message into something a reporting officer can
 * act on, keeping the ORA- code appended for traceability. Note that
 * `batchErrors` entries are Error objects carrying `message` and `offset`
 * directly — there is no nested `.error` property.
 */
function describeOracleError(rawMessage: string | undefined): string {
  const raw = (rawMessage ?? "").split("\n")[0].trim();
  if (!raw) return "The database rejected this record.";

  const code = raw.match(/ORA-\d{5}/)?.[0];
  const plain =
    code === "ORA-00001"
      ? "Duplicate record — a row with this key already exists in the table."
      : code === "ORA-01400"
        ? "A required column was empty."
        : code === "ORA-12899"
          ? "A value is too long for its column."
          : code === "ORA-01722"
            ? "A value is not a valid number."
            : code === "ORA-01861"
              ? "A value does not match the expected date format."
              : raw;

  return plain === raw || !code ? plain : `${plain} (${code})`;
}

// UPLOAD_LOG.failure_reasons is VARCHAR2(4000 BYTE); stay well under that so
// multi-byte characters in a reason can't push us over the limit.
const FAILURE_REASONS_MAX_CHARS = 3900;

function summarizeFailureReasons(
  items: { record?: number; reason: string }[]
): string | null {
  if (items.length === 0) return null;
  const joined = items
    .map((item) => (item.record !== undefined ? `Record ${item.record}: ${item.reason}` : item.reason))
    .join("; ");
  return joined.length > FAILURE_REASONS_MAX_CHARS
    ? `${joined.slice(0, FAILURE_REASONS_MAX_CHARS - 1)}…`
    : joined;
}

async function logUpload(entry: {
  targetTable: string;
  fileName: string;
  timeKey: string;
  uploadedBy: string;
  totalRows: number;
  insertedCount: number;
  failedCount: number;
  failureReasons: string | null;
}) {
  await withConnection((connection) =>
    connection.execute(
      `INSERT INTO UPLOAD_LOG (target_table, file_name, time_key, uploaded_by, total_rows, inserted_count, failed_count, failure_reasons)
       VALUES (:targetTable, :fileName, :timeKey, :uploadedBy, :totalRows, :insertedCount, :failedCount, :failureReasons)`,
      entry,
      { autoCommit: true }
    )
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const timeKey = String(formData.get("timeKey") ?? "");
  const uploadedBy = String(formData.get("uploadedBy") ?? "");
  const targetTable = String(formData.get("targetTable") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  if (!/^\d{8}$/.test(timeKey)) {
    return NextResponse.json(
      { error: "time_key must be a reporting date in YYYYMMDD format." },
      { status: 400 }
    );
  }

  if (!uploadedBy) {
    return NextResponse.json({ error: "Missing uploaded_by." }, { status: 400 });
  }

  // The table name is interpolated into the INSERT below, so it must be the
  // key of a whitelisted config entry — never the raw request value.
  const table = getUploadTable(targetTable);
  if (!table) {
    return NextResponse.json(
      { error: "Unknown data type. Choose a data type from the list." },
      { status: 400 }
    );
  }

  const originalFileName = file.name;

  const parseResult = await parseUploadFile(file, table);
  if (!parseResult.ok) {
    return NextResponse.json({ error: parseResult.error }, { status: 400 });
  }

  const { rows, skipped } = parseResult.parsed;

  // Any problem blocks the entire load: if a single record fails the file
  // checks we do not insert anything, so the table always reflects the whole
  // file or none of it. Enforced here rather than only in the UI.
  if (skipped.length > 0) {
    await logUpload({
      targetTable: table.key,
      fileName: originalFileName,
      timeKey,
      uploadedBy,
      totalRows: rows.length + skipped.length,
      insertedCount: 0,
      failedCount: skipped.length,
      failureReasons: summarizeFailureReasons(skipped),
    });
    return NextResponse.json({
      targetTable: table.key,
      totalRows: rows.length + skipped.length,
      insertedCount: 0,
      committed: false,
      skipped,
      errors: [],
    });
  }

  if (rows.length === 0) {
    await logUpload({
      targetTable: table.key,
      fileName: originalFileName,
      timeKey,
      uploadedBy,
      totalRows: 0,
      insertedCount: 0,
      failedCount: skipped.length,
      failureReasons: summarizeFailureReasons(skipped),
    });
    return NextResponse.json(
      { error: "No valid data rows found in the file.", skipped },
      { status: 400 }
    );
  }

  const bindDefs: Record<string, { type: number; maxSize: number }> = {};
  for (const col of table.columns) {
    bindDefs[col.column] = { type: oracledb.STRING, maxSize: col.maxSize };
  }

  const insertColumns = table.columns.map((c) => c.column);
  // Date columns are bound as plain strings like every other column (see
  // bindDefs above), so they need an explicit TO_DATE — otherwise Oracle
  // falls back to the session's NLS_DATE_FORMAT (DD-MON-RR by default),
  // which rejects the YYYY-MM-DD format the parser produces.
  const insertSql = `INSERT INTO ${table.key} (${insertColumns.join(", ")})
     VALUES (${insertColumns
       .map((c) =>
         table.columns.find((col) => col.column === c)?.type === "date"
           ? `TO_DATE(:${c}, 'YYYY-MM-DD')`
           : `:${c}`
       )
       .join(", ")})`;

  // All-or-nothing load. autoCommit is off so that if the database rejects
  // even one row we roll the whole batch back — a partially loaded
  // regulatory dataset looks complete but isn't, which is worse than a
  // failed load the user can retry.
  const { batchErrors, committed } = await withConnection(async (connection) => {
    const execResult = await connection.executeMany(insertSql, rows, {
      autoCommit: false,
      batchErrors: true,
      bindDefs,
    });

    const errors = execResult.batchErrors ?? [];
    if (errors.length > 0) {
      await connection.rollback();
      return { batchErrors: errors, committed: false };
    }

    await connection.commit();
    return { batchErrors: errors, committed: true };
  });

  const rowErrors = batchErrors.map((err) => ({
    // Batch offsets are zero-based over the valid rows, so offset 0 is
    // record 1 (file row 2).
    record: err.offset !== undefined ? err.offset + 1 : undefined,
    reason: describeOracleError(err.message),
  }));

  const insertedCount = committed ? rows.length : 0;

  await logUpload({
    targetTable: table.key,
    fileName: originalFileName,
    timeKey,
    uploadedBy,
    totalRows: rows.length,
    insertedCount,
    failedCount: skipped.length + rowErrors.length,
    failureReasons: summarizeFailureReasons([...skipped, ...rowErrors]),
  });

  return NextResponse.json({
    targetTable: table.key,
    totalRows: rows.length,
    insertedCount,
    committed,
    skipped,
    errors: rowErrors,
  });
}
