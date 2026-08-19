import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { archivePipeline, deletePipelineHard, reactivatePipeline, renamePipeline } from "@/lib/pipelines";

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

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");

  if (mode === "reactivate") {
    await reactivatePipeline(pipelineId);
    return NextResponse.json({ ok: true });
  }

  if (mode === "rename") {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Enter a pipeline name." }, { status: 400 });
    try {
      await renamePipeline(pipelineId, name);
    } catch (err) {
      if (err instanceof Error && err.message.includes("ORA-00001")) {
        return NextResponse.json({ error: "A pipeline with that name already exists." }, { status: 400 });
      }
      throw err;
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "mode must be 'reactivate' or 'rename'." }, { status: 400 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can delete pipelines." }, { status: 403 });
  }

  const { id } = await params;
  const pipelineId = Number(id);
  if (!Number.isFinite(pipelineId)) {
    return NextResponse.json({ error: "Invalid pipeline id." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  if (mode !== "archive" && mode !== "delete") {
    return NextResponse.json({ error: "mode must be 'archive' or 'delete'." }, { status: 400 });
  }

  if (mode === "archive") {
    await archivePipeline(pipelineId);
  } else {
    await deletePipelineHard(pipelineId);
  }
  return NextResponse.json({ ok: true });
}
