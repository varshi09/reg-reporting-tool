import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { updateGroup, deleteGroup, type ExecMode } from "@/lib/pipelineBuilder";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; groupId: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can edit pipelines." }, { status: 403 });
  }

  const { id, groupId: groupIdStr } = await params;
  const pipelineId = Number(id);
  const groupId = Number(groupIdStr);
  if (!Number.isFinite(pipelineId) || !Number.isFinite(groupId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const body = await request.json();
  const fields: { name?: string; sortOrder?: number; execMode?: ExecMode } = {};
  if (typeof body.name === "string" && body.name.trim()) fields.name = body.name.trim();
  if (typeof body.sortOrder === "number") fields.sortOrder = body.sortOrder;
  if (body.execMode === "SEQUENTIAL" || body.execMode === "PARALLEL") fields.execMode = body.execMode;

  const result = await updateGroup(groupId, pipelineId, fields);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; groupId: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can edit pipelines." }, { status: 403 });
  }

  const { id, groupId: groupIdStr } = await params;
  const pipelineId = Number(id);
  const groupId = Number(groupIdStr);
  if (!Number.isFinite(pipelineId) || !Number.isFinite(groupId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  await deleteGroup(groupId, pipelineId);
  return NextResponse.json({ ok: true });
}
