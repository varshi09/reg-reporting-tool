import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { markAllRead } from "@/lib/notifications";

export async function POST() {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  await markAllRead(username);
  return NextResponse.json({ success: true });
}
