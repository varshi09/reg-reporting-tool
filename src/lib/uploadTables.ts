export type UploadColumn = {
  // Destination DB column. Also the header this column is expected under in
  // the uploaded file — matched case/spacing-insensitively via
  // normalizeHeader(), so "customer_name", "Customer Name", and
  // "CUSTOMERNAME" all match a column named customer_name.
  column: string;
  maxSize: number;
  // Set for DATE columns so the insert wraps the value in TO_DATE(...,
  // 'YYYY-MM-DD') instead of relying on the session's NLS_DATE_FORMAT (which
  // defaults to DD-MON-RR and would reject a plain "2026-07-31" string).
  type?: "date";
};

export type UploadTableConfig = {
  key: string; // table name in Oracle
  label: string;
  columns: UploadColumn[];
};

// The destination table is chosen explicitly by the user (data type dropdown),
// not inferred from the file name. File names may be anything; only the
// extension (.xlsx / .csv) is enforced.
export const UPLOAD_TABLES: UploadTableConfig[] = [
  {
    key: "REF_BRF_CONS_MAPPING_TABLE",
    label: "BS Consolidated Mapping Data",
    columns: [
      { column: "brf_id", maxSize: 500 },
      { column: "brf_line_id", maxSize: 500 },
      { column: "line_desc", maxSize: 500 },
      { column: "line_no", maxSize: 500 },
      { column: "brf_line_set_order", maxSize: 50 },
      { column: "line_type", maxSize: 500 },
      { column: "internal_line_no", maxSize: 4000 },
      { column: "internal_line_incl_excl", maxSize: 500 },
      { column: "gl_no", maxSize: 4000 },
      { column: "from_gl_no", maxSize: 500 },
      { column: "to_gl_no", maxSize: 500 },
      { column: "excl_gl_no", maxSize: 500 },
      { column: "cif_type", maxSize: 500 },
      { column: "cif_type_incl_excl", maxSize: 500 },
      { column: "target_code", maxSize: 500 },
      { column: "target_incl_excl", maxSize: 500 },
      { column: "sector_code", maxSize: 500 },
      { column: "sector_incl_excl", maxSize: 500 },
      { column: "industry_code", maxSize: 500 },
      { column: "industry_incl_excl", maxSize: 500 },
      { column: "category_code", maxSize: 500 },
      { column: "category_incl_excl", maxSize: 500 },
      { column: "product_group", maxSize: 500 },
      { column: "product_group_incl_excl", maxSize: 500 },
      { column: "customer_classification", maxSize: 500 },
      { column: "cust_class_incl_excl", maxSize: 500 },
      { column: "mapped_brf_id", maxSize: 500 },
      { column: "mapped_brf_line_no", maxSize: 500 },
      { column: "trade_bills_classification", maxSize: 500 },
      { column: "banking_type", maxSize: 500 },
      { column: "nationality", maxSize: 500 },
      { column: "residence", maxSize: 500 },
      { column: "deal_sub_type", maxSize: 500 },
      { column: "account_category", maxSize: 500 },
      { column: "bond_non_bond_flag", maxSize: 500 },
      { column: "currency", maxSize: 500 },
      { column: "cons_level", maxSize: 500 },
      { column: "cons_level_code", maxSize: 500 },
      { column: "from_deal_rate", maxSize: 50 },
      { column: "less_than_deal_rate", maxSize: 50 },
      { column: "from_aed", maxSize: 50 },
      { column: "to_aed", maxSize: 50 },
      { column: "account_number", maxSize: 500 },
      { column: "account_number_incl_excl", maxSize: 500 },
      { column: "qtly_reuse_flag", maxSize: 500 },
      { column: "mthly_reused_brf_line_id", maxSize: 500 },
      { column: "cad_purpose", maxSize: 500 },
      { column: "data_source", maxSize: 500 },
      { column: "load_date", maxSize: 30, type: "date" },
      { column: "account_type", maxSize: 500 },
      { column: "hni_sme_flg", maxSize: 500 },
      { column: "hni_sme_excl", maxSize: 100 },
      { column: "loan_type", maxSize: 500 },
      { column: "gl_leve4_code", maxSize: 500 },
      { column: "bs_pl_flag", maxSize: 100 },
      { column: "row_no", maxSize: 50 },
      { column: "gl_leve4_code_excl", maxSize: 1000 },
    ],
  },
];

// Resolves a caller-supplied table key against the static config above.
// Never trust a request body key directly — SQL is built from the resolved
// config's `key`, so it must come from this whitelist.
export function getUploadTable(key: string): UploadTableConfig | null {
  return UPLOAD_TABLES.find((t) => t.key === key) ?? null;
}

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
