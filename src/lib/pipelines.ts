import oracledb from "oracledb";
import { withConnection } from "@/lib/db";

export type Pipeline = {
  id: number;
  name: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
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
