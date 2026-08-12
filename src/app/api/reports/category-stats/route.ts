import { NextResponse } from "next/server";
import { withConnection } from "@/lib/db";
import { getCategory } from "@/lib/reportCategories";

// Table names here come only from our own static config (reportCategories.ts),
// never from user input, so interpolating them into SQL is safe.
async function tableHasRows(table: string): Promise<boolean> {
  return withConnection(async (connection) => {
    const result = await connection.execute<{ CNT: number }>(
      `SELECT COUNT(*) AS "CNT" FROM ${table} WHERE ROWNUM = 1`
    );
    return (result.rows?.[0]?.CNT ?? 0) > 0;
  });
}

export async function GET(request: Request) {
  const categorySlug = new URL(request.url).searchParams.get("category");
  const category = categorySlug ? getCategory(categorySlug) : undefined;

  if (!category) {
    return NextResponse.json({ error: "Unknown category." }, { status: 404 });
  }

  const allReports = category.modules.flatMap((m) => m.reports);
  const totalReports = allReports.length;

  let availableToDownload = 0;
  let awaitingInput = 0;

  for (const report of allReports) {
    if (!report.table) continue;
    const hasData = await tableHasRows(report.table);
    if (hasData) availableToDownload += 1;
    else awaitingInput += 1;
  }

  return NextResponse.json({
    totalReports,
    availableToDownload,
    awaitingInput,
    // Not computable yet — needs a reporting-calendar/due-date concept.
    pending: null,
  });
}
