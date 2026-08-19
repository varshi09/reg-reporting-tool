"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/lib/useRequireAuth";
import {
  IconCloudUpload,
  IconPlus,
  IconLoader,
  IconDots,
  IconPencil,
  IconTrash,
  IconX,
} from "@/components/icons";
import type { UploadTableSummary } from "@/lib/uploadTables";

export default function UploadTablesSettingsPage() {
  const { username } = useRequireAuth();
  const [tables, setTables] = useState<UploadTableSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableTables, setAvailableTables] = useState<string[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newTableName, setNewTableName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/upload-tables")
      .then((r) => r.json())
      .then((data) => {
        setTables(data.tables ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setShowCreate(true);
    setNewLabel("");
    setNewTableName("");
    setCreateError(null);
    fetch("/api/upload-tables/available")
      .then((r) => (r.ok ? r.json() : { tableNames: [] }))
      .then((data) => setAvailableTables(data.tableNames ?? []));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || !newTableName) return;
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/upload-tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim(), tableName: newTableName }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setCreateError(data.error ?? "Couldn't add that table.");
      return;
    }
    setShowCreate(false);
    load();
  }

  function openRename(t: UploadTableSummary) {
    setMenuOpenId(null);
    setRenamingId(t.id);
    setRenameValue(t.label);
    setRenameError(null);
  }

  async function handleRenameSave(t: UploadTableSummary) {
    const label = renameValue.trim();
    if (!label || label === t.label) {
      setRenamingId(null);
      return;
    }
    setRenaming(true);
    setRenameError(null);
    const res = await fetch(`/api/upload-tables/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const data = await res.json();
    setRenaming(false);
    if (!res.ok) {
      setRenameError(data.error ?? "Couldn't rename.");
      return;
    }
    setRenamingId(null);
    load();
  }

  async function handleDelete(t: UploadTableSummary) {
    setMenuOpenId(null);
    if (
      !window.confirm(
        `Remove "${t.label}" as an upload dataset? Existing upload history and any pipeline dependencies referencing ${t.key} are kept, but no one will be able to upload to it or select it as a new dependency afterward.`
      )
    )
      return;
    await fetch(`/api/upload-tables/${t.id}`, { method: "DELETE" });
    load();
  }

  if (!username) return null;

  return (
    <AppShell active="/settings" title="Upload tables">
      <div className="flex max-w-2xl flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/settings" className="text-xs text-zinc-500 hover:text-zinc-700">
              ← Settings
            </Link>
            <p className="mt-1 text-sm text-zinc-500">
              Register which physical tables datasets can be uploaded into. Columns are always
              read live from the table itself — nothing here can drift from the real schema.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            <IconPlus className="h-4 w-4" />
            Add upload table
          </button>
        </div>

        {showCreate && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="mb-3 text-sm font-semibold text-indigo-900">Add upload table</p>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Display name</label>
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. BS Consolidated Mapping Data"
                  autoFocus
                  className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Target table</label>
                <select
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="">Select a table…</option>
                  {availableTables.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                {availableTables.length === 0 && (
                  <p className="mt-1 text-xs text-zinc-500">
                    No unregistered tables found — create the physical table first, then register it here.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating || !newLabel.trim() || !newTableName}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {creating ? <IconLoader className="h-3.5 w-3.5 animate-spin" /> : null}
                  {creating ? "Adding…" : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
              {createError && <p className="text-xs text-red-600">{createError}</p>}
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <IconLoader className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : tables.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
            <IconCloudUpload className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-500">No upload tables registered yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tables.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <IconCloudUpload className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  {renamingId === t.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRenameSave(t)}
                        autoFocus
                        className="rounded-md border border-indigo-300 px-2 py-0.5 text-sm font-semibold text-zinc-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                      />
                      <button
                        onClick={() => handleRenameSave(t)}
                        disabled={renaming}
                        className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setRenamingId(null); setRenameError(null); }}
                        className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100"
                      >
                        <IconX className="h-3.5 w-3.5" />
                      </button>
                      {renameError && <p className="text-xs text-red-600">{renameError}</p>}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-zinc-900">{t.label}</p>
                  )}
                  <p className="mt-0.5 text-xs text-zinc-400">{t.key}</p>
                </div>

                <div className="relative shrink-0">
                  <button
                    onClick={() => setMenuOpenId((cur) => (cur === t.id ? null : t.id))}
                    className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600"
                    aria-label="Table options"
                  >
                    <IconDots className="h-4 w-4" />
                  </button>
                  {menuOpenId === t.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                      <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                        <button
                          onClick={() => openRename(t)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          <IconPencil className="h-3.5 w-3.5" />
                          Rename
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
