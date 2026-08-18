import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { setProcedureStatus } from "@/lib/procedures";
import { PIPELINE_STATUSES } from "@/lib/pipelineStages";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can update procedure status." }, { status: 403 });
  }

  const { id } = await params;
  const pipelineId = Number(id);
  const body = await request.json();
  const { timeKey, status } = body;
  const procedureId = Number(body.procedureId);
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  if (!procedureId) {
    return NextResponse.json({ error: "procedureId is required." }, { status: 400 });
  }
  if (typeof timeKey !== "string" || !timeKey) {
    return NextResponse.json({ error: "timeKey is required." }, { status: 400 });
  }
  if (!PIPELINE_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }

  const result = await setProcedureStatus(pipelineId, procedureId, timeKey, status, note, username);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
