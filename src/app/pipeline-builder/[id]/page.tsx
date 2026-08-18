"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { IconGripVertical, IconPlus, IconTrash, IconSearch, IconLink } from "@/components/icons";

type CatalogProc = {
  id: number; procedureName: string; packageName: string | null;
  takesDateParam: boolean; takesScopeParam: boolean;
};
type GroupProc = {
  pipelineProcedureId: number; procedureId: number;
  procedureName: string; packageName: string | null;
  takesDateParam: boolean; takesScopeParam: boolean;
  sortOrder: number; dependsOnDataset: string | null;
};
type Group = { id: number; name: string; sortOrder: number; execMode: "SEQUENTIAL" | "PARALLEL"; procedures: GroupProc[] };
type Structure = { pipelineId: number; pipelineName: string; groups: Group[] };

const DATASET_OPTIONS = [
  "REF_BRF_CONS_MAPPING_TABLE","REF_FAB_GL_INTERNAL_LINE_MAP","REF_BRF_ACCOUNT_STAT_ADJ",
  "REF_BRF_CUSTOMER_STAT_ADJ","REF_CONS_PRODUCT_MAP","REF_BRF34_CCY_RATES",
  "REF_BRF_GLCMS_UNDRAWN_INTERIM","REF_BRF_INVESTMENTS","REF_BRF_CONS_BANKLIST","REF_BRF_INVESTMENT_SUMMARY",
];

// Color palette for groups (cycling)
const GROUP_COLORS = [
  { bg: "#E6F1FB", border: "#378ADD", text: "#0C447C", accent: "#185FA5" },   // blue
  { bg: "#EEEDFE", border: "#7F77DD", text: "#3C3489", accent: "#534AB7" },   // purple
  { bg: "#E1F5EE", border: "#1D9E75", text: "#085041", accent: "#0F6E56" },   // teal
  { bg: "#FAECE7", border: "#D85A30", text: "#712B13", accent: "#993C1D" },   // coral
  { bg: "#FAEEDA", border: "#EF9F27", text: "#633806", accent: "#854F0B" },   // amber
  { bg: "#EAF3DE", border: "#97C459", text: "#27500A", accent: "#3B6D11" },   // green
];

// Colors per package name
const PKG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "CB_BRF_FAB_CONS_PACK_INTERIM": { bg: "#EEEDFE", text: "#3C3489", border: "#AFA9EC" },
  "CB_BRF_REF_TABLE_LOAD":        { bg: "#E1F5EE", text: "#085041", border: "#5DCAA5" },
};
const PKG_COLOR_DEFAULT = { bg: "#F1EFE8", text: "#444441", border: "#B4B2A9" };

function pkgColor(pkg: string | null) {
  return pkg ? (PKG_COLORS[pkg] ?? PKG_COLOR_DEFAULT) : PKG_COLOR_DEFAULT;
}

