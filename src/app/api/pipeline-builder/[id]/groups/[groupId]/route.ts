import { NextRequest, NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { updateGroup, deleteGroup } from "@/lib/pipelineBuilder";
import type { ExecMode } from "@/lib/pipelineBuilder";

type Ctx = { params: Promise<{ id: string; groupId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, groupId } = await params;
  const pipelineId = Number(id);
  const gId = Number(groupId);
  if (Number.isNaN(pipelineId) || Number.isNaN(gId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const fields: { name?: string; sortOrder?: number; execMode?: ExecMode } = {};
  if (body.name !== undefined) fields.name = String(body.name).trim();
  if (body.sortOrder !== undefined) fields.sortOrder = Number(body.sortOrder);
  if (body.execMode !== undefined) fields.execMode = body.execMode as ExecMode;

  const result = await updateGroup(gId, pipelineId, fields);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, groupId } = await params;
  const pipelineId = Number(id);
  const gId = Number(groupId);
  if (Number.isNaN(pipelineId) || Number.isNaN(gId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await deleteGroup(gId, pipelineId);
  return NextResponse.json({ ok: true });
}
