import { NextResponse } from "next/server";
import { getBrf01Detail } from "@/lib/brf01Detail";
import { getBrf01WorkingDays } from "@/lib/brf01Trend";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const timeKey = params.get("timeKey") ?? "";
  const entityGroups = params.getAll("entityGroup");
  const dataSources = params.getAll("dataSource");
  const lineNo = params.get("lineNo") ?? "";
  const resident = params.get("resident");
  const currency = params.get("currency");

  if (!lineNo) return NextResponse.json({ error: "lineNo is required." }, { status: 400 });
  if (resident !== "RES" && resident !== "NONRES") {
    return NextResponse.json({ error: "resident must be 'RES' or 'NONRES'." }, { status: 400 });
  }
  if (currency !== "AED" && currency !== "FCY") {
    return NextResponse.json({ error: "currency must be 'AED' or 'FCY'." }, { status: 400 });
  }

  const workingDay = params.get("workingDay") || (timeKey ? (await getBrf01WorkingDays(timeKey)).current : "WD1");

  const rows = await getBrf01Detail({ timeKey, workingDay, entityGroups, dataSources, lineNo, resident, currency });
  return NextResponse.json({ rows });
}
