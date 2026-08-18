import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getProcedureStates, rollUpStageStatuses, attachProcedureToPipeline } from "@/lib/procedures";

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

  const states = await getProcedureStates(pipelineId, timeKey);
  const stageStatuses = rollUpStageStatuses(states);
  return NextResponse.json({ states, stageStatuses });
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
    return NextResponse.json({ error: "Only admins can attach procedures to a pipeline." }, { status: 403 });
  }

  const { id } = await params;
  const pipelineId = Number(id);
  const body = await request.json();
  const procedureId = Number(body.procedureId);
  const sortOrder = Number(body.sortOrder ?? 0);
  if (!procedureId) {
    return NextResponse.json({ error: "procedureId is required." }, { status: 400 });
  }

  try {
    await attachProcedureToPipeline(pipelineId, procedureId, sortOrder);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes("ORA-00001")) {
      return NextResponse.json({ error: "That procedure is already attached to this pipeline." }, { status: 400 });
    }
    throw err;
  }
}
