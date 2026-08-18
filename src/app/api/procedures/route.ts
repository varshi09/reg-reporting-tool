import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { createProcedure } from "@/lib/procedures";
import { getCatalogProcedures } from "@/lib/pipelineBuilder";
import { PIPELINE_STAGES, type PipelineStageKey } from "@/lib/pipelineStages";

export async function GET() {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const procedures = await getCatalogProcedures();
  return NextResponse.json(procedures);
}

export async function POST(request: Request) {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can create procedures." }, { status: 403 });
  }

  const body = await request.json();
  const procedureName = typeof body.procedureName === "string" ? body.procedureName.trim() : "";
  const packageName =
    typeof body.packageName === "string" && body.packageName.trim() ? body.packageName.trim() : null;
  const stage = body.stage as PipelineStageKey;
  const dependsOnDataset =
    typeof body.dependsOnDataset === "string" && body.dependsOnDataset.trim() ? body.dependsOnDataset.trim() : null;

  if (!procedureName) {
    return NextResponse.json({ error: "Enter a procedure name." }, { status: 400 });
  }
  if (!PIPELINE_STAGES.some((s) => s.key === stage)) {
    return NextResponse.json({ error: "Unknown stage." }, { status: 400 });
  }

  const id = await createProcedure(procedureName, packageName, stage, dependsOnDataset, username);
  return NextResponse.json({ id });
}
