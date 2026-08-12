import ExcelJS from "exceljs";

// Shared Excel building blocks for CBUAE BRF-style report exports, so every
// report's downloaded file matches its on-screen table (colors included) and
// future reports with the same Resident/Non-Resident/Total x AED/FCY x
// A/cs/Amount shape get this for free instead of re-implementing header
// merges by hand.
//
// Colors mirror the on-screen table exactly (Tailwind sky palette):
// header band = sky-300, subtotal rows = sky-100, header text = sky-950,
// header border = sky-400, data row border = zinc-200.

export const REPORT_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF7DD3FC" }, // sky-300
};

export const SUBTOTAL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE0F2FE" }, // sky-100
};

const HEADER_TEXT_COLOR = "FF082F49"; // sky-950
const HEADER_BORDER_COLOR = "FF38BDF8"; // sky-400
const BODY_BORDER_COLOR = "FFE4E4E7"; // zinc-200

const HEADER_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: HEADER_BORDER_COLOR } },
  left: { style: "thin", color: { argb: HEADER_BORDER_COLOR } },
  bottom: { style: "thin", color: { argb: HEADER_BORDER_COLOR } },
  right: { style: "thin", color: { argb: HEADER_BORDER_COLOR } },
};

const BODY_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: BODY_BORDER_COLOR } },
  left: { style: "thin", color: { argb: BODY_BORDER_COLOR } },
  bottom: { style: "thin", color: { argb: BODY_BORDER_COLOR } },
  right: { style: "thin", color: { argb: BODY_BORDER_COLOR } },
};

// Applies the sky-100 "subtotal row" look (matches the on-screen table's
// bold, lightly-shaded header/subtotal lines) to every cell in a data row.
export function applySubtotalRowStyle(row: ExcelJS.Row): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = SUBTOTAL_FILL;
    cell.font = { bold: true };
    cell.border = BODY_BORDER;
  });
}

// Applies the plain zinc-200 border used by every data row in the on-screen
// table, without touching an already-styled subtotal row's fill/font.
export function applyDataRowBorder(row: ExcelJS.Row): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = BODY_BORDER;
  });
}

export type ExportFilters = {
  timeKey: string | null;
  entityGroups: string[];
  dataSources: string[];
};

export function formatTimeKeyForDisplay(timeKey: string | null): string {
  if (!timeKey || timeKey.length !== 8) return "All";
  return `${timeKey.slice(0, 4)}-${timeKey.slice(4, 6)}-${timeKey.slice(6, 8)}`;
}

// Writes a one-row "Time key / Entity group / Data source" summary at the
// top of the sheet showing which filters this download was generated with,
// and returns the row number the report table should start on.
export function writeFilterSummaryBlock(
  sheet: ExcelJS.Worksheet,
  filters: ExportFilters
): number {
  sheet.getCell(1, 1).value = "Time key:";
  sheet.getCell(1, 1).font = { bold: true };
  sheet.getCell(1, 2).value = formatTimeKeyForDisplay(filters.timeKey);

  sheet.getCell(1, 4).value = "Entity group:";
  sheet.getCell(1, 4).font = { bold: true };
  sheet.getCell(1, 5).value =
    filters.entityGroups.length > 0 ? filters.entityGroups.join(", ") : "All";

  sheet.getCell(1, 7).value = "Data source:";
  sheet.getCell(1, 7).font = { bold: true };
  sheet.getCell(1, 8).value =
    filters.dataSources.length > 0 ? filters.dataSources.join(", ") : "All";

  return 3; // row 2 left blank as a spacer; table header starts at row 3.
}

export type LeadingColumn = { header: string; width: number };

export const BRF_METRIC_KEYS = [
  "resAedAccounts",
  "resAedAmount",
  "resFcyAccounts",
  "resFcyAmount",
  "nonresAedAccounts",
  "nonresAedAmount",
  "nonresFcyAccounts",
  "nonresFcyAmount",
  "totalAccounts",
  "totalAmount",
] as const;

const METRIC_LABELS = [
  "A/cs", "Amount", "A/cs", "Amount",
  "A/cs", "Amount", "A/cs", "Amount",
  "A/cs", "Amount",
];

function styleHeaderCell(cell: ExcelJS.Cell, italic = false): void {
  cell.font = { bold: !italic, italic, size: italic ? 9 : undefined, color: { argb: HEADER_TEXT_COLOR } };
  cell.fill = REPORT_HEADER_FILL;
  cell.border = HEADER_BORDER;
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
}

// Writes the standard CBUAE BRF header bands (RESIDENT/NON-RESIDENT/TOTAL ->
// AED/FCY -> A/cs/Amount) shared by every BRF-style report, plus whatever
// leading identifier columns the report needs (e.g. just "Line No", or
// "Row No" + "Line No" for templates with CBUAE row/column references).
// Pass `columnNoValues` (10 values) to add the extra Column No reference row
// used by Sup Tech-style templates.
export function writeBrfMetricHeader(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  leadingColumns: LeadingColumn[],
  options?: { columnNoValues?: readonly string[] }
): { firstDataRow: number; metricKeys: readonly string[] } {
  const headerRows = options?.columnNoValues ? 4 : 3;
  const metricStartCol = leadingColumns.length + 1;

  leadingColumns.forEach((col, i) => {
    const c = i + 1;
    sheet.mergeCells(startRow, c, startRow + headerRows - 1, c);
    sheet.getCell(startRow, c).value = col.header;
  });

  sheet.mergeCells(startRow, metricStartCol, startRow, metricStartCol + 3);
  sheet.getCell(startRow, metricStartCol).value = "RESIDENT";
  sheet.mergeCells(startRow, metricStartCol + 4, startRow, metricStartCol + 7);
  sheet.getCell(startRow, metricStartCol + 4).value = "NON-RESIDENT";
  sheet.mergeCells(startRow, metricStartCol + 8, startRow + 1, metricStartCol + 9);
  sheet.getCell(startRow, metricStartCol + 8).value = "TOTAL";

  const aedFcyRow = startRow + 1;
  [0, 2, 4, 6].forEach((offset) => {
    const c = metricStartCol + offset;
    sheet.mergeCells(aedFcyRow, c, aedFcyRow, c + 1);
    sheet.getCell(aedFcyRow, c).value = offset % 4 === 0 ? "AED" : "FCY";
  });

  const labelRow = startRow + 2;
  METRIC_LABELS.forEach((label, i) => {
    sheet.getCell(labelRow, metricStartCol + i).value = label;
  });

  for (let r = startRow; r <= startRow + 2; r++) {
    sheet.getRow(r).eachCell({ includeEmpty: true }, (cell) => styleHeaderCell(cell));
  }

  if (options?.columnNoValues) {
    const colNoRow = startRow + 3;
    options.columnNoValues.forEach((value, i) => {
      const cell = sheet.getCell(colNoRow, metricStartCol + i);
      cell.value = value;
      styleHeaderCell(cell, true);
    });
    // Leading columns' merged cell (Row No/Line No/Description) already
    // spans into the colNo row via mergeCells above, but its border/fill
    // needs to be (re)applied on that row's own cell reference too.
    leadingColumns.forEach((_, i) => styleHeaderCell(sheet.getCell(colNoRow, i + 1), true));
  }

  return { firstDataRow: startRow + headerRows, metricKeys: BRF_METRIC_KEYS };
}
