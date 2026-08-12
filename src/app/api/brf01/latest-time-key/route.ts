import { NextResponse } from "next/server";
import { withConnection } from "@/lib/db";

export async function GET() {
  const timeKey = await withConnection(async (connection) => {
    const result = await connection.execute<{ LATEST: string | null }>(
      `SELECT MAX(time_key) AS "LATEST" FROM BRF01_SUMMARY`
    );
    return result.rows?.[0]?.LATEST ?? null;
  });

  return NextResponse.json({ timeKey });
}
