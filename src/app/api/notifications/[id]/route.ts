import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { clearNotification } from "@/lib/notifications";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  await clearNotification(Number(id), username);
  return NextResponse.json({ success: true });
}
