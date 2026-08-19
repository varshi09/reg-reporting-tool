"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getReportingPeriod } from "@/lib/reportingPeriod";
import type { PipelineStatus } from "@/lib/pipelineStages";
import type { PipelineRunState } from "@/lib/pipelineBuilder";
import {
  IconCheck,
  IconLoader,
  IconAlertTriangle,
  IconCircleDashed,
  IconX,
  IconSearch,
  IconGitBranch,
  IconDots,
  IconPencil,
  IconArchive,
  IconTrash,
} from "@/components/icons";

// ─── Color palette ───────────────────────────────────────────────────────────

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

const STATUS_ICON: Record<PipelineStatus, React.FC<{ className?: string }>> = {
  PENDING: IconCircleDashed,
  IN_PROGRESS: IconLoader,
  AWAITING_INPUT: IconAlertTriangle,
  COMPLETED: IconCheck,
  FAILED: IconX,
};

type RowState = PipelineRunState & {
  sparkline: number[];
  avgDurationMin: number | null;
  lastActivityAt: string | null;
};

type RowStatus = "inactive" | "issue" | "draft" | "running" | "active";

function rowStatus(p: RowState): RowStatus {
  if (!p.isActive) return "inactive";
  const allProcs = p.groups.flatMap((g) => g.procedures);
  if (allProcs.some((pr) => pr.status === "FAILED" || pr.status === "AWAITING_INPUT")) return "issue";
  if (p.totalProcs === 0) return "draft";
  if (allProcs.some((pr) => pr.status === "IN_PROGRESS")) return "running";
  return "active";
}

