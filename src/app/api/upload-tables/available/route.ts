import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getAvailablePhysicalTables } from "@/lib/uploadTables";

export async function GET() {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can view available tables." }, { status: 403 });
  }

  const tableNames = await getAvailablePhysicalTables();
  return NextResponse.json({ tableNames });
}
