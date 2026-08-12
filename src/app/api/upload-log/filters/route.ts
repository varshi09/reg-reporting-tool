import { NextResponse } from "next/server";
import { withConnection } from "@/lib/db";

export async function GET(request: Request) {
  const targetTable = new URL(request.url).searchParams.get("targetTable");

  const { users, timeKeys } = await withConnection(async (connection) => {
    const usersResult = await connection.execute<{ UPLOADED_BY: string }>(
      `SELECT DISTINCT uploaded_by FROM UPLOAD_LOG
       ${targetTable ? "WHERE target_table = :targetTable" : ""}
       ORDER BY uploaded_by`,
      targetTable ? { targetTable } : {}
    );
    const timeKeysResult = await connection.execute<{ TIME_KEY: string }>(
      `SELECT DISTINCT time_key FROM UPLOAD_LOG
       ${targetTable ? "WHERE target_table = :targetTable" : ""}
       ORDER BY time_key DESC`,
      targetTable ? { targetTable } : {}
    );
    return {
      users: (usersResult.rows ?? []).map((r) => r.UPLOADED_BY),
      timeKeys: (timeKeysResult.rows ?? []).map((r) => r.TIME_KEY),
    };
  });

  return NextResponse.json({ users, timeKeys });
}
