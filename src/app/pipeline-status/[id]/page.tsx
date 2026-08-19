"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
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
  IconChevronLeft,
  IconDots,
  IconPencil,
  IconGitBranch,
  IconCalendar,
} from "@/components/icons";

// ─── Color palette: mirrors the builder canvas exactly ──────────────────────

const GROUP_COLORS = [
  { bg: "#E6F1FB", border: "#378ADD", text: "#0C447C", dot: "#185FA5" },
  { bg: "#EEEDFE", border: "#7F77DD", text: "#3C3489", dot: "#534AB7" },
  { bg: "#E1F5EE", border: "#1D9E75", text: "#085041", dot: "#0F6E56" },
  { bg: "#FAECE7", border: "#D85A30", text: "#712B13", dot: "#993C1D" },
  { bg: "#FAEEDA", border: "#EF9F27", text: "#633806", dot: "#854F0B" },
  { bg: "#EAF3DE", border: "#97C459", text: "#27500A", dot: "#3B6D11" },
];

const STATUS_META: Record<
  PipelineStatus,
  { label: string; bg: string; text: string; borderColor: string; Icon: React.FC<{ className?: string }> }
> = {
  PENDING: { label: "Queued", bg: "#F4F4F5", text: "#71717A", borderColor: "#D4D4D8", Icon: IconCircleDashed },
  IN_PROGRESS: { label: "Running", bg: "#EEF2FF", text: "#4338CA", borderColor: "#818CF8", Icon: IconLoader },
  AWAITING_INPUT: { label: "Attention", bg: "#FFFBEB", text: "#B45309", borderColor: "#FCD34D", Icon: IconAlertTriangle },
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

function relativeMinutes(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

// ─── Group stepper (enhanced with per-node timing + action-required detail) ─

function GroupStepper({ groups, onExpand }: { groups: GroupRunState[]; onExpand: (groupId: number) => void }) {
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
        const blocked = gs.procedures.find((p) => p.isBlocked);
        const running = gs.procedures.find((p) => p.status === "IN_PROGRESS");
        const latestCompleted = [...gs.procedures]
          .filter((p) => p.status === "COMPLETED" && p.endTime)
          .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime())[0];

        let detail: string | null = null;
        if (gs.groupStatus === "PENDING" && idx > 0) detail = "Waiting on previous group";
        else if (gs.groupStatus === "IN_PROGRESS" && running) {
          const mins = relativeMinutes(running.startTime);
          detail = mins ? `Running · ${mins}` : "Running";
        } else if (gs.groupStatus === "COMPLETED" && latestCompleted) {
          detail = `Done ${fmtDT(latestCompleted.endTime)}`;
        }

        return (
          <div key={gs.group.id} className="flex items-start">
            <div
              className="flex cursor-pointer flex-col items-center rounded-md py-1 transition-colors hover:bg-zinc-50"
              style={{ minWidth: 96 }}
              onDoubleClick={() => onExpand(gs.group.id)}
              title="Double-click to view procedures"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full border-2"
                style={{ background: col.bg, borderColor: gs.groupStatus === "PENDING" ? "#D4D4D8" : col.border }}
              >
                <Icon
                  className={`h-4 w-4 ${gs.groupStatus === "IN_PROGRESS" ? "animate-spin" : ""}`}
                  style={{ color: gs.groupStatus === "PENDING" ? "#A1A1AA" : col.dot }}
                />
              </div>
              <p
                className="mt-1.5 max-w-[92px] text-center text-[10px] font-medium leading-tight"
                style={{ color: gs.groupStatus === "PENDING" ? "#A1A1AA" : col.text }}
              >
                {gs.group.name}
              </p>
              <span className="mt-1 rounded-full px-2 py-0.5 text-[9px] font-medium" style={{ background: m.bg, color: m.text }}>
                {m.label}
              </span>
              {detail && <span className="mt-1 text-[9px] text-zinc-400">{detail}</span>}
              <span className="mt-0.5 text-[9px] text-zinc-400">
                {completedInGroup}/{gs.procedures.length} procedures
              </span>
              {blocked && (
                <div
                  className="mt-1.5 max-w-[130px] rounded-md border px-2 py-1 text-[9px] leading-snug"
                  style={{ background: "#FFFBEB", borderColor: "#FCD34D", color: "#92400E" }}
                >
                  <span className="font-semibold">Action required</span>
                  <br />
                  {blocked.blockedReason}
                </div>
              )}
            </div>
            {idx < groups.length - 1 && (
              <div
                className="mt-[18px] h-0.5 w-8 flex-shrink-0"
                style={{ background: gs.groupStatus === "COMPLETED" ? col.dot : "#E4E4E7" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Run history ─────────────────────────────────────────────────────────────

type HistoryEntry = {
  id: number;
  procedureName: string;
  packageName: string | null;
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
          <button onClick={onClose} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
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
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: m.bg, color: m.text }}>
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

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-07-31" -> "20260731" */
function isoToTimeKey(iso: string): string {
  return iso.replace(/-/g, "");
}

/** "20260731" -> "2026-07-31" */
function timeKeyToIso(timeKey: string): string {
  return `${timeKey.slice(0, 4)}-${timeKey.slice(4, 6)}-${timeKey.slice(6, 8)}`;
}

/** "2026-07-31" -> "31 Jul 2026" */
function formatPickedDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${SHORT_MONTH_NAMES[month - 1]} ${year}`;
}

function activityPhrase(h: HistoryEntry): string {
  if (h.status === "COMPLETED") return `${h.procedureName} completed`;
  if (h.status === "FAILED") return `${h.procedureName} failed`;
  if (h.status === "IN_PROGRESS") return `${h.procedureName} started`;
  return `${h.procedureName} updated`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

type DetailState = PipelineRunState & {
  successRate: number | null;
  sparkline: number[];
  avgDurationMin: number | null;
  lastActivityAt: string | null;
};

export default function PipelineDetailPage() {
  const { username } = useRequireAuth();
  const router = useRouter();
  const params = useParams();
  const pipelineId = Number(params.id);

  const [state, setState] = useState<DetailState | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [running, setRunning] = useState<"next" | "all" | null>(null);
  const [runMsg, setRunMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [overridingProcId, setOverridingProcId] = useState<number | null>(null);
  const [overrideNote, setOverrideNote] = useState("");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultTimeKey = getReportingPeriod().timeKey;
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const fromUrl = new URLSearchParams(window.location.search).get("date");
      if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) return fromUrl;
    }
    return timeKeyToIso(defaultTimeKey);
  });
  const timeKey = isoToTimeKey(selectedDate);
  const isCustomDate = timeKey !== defaultTimeKey;

  function handleDateChange(iso: string) {
    if (!iso) return;
    setSelectedDate(iso);
    const url = iso === timeKeyToIso(defaultTimeKey)
      ? `/pipeline-status/${pipelineId}`
      : `/pipeline-status/${pipelineId}?date=${iso}`;
    router.replace(url, { scroll: false });
  }

  const load = useCallback(async () => {
    const [stateRes, historyRes, usersRes, meRes] = await Promise.all([
      fetch(`/api/pipeline-status/${pipelineId}?timeKey=${timeKey}`),
      fetch(`/api/pipelines/${pipelineId}/procedures/history?timeKey=${timeKey}`),
      fetch("/api/users"),
      fetch("/api/auth/me"),
    ]);
    if (stateRes.ok) setState(await stateRes.json());
    if (historyRes.ok) {
      const data = await historyRes.json();
      setHistory(data.history ?? []);
    }
    if (usersRes.ok && meRes.ok) {
      const users = await usersRes.json();
      const me = await meRes.json();
      const match = users.users?.find((u: { username: string; isAdmin: boolean }) => u.username === me.username);
      setIsAdminUser(match?.isAdmin ?? false);
    }
    setLoading(false);
    setLastUpdated(new Date());
  }, [pipelineId, timeKey]);

  useEffect(() => {
    if (!Number.isFinite(pipelineId)) return;
    load();
  }, [pipelineId, load]);

  // Auto-refresh, matching the reference's "Auto-refresh is on" footer note -
  // also what keeps a running group's elapsed-time display current without
  // a separate ticking clock.
  useEffect(() => {
    if (!Number.isFinite(pipelineId)) return;
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [pipelineId, load]);

  async function handleRun(mode: "next" | "all") {
    if (running) return;
    setRunning(mode);
    setRunMsg(null);
    try {
      const res = await fetch(`/api/pipeline-status/${pipelineId}/run`, {
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
        load();
      }
    } finally {
      setRunning(null);
      if (msgTimer.current) clearTimeout(msgTimer.current);
      msgTimer.current = setTimeout(() => setRunMsg(null), 5000);
    }
  }

  async function handleOverride(procedureId: number) {
    if (!overrideNote.trim() || overrideSubmitting) return;
    setOverrideSubmitting(true);
    try {
      const res = await fetch(`/api/pipeline-status/${pipelineId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedureId, timeKey, note: overrideNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRunMsg({ type: "err", text: data.error ?? "Could not proceed without upload." });
      } else {
        setRunMsg({ type: "ok", text: "Marked as proceeded without upload." });
        setOverridingProcId(null);
        setOverrideNote("");
        load();
      }
    } finally {
      setOverrideSubmitting(false);
      if (msgTimer.current) clearTimeout(msgTimer.current);
      msgTimer.current = setTimeout(() => setRunMsg(null), 5000);
    }
  }

  if (!username) return null;

  if (loading || !state) {
    return (
      <AppShell active="/pipeline-status" title="Pipeline Status">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <IconLoader className="h-4 w-4 animate-spin" />
          Loading pipeline…
        </div>
      </AppShell>
    );
  }

  const pct = state.totalGroups > 0 ? Math.round((state.completedGroups / state.totalGroups) * 100) : 0;
  const allProcs = state.groups.flatMap((g) => g.procedures);
  const inProgressCount = allProcs.filter((p) => p.status === "IN_PROGRESS").length;
  const attentionCount = allProcs.filter((p) => p.status === "AWAITING_INPUT" || p.status === "FAILED").length;
  const queuedCount = allProcs.filter((p) => p.status === "PENDING").length;
  const flagged = allProcs.find((p) => p.status === "AWAITING_INPUT" || p.status === "FAILED");
  const currentGroup = state.groups.find((g) => g.groupStatus !== "COMPLETED") ?? state.groups[state.groups.length - 1];
  const currentGroupRunning = currentGroup?.procedures.find((p) => p.status === "IN_PROGRESS");
  const currentGroupStarted = currentGroupRunning?.startTime ?? null;

  return (
    <AppShell active="/pipeline-status" title="Pipeline Status">
      <div className="flex max-w-5xl flex-col gap-5">
        <button
          onClick={() => router.push("/pipeline-status")}
          className="flex w-fit items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
        >
          <IconChevronLeft className="h-3.5 w-3.5" />
          Pipeline Status
        </button>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
              <h1 className="text-xl font-semibold text-zinc-900">{state.pipelineName}</h1>
              <StatusBadge status={state.overallStatus} />
              {!state.isActive && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">Inactive</span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-zinc-500">
              {formatPickedDate(selectedDate)}{isCustomDate ? " (custom date)" : " cycle"} · {state.completedGroups} of {state.totalGroups} groups complete
            </p>
          </div>

          <div className="flex items-center gap-2">
            {runMsg && (
              <span className={`text-xs font-medium ${runMsg.type === "ok" ? "text-emerald-700" : "text-red-600"}`}>
                {runMsg.text}
              </span>
            )}
            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5">
              <IconCalendar className="h-3.5 w-3.5 text-zinc-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-transparent text-xs font-medium text-zinc-700 outline-none"
              />
              {isCustomDate && (
                <button
                  onClick={() => handleDateChange(timeKeyToIso(defaultTimeKey))}
                  className="ml-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-50"
                  title="Reset to current reporting period"
                >
                  Today's period
                </button>
              )}
            </div>
            <button
              onClick={() => setShowLog(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <IconDocument className="h-3.5 w-3.5" />
              Log
            </button>
            {isAdminUser && state.totalGroups > 0 && (
              <>
                <button
                  onClick={() => handleRun("next")}
                  disabled={running !== null || state.overallStatus === "COMPLETED"}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {running === "next" ? <IconLoader className="h-3.5 w-3.5 animate-spin" /> : null}
                  Run next
                </button>
                <button
                  onClick={() => handleRun("all")}
                  disabled={running !== null || state.overallStatus === "COMPLETED"}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {running === "all" ? <IconLoader className="h-3.5 w-3.5 animate-spin" /> : null}
                  Run all
                </button>
              </>
            )}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 hover:bg-zinc-50"
                aria-label="Pipeline options"
              >
                <IconDots className="h-3.5 w-3.5" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                    <button
                      onClick={() => router.push(`/pipeline-builder/${pipelineId}`)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50"
                    >
                      <IconPencil className="h-3.5 w-3.5" />
                      Edit in Pipeline Builder
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {state.totalGroups > 0 && (
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: state.overallStatus === "FAILED" ? "#EF4444" : "#22C55E" }}
              />
            </div>
            <span className="shrink-0 text-xs font-medium text-emerald-600">{pct}% complete</span>
          </div>
        )}

        {/* Group stepper */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <GroupStepper groups={state.groups} onExpand={setExpandedGroupId} />
        </div>

        {/* Attention banner */}
        {flagged && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm"
            style={{
              background: flagged.status === "FAILED" ? "#FEF2F2" : "#FFFBEB",
              color: flagged.status === "FAILED" ? "#991B1B" : "#92400E",
            }}
          >
            <span className="flex items-center gap-2">
              <IconAlertTriangle className="h-4 w-4 shrink-0" />
              {flagged.proc.procedureName} needs attention
              {flagged.isBlocked ? ` — ${flagged.blockedReason}` : flagged.note ? ` — ${flagged.note}` : ""}
            </span>
            <button
              onClick={() => setShowLog(true)}
              className="flex items-center gap-1.5 rounded-lg border border-current px-2.5 py-1 text-xs font-medium hover:opacity-80"
            >
              <IconDocument className="h-3.5 w-3.5" />
              View log
            </button>
          </div>
        )}

        {/* Three-column panels */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Cycle summary */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-zinc-900">Cycle summary</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-zinc-50 p-2.5 text-center">
                <p className="text-lg font-semibold text-zinc-900">{state.totalGroups}</p>
                <p className="text-[10px] text-zinc-500">Total groups</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-2.5 text-center">
                <p className="text-lg font-semibold text-emerald-600">{state.completedGroups}</p>
                <p className="text-[10px] text-zinc-500">Completed</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-2.5 text-center">
                <p className="text-lg font-semibold text-amber-600">{attentionCount}</p>
                <p className="text-[10px] text-zinc-500">Attention</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-2.5 text-center">
                <p className="text-lg font-semibold text-zinc-400">{queuedCount}</p>
                <p className="text-[10px] text-zinc-500">Queued</p>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
              <IconCalendar className="h-3.5 w-3.5" />
              {isCustomDate ? "Viewing date" : "Cycle period"}: {formatPickedDate(selectedDate)}
            </p>
          </div>

          {/* Group details */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-zinc-900">Group details</p>
            {currentGroup ? (
              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Current group</span>
                  <span className="font-medium text-zinc-900">{currentGroup.group.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Status</span>
                  <StatusBadge status={currentGroup.groupStatus} />
                </div>
                {currentGroupStarted && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Started</span>
                    <span className="text-zinc-900">{fmtDT(currentGroupStarted)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-500">Progress</span>
                  <span className="text-zinc-900">
                    {currentGroup.procedures.filter((p) => p.status === "COMPLETED").length}/{currentGroup.procedures.length} procedures
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No groups configured yet.</p>
            )}
          </div>

          {/* Recent activity */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-zinc-900">Recent activity</p>
            {history.length === 0 ? (
              <p className="text-xs text-zinc-500">No activity yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {history.slice(0, 6).map((h) => {
                  const m = STATUS_META[h.status];
                  const Icon = m.Icon;
                  return (
                    <div key={h.id} className="flex items-start gap-2">
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={{ background: m.bg, color: m.text }}
                      >
                        <Icon className={`h-3 w-3 ${h.status === "IN_PROGRESS" ? "animate-spin" : ""}`} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-zinc-800">{activityPhrase(h)}</p>
                        <p className="text-[10px] text-zinc-400">
                          {fmtDT(h.updatedAt)} · by {h.updatedBy}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-3 text-xs text-zinc-400">
          <span>Last updated: {lastUpdated ? fmtDT(lastUpdated.toISOString()) : "—"}</span>
          <span>Auto-refresh is on</span>
        </div>
      </div>

      {showLog && (
        <LogModal
          pipelineId={state.pipelineId}
          pipelineName={state.pipelineName}
          timeKey={timeKey}
          onClose={() => setShowLog(false)}
        />
      )}

      {expandedGroupId !== null && (() => {
        const gIdx = state.groups.findIndex((g) => g.group.id === expandedGroupId);
        const gs = state.groups[gIdx];
        if (!gs) return null;
        const col = GROUP_COLORS[gIdx % GROUP_COLORS.length];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{gs.group.name}</p>
                  <p className="text-xs text-zinc-500">
                    {gs.procedures.length} procedure{gs.procedures.length !== 1 ? "s" : ""} · {gs.group.execMode === "PARALLEL" ? "Parallel" : "Sequential"}
                  </p>
                </div>
                <button
                  onClick={() => setExpandedGroupId(null)}
                  className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
                {gs.procedures.length === 0 ? (
                  <p className="text-xs text-zinc-500">This group has no procedures yet.</p>
                ) : (
                  gs.procedures.map((p, pi) => {
                    const m = STATUS_META[p.status];
                    const Icon = m.Icon;
                    return (
                      <div
                        key={p.proc.pipelineProcedureId}
                        className="rounded-lg border px-3 py-2.5"
                        style={{ borderColor: p.isBlocked ? "#FCD34D" : "#E4E4E7", background: p.isBlocked ? "#FFFBEB" : "#fff" }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="w-4 shrink-0 text-center text-[10px] text-zinc-400">{pi + 1}</span>
                            <span className="truncate text-xs font-medium text-zinc-900">{p.proc.procedureName}</span>
                          </span>
                          <span
                            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ background: m.bg, color: m.text }}
                          >
                            <Icon className={`h-3 w-3 ${p.status === "IN_PROGRESS" ? "animate-spin" : ""}`} />
                            {m.label}
                          </span>
                        </div>
                        {p.proc.packageName && (
                          <p className="ml-6 mt-0.5 text-[10px] text-zinc-400">{p.proc.packageName}</p>
                        )}
                        {p.proc.dependsOnDataset && (
                          <p className="ml-6 mt-1 text-[10px] text-zinc-500">depends on {p.proc.dependsOnDataset}</p>
                        )}
                        {p.overrideType && (
                          <p className="ml-6 mt-1 text-[10px] font-medium text-amber-700">
                            Proceeded without upload{p.updatedBy ? ` · by ${p.updatedBy}` : ""}
                            {p.note ? ` — ${p.note}` : ""}
                          </p>
                        )}
                        {p.isBlocked && p.blockedReason && (
                          <div className="ml-6 mt-1">
                            <p className="text-[10px] text-amber-700">{p.blockedReason}</p>
                            {overridingProcId === p.proc.procedureId ? (
                              <div className="mt-1.5 flex flex-col gap-1.5">
                                <textarea
                                  value={overrideNote}
                                  onChange={(e) => setOverrideNote(e.target.value)}
                                  placeholder="Reason for proceeding without the upload…"
                                  rows={2}
                                  className="w-full rounded border border-amber-300 bg-white px-2 py-1 text-[10px] text-zinc-700 outline-none"
                                />
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleOverride(p.proc.procedureId)}
                                    disabled={!overrideNote.trim() || overrideSubmitting}
                                    className="rounded bg-amber-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {overrideSubmitting ? "Submitting…" : "Confirm & proceed"}
                                  </button>
                                  <button
                                    onClick={() => { setOverridingProcId(null); setOverrideNote(""); }}
                                    className="rounded border border-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setOverridingProcId(p.proc.procedureId); setOverrideNote(""); }}
                                className="mt-1 rounded border border-amber-300 px-2 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100"
                              >
                                Proceed without upload
                              </button>
                            )}
                          </div>
                        )}
                        {(p.startTime || p.endTime) && (
                          <p className="ml-6 mt-1 text-[10px] text-zinc-400">
                            {p.startTime && `Started ${fmtDT(p.startTime)}`}
                            {p.startTime && p.endTime && " · "}
                            {p.endTime && `Ended ${fmtDT(p.endTime)}`}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-zinc-400">
                <span className="h-2 w-2 rounded-full" style={{ background: col.dot }} />
                Matches the {gs.group.name} node's color in the stepper above
              </div>
            </div>
          </div>
        );
      })()}
    </AppShell>
  );
}
