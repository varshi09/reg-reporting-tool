import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { withConnection } from "@/lib/db";
import { getCurrentUsername } from "@/lib/auth";
import { validatePassword } from "@/lib/passwordPolicy";

/**
 * Renames a user, resets their password, or both. Either field is optional
 * so the edit page's two sections can save independently. Whichever changes,
 * their existing sessions are dropped - a stale session referencing an old
 * username would be inconsistent, and a session surviving its own password
 * reset defeats the point of the reset.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const body = await request.json();
  const newUsername =
    typeof body.newUsername === "string" ? body.newUsername.trim() : undefined;
  const password = typeof body.password === "string" ? body.password : undefined;
  const isAdmin = typeof body.isAdmin === "boolean" ? body.isAdmin : undefined;

  if (!newUsername && !password && isAdmin === undefined) {
    return NextResponse.json(
      { error: "Nothing to update." },
      { status: 400 }
    );
  }
  if (password) {
    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }
  }
  if (isAdmin === false && username === (await getCurrentUsername())) {
    return NextResponse.json(
      { error: "You can't remove your own admin access." },
      { status: 400 }
    );
  }

  const sets: string[] = [];
  const binds: Record<string, string | number> = { username };
  if (newUsername) {
    sets.push("username = :newUsername");
    binds.newUsername = newUsername;
  }
  if (password) {
    sets.push("password_hash = :passwordHash");
    binds.passwordHash = bcrypt.hashSync(password, 10);
  }
  if (isAdmin !== undefined) {
    sets.push("is_admin = :isAdmin");
    binds.isAdmin = isAdmin ? 1 : 0;
  }

  try {
    const rowsAffected = await withConnection(async (connection) => {
      const result = await connection.execute(
        `UPDATE USERS SET ${sets.join(", ")} WHERE username = :username`,
        binds,
        { autoCommit: true }
      );
      return result.rowsAffected ?? 0;
    });
    if (!rowsAffected) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("ORA-00001")) {
      return NextResponse.json(
        { error: `"${newUsername}" already exists.` },
        { status: 409 }
      );
    }
    throw err;
  }

  await withConnection((connection) =>
    connection.execute(
      `DELETE FROM SESSIONS WHERE username = :username`,
      { username },
      { autoCommit: true }
    )
  );

  return NextResponse.json({ username: newUsername ?? username });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const self = await getCurrentUsername();
  if (self === username) {
    return NextResponse.json(
      { error: "You can't delete the account you're currently signed in as." },
      { status: 400 }
    );
  }

  const rowsAffected = await withConnection(async (connection) => {
    const result = await connection.execute(
      `DELETE FROM USERS WHERE username = :username`,
      { username },
      { autoCommit: true }
    );
    return result.rowsAffected ?? 0;
  });
  if (!rowsAffected) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  await withConnection((connection) =>
    connection.execute(
      `DELETE FROM SESSIONS WHERE username = :username`,
      { username },
      { autoCommit: true }
    )
  );

  return NextResponse.json({ success: true });
}
