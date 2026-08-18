import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { getAllPipelinesRunState } from "@/lib/pipelineBuilder";

export async function GET(request: Request) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const timeKey = searchParams.get("timeKey") ?? "";
  if (!timeKey) return NextResponse.json({ error: "timeKey is required." }, { status: 400 });

  const pipelines = await getAllPipelinesRunState(timeKey);
  return NextResponse.json({ pipelines });
}
