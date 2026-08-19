import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { duplicatePipeline } from "@/lib/pipelineBuilder";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can create pipelines." }, { status: 403 });
  }

  const { id } = await params;
  const pipelineId = Number(id);
  if (!Number.isFinite(pipelineId)) {
    return NextResponse.json({ error: "Invalid pipeline id." }, { status: 400 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Enter a name for the new pipeline." }, { status: 400 });

  const result = await duplicatePipeline(pipelineId, name, username);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ id: result.id });
}
