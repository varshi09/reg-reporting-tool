import { NextResponse } from "next/server";
import { getBrf01Trend, type Brf01TrendSelection } from "@/lib/brf01Trend";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const entityGroups = params.getAll("entityGroup");
  const dataSources = params.getAll("dataSource");

  // Each selection is "timeKey:workingDay" - one string per pick, so
  // ordering never depends on interleaving two separate repeated params.
  const selections: Brf01TrendSelection[] = params
    .getAll("selection")
    .map((s) => {
      const [timeKey, workingDay] = s.split(":");
      return { timeKey, workingDay };
    })
    .filter((s) => s.timeKey && s.workingDay);

  if (selections.length === 0) {
    return NextResponse.json({ error: "Select at least one period/working day." }, { status: 400 });
  }

  const entries = await getBrf01Trend({ selections, entityGroups, dataSources });
  return NextResponse.json({ entries });
}
