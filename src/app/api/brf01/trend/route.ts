import { NextResponse } from "next/server";
import { getBrf01Trend } from "@/lib/brf01Trend";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const currentTimeKey = params.get("currentTimeKey") ?? "";
  const previousTimeKey = params.get("previousTimeKey") ?? "";
  const entityGroups = params.getAll("entityGroup");
  const dataSources = params.getAll("dataSource");

  if (!currentTimeKey || !previousTimeKey) {
    return NextResponse.json({ error: "currentTimeKey and previousTimeKey are required." }, { status: 400 });
  }

  const entries = await getBrf01Trend({ currentTimeKey, previousTimeKey, entityGroups, dataSources });
  return NextResponse.json({ entries });
}
