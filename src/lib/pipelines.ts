import oracledb from "oracledb";
import { withConnection } from "@/lib/db";
import { PIPELINE_STAGES, type PipelineStatus } from "@/lib/pipelineStages";

export type Pipeline = {
  id: number;
  name: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
};

export type StageState = {
  stage: string;
  status: PipelineStatus;
  note: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type ActivityEntry = {
  id: number;
  stage: string;
  status: PipelineStatus;
  note: string | null;
  updatedBy: string;
  updatedAt: string;
};

type PipelineRow = {
  ID: number;
  NAME: string;
  IS_ACTIVE: number;
  CREATED_BY: string;
  CREATED_AT: string;
};

export async function getActivePipelines(): Promise<Pipeline[]> {
  const rows: PipelineRow[] = await withConnection(async (connection) => {
    const result = await connection.execute<PipelineRow>(
      `SELECT id, name, is_active, created_by, created_at
       FROM PIPELINES
       WHERE is_active = 1
       ORDER BY id`
    );
    return result.rows ?? [];
  });
  return rows.map((r) => ({
    id: r.ID,
    name: r.NAME,
    isActive: r.IS_ACTIVE === 1,
    createdBy: r.CREATED_BY,
    createdAt: r.CREATED_AT,
  }));
}

export async function createPipeline(name: string, createdBy: string): Promise<number> {
  return withConnection(async (connection) => {
    const result = await connection.execute<{ ID: number[] }>(
      `INSERT INTO PIPELINES (name, created_by) VALUES (:name, :createdBy) RETURNING id INTO :id`,
      {
        name,
        createdBy,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );
    return (result.outBinds as { id: number[] }).id[0];
  });
}

type LatestStageRow = {
  STAGE: string;
  STATUS: PipelineStatus;
  NOTE: string | null;
  UPDATED_BY: string;
  UPDATED_AT: string;
};

export async function getStageStates(pipelineId: number, timeKey: string): Promise<StageState[]> {
  const rows: LatestStageRow[] = await withConnection(async (connection) => {
    const result = await connection.execute<LatestStageRow>(
      `SELECT stage, status, note, updated_by, updated_at FROM (
         SELECT stage, status, note, updated_by, updated_at,
                ROW_NUMBER() OVER (PARTITION BY stage ORDER BY updated_at DESC) AS rn
         FROM PIPELINE_STAGE_LOG
         WHERE pipeline_id = :pipelineId AND time_key = :timeKey
       ) WHERE rn = 1`,
      { pipelineId, timeKey }
    );
    return result.rows ?? [];
  });

  const byStage = new Map(rows.map((r) => [r.STAGE, r]));
  return PIPELINE_STAGES.map(({ key }) => {
    const found = byStage.get(key);
    return {
      stage: key,
      status: found?.STATUS ?? "PENDING",
      note: found?.NOTE ?? null,
      updatedBy: found?.UPDATED_BY ?? null,
      updatedAt: found?.UPDATED_AT ?? null,
    };
  });
}

type ActivityRow = {
  ID: number;
  STAGE: string;
  STATUS: PipelineStatus;
  NOTE: string | null;
  UPDATED_BY: string;
  UPDATED_AT: string;
};

export async function getRecentActivity(
  pipelineId: number,
  timeKey: string,
  limit = 20
): Promise<ActivityEntry[]> {
  const rows: ActivityRow[] = await withConnection(async (connection) => {
    const result = await connection.execute<ActivityRow>(
      `SELECT id, stage, status, note, updated_by, updated_at
       FROM PIPELINE_STAGE_LOG
       WHERE pipeline_id = :pipelineId AND time_key = :timeKey
       ORDER BY updated_at DESC
       FETCH FIRST :limit ROWS ONLY`,
      { pipelineId, timeKey, limit }
    );
    return result.rows ?? [];
  });
  return rows.map((r) => ({
    id: r.ID,
    stage: r.STAGE,
    status: r.STATUS,
    note: r.NOTE,
    updatedBy: r.UPDATED_BY,
    updatedAt: r.UPDATED_AT,
  }));
}

export async function setStageStatus(
  pipelineId: number,
  timeKey: string,
  stage: string,
  status: PipelineStatus,
  note: string | null,
  updatedBy: string
): Promise<void> {
  await withConnection((connection) =>
    connection.execute(
      `INSERT INTO PIPELINE_STAGE_LOG (pipeline_id, time_key, stage, status, note, updated_by)
       VALUES (:pipelineId, :timeKey, :stage, :status, :note, :updatedBy)`,
      { pipelineId, timeKey, stage, status, note, updatedBy },
      { autoCommit: true }
    )
  );
}
