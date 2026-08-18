import { NextRequest, NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { addProcedureToGroup, reorderProceduresInGroup } from "@/lib/pipelineBuilder";

type Ctx = { params: Promise<{ id: string; groupId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, groupId } = await params;
  const pipelineId = Number(id);
  const gId = Number(groupId);
  if (Number.isNaN(pipelineId) || Number.isNaN(gId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const { procedureId, sortOrder = 0, dependsOnDataset = null } = body;
  if (!procedureId) return NextResponse.json({ error: "procedureId is required" }, { status: 400 });

  const ppId = await addProcedureToGroup(pipelineId, gId, Number(procedureId), sortOrder, dependsOnDataset);
  return NextResponse.json({ pipelineProcedureId: ppId }, { status: 201 });
}

// PATCH — reorder procedures within a group
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, groupId } = await params;
  const pipelineId = Number(id);
  const gId = Number(groupId);
  if (Number.isNaN(pipelineId) || Number.isNaN(gId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { orderedPpIds } = await req.json();
  if (!Array.isArray(orderedPpIds)) return NextResponse.json({ error: "orderedPpIds required" }, { status: 400 });

  await reorderProceduresInGroup(pipelineId, gId, orderedPpIds);
  return NextResponse.json({ ok: true });
}
