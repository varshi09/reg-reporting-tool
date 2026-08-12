import { NextResponse } from "next/server";
import { withConnection } from "@/lib/db";
import { BRF01_TEMPLATE, EMPTY_METRICS, type Brf01Metrics } from "@/lib/brf01Template";

type SummaryRow = {
  LINE_NO: string;
  RES_AED_ACCOUNTS: number | null;
  RES_AED_AMOUNT: number | null;
  RES_FCY_ACCOUNTS: number | null;
  RES_FCY_AMOUNT: number | null;
  NONRES_AED_ACCOUNTS: number | null;
  NONRES_AED_AMOUNT: number | null;
  NONRES_FCY_ACCOUNTS: number | null;
  NONRES_FCY_AMOUNT: number | null;
  TOTAL_ACCOUNTS: number | null;
  TOTAL_AMOUNT: number | null;
};

function buildInClause(
  column: string,
  values: string[],
  prefix: string,
  binds: Record<string, string>
): string | null {
  if (values.length === 0) return null;
  const names = values.map((value, i) => {
    const bindName = `${prefix}${i}`;
    binds[bindName] = value;
    return `:${bindName}`;
  });
  return `${column} IN (${names.join(", ")})`;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const timeKey = params.get("timeKey");
  const entityGroups = params.getAll("entityGroup");
  const dataSources = params.getAll("dataSource");

  const conditions: string[] = [];
  const binds: Record<string, string> = {};

  if (timeKey) {
    conditions.push("time_key = :timeKey");
    binds.timeKey = timeKey;
  }
  const entityClause = buildInClause("entity_group", entityGroups, "eg", binds);
  if (entityClause) conditions.push(entityClause);

  const dataSourceClause = buildInClause("data_source", dataSources, "ds", binds);
  if (dataSourceClause) conditions.push(dataSourceClause);

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const summaryRows = await withConnection(async (connection) => {
    const result = await connection.execute<SummaryRow>(
      `SELECT line_no,
              SUM(res_aed_accounts) AS res_aed_accounts, SUM(res_aed_amount) AS res_aed_amount,
              SUM(res_fcy_accounts) AS res_fcy_accounts, SUM(res_fcy_amount) AS res_fcy_amount,
              SUM(nonres_aed_accounts) AS nonres_aed_accounts, SUM(nonres_aed_amount) AS nonres_aed_amount,
              SUM(nonres_fcy_accounts) AS nonres_fcy_accounts, SUM(nonres_fcy_amount) AS nonres_fcy_amount,
              SUM(total_accounts) AS total_accounts, SUM(total_amount) AS total_amount
       FROM BRF01_SUMMARY
       ${whereClause}
       GROUP BY line_no`,
      binds
    );
    return result.rows ?? [];
  });

  const byCode = new Map<string, Brf01Metrics>();
  for (const row of summaryRows) {
    byCode.set(row.LINE_NO, {
      resAedAccounts: row.RES_AED_ACCOUNTS,
      resAedAmount: row.RES_AED_AMOUNT,
      resFcyAccounts: row.RES_FCY_ACCOUNTS,
      resFcyAmount: row.RES_FCY_AMOUNT,
      nonresAedAccounts: row.NONRES_AED_ACCOUNTS,
      nonresAedAmount: row.NONRES_AED_AMOUNT,
      nonresFcyAccounts: row.NONRES_FCY_ACCOUNTS,
      nonresFcyAmount: row.NONRES_FCY_AMOUNT,
      totalAccounts: row.TOTAL_ACCOUNTS,
      totalAmount: row.TOTAL_AMOUNT,
    });
  }

  const entries = BRF01_TEMPLATE.map((row) => ({
    code: row.code,
    description: row.description,
    isHeader: row.isHeader,
    metrics: byCode.get(row.code) ?? EMPTY_METRICS,
  }));

  return NextResponse.json({ entries });
}
