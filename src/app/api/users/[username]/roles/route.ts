import { NextResponse } from "next/server";
import { UPLOAD_TABLES } from "@/lib/uploadTables";
import { getRolesForUser, setDatasetRole, type DatasetRole } from "@/lib/roles";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const roles = await getRolesForUser(username);
  return NextResponse.json({ roles });
}

/**
 * Replaces the full set of dataset-role assignments for one user in a
 * single call, so the edit page can save every dataset's dropdown at once
 * rather than firing one request per row.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const body = await request.json();
  const roles = body.roles;

  if (typeof roles !== "object" || roles === null) {
    return NextResponse.json({ error: "Invalid roles payload." }, { status: 400 });
  }

  const validKeys = new Set(UPLOAD_TABLES.map((t) => t.key));

  for (const [datasetKey, role] of Object.entries(roles)) {
    if (!validKeys.has(datasetKey)) {
      return NextResponse.json(
        { error: `Unknown dataset: ${datasetKey}` },
        { status: 400 }
      );
    }
    if (role !== null && role !== "MAKER" && role !== "CHECKER") {
      return NextResponse.json(
        { error: `Invalid role for ${datasetKey}.` },
        { status: 400 }
      );
    }
    await setDatasetRole(username, datasetKey, role as DatasetRole | null);
  }

  return NextResponse.json({ success: true });
}
