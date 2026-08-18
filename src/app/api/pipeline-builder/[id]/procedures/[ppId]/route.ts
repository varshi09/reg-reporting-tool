import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { updateProcedureInGroup, removeProcedureFromGroup } from "@/lib/pipelineBuilder";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; ppId: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can edit pipelines." }, { status: 403 });
  }

  const { id, ppId: ppIdStr } = await params;
  const pipelineId = Number(id);
  const ppId = Number(ppIdStr);
  if (!Number.isFinite(pipelineId) || !Number.isFinite(ppId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const body = await request.json();
  const fields: { sortOrder?: number; dependsOnDataset?: string | null; groupId?: number } = {};
  if (typeof body.sortOrder === "number") fields.sortOrder = body.sortOrder;
  if (typeof body.groupId === "number") fields.groupId = body.groupId;
  if (Object.prototype.hasOwnProperty.call(body, "dependsOnDataset")) {
    fields.dependsOnDataset =
      typeof body.dependsOnDataset === "string" && body.dependsOnDataset.trim()
        ? body.dependsOnDataset.trim()
        : null;
  }

  await updateProcedureInGroup(ppId, pipelineId, fields);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; ppId: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can edit pipelines." }, { status: 403 });
  }

  const { id, ppId: ppIdStr } = await params;
  const pipelineId = Number(id);
  const ppId = Number(ppIdStr);
  if (!Number.isFinite(pipelineId) || !Number.isFinite(ppId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  await removeProcedureFromGroup(ppId, pipelineId);
  return NextResponse.json({ ok: true });
}
