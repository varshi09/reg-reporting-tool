import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { createGroup, reorderGroups, type ExecMode } from "@/lib/pipelineBuilder";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can edit pipelines." }, { status: 403 });
  }

  const { id } = await params;
  const pipelineId = Number(id);
  if (!Number.isFinite(pipelineId)) {
    return NextResponse.json({ error: "Invalid pipeline id." }, { status: 400 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : 0;
  const execMode: ExecMode = body.execMode === "PARALLEL" ? "PARALLEL" : "SEQUENTIAL";
  if (!name) return NextResponse.json({ error: "Enter a group name." }, { status: 400 });

  const groupId = await createGroup(pipelineId, name, sortOrder, execMode, username);
  return NextResponse.json({ id: groupId });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can edit pipelines." }, { status: 403 });
  }

  const { id } = await params;
  const pipelineId = Number(id);
  if (!Number.isFinite(pipelineId)) {
    return NextResponse.json({ error: "Invalid pipeline id." }, { status: 400 });
  }

  const body = await request.json();
  const orderedGroupIds = Array.isArray(body.orderedGroupIds)
    ? body.orderedGroupIds.map(Number)
    : null;
  if (!orderedGroupIds) {
    return NextResponse.json({ error: "orderedGroupIds is required." }, { status: 400 });
  }

  await reorderGroups(pipelineId, orderedGroupIds);
  return NextResponse.json({ ok: true });
}
