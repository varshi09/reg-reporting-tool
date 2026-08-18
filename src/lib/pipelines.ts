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