const ROW_STATUS_META: Record<RowStatus, { label: string; bg: string; text: string }> = {
  inactive: { label: "Inactive", bg: "#F4F4F5", text: "#71717A" },
  issue: { label: "Issue", bg: "#FFF7ED", text: "#9A3412" },
  draft: { label: "Draft", bg: "#EEF2FF", text: "#4338CA" },
  running: { label: "Running", bg: "#EEF2FF", text: "#4338CA" },
  active: { label: "Active", bg: "#F0FDF4", text: "#166534" },
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "No runs yet";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return (
      <svg width="70" height="24" viewBox="0 0 70 24" aria-hidden="true">
        <line x1="0" y1="12" x2="70" y2="12" stroke="#E4E4E7" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    );
  }
  const stepX = 70 / (points.length - 1);
  const coords = points.map((v, i) => `${i * stepX},${v ? 6 : 18}`).join(" ");
  const hasFailure = points.some((v) => v === 0);
  return (
    <svg width="70" height="24" viewBox="0 0 70 24" aria-hidden="true">
      <polyline points={coords} fill="none" stroke={hasFailure ? "#BA7517" : "#639922"} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function PipelineRow({
  pipeline,
  idx,
  onRename,
  onArchive,
  onReactivate,
  onDelete,
}: {
  pipeline: RowState;
  idx: number;
  onRename: (p: RowState) => void;
  onArchive: (p: RowState) => void;
  onReactivate: (p: RowState) => void;
  onDelete: (p: RowState) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const av = avatarColor(idx);
  const initial = pipeline.pipelineName.charAt(0).toUpperCase();
  const status = rowStatus(pipeline);
  const meta = ROW_STATUS_META[status];
  const StatusIcon = status === "running" ? IconLoader : status === "issue" ? IconAlertTriangle : null;

  return (
    <div
      onClick={() => router.push(`/pipeline-status/${pipeline.pipelineId}`)}
      className={`flex cursor-pointer items-center gap-4 border-b border-zinc-100 px-5 py-4 last:border-b-0 hover:bg-zinc-50 ${
        !pipeline.isActive ? "opacity-60" : ""
      }`}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
        style={{ background: av.bg, color: av.text }}
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-zinc-900">{pipeline.pipelineName}</p>
          {status === "issue" && <IconAlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
        </div>
        <p className="mt-0.5 text-xs text-zinc-400">
          Created by {pipeline.createdBy} · Last run {timeAgo(pipeline.lastActivityAt)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
            {pipeline.totalGroups} group{pipeline.totalGroups !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
            {pipeline.totalProcs} proc{pipeline.totalProcs !== 1 ? "s" : ""}
          </span>
          {pipeline.avgDurationMin !== null && (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
              ~{pipeline.avgDurationMin} min
            </span>
          )}
        </div>
      </div>

      <span
        className="hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex"
        style={{ background: meta.bg, color: meta.text }}
      >
        {StatusIcon && <StatusIcon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />}
        {meta.label}
      </span>

      <div className="hidden shrink-0 md:block">
        <Sparkline points={pipeline.sparkline} />
      </div>

      <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600"
          aria-label="Pipeline options"
        >
          <IconDots className="h-4 w-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
              <button
                onClick={() => { setMenuOpen(false); onRename(pipeline); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50"
              >
                <IconPencil className="h-3.5 w-3.5" />
                Rename
              </button>
              {pipeline.isActive ? (
                <button
                  onClick={() => { setMenuOpen(false); onArchive(pipeline); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  <IconArchive className="h-3.5 w-3.5" />
                  Mark inactive
                </button>
              ) : (
                <button
                  onClick={() => { setMenuOpen(false); onReactivate(pipeline); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-emerald-700 hover:bg-emerald-50"
                >
                  <IconCheck className="h-3.5 w-3.5" />
                  Reactivate
                </button>
              )}
              <button
                onClick={() => { setMenuOpen(false); onDelete(pipeline); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
              >
                <IconTrash className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PipelineStatusPage() {
  const { checked, username } = useRequireAuth();
  const [pipelines, setPipelines] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | RowStatus>("all");

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  const period = getReportingPeriod();

  const load = useCallback(async () => {
    const res = await fetch(`/api/pipeline-status?timeKey=${period.timeKey}`);
    if (res.ok) {
      const data = await res.json();
      setPipelines(data.pipelines ?? []);
    }
    setLoading(false);
  }, [period.timeKey]);

  useEffect(() => {
    if (!checked) return;
    load();
  }, [checked, load]);

  // Background poll so statuses update without a manual page refresh. Never
  // flips `loading` back to true - that would blank the whole list on every
  // tick, so only the very first load (loading's initial state) shows the
  // spinner; refreshes after that just swap the row data in silently.
  useEffect(() => {
    if (!checked) return;
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [checked, load]);

  if (!checked) return null;

  async function handleArchive(p: RowState) {
    if (!window.confirm(`Mark "${p.pipelineName}" inactive? It'll be hidden from active monitoring, but nothing is deleted.`)) return;
    await fetch(`/api/pipelines/${p.pipelineId}?mode=archive`, { method: "DELETE" });
    load();
  }

  async function handleReactivate(p: RowState) {
    await fetch(`/api/pipelines/${p.pipelineId}?mode=reactivate`, { method: "PATCH" });
    load();
  }

  async function handleDelete(p: RowState) {
    if (
      !window.confirm(
        `Permanently delete "${p.pipelineName}"? This removes its groups, procedures, and ALL run history. This cannot be undone.`
      )
    )
      return;
    await fetch(`/api/pipelines/${p.pipelineId}?mode=delete`, { method: "DELETE" });
    load();
  }

  function openRename(p: RowState) {
    setRenamingId(p.pipelineId);
    setRenameValue(p.pipelineName);
    setRenameError(null);
  }

  async function handleRenameSave(p: RowState) {
    const name = renameValue.trim();
    if (!name || name === p.pipelineName) {
      setRenamingId(null);
      return;
    }
    setRenameError(null);
    const res = await fetch(`/api/pipelines/${p.pipelineId}?mode=rename`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setRenameError(data.error ?? "Couldn't rename.");
      return;
    }
    setRenamingId(null);
    load();
  }

  const activePipelines = pipelines.filter((p) => p.isActive);
  const stats = {
    total: pipelines.length,
    active: activePipelines.length,
    inProgress: activePipelines.filter((p) => rowStatus(p) === "running").length,
    withIssues: activePipelines.filter((p) => rowStatus(p) === "issue").length,
  };

  const visible = pipelines.filter((p) => {
    const matchSearch = p.pipelineName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || rowStatus(p) === filterStatus;
    return matchSearch && matchStatus;
  });

  const statCards = [
    { label: "Total pipelines", value: stats.total, color: "#4F46E5" },
    { label: "Active pipelines", value: stats.active, color: "#16A34A" },
    { label: "In progress", value: stats.inProgress, color: "#4338CA" },
    { label: "With issues", value: stats.withIssues, color: "#D97706" },
  ];

  return (
    <AppShell active="/pipeline-status" title="Pipeline Status">
      <div className="flex max-w-5xl flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm text-zinc-500">Live status for every configured pipeline · auto-refreshes every 20s</p>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            Period: {period.periodLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((c) => (
            <div key={c.label} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-2xl font-bold" style={{ color: c.color }}>
                {c.value}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">{c.label}</p>
            </div>
          ))}
        </div>

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
          <div className="flex flex-wrap rounded-lg border border-zinc-200 bg-white text-xs font-medium">
            {(
              [
                { key: "all", label: "All" },
                { key: "active", label: "Active" },
                { key: "running", label: "Running" },
                { key: "issue", label: "Issue" },
                { key: "draft", label: "Draft" },
                { key: "inactive", label: "Inactive" },
              ] as { key: "all" | RowStatus; label: string }[]
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`px-3 py-1.5 first:rounded-l-lg last:rounded-r-lg transition-colors ${
                  filterStatus === f.key ? "bg-indigo-600 text-white" : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

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
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            {visible.map((p, idx) =>
              renamingId === p.pipelineId ? (
                <div key={p.pipelineId} className="flex items-center gap-2 border-b border-zinc-100 px-5 py-4 last:border-b-0">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRenameSave(p)}
                    autoFocus
                    className="flex-1 rounded-md border border-indigo-300 px-2 py-1 text-sm font-semibold text-zinc-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                  />
                  <button
                    onClick={() => handleRenameSave(p)}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setRenamingId(null); setRenameError(null); }}
                    className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  {renameError && <p className="text-xs text-red-600">{renameError}</p>}
                </div>
              ) : (
                <PipelineRow
                  key={p.pipelineId}
                  pipeline={p}
                  idx={idx}
                  onRename={openRename}
                  onArchive={handleArchive}
                  onReactivate={handleReactivate}
                  onDelete={handleDelete}
                />
              )
            )}
          </div>
        )}

        <p className="text-xs text-zinc-400">Signed in as {username}</p>
      </div>
    </AppShell>
  );
}
