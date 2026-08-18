import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { runProcedure } from "@/lib/procedures";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can run a procedure." }, { status: 403 });
  }

  const { id } = await params;
  const pipelineId = Number(id);
  const body = await request.json();
  const procedureId = Number(body.procedureId);
  const { timeKey } = body;

  if (!procedureId) {
    return NextResponse.json({ error: "procedureId is required." }, { status: 400 });
  }
  if (typeof timeKey !== "string" || !timeKey) {
    return NextResponse.json({ error: "timeKey is required." }, { status: 400 });
  }

  const result = await runProcedure(pipelineId, procedureId, timeKey, username);
  if (result.error && result.status !== "FAILED") {
    // Blocked before we even attempted to run it (dependency not met).
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  // A genuine FAILED execution is still a successful API call - the caller
  // wants to see the real Oracle error, not have it swallowed into a 500.
  return NextResponse.json({ status: result.status, error: result.error });
}
