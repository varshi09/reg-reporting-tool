import ExcelJS from "exceljs";
import { getBrf01Detail, type Brf01DetailRow } from "@/lib/brf01Detail";
import { REPORT_HEADER_FILL, writeFilterSummaryBlock, applyDataRowBorder } from "@/lib/excelReportTemplate";
import { getBrf01WorkingDays } from "@/lib/brf01Trend";

const COLUMNS: { key: keyof Brf01DetailRow; header: string; width: number }[] = [
  { key: "timeKey", header: "Time Key", width: 12 },
  { key: "workingDay", header: "Working Day", width: 12 },
  { key: "entityGroup", header: "Entity Group", width: 14 },
  { key: "dataSource", header: "Data Source", width: 12 },
  { key: "lineNo", header: "Line No", width: 10 },
  { key: "lineDesc", header: "Line Description", width: 40 },
  { key: "residentFlag", header: "Residence", width: 12 },
  { key: "currencyCode", header: "Currency", width: 10 },
  { key: "customerNumber", header: "Customer No.", width: 14 },
  { key: "contractNumber", header: "Contract No.", width: 14 },
  { key: "customerName", header: "Customer Name", width: 26 },
  { key: "noOfAccounts", header: "No. of A/cs", width: 12 },
  { key: "closingBalanceAed", header: "Closing Balance (AED)", width: 18 },
  { key: "nationality", header: "Nationality", width: 12 },
  { key: "nationalityDesc", header: "Nationality Desc.", width: 22 },
  { key: "emirates", header: "Emirate", width: 14 },
  { key: "countryCode", header: "Country Code", width: 12 },
  { key: "countryName", header: "Country", width: 20 },
  { key: "glAccountId", header: "GL Account", width: 16 },
  { key: "target", header: "Source", width: 16 },
  { key: "sector", header: "Sector", width: 18 },
];

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const timeKey = params.get("timeKey") ?? "";
  const entityGroups = params.getAll("entityGroup");
  const dataSources = params.getAll("dataSource");
  const lineNo = params.get("lineNo") ?? "";
  const resident = params.get("resident");
  const currency = params.get("currency");

  if (!lineNo || (resident !== "RES" && resident !== "NONRES") || (currency !== "AED" && currency !== "FCY")) {
    return new Response("Missing or invalid lineNo/resident/currency.", { status: 400 });
  }

  const workingDay = params.get("workingDay") || (timeKey ? (await getBrf01WorkingDays(timeKey)).current : "WD1");

  const rows = await getBrf01Detail({ timeKey, workingDay, entityGroups, dataSources, lineNo, resident, currency });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("BRF 01 - Detail");

  const filterRow = writeFilterSummaryBlock(sheet, { timeKey, entityGroups, dataSources });

  sheet.getCell(filterRow - 1, 1).value = "Line:";
  sheet.getCell(filterRow - 1, 1).font = { bold: true };
  sheet.getCell(filterRow - 1, 2).value = `${lineNo}${rows[0]?.lineDesc ? ` — ${rows[0].lineDesc}` : ""}`;
  sheet.getCell(filterRow - 1, 4).value = "Residence:";
  sheet.getCell(filterRow - 1, 4).font = { bold: true };
  sheet.getCell(filterRow - 1, 5).value = resident === "RES" ? "Resident" : "Non-Resident";
  sheet.getCell(filterRow - 1, 7).value = "Currency:";
  sheet.getCell(filterRow - 1, 7).font = { bold: true };
  sheet.getCell(filterRow - 1, 8).value = currency;
  sheet.getCell(filterRow - 1, 10).value = "Working day:";
  sheet.getCell(filterRow - 1, 10).font = { bold: true };
  sheet.getCell(filterRow - 1, 11).value = workingDay;

  sheet.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));

  const headerRow = sheet.getRow(filterRow);
  COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.fill = REPORT_HEADER_FILL;
    cell.font = { bold: true, color: { argb: "FF082F49" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  headerRow.commit();

  for (const r of rows) {
    const row = sheet.addRow(r);
    applyDataRowBorder(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filenameParts = [lineNo.replace(/\./g, "_"), resident, currency, timeKey || "all", workingDay];

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="BRF01_Detail_${filenameParts.join("_")}.xlsx"`,
    },
  });
}
