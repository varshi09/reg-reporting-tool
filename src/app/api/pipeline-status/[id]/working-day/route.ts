import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { listWorkingDays, startNewWorkingDay } from "@/lib/pipelineBuilder";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const pipelineId = Number(id);
  if (!Number.isFinite(pipelineId)) {
    return NextResponse.json({ error: "Invalid pipeline id." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const timeKey = searchParams.get("timeKey") ?? "";
  if (!timeKey) return NextResponse.json({ error: "timeKey is required." }, { status: 400 });

  const info = await listWorkingDays(pipelineId, timeKey);
  return NextResponse.json(info);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can start a new working day." }, { status: 403 });
  }

  const { id } = await params;
  const pipelineId = Number(id);
  if (!Number.isFinite(pipelineId)) {
    return NextResponse.json({ error: "Invalid pipeline id." }, { status: 400 });
  }

  const body = await request.json();
  const timeKey = typeof body.timeKey === "string" ? body.timeKey.trim() : "";
  const workingDay = typeof body.workingDay === "string" ? body.workingDay.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!timeKey) return NextResponse.json({ error: "timeKey is required." }, { status: 400 });

  const result = await startNewWorkingDay(pipelineId, timeKey, workingDay, note, username);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
