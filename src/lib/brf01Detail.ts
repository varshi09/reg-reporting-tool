import { withConnection } from "@/lib/db";

export type Brf01DetailRow = {
  timeKey: string;
  workingDay: string;
  entityGroup: string;
  dataSource: string;
  lineNo: string;
  lineDesc: string | null;
  residentFlag: string;
  currencyCode: string;
  customerNumber: string;
  contractNumber: string;
  customerName: string;
  noOfAccounts: number;
  closingBalanceAed: number;
  nationality: string | null;
  nationalityDesc: string | null;
  emirates: string | null;
  countryCode: string | null;
  countryName: string | null;
  glAccountId: string | null;
  target: string | null;
  sector: string | null;
};

type Row = {
  TIME_KEY: string;
  WORKING_DAY: string;
  ENTITY_GROUP: string;
  DATA_SOURCE: string;
  LINE_NO: string;
  LINE_DESC: string | null;
  RESIDENT_FLAG: string;
  CURRENCY_CODE: string;
  CUSTOMER_NUMBER: string;
  CONTRACT_NUMBER: string;
  CUSTOMER_NAME: string;
  NO_OF_ACCOUNTS: number;
  CLOSING_BALANCE_AED: number;
  NATIONALITY: string | null;
  NATIONALITY_DESC: string | null;
  EMIRATES: string | null;
  COUNTRY_CODE: string | null;
  COUNTRY_NAME: string | null;
  GL_ACCOUNT_ID: string | null;
  TARGET: string | null;
  SECTOR: string | null;
};

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

export type Brf01DetailParams = {
  timeKey: string;
  workingDay: string;
  entityGroups: string[];
  dataSources: string[];
  lineNo: string;
  resident: "RES" | "NONRES";
  currency: "AED" | "FCY";
};

function buildDetailQuery(params: Brf01DetailParams): { sql: string; binds: Record<string, string> } {
  const conditions: string[] = ["line_no = :lineNo", "resident_flag = :resident", "working_day = :workingDay"];
  const binds: Record<string, string> = { lineNo: params.lineNo, resident: params.resident, workingDay: params.workingDay };

  if (params.timeKey) {
    conditions.push("time_key = :timeKey");
    binds.timeKey = params.timeKey;
  }
  const entityClause = buildInClause("entity_group", params.entityGroups, "eg", binds);
  if (entityClause) conditions.push(entityClause);

  const dataSourceClause = buildInClause("data_source", params.dataSources, "ds", binds);
  if (dataSourceClause) conditions.push(dataSourceClause);

  conditions.push(params.currency === "AED" ? "currency_code = 'AED'" : "currency_code != 'AED'");

  const sql = `SELECT time_key, working_day, entity_group, data_source, line_no, line_desc, resident_flag, currency_code,
                      customer_number, contract_number, customer_name, no_of_accounts, closing_balance_aed,
                      nationality, nationality_desc, emirates, country_code, country_name,
                      gl_account_id, target, sector
               FROM BRF01_DETAIL
               WHERE ${conditions.join(" AND ")}
               ORDER BY closing_balance_aed DESC`;
  return { sql, binds };
}

function mapRow(r: Row): Brf01DetailRow {
  return {
    timeKey: r.TIME_KEY,
    workingDay: r.WORKING_DAY,
    entityGroup: r.ENTITY_GROUP,
    dataSource: r.DATA_SOURCE,
    lineNo: r.LINE_NO,
    lineDesc: r.LINE_DESC,
    residentFlag: r.RESIDENT_FLAG,
    currencyCode: r.CURRENCY_CODE,
    customerNumber: r.CUSTOMER_NUMBER,
    contractNumber: r.CONTRACT_NUMBER,
    customerName: r.CUSTOMER_NAME,
    noOfAccounts: r.NO_OF_ACCOUNTS,
    closingBalanceAed: r.CLOSING_BALANCE_AED,
    nationality: r.NATIONALITY,
    nationalityDesc: r.NATIONALITY_DESC,
    emirates: r.EMIRATES,
    countryCode: r.COUNTRY_CODE,
    countryName: r.COUNTRY_NAME,
    glAccountId: r.GL_ACCOUNT_ID,
    target: r.TARGET,
    sector: r.SECTOR,
  };
}

/**
 * Detail rows behind one summary cell: same slicing keys as BRF01_SUMMARY
 * (time key, entity groups, data sources, line) plus the specific
 * resident/currency bucket the clicked cell represents. "FCY" matches any
 * non-AED currency, mirroring how the summary collapses all foreign
 * currencies into a single AED-equivalent column.
 */
export async function getBrf01Detail(params: Brf01DetailParams): Promise<Brf01DetailRow[]> {
  const { sql, binds } = buildDetailQuery(params);
  const rows: Row[] = await withConnection(async (connection) => {
    const result = await connection.execute<Row>(sql, binds);
    return result.rows ?? [];
  });
  return rows.map(mapRow);
}
