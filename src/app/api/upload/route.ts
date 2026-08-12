import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import oracledb from "oracledb";
import { withConnection } from "@/lib/db";
import { detectUploadTable, normalizeHeader } from "@/lib/uploadTables";

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
  const confirmedTable = formData.get("confirmedTable");

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

  const originalFileName = file.name;
  const lowerFileName = file.name.toLowerCase();
  const isXlsx = lowerFileName.endsWith(".xlsx");
  const isCsv = lowerFileName.endsWith(".csv");

  if (!isXlsx && !isCsv) {
    return NextResponse.json(
      { error: "Only .xlsx or .csv files are accepted." },
      { status: 400 }
    );
  }

  const table = detectUploadTable(originalFileName);
  if (!table) {
    return NextResponse.json(
      {
        error:
          "Could not determine which table this file belongs to from its name.",
      },
      { status: 400 }
    );
  }

  if (confirmedTable !== table.key) {
    return NextResponse.json(
      { error: "Target table did not match the confirmed table." },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: "The file has no worksheet." },
      { status: 400 }
    );
  }

  const headerRow = worksheet.getRow(1);
  const columnIndexes = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const header = normalizeHeader(cell.value);
    const match = table.columns.find((c) => c.header === header);
    if (match) columnIndexes.set(match.column, colNumber);
  });

  const missingColumns = table.columns.filter(
    (c) => !columnIndexes.has(c.column)
  );
  if (missingColumns.length > 0) {
    return NextResponse.json(
      {
        error: `The file must have header columns: ${table.columns
          .map((c) => c.column)
          .join(", ")}.`,
      },
      { status: 400 }
    );
  }

  const rows: Record<string, string>[] = [];
  const skipped: { row: number; reason: string }[] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const record: Record<string, string> = {};
    let hasAnyValue = false;
    let missingRequired = false;

    for (const col of table.columns) {
      const colIndex = columnIndexes.get(col.column)!;
      const value = String(row.getCell(colIndex).value ?? "").trim();
      if (value) hasAnyValue = true;
      else missingRequired = true;
      record[col.column] = value;
    }

    if (!hasAnyValue) continue;

    if (missingRequired) {
      skipped.push({ row: rowNumber, reason: "Missing required field." });
      continue;
    }

    rows.push(record);
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
