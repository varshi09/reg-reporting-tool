import oracledb from "oracledb";
import { withConnection } from "@/lib/db";

export type Pipeline = {
  id: number;
  name: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  groupCount?: number;
  procCount?: number;
  isRunning?: boolean;
  needsAttention?: boolean;
};

type PipelineRow = {
  ID: number;
  NAME: string;
  IS_ACTIVE: number;
  CREATED_BY: string;
  CREATED_AT: string;
  GROUP_COUNT: number;
  PROC_COUNT: number;
};

export async function getActivePipelines(): Promise<Pipeline[]> {
  const rows: PipelineRow[] = await withConnection(async (connection) => {
    const result = await connection.execute<PipelineRow>(
      `SELECT p.id, p.name, p.is_active, p.created_by, p.created_at,
              COUNT(DISTINCT pg.id) AS group_count,
              COUNT(pp.id) AS proc_count
       FROM PIPELINES p
       LEFT JOIN PIPELINE_GROUPS pg ON pg.pipeline_id = p.id
       LEFT JOIN PIPELINE_PROCEDURES pp ON pp.pipeline_id = p.id AND pp.group_id IS NOT NULL
       WHERE p.is_active = 1
       GROUP BY p.id, p.name, p.is_active, p.created_by, p.created_at
       ORDER BY p.id`
    );
    return result.rows ?? [];
  });
  return rows.map((r) => ({
    id: r.ID,
    name: r.NAME,
    isActive: r.IS_ACTIVE === 1,
    createdBy: r.CREATED_BY,
    createdAt: r.CREATED_AT,
    groupCount: Number(r.GROUP_COUNT),
    procCount: Number(r.PROC_COUNT),
  }));
}

/** Adds isRunning / needsAttention flags for the current period, for the builder list's stat cards. */
export async function withCurrentRunFlags(pipelines: Pipeline[], timeKey: string): Promise<Pipeline[]> {
  type FlagRow = { PIPELINE_ID: number; STATUS: string };
  const rows: FlagRow[] = await withConnection(async (connection) => {
    const result = await connection.execute<FlagRow>(
      `SELECT pipeline_id, status FROM (
         SELECT pipeline_id, procedure_id, status,
                ROW_NUMBER() OVER (PARTITION BY pipeline_id, procedure_id ORDER BY updated_at DESC NULLS LAST) AS rn
         FROM PIPELINE_PROCEDURE_RUNS
         WHERE time_key = :timeKey
       ) WHERE rn = 1`,
      { timeKey }
    );
    return result.rows ?? [];
  });

  const byPipeline = new Map<number, string[]>();
  for (const r of rows) {
    const list = byPipeline.get(r.PIPELINE_ID) ?? [];
    list.push(r.STATUS);
    byPipeline.set(r.PIPELINE_ID, list);
  }

  return pipelines.map((p) => {
    const statuses = byPipeline.get(p.id) ?? [];
    return {
      ...p,
      isRunning: statuses.includes("IN_PROGRESS"),
      needsAttention: statuses.includes("FAILED") || statuses.includes("AWAITING_INPUT"),
    };
  });
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

/** Reversible: hides the pipeline from the builder list and status page. Groups, procedures, and run history are untouched. */
export async function archivePipeline(pipelineId: number): Promise<void> {
  await withConnection((connection) =>
    connection.execute(
      `UPDATE PIPELINES SET is_active = 0 WHERE id = :id`,
      { id: pipelineId },
      { autoCommit: true }
    )
  );
}

/** Irreversible: removes the pipeline and everything under it, including the PIPELINE_PROCEDURE_RUNS audit history. */
export async function deletePipelineHard(pipelineId: number): Promise<void> {
  await withConnection(async (connection) => {
    await connection.execute(
      `DELETE FROM PIPELINE_PROCEDURE_RUNS WHERE pipeline_id = :id`,
      { id: pipelineId },
      { autoCommit: false }
    );
    await connection.execute(
      `DELETE FROM PIPELINE_PROCEDURES WHERE pipeline_id = :id`,
      { id: pipelineId },
      { autoCommit: false }
    );
    await connection.execute(
      `DELETE FROM PIPELINE_GROUPS WHERE pipeline_id = :id`,
      { id: pipelineId },
      { autoCommit: false }
    );
    await connection.execute(
      `DELETE FROM PIPELINES WHERE id = :id`,
      { id: pipelineId },
      { autoCommit: true }
    );
  });
}
