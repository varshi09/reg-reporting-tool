import oracledb from "oracledb";
import { withConnection } from "@/lib/db";
import type { PipelineStatus } from "@/lib/pipelineStages";

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

// ─── Run-state ───────────────────────────────────────────────────────────────
// Rolls PIPELINE_PROCEDURE_RUNS up through the user-defined groups, so the
// status page's stage dots always reflect whatever groups the user actually
// built in the canvas - never a fixed/hardcoded stage list.

export type ProcRunState = {
  proc: GroupProcedure;
  status: PipelineStatus;
  isBlocked: boolean;
  blockedReason: string | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  overrideType: string | null;
  updatedBy: string | null;
};

export type GroupRunState = {
  group: { id: number; name: string; sortOrder: number; execMode: ExecMode };
  procedures: ProcRunState[];
  groupStatus: PipelineStatus;
};

export type PipelineRunState = {
  pipelineId: number;
  pipelineName: string;
  timeKey: string;
  groups: GroupRunState[];
  overallStatus: PipelineStatus;
  completedGroups: number;
  totalGroups: number;
  completedProcs: number;
  totalProcs: number;
};

function computeGroupStatus(statuses: PipelineStatus[]): PipelineStatus {
  if (statuses.length === 0) return "PENDING";
  if (statuses.some((s) => s === "FAILED")) return "FAILED";
  if (statuses.some((s) => s === "AWAITING_INPUT")) return "AWAITING_INPUT";
  if (statuses.some((s) => s === "IN_PROGRESS")) return "IN_PROGRESS";
  if (statuses.every((s) => s === "COMPLETED")) return "COMPLETED";
  return "PENDING";
}

export async function getPipelineRunState(
  pipelineId: number,
  timeKey: string
): Promise<PipelineRunState | null> {
  const structure = await getPipelineStructure(pipelineId);
  if (!structure) return null;

  type RunRow = {
    PROCEDURE_ID: number;
    STATUS: string;
    OVERRIDE_TYPE: string | null;
    START_TIME: string | null;
    END_TIME: string | null;
    NOTE: string | null;
    UPDATED_BY: string | null;
  };

  const runs = await withConnection(async (conn) => {
    const r = await conn.execute<RunRow>(
      `SELECT procedure_id, status, override_type, start_time, end_time, note, updated_by
       FROM (
         SELECT procedure_id, status, override_type, start_time, end_time, note, updated_by,
                ROW_NUMBER() OVER (PARTITION BY procedure_id ORDER BY updated_at DESC NULLS LAST) AS rn
         FROM PIPELINE_PROCEDURE_RUNS
         WHERE pipeline_id = :pipelineId AND time_key = :timeKey
       ) WHERE rn = 1`,
      { pipelineId, timeKey }
    );
    return r.rows ?? [];
  });
  const runMap = new Map(runs.map((r) => [r.PROCEDURE_ID, r]));

  const datasets = [
    ...new Set(
      structure.groups
        .flatMap((g) => g.procedures)
        .map((p) => p.dependsOnDataset)
        .filter((d): d is string => d !== null)
    ),
  ];

  const approvedSet =
    datasets.length > 0
      ? await withConnection(async (conn) => {
          const placeholders = datasets.map((_, i) => `:d${i}`).join(",");
          const binds: Record<string, unknown> = { timeKey };
          datasets.forEach((d, i) => { binds[`d${i}`] = d; });
          const r = await conn.execute<{ TARGET_TABLE: string }>(
            `SELECT DISTINCT target_table FROM UPLOAD_LOG
             WHERE target_table IN (${placeholders}) AND time_key = :timeKey AND status = 'APPROVED'`,
            binds
          );
          return new Set((r.rows ?? []).map((row) => row.TARGET_TABLE));
        })
      : new Set<string>();

  const groups: GroupRunState[] = structure.groups.map((group) => {
    const procedures: ProcRunState[] = group.procedures.map((proc) => {
      const run = runMap.get(proc.procedureId);
      let isBlocked = false;
      let blockedReason: string | null = null;

      if (proc.dependsOnDataset && !run?.OVERRIDE_TYPE) {
        if (!approvedSet.has(proc.dependsOnDataset)) {
          isBlocked = true;
          blockedReason = `Waiting on an approved upload for ${proc.dependsOnDataset}`;
        }
      }

      const status: PipelineStatus = isBlocked
        ? "AWAITING_INPUT"
        : ((run?.STATUS as PipelineStatus) ?? "PENDING");

      return {
        proc,
        status,
        isBlocked,
        blockedReason,
        startTime: run?.START_TIME ?? null,
        endTime: run?.END_TIME ?? null,
        note: run?.NOTE ?? null,
        overrideType: run?.OVERRIDE_TYPE ?? null,
        updatedBy: run?.UPDATED_BY ?? null,
      };
    });

    return {
      group: { id: group.id, name: group.name, sortOrder: group.sortOrder, execMode: group.execMode },
      procedures,
      groupStatus: computeGroupStatus(procedures.map((p) => p.status)),
    };
  });

  const completedGroups = groups.filter((g) => g.groupStatus === "COMPLETED").length;
  const allProcs = groups.flatMap((g) => g.procedures);

  return {
    pipelineId: structure.pipelineId,
    pipelineName: structure.pipelineName,
    timeKey,
    groups,
    overallStatus: computeGroupStatus(groups.map((g) => g.groupStatus)),
    completedGroups,
    totalGroups: groups.length,
    completedProcs: allProcs.filter((p) => p.status === "COMPLETED").length,
    totalProcs: allProcs.length,
  };
}

