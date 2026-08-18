import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { overrideProcedure, type OverrideType } from "@/lib/procedures";

const VALID_OVERRIDES: OverrideType[] = ["PROCEED_WITHOUT_UPLOAD", "USE_PREVIOUS_PERIOD"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can override a blocked procedure." }, { status: 403 });
  }

  const { id } = await params;
  const pipelineId = Number(id);
  const body = await request.json();
  const procedureId = Number(body.procedureId);
  const { timeKey, overrideType } = body;

  if (!procedureId) {
    return NextResponse.json({ error: "procedureId is required." }, { status: 400 });
  }
  if (typeof timeKey !== "string" || !timeKey) {
    return NextResponse.json({ error: "timeKey is required." }, { status: 400 });
  }
  if (!VALID_OVERRIDES.includes(overrideType)) {
    return NextResponse.json({ error: "Unknown override type." }, { status: 400 });
  }

  const result = await overrideProcedure(pipelineId, procedureId, timeKey, overrideType, username);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
