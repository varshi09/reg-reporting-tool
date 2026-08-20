import ExcelJS from "exceljs";
import { withConnection } from "@/lib/db";
import { BRF01_TEMPLATE, EMPTY_METRICS, type Brf01Metrics } from "@/lib/brf01Template";
import {
  writeFilterSummaryBlock,
  writeBrfMetricHeader,
  applySubtotalRowStyle,
  applyDataRowBorder,
} from "@/lib/excelReportTemplate";
import { getBrf01WorkingDays } from "@/lib/brf01Trend";

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

  const workingDayInfo = timeKey ? await getBrf01WorkingDays(timeKey) : null;
  const workingDay = params.get("workingDay") || workingDayInfo?.current || "WD1";

  const conditions: string[] = ["working_day = :workingDay"];
  const binds: Record<string, string> = { workingDay };

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

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("BRF 01 - Assets");

  const headerStartRow = writeFilterSummaryBlock(sheet, {
    timeKey,
    entityGroups,
    dataSources,
  });
  sheet.getCell(1, 10).value = "Working day:";
  sheet.getCell(1, 10).font = { bold: true };
  sheet.getCell(1, 11).value = workingDay;

  const { metricKeys } = writeBrfMetricHeader(sheet, headerStartRow, [
    { header: "Line No", width: 10 },
    { header: "Description", width: 55 },
  ]);

  sheet.columns = [
    { key: "code", width: 10 },
    { key: "description", width: 55 },
    ...metricKeys.map((key, i) => ({ key, width: i % 2 === 0 ? 12 : 14 })),
  ];

  for (const templateRow of BRF01_TEMPLATE) {
    const metrics = byCode.get(templateRow.code) ?? EMPTY_METRICS;
    const row = sheet.addRow({
      code: templateRow.code,
      description: templateRow.description,
      ...metrics,
    });
    if (templateRow.isHeader) {
      applySubtotalRowStyle(row);
    } else {
      applyDataRowBorder(row);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="BRF01_Assets_${
        timeKey ?? "all"
      }_${workingDay}.xlsx"`,
    },
  });
}
