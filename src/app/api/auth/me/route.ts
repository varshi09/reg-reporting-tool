import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession, SESSION_COOKIE } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const username = token ? await validateSession(token) : null;

  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  return NextResponse.json({ username });
}
