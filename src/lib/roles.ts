import { withConnection } from "@/lib/db";

export type DatasetRole = "MAKER" | "CHECKER";

export async function isAdmin(username: string): Promise<boolean> {
  const flag = await withConnection(async (connection) => {
    const result = await connection.execute<{ IS_ADMIN: number }>(
      `SELECT is_admin FROM USERS WHERE username = :username`,
      { username }
    );
    return result.rows?.[0]?.IS_ADMIN ?? 0;
  });
  return flag === 1;
}

/** Dataset keys the user holds a MAKER row for — drives the Upload page's dropdown. */
export async function getMakerDatasets(username: string): Promise<string[]> {
  const rows: { DATASET_KEY: string }[] = await withConnection(async (connection) => {
    const result = await connection.execute<{ DATASET_KEY: string }>(
      `SELECT dataset_key FROM DATASET_ROLES WHERE username = :username AND role = 'MAKER'`,
      { username }
    );
    return result.rows ?? [];
  });
  return rows.map((r) => r.DATASET_KEY);
}

/**
 * Datasets a Checker can act on. Admins bypass DATASET_ROLES entirely and
 * can review anything — the agreed backup-checker behavior.
 */
export async function getCheckerDatasets(
  username: string,
  allDatasetKeys: string[]
): Promise<string[]> {
  if (await isAdmin(username)) return allDatasetKeys;

  const rows: { DATASET_KEY: string }[] = await withConnection(async (connection) => {
    const result = await connection.execute<{ DATASET_KEY: string }>(
      `SELECT dataset_key FROM DATASET_ROLES WHERE username = :username AND role = 'CHECKER'`,
      { username }
    );
    return result.rows ?? [];
  });
  return rows.map((r) => r.DATASET_KEY);
}

/** Whether anyone (any human Checker, or an Admin) can review this dataset. */
export async function hasReviewerAvailable(datasetKey: string): Promise<boolean> {
  const checkerCount = await withConnection(async (connection) => {
    const result = await connection.execute<{ CNT: number }>(
      `SELECT COUNT(*) AS CNT FROM DATASET_ROLES WHERE dataset_key = :datasetKey AND role = 'CHECKER'`,
      { datasetKey }
    );
    return result.rows?.[0]?.CNT ?? 0;
  });
  if (checkerCount > 0) return true;

  const adminCount = await withConnection(async (connection) => {
    const result = await connection.execute<{ CNT: number }>(
      `SELECT COUNT(*) AS CNT FROM USERS WHERE is_admin = 1`
    );
    return result.rows?.[0]?.CNT ?? 0;
  });
  return adminCount > 0;
}

export type UserDatasetRole = { datasetKey: string; role: DatasetRole };

/** All dataset-role assignments for one user — feeds the Edit user page. */
export async function getRolesForUser(username: string): Promise<UserDatasetRole[]> {
  const rows: { DATASET_KEY: string; ROLE: DatasetRole }[] = await withConnection(
    async (connection) => {
      const result = await connection.execute<{ DATASET_KEY: string; ROLE: DatasetRole }>(
        `SELECT dataset_key, role FROM DATASET_ROLES WHERE username = :username`,
        { username }
      );
      return result.rows ?? [];
    }
  );
  return rows.map((r) => ({ datasetKey: r.DATASET_KEY, role: r.ROLE }));
}

/** Sets (or clears, when role is null) a user's role for one dataset. */
export async function setDatasetRole(
  username: string,
  datasetKey: string,
  role: DatasetRole | null
): Promise<void> {
  await withConnection(async (connection) => {
    await connection.execute(
      `DELETE FROM DATASET_ROLES WHERE username = :username AND dataset_key = :datasetKey`,
      { username, datasetKey },
      { autoCommit: role === null }
    );
    if (role) {
      await connection.execute(
        `INSERT INTO DATASET_ROLES (username, dataset_key, role) VALUES (:username, :datasetKey, :role)`,
        { username, datasetKey, role },
        { autoCommit: true }
      );
    }
  });
}
