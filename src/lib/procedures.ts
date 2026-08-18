import oracledb from "oracledb";
import { withConnection } from "@/lib/db";
import { PIPELINE_STAGES, type PipelineStageKey, type PipelineStatus } from "@/lib/pipelineStages";

export type ProcedureDef = {
  id: number;
  procedureName: string;
  packageName: string | null;
  stage: PipelineStageKey;
  dependsOnDataset: string | null;
};

export function fullProcedureName(p: { procedureName: string; packageName: string | null }): string {
  return p.packageName ? `${p.packageName}.${p.procedureName}` : p.procedureName;
}

export type OverrideType = "PROCEED_WITHOUT_UPLOAD" | "USE_PREVIOUS_PERIOD";

export type ProcedureState = {
  procedure: ProcedureDef;
  status: PipelineStatus;
  isBlocked: boolean;
  blockedReason: string | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  overrideType: OverrideType | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

/** 31 Jul 2026 -> 30 Jun 2026, i.e. the month-end before a given period. */
function previousTimeKey(timeKey: string): string {
  const year = Number(timeKey.slice(0, 4));
  const month = Number(timeKey.slice(4, 6)); // 1-based
  const firstOfThisMonth = new Date(year, month - 1, 1);
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${lastOfPrevMonth.getFullYear()}${pad2(lastOfPrevMonth.getMonth() + 1)}${pad2(lastOfPrevMonth.getDate())}`;
}

async function isDatasetApproved(dataset: string, timeKey: string): Promise<boolean> {
  return withConnection(async (connection) => {
    const result = await connection.execute<{ CNT: number }>(
      `SELECT COUNT(*) AS CNT FROM UPLOAD_LOG WHERE target_table = :dataset AND time_key = :timeKey AND status = 'APPROVED'`,
      { dataset, timeKey }
    );
    return (result.rows?.[0]?.CNT ?? 0) > 0;
  });
}

export async function getProceduresForPipeline(pipelineId: number): Promise<ProcedureDef[]> {
  type Row = {
    ID: number;
    PROCEDURE_NAME: string;
    PACKAGE_NAME: string | null;
    STAGE: string;
    DEPENDS_ON_DATASET: string | null;
  };
  const rows: Row[] = await withConnection(async (connection) => {
    const result = await connection.execute<Row>(
      `SELECT p.id, p.procedure_name, p.package_name, p.stage, p.depends_on_dataset
       FROM PROCEDURES p
       JOIN PIPELINE_PROCEDURES pp ON pp.procedure_id = p.id
       WHERE pp.pipeline_id = :pipelineId
       ORDER BY pp.sort_order, p.id`,
      { pipelineId }
    );
    return result.rows ?? [];
  });
  return rows.map((r) => ({
    id: r.ID,
    procedureName: r.PROCEDURE_NAME,
    packageName: r.PACKAGE_NAME,
    stage: r.STAGE as PipelineStageKey,
    dependsOnDataset: r.DEPENDS_ON_DATASET,
  }));
}

type RunRow = {
  STATUS: PipelineStatus;
  OVERRIDE_TYPE: OverrideType | null;
  START_TIME: string | null;
  END_TIME: string | null;
  NOTE: string | null;
  UPDATED_BY: string;
  UPDATED_AT: string;
};

async function getLatestRun(pipelineId: number, procedureId: number, timeKey: string): Promise<RunRow | null> {
  const rows: RunRow[] = await withConnection(async (connection) => {
    const result = await connection.execute<RunRow>(
      `SELECT status, override_type, start_time, end_time, note, updated_by, updated_at
       FROM PIPELINE_PROCEDURE_RUNS
       WHERE pipeline_id = :pipelineId AND procedure_id = :procedureId AND time_key = :timeKey
       ORDER BY updated_at DESC
       FETCH FIRST 1 ROWS ONLY`,
      { pipelineId, procedureId, timeKey }
    );
    return result.rows ?? [];
  });
  return rows[0] ?? null;
}

/** Computes each procedure's real, gated status - the source of truth the UI renders. */
export async function getProcedureStates(pipelineId: number, timeKey: string): Promise<ProcedureState[]> {
  const procedures = await getProceduresForPipeline(pipelineId);

  return Promise.all(
    procedures.map(async (procedure) => {
      const latestRun = await getLatestRun(pipelineId, procedure.id, timeKey);

      let isBlocked = false;
      let blockedReason: string | null = null;

      if (procedure.dependsOnDataset) {
        const hasOverride = latestRun?.OVERRIDE_TYPE ?? null;
        const approved = await isDatasetApproved(procedure.dependsOnDataset, timeKey);
        if (!approved && !hasOverride) {
          isBlocked = true;
          blockedReason = `Waiting on an approved upload for ${procedure.dependsOnDataset}`;
        }
      }

      const status: PipelineStatus = isBlocked ? "AWAITING_INPUT" : latestRun?.STATUS ?? "PENDING";

      return {
        procedure,
        status,
        isBlocked,
        blockedReason,
        startTime: latestRun?.START_TIME ?? null,
        endTime: latestRun?.END_TIME ?? null,
        note: latestRun?.NOTE ?? null,
        overrideType: latestRun?.OVERRIDE_TYPE ?? null,
        updatedBy: latestRun?.UPDATED_BY ?? null,
        updatedAt: latestRun?.UPDATED_AT ?? null,
      };
    })
  );
}

function worstStatus(statuses: PipelineStatus[]): PipelineStatus {
  if (statuses.length === 0) return "PENDING";
  if (statuses.some((s) => s === "FAILED")) return "FAILED";
  if (statuses.some((s) => s === "AWAITING_INPUT")) return "AWAITING_INPUT";
  if (statuses.some((s) => s === "IN_PROGRESS")) return "IN_PROGRESS";
  if (statuses.every((s) => s === "COMPLETED")) return "COMPLETED";
  return "PENDING";
}

/** Rolls procedure-level states up to one status per stage - stages no longer store status directly. */
export function rollUpStageStatuses(states: ProcedureState[]): Record<PipelineStageKey, PipelineStatus> {
  const result = {} as Record<PipelineStageKey, PipelineStatus>;
  for (const { key } of PIPELINE_STAGES) {
    const inStage = states.filter((s) => s.procedure.stage === key).map((s) => s.status);
    result[key] = worstStatus(inStage);
  }
  return result;
}

/** Rejects the update if the procedure is genuinely blocked - "should not proceed further" enforced here, not just in the UI. */
export async function setProcedureStatus(
  pipelineId: number,
  procedureId: number,
  timeKey: string,
  status: PipelineStatus,
  note: string | null,
  updatedBy: string
): Promise<{ error?: string }> {
  const procedures = await getProceduresForPipeline(pipelineId);
  const procedure = procedures.find((p) => p.id === procedureId);
  if (!procedure) return { error: "Unknown procedure for this pipeline." };

  if (procedure.dependsOnDataset && status !== "AWAITING_INPUT" && status !== "PENDING") {
    const latestRun = await getLatestRun(pipelineId, procedureId, timeKey);
    const hasOverride = latestRun?.OVERRIDE_TYPE ?? null;
    const approved = await isDatasetApproved(procedure.dependsOnDataset, timeKey);
    if (!approved && !hasOverride) {
      return {
        error: `This procedure depends on an approved upload for ${procedure.dependsOnDataset}, which hasn't happened yet for this period. Use an override action, or wait for the upload to be approved.`,
      };
    }
  }

  await withConnection((connection) =>
    connection.execute(
      `INSERT INTO PIPELINE_PROCEDURE_RUNS (pipeline_id, procedure_id, time_key, status, start_time, end_time, note, updated_by)
       VALUES (:pipelineId, :procedureId, :timeKey, :status,
               CASE WHEN :status1 = 'IN_PROGRESS' THEN SYSTIMESTAMP ELSE NULL END,
               CASE WHEN :status2 IN ('COMPLETED', 'FAILED') THEN SYSTIMESTAMP ELSE NULL END,
               :note, :updatedBy)`,
      { pipelineId, procedureId, timeKey, status, status1: status, status2: status, note, updatedBy },
      { autoCommit: true }
    )
  );
  return {};
}

