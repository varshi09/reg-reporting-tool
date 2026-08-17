import { NextResponse } from "next/server";
import { withConnection } from "@/lib/db";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin, getCheckerDatasets } from "@/lib/roles";
import { getUploadTable } from "@/lib/uploadTables";
import type { UploadRow } from "@/lib/uploadParser";
import { insertRows, summarizeFailureReasons } from "@/lib/uploadInsert";
import { notify } from "@/lib/notifications";

type PendingRow = {
  TARGET_TABLE: string;
  STATUS: string;
  ROWS_JSON: string | null;
  FILE_NAME: string;
  UPLOADED_BY: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json();
  const decision = body.decision;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
  }
  if (decision === "reject" && !reason) {
    return NextResponse.json(
      { error: "A reason is required to reject an upload." },
      { status: 400 }
    );
  }

  const row = await withConnection(async (connection) => {
    const result = await connection.execute<PendingRow>(
      `SELECT target_table, status, rows_json, file_name, uploaded_by
       FROM UPLOAD_LOG WHERE id = :id`,
      { id }
    );
    return result.rows?.[0] ?? null;
  });

  if (!row) {
    return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  }
  if (row.STATUS !== "PENDING") {
    return NextResponse.json(
      { error: "This upload has already been decided." },
      { status: 409 }
    );
  }

  const admin = await isAdmin(username);
  if (!admin) {
    const checkerDatasets = await getCheckerDatasets(username, [row.TARGET_TABLE]);
    if (!checkerDatasets.includes(row.TARGET_TABLE)) {
      return NextResponse.json(
        { error: "You're not set up as a Checker for this dataset." },
        { status: 403 }
      );
    }
  }

  const datasetLabel = getUploadTable(row.TARGET_TABLE)?.label ?? row.TARGET_TABLE;

  if (decision === "reject") {
    await withConnection((connection) =>
      connection.execute(
        `UPDATE UPLOAD_LOG
         SET status = 'REJECTED', reject_reason = :reason, reviewed_by = :username,
             reviewed_at = SYSTIMESTAMP, rows_json = NULL
         WHERE id = :id`,
        { reason, username, id },
        { autoCommit: true }
      )
    );
    await notify(
      row.UPLOADED_BY,
      `${username} rejected "${row.FILE_NAME}" (${datasetLabel}): ${reason}`,
      "/upload"
    );
    return NextResponse.json({ status: "REJECTED" });
  }

  // decision === "approve"
  const table = getUploadTable(row.TARGET_TABLE);
  if (!table) {
    return NextResponse.json(
      { error: `Unknown dataset "${row.TARGET_TABLE}".` },
      { status: 500 }
    );
  }

  const rows: UploadRow[] = row.ROWS_JSON ? JSON.parse(row.ROWS_JSON) : [];
  const { committed, insertedCount, rowErrors } = await insertRows(table, rows);

  if (!committed) {
    // The file passed validation at upload time, but the database itself
    // rejected it now (e.g. a duplicate key created since then). Leave it
    // PENDING with the failure visible so the checker can see why and
    // reject it back to the maker with that context.
    await withConnection((connection) =>
      connection.execute(
        `UPDATE UPLOAD_LOG
         SET failed_count = :failedCount, failure_reasons = :failureReasons
         WHERE id = :id`,
        {
          failedCount: rowErrors.length,
          failureReasons: summarizeFailureReasons(rowErrors),
          id,
        },
        { autoCommit: true }
      )
    );
    return NextResponse.json({
      status: "PENDING",
      approvalFailed: true,
      errors: rowErrors,
    });
  }

  await withConnection((connection) =>
    connection.execute(
      `UPDATE UPLOAD_LOG
       SET status = 'APPROVED', inserted_count = :insertedCount, failed_count = 0,
           failure_reasons = NULL, reviewed_by = :username, reviewed_at = SYSTIMESTAMP,
           rows_json = NULL
       WHERE id = :id`,
      { insertedCount, username, id },
      { autoCommit: true }
    )
  );

  await notify(
    row.UPLOADED_BY,
    `${username} approved "${row.FILE_NAME}" (${datasetLabel}) — ${insertedCount} rows loaded.`,
    "/upload"
  );

  return NextResponse.json({ status: "APPROVED", insertedCount });
}
