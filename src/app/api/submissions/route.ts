import { NextResponse } from "next/server";
import { withConnection } from "@/lib/db";
import { REPORT_CATEGORIES } from "@/lib/reportCategories";

type SubmissionRow = {
  REPORT_KEY: string;
  TIME_KEY: string;
  SUBMITTED_BY: string;
  SUBMITTED_AT: string;
};

type PeriodRow = { TIME_KEY: string };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function timeKeyToMonthYear(timeKey: string): { month: string; year: string } {
  if (timeKey.length !== 8) return { month: "—", year: "—" };
  const year = timeKey.slice(0, 4);
  const monthIndex = Number(timeKey.slice(4, 6)) - 1;
  return { month: MONTH_NAMES[monthIndex] ?? "—", year };
}

// Reports that can be marked submitted are derived from the same static
// catalog the Reports hub uses — any report with both a table and a page to
// link back to. New reports become submittable automatically once they're
// wired up there, no separate config needed. Category/module context comes
// along for the ride so the Submissions page can show version and frequency.
function getSubmittableReports() {
  const results: {
    key: string;
    title: string;
    table: string;
    version: string;
    frequency: string;
  }[] = [];

  for (const category of REPORT_CATEGORIES) {
    const version = category.slug.includes("suptech") ? "Sup Tech" : "Original";
    for (const module of category.modules) {
      for (const report of module.reports) {
        if (report.href && report.table) {
          results.push({
            key: report.href,
            title: report.title,
            table: report.table,
            version,
            frequency: module.label.replace(/\s+reports$/i, ""),
          });
        }
      }
    }
  }
  return results;
}

export async function GET() {
  const reports = getSubmittableReports();

  const submissions = await withConnection(async (connection) => {
    const result = await connection.execute<SubmissionRow>(
      `SELECT report_key, time_key, submitted_by, submitted_at
       FROM REPORT_SUBMISSIONS
       ORDER BY submitted_at DESC`
    );
    return result.rows ?? [];
  });

  // First match per (report, period) wins — rows are already newest-first.
  const latestByKey = new Map<string, SubmissionRow>();
  for (const s of submissions) {
    const key = `${s.REPORT_KEY}|${s.TIME_KEY}`;
    if (!latestByKey.has(key)) latestByKey.set(key, s);
  }

  const periods: {
    reportKey: string;
    reportTitle: string;
    version: string;
    frequency: string;
    timeKey: string;
    month: string;
    year: string;
    submitted: boolean;
    submittedBy: string | null;
    submittedAt: string | null;
  }[] = [];

  for (const report of reports) {
    const periodRows = await withConnection(async (connection) => {
      const result = await connection.execute<PeriodRow>(
        `SELECT DISTINCT time_key FROM ${report.table} ORDER BY time_key DESC`
      );
      return result.rows ?? [];
    });
    for (const p of periodRows) {
      const sub = latestByKey.get(`${report.key}|${p.TIME_KEY}`);
      const { month, year } = timeKeyToMonthYear(p.TIME_KEY);
      periods.push({
        reportKey: report.key,
        reportTitle: report.title,
        version: report.version,
        frequency: report.frequency,
        timeKey: p.TIME_KEY,
        month,
        year,
        submitted: Boolean(sub),
        submittedBy: sub?.SUBMITTED_BY ?? null,
        submittedAt: sub?.SUBMITTED_AT ?? null,
      });
    }
  }

  return NextResponse.json({ periods });
}

export async function POST(request: Request) {
  const body = await request.json();
  const reportKey = typeof body.reportKey === "string" ? body.reportKey : null;
  const timeKey = typeof body.timeKey === "string" ? body.timeKey : null;
  const submittedBy = typeof body.submittedBy === "string" ? body.submittedBy : null;
  const submittedAtInput = typeof body.submittedAt === "string" ? body.submittedAt : null;

  if (!reportKey || !timeKey || !submittedBy) {
    return NextResponse.json(
      { error: "reportKey, timeKey, and submittedBy are required." },
      { status: 400 }
    );
  }

  const knownReports = getSubmittableReports();
  if (!knownReports.some((r) => r.key === reportKey)) {
    return NextResponse.json({ error: "Unknown report." }, { status: 400 });
  }

  // Defaults to now, but the user can back-date this to when the report was
  // actually filed with CBUAE (e.g. logging a submission made earlier).
  const submittedAt = submittedAtInput ? new Date(submittedAtInput) : new Date();
  if (Number.isNaN(submittedAt.getTime())) {
    return NextResponse.json({ error: "Invalid submittedAt value." }, { status: 400 });
  }

  await withConnection(async (connection) => {
    await connection.execute(
      `INSERT INTO REPORT_SUBMISSIONS (report_key, time_key, submitted_by, submitted_at)
       VALUES (:reportKey, :timeKey, :submittedBy, :submittedAt)`,
      { reportKey, timeKey, submittedBy, submittedAt },
      { autoCommit: true }
    );
  });

  return NextResponse.json({ success: true });
}
