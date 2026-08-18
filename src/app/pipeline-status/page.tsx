"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getReportingPeriod } from "@/lib/reportingPeriod";
import { PIPELINE_STAGES, PIPELINE_STATUSES, type PipelineStatus } from "@/lib/pipelineStages";
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
type StageState = { stage: string; status: PipelineStatus; note: string | null; updatedBy: string | null; updatedAt: string | null };
type ActivityEntry = { id: number; stage: string; status: PipelineStatus; note: string | null; updatedBy: string; updatedAt: string };

const STATUS_STYLE: Record<PipelineStatus, { text: string; bg: string; border: string; icon: typeof IconCheck; label: string }> = {
  PENDING: { text: "text-zinc-400", bg: "bg-zinc-100", border: "border-zinc-300", icon: IconCircleDashed, label: "Queued" },
  IN_PROGRESS: { text: "text-indigo-600", bg: "bg-indigo-100", border: "border-indigo-500", icon: IconLoader, label: "Running" },
  AWAITING_INPUT: { text: "text-amber-700", bg: "bg-amber-100", border: "border-amber-500", icon: IconAlertTriangle, label: "Attention" },
  COMPLETED: { text: "text-emerald-700", bg: "bg-emerald-100", border: "border-emerald-500", icon: IconCheck, label: "Completed" },
  FAILED: { text: "text-red-700", bg: "bg-red-100", border: "border-red-500", icon: IconX, label: "Failed" },
};

function overallStatus(stages: StageState[]): PipelineStatus {
  if (stages.some((s) => s.status === "FAILED")) return "FAILED";
  if (stages.some((s) => s.status === "AWAITING_INPUT")) return "AWAITING_INPUT";
  if (stages.some((s) => s.status === "IN_PROGRESS")) return "IN_PROGRESS";
  if (stages.every((s) => s.status === "COMPLETED")) return "COMPLETED";
  return "PENDING";
}

