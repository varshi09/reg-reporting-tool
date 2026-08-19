import { NextResponse } from "next/server";
import { getCurrentUsername } from "@/lib/auth";
import { getCatalogProcedures } from "@/lib/pipelineBuilder";

// The procedure catalog is a live, read-only mirror of Oracle's own
// USER_PROCEDURES/USER_ARGUMENTS - see getCatalogProcedures. There is
// deliberately no POST here: nothing about the catalog can be created,
// renamed, or removed from the app side, only reflected from the DB.
export async function GET() {
  const username = await getCurrentUsername();
  if (!username) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const procedures = await getCatalogProcedures();
  return NextResponse.json({ procedures });
}
