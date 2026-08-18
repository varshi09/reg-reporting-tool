import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { archivePipeline, deletePipelineHard } from "@/lib/pipelines";

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