export async function getAllPipelinesRunState(timeKey: string): Promise<PipelineRunState[]> {
  type PipelineRow = { ID: number };
  const pipelines = await withConnection(async (conn) => {
    const r = await conn.execute<PipelineRow>(`SELECT id FROM PIPELINES WHERE is_active = 1 ORDER BY id`);
    return r.rows ?? [];
  });
  const states = await Promise.all(pipelines.map((p) => getPipelineRunState(p.ID, timeKey)));
  return states.filter((s): s is PipelineRunState => s !== null);
}

// ─── Execution ──────────────────────────────────────────────────────────────

async function runGroupProcedure(
  pipelineId: number,
  proc: GroupProcedure,
  timeKey: string,
  triggeredBy: string
): Promise<{ status: "COMPLETED" | "FAILED"; error?: string }> {
  const startedAt: Date = await withConnection(async (conn) => {
    const r = await conn.execute<{ ST: Date[] }>(
      `INSERT INTO PIPELINE_PROCEDURE_RUNS (pipeline_id, procedure_id, time_key, status, start_time, updated_by)
       VALUES (:pipelineId, :procedureId, :timeKey, 'IN_PROGRESS', LOCALTIMESTAMP, :updatedBy)
       RETURNING start_time INTO :st`,
      {
        pipelineId,
        procedureId: proc.procedureId,
        timeKey,
        updatedBy: triggeredBy,
        st: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_TIMESTAMP },
      },
      { autoCommit: true }
    );
    return (r.outBinds as { st: Date[] }).st[0];
  });

  const target = proc.packageName
    ? `${proc.packageName}.${proc.procedureName}`
    : proc.procedureName;
  const args: string[] = [];
  if (proc.takesDateParam) args.push("v_date");
  if (proc.takesScopeParam) args.push("'ALL'");
  const call = args.length ? `${target}(${args.join(", ")});` : `${target};`;
  const block = `DECLARE v_date VARCHAR2(20) := TO_CHAR(TO_DATE(:timeKey, 'YYYYMMDD'), 'DD-MON-YYYY'); BEGIN ${call} END;`;

  try {
    await withConnection((conn) => conn.execute(block, { timeKey }, { autoCommit: true }));
    await withConnection((conn) =>
      conn.execute(
        `INSERT INTO PIPELINE_PROCEDURE_RUNS (pipeline_id, procedure_id, time_key, status, start_time, end_time, updated_by)
         VALUES (:pipelineId, :procedureId, :timeKey, 'COMPLETED', :startedAt, LOCALTIMESTAMP, :updatedBy)`,
        { pipelineId, procedureId: proc.procedureId, timeKey, startedAt, updatedBy: triggeredBy },
        { autoCommit: true }
      )
    );
    return { status: "COMPLETED" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await withConnection((conn) =>
      conn.execute(
        `INSERT INTO PIPELINE_PROCEDURE_RUNS (pipeline_id, procedure_id, time_key, status, start_time, end_time, note, updated_by)
         VALUES (:pipelineId, :procedureId, :timeKey, 'FAILED', :startedAt, LOCALTIMESTAMP, :note, :updatedBy)`,
        {
          pipelineId, procedureId: proc.procedureId, timeKey,
          startedAt, note: message.slice(0, 1000), updatedBy: triggeredBy,
        },
        { autoCommit: true }
      )
    );
    return { status: "FAILED", error: message };
  }
}

