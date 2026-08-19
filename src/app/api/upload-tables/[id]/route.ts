import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { renameUploadTableConfig, deleteUploadTableConfig } from "@/lib/uploadTables";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can edit upload tables." }, { status: 403 });
  }

  const { id } = await params;
  const configId = Number(id);
  if (!Number.isFinite(configId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const body = await request.json();
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return NextResponse.json({ error: "Enter a display name." }, { status: 400 });

  await renameUploadTableConfig(configId, label);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can remove upload tables." }, { status: 403 });
  }

  const { id } = await params;
  const configId = Number(id);
  if (!Number.isFinite(configId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  await deleteUploadTableConfig(configId);
  return NextResponse.json({ ok: true });
}
