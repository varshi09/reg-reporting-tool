import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { withConnection } from "@/lib/db";

export const SESSION_COOKIE = "rrt_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

type UserRow = { USERNAME: string; PASSWORD_HASH: string };

/**
 * Verifies a username/password against USERS and, on success, issues a new
 * server-side session row plus its token. Returns null on any mismatch —
 * callers should give the same "invalid username or password" response
 * either way, so a wrong password can't be used to enumerate usernames.
 */
export async function login(
  username: string,
  password: string
): Promise<{ token: string; username: string } | null> {
  const user = await withConnection(async (connection) => {
    const result = await connection.execute<UserRow>(
      `SELECT username, password_hash FROM USERS WHERE username = :username`,
      { username }
    );
    return result.rows?.[0] ?? null;
  });

  if (!user || !bcrypt.compareSync(password, user.PASSWORD_HASH)) {
    return null;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await withConnection((connection) =>
    connection.execute(
      `INSERT INTO SESSIONS (token, username, expires_at)
       VALUES (:token, :username, :expiresAt)`,
      { token, username: user.USERNAME, expiresAt },
      { autoCommit: true }
    )
  );

  return { token, username: user.USERNAME };
}

/** Looks up a session token and returns the username if it's still valid. */
export async function validateSession(token: string): Promise<string | null> {
  const row = await withConnection(async (connection) => {
    const result = await connection.execute<{ USERNAME: string }>(
      `SELECT username FROM SESSIONS
       WHERE token = :token AND expires_at > SYSTIMESTAMP`,
      { token }
    );
    return result.rows?.[0] ?? null;
  });
  return row?.USERNAME ?? null;
}

/** Deletes a session row outright — a real, server-enforced logout. */
export async function destroySession(token: string): Promise<void> {
  await withConnection((connection) =>
    connection.execute(
      `DELETE FROM SESSIONS WHERE token = :token`,
      { token },
      { autoCommit: true }
    )
  );
}