export async function runNextInPipeline(
  pipelineId: number,
  timeKey: string,
  triggeredBy: string
): Promise<{ ran: string[]; blocked: string[]; failed: string[] }> {
  const state = await getPipelineRunState(pipelineId, timeKey);
  if (!state || state.groups.length === 0) return { ran: [], blocked: [], failed: [] };

  const targetGroup = state.groups.find((g) => g.groupStatus !== "COMPLETED");
  if (!targetGroup) return { ran: [], blocked: [], failed: [] };

  const ran: string[] = [];
  const blocked: string[] = [];
  const failed: string[] = [];

  const eligible = targetGroup.procedures.filter(
    (p) => p.status !== "COMPLETED" && p.status !== "IN_PROGRESS" && !p.isBlocked
  );
  targetGroup.procedures.filter((p) => p.isBlocked).forEach((p) => blocked.push(p.proc.procedureName));

  if (targetGroup.group.execMode === "PARALLEL") {
    const results = await Promise.all(
      eligible.map((p) => runGroupProcedure(pipelineId, p.proc, timeKey, triggeredBy))
    );
    eligible.forEach((p, i) => {
      if (results[i].status === "COMPLETED") ran.push(p.proc.procedureName);
      else failed.push(p.proc.procedureName);
    });
  } else {
    const next = eligible[0];
    if (next) {
      const result = await runGroupProcedure(pipelineId, next.proc, timeKey, triggeredBy);
      if (result.status === "COMPLETED") ran.push(next.proc.procedureName);
      else failed.push(next.proc.procedureName);
    }
  }

  return { ran, blocked, failed };
}

export async function runAllInPipeline(
  pipelineId: number,
  timeKey: string,
  triggeredBy: string
): Promise<{ ran: string[]; blocked: string[]; failed: string[] }> {
  const structure = await getPipelineStructure(pipelineId);
  if (!structure) return { ran: [], blocked: [], failed: [] };

  const allRan: string[] = [];
  const allBlocked: string[] = [];
  const allFailed: string[] = [];

  for (const group of structure.groups) {
    const freshState = await getPipelineRunState(pipelineId, timeKey);
    if (!freshState) break;

    const groupState = freshState.groups.find((g) => g.group.id === group.id);
    if (!groupState || groupState.groupStatus === "COMPLETED") continue;

    const eligible = groupState.procedures.filter(
      (p) => p.status !== "COMPLETED" && p.status !== "IN_PROGRESS" && !p.isBlocked
    );
    groupState.procedures.filter((p) => p.isBlocked).forEach((p) => allBlocked.push(p.proc.procedureName));

    if (group.execMode === "PARALLEL") {
      const results = await Promise.all(
        eligible.map((p) => runGroupProcedure(pipelineId, p.proc, timeKey, triggeredBy))
      );
      eligible.forEach((p, i) => {
        if (results[i].status === "COMPLETED") allRan.push(p.proc.procedureName);
        else allFailed.push(p.proc.procedureName);
      });
    } else {
      for (const p of eligible) {
        const result = await runGroupProcedure(pipelineId, p.proc, timeKey, triggeredBy);
        if (result.status === "COMPLETED") allRan.push(p.proc.procedureName);
        else { allFailed.push(p.proc.procedureName); break; }
      }
    }
  }

  return { ran: allRan, blocked: allBlocked, failed: allFailed };
}
