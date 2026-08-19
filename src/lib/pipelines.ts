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

/** Returns every pipeline, active or inactive - the builder list shows both, badging inactive ones distinctly rather than hiding them. */
export async function getAllPipelines(): Promise<Pipeline[]> {
  const rows: PipelineRow[] = await withConnection(async (connection) => {
    const result = await connection.execute<PipelineRow>(
      `SELECT p.id, p.name, p.is_active, p.created_by, p.created_at,
              COUNT(DISTINCT pg.id) AS group_count,
              COUNT(pp.id) AS proc_count
       FROM PIPELINES p
       LEFT JOIN PIPELINE_GROUPS pg ON pg.pipeline_id = p.id
       LEFT JOIN PIPELINE_PROCEDURES pp ON pp.pipeline_id = p.id AND pp.group_id IS NOT NULL
       GROUP BY p.id, p.name, p.is_active, p.created_by, p.created_at
       ORDER BY p.is_active DESC, p.id`
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

export type PipelineHistoryStats = {
  sparkline: number[]; // chronological (oldest -> newest) 1 = completed, 0 = failed
  avgDurationMin: number | null;
  lastActivityAt: string | null;
};

/**
 * All-time run history stats per pipeline (not scoped to the current
 * period, unlike withCurrentRunFlags) - the list page's trend sparkline
 * and "last run" timestamp need real history to be meaningful, and the
 * current period alone is often empty early in a cycle.
 */
export async function getPipelineHistoryStats(
  pipelineIds: number[]
): Promise<Map<number, PipelineHistoryStats>> {
  const result = new Map<number, PipelineHistoryStats>();
  if (pipelineIds.length === 0) return result;

  type Row = {
    PIPELINE_ID: number;
    STATUS: string;
    START_TIME: string | null;
    END_TIME: string | null;
    UPDATED_AT: string;
  };

  const binds: Record<string, unknown> = {};
  const placeholders = pipelineIds.map((id, i) => {
    const name = `p${i}`;
    binds[name] = id;
    return `:${name}`;
  });

  const rows: Row[] = await withConnection(async (connection) => {
    const r = await connection.execute<Row>(
      `SELECT pipeline_id, status, start_time, end_time, updated_at
       FROM (
         SELECT pipeline_id, status, start_time, end_time, updated_at,
                ROW_NUMBER() OVER (PARTITION BY pipeline_id ORDER BY updated_at DESC NULLS LAST) AS rn
         FROM PIPELINE_PROCEDURE_RUNS
         WHERE pipeline_id IN (${placeholders.join(",")})
       ) WHERE rn <= 30
       ORDER BY pipeline_id, updated_at DESC`,
      binds
    );
    return r.rows ?? [];
  });

  const byPipeline = new Map<number, Row[]>();
  for (const r of rows) {
    const list = byPipeline.get(r.PIPELINE_ID) ?? [];
    list.push(r);
    byPipeline.set(r.PIPELINE_ID, list);
  }

  for (const id of pipelineIds) {
    const pipelineRows = byPipeline.get(id) ?? [];
    if (pipelineRows.length === 0) {
      result.set(id, { sparkline: [], avgDurationMin: null, lastActivityAt: null });
      continue;
    }

    const decided = pipelineRows.filter((r) => r.STATUS === "COMPLETED" || r.STATUS === "FAILED");
    const completed = decided.filter((r) => r.STATUS === "COMPLETED");

    // Rows are DESC (newest first); sparkline reads left-to-right as
    // oldest-to-newest, so reverse the last 8 decided runs.
    const sparkline = decided
      .slice(0, 8)
      .reverse()
      .map((r) => (r.STATUS === "COMPLETED" ? 1 : 0));

    const durations = completed
      .filter((r) => r.START_TIME && r.END_TIME)
      .map((r) => (new Date(r.END_TIME!).getTime() - new Date(r.START_TIME!).getTime()) / 60000);
    const avgDurationMin = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

    result.set(id, {
      sparkline,
      avgDurationMin,
      lastActivityAt: pipelineRows[0].UPDATED_AT,
    });
  }

  return result;
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

export async function renamePipeline(pipelineId: number, name: string): Promise<void> {
  await withConnection((connection) =>
    connection.execute(
      `UPDATE PIPELINES SET name = :name WHERE id = :id`,
      { name, id: pipelineId },
      { autoCommit: true }
    )
  );
}

export async function reactivatePipeline(pipelineId: number): Promise<void> {
  await withConnection((connection) =>
    connection.execute(
      `UPDATE PIPELINES SET is_active = 1 WHERE id = :id`,
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
