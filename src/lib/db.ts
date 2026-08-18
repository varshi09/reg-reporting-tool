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

// CBUAE reporting is UAE-based, so every timestamp the app generates or
// compares against must be Gulf Standard Time - not whatever timezone the
// host machine's OS happens to be set to. SYSTIMESTAMP reflects the DB
// SERVER's OS timezone (which may not be GST at all), while LOCALTIMESTAMP
// reflects the SESSION timezone - so every "now" in this app must use
// LOCALTIMESTAMP, never SYSTIMESTAMP, and the session timezone is forced
// here rather than left to whatever the connecting client's OS inherits.
function sessionCallback(
  connection: oracledb.Connection,
  requestedTag: string | undefined,
  callback: (err?: Error) => void
) {
  connection.execute(`ALTER SESSION SET TIME_ZONE = '+04:00'`, (err: Error | undefined) => callback(err ?? undefined));
}

async function getPool() {
  if (!pool) {
    pool = await oracledb.createPool({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING,
      poolMin: 1,
      poolMax: 5,
      sessionCallback,
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
