import { NextResponse } from "next/server";
import { getUploadTable } from "@/lib/uploadTables";
import { parseUploadFile, runUploadValidations } from "@/lib/uploadParser";

/**
 * Pre-import preview. Parses the file exactly the way POST /api/upload will
 * (same shared parser) and reports what the load would do — without writing
 * anything to the database.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const timeKey = String(formData.get("timeKey") ?? "");
  const targetTable = String(formData.get("targetTable") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  if (!/^\d{8}$/.test(timeKey)) {
    return NextResponse.json(
      { error: "time_key must be a reporting date in YYYYMMDD format." },
      { status: 400 }
    );
  }

  const table = getUploadTable(targetTable);
  if (!table) {
    return NextResponse.json(
      { error: "Unknown data type. Choose a data type from the list." },
      { status: 400 }
    );
  }

  const parseResult = await parseUploadFile(file, table);
  if (!parseResult.ok) {
    return NextResponse.json({ error: parseResult.error }, { status: 400 });
  }

  const { rows, columnsMatched, columnsExpected } = parseResult.parsed;

  return NextResponse.json({
    fileName: file.name,
    targetTable: table.key,
    targetLabel: table.label,
    rowCount: rows.length,
    columnsMatched,
    columnsExpected,
    validations: runUploadValidations(rows, table),
  });
}
