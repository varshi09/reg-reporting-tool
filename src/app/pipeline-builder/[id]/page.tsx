"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/lib/useRequireAuth";
import {
  IconChevronLeft,
  IconChevronRight,
  IconGripVertical,
  IconLink,
  IconTrash,
  IconPencil,
  IconPlus,
  IconSearch,
  IconLoader,
  IconEye,
  IconSave,
  IconInfoCircle,
  IconHelpCircle,
  IconDocument,
  IconX,
  IconChevronDown,
  IconDots,
  IconArchive,
  IconCheck,
} from "@/components/icons";
import type { PipelineStructure, CatalogProcedure, ExecMode } from "@/lib/pipelineBuilder";

// ─── Palette ─────────────────────────────────────────────────────────────────

const GROUP_COLORS = [
  { bg: "#E6F1FB", border: "#378ADD", text: "#0C447C", dot: "#185FA5" },
  { bg: "#EEEDFE", border: "#7F77DD", text: "#3C3489", dot: "#534AB7" },
  { bg: "#E1F5EE", border: "#1D9E75", text: "#085041", dot: "#0F6E56" },
  { bg: "#FAECE7", border: "#D85A30", text: "#712B13", dot: "#993C1D" },
  { bg: "#FAEEDA", border: "#EF9F27", text: "#633806", dot: "#854F0B" },
  { bg: "#EAF3DE", border: "#97C459", text: "#27500A", dot: "#3B6D11" },
];

function colorFor(idx: number) {
  return GROUP_COLORS[idx % GROUP_COLORS.length];
}

function packageColorIdx(pkg: string | null): number {
  if (!pkg) return 0;
  let h = 0;
  for (let i = 0; i < pkg.length; i++) h = (h * 31 + pkg.charCodeAt(i)) >>> 0;
  return h % GROUP_COLORS.length;
}

function fullName(p: { procedureName: string; packageName: string | null }) {
  return p.packageName ? `${p.packageName}.${p.procedureName}` : p.procedureName;
}

// ─── Drag payloads ────────────────────────────────────────────────────────────

type DragPayload =
  | { type: "catalog"; procedureId: number }
  | { type: "group-proc"; pipelineProcedureId: number; fromGroupId: number };

// ─── Dependency modal ─────────────────────────────────────────────────────────

