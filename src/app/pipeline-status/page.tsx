"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getReportingPeriod } from "@/lib/reportingPeriod";
import { PIPELINE_STAGES, PIPELINE_STATUSES, type PipelineStageKey, type PipelineStatus } from "@/lib/pipelineStages";
import {
  IconGitBranch,
  IconPencil,
  IconCheck,
  IconLoader,
  IconAlertTriangle,
  IconCircleDashed,
  IconX,
  IconCalendar,
  IconPlus,
  IconDocument,
} from "@/components/icons";

type Pipeline = { id: number; name: string; isActive: boolean; createdBy: string; createdAt: string };
type ProcedureDef = {
  id: number;
  procedureName: string;
  packageName: string | null;
  stage: PipelineStageKey;
  dependsOnDataset: string | null;
};
type ProcedureState = {
  procedure: ProcedureDef;
  status: PipelineStatus;
  isBlocked: boolean;
  blockedReason: string | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  overrideType: "PROCEED_WITHOUT_UPLOAD" | "USE_PREVIOUS_PERIOD" | null;
  updatedBy: string | null;
  updatedAt: string | null;
};
type RunHistoryEntry = {
  id: number;
  procedureName: string;
  packageName: string | null;
  stage: PipelineStageKey;
  dependsOnDataset: string | null;
  status: PipelineStatus;
  overrideType: string | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  updatedBy: string;
  updatedAt: string;
};

function fullProcedureName(p: { procedureName: string; packageName: string | null }): string {
  return p.packageName ? `${p.packageName}.${p.procedureName}` : p.procedureName;
}

const STATUS_STYLE: Record<PipelineStatus, { text: string; bg: string; border: string; icon: typeof IconCheck; label: string }> = {
  PENDING: { text: "text-zinc-400", bg: "bg-zinc-100", border: "border-zinc-300", icon: IconCircleDashed, label: "Queued" },
  IN_PROGRESS: { text: "text-indigo-600", bg: "bg-indigo-100", border: "border-indigo-500", icon: IconLoader, label: "Running" },
  AWAITING_INPUT: { text: "text-amber-700", bg: "bg-amber-100", border: "border-amber-500", icon: IconAlertTriangle, label: "Attention" },
  COMPLETED: { text: "text-emerald-700", bg: "bg-emerald-100", border: "border-emerald-500", icon: IconCheck, label: "Completed" },
  FAILED: { text: "text-red-700", bg: "bg-red-100", border: "border-red-500", icon: IconX, label: "Failed" },
};

function overallStatus(statuses: PipelineStatus[]): PipelineStatus {
  if (statuses.some((s) => s === "FAILED")) return "FAILED";
  if (statuses.some((s) => s === "AWAITING_INPUT")) return "AWAITING_INPUT";
  if (statuses.some((s) => s === "IN_PROGRESS")) return "IN_PROGRESS";
  if (statuses.length > 0 && statuses.every((s) => s === "COMPLETED")) return "COMPLETED";
  return "PENDING";
}

function fmtDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PipelineCard({
  pipeline,
  timeKey,
  cycleLabel,
  periodDateLabel,
  isAdmin,
  onUpdate,
}: {
  pipeline: Pipeline;
  timeKey: string;
  cycleLabel: string;
  periodDateLabel: string;
  isAdmin: boolean;
  onUpdate: (pipeline: Pipeline, states: ProcedureState[]) => void;
}) {
  const [states, setStates] = useState<ProcedureState[]>([]);
  const [stageStatuses, setStageStatuses] = useState<Record<string, PipelineStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [history, setHistory] = useState<RunHistoryEntry[] | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [runError, setRunError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/pipelines/${pipeline.id}/procedures?timeKey=${timeKey}`);
    if (response.ok) {
      const data = await response.json();
      setStates(data.states ?? []);
      setStageStatuses(data.stageStatuses ?? {});
    }
    setIsLoading(false);
  }, [pipeline.id, timeKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function openLog() {
    setShowLog(true);
    const response = await fetch(`/api/pipelines/${pipeline.id}/procedures/history?timeKey=${timeKey}`);
    if (response.ok) {
      const data = await response.json();
      setHistory(data.history ?? []);
    }
  }

  async function handleRun(procedureId: number) {
    setRunError("");
    setRunningId(procedureId);
    try {
      const response = await fetch(`/api/pipelines/${pipeline.id}/procedures/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedureId, timeKey }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRunError(data.error ?? "Couldn't run this procedure.");
      } else if (data.status === "FAILED") {
        setRunError(data.error ?? "The procedure ran but failed.");
      }
      await load();
    } finally {
      setRunningId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  const stageList = PIPELINE_STAGES.map((s) => ({ ...s, status: stageStatuses[s.key] ?? "PENDING" }));
  const completedStages = stageList.filter((s) => s.status === "COMPLETED").length;
  const pct = stageList.length ? Math.round((completedStages / stageList.length) * 100) : 0;
  const overall = overallStatus(stageList.map((s) => s.status));
  const overallStyle = STATUS_STYLE[overall];

  const completedProcs = states.filter((s) => s.status === "COMPLETED").length;
  const attentionProcs = states.filter((s) => s.status === "AWAITING_INPUT" || s.status === "FAILED").length;
  const queuedProcs = states.filter((s) => s.status === "PENDING").length;
  const flagged = states.find((s) => s.status === "AWAITING_INPUT" || s.status === "FAILED");
  const currentProc = states.find((s) => s.status === "IN_PROGRESS") ?? flagged;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <IconGitBranch className="h-4 w-4 text-zinc-400" />
            <p className="text-sm font-semibold text-zinc-900">{pipeline.name}</p>
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${overallStyle.bg} ${overallStyle.text}`}>
              <overallStyle.icon className={`h-3 w-3 ${overall === "IN_PROGRESS" ? "animate-spin" : ""}`} />
              {overallStyle.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openLog}
              className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              <IconDocument className="h-3.5 w-3.5" />
              View log
            </button>
            {isAdmin && (
              <button
                onClick={() => onUpdate(pipeline, states)}
                disabled={states.length === 0}
                className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IconPencil className="h-3.5 w-3.5" />
                Update status
              </button>
            )}
          </div>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {cycleLabel} cycle · {states.length} procedure{states.length === 1 ? "" : "s"} · started by{" "}
          {pipeline.createdBy}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-medium text-emerald-600">{pct}% of stages complete</span>
        </div>

        <div className="mt-5 flex items-start">
          {stageList.map((s, i) => {
            const style = STATUS_STYLE[s.status];
            const Icon = style.icon;
            const procsInStage = states.filter((st) => st.procedure.stage === s.key);
            return (
              <div key={s.key} className="flex flex-1 items-start last:flex-none">
                <button
                  onDoubleClick={() => {
                    setRunError("");
                    setExpandedStage(s.key);
                  }}
                  title="Double-click to view procedures"
                  className="flex min-w-0 flex-1 flex-col items-center rounded-md py-1 transition-colors hover:bg-zinc-50"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border ${style.bg} ${style.text} ${style.border}`}
                  >
                    <Icon className={`h-4 w-4 ${s.status === "IN_PROGRESS" ? "animate-spin" : ""}`} />
                  </span>
                  <p className="mt-2 text-center text-[11px] font-medium leading-tight text-zinc-900">
                    {i + 1}. {s.label}
                  </p>
                  <span className={`mt-1 rounded-full px-2 py-0.5 text-[10px] ${style.bg} ${style.text}`}>{style.label}</span>
                  <span className="mt-1 text-[10px] text-indigo-500">
                    {procsInStage.length} procedure{procsInStage.length === 1 ? "" : "s"}
                  </span>
                </button>
                {i < stageList.length - 1 && (
                  <div className="flex flex-none pt-4">
                    <div className={`h-0.5 w-8 ${s.status === "COMPLETED" ? "bg-emerald-500" : "bg-zinc-200"}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {flagged && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
            <span className={`flex items-center gap-1.5 text-xs ${STATUS_STYLE[flagged.status].text}`}>
              <IconAlertTriangle className="h-3.5 w-3.5" />
              {fullProcedureName(flagged.procedure)} ({PIPELINE_STAGES.find((s) => s.key === flagged.procedure.stage)?.label}) needs
              attention
              {flagged.isBlocked ? ` — ${flagged.blockedReason}` : flagged.note ? ` — ${flagged.note}` : ""}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-zinc-900">Cycle summary</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-zinc-50 p-2.5 text-center">
              <p className="text-lg font-semibold text-zinc-900">{states.length}</p>
              <p className="text-[10px] text-zinc-500">Total procedures</p>
            </div>
            <div className="rounded-md bg-zinc-50 p-2.5 text-center">
              <p className="text-lg font-semibold text-emerald-600">{completedProcs}</p>
              <p className="text-[10px] text-zinc-500">Completed</p>
            </div>
            <div className="rounded-md bg-zinc-50 p-2.5 text-center">
              <p className="text-lg font-semibold text-amber-600">{attentionProcs}</p>
              <p className="text-[10px] text-zinc-500">Attention</p>
            </div>
            <div className="rounded-md bg-zinc-50 p-2.5 text-center">
              <p className="text-lg font-semibold text-zinc-400">{queuedProcs}</p>
              <p className="text-[10px] text-zinc-500">Queued</p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
            <IconCalendar className="h-3.5 w-3.5" />
            Cycle period: {periodDateLabel}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-zinc-900">Procedure details</p>
          {currentProc ? (
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Procedure</span>
                <span className="font-medium text-zinc-900">{fullProcedureName(currentProc.procedure)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Stage</span>
                <span className="text-zinc-900">
                  {PIPELINE_STAGES.find((s) => s.key === currentProc.procedure.stage)?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Status</span>
                <span className={STATUS_STYLE[currentProc.status].text}>{STATUS_STYLE[currentProc.status].label}</span>
              </div>
              {currentProc.startTime && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Started</span>
                  <span className="text-zinc-900">{fmtDateTime(currentProc.startTime)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              {states.length > 0 && completedProcs === states.length
                ? "All procedures complete."
                : "Nothing in progress right now."}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-zinc-900">By stage</p>
          <div className="flex flex-col gap-2">
            {stageList.map((s) => {
              const style = STATUS_STYLE[s.status];
              return (
                <div key={s.key} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-700">{s.label}</span>
                  <span className={`rounded-full px-2 py-0.5 ${style.bg} ${style.text}`}>{style.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Log — {pipeline.name}</p>
                <p className="text-xs text-zinc-500">{cycleLabel} cycle</p>
              </div>
              <button
                onClick={() => setShowLog(false)}
                className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-auto">
              {history === null ? (
                <p className="text-sm text-zinc-500">Loading...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-zinc-500">No activity logged for this period yet.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500">
                      <th className="py-2 pr-3 font-medium">Procedure</th>
                      <th className="py-2 pr-3 font-medium">Package</th>
                      <th className="py-2 pr-3 font-medium">Stage</th>
                      <th className="py-2 pr-3 font-medium">Depends on</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Started</th>
                      <th className="py-2 pr-3 font-medium">Ended</th>
                      <th className="py-2 pr-3 font-medium">Note</th>
                      <th className="py-2 font-medium">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      const style = STATUS_STYLE[h.status];
                      return (
                        <tr key={h.id} className="border-b border-zinc-100 align-top text-zinc-700">
                          <td className="py-2 pr-3 font-medium text-zinc-900">{h.procedureName}</td>
                          <td className="py-2 pr-3 text-zinc-500">{h.packageName ?? "—"}</td>
                          <td className="py-2 pr-3">{PIPELINE_STAGES.find((s) => s.key === h.stage)?.label}</td>
                          <td className="py-2 pr-3 text-zinc-500">{h.dependsOnDataset ?? "—"}</td>
                          <td className="py-2 pr-3">
                            <span className={`rounded-full px-2 py-0.5 ${style.bg} ${style.text}`}>{style.label}</span>
                          </td>
                          <td className="py-2 pr-3">{fmtDateTime(h.startTime)}</td>
                          <td className="py-2 pr-3">{fmtDateTime(h.endTime)}</td>
                          <td className="py-2 pr-3 max-w-xs text-zinc-600">{h.note ?? "—"}</td>
                          <td className="py-2 text-zinc-500">{h.updatedBy}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {expandedStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  {PIPELINE_STAGES.find((s) => s.key === expandedStage)?.label}
                </p>
                <p className="text-xs text-zinc-500">
                  {states.filter((st) => st.procedure.stage === expandedStage).length} procedures · {cycleLabel} cycle
                </p>
              </div>
              <button
                onClick={() => setExpandedStage(null)}
                className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>

            {runError && (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700" role="alert">
                {runError}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2">
              {states
                .filter((st) => st.procedure.stage === expandedStage)
                .map((st) => {
                  const style = STATUS_STYLE[st.status];
                  const Icon = style.icon;
                  const isAttention = st.status === "AWAITING_INPUT" || st.status === "FAILED";
                  return (
                    <div
                      key={st.procedure.id}
                      className={`rounded-md border px-3 py-2.5 ${isAttention ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-zinc-900">{fullProcedureName(st.procedure)}</span>
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${style.bg} ${style.text}`}>
                          <Icon className={`h-3 w-3 ${st.status === "IN_PROGRESS" ? "animate-spin" : ""}`} />
                          {style.label}
                        </span>
                      </div>
                      {st.procedure.dependsOnDataset && (
                        <p className="mt-1 text-[11px] text-zinc-500">depends on {st.procedure.dependsOnDataset}</p>
                      )}
                      {(st.isBlocked ? st.blockedReason : st.note) && (
                        <p className={`mt-1 text-[11px] ${isAttention ? "text-amber-700" : "text-zinc-500"}`}>
                          {st.isBlocked ? st.blockedReason : st.note}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <div className="flex gap-3 text-[10.5px] text-zinc-400">
                          <span>Started {fmtDateTime(st.startTime)}</span>
                          <span>Ended {fmtDateTime(st.endTime)}</span>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleRun(st.procedure.id)}
                            disabled={runningId !== null || st.status === "IN_PROGRESS"}
                            className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-[10.5px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {runningId === st.procedure.id && <IconLoader className="h-3 w-3 animate-spin" />}
                            {runningId === st.procedure.id ? "Running..." : "Run"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PipelineStatusPage() {
  const { checked, username } = useRequireAuth();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingPipeline, setUpdatingPipeline] = useState<Pipeline | null>(null);
  const [updateProcedures, setUpdateProcedures] = useState<ProcedureState[]>([]);
  const [updateProcedureId, setUpdateProcedureId] = useState<number | null>(null);
  const [updateStatus, setUpdateStatus] = useState<PipelineStatus>("IN_PROGRESS");
  const [updateNote, setUpdateNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [newPipelineError, setNewPipelineError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const period = getReportingPeriod();

  const load = useCallback(async () => {
    setIsLoading(true);
    const [pipelinesRes, usersRes, meRes] = await Promise.all([
      fetch("/api/pipelines"),
      fetch("/api/users"),
      fetch("/api/auth/me"),
    ]);
    if (pipelinesRes.ok) {
      const data = await pipelinesRes.json();
      setPipelines(data.pipelines ?? []);
    }
    if (usersRes.ok && meRes.ok) {
      const users = await usersRes.json();
      const me = await meRes.json();
      const match = users.users?.find((u: { username: string; isAdmin: boolean }) => u.username === me.username);
      setIsAdminUser(match?.isAdmin ?? false);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!checked) return;
    load();
  }, [checked, load, refreshKey]);

  function openUpdate(pipeline: Pipeline, states: ProcedureState[]) {
    setUpdatingPipeline(pipeline);
    setUpdateProcedures(states);
    setUpdateProcedureId(states[0]?.procedure.id ?? null);
    setUpdateStatus("IN_PROGRESS");
    setUpdateNote("");
    setUpdateError("");
  }

  const selectedProcState = updateProcedures.find((s) => s.procedure.id === updateProcedureId) ?? null;

  async function handleSaveUpdate() {
    if (!updatingPipeline || !updateProcedureId) return;
    setIsSaving(true);
    setUpdateError("");
    try {
      const response = await fetch(`/api/pipelines/${updatingPipeline.id}/procedures/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeKey: period.timeKey,
          procedureId: updateProcedureId,
          status: updateStatus,
          note: updateNote || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setUpdateError(data.error ?? "Couldn't update status.");
        return;
      }
      setUpdatingPipeline(null);
      setRefreshKey((k) => k + 1);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOverride(overrideType: "PROCEED_WITHOUT_UPLOAD" | "USE_PREVIOUS_PERIOD") {
    if (!updatingPipeline || !updateProcedureId) return;
    setIsSaving(true);
    setUpdateError("");
    try {
      const response = await fetch(`/api/pipelines/${updatingPipeline.id}/procedures/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeKey: period.timeKey, procedureId: updateProcedureId, overrideType }),
      });
      const data = await response.json();
      if (!response.ok) {
        setUpdateError(data.error ?? "Couldn't apply override.");
        return;
      }
      setUpdatingPipeline(null);
      setRefreshKey((k) => k + 1);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreatePipeline() {
    setNewPipelineError("");
    if (!newPipelineName.trim()) {
      setNewPipelineError("Enter a pipeline name.");
      return;
    }
    const response = await fetch("/api/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPipelineName.trim() }),
    });
    const data = await response.json();
    if (!response.ok) {
      setNewPipelineError(data.error ?? "Couldn't create pipeline.");
      return;
    }
    setShowNewPipeline(false);
    setNewPipelineName("");
    setRefreshKey((k) => k + 1);
  }

  if (!checked) return null;

  return (
    <AppShell active="/pipeline-status" title="Pipeline Status">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Procedure-by-procedure status for each data pipeline, for the current reporting cycle.
          </p>
          {isAdminUser && (
            <button
              onClick={() => {
                setShowNewPipeline(true);
                setNewPipelineName("");
                setNewPipelineError("");
              }}
              className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              <IconPlus className="h-4 w-4" />
              New pipeline
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : pipelines.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-zinc-500">No pipelines yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {pipelines.map((p) => (
              <PipelineCard
                key={p.id}
                pipeline={p}
                timeKey={period.timeKey}
                cycleLabel={period.cycleLabel}
                periodDateLabel={period.periodDateLabel}
                isAdmin={isAdminUser}
                onUpdate={openUpdate}
              />
            ))}
          </div>
        )}
      </div>

      {updatingPipeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <p className="text-sm font-semibold text-zinc-900">Update status — {updatingPipeline.name}</p>
            <p className="mt-1 text-xs text-zinc-500">For the {period.periodLabel} cycle.</p>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-700">Procedure</label>
                <select
                  value={updateProcedureId ?? ""}
                  onChange={(e) => setUpdateProcedureId(Number(e.target.value))}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                >
                  {updateProcedures.map((s) => (
                    <option key={s.procedure.id} value={s.procedure.id}>
                      {fullProcedureName(s.procedure)} ({PIPELINE_STAGES.find((st) => st.key === s.procedure.stage)?.label})
                    </option>
                  ))}
                </select>
              </div>

              {selectedProcState?.isBlocked ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                    <IconAlertTriangle className="h-3.5 w-3.5" />
                    This procedure is blocked
                  </p>
                  <p className="mt-1 text-xs text-amber-700">{selectedProcState.blockedReason}</p>
                  <p className="mt-2 text-xs text-zinc-600">
                    It can&rsquo;t proceed until the upload is approved — or you explicitly override it:
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    <button
                      onClick={() => handleOverride("PROCEED_WITHOUT_UPLOAD")}
                      disabled={isSaving}
                      className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                    >
                      Proceed without upload
                    </button>
                    <button
                      onClick={() => handleOverride("USE_PREVIOUS_PERIOD")}
                      disabled={isSaving}
                      className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                    >
                      Use previous period&rsquo;s file
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-zinc-700">Status</label>
                    <select
                      value={updateStatus}
                      onChange={(e) => setUpdateStatus(e.target.value as PipelineStatus)}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                    >
                      {PIPELINE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_STYLE[s].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-zinc-700">Note (optional)</label>
                    <textarea
                      value={updateNote}
                      onChange={(e) => setUpdateNote(e.target.value)}
                      rows={2}
                      placeholder="e.g. Retried after source system timeout"
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                    />
                  </div>
                </>
              )}

              {updateError && (
                <p className="text-sm text-red-600" role="alert">
                  {updateError}
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setUpdatingPipeline(null)}
                disabled={isSaving}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
              {!selectedProcState?.isBlocked && (
                <button
                  onClick={handleSaveUpdate}
                  disabled={isSaving}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showNewPipeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <p className="text-sm font-semibold text-zinc-900">New pipeline</p>
            <div className="mt-4 flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Name</label>
              <input
                type="text"
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                placeholder="e.g. BRF 02 - Original"
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            {newPipelineError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {newPipelineError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowNewPipeline(false)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePipeline}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-zinc-400">Signed in as {username}</p>
    </AppShell>
  );
}
