import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getStageStates, getRecentActivity, setStageStatus } from "@/lib/pipelines";
import { PIPELINE_STAGES, PIPELINE_STATUSES } from "@/lib/pipelineStages";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const pipelineId = Number(id);
  const timeKey = new URL(request.url).searchParams.get("timeKey");
  if (!timeKey) {
    return NextResponse.json({ error: "timeKey is required." }, { status: 400 });
  }

  const [stages, activity] = await Promise.all([
    getStageStates(pipelineId, timeKey),
    getRecentActivity(pipelineId, timeKey),
  ]);
  return NextResponse.json({ stages, activity });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can update pipeline status." }, { status: 403 });
  }

  const { id } = await params;
  const pipelineId = Number(id);
  const body = await request.json();
  const { timeKey, stage, status } = body;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  if (typeof timeKey !== "string" || !timeKey) {
    return NextResponse.json({ error: "timeKey is required." }, { status: 400 });
  }
  if (!PIPELINE_STAGES.some((s) => s.key === stage)) {
    return NextResponse.json({ error: "Unknown stage." }, { status: 400 });
  }
  if (!PIPELINE_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }

  await setStageStatus(pipelineId, timeKey, stage, status, note, username);
  return NextResponse.json({ success: true });
}
