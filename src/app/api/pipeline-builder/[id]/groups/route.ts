import { NextRequest, NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { createGroup, reorderGroups } from "@/lib/pipelineBuilder";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const pipelineId = Number(id);
  if (Number.isNaN(pipelineId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const { name, sortOrder = 0, execMode = "SEQUENTIAL" } = body;
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const groupId = await createGroup(pipelineId, name.trim(), sortOrder, execMode, username);
  return NextResponse.json({ groupId }, { status: 201 });
}

// PATCH /api/pipeline-builder/[id]/groups — reorder all groups
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const pipelineId = Number(id);
  if (Number.isNaN(pipelineId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { orderedGroupIds } = await req.json();
  if (!Array.isArray(orderedGroupIds)) return NextResponse.json({ error: "orderedGroupIds required" }, { status: 400 });

  await reorderGroups(pipelineId, orderedGroupIds);
  return NextResponse.json({ ok: true });
}
