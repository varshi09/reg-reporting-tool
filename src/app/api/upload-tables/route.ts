import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getAllUploadTableConfigs, createUploadTableConfig } from "@/lib/uploadTables";

export async function GET() {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const tables = await getAllUploadTableConfigs();
  return NextResponse.json({ tables });
}

export async function POST(request: Request) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can add upload tables." }, { status: 403 });
  }

  const body = await request.json();
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const tableName = typeof body.tableName === "string" ? body.tableName.trim() : "";
  if (!label) return NextResponse.json({ error: "Enter a display name." }, { status: 400 });
  if (!tableName) return NextResponse.json({ error: "Choose a target table." }, { status: 400 });

  try {
    const id = await createUploadTableConfig(label, tableName, username);
    return NextResponse.json({ id });
  } catch (err) {
    if (err instanceof Error && err.message.includes("ORA-00001")) {
      return NextResponse.json({ error: "That table is already registered as an upload dataset." }, { status: 400 });
    }
    if (err instanceof Error && err.message.includes("does not exist")) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
