import { NextResponse } from "next/server";
import oracledb from "oracledb";
import { withConnection } from "@/lib/db";
import { getUploadTable } from "@/lib/uploadTables";
import { parseUploadFile } from "@/lib/uploadParser";
import { getCurrentUsername } from "@/lib/auth";
import { getMakerDatasets, hasReviewerAvailable, getCheckersForDataset } from "@/lib/roles";
import { summarizeFailureReasons } from "@/lib/uploadInsert";
import { notifyMany } from "@/lib/notifications";

/** Logs an upload that never reached review — the file itself had problems. */
async function logAutoRejected(entry: {
  targetTable: string;
  fileName: string;
  timeKey: string;
  uploadedBy: string;
  totalRows: number;
  failedCount: number;
  failureReasons: string | null;
}) {
  await withConnection((connection) =>
    connection.execute(
      `INSERT INTO UPLOAD_LOG
         (target_table, file_name, time_key, uploaded_by, total_rows, inserted_count, failed_count, failure_reasons, status)
       VALUES
         (:targetTable, :fileName, :timeKey, :uploadedBy, :totalRows, 0, :failedCount, :failureReasons, 'REJECTED')`,
      entry,
      { autoCommit: true }
    )
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const timeKey = String(formData.get("timeKey") ?? "");
  const targetTable = String(formData.get("targetTable") ?? "");

  const uploadedBy = await getCurrentUsername();
  if (!uploadedBy) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  if (!/^\d{8}$/.test(timeKey)) {
    return NextResponse.json(
      { error: "time_key must be a reporting date in YYYYMMDD format." },
      { status: 400 }
    );
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

  const makerDatasets = await getMakerDatasets(uploadedBy);
  if (!makerDatasets.includes(table.key)) {
    return NextResponse.json(
      { error: "You're not set up as a Maker for this dataset." },
      { status: 403 }
    );
  }

  if (!(await hasReviewerAvailable(table.key))) {
    return NextResponse.json(
      {
        error:
          "No checker is assigned for this dataset yet — ask an admin to assign one before uploading.",
      },
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
  // checks nothing is staged for review, so a Checker never has to weigh in
  // on a file that's simply broken. Enforced here rather than only in the UI.
  if (skipped.length > 0) {
    await logAutoRejected({
      targetTable: table.key,
      fileName: originalFileName,
      timeKey,
      uploadedBy,
      totalRows: rows.length + skipped.length,
      failedCount: skipped.length,
      failureReasons: summarizeFailureReasons(skipped),
    });
    return NextResponse.json({
      targetTable: table.key,
      totalRows: rows.length + skipped.length,
      status: "REJECTED",
      skipped,
      errors: [],
    });
  }

  if (rows.length === 0) {
    await logAutoRejected({
      targetTable: table.key,
      fileName: originalFileName,
      timeKey,
      uploadedBy,
      totalRows: 0,
      failedCount: skipped.length,
      failureReasons: summarizeFailureReasons(skipped),
    });
    return NextResponse.json(
      { error: "No valid data rows found in the file.", skipped },
      { status: 400 }
    );
  }

  // Nothing is written to the destination table here. The validated rows are
  // staged as PENDING; a Checker's approval is what actually triggers the
  // insert, via POST /api/approvals/[id].
  const id = await withConnection(async (connection) => {
    const result = await connection.execute<{ ID: number }>(
      `INSERT INTO UPLOAD_LOG
         (target_table, file_name, time_key, uploaded_by, total_rows, inserted_count, failed_count, status, rows_json)
       VALUES
         (:targetTable, :fileName, :timeKey, :uploadedBy, :totalRows, 0, 0, 'PENDING', :rowsJson)
       RETURNING id INTO :id`,
      {
        targetTable: table.key,
        fileName: originalFileName,
        timeKey,
        uploadedBy,
        totalRows: rows.length,
        rowsJson: JSON.stringify(rows),
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );
    return (result.outBinds as { id: number[] }).id[0];
  });

  const checkers = await getCheckersForDataset(table.key);
  await notifyMany(
    checkers,
    `${uploadedBy} uploaded "${originalFileName}" for ${table.label} — waiting on your review.`,
    "/approvals"
  );

  return NextResponse.json({
    id,
    targetTable: table.key,
    totalRows: rows.length,
    status: "PENDING",
    skipped: [],
  });
}
