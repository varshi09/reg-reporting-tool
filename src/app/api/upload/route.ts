import { NextResponse } from "next/server";
import oracledb from "oracledb";
import { withConnection } from "@/lib/db";
import { getUploadTable } from "@/lib/uploadTables";
import { parseUploadFile } from "@/lib/uploadParser";
import { getCurrentUsername } from "@/lib/auth";
import { getMakerDatasets, hasReviewerAvailable, getCheckersForDataset } from "@/lib/roles";
import { notifyMany } from "@/lib/notifications";

/** Logs an upload that never reached review — the file had no valid rows. */
async function logAutoRejected(entry: {
  targetTable: string;
  fileName: string;
  timeKey: string;
  uploadedBy: string;
  fileContent: Buffer;
}) {
  await withConnection((connection) =>
    connection.execute(
      `INSERT INTO UPLOAD_LOG
         (target_table, file_name, time_key, uploaded_by, total_rows, inserted_count, failed_count, status, file_content)
       VALUES
         (:targetTable, :fileName, :timeKey, :uploadedBy, 0, 0, 0, 'REJECTED', :fileContent)`,
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
  const fileContent = Buffer.from(await file.arrayBuffer());

  const parseResult = await parseUploadFile(file, table);
  if (!parseResult.ok) {
    return NextResponse.json({ error: parseResult.error }, { status: 400 });
  }

  const { rows } = parseResult.parsed;

  if (rows.length === 0) {
    await logAutoRejected({
      targetTable: table.key,
      fileName: originalFileName,
      timeKey,
      uploadedBy,
      fileContent,
    });
    return NextResponse.json(
      { error: "No data rows found in the file." },
      { status: 400 }
    );
  }

  // Nothing is written to the destination table here. The validated rows are
  // staged as PENDING; a Checker's approval is what actually triggers the
  // insert, via POST /api/approvals/[id]. The original file is kept too, so
  // the Checker can open it directly rather than reviewing blind.
  const id = await withConnection(async (connection) => {
    const result = await connection.execute<{ ID: number }>(
      `INSERT INTO UPLOAD_LOG
         (target_table, file_name, time_key, uploaded_by, total_rows, inserted_count, failed_count, status, rows_json, file_content)
       VALUES
         (:targetTable, :fileName, :timeKey, :uploadedBy, :totalRows, 0, 0, 'PENDING', :rowsJson, :fileContent)
       RETURNING id INTO :id`,
      {
        targetTable: table.key,
        fileName: originalFileName,
        timeKey,
        uploadedBy,
        totalRows: rows.length,
        rowsJson: JSON.stringify(rows),
        fileContent,
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
