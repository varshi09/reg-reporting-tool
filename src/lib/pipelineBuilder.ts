import oracledb from "oracledb";
import { withConnection } from "@/lib/db";
import { createPipeline } from "@/lib/pipelines";
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
  createdBy: string;
  createdAt: string;
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
  type PipelineRow = { ID: number; NAME: string; IS_ACTIVE: number; CREATED_BY: string; CREATED_AT: string };
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
      `SELECT id, name, is_active, created_by, created_at FROM PIPELINES WHERE id = :id`,
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
      createdBy: pipeline.CREATED_BY,
      createdAt: pipeline.CREATED_AT,
      groups,
    };
  });
}

/**
 * Copies a pipeline's groups and procedures (names, exec mode, sort order,
 * dataset dependencies) into a brand-new pipeline, so it starts
 * pre-configured and can be edited from there rather than built from
 * scratch. Run history stays with the source - the new pipeline starts
 * with a clean PIPELINE_PROCEDURE_RUNS slate.
 */
export async function duplicatePipeline(
  sourcePipelineId: number,
  newName: string,
  createdBy: string
): Promise<{ id: number } | { error: string }> {
  const source = await getPipelineStructure(sourcePipelineId);
  if (!source) return { error: "Source pipeline not found." };

  let newPipelineId: number;
  try {
    newPipelineId = await createPipeline(newName, createdBy);
  } catch (err) {
    if (err instanceof Error && err.message.includes("ORA-00001")) {
      return { error: "A pipeline with that name already exists." };
    }
    throw err;
  }

  for (const group of source.groups) {
    const newGroupId = await createGroup(newPipelineId, group.name, group.sortOrder, group.execMode, createdBy);
    for (const proc of group.procedures) {
      await addProcedureToGroup(newPipelineId, newGroupId, proc.procedureId, proc.sortOrder, proc.dependsOnDataset);
    }
  }

  return { id: newPipelineId };
}

/**
 * The catalog is a live mirror of Oracle's own data dictionary - never
 * user-editable. Every call re-reads USER_PROCEDURES/USER_ARGUMENTS for
 * every packaged procedure that actually exists right now, upserts that
 * into PROCEDURES (which only exists to give PIPELINE_PROCEDURES a stable
 * numeric FK target), and returns exactly that live set. Add or drop a
 * package/procedure in the DB and the catalog reflects it on the very next
 * read - nothing here can be added, renamed, or removed from the app side.
 */
