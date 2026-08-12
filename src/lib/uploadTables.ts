export type UploadColumn = {
  header: string; // normalized (lowercase, alphanumeric only) header expected in the file
  column: string; // destination DB column
  maxSize: number;
};

export type UploadTableConfig = {
  key: string; // table name in Oracle; also the required file name prefix
  label: string;
  columns: UploadColumn[];
};

// File name must be exactly "<TABLE_KEY>_YYYYMMDD.xlsx" or ".csv" (case-insensitive).
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

export function fileNamePattern(key: string): RegExp {
  return new RegExp(`^${key}_\\d{8}\\.(xlsx|csv)$`, "i");
}

export function detectUploadTable(fileName: string): UploadTableConfig | null {
  return UPLOAD_TABLES.find((t) => fileNamePattern(t.key).test(fileName)) ?? null;
}

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
