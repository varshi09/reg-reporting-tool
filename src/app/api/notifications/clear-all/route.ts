import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { clearAllNotifications } from "@/lib/notifications";

export async function POST() {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  await clearAllNotifications(username);
  return NextResponse.json({ success: true });
}
