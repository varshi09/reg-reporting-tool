import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { withConnection } from "@/lib/db";

type UserRow = { USERNAME: string; CREATED_AT: string };

export async function GET() {
  const users = await withConnection(async (connection) => {
    const result = await connection.execute<UserRow>(
      `SELECT username, created_at FROM USERS ORDER BY created_at`
    );
    return result.rows ?? [];
  });

  return NextResponse.json({
    users: users.map((u) => ({ username: u.USERNAME, createdAt: u.CREATED_AT })),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  try {
    await withConnection((connection) =>
      connection.execute(
        `INSERT INTO USERS (username, password_hash) VALUES (:username, :passwordHash)`,
        { username, passwordHash },
        { autoCommit: true }
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("ORA-00001")) {
      return NextResponse.json(
        { error: `"${username}" already exists.` },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ username });
}
