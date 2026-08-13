import { NextResponse } from "next/server";
import { withConnection } from "@/lib/db";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const targetTable = params.get("targetTable");
  const timeKey = params.get("timeKey");
  const timeKeyPrefix = params.get("timeKeyPrefix");
  const uploadedBy = params.get("uploadedBy");
  const limit = params.has("limit") ? Number(params.get("limit")) : 20;

  const conditions: string[] = [];
  const binds: Record<string, string> = {};

  if (targetTable) {
    conditions.push("target_table = :targetTable");
    binds.targetTable = targetTable;
  }
  if (timeKey) {
    conditions.push("time_key = :timeKey");
    binds.timeKey = timeKey;
  }
  if (uploadedBy) {
    conditions.push("uploaded_by = :uploadedBy");
    binds.uploadedBy = uploadedBy;
  }
  // Filters on the reporting period the DATA belongs to (time_key), not on
  // when the file happened to be uploaded.
  if (timeKeyPrefix) {
    conditions.push("time_key LIKE :timeKeyPrefix");
    binds.timeKeyPrefix = `${timeKeyPrefix}%`;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await withConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT id, target_table, file_name, time_key, uploaded_by, uploaded_at,
              total_rows, inserted_count, failed_count, failure_reasons
       FROM UPLOAD_LOG
       ${whereClause}
       ORDER BY uploaded_at DESC
       FETCH FIRST :fetchLimit ROWS ONLY`,
      { ...binds, fetchLimit: limit }
    );
    return result.rows ?? [];
  });

  return NextResponse.json({ entries: rows });
}
