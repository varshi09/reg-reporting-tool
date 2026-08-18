import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { createProcedure } from "@/lib/procedures";
import { PIPELINE_STAGES, type PipelineStageKey } from "@/lib/pipelineStages";

export async function POST(request: Request) {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can create procedures." }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const stage = body.stage as PipelineStageKey;
  const dependsOnDataset =
    typeof body.dependsOnDataset === "string" && body.dependsOnDataset.trim() ? body.dependsOnDataset.trim() : null;

  if (!name) {
    return NextResponse.json({ error: "Enter a procedure name." }, { status: 400 });
  }
  if (!PIPELINE_STAGES.some((s) => s.key === stage)) {
    return NextResponse.json({ error: "Unknown stage." }, { status: 400 });
  }

  const id = await createProcedure(name, stage, dependsOnDataset, username);
  return NextResponse.json({ id });
}
