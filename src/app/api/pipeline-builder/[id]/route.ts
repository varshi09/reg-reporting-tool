import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { getPipelineStructure } from "@/lib/pipelineBuilder";

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

  const structure = await getPipelineStructure(pipelineId);
  if (!structure) return NextResponse.json({ error: "Pipeline not found." }, { status: 404 });
  return NextResponse.json(structure);
}
