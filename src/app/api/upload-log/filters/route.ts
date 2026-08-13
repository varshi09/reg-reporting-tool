import { NextResponse } from "next/server";
import { withConnection } from "@/lib/db";

export async function GET(request: Request) {
  const targetTable = new URL(request.url).searchParams.get("targetTable");

  const users = await withConnection(async (connection) => {
    const usersResult = await connection.execute<{ UPLOADED_BY: string }>(
      `SELECT DISTINCT uploaded_by FROM UPLOAD_LOG
       ${targetTable ? "WHERE target_table = :targetTable" : ""}
       ORDER BY uploaded_by`,
      targetTable ? { targetTable } : {}
    );
    return (usersResult.rows ?? []).map((r) => r.UPLOADED_BY);
  });

  return NextResponse.json({ users });
}
