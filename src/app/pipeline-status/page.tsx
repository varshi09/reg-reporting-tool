"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getReportingPeriod } from "@/lib/reportingPeriod";
import { formatDateTime as fmtDT } from "@/lib/formatDateTime";
import type { PipelineStatus } from "@/lib/pipelineStages";
import type { PipelineRunState, GroupRunState } from "@/lib/pipelineBuilder";
import {
  IconCheck,
  IconLoader,
  IconAlertTriangle,
  IconCircleDashed,
  IconX,
  IconDocument,
  IconSearch,
  IconGitBranch,
} from "@/components/icons";

// ─── Color palette mirrors the builder ──────────────────────────────────────

const GROUP_COLORS = [
  { bg: "#E6F1FB", border: "#378ADD", text: "#0C447C", dot: "#185FA5" },
  { bg: "#EEEDFE", border: "#7F77DD", text: "#3C3489", dot: "#534AB7" },
  { bg: "#E1F5EE", border: "#1D9E75", text: "#085041", dot: "#0F6E56" },
  { bg: "#FAECE7", border: "#D85A30", text: "#712B13", dot: "#993C1D" },
  { bg: "#FAEEDA", border: "#EF9F27", text: "#633806", dot: "#854F0B" },
  { bg: "#EAF3DE", border: "#97C459", text: "#27500A", dot: "#3B6D11" },
];

const PIPELINE_AVATAR_COLORS = [
  { bg: "#EEF2FF", text: "#4338CA" },
  { bg: "#F0FDF4", text: "#166534" },
  { bg: "#FFF7ED", text: "#9A3412" },
  { bg: "#FDF4FF", text: "#7E22CE" },
  { bg: "#ECFEFF", text: "#155E75" },
];

function avatarColor(idx: number) {
  return PIPELINE_AVATAR_COLORS[idx % PIPELINE_AVATAR_COLORS.length];
}

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_META: Record<
  PipelineStatus,
  { label: string; bg: string; text: string; borderColor: string; Icon: React.FC<{ className?: string }> }
> = {
  PENDING: { label: "Queued", bg: "#F4F4F5", text: "#71717A", borderColor: "#D4D4D8", Icon: IconCircleDashed },
  IN_PROGRESS: { label: "Running", bg: "#EEF2FF", text: "#4338CA", borderColor: "#818CF8", Icon: IconLoader },
  AWAITING_INPUT: { label: "Awaiting input", bg: "#FFFBEB", text: "#B45309", borderColor: "#FCD34D", Icon: IconAlertTriangle },
  COMPLETED: { label: "Completed", bg: "#F0FDF4", text: "#166534", borderColor: "#86EFAC", Icon: IconCheck },
  FAILED: { label: "Failed", bg: "#FEF2F2", text: "#991B1B", borderColor: "#FCA5A5", Icon: IconX },
};

function StatusBadge({ status }: { status: PipelineStatus }) {
  const m = STATUS_META[status];
  const Icon = m.Icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: m.bg, color: m.text, border: `1px solid ${m.borderColor}` }}
    >
      <Icon className={`h-3 w-3 ${status === "IN_PROGRESS" ? "animate-spin" : ""}`} />
      {m.label}
    </span>
  );
}

// ─── Group stepper ───────────────────────────────────────────────────────────

