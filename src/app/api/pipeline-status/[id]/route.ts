import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { getPipelineRunState } from "@/lib/pipelineBuilder";
import { getPipelineHistoryStats } from "@/lib/pipelines";

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

  const { searchParams } = new URL(request.url);
  const timeKey = searchParams.get("timeKey") ?? "";
  if (!timeKey) return NextResponse.json({ error: "timeKey is required." }, { status: 400 });
  const workingDay = searchParams.get("workingDay") ?? undefined;

  const state = await getPipelineRunState(pipelineId, timeKey, workingDay);
  if (!state) return NextResponse.json({ error: "Pipeline not found." }, { status: 404 });

  const historyStats = (await getPipelineHistoryStats([pipelineId])).get(pipelineId) ?? {
    sparkline: [],
    avgDurationMin: null,
    lastActivityAt: null,
  };

  return NextResponse.json({ ...state, ...historyStats });
}
