// Central Bank Reporting - Sup Tech: BRF 01 - Assets
//
// Same static layout as the original BRF 01 report, extended with the
// official CBUAE ROW_NO / COLUMN_NO reference numbers required by the new
// Sup Tech template. Completely independent from the original BRF01 report
// (separate template file, separate table) so the original is untouched.

// Centralized so the underlying table can be swapped later without touching
// the API routes' query logic.
export const BRF01_SUPTECH_TABLE = "BRF01_SUPTECH_SUMMARY";

export type Brf01SupTechTemplateRow = {
  code: string;
  description: string;
  isHeader: boolean;
  rowNo: string;
};

const BASE_ROWS: { code: string; description: string; isHeader: boolean }[] = [
  { code: "1", description: "CASH & BALANCES WITH CENTRAL BANK", isHeader: true },
  { code: "1.1", description: "Cash in hand", isHeader: false },
  { code: "1.2", description: "Statutory reserve with CB", isHeader: false },
  { code: "1.3", description: "Free deposits (30% of Dirham lending to non residents)", isHeader: false },
  { code: "1.4", description: "Other balances", isHeader: false },
  { code: "1.5", description: "Central Bank CDs held", isHeader: true },
  { code: "1.5.1", description: "Repoed to UAE Central Bank (gross)", isHeader: false },
  { code: "1.5.2", description: "Others- unencumbered", isHeader: false },
  { code: "2", description: "DUE FROM HEAD OFFICE /OWN BRANCHES/ BANKING SUBS. (GROSS)", isHeader: true },
  { code: "2.1", description: "Due from Head Office of foreign banks & their banking subs", isHeader: false },
  { code: "2.2", description: "Due from overseas BR of national banks/ Banking Subs", isHeader: false },
  { code: "2.3", description: "Bills discounted on own branches, subsidiaries,etc without recourse", isHeader: false },
  { code: "3", description: "BALANCES DUE FROM OTHER BANKS (GROSS)", isHeader: true },
  { code: "3.1", description: "Money at call and short notice, placements on demand and remaining balances", isHeader: false },
  { code: "3.2", description: "Interbank placements", isHeader: false },
  { code: "3.3", description: "Other term placements (loans)", isHeader: false },
  { code: "3.4", description: "Cheques in the course of collection", isHeader: false },
  { code: "3.5", description: "Banks` bills purchased without recourse", isHeader: false },
  { code: "3.6", description: "Lending covered by repurchase agreements", isHeader: false },
  { code: "4", description: "NON BANKING FINANCIAL INSTITUTIONS", isHeader: true },
  { code: "4.1", description: "Loans and advances", isHeader: false },
  { code: "4.2", description: "Placements", isHeader: false },
  { code: "4.3", description: "Lending covered by repurchase agreements", isHeader: false },
  { code: "5", description: "INVESTMENTS AND FINANCIAL ASSETS-BRF 5", isHeader: true },
  { code: "5.1", description: "Trading Book Securities (market value)", isHeader: true },
  { code: "5.1.1", description: "Debt securities", isHeader: false },
  { code: "5.1.2", description: "Equities", isHeader: false },
  { code: "5.1.3", description: "Commodities", isHeader: false },
  { code: "5.2", description: "Banking Book", isHeader: true },
  { code: "5.2.1", description: "Available for sale", isHeader: true },
  { code: "5.2.1.1", description: "Debt securities", isHeader: false },
  { code: "5.2.1.2", description: "Equities", isHeader: false },
  { code: "5.2.2", description: "Held to maturity (amortised cost)", isHeader: false },
  { code: "6", description: "OTHER INVESTMENTS - BRF 5", isHeader: true },
  { code: "6.1", description: "Investment in subsidiaries (Cost or fair value)", isHeader: false },
  { code: "6.2", description: "Investment in affiliates (Cost or fair value)", isHeader: false },
  { code: "7", description: "TRADE BILLS", isHeader: true },
  { code: "7.1", description: "TRADE BILLS- Gov & Public", isHeader: true },
  { code: "7.1.1", description: "Inland trade bills/ PDCs", isHeader: false },
  { code: "7.1.2", description: "Foreign trade bills (Import and export)", isHeader: false },
  { code: "7.2", description: "TRADE BILLS DISCOUNTED- Private", isHeader: true },
  { code: "7.2.1", description: "Inland trade bills/ PDCs", isHeader: false },
  { code: "7.2.2", description: "Foreign trade bills (Import and export)", isHeader: false },
  { code: "8", description: "LOANS & ADVANCES (GROSS)", isHeader: true },
  { code: "8.1", description: "Government & Public Sector", isHeader: true },
  { code: "8.1.1", description: "Federal Govt", isHeader: false },
  { code: "8.1.2", description: "Non Commercial entities (Federal Govt)", isHeader: false },
  { code: "8.1.3", description: "Emirates Governments", isHeader: false },
  { code: "8.1.4", description: "Non-commercial entities (Emirates Govt)", isHeader: false },
  { code: "8.1.5", description: "GREs (Govt ownership more than 50%) (BRF 52-C)", isHeader: false },
  { code: "8.2", description: "Private Sector (corporate)", isHeader: true },
  { code: "8.2.1", description: "Corporates with Govt ownership of less than 50%", isHeader: false },
  { code: "8.2.2", description: "Other corporates", isHeader: false },
  { code: "8.2.3", description: "High Networth Individuals (HNI)", isHeader: false },
  { code: "8.2.4", description: "Small & Medium Enterprises (SMEs)", isHeader: false },
  { code: "8.3", description: "Individuals (BRF 31)", isHeader: false },
  { code: "9", description: "NET FIXED ASSETS", isHeader: true },
  { code: "9.1", description: "Business premises including staff premises", isHeader: false },
  { code: "9.2", description: "Premises acquired towards loan settlement", isHeader: false },
  { code: "9.3", description: "Furniture & fixtures", isHeader: false },
  { code: "9.4", description: "Capital funds for overseas offices of local banks", isHeader: false },
  { code: "9.5", description: "Capital Work in progress", isHeader: false },
  { code: "10", description: "NET INTER BRANCH TRANS (excl 2.1 & 2.2)", isHeader: true },
  { code: "11", description: "OTHER ASSETS", isHeader: true },
  { code: "11.1", description: "Interest receivable", isHeader: false },
  { code: "11.2", description: "Prepaid expenses", isHeader: false },
  { code: "11.3", description: "Goodwill", isHeader: false },
  { code: "11.4", description: "Other Intangible assets", isHeader: false },
  { code: "11.5", description: "Capitalized expenditure", isHeader: false },
  { code: "11.6", description: "Property Investments under own account (Islamic banks only)", isHeader: false },
  { code: "11.7", description: "Dividend receivables/Others", isHeader: false },
  { code: "11.8", description: "Acceptances", isHeader: false },
  { code: "12", description: "POSITIVE FAIR VALUE OF DERIVATIVES", isHeader: true },
  { code: "12.1", description: "Market value Forward contracts (including FX swaps)", isHeader: false },
  { code: "12.2", description: "Market value FX options", isHeader: false },
  { code: "12.3", description: "Market value interest rate derivatives (swaps, options, FRAs, etc..)", isHeader: false },
  { code: "12.4", description: "Market value Financial Futures", isHeader: false },
  { code: "12.5", description: "Market value Credit derivatives", isHeader: false },
  { code: "12.6", description: "Market value Equity derivatives", isHeader: false },
  { code: "12.7", description: "Market value Commodity derivatives", isHeader: false },
  { code: "13", description: "ASSETS", isHeader: true },
];

