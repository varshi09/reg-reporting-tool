import { withConnection } from "@/lib/db";

export async function notify(
  username: string,
  message: string,
  link?: string
): Promise<void> {
  await withConnection((connection) =>
    connection.execute(
      `INSERT INTO NOTIFICATIONS (username, message, link) VALUES (:username, :message, :link)`,
      { username, message, link: link ?? null },
      { autoCommit: true }
    )
  );
}

/** Notifies several people at once — e.g. every Checker assigned to a dataset. */
export async function notifyMany(
  usernames: string[],
  message: string,
  link?: string
): Promise<void> {
  for (const username of usernames) {
    await notify(username, message, link);
  }
}

export type NotificationRow = {
  id: number;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export async function getNotifications(username: string): Promise<NotificationRow[]> {
  type Row = { ID: number; MESSAGE: string; LINK: string | null; IS_READ: number; CREATED_AT: string };
  const rows: Row[] = await withConnection(async (connection) => {
    const result = await connection.execute<Row>(
      `SELECT id, message, link, is_read, created_at
       FROM NOTIFICATIONS
       WHERE username = :username
       ORDER BY created_at DESC
       FETCH FIRST 20 ROWS ONLY`,
      { username }
    );
    return result.rows ?? [];
  });
  return rows.map((r) => ({
    id: r.ID,
    message: r.MESSAGE,
    link: r.LINK,
    isRead: r.IS_READ === 1,
    createdAt: r.CREATED_AT,
  }));
}

export async function getUnreadCount(username: string): Promise<number> {
  const count = await withConnection(async (connection) => {
    const result = await connection.execute<{ CNT: number }>(
      `SELECT COUNT(*) AS CNT FROM NOTIFICATIONS WHERE username = :username AND is_read = 0`,
      { username }
    );
    return result.rows?.[0]?.CNT ?? 0;
  });
  return count;
}

export async function markRead(id: number, username: string): Promise<void> {
  await withConnection((connection) =>
    connection.execute(
      `UPDATE NOTIFICATIONS SET is_read = 1 WHERE id = :id AND username = :username`,
      { id, username },
      { autoCommit: true }
    )
  );
}

export async function markAllRead(username: string): Promise<void> {
  await withConnection((connection) =>
    connection.execute(
      `UPDATE NOTIFICATIONS SET is_read = 1 WHERE username = :username AND is_read = 0`,
      { username },
      { autoCommit: true }
    )
  );
}
