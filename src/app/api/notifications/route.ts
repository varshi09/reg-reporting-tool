import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { getNotifications, getUnreadCount } from "@/lib/notifications";

export async function GET() {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(username),
    getUnreadCount(username),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
