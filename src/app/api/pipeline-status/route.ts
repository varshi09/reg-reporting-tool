import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { getAllPipelinesRunState } from "@/lib/pipelineBuilder";
import { getPipelineHistoryStats } from "@/lib/pipelines";

export async function GET(request: Request) {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const timeKey = searchParams.get("timeKey") ?? "";
  if (!timeKey) return NextResponse.json({ error: "timeKey is required." }, { status: 400 });

  const pipelines = await getAllPipelinesRunState(timeKey);
  const historyStats = await getPipelineHistoryStats(pipelines.map((p) => p.pipelineId));

  return NextResponse.json({
    pipelines: pipelines.map((p) => ({
      ...p,
      ...(historyStats.get(p.pipelineId) ?? {
        sparkline: [],
        avgDurationMin: null,
        lastActivityAt: null,
      }),
    })),
  });
}
