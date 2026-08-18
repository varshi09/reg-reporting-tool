import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { getRunHistory } from "@/lib/procedures";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const pipelineId = Number(id);
  const timeKey = new URL(request.url).searchParams.get("timeKey");
  if (!timeKey) {
    return NextResponse.json({ error: "timeKey is required." }, { status: 400 });
  }

  const history = await getRunHistory(pipelineId, timeKey);
  return NextResponse.json({ history });
}
