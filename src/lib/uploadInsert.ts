import oracledb from "oracledb";
import { withConnection } from "@/lib/db";
import type { UploadTableConfig } from "@/lib/uploadTables";
import type { UploadRow } from "@/lib/uploadParser";

/**
 * Turns a raw Oracle driver message into something a reporting officer can
 * act on, keeping the ORA- code appended for traceability. Note that
 * `batchErrors` entries are Error objects carrying `message` and `offset`
 * directly — there is no nested `.error` property.
 */
function describeOracleError(rawMessage: string | undefined): string {
  const raw = (rawMessage ?? "").split("\n")[0].trim();
  if (!raw) return "The database rejected this record.";

  const code = raw.match(/ORA-\d{5}/)?.[0];
  const plain =
    code === "ORA-00001"
      ? "Duplicate record — a row with this key already exists in the table."
      : code === "ORA-01400"
        ? "A required column was empty."
        : code === "ORA-12899"
          ? "A value is too long for its column."
          : code === "ORA-01722"
            ? "A value is not a valid number."
            : code === "ORA-01861"
              ? "A value does not match the expected date format."
              : raw;

  return plain === raw || !code ? plain : `${plain} (${code})`;
}

// UPLOAD_LOG.failure_reasons is VARCHAR2(4000 BYTE); stay well under that so
// multi-byte characters in a reason can't push us over the limit.
const FAILURE_REASONS_MAX_CHARS = 3900;

export function summarizeFailureReasons(
  items: { record?: number; reason: string }[]
): string | null {
  if (items.length === 0) return null;
  const joined = items
    .map((item) => (item.record !== undefined ? `Record ${item.record}: ${item.reason}` : item.reason))
    .join("; ");
  return joined.length > FAILURE_REASONS_MAX_CHARS
    ? `${joined.slice(0, FAILURE_REASONS_MAX_CHARS - 1)}…`
    : joined;
}

export type InsertResult = {
  committed: boolean;
  insertedCount: number;
  rowErrors: { record?: number; reason: string }[];
};

/**
 * Runs the actual all-or-nothing load into a dataset's destination table.
 * Used only at approval time — the upload endpoint stages rows instead of
 * calling this directly, so nothing lands in the real table until a
 * Checker signs off.
 */
export async function insertRows(
  table: UploadTableConfig,
  rows: UploadRow[]
): Promise<InsertResult> {
  const bindDefs: Record<string, { type: number; maxSize: number }> = {};
  for (const col of table.columns) {
    bindDefs[col.column] = { type: oracledb.STRING, maxSize: col.maxSize };
  }

  const insertColumns = table.columns.map((c) => c.column);
  // Date columns are bound as plain strings like every other column, so they
  // need an explicit TO_DATE — otherwise Oracle falls back to the session's
  // NLS_DATE_FORMAT (DD-MON-RR by default), which rejects the YYYY-MM-DD
  // format the parser produces.
  const insertSql = `INSERT INTO ${table.key} (${insertColumns.join(", ")})
     VALUES (${insertColumns
       .map((c) =>
         table.columns.find((col) => col.column === c)?.type === "date"
           ? `TO_DATE(:${c}, 'YYYY-MM-DD')`
           : `:${c}`
       )
       .join(", ")})`;

  // All-or-nothing load. autoCommit is off so that if the database rejects
  // even one row we roll the whole batch back — a partially loaded
  // regulatory dataset looks complete but isn't, which is worse than a
  // failed load that can be retried.
  const { batchErrors, committed } = await withConnection(async (connection) => {
    const execResult = await connection.executeMany(insertSql, rows, {
      autoCommit: false,
      batchErrors: true,
      bindDefs,
    });

    const errors = execResult.batchErrors ?? [];
    if (errors.length > 0) {
      await connection.rollback();
      return { batchErrors: errors, committed: false };
    }

    await connection.commit();
    return { batchErrors: errors, committed: true };
  });

  const rowErrors = batchErrors.map((err: { message?: string; offset?: number }) => ({
    // Batch offsets are zero-based over the valid rows, so offset 0 is
    // record 1 (file row 2).
    record: err.offset !== undefined ? err.offset + 1 : undefined,
    reason: describeOracleError(err.message),
  }));

  return {
    committed,
    insertedCount: committed ? rows.length : 0,
    rowErrors,
  };
}