function GroupStepper({ groups }: { groups: GroupRunState[] }) {
  if (groups.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <IconGitBranch className="h-3.5 w-3.5" />
        No groups configured — set up this pipeline in Pipeline Builder
      </div>
    );
  }

  return (
    <div className="flex items-start overflow-x-auto pb-1">
      {groups.map((gs, idx) => {
        const col = GROUP_COLORS[idx % GROUP_COLORS.length];
        const m = STATUS_META[gs.groupStatus];
        const Icon = m.Icon;
        const completedInGroup = gs.procedures.filter((p) => p.status === "COMPLETED").length;
        return (
          <div key={gs.group.id} className="flex items-start">
            <div className="flex flex-col items-center" style={{ minWidth: 72 }}>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full border-2"
                style={{
                  background: col.bg,
                  borderColor: gs.groupStatus === "PENDING" ? "#D4D4D8" : col.border,
                }}
                title={`${gs.group.name}: ${m.label}`}
              >
                <Icon
                  className={`h-4 w-4 ${gs.groupStatus === "IN_PROGRESS" ? "animate-spin" : ""}`}
                  style={{ color: gs.groupStatus === "PENDING" ? "#A1A1AA" : col.dot }}
                />
              </div>
              <p
                className="mt-1.5 max-w-[72px] text-center text-[10px] font-medium leading-tight"
                style={{ color: gs.groupStatus === "PENDING" ? "#A1A1AA" : col.text }}
              >
                {gs.group.name}
              </p>
              <span className="mt-0.5 text-[9px] text-zinc-400">
                {completedInGroup}/{gs.procedures.length}
              </span>
            </div>
            {idx < groups.length - 1 && (
              <div
                className="mt-[18px] h-0.5 w-8 flex-shrink-0"
                style={{
                  background:
                    gs.groupStatus === "COMPLETED"
                      ? GROUP_COLORS[idx % GROUP_COLORS.length].dot
                      : "#E4E4E7",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Run history modal ───────────────────────────────────────────────────────

type HistoryEntry = {
  id: number;
  procedureName: string;
  packageName: string | null;
  stage: string;
  dependsOnDataset: string | null;
  status: PipelineStatus;
  overrideType: string | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  updatedBy: string;
  updatedAt: string;
};

function LogModal({
  pipelineId,
  pipelineName,
  timeKey,
  onClose,
}: {
  pipelineId: number;
  pipelineName: string;
  timeKey: string;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    fetch(`/api/pipelines/${pipelineId}/procedures/history?timeKey=${timeKey}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []));
  }, [pipelineId, timeKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[85vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Run log — {pipelineName}</p>
            <p className="text-xs text-zinc-500">Period: {timeKey}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">
          {history === null ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-zinc-500">No runs logged for this period.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Procedure</th>
                  <th className="py-2 pr-3 font-medium">Package</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Started</th>
                  <th className="py-2 pr-3 font-medium">Ended</th>
                  <th className="py-2 pr-3 font-medium">Note</th>
                  <th className="py-2 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const m = STATUS_META[h.status];
                  return (
                    <tr key={h.id} className="border-b border-zinc-50 align-top text-zinc-700">
                      <td className="py-2 pr-3 font-medium text-zinc-900">{h.procedureName}</td>
                      <td className="py-2 pr-3 text-zinc-500">{h.packageName ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ background: m.bg, color: m.text }}
                        >
                          {m.label}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-zinc-500">{fmtDT(h.startTime)}</td>
                      <td className="py-2 pr-3 text-zinc-500">{fmtDT(h.endTime)}</td>
                      <td className="max-w-xs py-2 pr-3 text-zinc-600">{h.note ?? "—"}</td>
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
  );
}

// ─── Pipeline card ────────────────────────────────────────────────────────────

function PipelineCard({
  pipeline,
  timeKey,
  idx,
  isAdminUser,
  onRefresh,
}: {
  pipeline: PipelineRunState;
  timeKey: string;
  idx: number;
  isAdminUser: boolean;
  onRefresh: () => void;
}) {
  const [showLog, setShowLog] = useState(false);
  const [running, setRunning] = useState<"next" | "all" | null>(null);
  const [runMsg, setRunMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleRun(mode: "next" | "all") {
    if (running) return;
    setRunning(mode);
    setRunMsg(null);
    try {
      const res = await fetch(`/api/pipeline-status/${pipeline.pipelineId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, timeKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRunMsg({ type: "err", text: data.error ?? "Error running procedures." });
      } else {
        const parts: string[] = [];
        if (data.ran?.length) parts.push(`${data.ran.length} ran`);
        if (data.blocked?.length) parts.push(`${data.blocked.length} blocked`);
        if (data.failed?.length) parts.push(`${data.failed.length} failed`);
        setRunMsg({ type: data.failed?.length ? "err" : "ok", text: parts.join(", ") || "Nothing to run." });
        onRefresh();
      }
    } finally {
      setRunning(null);
      if (msgTimer.current) clearTimeout(msgTimer.current);
      msgTimer.current = setTimeout(() => setRunMsg(null), 5000);
    }
  }

  const pct =
    pipeline.totalGroups > 0
      ? Math.round((pipeline.completedGroups / pipeline.totalGroups) * 100)
      : 0;

  const av = avatarColor(idx);
  const initial = pipeline.pipelineName.charAt(0).toUpperCase();

  const inProgressCount = pipeline.groups
    .flatMap((g) => g.procedures)
    .filter((p) => p.status === "IN_PROGRESS").length;
  const awaitingCount = pipeline.groups
    .flatMap((g) => g.procedures)
    .filter((p) => p.status === "AWAITING_INPUT").length;
  const failedCount = pipeline.groups
    .flatMap((g) => g.procedures)
    .filter((p) => p.status === "FAILED").length;

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
              style={{ background: av.bg, color: av.text }}
            >
              {initial}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">{pipeline.pipelineName}</p>
              <p className="text-xs text-zinc-500">
                {pipeline.totalProcs} procedure{pipeline.totalProcs !== 1 ? "s" : ""} ·{" "}
                {pipeline.totalGroups} group{pipeline.totalGroups !== 1 ? "s" : ""}
              </p>
            </div>
            <StatusBadge status={pipeline.overallStatus} />
          </div>

          <div className="flex items-center gap-2">
            {runMsg && (
              <span
                className={`text-xs font-medium ${runMsg.type === "ok" ? "text-emerald-700" : "text-red-600"}`}
              >
                {runMsg.text}
              </span>
            )}
            <button
              onClick={() => setShowLog(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <IconDocument className="h-3.5 w-3.5" />
              Log
            </button>
            {isAdminUser && pipeline.totalGroups > 0 && (
              <>
                <button
                  onClick={() => handleRun("next")}
                  disabled={running !== null || pipeline.overallStatus === "COMPLETED"}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {running === "next" ? <IconLoader className="h-3.5 w-3.5 animate-spin" /> : null}
                  Run next
                </button>
                <button
                  onClick={() => handleRun("all")}
                  disabled={running !== null || pipeline.overallStatus === "COMPLETED"}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {running === "all" ? <IconLoader className="h-3.5 w-3.5 animate-spin" /> : null}
                  Run all
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {pipeline.totalGroups > 0 && (
          <div className="flex items-center gap-3 px-5 pb-4">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: pipeline.overallStatus === "FAILED" ? "#EF4444" : "#22C55E",
                }}
              />
            </div>
            <span className="shrink-0 text-xs font-medium text-zinc-500">
              {pipeline.completedGroups}/{pipeline.totalGroups} groups
            </span>
          </div>
        )}

        {/* Group stepper */}
        <div className="border-t border-zinc-100 px-5 py-4">
          <GroupStepper groups={pipeline.groups} />
        </div>

        {/* Attention banner */}
        {(awaitingCount > 0 || failedCount > 0) && (
          <div
            className="mx-5 mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            style={{
              background: failedCount > 0 ? "#FEF2F2" : "#FFFBEB",
              color: failedCount > 0 ? "#991B1B" : "#92400E",
            }}
          >
            <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {failedCount > 0
              ? `${failedCount} procedure${failedCount !== 1 ? "s" : ""} failed`
              : `${awaitingCount} procedure${awaitingCount !== 1 ? "s" : ""} awaiting upload approval`}
            {inProgressCount > 0 && ` · ${inProgressCount} running`}
          </div>
        )}
      </div>

      {showLog && (
        <LogModal
          pipelineId={pipeline.pipelineId}
          pipelineName={pipeline.pipelineName}
          timeKey={timeKey}
          onClose={() => setShowLog(false)}
        />
      )}
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PipelineStatusPage() {
  const { checked, username } = useRequireAuth();
  const [pipelines, setPipelines] = useState<PipelineRunState[]>([]);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | PipelineStatus>("all");

  const period = getReportingPeriod();

  const load = useCallback(async () => {
    setLoading(true);
    const [statusRes, usersRes, meRes] = await Promise.all([
      fetch(`/api/pipeline-status?timeKey=${period.timeKey}`),
      fetch("/api/users"),
      fetch("/api/auth/me"),
    ]);
    if (statusRes.ok) {
      const data = await statusRes.json();
      setPipelines(data.pipelines ?? []);
    }
    if (usersRes.ok && meRes.ok) {
      const users = await usersRes.json();
      const me = await meRes.json();
      const match = users.users?.find(
        (u: { username: string; isAdmin: boolean }) => u.username === me.username
      );
      setIsAdminUser(match?.isAdmin ?? false);
    }
    setLoading(false);
  }, [period.timeKey]);

  useEffect(() => {
    if (!checked) return;
    load();
  }, [checked, load]);

  if (!checked) return null;

  // Aggregate stats across all pipelines
  const allProcs = pipelines.flatMap((p) => p.groups.flatMap((g) => g.procedures));
  const stats = {
    total: allProcs.length,
    completed: allProcs.filter((p) => p.status === "COMPLETED").length,
    inProgress: allProcs.filter((p) => p.status === "IN_PROGRESS").length,
    awaiting: allProcs.filter((p) => p.status === "AWAITING_INPUT").length,
    failed: allProcs.filter((p) => p.status === "FAILED").length,
  };

  // Filter
  const visible = pipelines.filter((p) => {
    const matchSearch = p.pipelineName.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === "all" ||
      p.overallStatus === filterStatus ||
      (filterStatus === "PENDING" && p.totalGroups === 0);
    return matchSearch && matchStatus;
  });

  const statCards = [
    { label: "Total procedures", value: stats.total, color: "#4F46E5", bg: "#EEF2FF" },
    { label: "Completed", value: stats.completed, color: "#16A34A", bg: "#F0FDF4" },
    { label: "In progress", value: stats.inProgress, color: "#7C3AED", bg: "#F5F3FF" },
    { label: "Awaiting input", value: stats.awaiting, color: "#D97706", bg: "#FFFBEB" },
    { label: "Failed", value: stats.failed, color: "#DC2626", bg: "#FEF2F2" },
  ];

  return (
    <AppShell active="/pipeline-status" title="Pipeline Status">
      <div className="flex max-w-5xl flex-col gap-5">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">
              Procedure-by-procedure status for each pipeline · current reporting cycle
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            Period: {period.periodLabel}
          </span>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {statCards.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-2xl font-bold" style={{ color: c.color }}>
                {c.value}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Search + filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pipelines…"
              className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div className="flex rounded-lg border border-zinc-200 bg-white text-xs font-medium">
            {(
              [
                { key: "all", label: "All" },
                { key: "COMPLETED", label: "Completed" },
                { key: "IN_PROGRESS", label: "Running" },
                { key: "AWAITING_INPUT", label: "Awaiting" },
                { key: "FAILED", label: "Failed" },
              ] as { key: "all" | PipelineStatus; label: string }[]
            ).map((f, i, arr) => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`px-3 py-1.5 transition-colors ${
                  i === 0 ? "rounded-l-lg" : ""
                } ${i === arr.length - 1 ? "rounded-r-lg" : ""} ${
                  filterStatus === f.key
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pipeline list */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <IconLoader className="h-4 w-4 animate-spin" />
            Loading pipelines…
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
            <IconGitBranch className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-500">
              {search || filterStatus !== "all" ? "No pipelines match your filters." : "No pipelines yet."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {visible.map((p, idx) => (
              <PipelineCard
                key={p.pipelineId}
                pipeline={p}
                timeKey={period.timeKey}
                idx={idx}
                isAdminUser={isAdminUser}
                onRefresh={load}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-zinc-400">Signed in as {username}</p>
      </div>
    </AppShell>
  );
}
