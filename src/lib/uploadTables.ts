import oracledb from "oracledb";
import { withConnection } from "@/lib/db";

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

// Lightweight form for list views (dropdowns, role assignment) that don't
// need the full column list - avoids a column-introspection round trip per
// row when all that's needed is key + label.
export type UploadTableSummary = {
  id: number;
  key: string;
  label: string;
};

// Tables that are the app's own infrastructure, never a valid upload
// destination - excluded from the "pick a target table" list when
// registering a new dataset. Everything else in the schema is a candidate;
// admins are trusted to know which of their own reference tables make sense
// as upload targets, the same way they're trusted to create pipelines or
// procedures with no further guardrails.
const NOT_UPLOAD_TARGETS = new Set([
  "PIPELINES", "PIPELINE_GROUPS", "PIPELINE_PROCEDURES", "PIPELINE_PROCEDURE_RUNS",
  "PROCEDURES", "USERS", "SESSIONS", "NOTIFICATIONS", "UPLOAD_LOG", "DATASET_ROLES",
  "REPORT_SUBMISSIONS", "UPLOAD_TABLE_CONFIGS",
]);

export async function getAllUploadTableConfigs(): Promise<UploadTableSummary[]> {
  type Row = { ID: number; LABEL: string; TABLE_NAME: string };
  const rows: Row[] = await withConnection(async (connection) => {
    const result = await connection.execute<Row>(
      `SELECT id, label, table_name FROM UPLOAD_TABLE_CONFIGS ORDER BY label`
    );
    return result.rows ?? [];
  });
  return rows.map((r) => ({ id: r.ID, key: r.TABLE_NAME, label: r.LABEL }));
}

/**
 * Resolves a caller-supplied table key to its full config, with columns
 * detected live from Oracle's own data dictionary - never a stored/typed
 * definition, so it can't drift from the real table (the same class of bug
 * fixed for the procedure catalog). Only returns a config for a table that
 * both (a) has a row in UPLOAD_TABLE_CONFIGS and (b) still physically
 * exists with at least one column, so a caller can never build SQL against
 * an unregistered or dropped table.
 */
export async function getUploadTable(key: string): Promise<UploadTableConfig | null> {
  return withConnection(async (connection) => {
    type ConfigRow = { LABEL: string; TABLE_NAME: string };
    const configRes = await connection.execute<ConfigRow>(
      `SELECT label, table_name FROM UPLOAD_TABLE_CONFIGS WHERE table_name = :key`,
      { key }
    );
    const config = configRes.rows?.[0];
    if (!config) return null;

    type ColRow = {
      COLUMN_NAME: string; DATA_TYPE: string;
      DATA_LENGTH: number; CHAR_LENGTH: number;
    };
    const colsRes = await connection.execute<ColRow>(
      `SELECT c.column_name, c.data_type, c.data_length, c.char_length
       FROM USER_TAB_COLUMNS c
       WHERE c.table_name = :tableName
         AND c.column_name NOT IN (
           SELECT column_name FROM USER_TAB_IDENTITY_COLS WHERE table_name = :tableName2
         )
       ORDER BY c.column_id`,
      { tableName: config.TABLE_NAME, tableName2: config.TABLE_NAME }
    );
    const colRows = colsRes.rows ?? [];
    if (colRows.length === 0) return null;

    const columns: UploadColumn[] = colRows.map((c) => {
      if (c.DATA_TYPE === "DATE" || c.DATA_TYPE.startsWith("TIMESTAMP")) {
        return { column: c.COLUMN_NAME.toLowerCase(), maxSize: 30, type: "date" };
      }
      if (c.DATA_TYPE === "NUMBER" || c.DATA_TYPE === "FLOAT") {
        return { column: c.COLUMN_NAME.toLowerCase(), maxSize: 40 };
      }
      return { column: c.COLUMN_NAME.toLowerCase(), maxSize: c.CHAR_LENGTH || c.DATA_LENGTH };
    });

    return { key: config.TABLE_NAME, label: config.LABEL, columns };
  });
}

export async function getAvailablePhysicalTables(): Promise<string[]> {
  type Row = { TABLE_NAME: string };
  const rows: Row[] = await withConnection(async (connection) => {
    const result = await connection.execute<Row>(
      `SELECT table_name FROM USER_TABLES
       WHERE table_name NOT IN (SELECT table_name FROM UPLOAD_TABLE_CONFIGS)
       ORDER BY table_name`
    );
    return result.rows ?? [];
  });
  return rows.map((r) => r.TABLE_NAME).filter((name) => !NOT_UPLOAD_TARGETS.has(name));
}

export async function createUploadTableConfig(
  label: string,
  tableName: string,
  createdBy: string
): Promise<number> {
  return withConnection(async (connection) => {
    const exists = await connection.execute<{ CNT: number }>(
      `SELECT COUNT(*) AS CNT FROM USER_TABLES WHERE table_name = :tableName`,
      { tableName }
    );
    if ((exists.rows?.[0]?.CNT ?? 0) === 0) {
      throw new Error(`Table ${tableName} does not exist in the database.`);
    }

    const result = await connection.execute<{ ID: number[] }>(
      `INSERT INTO UPLOAD_TABLE_CONFIGS (label, table_name, created_by)
       VALUES (:label, :tableName, :createdBy) RETURNING id INTO :id`,
      {
        label, tableName, createdBy,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );
    return (result.outBinds as { id: number[] }).id[0];
  });
}

export async function renameUploadTableConfig(id: number, label: string): Promise<void> {
  await withConnection((connection) =>
    connection.execute(
      `UPDATE UPLOAD_TABLE_CONFIGS SET label = :label WHERE id = :id`,
      { label, id },
      { autoCommit: true }
    )
  );
}

export async function deleteUploadTableConfig(id: number): Promise<void> {
  await withConnection((connection) =>
    connection.execute(
      `DELETE FROM UPLOAD_TABLE_CONFIGS WHERE id = :id`,
      { id },
      { autoCommit: true }
    )
  );
}

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
