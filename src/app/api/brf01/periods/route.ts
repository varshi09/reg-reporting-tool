import { NextResponse } from "next/server";
import { getBrf01Periods } from "@/lib/brf01Trend";

export async function GET() {
  const periods = await getBrf01Periods();
  return NextResponse.json({ periods });
}
