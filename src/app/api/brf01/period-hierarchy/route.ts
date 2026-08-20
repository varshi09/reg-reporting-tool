import { NextResponse } from "next/server";
import { getBrf01PeriodHierarchy } from "@/lib/brf01Trend";

export async function GET() {
  const periods = await getBrf01PeriodHierarchy();
  return NextResponse.json({ periods });
}