export default function PipelineBuilderPage() {
  const { username } = useRequireAuth();
  const params = useParams();
  const pipelineId = Number(params.id);

  const [structure, setStructure] = useState<Structure | null>(null);
  const [catalog, setCatalog] = useState<CatalogProc[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [depModal, setDepModal] = useState<{ ppId: number; groupId: number } | null>(null);
  const [depValue, setDepValue] = useState("");
  const [renamingGroupId, setRenamingGroupId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const dragItemRef = useRef<
    | { type: "catalog"; procId: number }
    | { type: "proc"; ppId: number; fromGroupId: number }
    | { type: "group"; groupId: number }
    | null
  >(null);
  const [dropTarget, setDropTarget] = useState<{ groupId: number; ppId: number | null } | null>(null);
  const [groupDropTarget, setGroupDropTarget] = useState<number | null>(null);

  async function reload() {
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/pipeline-builder/${pipelineId}`),
      fetch(`/api/procedures`),
    ]);
    const [s, c] = await Promise.all([sRes.json(), cRes.json()]);
    setStructure(s);
    setCatalog(Array.isArray(c) ? c : []);
    setLoading(false);
  }
  useEffect(() => { if (pipelineId) reload(); }, [pipelineId]);

  async function addGroup() {
    if (!structure) return;
    setSaving(true);
    const sortOrder = structure.groups.length;
    const res = await fetch(`/api/pipeline-builder/${pipelineId}/groups`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Group ${sortOrder + 1}`, sortOrder, execMode: "SEQUENTIAL" }),
    });
    if (res.ok) await reload();
    setSaving(false);
  }

  async function renameGroup(groupId: number, name: string) {
    if (!name.trim()) return;
    await fetch(`/api/pipeline-builder/${pipelineId}/groups/${groupId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setRenamingGroupId(null);
    await reload();
  }

  async function toggleExecMode(group: Group) {
    const next = group.execMode === "SEQUENTIAL" ? "PARALLEL" : "SEQUENTIAL";
    await fetch(`/api/pipeline-builder/${pipelineId}/groups/${group.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ execMode: next }),
    });
    setStructure((prev) => prev ? {
      ...prev, groups: prev.groups.map((g) => g.id === group.id ? { ...g, execMode: next } : g),
    } : prev);
  }

  async function deleteGroup(groupId: number) {
    if (!confirm("Delete this group? Procedures in it will be detached.")) return;
    await fetch(`/api/pipeline-builder/${pipelineId}/groups/${groupId}`, { method: "DELETE" });
    await reload();
  }

  async function addProcToGroup(groupId: number, procId: number) {
    const group = structure?.groups.find((g) => g.id === groupId);
    const sortOrder = group?.procedures.length ?? 0;
    await fetch(`/api/pipeline-builder/${pipelineId}/groups/${groupId}/procedures`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ procedureId: procId, sortOrder }),
    });
    await reload();
  }

  async function removeProcFromGroup(groupId: number, ppId: number) {
    await fetch(`/api/pipeline-builder/${pipelineId}/groups/${groupId}/procedures/${ppId}`, { method: "DELETE" });
    await reload();
  }

  async function setDependency(groupId: number, ppId: number, dep: string | null) {
    await fetch(`/api/pipeline-builder/${pipelineId}/groups/${groupId}/procedures/${ppId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dependsOnDataset: dep }),
    });
    setDepModal(null);
    await reload();
  }

  // ── DnD ─────────────────────────────────────────────────────────────────

  function onCatalogDragStart(procId: number) { dragItemRef.current = { type: "catalog", procId }; }
  function onProcDragStart(ppId: number, fromGroupId: number) { dragItemRef.current = { type: "proc", ppId, fromGroupId }; }
  function onGroupDragStart(groupId: number) { dragItemRef.current = { type: "group", groupId }; }

  function onGroupAreaDragOver(e: React.DragEvent, groupId: number) {
    e.preventDefault();
    if (dragItemRef.current?.type === "group") setGroupDropTarget(groupId);
    else setDropTarget({ groupId, ppId: null });
  }

  function onProcRowDragOver(e: React.DragEvent, groupId: number, ppId: number) {
    e.preventDefault(); e.stopPropagation();
    if (dragItemRef.current?.type !== "group") setDropTarget({ groupId, ppId });
  }

  async function onDrop(e: React.DragEvent, targetGroupId: number, beforePpId: number | null) {
    e.preventDefault();
    const item = dragItemRef.current;
    dragItemRef.current = null;
    setDropTarget(null);
    setGroupDropTarget(null);
    if (!item || !structure) return;

    if (item.type === "group") {
      const ordered = structure.groups.map((g) => g.id).filter((id) => id !== item.groupId);
      const insertAt = ordered.indexOf(targetGroupId);
      ordered.splice(insertAt < 0 ? ordered.length : insertAt, 0, item.groupId);
      await fetch(`/api/pipeline-builder/${pipelineId}/groups`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedGroupIds: ordered }),
      });
      await reload();
      return;
    }

    if (item.type === "catalog") { await addProcToGroup(targetGroupId, item.procId); return; }

    if (item.type === "proc") {
      const { ppId, fromGroupId } = item;
      if (fromGroupId !== targetGroupId) {
        await fetch(`/api/pipeline-builder/${pipelineId}/groups/${fromGroupId}/procedures/${ppId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId: targetGroupId }),
        });
        await reload();
      } else {
        const group = structure.groups.find((g) => g.id === targetGroupId);
        if (!group) return;
        const ordered = group.procedures.map((p) => p.pipelineProcedureId).filter((id) => id !== ppId);
        const insertAt = beforePpId ? ordered.indexOf(beforePpId) : ordered.length;
        ordered.splice(insertAt < 0 ? ordered.length : insertAt, 0, ppId);
        await fetch(`/api/pipeline-builder/${pipelineId}/groups/${targetGroupId}/procedures`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedPpIds: ordered }),
        });
        await reload();
      }
    }
  }

  // Catalog grouped by package
  const catalogByPkg = catalog.reduce<Record<string, CatalogProc[]>>((acc, p) => {
    const key = p.packageName ?? "__standalone__";
    (acc[key] = acc[key] ?? []).push(p);
    return acc;
  }, {});
  const pkgOrder = Object.keys(catalogByPkg).sort((a, b) => a === "__standalone__" ? 1 : b === "__standalone__" ? -1 : a.localeCompare(b));

  const filteredCatalog = catalog.filter((p) => {
    const q = catalogSearch.toLowerCase();
    return !q || p.procedureName.toLowerCase().includes(q) || (p.packageName ?? "").toLowerCase().includes(q);
  });
  const filteredByPkg = filteredCatalog.reduce<Record<string, CatalogProc[]>>((acc, p) => {
    const key = p.packageName ?? "__standalone__";
    (acc[key] = acc[key] ?? []).push(p);
    return acc;
  }, {});

  const totalProcs = structure?.groups.reduce((n, g) => n + g.procedures.length, 0) ?? 0;

  if (!username || loading) return (
    <AppShell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-secondary)", fontSize: 13 }}>Loading…</div>
    </AppShell>
  );
  if (!structure) return (
    <AppShell>
      <div style={{ padding: "2rem", fontSize: 13, color: "var(--text-danger)" }}>Pipeline not found.</div>
    </AppShell>
  );

  return (
    <AppShell>
      {/* Dep modal */}
      {depModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDepModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface-2)", borderRadius: 14, border: "0.5px solid var(--border-strong)", padding: "1.5rem", width: 440 }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 6px" }}>Set file dependency</h3>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 1rem" }}>
              This procedure will be blocked until the selected dataset has an approved upload for the current period.
            </p>
            <select value={depValue} onChange={(e) => setDepValue(e.target.value)}
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border-strong)", background: "var(--surface-1)", color: "var(--text-primary)", marginBottom: "1.25rem" }}>
              <option value="">— No dependency —</option>
              {DATASET_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDepModal(null)} style={{ padding: "7px 16px", borderRadius: 8, border: "0.5px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => setDependency(depModal.groupId, depModal.ppId, depValue || null)}
                style={{ padding: "7px 16px", borderRadius: 8, border: "0.5px solid var(--border-accent)", background: "var(--bg-accent)", color: "var(--text-accent)", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renamingGroupId !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setRenamingGroupId(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface-2)", borderRadius: 14, border: "0.5px solid var(--border-strong)", padding: "1.5rem", width: 380 }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 1rem" }}>Rename group</h3>
            <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") renameGroup(renamingGroupId, renameValue); if (e.key === "Escape") setRenamingGroupId(null); }}
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border-strong)", background: "var(--surface-1)", color: "var(--text-primary)", marginBottom: "1.25rem" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setRenamingGroupId(null)} style={{ padding: "7px 16px", borderRadius: 8, border: "0.5px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => renameGroup(renamingGroupId, renameValue)}
                style={{ padding: "7px 16px", borderRadius: 8, border: "0.5px solid var(--border-accent)", background: "var(--bg-accent)", color: "var(--text-accent)", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gridTemplateRows: "56px 1fr", height: "calc(100vh - 56px)" }}>

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 12, padding: "0 1.25rem", borderBottom: "0.5px solid var(--border)", background: "var(--surface-2)" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#378ADD", flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>{structure.pipelineName}</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)", padding: "3px 10px", borderRadius: 20, background: "var(--surface-1)", border: "0.5px solid var(--border)" }}>
            {structure.groups.length} group{structure.groups.length !== 1 ? "s" : ""} · {totalProcs} procedure{totalProcs !== 1 ? "s" : ""}
          </span>
          {saving && <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Saving…</span>}
        </div>

        {/* ── Catalog panel ────────────────────────────────────────────────── */}
        <div style={{ borderRight: "0.5px solid var(--border)", background: "var(--surface-1)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", borderBottom: "0.5px solid var(--border)" }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Procedure catalog</p>
            <div style={{ position: "relative" }}>
              <IconSearch style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--text-muted)" }} />
              <input value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} placeholder="Search procedures…"
                style={{ width: "100%", fontSize: 12, padding: "6px 8px 6px 28px", borderRadius: 7, border: "0.5px solid var(--border-strong)", background: "var(--surface-2)", color: "var(--text-primary)" }} />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {pkgOrder.filter((pkg) => filteredByPkg[pkg]).map((pkg) => {
              const color = pkg === "__standalone__" ? PKG_COLOR_DEFAULT : (PKG_COLORS[pkg] ?? PKG_COLOR_DEFAULT);
              const label = pkg === "__standalone__" ? "Standalone" : pkg;
              return (
                <div key={pkg}>
                  <div style={{ padding: "6px 12px 4px", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: color.border, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 500, color: color.text, letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={label}>
                      {label.replace("CB_BRF_", "").replace(/_/g, " ")}
                    </span>
                  </div>
                  {(filteredByPkg[pkg] ?? []).map((p) => (
                    <div key={p.id} draggable onDragStart={() => onCatalogDragStart(p.id)}
                      style={{ padding: "7px 12px 7px 20px", cursor: "grab", userSelect: "none", borderBottom: "0.5px solid var(--border)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>{p.procedureName}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Canvas ───────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--surface-1)" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>

            {structure.groups.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, color: "var(--text-secondary)", gap: 8 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--surface-2)", border: "0.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <IconPlus style={{ width: 22, height: 22, color: "var(--text-muted)" }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>No groups yet</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Add a group to start arranging procedures.</p>
              </div>
            )}

            {structure.groups.map((group, gi) => {
              const col = GROUP_COLORS[gi % GROUP_COLORS.length];
              const isGroupDrop = groupDropTarget === group.id;
              return (
                <div key={group.id} style={{ marginBottom: 14 }}
                  onDragOver={(e) => { e.preventDefault(); onGroupAreaDragOver(e, group.id); }}
                  onDrop={(e) => onDrop(e, group.id, null)}>

                  <div style={{
                    borderRadius: 12,
                    border: isGroupDrop ? `2px dashed ${col.border}` : `0.5px solid ${col.border}`,
                    overflow: "hidden",
                    background: "var(--surface-2)",
                  }}>
                    {/* Group header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: col.bg, borderBottom: `0.5px solid ${col.border}` }}>
                      <span draggable onDragStart={() => onGroupDragStart(group.id)}
                        style={{ cursor: "grab", color: col.accent, display: "flex", flexShrink: 0 }}>
                        <IconGripVertical style={{ width: 16, height: 16 }} />
                      </span>

                      <span style={{ fontSize: 13, fontWeight: 500, color: col.text, flex: 1 }}>{group.name}</span>

                      {/* Exec mode pill toggle */}
                      <div style={{ display: "flex", borderRadius: 20, border: `0.5px solid ${col.border}`, overflow: "hidden", fontSize: 10, cursor: "pointer" }}
                        onClick={() => toggleExecMode(group)}>
                        <span style={{
                          padding: "3px 10px",
                          background: group.execMode === "SEQUENTIAL" ? col.accent : "transparent",
                          color: group.execMode === "SEQUENTIAL" ? "#fff" : col.text,
                          fontWeight: group.execMode === "SEQUENTIAL" ? 500 : 400,
                        }}>Sequential</span>
                        <span style={{
                          padding: "3px 10px",
                          background: group.execMode === "PARALLEL" ? col.accent : "transparent",
                          color: group.execMode === "PARALLEL" ? "#fff" : col.text,
                          fontWeight: group.execMode === "PARALLEL" ? 500 : 400,
                        }}>Parallel</span>
                      </div>

                      <button onClick={() => { setRenamingGroupId(group.id); setRenameValue(group.name); }}
                        style={{ padding: "3px 9px", borderRadius: 6, border: `0.5px solid ${col.border}`, background: "transparent", color: col.text, fontSize: 10, cursor: "pointer", fontWeight: 500 }}>
                        Rename
                      </button>
                      <button onClick={() => deleteGroup(group.id)}
                        style={{ padding: "3px 9px", borderRadius: 6, border: "0.5px solid var(--border-danger)", background: "transparent", color: "var(--text-danger)", fontSize: 10, cursor: "pointer" }}>
                        Delete
                      </button>
                    </div>

                    {/* Procedure rows */}
                    <div style={{ padding: "10px", minHeight: 56 }}>
                      {group.procedures.length === 0 && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "12px 0", border: `1.5px dashed ${col.border}`, borderRadius: 8, background: col.bg + "55" }}>
                          Drag procedures from the catalog
                        </div>
                      )}

                      {group.procedures.map((proc, pi) => {
                        const pc = pkgColor(proc.packageName);
                        const isOver = dropTarget?.groupId === group.id && dropTarget?.ppId === proc.pipelineProcedureId;
                        return (
                          <div key={proc.pipelineProcedureId}
                            draggable
                            onDragStart={() => onProcDragStart(proc.pipelineProcedureId, group.id)}
                            onDragOver={(e) => onProcRowDragOver(e, group.id, proc.pipelineProcedureId)}
                            onDrop={(e) => { e.stopPropagation(); onDrop(e, group.id, proc.pipelineProcedureId); }}
                            style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "8px 10px", borderRadius: 9, marginBottom: 6,
                              border: isOver ? `1.5px dashed ${col.border}` : "0.5px solid var(--border)",
                              background: "var(--surface-2)",
                              cursor: "grab", userSelect: "none",
                              borderLeft: `3px solid ${col.border}`,
                            }}>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, lineHeight: 1, fontWeight: 500, minWidth: 16, textAlign: "right" }}>
                              {pi + 1}
                            </span>
                            <IconGripVertical style={{ width: 13, height: 13, flexShrink: 0, color: "var(--text-muted)" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 500, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
                                {proc.procedureName}
                              </p>
                            </div>
                            {proc.packageName && (
                              <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: pc.bg, color: pc.text, border: `0.5px solid ${pc.border}`, whiteSpace: "nowrap", flexShrink: 0 }}>
                                {proc.packageName.replace("CB_BRF_", "").replace(/_/g, " ")}
                              </span>
                            )}
                            {proc.dependsOnDataset ? (
                              <span title={proc.dependsOnDataset} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, background: "#FAEEDA", color: "#633806", border: "0.5px solid #EF9F27", whiteSpace: "nowrap", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>
                                ⬡ {proc.dependsOnDataset.replace("REF_", "").replace(/_/g, " ")}
                              </span>
                            ) : (
                              <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, background: "var(--surface-1)", color: "var(--text-muted)", border: "0.5px solid var(--border)", whiteSpace: "nowrap", flexShrink: 0 }}>
                                No dep
                              </span>
                            )}
                            <button onClick={() => { setDepModal({ ppId: proc.pipelineProcedureId, groupId: group.id }); setDepValue(proc.dependsOnDataset ?? ""); }}
                              title="Set dependency"
                              style={{ padding: "3px 5px", borderRadius: 5, border: "0.5px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}>
                              <IconLink style={{ width: 12, height: 12 }} />
                            </button>
                            <button onClick={() => removeProcFromGroup(group.id, proc.pipelineProcedureId)}
                              title="Remove"
                              style={{ padding: "3px 5px", borderRadius: 5, border: "0.5px solid var(--border)", background: "transparent", color: "var(--text-danger)", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}>
                              <IconTrash style={{ width: 12, height: 12 }} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Down arrow between groups */}
                  {gi < structure.groups.length - 1 && (
                    <div style={{ display: "flex", justifyContent: "center", padding: "4px 0", color: "var(--text-muted)", fontSize: 16 }}>↓</div>
                  )}
                </div>
              );
            })}

            {/* Add group button */}
            <button onClick={addGroup} disabled={saving}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px", borderRadius: 12, border: "1.5px dashed var(--border-strong)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", marginTop: 4 }}
              onMouseEnter={(e) => { const b = e.currentTarget; b.style.color = "var(--text-accent)"; b.style.borderColor = "var(--border-accent)"; b.style.background = "var(--bg-accent)"; }}
              onMouseLeave={(e) => { const b = e.currentTarget; b.style.color = "var(--text-secondary)"; b.style.borderColor = "var(--border-strong)"; b.style.background = "transparent"; }}>
              <IconPlus style={{ width: 14, height: 14 }} /> Add group
            </button>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "9px 1.25rem", borderTop: "0.5px solid var(--border)", background: "var(--surface-2)", fontSize: 11, color: "var(--text-secondary)" }}>
            <span>Groups run top → bottom</span>
            <span style={{ width: 1, height: 10, background: "var(--border)" }} />
            <span><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#EF9F27", marginRight: 4 }} />Has file dependency</span>
            <span><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--border-strong)", marginRight: 4 }} />No dependency</span>
            <span style={{ width: 1, height: 10, background: "var(--border)" }} />
            {GROUP_COLORS.slice(0, 3).map((c, i) => (
              <span key={i} style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: c.border }} />
            ))}
            <span style={{ color: "var(--text-muted)" }}>Group colors cycle automatically</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