function fmtDateTime(value: string | null): string {
  if (!value) return "Not started";
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
  onUpdate: (pipeline: Pipeline) => void;
}) {
  const [stages, setStages] = useState<StageState[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/pipelines/${pipeline.id}/status?timeKey=${timeKey}`);
    if (response.ok) {
      const data = await response.json();
      setStages(data.stages ?? []);
      setActivity(data.activity ?? []);
    }
    setIsLoading(false);
  }, [pipeline.id, timeKey]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  const completedCount = stages.filter((s) => s.status === "COMPLETED").length;
  const attentionCount = stages.filter((s) => s.status === "AWAITING_INPUT").length;
  const failedCount = stages.filter((s) => s.status === "FAILED").length;
  const queuedCount = stages.filter((s) => s.status === "PENDING").length;
  const pct = stages.length ? Math.round((completedCount / stages.length) * 100) : 0;
  const overall = overallStatus(stages);
  const overallStyle = STATUS_STYLE[overall];
  const flagged = stages.find((s) => s.status === "AWAITING_INPUT" || s.status === "FAILED");
  const currentStage =
    stages.find((s) => s.status === "IN_PROGRESS") ?? stages.find((s) => s.status === "AWAITING_INPUT");

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
              onClick={() => setShowLog(true)}
              className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              <IconDocument className="h-3.5 w-3.5" />
              View log
            </button>
            {isAdmin && (
              <button
                onClick={() => onUpdate(pipeline)}
                className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                <IconPencil className="h-3.5 w-3.5" />
                Update status
              </button>
            )}
          </div>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {cycleLabel} cycle · {completedCount} of {stages.length} stages complete · started by{" "}
          {pipeline.createdBy}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-medium text-emerald-600">{pct}% complete</span>
        </div>

        <div className="mt-5 flex items-start">
          {stages.map((s, i) => {
            const style = STATUS_STYLE[s.status];
            const Icon = style.icon;
            return (
              <div key={s.stage} className="flex flex-1 items-start last:flex-none">
                <div className="flex min-w-0 flex-1 flex-col items-center">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border ${style.bg} ${style.text} ${style.border}`}
                  >
                    <Icon className={`h-4 w-4 ${s.status === "IN_PROGRESS" ? "animate-spin" : ""}`} />
                  </span>
                  <p className="mt-2 text-center text-[11px] font-medium leading-tight text-zinc-900">
                    {i + 1}. {PIPELINE_STAGES[i].label}
                  </p>
                  <span className={`mt-1 rounded-full px-2 py-0.5 text-[10px] ${style.bg} ${style.text}`}>{style.label}</span>
                  <p className={`mt-1 text-center text-[10px] ${style.text}`}>{fmtDateTime(s.updatedAt)}</p>
                </div>
                {i < stages.length - 1 && (
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
              {PIPELINE_STAGES.find((s) => s.key === flagged.stage)?.label} needs attention
              {flagged.note ? ` — ${flagged.note}` : ""}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-zinc-900">Cycle summary</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-zinc-50 p-2.5 text-center">
              <p className="text-lg font-semibold text-zinc-900">{stages.length}</p>
              <p className="text-[10px] text-zinc-500">Total stages</p>
            </div>
            <div className="rounded-md bg-zinc-50 p-2.5 text-center">
              <p className="text-lg font-semibold text-emerald-600">{completedCount}</p>
              <p className="text-[10px] text-zinc-500">Completed</p>
            </div>
            <div className="rounded-md bg-zinc-50 p-2.5 text-center">
              <p className="text-lg font-semibold text-amber-600">{attentionCount + failedCount}</p>
              <p className="text-[10px] text-zinc-500">Attention</p>
            </div>
            <div className="rounded-md bg-zinc-50 p-2.5 text-center">
              <p className="text-lg font-semibold text-zinc-400">{queuedCount}</p>
              <p className="text-[10px] text-zinc-500">Queued</p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
            <IconCalendar className="h-3.5 w-3.5" />
            Cycle period: {periodDateLabel}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-zinc-900">Stage details</p>
          {currentStage ? (
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Current stage</span>
                <span className="font-medium text-zinc-900">
                  {PIPELINE_STAGES.find((s) => s.key === currentStage.stage)?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Status</span>
                <span className={STATUS_STYLE[currentStage.status].text}>{STATUS_STYLE[currentStage.status].label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Since</span>
                <span className="text-zinc-900">{fmtDateTime(currentStage.updatedAt)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              {completedCount === stages.length ? "All stages complete." : "Nothing in progress right now."}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-zinc-900">Recent activity</p>
          {activity.length === 0 ? (
            <p className="text-xs text-zinc-500">No activity logged for this period yet.</p>
          ) : (
            <div className="flex max-h-48 flex-col gap-2.5 overflow-y-auto">
              {activity.map((a) => {
                const style = STATUS_STYLE[a.status];
                const Icon = style.icon;
                return (
                  <div key={a.id} className="flex items-start gap-2">
                    <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${style.text}`} />
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-900">
                        {PIPELINE_STAGES.find((s) => s.key === a.stage)?.label} — {style.label.toLowerCase()}
                      </p>
                      <p className="text-[10.5px] text-zinc-400">{fmtDateTime(a.updatedAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg bg-white p-5 shadow-lg">
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

            <div className="mt-4 flex-1 overflow-y-auto">
              {activity.length === 0 ? (
                <p className="text-sm text-zinc-500">No activity logged for this period yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {activity.map((a) => {
                    const style = STATUS_STYLE[a.status];
                    const Icon = style.icon;
                    return (
                      <div key={a.id} className="flex items-start gap-2.5 border-b border-zinc-100 pb-3 last:border-b-0">
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.text}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-900">
                            {PIPELINE_STAGES.find((s) => s.key === a.stage)?.label} —{" "}
                            <span className={style.text}>{style.label.toLowerCase()}</span>
                          </p>
                          {a.note && <p className="mt-0.5 text-xs text-zinc-600">{a.note}</p>}
                          <p className="mt-0.5 text-xs text-zinc-400">
                            {fmtDateTime(a.updatedAt)} · by {a.updatedBy}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
  const [updateStage, setUpdateStage] = useState<string>(PIPELINE_STAGES[0].key);
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

  function openUpdate(pipeline: Pipeline) {
    setUpdatingPipeline(pipeline);
    setUpdateStage(PIPELINE_STAGES[0].key);
    setUpdateStatus("IN_PROGRESS");
    setUpdateNote("");
    setUpdateError("");
  }

  async function handleSaveUpdate() {
    if (!updatingPipeline) return;
    setIsSaving(true);
    setUpdateError("");
    try {
      const response = await fetch(`/api/pipelines/${updatingPipeline.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeKey: period.timeKey,
          stage: updateStage,
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
            Stage-by-stage status for each data pipeline, for the current reporting cycle.
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
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <p className="text-sm font-semibold text-zinc-900">Update status — {updatingPipeline.name}</p>
            <p className="mt-1 text-xs text-zinc-500">For the {period.periodLabel} cycle.</p>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-700">Stage</label>
                <select
                  value={updateStage}
                  onChange={(e) => setUpdateStage(e.target.value)}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                >
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

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
                  placeholder="e.g. Missing July upload for one entity"
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                />
              </div>

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
              <button
                onClick={handleSaveUpdate}
                disabled={isSaving}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
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
