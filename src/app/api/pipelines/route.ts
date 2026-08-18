import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getActivePipelines, createPipeline, withCurrentRunFlags } from "@/lib/pipelines";

export async function GET(request: Request) {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeKey = searchParams.get("timeKey");

  let pipelines = await getActivePipelines();
  if (timeKey) {
    pipelines = await withCurrentRunFlags(pipelines, timeKey);
  }
  return NextResponse.json({ pipelines });
}

export async function POST(request: Request) {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await isAdmin(username))) {
    return NextResponse.json({ error: "Only admins can create pipelines." }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Enter a pipeline name." }, { status: 400 });
  }

  try {
    const id = await createPipeline(name, username);
    return NextResponse.json({ id });
  } catch (err) {
    if (err instanceof Error && err.message.includes("ORA-00001")) {
      return NextResponse.json({ error: "A pipeline with that name already exists." }, { status: 400 });
    }
    throw err;
  }
}
