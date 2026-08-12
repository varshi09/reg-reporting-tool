import oracledb from "oracledb";

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

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
