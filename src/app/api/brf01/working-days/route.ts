import { NextResponse } from "next/server";
import { getBrf01WorkingDays } from "@/lib/brf01Trend";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const timeKey = params.get("timeKey") ?? "";
  if (!timeKey) return NextResponse.json({ error: "timeKey is required." }, { status: 400 });

  const info = await getBrf01WorkingDays(timeKey);
  return NextResponse.json(info);
}
