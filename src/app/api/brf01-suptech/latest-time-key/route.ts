import { NextResponse } from "next/server";
import { withConnection } from "@/lib/db";
import { BRF01_SUPTECH_TABLE } from "@/lib/brf01SupTechTemplate";

export async function GET() {
  const timeKey = await withConnection(async (connection) => {
    const result = await connection.execute<{ LATEST: string | null }>(
      `SELECT MAX(time_key) AS "LATEST" FROM ${BRF01_SUPTECH_TABLE}`
    );
    return result.rows?.[0]?.LATEST ?? null;
  });

  return NextResponse.json({ timeKey });
}