function padRowNo(index: number): string {
  return String((index + 1) * 10).padStart(4, "0");
}

export const BRF01_SUPTECH_TEMPLATE: Brf01SupTechTemplateRow[] = BASE_ROWS.map(
  (row, index) => ({ ...row, rowNo: padRowNo(index) })
);

// Column numbers are fixed per metric field (same 10 fields on every line),
// per the business rule: 0010, 0020, 0030 ... incrementing by 10.
export const BRF01_SUPTECH_COLUMNS = [
  { key: "resAedAccounts", label: "Resident AED - No. of A/cs", colNo: "0010" },
  { key: "resAedAmount", label: "Resident AED - Amount", colNo: "0020" },
  { key: "resFcyAccounts", label: "Resident FCY - No. of A/cs", colNo: "0030" },
  { key: "resFcyAmount", label: "Resident FCY - Amount", colNo: "0040" },
  { key: "nonresAedAccounts", label: "Non-Resident AED - No. of A/cs", colNo: "0050" },
  { key: "nonresAedAmount", label: "Non-Resident AED - Amount", colNo: "0060" },
  { key: "nonresFcyAccounts", label: "Non-Resident FCY - No. of A/cs", colNo: "0070" },
  { key: "nonresFcyAmount", label: "Non-Resident FCY - Amount", colNo: "0080" },
  { key: "totalAccounts", label: "Total - No. of A/cs", colNo: "0090" },
  { key: "totalAmount", label: "Total - Amount", colNo: "0100" },
] as const;

export type Brf01SupTechMetrics = {
  resAedAccounts: number | null;
  resAedAmount: number | null;
  resFcyAccounts: number | null;
  resFcyAmount: number | null;
  nonresAedAccounts: number | null;
  nonresAedAmount: number | null;
  nonresFcyAccounts: number | null;
  nonresFcyAmount: number | null;
  totalAccounts: number | null;
  totalAmount: number | null;
};

export const EMPTY_SUPTECH_METRICS: Brf01SupTechMetrics = {
  resAedAccounts: null,
  resAedAmount: null,
  resFcyAccounts: null,
  resFcyAmount: null,
  nonresAedAccounts: null,
  nonresAedAmount: null,
  nonresFcyAccounts: null,
  nonresFcyAmount: null,
  totalAccounts: null,
  totalAmount: null,
};

export const BRF01_SUPTECH_ENTITY_GROUPS = ["UAE", "OVS", "SUBSIDIARY"] as const;
export const BRF01_SUPTECH_DATA_SOURCES = ["FGB", "NBAD"] as const;
