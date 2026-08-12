export type ReportLink = {
  href?: string;
  title: string;
  description?: string;
  // Underlying table used to compute "available to download" / "awaiting
  // input" stats for this report. Omit for reports that don't back onto a
  // single summary table yet.
  table?: string;
  // Catalog entry for a report that isn't built yet — rendered as a static,
  // non-clickable placeholder instead of a link.
  comingSoon?: boolean;
};

export type ReportModule = {
  slug: string;
  label: string;
  icon: string;
  reports: ReportLink[];
};

export type ReportCategory = {
  slug: string;
  label: string;
  modules: ReportModule[];
};

export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    slug: "central-bank-reporting",
    label: "Central Bank Reporting",
    modules: [
      {
        slug: "monthly",
        label: "Monthly reports",
        icon: "ti-calendar",
        reports: [
          {
            href: "/reports/brf01",
            title: "BRF 01 - Assets",
            description: "CBUAE Banking Return Form 01 summary report.",
            table: "BRF01_SUMMARY",
          },
          { title: "BRF 02 - Liabilities", comingSoon: true },
          { title: "BRF 03 - Memorandum Accounts", comingSoon: true },
          { title: "BRF 04 - Income Statements", comingSoon: true },
          { title: "BRF 05 - List Of Securities And Financial Assets", comingSoon: true },
          { title: "BRF 06 - Cash Reserve on Customer Deposits", comingSoon: true },
          { title: "BRF 07 - Advances to Stable Resources Ratio", comingSoon: true },
          { title: "BRF 08 - Liquid Assets Ratio", comingSoon: true },
          { title: "BRF 09 - Assets & Liabilities by Maturity", comingSoon: true },
          { title: "BRF 10 - Currency wise classification of Assets and Liabilities", comingSoon: true },
          { title: "BRF 11 - Assets & Liabilities Repricing wise", comingSoon: true },
          { title: "BRF 12 - Fixed deposits by remaining maturity", comingSoon: true },
          { title: "BRF 13 - Assets and Liabilities by Maturity", comingSoon: true },
          { title: "BRF 31 - Loans and Advances to Individual", comingSoon: true },
          { title: "BRF 33 - Top 50 Largest Deposits and Borrowings", comingSoon: true },
          { title: "BRF 34 - Interbank Counterparties Domestic", comingSoon: true },
          { title: "BRF 35 - Interbank Counterparties - Foreign", comingSoon: true },
          { title: "BRF 36 - Capital Funding and Other term borrowings", comingSoon: true },
          { title: "BRF 37 - Interest Paid and Received", comingSoon: true },
          { title: "BRF 38 - Country-wise Remittances Report", comingSoon: true },
          { title: "BRF 48 - Investments & Financial Assets by Counter Party", comingSoon: true },
          { title: "BRF 50 - Banking and Monetary Statistics", comingSoon: true },
        ],
      },
      {
        slug: "weekly",
        label: "Weekly reports",
        icon: "ti-calendar-week",
        reports: [
          { title: "BRF 01 - Assets Weekly", comingSoon: true },
          { title: "BRF 02 - Liabilities Weekly", comingSoon: true },
          { title: "BRF 09 - Assets & Liabilities by Maturity Weekly", comingSoon: true },
        ],
      },
      {
        slug: "quarterly",
        label: "Quarterly reports",
        icon: "ti-calendar-stats",
        reports: [
          { title: "BRF 51 - Global Assets", comingSoon: true },
          { title: "BRF 52 - Global Liabilities", comingSoon: true },
          { title: "BRF 53 - Global Income Statement", comingSoon: true },
          { title: "BRF 54 - Global Advances To Stable Ratios", comingSoon: true },
          { title: "BRF 56 - Emirate Wise Classification of Loans and Advances", comingSoon: true },
          { title: "BRF 59 - Country Exposure", comingSoon: true },
          { title: "BRF 60 - Regulatory Investment Limit", comingSoon: true },
          { title: "BRF 67 - Size Wise Classification of Deposits", comingSoon: true },
          { title: "BRF 68 - Emirate Wise Classification Of Deposits", comingSoon: true },
          { title: "BRF 91 - Balance of Payments", comingSoon: true },
          { title: "BRF 92 - Balance of Payments", comingSoon: true },
          { title: "BRF 93 - Segment-wise Outward Remittances", comingSoon: true },
          { title: "BRF 94 - Segment-wise Inward Remittances", comingSoon: true },
          { title: "BRF 102 - Top 100 Dormant Account Report", comingSoon: true },
          { title: "BRF 103 - Dormant Account Summary Report", comingSoon: true },
          { title: "BRF 110 - Balance of Payments BS", comingSoon: true },
          { title: "BRF 110 - Balance of Payments PL", comingSoon: true },
        ],
      },
      {
        slug: "half-yearly",
        label: "Half-yearly reports",
        icon: "ti-calendar-due",
        reports: [
          { title: "BRF 204 - Non Resident Assets of UAE Operations Detail", comingSoon: true },
          { title: "BRF 205 - Non Resident Liabilities & Capital of UAE Operations", comingSoon: true },
          { title: "BRF 206 - Non Resident Investments by Counterparty of UAE Operations", comingSoon: true },
          { title: "BRF 207 - Consolidated Balance Sheet - Assets", comingSoon: true },
          { title: "BRF 208 - Consolidated Balance Sheet - Liabilities, Capital and Contingent Liabilities", comingSoon: true },
          { title: "BRF 209 - Consolidated Income Statement", comingSoon: true },
        ],
      },
      {
        slug: "fr",
        label: "FR reports",
        icon: "ti-file-report",
        reports: [
          { title: "FR 09 - Assets & Liabilities by Maturity", comingSoon: true },
          { title: "FR-34 - Interbank Domestic", comingSoon: true },
          { title: "FR-35 - Foreign Interbank", comingSoon: true },
          { title: "FR-36(A) - Capital Market Funding", comingSoon: true },
          { title: "FR-36(B) - Term Borrowings", comingSoon: true },
          { title: "FR5 - Investments", comingSoon: true },
          { title: "FR5 - Debt Securities", comingSoon: true },
          { title: "FR-03 - Off Balance Sheet", comingSoon: true },
          { title: "FR-3 (B) - Derivatives Base", comingSoon: true },
          { title: "FR-3 (C) - Derivatives Expanded", comingSoon: true },
          { title: "FR-49 - FX Transactions USD/AED", comingSoon: true },
          { title: "FR-50 - Swaps Transactions USD-AED", comingSoon: true },
          { title: "FR - Sensitivity Data", comingSoon: true },
        ],
      },
      {
        slug: "solo-cons",
        label: "Solo and Cons reports",
        icon: "ti-building-bank",
        reports: [
          { title: "BRF 01 - Assets Solo & Cons", comingSoon: true },
          { title: "BRF 02 - Liabilities Solo & Cons", comingSoon: true },
          { title: "BRF 03 - Memorandum Accounts Solo & Cons", comingSoon: true },
          { title: "BRF 04 - Income Statements Solo & Cons", comingSoon: true },
          { title: "BRF 05 - List Of Securities And Financial Assets Solo & Cons", comingSoon: true },
          { title: "BRF 07 - Advances to Stable Resources Ratio Solo & Cons", comingSoon: true },
          { title: "BRF 08 - Liquid Assets Ratio Solo & Cons", comingSoon: true },
          { title: "BRF 09 - Assets & Liabilities by Maturity Solo & Cons", comingSoon: true },
        ],
      },
      {
        slug: "daily",
        label: "Daily reports",
        icon: "ti-calendar-event",
        reports: [
          { title: "BRF 37 - Interest Paid and Received_NEW", comingSoon: true },
          { title: "035-Brf-001-A - Withdrawal of Deposits", comingSoon: true },
          { title: "035-BRF-003-A - New Deposit transactions", comingSoon: true },
        ],
      },
      {
        slug: "interim-srr",
        label: "Interim SRR",
        icon: "ti-report",
        reports: [
          { title: "BRF 06 - Cash Reserve on Customer Deposits", comingSoon: true },
        ],
      },
      {
        slug: "islamic-banking",
        label: "Islamic Banking (BRF)",
        icon: "ti-building-mosque",
        reports: [
          { title: "BRF 01 - Assets ISB", comingSoon: true },
          { title: "BRF 02 - Liabilities ISB", comingSoon: true },
          { title: "BRF 3 - Memorandum Accounts ISB", comingSoon: true },
          { title: "BRF 09 - Assets & Liabilities by Maturity ISB", comingSoon: true },
          { title: "BRF 33 - Top 50 Largest Deposits and Borrowings ISB", comingSoon: true },
        ],
      },
      {
        slug: "islamic-banking-new",
        label: "Islamic Banking (IBRF)",
        icon: "ti-building-mosque",
        reports: [
          { title: "IBRF 01 - Assets", comingSoon: true },
          { title: "IBRF 02 - Liabilities", comingSoon: true },
          { title: "IBRF 3 - Memorandum Accounts", comingSoon: true },
          { title: "IBRF 06 - Analysis of Financing Contracts", comingSoon: true },
          { title: "IBRF 07 - Top 50 Largest Deposits and Borrowings", comingSoon: true },
          { title: "IBRF 08 - Assets & Liabilities by Maturity", comingSoon: true },
          { title: "IBRF 11 - Liquid Assets Ratio", comingSoon: true },
          { title: "IBRF 12 - Advances to Stable Resources Ratio", comingSoon: true },
        ],
      },
      {
        slug: "req-39368",
        label: "Req 39368",
        icon: "ti-file-alert",
        reports: [
          { title: "BRF 3 - Memorandum Accounts_Sensitivity", comingSoon: true },
        ],
      },
    ],
  },
  {
    slug: "central-bank-reporting-suptech",
    label: "Central Bank Reporting - Sup Tech",
    modules: [
      {
        slug: "monthly",
        label: "Monthly reports",
        icon: "ti-calendar",
        reports: [
          {
            href: "/reports/brf01-suptech",
            title: "BRF 1.1 - Assets",
            description: "CBUAE Banking Return Form 1.1 summary report.",
            table: "BRF01_SUPTECH_SUMMARY",
          },
        ],
      },
      { slug: "weekly", label: "Weekly reports", icon: "ti-calendar-week", reports: [] },
      { slug: "quarterly", label: "Quarterly reports", icon: "ti-calendar-stats", reports: [] },
      { slug: "half-yearly", label: "Half-yearly reports", icon: "ti-calendar-due", reports: [] },
      { slug: "fr", label: "FR reports", icon: "ti-file-report", reports: [] },
      { slug: "solo-cons", label: "Solo and Cons reports", icon: "ti-building-bank", reports: [] },
    ],
  },
];

export function getCategory(slug: string): ReportCategory | undefined {
  return REPORT_CATEGORIES.find((c) => c.slug === slug);
}

export function getModule(
  categorySlug: string,
  moduleSlug: string
): { category: ReportCategory; module: ReportModule } | undefined {
  const category = getCategory(categorySlug);
  const module_ = category?.modules.find((m) => m.slug === moduleSlug);
  if (!category || !module_) return undefined;
  return { category, module: module_ };
}
