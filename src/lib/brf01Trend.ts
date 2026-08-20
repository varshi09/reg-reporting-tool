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

/** Sorts "WD1".."WD10" numerically where possible - plain string sort would put "WD10" before "WD2". */
function sortWorkingDays(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const na = /^WD(\d+)$/i.exec(a);
    const nb = /^WD(\d+)$/i.exec(b);
    if (na && nb) return Number(na[1]) - Number(nb[1]);
    return a.localeCompare(b);
  });
}

/** Every working day reported for a period, oldest first, plus the latest (current) one. */
export async function getBrf01WorkingDays(timeKey: string): Promise<{ current: string; history: string[] }> {
  const rows: { WORKING_DAY: string }[] = await withConnection(async (connection) => {
    const result = await connection.execute<{ WORKING_DAY: string }>(
      `SELECT DISTINCT working_day FROM BRF01_SUMMARY WHERE time_key = :timeKey`,
      { timeKey }
    );
    return result.rows ?? [];
  });
  const history = sortWorkingDays(rows.map((r) => r.WORKING_DAY));
  return { current: history[history.length - 1] ?? "WD1", history: history.length ? history : ["WD1"] };
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
  currentWorkingDay?: string;
  previousWorkingDay?: string;
  entityGroups: string[];
  dataSources: string[];
}): Promise<Brf01TrendEntry[]> {
  // Each period defaults to its own latest (current) working day - "the
  // as-reported figure for that period" - since WD1..WD5 tracks each
  // period's own adjustment window independently, but either side can be
  // pinned to an explicit working day to compare a specific adjustment.
  const [currentWd, previousWd] = await Promise.all([
    params.currentWorkingDay ?? getBrf01WorkingDays(params.currentTimeKey).then((w) => w.current),
    params.previousWorkingDay ?? getBrf01WorkingDays(params.previousTimeKey).then((w) => w.current),
  ]);

  const binds: Record<string, string> = {
    currentTimeKey: params.currentTimeKey,
    currentWd,
    previousTimeKey: params.previousTimeKey,
    previousWd,
  };
  const conditions: string[] = ["time_key IN (:currentTimeKey, :previousTimeKey)"];

  const entityClause = buildInClause("entity_group", params.entityGroups, "eg", binds);
  if (entityClause) conditions.push(entityClause);

  const dataSourceClause = buildInClause("data_source", params.dataSources, "ds", binds);
  if (dataSourceClause) conditions.push(dataSourceClause);

  const rows: TrendRow[] = await withConnection(async (connection) => {
    const result = await connection.execute<TrendRow>(
      `SELECT line_no,
              SUM(CASE WHEN time_key = :currentTimeKey AND working_day = :currentWd THEN total_accounts ELSE 0 END) AS cur_accounts,
              SUM(CASE WHEN time_key = :currentTimeKey AND working_day = :currentWd THEN total_amount ELSE 0 END) AS cur_amount,
              SUM(CASE WHEN time_key = :previousTimeKey AND working_day = :previousWd THEN total_accounts ELSE 0 END) AS prev_accounts,
              SUM(CASE WHEN time_key = :previousTimeKey AND working_day = :previousWd THEN total_amount ELSE 0 END) AS prev_amount
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
