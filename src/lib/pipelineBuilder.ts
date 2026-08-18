import oracledb from "oracledb";
import { withConnection } from "@/lib/db";

export type ExecMode = "SEQUENTIAL" | "PARALLEL";

export type PipelineGroup = {
  id: number;
  pipelineId: number;
  name: string;
  sortOrder: number;
  execMode: ExecMode;
  createdBy: string | null;
  createdAt: string | null;
};

export type GroupProcedure = {
  pipelineProcedureId: number;
  procedureId: number;
  procedureName: string;
  packageName: string | null;
  takesDateParam: boolean;
  takesScopeParam: boolean;
  sortOrder: number;
  dependsOnDataset: string | null;
};

export type PipelineStructure = {
  pipelineId: number;
  pipelineName: string;
  isActive: boolean;
  groups: Array<PipelineGroup & { procedures: GroupProcedure[] }>;
};

export type CatalogProcedure = {
  id: number;
  procedureName: string;
  packageName: string | null;
  takesDateParam: boolean;
  takesScopeParam: boolean;
};

// ─── Read ──────────────────────────────────────────────────────────────────

export async function getPipelineStructure(pipelineId: number): Promise<PipelineStructure | null> {
  type PipelineRow = { ID: number; NAME: string; IS_ACTIVE: number };
  type GroupRow = {
    ID: number; PIPELINE_ID: number; NAME: string;
    SORT_ORDER: number; EXEC_MODE: string;
    CREATED_BY: string | null; CREATED_AT: string | null;
  };
  type ProcRow = {
    PIPELINE_PROCEDURE_ID: number; PROCEDURE_ID: number;
    PROCEDURE_NAME: string; PACKAGE_NAME: string | null;
    TAKES_DATE_PARAM: number; TAKES_SCOPE_PARAM: number;
    SORT_ORDER: number; DEPENDS_ON_DATASET: string | null;
    GROUP_ID: number;
  };

  return withConnection(async (connection) => {
    const pipeRes = await connection.execute<PipelineRow>(
      `SELECT id, name, is_active FROM PIPELINES WHERE id = :id`,
      { id: pipelineId }
    );
    const pipeline = pipeRes.rows?.[0];
    if (!pipeline) return null;

    const groupRes = await connection.execute<GroupRow>(
      `SELECT id, pipeline_id, name, sort_order, exec_mode, created_by, created_at
       FROM PIPELINE_GROUPS WHERE pipeline_id = :pipelineId ORDER BY sort_order, id`,
      { pipelineId }
    );
    const groupRows = groupRes.rows ?? [];

    const procRes = await connection.execute<ProcRow>(
      `SELECT pp.id AS pipeline_procedure_id, pp.procedure_id, p.procedure_name, p.package_name,
              p.takes_date_param, p.takes_scope_param, pp.sort_order,
              pp.depends_on_dataset, pp.group_id
       FROM PIPELINE_PROCEDURES pp
       JOIN PROCEDURES p ON p.id = pp.procedure_id
       WHERE pp.pipeline_id = :pipelineId AND pp.group_id IS NOT NULL
       ORDER BY pp.sort_order, pp.id`,
      { pipelineId }
    );
    const procRows = procRes.rows ?? [];

    const groups = groupRows.map((g) => ({
      id: g.ID,
      pipelineId: g.PIPELINE_ID,
      name: g.NAME,
      sortOrder: g.SORT_ORDER,
      execMode: g.EXEC_MODE as ExecMode,
      createdBy: g.CREATED_BY,
      createdAt: g.CREATED_AT,
      procedures: procRows
        .filter((p) => p.GROUP_ID === g.ID)
        .map((p) => ({
          pipelineProcedureId: p.PIPELINE_PROCEDURE_ID,
          procedureId: p.PROCEDURE_ID,
          procedureName: p.PROCEDURE_NAME,
          packageName: p.PACKAGE_NAME,
          takesDateParam: p.TAKES_DATE_PARAM === 1,
          takesScopeParam: p.TAKES_SCOPE_PARAM === 1,
          sortOrder: p.SORT_ORDER,
          dependsOnDataset: p.DEPENDS_ON_DATASET,
        })),
    }));

    return {
      pipelineId: pipeline.ID,
      pipelineName: pipeline.NAME,
      isActive: pipeline.IS_ACTIVE === 1,
      groups,
    };
  });
}

export async function getCatalogProcedures(): Promise<CatalogProcedure[]> {
  type Row = {
    ID: number; PROCEDURE_NAME: string; PACKAGE_NAME: string | null;
    TAKES_DATE_PARAM: number; TAKES_SCOPE_PARAM: number;
  };
  const rows: Row[] = await withConnection(async (connection) => {
    const result = await connection.execute<Row>(
      `SELECT id, procedure_name, package_name, takes_date_param, takes_scope_param
       FROM PROCEDURES ORDER BY package_name NULLS LAST, procedure_name`,
      []
    );
    return result.rows ?? [];
  });
  return rows.map((r) => ({
    id: r.ID,
    procedureName: r.PROCEDURE_NAME,
    packageName: r.PACKAGE_NAME,
    takesDateParam: r.TAKES_DATE_PARAM === 1,
    takesScopeParam: r.TAKES_SCOPE_PARAM === 1,
  }));
}

// ─── Groups ────────────────────────────────────────────────────────────────

