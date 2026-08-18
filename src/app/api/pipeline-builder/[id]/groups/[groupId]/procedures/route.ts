import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { addProcedureToGroup, reorderProceduresInGroup } from "@/lib/pipelineBuilder";

export async function POST(
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
  const procedureId = Number(body.procedureId);
  const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : 0;
  const dependsOnDataset =
    typeof body.dependsOnDataset === "string" && body.dependsOnDataset.trim()
      ? body.dependsOnDataset.trim()
      : null;
  if (!Number.isFinite(procedureId)) {
    return NextResponse.json({ error: "Invalid procedure id." }, { status: 400 });
  }

  const ppId = await addProcedureToGroup(pipelineId, groupId, procedureId, sortOrder, dependsOnDataset);
  return NextResponse.json({ id: ppId });
}

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
  const orderedPpIds = Array.isArray(body.orderedPpIds) ? body.orderedPpIds.map(Number) : null;
  if (!orderedPpIds) {
    return NextResponse.json({ error: "orderedPpIds is required." }, { status: 400 });
  }

  await reorderProceduresInGroup(pipelineId, groupId, orderedPpIds);
  return NextResponse.json({ ok: true });
}
