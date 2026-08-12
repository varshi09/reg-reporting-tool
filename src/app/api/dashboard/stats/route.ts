import { NextResponse } from "next/server";
import { withConnection } from "@/lib/db";
import { REPORT_CATEGORIES } from "@/lib/reportCategories";

// Report identity here comes only from our own static config
// (reportCategories.ts), never from user input, so interpolating the table
// name into SQL is safe.
function getSubmittableReports() {
  return REPORT_CATEGORIES.flatMap((c) => c.modules.flatMap((m) => m.reports))
    .filter((r): r is typeof r & { href: string; table: string } => Boolean(r.href && r.table));
}

async function hasDataForPeriod(table: string, yearMonthPrefix: string): Promise<boolean> {
  return withConnection(async (connection) => {
    const result = await connection.execute<{ CNT: number }>(
      `SELECT COUNT(*) AS "CNT" FROM ${table} WHERE time_key LIKE :prefix AND ROWNUM = 1`,
      { prefix: `${yearMonthPrefix}%` }
    );
    return (result.rows?.[0]?.CNT ?? 0) > 0;
  });
}

async function hasSubmissionForPeriod(
  reportKey: string,
  yearMonthPrefix: string
): Promise<boolean> {
  return withConnection(async (connection) => {
    const result = await connection.execute<{ CNT: number }>(
      `SELECT COUNT(*) AS "CNT" FROM REPORT_SUBMISSIONS
       WHERE report_key = :reportKey AND time_key LIKE :prefix AND ROWNUM = 1`,
      { reportKey, prefix: `${yearMonthPrefix}%` }
    );
    return (result.rows?.[0]?.CNT ?? 0) > 0;
  });
}

export async function GET() {
  const filesUploaded = await withConnection(async (connection) => {
    const result = await connection.execute<{ COUNT: number }>(
      `SELECT COUNT(*) AS "COUNT" FROM UPLOAD_LOG`
    );
    return result.rows?.[0]?.COUNT ?? 0;
  });

  const reports = getSubmittableReports();

  const now = new Date();
  const yearMonthPrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  let reportsGenerated = 0;
  let submittedToCbuae = 0;
  const reportDetails: { title: string; href: string; generated: boolean }[] = [];
  for (const report of reports) {
    const generated = await hasDataForPeriod(report.table, yearMonthPrefix);
    if (generated) reportsGenerated += 1;
    if (await hasSubmissionForPeriod(report.href, yearMonthPrefix)) submittedToCbuae += 1;
    reportDetails.push({ title: report.title, href: report.href, generated });
  }

  return NextResponse.json({
    filesUploaded,
    reportsGenerated,
    submittedToCbuae,
    totalReports: reports.length,
    reportDetails,
  });
}
