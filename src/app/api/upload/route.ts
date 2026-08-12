import { NextResponse } from "next/server";
import oracledb from "oracledb";
import { withConnection } from "@/lib/db";
import { getUploadTable } from "@/lib/uploadTables";
import { parseUploadFile } from "@/lib/uploadParser";

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

  const result = await withConnection(async (connection) => {
    return connection.executeMany(insertSql, rows, {
      autoCommit: true,
      batchErrors: true,
      bindDefs,
    });
  });

  const batchErrors = result.batchErrors ?? [];
  const insertedCount = rows.length - batchErrors.length;

  const rowErrors = batchErrors.map((err) => ({
    row: err.offset !== undefined ? err.offset + 2 : undefined,
    reason: err.error?.message?.split("\n")[0] ?? "Insert failed.",
  }));

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
    skipped,
    errors: rowErrors,
  });
}