export async function getCatalogProcedures(): Promise<CatalogProcedure[]> {
  type LiveRow = {
    PACKAGE_NAME: string;
    PROCEDURE_NAME: string;
    TAKES_DATE_PARAM: number;
    TAKES_SCOPE_PARAM: number;
  };

  const live: LiveRow[] = await withConnection(async (connection) => {
    const result = await connection.execute<LiveRow>(
      `SELECT p.object_name AS package_name, p.procedure_name,
              MAX(CASE WHEN a.argument_name = 'P_DATE' THEN 1 ELSE 0 END) AS takes_date_param,
              MAX(CASE WHEN a.argument_name = 'P_SCOPE' THEN 1 ELSE 0 END) AS takes_scope_param
       FROM USER_PROCEDURES p
       LEFT JOIN USER_ARGUMENTS a
         ON a.package_name = p.object_name AND a.object_name = p.procedure_name
       WHERE p.object_type = 'PACKAGE' AND p.procedure_name IS NOT NULL
       GROUP BY p.object_name, p.procedure_name
       ORDER BY p.object_name, p.procedure_name`
    );
    return result.rows ?? [];
  });

  await withConnection(async (connection) => {
    for (const row of live) {
      await connection.execute(
        `MERGE INTO PROCEDURES tgt
         USING (SELECT :packageName AS package_name, :procedureName AS procedure_name FROM dual) src
         ON (tgt.package_name = src.package_name AND tgt.procedure_name = src.procedure_name)
         WHEN MATCHED THEN UPDATE SET
           takes_date_param = :takesDateParam, takes_scope_param = :takesScopeParam
         WHEN NOT MATCHED THEN INSERT (procedure_name, package_name, takes_date_param, takes_scope_param, created_by)
           VALUES (:procedureName, :packageName, :takesDateParam, :takesScopeParam, 'system-sync')`,
        {
          packageName: row.PACKAGE_NAME,
          procedureName: row.PROCEDURE_NAME,
          takesDateParam: row.TAKES_DATE_PARAM,
          takesScopeParam: row.TAKES_SCOPE_PARAM,
        },
        { autoCommit: false }
      );
    }

    // Drop any PROCEDURES row that no longer matches a live physical procedure,
    // as long as nothing still references it - if a pipeline still points at a
    // since-dropped procedure, leave the row so that pipeline doesn't break.
    await connection.execute(
      `DELETE FROM PROCEDURES p
       WHERE p.id NOT IN (SELECT procedure_id FROM PIPELINE_PROCEDURES)
         AND NOT EXISTS (
           SELECT 1 FROM (
             SELECT up.object_name AS package_name, up.procedure_name
             FROM USER_PROCEDURES up
             WHERE up.object_type = 'PACKAGE' AND up.procedure_name IS NOT NULL
           ) live
           WHERE live.package_name = p.package_name AND live.procedure_name = p.procedure_name
         )`,
      {},
      { autoCommit: true }
    );
  });

  // Only ever return rows that match a currently-live physical procedure -
  // a PROCEDURES row kept alive by an existing pipeline reference (see the
  // DELETE above) must not resurface in the catalog once its underlying
  // package/procedure is gone.
  type Row = { ID: number; PROCEDURE_NAME: string; PACKAGE_NAME: string };
  const rows: Row[] = await withConnection(async (connection) => {
    const result = await connection.execute<Row>(
      `SELECT p.id, p.procedure_name, p.package_name
       FROM PROCEDURES p
       JOIN USER_PROCEDURES up
         ON up.object_name = p.package_name AND up.procedure_name = p.procedure_name
       WHERE up.object_type = 'PACKAGE'
       ORDER BY p.package_name, p.procedure_name`
    );
    return result.rows ?? [];
  });

  const liveByKey = new Map(live.map((r) => [`${r.PACKAGE_NAME}.${r.PROCEDURE_NAME}`, r]));
  return rows.map((r) => {
    const l = liveByKey.get(`${r.PACKAGE_NAME}.${r.PROCEDURE_NAME}`)!;
    return {
      id: r.ID,
      procedureName: r.PROCEDURE_NAME,
      packageName: r.PACKAGE_NAME,
      takesDateParam: l.TAKES_DATE_PARAM === 1,
      takesScopeParam: l.TAKES_SCOPE_PARAM === 1,
    };
  });
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

/**
 * Deleting a group sets its procedures' group_id to NULL rather than
 * deleting the PIPELINE_PROCEDURES row (see deleteGroup) - "returned to
 * the catalog" but the row, and its PK on (pipeline_id, procedure_id),
 * still exists. Re-attaching that same procedure must therefore be an
 * upsert, not a plain INSERT, or it collides with the leftover row.
 */
export async function addProcedureToGroup(
  pipelineId: number,
  groupId: number,
  procedureId: number,
  sortOrder: number,
  dependsOnDataset: string | null
): Promise<number> {
  return withConnection(async (connection) => {
    await connection.execute(
      `MERGE INTO PIPELINE_PROCEDURES tgt
       USING (SELECT :pipelineId AS pipeline_id, :procedureId AS procedure_id FROM dual) src
       ON (tgt.pipeline_id = src.pipeline_id AND tgt.procedure_id = src.procedure_id)
       WHEN MATCHED THEN UPDATE SET
         group_id = :groupId1, sort_order = :sortOrder1, depends_on_dataset = :dependsOnDataset1
       WHEN NOT MATCHED THEN INSERT (pipeline_id, group_id, procedure_id, sort_order, depends_on_dataset)
         VALUES (:pipelineId, :groupId2, :procedureId, :sortOrder2, :dependsOnDataset2)`,
      {
        pipelineId, procedureId,
        groupId1: groupId, sortOrder1: sortOrder, dependsOnDataset1: dependsOnDataset ?? null,
        groupId2: groupId, sortOrder2: sortOrder, dependsOnDataset2: dependsOnDataset ?? null,
      },
      { autoCommit: true }
    );
    const result = await connection.execute<{ ID: number }>(
      `SELECT id FROM PIPELINE_PROCEDURES WHERE pipeline_id = :pipelineId AND procedure_id = :procedureId`,
      { pipelineId, procedureId }
    );
    return result.rows![0].ID;
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
  isActive: boolean;
  createdBy: string;
  createdAt: string;
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
    isActive: structure.isActive,
    createdBy: structure.createdBy,
    createdAt: structure.createdAt,
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
    const r = await conn.execute<PipelineRow>(`SELECT id FROM PIPELINES ORDER BY id`);
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
  triggeredBy: string,
  overrideType: string | null
): Promise<{ status: "COMPLETED" | "FAILED"; error?: string }> {
  // One physical row per attempt, not per state transition: a standing
  // approval (PENDING) row is continued in place rather than superseded, so
  // starting the run just updates it to IN_PROGRESS. A FAILED/COMPLETED row
  // from an earlier attempt is permanent history though, so a genuinely new
  // attempt always gets its own fresh row - never overwrites one.
  const runId: number = await withConnection(async (conn) => {
    const existing = await conn.execute<{ ID: number; STATUS: string }>(
      `SELECT id, status FROM PIPELINE_PROCEDURE_RUNS
       WHERE pipeline_id = :pipelineId AND procedure_id = :procedureId AND time_key = :timeKey
       ORDER BY updated_at DESC FETCH FIRST 1 ROWS ONLY`,
      { pipelineId, procedureId: proc.procedureId, timeKey }
    );
    const latest = existing.rows?.[0];

    if (latest && latest.STATUS === "PENDING") {
      await conn.execute(
        `UPDATE PIPELINE_PROCEDURE_RUNS SET status = 'IN_PROGRESS', start_time = LOCALTIMESTAMP, updated_by = :updatedBy
         WHERE id = :id`,
        { id: latest.ID, updatedBy: triggeredBy },
        { autoCommit: true }
      );
      return latest.ID;
    }

    const r = await conn.execute<{ ID: number[] }>(
      `INSERT INTO PIPELINE_PROCEDURE_RUNS (pipeline_id, procedure_id, time_key, status, override_type, start_time, updated_by)
       VALUES (:pipelineId, :procedureId, :timeKey, 'IN_PROGRESS', :overrideType, LOCALTIMESTAMP, :updatedBy)
       RETURNING id INTO :id`,
      {
        pipelineId,
        procedureId: proc.procedureId,
        timeKey,
        overrideType,
        updatedBy: triggeredBy,
        id: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_NUMBER },
      },
      { autoCommit: true }
    );
    return (r.outBinds as { id: number[] }).id[0];
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
        `UPDATE PIPELINE_PROCEDURE_RUNS SET status = 'COMPLETED', end_time = LOCALTIMESTAMP, updated_by = :updatedBy WHERE id = :id`,
        { id: runId, updatedBy: triggeredBy },
        { autoCommit: true }
      )
    );
    return { status: "COMPLETED" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await withConnection((conn) =>
      conn.execute(
        `UPDATE PIPELINE_PROCEDURE_RUNS SET status = 'FAILED', end_time = LOCALTIMESTAMP, note = :note, updated_by = :updatedBy WHERE id = :id`,
        { id: runId, note: message.slice(0, 1000), updatedBy: triggeredBy },
        { autoCommit: true }
      )
    );
    return { status: "FAILED", error: message };
  }
}

/**
 * Lets a user pre-authorize a procedure to proceed without its upload
 * dependency being approved, for cases where the upstream data genuinely
 * isn't coming through UPLOAD_LOG (e.g. a manual/offline source). This only
 * clears the block - it does not mark the procedure done or run its job.
 * The approval can be granted at any time, even for a procedure several
 * steps away, because it changes nothing about *when* the procedure runs:
 * runNextInPipeline/runAllInPipeline still only ever advance the first
 * not-yet-completed procedure in the pipeline's group order and each
 * SEQUENTIAL group's own sort order, so an approved procedure simply stops
 * blocking that walk once its own turn actually comes.
 */
export async function approveProcedureWithoutUpload(
  pipelineId: number,
  procedureId: number,
  timeKey: string,
  note: string,
  triggeredBy: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const state = await getPipelineRunState(pipelineId, timeKey);
  if (!state) return { ok: false, error: "Pipeline not found." };

  const procState = state.groups.flatMap((g) => g.procedures).find((p) => p.proc.procedureId === procedureId);
  if (!procState) return { ok: false, error: "Procedure not found in this pipeline." };
  if (!procState.proc.dependsOnDataset) {
    return { ok: false, error: "This procedure doesn't depend on an upload." };
  }
  if (procState.status === "COMPLETED") {
    return { ok: false, error: "This procedure has already completed." };
  }
  if (procState.status === "IN_PROGRESS") {
    return { ok: false, error: "This procedure is currently running." };
  }
  if (procState.overrideType) {
    return { ok: false, error: "This procedure is already approved to proceed without upload." };
  }

  await withConnection((conn) =>
    conn.execute(
      `INSERT INTO PIPELINE_PROCEDURE_RUNS (pipeline_id, procedure_id, time_key, status, override_type, note, updated_by)
       VALUES (:pipelineId, :procedureId, :timeKey, 'PENDING', 'PROCEED_WITHOUT_UPLOAD', :note, :updatedBy)`,
      { pipelineId, procedureId, timeKey, note, updatedBy: triggeredBy },
      { autoCommit: true }
    )
  );
  return { ok: true };
}

/**
 * A SEQUENTIAL group must honor sort order strictly: the next procedure to
 * run is the first one (in order) that isn't already COMPLETED. If *that*
 * one is blocked or still IN_PROGRESS, the group cannot advance - it is
 * wrong to skip past it and run a later procedure just because the later
 * one happens not to be blocked.
 */
function nextSequentialProcedure(procedures: ProcRunState[]): { proc: ProcRunState | null; canProceed: boolean } {
  const next = procedures.find((p) => p.status !== "COMPLETED");
  if (!next) return { proc: null, canProceed: true }; // group already fully complete
  if (next.isBlocked || next.status === "IN_PROGRESS") return { proc: null, canProceed: false };
  return { proc: next, canProceed: true };
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

  if (targetGroup.group.execMode === "PARALLEL") {
    const eligible = targetGroup.procedures.filter(
      (p) => p.status !== "COMPLETED" && p.status !== "IN_PROGRESS" && !p.isBlocked
    );
    targetGroup.procedures.filter((p) => p.isBlocked).forEach((p) => blocked.push(p.proc.procedureName));
    const results = await Promise.all(
      eligible.map((p) => runGroupProcedure(pipelineId, p.proc, timeKey, triggeredBy, p.overrideType))
    );
    eligible.forEach((p, i) => {
      if (results[i].status === "COMPLETED") ran.push(p.proc.procedureName);
      else failed.push(p.proc.procedureName);
    });
  } else {
    const { proc: next, canProceed } = nextSequentialProcedure(targetGroup.procedures);
    if (!canProceed) {
      const stuck = targetGroup.procedures.find((p) => p.status !== "COMPLETED");
      if (stuck) blocked.push(stuck.proc.procedureName);
    } else if (next) {
      const result = await runGroupProcedure(pipelineId, next.proc, timeKey, triggeredBy, next.overrideType);
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

    // A group that can't fully complete this pass (blocked, or a failure
    // partway through) must stop the whole run right there - later groups
    // are not started until this one is actually done, not just attempted.
    let groupBlockedOrFailed = false;

    if (group.execMode === "PARALLEL") {
      const eligible = groupState.procedures.filter(
        (p) => p.status !== "COMPLETED" && p.status !== "IN_PROGRESS" && !p.isBlocked
      );
      groupState.procedures.filter((p) => p.isBlocked).forEach((p) => {
        allBlocked.push(p.proc.procedureName);
        groupBlockedOrFailed = true;
      });
      const results = await Promise.all(
        eligible.map((p) => runGroupProcedure(pipelineId, p.proc, timeKey, triggeredBy, p.overrideType))
      );
      eligible.forEach((p, i) => {
        if (results[i].status === "COMPLETED") allRan.push(p.proc.procedureName);
        else { allFailed.push(p.proc.procedureName); groupBlockedOrFailed = true; }
      });
    } else {
      // Walk procedures in order, one at a time, re-deriving what's next
      // after each run so a fresh block (or the next procedure's own
      // dependency) is caught immediately rather than assuming the
      // pre-fetched eligibility list is still accurate.
      let procedures = groupState.procedures;
      for (;;) {
        const { proc: next, canProceed } = nextSequentialProcedure(procedures);
        if (!canProceed) {
          const stuck = procedures.find((p) => p.status !== "COMPLETED");
          if (stuck) allBlocked.push(stuck.proc.procedureName);
          groupBlockedOrFailed = true;
          break;
        }
        if (!next) break; // group fully complete
        const result = await runGroupProcedure(pipelineId, next.proc, timeKey, triggeredBy, next.overrideType);
        if (result.status === "COMPLETED") {
          allRan.push(next.proc.procedureName);
          procedures = procedures.map((p) =>
            p.proc.pipelineProcedureId === next.proc.pipelineProcedureId ? { ...p, status: "COMPLETED" as const } : p
          );
        } else {
          allFailed.push(next.proc.procedureName);
          groupBlockedOrFailed = true;
          break;
        }
      }
    }

    if (groupBlockedOrFailed) break;
  }

  return { ran: allRan, blocked: allBlocked, failed: allFailed };
}