function DependencyModal({
  initialValue,
  onSave,
  onClose,
}: {
  initialValue: string | null;
  onSave: (value: string | null) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <p className="text-sm font-semibold text-zinc-900">File dependency</p>
        <p className="mt-1 text-xs text-zinc-500">
          This procedure won&rsquo;t run until an approved upload exists for this dataset (or it&rsquo;s overridden).
        </p>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. BRF_INPUT_FILE"
          autoFocus
          className="mt-3 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
        />
        <div className="mt-4 flex justify-end gap-2">
          {initialValue && (
            <button
              onClick={() => onSave(null)}
              className="mr-auto rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Remove dependency
            </button>
          )}
          <button onClick={onClose} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
            Cancel
          </button>
          <button
            onClick={() => onSave(value.trim() || null)}
            className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PipelineCanvasPage() {
  const { username } = useRequireAuth();
  const router = useRouter();
  const params = useParams();
  const pipelineId = Number(params.id);

  const [structure, setStructure] = useState<PipelineStructure | null>(null);
  const [catalog, setCatalog] = useState<CatalogProcedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [collapsedPkgs, setCollapsedPkgs] = useState<Set<string>>(new Set());
  const [expandedPkgs, setExpandedPkgs] = useState<Set<string>>(new Set());
  const [renamingGroupId, setRenamingGroupId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [depModalPp, setDepModalPp] = useState<{ ppId: number; current: string | null } | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dragPayload = useRef<DragPayload | null>(null);

  const load = useCallback(async () => {
    const [structRes, catRes] = await Promise.all([
      fetch(`/api/pipeline-builder/${pipelineId}`),
      fetch(`/api/procedures`),
    ]);
    if (structRes.ok) setStructure(await structRes.json());
    if (catRes.ok) {
      const data = await catRes.json();
      setCatalog(data.procedures ?? []);
    }
    setLoading(false);
  }, [pipelineId]);

  useEffect(() => {
    if (!Number.isFinite(pipelineId)) return;
    load();
  }, [pipelineId, load]);

  const attachedProcIds = useMemo(() => {
    if (!structure) return new Set<number>();
    return new Set(structure.groups.flatMap((g) => g.procedures.map((p) => p.procedureId)));
  }, [structure]);

  const catalogByPackage = useMemo(() => {
    const filtered = catalog.filter(
      (p) =>
        !attachedProcIds.has(p.id) &&
        (fullName(p).toLowerCase().includes(catalogSearch.toLowerCase()))
    );
    const map = new Map<string, CatalogProcedure[]>();
    for (const p of filtered) {
      const key = p.packageName ?? "Unassigned";
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()];
  }, [catalog, attachedProcIds, catalogSearch]);

  if (!username) return null;

  async function handleAddGroup() {
    if (!structure) return;
    const nextNum = structure.groups.length + 1;
    const res = await fetch(`/api/pipeline-builder/${pipelineId}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Group ${nextNum}`, sortOrder: structure.groups.length, execMode: "SEQUENTIAL" }),
    });
    if (res.ok) load();
  }

  async function handleRenameSave(groupId: number) {
    if (!renameValue.trim()) { setRenamingGroupId(null); return; }
    await fetch(`/api/pipeline-builder/${pipelineId}/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    setRenamingGroupId(null);
    load();
  }

  async function handleDeleteGroup(groupId: number) {
    if (!window.confirm("Delete this group? Its procedures will return to the catalog.")) return;
    await fetch(`/api/pipeline-builder/${pipelineId}/groups/${groupId}`, { method: "DELETE" });
    load();
  }

  async function handleToggleExecMode(groupId: number, mode: ExecMode) {
    await fetch(`/api/pipeline-builder/${pipelineId}/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ execMode: mode }),
    });
    load();
  }

  async function handleRemoveProcedure(ppId: number) {
    await fetch(`/api/pipeline-builder/${pipelineId}/procedures/${ppId}`, { method: "DELETE" });
    load();
  }

  async function handleSaveDependency(ppId: number, value: string | null) {
    await fetch(`/api/pipeline-builder/${pipelineId}/procedures/${ppId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dependsOnDataset: value }),
    });
    setDepModalPp(null);
    load();
  }

  async function handleArchivePipeline() {
    setMenuOpen(false);
    if (!structure) return;
    if (!window.confirm(`Mark "${structure.pipelineName}" inactive? It'll be hidden from the builder and status page. Its groups, procedures, and run history are kept — nothing is deleted.`)) return;
    await fetch(`/api/pipelines/${pipelineId}?mode=archive`, { method: "DELETE" });
    router.push("/pipeline-builder");
  }

  async function handleDeletePipeline() {
    setMenuOpen(false);
    if (!structure) return;
    if (!window.confirm(`Permanently delete "${structure.pipelineName}"? This removes its groups, procedures, and ALL run history. This cannot be undone.`)) return;
    await fetch(`/api/pipelines/${pipelineId}?mode=delete`, { method: "DELETE" });
    router.push("/pipeline-builder");
  }

  async function handleReactivatePipeline() {
    setMenuOpen(false);
    await fetch(`/api/pipelines/${pipelineId}?mode=reactivate`, { method: "PATCH" });
    load();
  }

  async function handleDropOnGroup(groupId: number, targetIndex?: number) {
    setDragOverGroup(null);
    const payload = dragPayload.current;
    dragPayload.current = null;
    if (!payload || !structure) return;

    const group = structure.groups.find((g) => g.id === groupId);
    if (!group) return;

    if (payload.type === "catalog") {
      const sortOrder = targetIndex ?? group.procedures.length;
      await fetch(`/api/pipeline-builder/${pipelineId}/groups/${groupId}/procedures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedureId: payload.procedureId, sortOrder }),
      });
      load();
      return;
    }

    // group-proc: reorder within group or move across groups
    const sourceGroup = structure.groups.find((g) => g.id === payload.fromGroupId);
    if (!sourceGroup) return;

    const remaining = sourceGroup.procedures.filter((p) => p.pipelineProcedureId !== payload.pipelineProcedureId);
    const moved = sourceGroup.procedures.find((p) => p.pipelineProcedureId === payload.pipelineProcedureId);
    if (!moved) return;

    if (payload.fromGroupId === groupId) {
      const newOrder = [...remaining];
      const insertAt = targetIndex ?? newOrder.length;
      newOrder.splice(insertAt, 0, moved);
      await fetch(`/api/pipeline-builder/${pipelineId}/groups/${groupId}/procedures`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedPpIds: newOrder.map((p) => p.pipelineProcedureId) }),
      });
    } else {
      const targetGroup = structure.groups.find((g) => g.id === groupId);
      const newTargetOrder = [...(targetGroup?.procedures ?? [])];
      const insertAt = targetIndex ?? newTargetOrder.length;
      newTargetOrder.splice(insertAt, 0, moved);
      await fetch(`/api/pipeline-builder/${pipelineId}/groups/${groupId}/procedures`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedPpIds: newTargetOrder.map((p) => p.pipelineProcedureId) }),
      });
    }
    load();
  }

  if (loading || !structure) {
    return (
      <AppShell active="/pipeline-builder" title="Pipeline Builder">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <IconLoader className="h-4 w-4 animate-spin" />
          Loading pipeline…
        </div>
      </AppShell>
    );
  }

  const totalProcs = structure.groups.reduce((s, g) => s + g.procedures.length, 0);
  const isDraft = totalProcs === 0;

  return (
    <AppShell active="/pipeline-builder" title="Pipeline Builder">
      <div className="flex flex-col gap-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <button onClick={() => router.push("/pipeline-builder")} className="flex items-center gap-1 hover:text-zinc-700">
            <IconChevronLeft className="h-3.5 w-3.5" />
            Pipelines
          </button>
          <IconChevronRight className="h-3 w-3 text-zinc-300" />
          <span className="font-medium text-zinc-700">{structure.pipelineName}</span>
        </div>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
              <h1 className="text-xl font-semibold text-zinc-900">{structure.pipelineName}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  !structure.isActive
                    ? "bg-zinc-100 text-zinc-500"
                    : isDraft
                      ? "bg-indigo-50 text-indigo-600"
                      : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {!structure.isActive ? "Inactive" : isDraft ? "Draft" : "Active"}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-zinc-500">Organize procedures into groups and define execution order.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-xs text-zinc-400">
              {structure.groups.length} group{structure.groups.length !== 1 ? "s" : ""} · {totalProcs} procedure
              {totalProcs !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/pipeline-status")}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                <IconEye className="h-3.5 w-3.5" />
                Preview
              </button>
              <button
                onClick={() => router.push("/pipeline-builder")}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
              >
                <IconSave className="h-3.5 w-3.5" />
                Save pipeline
              </button>
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
                    <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                      {structure.isActive ? (
                        <button
                          onClick={handleArchivePipeline}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          <IconArchive className="h-3.5 w-3.5" />
                          Mark inactive
                        </button>
                      ) : (
                        <button
                          onClick={handleReactivatePipeline}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-emerald-700 hover:bg-emerald-50"
                        >
                          <IconCheck className="h-3.5 w-3.5" />
                          Reactivate
                        </button>
                      )}
                      <button
                        onClick={handleDeletePipeline}
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
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="flex gap-4">
          {/* Catalog */}
          <div className="w-64 shrink-0 rounded-xl bg-zinc-50 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              Procedure catalog
            </p>
            <div className="relative mb-3">
              <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search catalog…"
                className="h-8 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-2 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
            </div>

            <div className="flex flex-col gap-3">
              {catalogByPackage.length === 0 ? (
                <p className="px-1 text-xs text-zinc-400">
                  {catalogSearch ? "No matches." : "All procedures are attached to this pipeline."}
                </p>
              ) : (
                catalogByPackage.map(([pkg, procs]) => {
                  const col = colorFor(packageColorIdx(pkg === "Unassigned" ? null : pkg));
                  const collapsed = collapsedPkgs.has(pkg);
                  const expanded = expandedPkgs.has(pkg);
                  const visible = expanded ? procs : procs.slice(0, 6);
                  return (
                    <div key={pkg}>
                      <button
                        onClick={() =>
                          setCollapsedPkgs((prev) => {
                            const next = new Set(prev);
                            if (next.has(pkg)) next.delete(pkg);
                            else next.add(pkg);
                            return next;
                          })
                        }
                        className="mb-1.5 flex w-full items-center gap-1.5 text-left"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: col.dot }} />
                        <span className="flex-1 truncate text-[10px] font-semibold uppercase tracking-wide" style={{ color: col.text }}>
                          {pkg}
                        </span>
                        <span className="rounded-full bg-zinc-200 px-1.5 text-[10px] text-zinc-500">{procs.length}</span>
                        <IconChevronDown className={`h-3 w-3 text-zinc-400 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                      </button>
                      {!collapsed && (
                        <div className="flex flex-col gap-1">
                          {visible.map((p) => (
                            <div
                              key={p.id}
                              draggable
                              onDragStart={() => { dragPayload.current = { type: "catalog", procedureId: p.id }; }}
                              className="flex cursor-grab items-center gap-1.5 rounded-md bg-white px-2 py-1.5 text-xs text-zinc-700 shadow-sm active:cursor-grabbing"
                            >
                              <IconGripVertical className="h-3 w-3 shrink-0 text-zinc-300" />
                              <span className="truncate">{p.procedureName}</span>
                            </div>
                          ))}
                          {procs.length > 6 && (
                            <button
                              onClick={() =>
                                setExpandedPkgs((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(pkg)) next.delete(pkg);
                                  else next.add(pkg);
                                  return next;
                                })
                              }
                              className="px-1 py-0.5 text-left text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                            >
                              {expanded ? "Show less" : `View ${procs.length - 6} more`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {structure.groups.map((group, gi) => {
              const col = colorFor(gi);
              const isDragOver = dragOverGroup === group.id;
              return (
                <div
                  key={group.id}
                  className="rounded-xl border-2 overflow-hidden"
                  style={{ borderColor: isDragOver ? col.border : `${col.border}80` }}
                >
                  {/* Group header */}
                  <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ background: col.bg }}>
                    <IconGripVertical className="h-4 w-4 shrink-0 cursor-grab text-zinc-400" />
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: col.dot }} />
                    {renamingGroupId === group.id ? (
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRenameSave(group.id)}
                        autoFocus
                        className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-sm outline-none"
                      />
                    ) : (
                      <span className="flex-1 text-sm font-medium" style={{ color: col.text }}>
                        {group.name}
                      </span>
                    )}

                    <div className="flex items-center overflow-hidden rounded-full border bg-white" style={{ borderColor: `${col.border}80` }}>
                      {(["SEQUENTIAL", "PARALLEL"] as ExecMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => handleToggleExecMode(group.id, mode)}
                          className="px-2.5 py-1 text-[10px] font-medium transition-colors"
                          style={
                            group.execMode === mode
                              ? { background: col.dot, color: "#fff" }
                              : { color: col.text }
                          }
                        >
                          {mode === "SEQUENTIAL" ? "Sequential" : "Parallel"}
                        </button>
                      ))}
                    </div>

                    {renamingGroupId === group.id ? (
                      <button
                        onClick={() => handleRenameSave(group.id)}
                        className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-medium hover:bg-zinc-50"
                        style={{ color: col.text }}
                      >
                        Save
                      </button>
                    ) : (
                      <button
                        onClick={() => { setRenamingGroupId(group.id); setRenameValue(group.name); }}
                        className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-medium hover:bg-zinc-50"
                        style={{ color: col.text }}
                      >
                        <IconPencil className="h-3 w-3" />
                        Rename
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50"
                    >
                      <IconTrash className="h-3 w-3" />
                      Delete
                    </button>
                  </div>

                  {/* Drop zone / procedures */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOverGroup(group.id); }}
                    onDragLeave={() => setDragOverGroup((cur) => (cur === group.id ? null : cur))}
                    onDrop={(e) => { e.preventDefault(); handleDropOnGroup(group.id); }}
                    className="bg-white p-3"
                  >
                    {group.procedures.length === 0 ? (
                      <>
                        <div className="mb-3 flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                          <IconInfoCircle className="h-3.5 w-3.5 shrink-0" />
                          Drag procedures from the catalog and drop here to add to this group
                        </div>
                        <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-zinc-200 py-10">
                          <IconDocument className="h-7 w-7 text-zinc-300" />
                          <p className="text-sm font-medium text-zinc-600">This group is empty</p>
                          <p className="text-xs text-zinc-400">Drag and drop procedures here from the catalog to get started.</p>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {group.procedures.map((proc, pi) => (
                          <div
                            key={proc.pipelineProcedureId}
                            draggable
                            onDragStart={() => {
                              dragPayload.current = {
                                type: "group-proc",
                                pipelineProcedureId: proc.pipelineProcedureId,
                                fromGroupId: group.id,
                              };
                            }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverGroup(group.id); }}
                            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropOnGroup(group.id, pi); }}
                            className="flex cursor-grab items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 active:cursor-grabbing"
                          >
                            <span className="w-4 shrink-0 text-center text-[11px] text-zinc-400">{pi + 1}</span>
                            <IconGripVertical className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-zinc-800">{proc.procedureName}</p>
                              {proc.packageName && <p className="truncate text-[10px] text-zinc-400">{proc.packageName}</p>}
                            </div>
                            <button
                              onClick={() => setDepModalPp({ ppId: proc.pipelineProcedureId, current: proc.dependsOnDataset })}
                              className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                proc.dependsOnDataset ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-400"
                              }`}
                            >
                              <IconLink className="h-2.5 w-2.5" />
                              {proc.dependsOnDataset ?? "No dependency"}
                            </button>
                            <button onClick={() => handleRemoveProcedure(proc.pipelineProcedureId)} className="shrink-0 text-zinc-300 hover:text-red-500">
                              <IconTrash className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              onClick={handleAddGroup}
              className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-zinc-200 py-3 text-sm font-medium text-zinc-500 hover:border-indigo-300 hover:text-indigo-600"
            >
              <IconPlus className="h-4 w-4" />
              Add group
            </button>
          </div>
        </div>

        {/* Footer legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs text-zinc-500">
          <span>Execution order: top → bottom within each group</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Has file dependency</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-zinc-300" />No dependency</span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "#378ADD" }} />
              <span className="h-2 w-2 rounded-full" style={{ background: "#7F77DD" }} />
              <span className="h-2 w-2 rounded-full" style={{ background: "#1D9E75" }} />
              Group colors cycle automatically
            </span>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowHelp((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1 hover:bg-zinc-50"
            >
              <IconHelpCircle className="h-3.5 w-3.5" />
              How it works
            </button>
            {showHelp && (
              <div className="absolute bottom-full right-0 mb-2 w-72 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-600 shadow-lg">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="font-semibold text-zinc-900">How the builder works</p>
                  <button onClick={() => setShowHelp(false)}><IconX className="h-3.5 w-3.5" /></button>
                </div>
                <ul className="flex flex-col gap-1.5">
                  <li>Drag procedures from the catalog into a group to attach them.</li>
                  <li>Order within a group matters when it&rsquo;s set to Sequential.</li>
                  <li>Parallel groups run every procedure in the group at once.</li>
                  <li>Add a file dependency to block a procedure until an upload is approved.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {depModalPp && (
        <DependencyModal
          initialValue={depModalPp.current}
          onClose={() => setDepModalPp(null)}
          onSave={(v) => handleSaveDependency(depModalPp.ppId, v)}
        />
      )}
    </AppShell>
  );
}
