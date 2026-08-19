import { NextResponse } from "next/server";
import { withConnection } from "@/lib/db";
import { getCurrentUsername } from "@/lib/auth";
import { getCheckerDatasets } from "@/lib/roles";
import { getAllUploadTableConfigs } from "@/lib/uploadTables";

type PendingRow = {
  ID: number;
  TARGET_TABLE: string;
  FILE_NAME: string;
  TIME_KEY: string;
  UPLOADED_BY: string;
  UPLOADED_AT: string;
  TOTAL_ROWS: number;
  FAILURE_REASONS: string | null;
};

export async function GET() {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const uploadTables = await getAllUploadTableConfigs();
  const allDatasetKeys = uploadTables.map((t) => t.key);
  const checkerDatasets = await getCheckerDatasets(username, allDatasetKeys);

  if (checkerDatasets.length === 0) {
    return NextResponse.json({ entries: [] });
  }

  const binds: Record<string, string> = {};
  const placeholders = checkerDatasets.map((key, i) => {
    const name = `dataset${i}`;
    binds[name] = key;
    return `:${name}`;
  });

  const rows: PendingRow[] = await withConnection(async (connection) => {
    const result = await connection.execute<PendingRow>(
      `SELECT id, target_table, file_name, time_key, uploaded_by, uploaded_at,
              total_rows, failure_reasons
       FROM UPLOAD_LOG
       WHERE status = 'PENDING' AND target_table IN (${placeholders.join(", ")})
       ORDER BY uploaded_at ASC`,
      binds
    );
    return result.rows ?? [];
  });

  const labelByKey = new Map(uploadTables.map((t) => [t.key, t.label]));

  return NextResponse.json({
    entries: rows.map((r) => ({
      id: r.ID,
      targetTable: r.TARGET_TABLE,
      targetLabel: labelByKey.get(r.TARGET_TABLE) ?? r.TARGET_TABLE,
      fileName: r.FILE_NAME,
      timeKey: r.TIME_KEY,
      uploadedBy: r.UPLOADED_BY,
      uploadedAt: r.UPLOADED_AT,
      totalRows: r.TOTAL_ROWS,
      previousFailureReasons: r.FAILURE_REASONS,
    })),
  });
}
