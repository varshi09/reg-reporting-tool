import { withConnection } from "@/lib/db";
import { BRF01_TEMPLATE } from "@/lib/brf01Template";

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

/** Every distinct period that actually has BRF01_SUMMARY data, newest first. */
export async function getBrf01Periods(): Promise<string[]> {
  const rows: { TIME_KEY: string }[] = await withConnection(async (connection) => {
    const result = await connection.execute<{ TIME_KEY: string }>(
      `SELECT DISTINCT time_key FROM BRF01_SUMMARY ORDER BY time_key DESC`
    );
    return result.rows ?? [];
  });
  return rows.map((r) => r.TIME_KEY);
}

export type Brf01TrendEntry = {
  code: string;
  description: string;
  isHeader: boolean;
  currentAccounts: number | null;
  currentAmount: number | null;
  previousAccounts: number | null;
  previousAmount: number | null;
  varianceAccounts: number | null;
  varianceAmount: number | null;
  variancePct: number | null;
};

type TrendRow = {
  LINE_NO: string;
  CUR_ACCOUNTS: number | null;
  CUR_AMOUNT: number | null;
  PREV_ACCOUNTS: number | null;
  PREV_AMOUNT: number | null;
};

/**
 * Total accounts/amount per line for two periods, plus the variance between
 * them - a movement/trend view, not the full Resident/Non-Resident x AED/FCY
 * breakdown (that's what the per-cell drill-down is for).
 */
export async function getBrf01Trend(params: {
  currentTimeKey: string;
  previousTimeKey: string;
  entityGroups: string[];
  dataSources: string[];
}): Promise<Brf01TrendEntry[]> {
  const binds: Record<string, string> = {
    currentTimeKey: params.currentTimeKey,
    previousTimeKey: params.previousTimeKey,
  };
  const conditions: string[] = ["time_key IN (:currentTimeKey, :previousTimeKey)"];

  const entityClause = buildInClause("entity_group", params.entityGroups, "eg", binds);
  if (entityClause) conditions.push(entityClause);

  const dataSourceClause = buildInClause("data_source", params.dataSources, "ds", binds);
  if (dataSourceClause) conditions.push(dataSourceClause);

  const rows: TrendRow[] = await withConnection(async (connection) => {
    const result = await connection.execute<TrendRow>(
      `SELECT line_no,
              SUM(CASE WHEN time_key = :currentTimeKey THEN total_accounts ELSE 0 END) AS cur_accounts,
              SUM(CASE WHEN time_key = :currentTimeKey THEN total_amount ELSE 0 END) AS cur_amount,
              SUM(CASE WHEN time_key = :previousTimeKey THEN total_accounts ELSE 0 END) AS prev_accounts,
              SUM(CASE WHEN time_key = :previousTimeKey THEN total_amount ELSE 0 END) AS prev_amount
       FROM BRF01_SUMMARY
       WHERE ${conditions.join(" AND ")}
       GROUP BY line_no`,
      binds
    );
    return result.rows ?? [];
  });

  const byCode = new Map(rows.map((r) => [r.LINE_NO, r]));

  return BRF01_TEMPLATE.map((templateRow) => {
    const row = byCode.get(templateRow.code);
    const currentAmount = row?.CUR_AMOUNT ?? null;
    const previousAmount = row?.PREV_AMOUNT ?? null;
    const currentAccounts = row?.CUR_ACCOUNTS ?? null;
    const previousAccounts = row?.PREV_ACCOUNTS ?? null;

    const varianceAmount =
      currentAmount !== null && previousAmount !== null ? currentAmount - previousAmount : null;
    const varianceAccounts =
      currentAccounts !== null && previousAccounts !== null ? currentAccounts - previousAccounts : null;
    const variancePct =
      varianceAmount !== null && previousAmount !== null && previousAmount !== 0
        ? (varianceAmount / previousAmount) * 100
        : null;

    return {
      code: templateRow.code,
      description: templateRow.description,
      isHeader: templateRow.isHeader,
      currentAccounts,
      currentAmount,
      previousAccounts,
      previousAmount,
      varianceAccounts,
      varianceAmount,
      variancePct,
    };
  });
}
