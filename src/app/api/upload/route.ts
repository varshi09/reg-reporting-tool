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

async function logUpload(entry: {
  targetTable: string;
  fileName: string;
  timeKey: string;
  uploadedBy: string;
  totalRows: number;
  insertedCount: number;
  failedCount: number;
}) {
  await withConnection((connection) =>
    connection.execute(
      `INSERT INTO UPLOAD_LOG (target_table, file_name, time_key, uploaded_by, total_rows, inserted_count, failed_count)
       VALUES (:targetTable, :fileName, :timeKey, :uploadedBy, :totalRows, :insertedCount, :failedCount)`,
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

  if (rows.length === 0) {
    await logUpload({
      targetTable: table.key,
      fileName: originalFileName,
      timeKey,
      uploadedBy,
      totalRows: 0,
      insertedCount: 0,
      failedCount: skipped.length,
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
  const insertSql = `INSERT INTO ${table.key} (${insertColumns.join(", ")})
     VALUES (${insertColumns.map((c) => `:${c}`).join(", ")})`;

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
