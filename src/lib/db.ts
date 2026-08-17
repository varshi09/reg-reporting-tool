import oracledb from "oracledb";

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
// Without this, CLOB columns (e.g. UPLOAD_LOG.rows_json) come back as Lob
// stream objects instead of plain strings, breaking any code that expects
// to read the column value directly.
oracledb.fetchAsString = [oracledb.CLOB];
// Same reasoning for BLOB (e.g. UPLOAD_LOG.file_content) — without this it
// comes back as a Lob stream instead of a Buffer.
oracledb.fetchAsBuffer = [oracledb.BLOB];

let pool: oracledb.Pool | null = null;

async function getPool() {
  if (!pool) {
    pool = await oracledb.createPool({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING,
      poolMin: 1,
      poolMax: 5,
    });
  }
  return pool;
}

export async function withConnection<T>(
  fn: (connection: oracledb.Connection) => Promise<T>
): Promise<T> {
  const activePool = await getPool();
  const connection = await activePool.getConnection();
  try {
    return await fn(connection);
  } finally {
    await connection.close();
  }
}
