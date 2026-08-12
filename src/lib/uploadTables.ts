export type UploadColumn = {
  header: string; // normalized (lowercase, alphanumeric only) header expected in the file
  column: string; // destination DB column
  maxSize: number;
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
    key: "DIM_CUSTOMER",
    label: "Customer data",
    columns: [
      { header: "customername", column: "customer_name", maxSize: 200 },
      { header: "customernumber", column: "customer_number", maxSize: 50 },
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
