import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { overrideBlockedProcedure } from "@/lib/pipelineBuilder";

export async function POST(
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

  const body = await request.json();
  const procedureId = Number(body.procedureId);
  const timeKey = typeof body.timeKey === "string" ? body.timeKey.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!Number.isFinite(procedureId)) {
    return NextResponse.json({ error: "procedureId is required." }, { status: 400 });
  }
  if (!timeKey) return NextResponse.json({ error: "timeKey is required." }, { status: 400 });
  if (!note) {
    return NextResponse.json({ error: "A reason is required to proceed without the upload." }, { status: 400 });
  }

  const result = await overrideBlockedProcedure(pipelineId, procedureId, timeKey, note, username);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