export async function overrideProcedure(
  pipelineId: number,
  procedureId: number,
  timeKey: string,
  overrideType: OverrideType,
  updatedBy: string
): Promise<{ error?: string }> {
  const procedures = await getProceduresForPipeline(pipelineId);
  const procedure = procedures.find((p) => p.id === procedureId);
  if (!procedure) return { error: "Unknown procedure for this pipeline." };
  if (!procedure.dependsOnDataset) return { error: "This procedure has no file dependency to override." };

  let note: string;
  if (overrideType === "PROCEED_WITHOUT_UPLOAD") {
    note = `Proceeded without an approved upload for ${procedure.dependsOnDataset} (override by ${updatedBy}).`;
  } else {
    const prevPeriod = previousTimeKey(timeKey);
    const prevApproved = await isDatasetApproved(procedure.dependsOnDataset, prevPeriod);
    if (!prevApproved) {
      return { error: `No approved upload for ${procedure.dependsOnDataset} in the previous period either.` };
    }
    note = `Reused the approved ${procedure.dependsOnDataset} upload from the previous period (override by ${updatedBy}).`;
  }

  await withConnection((connection) =>
    connection.execute(
      `INSERT INTO PIPELINE_PROCEDURE_RUNS (pipeline_id, procedure_id, time_key, status, override_type, note, updated_by)
       VALUES (:pipelineId, :procedureId, :timeKey, 'IN_PROGRESS', :overrideType, :note, :updatedBy)`,
      { pipelineId, procedureId, timeKey, overrideType, note, updatedBy },
      { autoCommit: true }
    )
  );
  return {};
}

export type RunHistoryEntry = {
  id: number;
  procedureName: string;
  packageName: string | null;
  stage: PipelineStageKey;
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
  STAGE: string;
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
      `SELECT r.id, p.procedure_name, p.package_name, p.stage, p.depends_on_dataset,
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
    stage: r.STAGE as PipelineStageKey,
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

export async function createProcedure(
  procedureName: string,
  packageName: string | null,
  stage: PipelineStageKey,
  dependsOnDataset: string | null,
  createdBy: string
): Promise<number> {
  return withConnection(async (connection) => {
    const result = await connection.execute<{ ID: number[] }>(
      `INSERT INTO PROCEDURES (procedure_name, package_name, stage, depends_on_dataset, created_by)
       VALUES (:procedureName, :packageName, :stage, :dependsOnDataset, :createdBy) RETURNING id INTO :id`,
      {
        procedureName,
        packageName,
        stage,
        dependsOnDataset,
        createdBy,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );
    return (result.outBinds as { id: number[] }).id[0];
  });
}

export async function attachProcedureToPipeline(
  pipelineId: number,
  procedureId: number,
  sortOrder = 0
): Promise<void> {
  await withConnection((connection) =>
    connection.execute(
      `INSERT INTO PIPELINE_PROCEDURES (pipeline_id, procedure_id, sort_order) VALUES (:pipelineId, :procedureId, :sortOrder)`,
      { pipelineId, procedureId, sortOrder },
      { autoCommit: true }
    )
  );
}
