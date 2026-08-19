import { withConnection } from "@/lib/db";
import type { PipelineStatus } from "@/lib/pipelineStages";

export type OverrideType = "PROCEED_WITHOUT_UPLOAD" | "USE_PREVIOUS_PERIOD";

export type RunHistoryEntry = {
  id: number;
  procedureName: string;
  packageName: string | null;
  dependsOnDataset: string | null;
  status: PipelineStatus;
  overrideType: OverrideType | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  updatedBy: string;
  updatedAt: string;
};

type HistoryRow = {
  ID: number;
  PROCEDURE_NAME: string;
  PACKAGE_NAME: string | null;
  DEPENDS_ON_DATASET: string | null;
  STATUS: PipelineStatus;
  OVERRIDE_TYPE: OverrideType | null;
  START_TIME: string | null;
  END_TIME: string | null;
  NOTE: string | null;
  UPDATED_BY: string;
  UPDATED_AT: string;
};

/** Full, ungrouped run history for this pipeline+period - the tabular "View log" data. */
export async function getRunHistory(pipelineId: number, timeKey: string, limit = 200): Promise<RunHistoryEntry[]> {
  const rows: HistoryRow[] = await withConnection(async (connection) => {
    const result = await connection.execute<HistoryRow>(
      `SELECT r.id, p.procedure_name, p.package_name, p.depends_on_dataset,
              r.status, r.override_type, r.start_time, r.end_time, r.note, r.updated_by, r.updated_at
       FROM PIPELINE_PROCEDURE_RUNS r
       JOIN PROCEDURES p ON p.id = r.procedure_id
       WHERE r.pipeline_id = :pipelineId AND r.time_key = :timeKey
       ORDER BY r.updated_at DESC
       FETCH FIRST :limit ROWS ONLY`,
      { pipelineId, timeKey, limit }
    );
    return result.rows ?? [];
  });
  return rows.map((r) => ({
    id: r.ID,
    procedureName: r.PROCEDURE_NAME,
    packageName: r.PACKAGE_NAME,
    dependsOnDataset: r.DEPENDS_ON_DATASET,
    status: r.STATUS,
    overrideType: r.OVERRIDE_TYPE,
    startTime: r.START_TIME,
    endTime: r.END_TIME,
    note: r.NOTE,
    updatedBy: r.UPDATED_BY,
    updatedAt: r.UPDATED_AT,
  }));
}
