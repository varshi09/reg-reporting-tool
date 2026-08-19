"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getReportingPeriod } from "@/lib/reportingPeriod";
import {
  IconGitBranch,
  IconPlus,
  IconPencil,
  IconSearch,
  IconLoader,
  IconAlertTriangle,
  IconDots,
  IconArchive,
  IconTrash,
  IconCheck,
} from "@/components/icons";
import type { Pipeline } from "@/lib/pipelines";

const AVATAR_COLORS = [
  { bg: "#EEF2FF", text: "#4338CA" },
  { bg: "#F0FDF4", text: "#166534" },
  { bg: "#FFF7ED", text: "#9A3412" },
  { bg: "#FDF4FF", text: "#7E22CE" },
  { bg: "#ECFEFF", text: "#155E75" },
  { bg: "#FFF1F2", text: "#9F1239" },
];

function avatarCol(idx: number) {
  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}

export default function PipelineBuilderListPage() {
  const { username } = useRequireAuth();
  const router = useRouter();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const period = getReportingPeriod();

  function load() {
    setLoading(true);
    fetch(`/api/pipelines?timeKey=${period.timeKey}`)
      .then((r) => r.json())
      .then((data) => {
        setPipelines(data.pipelines ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create pipeline.");
      setCreating(false);
      return;
    }
    router.push(`/pipeline-builder/${data.id}`);
  }

  async function handleArchive(p: Pipeline) {
    setMenuOpenId(null);
    if (!window.confirm(`Mark "${p.name}" inactive? It'll be hidden from the builder and status page. Its groups, procedures, and run history are kept — nothing is deleted.`)) return;
    await fetch(`/api/pipelines/${p.id}?mode=archive`, { method: "DELETE" });
    load();
  }

  async function handleDelete(p: Pipeline) {
    setMenuOpenId(null);
    if (!window.confirm(`Permanently delete "${p.name}"? This removes its groups, procedures, and ALL run history. This cannot be undone.`)) return;
    await fetch(`/api/pipelines/${p.id}?mode=delete`, { method: "DELETE" });
    load();
  }

  async function handleReactivate(p: Pipeline) {
    setMenuOpenId(null);
    await fetch(`/api/pipelines/${p.id}?mode=reactivate`, { method: "PATCH" });
    load();
  }

  if (!username) return null;

  const visible = pipelines.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const activePipelines = pipelines.filter((p) => p.isActive);
  const configured = activePipelines.filter((p) => (p.groupCount ?? 0) > 0).length;
  const running = activePipelines.filter((p) => p.isRunning).length;
  const needsAttention = activePipelines.filter((p) => p.needsAttention).length;

  const statCards = [
    { label: "Total pipelines", value: pipelines.length, color: "#4F46E5", bg: "#EEF2FF" },
    { label: "Configured", value: configured, color: "#16A34A", bg: "#F0FDF4" },
    { label: "Running now", value: running, color: "#4338CA", bg: "#EEF2FF" },
    { label: "Needs attention", value: needsAttention, color: "#B45309", bg: "#FFFBEB" },
  ];

  return (
    <AppShell active="/pipeline-builder" title="Pipeline Builder">
      <div className="flex max-w-4xl flex-col gap-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm text-zinc-500">
            Build and configure data pipelines from your procedure catalog.
          </p>
          <button
            onClick={() => {
              setShowCreate(true);
              setNewName("");
              setError(null);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            <IconPlus className="h-4 w-4" />
            New pipeline
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

        {/* Search bar */}
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pipelines…"
            className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="mb-3 text-sm font-semibold text-indigo-900">New pipeline</p>
            <form onSubmit={handleCreate} className="flex gap-2.5">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Sup Tech Monthly"
                autoFocus
                className="flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {creating ? <IconLoader className="h-3.5 w-3.5 animate-spin" /> : null}
                {creating ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                  setError(null);
                }}
                className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </form>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        )}

        {/* Pipeline list */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <IconLoader className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
            <IconGitBranch className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-500">
              {search ? "No pipelines match your search." : "No pipelines yet. Create one to get started."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((p, idx) => {
              const av = avatarCol(idx);
              const initial = p.name.charAt(0).toUpperCase();
              const hasGroups = (p.groupCount ?? 0) > 0;
              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/pipeline-builder/${p.id}`)}
                  className={`group flex cursor-pointer items-center gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md ${
                    !p.isActive ? "opacity-60" : ""
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                    style={{ background: av.bg, color: av.text }}
                  >
                    {initial}
                  </div>

                  {/* Name + meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-zinc-900">{p.name}</p>
                      {p.needsAttention && (
                        <IconAlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      {hasGroups ? (
                        <>
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                            {p.groupCount} group{(p.groupCount ?? 0) !== 1 ? "s" : ""}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                            {p.procCount} proc{(p.procCount ?? 0) !== 1 ? "s" : ""}
                          </span>
                        </>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          No groups yet
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-400">Created by {p.createdBy}</p>
                  </div>

                  {/* Running indicator */}
                  {p.isRunning && (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                      <IconLoader className="h-3 w-3 animate-spin" />
                      Running
                    </span>
                  )}

                  {/* Status badge: Inactive overrides everything, else Draft until a procedure is attached */}
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      !p.isActive
                        ? "bg-zinc-100 text-zinc-500"
                        : (p.procCount ?? 0) > 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-indigo-50 text-indigo-600"
                    }`}
                  >
                    {!p.isActive ? "Inactive" : (p.procCount ?? 0) > 0 ? "Active" : "Draft"}
                  </span>

                  {/* Edit icon */}
                  <IconPencil className="h-4 w-4 shrink-0 text-zinc-300 transition-colors group-hover:text-indigo-400" />

                  {/* Row menu: archive / delete */}
                  <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setMenuOpenId((cur) => (cur === p.id ? null : p.id))}
                      className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600"
                      aria-label="Pipeline options"
                    >
                      <IconDots className="h-4 w-4" />
                    </button>
                    {menuOpenId === p.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                          {p.isActive ? (
                            <button
                              onClick={() => handleArchive(p)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50"
                            >
                              <IconArchive className="h-3.5 w-3.5" />
                              Mark inactive
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(p)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-emerald-700 hover:bg-emerald-50"
                            >
                              <IconCheck className="h-3.5 w-3.5" />
                              Reactivate
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(p)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                            Delete pipeline
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
