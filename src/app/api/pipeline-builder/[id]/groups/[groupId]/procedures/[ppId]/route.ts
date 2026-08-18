import { NextRequest, NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { updateProcedureInGroup, removeProcedureFromGroup } from "@/lib/pipelineBuilder";

type Ctx = { params: Promise<{ id: string; groupId: string; ppId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ppId } = await params;
  const pipelineId = Number(id);
  const ppIdNum = Number(ppId);
  if (Number.isNaN(pipelineId) || Number.isNaN(ppIdNum))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const fields: { sortOrder?: number; dependsOnDataset?: string | null; groupId?: number } = {};
  if (body.sortOrder !== undefined) fields.sortOrder = Number(body.sortOrder);
  if (body.groupId !== undefined) fields.groupId = Number(body.groupId);
  if (Object.prototype.hasOwnProperty.call(body, "dependsOnDataset"))
    fields.dependsOnDataset = body.dependsOnDataset ?? null;

  await updateProcedureInGroup(ppIdNum, pipelineId, fields);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ppId } = await params;
  const pipelineId = Number(id);
  const ppIdNum = Number(ppId);
  if (Number.isNaN(pipelineId) || Number.isNaN(ppIdNum))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await removeProcedureFromGroup(ppIdNum, pipelineId);
  return NextResponse.json({ ok: true });
}
