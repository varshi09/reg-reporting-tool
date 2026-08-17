import { NextResponse } from "next/server";
import { withConnection } from "@/lib/db";
import { getCurrentUsername } from "@/lib/auth";
import { isAdmin, getCheckerDatasets } from "@/lib/roles";

type FileRow = {
  TARGET_TABLE: string;
  FILE_NAME: string;
  UPLOADED_BY: string;
  FILE_CONTENT: Buffer | null;
};

function contentTypeFor(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".csv")) return "text/csv";
  return "application/octet-stream";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const username = await getCurrentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const row = await withConnection(async (connection) => {
    const result = await connection.execute<FileRow>(
      `SELECT target_table, file_name, uploaded_by, file_content
       FROM UPLOAD_LOG WHERE id = :id`,
      { id }
    );
    return result.rows?.[0] ?? null;
  });

  if (!row) {
    return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  }

  // The maker who uploaded it, an assigned Checker for that dataset, or an
  // Admin can retrieve it — the same set of people already able to see this
  // upload's existence elsewhere in the app.
  const isUploader = username === row.UPLOADED_BY;
  const admin = await isAdmin(username);
  const isChecker = admin
    ? true
    : (await getCheckerDatasets(username, [row.TARGET_TABLE])).includes(row.TARGET_TABLE);

  if (!isUploader && !isChecker) {
    return NextResponse.json(
      { error: "You don't have access to this file." },
      { status: 403 }
    );
  }

  if (!row.FILE_CONTENT) {
    return NextResponse.json(
      { error: "The original file wasn't kept for this upload." },
      { status: 404 }
    );
  }

  return new NextResponse(new Uint8Array(row.FILE_CONTENT), {
    headers: {
      "Content-Type": contentTypeFor(row.FILE_NAME),
      "Content-Disposition": `attachment; filename="${row.FILE_NAME.replace(/"/g, "")}"`,
    },
  });
}