export async function createGroup(
  pipelineId: number,
  name: string,
  sortOrder: number,
  execMode: ExecMode,
  createdBy: string
): Promise<number> {
  return withConnection(async (connection) => {
    const result = await connection.execute<{ ID: number[] }>(
      `INSERT INTO PIPELINE_GROUPS (pipeline_id, name, sort_order, exec_mode, created_by)
       VALUES (:pipelineId, :name, :sortOrder, :execMode, :createdBy) RETURNING id INTO :id`,
      {
        pipelineId, name, sortOrder, execMode, createdBy,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );
    return (result.outBinds as { id: number[] }).id[0];
  });
}

export async function updateGroup(
  groupId: number,
  pipelineId: number,
  fields: { name?: string; sortOrder?: number; execMode?: ExecMode }
): Promise<{ error?: string }> {
  const setClauses: string[] = [];
  const binds: Record<string, unknown> = { groupId, pipelineId };
  if (fields.name !== undefined) { setClauses.push("name = :name"); binds.name = fields.name; }
  if (fields.sortOrder !== undefined) { setClauses.push("sort_order = :sortOrder"); binds.sortOrder = fields.sortOrder; }
  if (fields.execMode !== undefined) { setClauses.push("exec_mode = :execMode"); binds.execMode = fields.execMode; }
  if (setClauses.length === 0) return {};
  await withConnection((connection) =>
    connection.execute(
      `UPDATE PIPELINE_GROUPS SET ${setClauses.join(", ")} WHERE id = :groupId AND pipeline_id = :pipelineId`,
      binds,
      { autoCommit: true }
    )
  );
  return {};
}

export async function deleteGroup(groupId: number, pipelineId: number): Promise<void> {
  await withConnection(async (connection) => {
    await connection.execute(
      `UPDATE PIPELINE_PROCEDURES SET group_id = NULL WHERE group_id = :groupId`,
      { groupId },
      { autoCommit: false }
    );
    await connection.execute(
      `DELETE FROM PIPELINE_GROUPS WHERE id = :groupId AND pipeline_id = :pipelineId`,
      { groupId, pipelineId },
      { autoCommit: true }
    );
  });
}

export async function reorderGroups(
  pipelineId: number,
  orderedGroupIds: number[]
): Promise<void> {
  await withConnection(async (connection) => {
    for (let i = 0; i < orderedGroupIds.length; i++) {
      await connection.execute(
        `UPDATE PIPELINE_GROUPS SET sort_order = :sortOrder WHERE id = :id AND pipeline_id = :pipelineId`,
        { sortOrder: i, id: orderedGroupIds[i], pipelineId },
        { autoCommit: false }
      );
    }
    await connection.commit();
  });
}

// ─── Procedures within groups ───────────────────────────────────────────────

export async function addProcedureToGroup(
  pipelineId: number,
  groupId: number,
  procedureId: number,
  sortOrder: number,
  dependsOnDataset: string | null
): Promise<number> {
  return withConnection(async (connection) => {
    const result = await connection.execute<{ ID: number[] }>(
      `INSERT INTO PIPELINE_PROCEDURES (pipeline_id, group_id, procedure_id, sort_order, depends_on_dataset)
       VALUES (:pipelineId, :groupId, :procedureId, :sortOrder, :dependsOnDataset) RETURNING id INTO :id`,
      {
        pipelineId, groupId, procedureId, sortOrder,
        dependsOnDataset: dependsOnDataset ?? null,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );
    return (result.outBinds as { id: number[] }).id[0];
  });
}

export async function updateProcedureInGroup(
  pipelineProcedureId: number,
  pipelineId: number,
  fields: { sortOrder?: number; dependsOnDataset?: string | null; groupId?: number }
): Promise<void> {
  const setClauses: string[] = [];
  const binds: Record<string, unknown> = { ppId: pipelineProcedureId, pipelineId };
  if (fields.sortOrder !== undefined) { setClauses.push("sort_order = :sortOrder"); binds.sortOrder = fields.sortOrder; }
  if (fields.groupId !== undefined) { setClauses.push("group_id = :groupId"); binds.groupId = fields.groupId; }
  if (Object.prototype.hasOwnProperty.call(fields, "dependsOnDataset")) {
    setClauses.push("depends_on_dataset = :dep");
    binds.dep = fields.dependsOnDataset ?? null;
  }
  if (setClauses.length === 0) return;
  await withConnection((connection) =>
    connection.execute(
      `UPDATE PIPELINE_PROCEDURES SET ${setClauses.join(", ")} WHERE id = :ppId AND pipeline_id = :pipelineId`,
      binds,
      { autoCommit: true }
    )
  );
}

export async function removeProcedureFromGroup(
  pipelineProcedureId: number,
  pipelineId: number
): Promise<void> {
  await withConnection((connection) =>
    connection.execute(
      `DELETE FROM PIPELINE_PROCEDURES WHERE id = :ppId AND pipeline_id = :pipelineId`,
      { ppId: pipelineProcedureId, pipelineId },
      { autoCommit: true }
    )
  );
}

export async function reorderProceduresInGroup(
  pipelineId: number,
  groupId: number,
  orderedPpIds: number[]
): Promise<void> {
  await withConnection(async (connection) => {
    for (let i = 0; i < orderedPpIds.length; i++) {
      await connection.execute(
        `UPDATE PIPELINE_PROCEDURES SET sort_order = :sortOrder, group_id = :groupId
         WHERE id = :ppId AND pipeline_id = :pipelineId`,
        { sortOrder: i, groupId, ppId: orderedPpIds[i], pipelineId },
        { autoCommit: false }
      );
    }
    await connection.commit();
  });
}
