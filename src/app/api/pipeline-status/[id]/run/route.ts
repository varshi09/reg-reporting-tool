import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { runNextInPipeline, runAllInPipeline } from "@/lib/pipelineBuilder";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can run procedures." }, { status: 403 });
  }

  const { id } = await params;
  const pipelineId = Number(id);
  if (!Number.isFinite(pipelineId)) {
    return NextResponse.json({ error: "Invalid pipeline id." }, { status: 400 });
  }

  const body = await request.json();
  const mode = body.mode as "next" | "all";
  const timeKey = typeof body.timeKey === "string" ? body.timeKey.trim() : "";
  if (!timeKey) return NextResponse.json({ error: "timeKey is required." }, { status: 400 });
  if (mode !== "next" && mode !== "all") {
    return NextResponse.json({ error: "mode must be 'next' or 'all'." }, { status: 400 });
  }

  const result =
    mode === "next"
      ? await runNextInPipeline(pipelineId, timeKey, username)
      : await runAllInPipeline(pipelineId, timeKey, username);

  return NextResponse.json(result);
}
