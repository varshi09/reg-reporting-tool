"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";

type PendingEntry = {
  id: number;
  targetTable: string;
  targetLabel: string;
  fileName: string;
  timeKey: string;
  uploadedBy: string;
  uploadedAt: string;
  totalRows: number;
  previousFailureReasons: string | null;
};

type ActionResult = {
  entry: PendingEntry;
  status: "APPROVED" | "REJECTED" | "PENDING";
  insertedCount?: number;
  errors?: { record?: number; reason: string }[];
};

export default function ApprovalsPage() {
  const [entries, setEntries] = useState<PendingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch("/api/approvals");
    if (response.ok) {
      const data = await response.json();
      setEntries(data.entries ?? []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  function formatTimeKey(value: string) {
    if (value.length !== 8) return value;
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  async function handleApprove(entry: PendingEntry) {
    setError("");
    setBusyId(entry.id);
    try {
      const response = await fetch(`/api/approvals/${entry.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Couldn't approve this upload.");
        return;
      }
      setResult({
        entry,
        status: data.status,
        insertedCount: data.insertedCount,
        errors: data.errors,
      });
      loadEntries();
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(entry: PendingEntry) {
    if (!rejectReason.trim()) return;
    setError("");
    setBusyId(entry.id);
    try {
      const response = await fetch(`/api/approvals/${entry.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "reject", reason: rejectReason.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Couldn't reject this upload.");
        return;
      }
      setResult({ entry, status: "REJECTED" });
      setRejectingId(null);
      setRejectReason("");
      loadEntries();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell active="/approvals" title="Approvals">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-500">
          Uploads waiting on your review. Approving writes the data;
          rejecting discards it and sends the reason back to the maker.
        </p>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing waiting on you right now.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-md border border-zinc-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                        {entry.fileName}
                        <a
                          href={`/api/upload-log/${entry.id}/download`}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          Download
                        </a>
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {entry.targetLabel} · Time key {formatTimeKey(entry.timeKey)} ·
                        {" "}{entry.totalRows} rows · Uploaded by {entry.uploadedBy} on{" "}
                        {new Date(entry.uploadedAt).toLocaleString()}
                      </p>
                      {entry.previousFailureReasons && (
                        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                          Previous approval attempt failed: {entry.previousFailureReasons}
                        </p>
                      )}
                    </div>

                    {rejectingId === entry.id ? (
                      <div className="flex w-full flex-col gap-2 sm:w-auto">
                        <input
                          type="text"
                          autoFocus
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason for rejecting"
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 sm:w-64"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(null);
                              setRejectReason("");
                            }}
                            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(entry)}
                            disabled={busyId === entry.id || !rejectReason.trim()}
                            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                          >
                            {busyId === entry.id ? "Rejecting..." : "Confirm reject"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setError("");
                            setRejectingId(entry.id);
                          }}
                          disabled={busyId === entry.id}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprove(entry)}
                          disabled={busyId === entry.id}
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {busyId === entry.id ? "Approving..." : "Approve"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            {(() => {
              const approved = result.status === "APPROVED";
              const rejected = result.status === "REJECTED";
              const approvalFailed = result.status === "PENDING";
              return (
                <>
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg ${
                        approved
                          ? "bg-emerald-100 text-emerald-600"
                          : rejected
                            ? "bg-zinc-100 text-zinc-600"
                            : "bg-red-100 text-red-600"
                      }`}
                    >
                      {approved ? "✅" : rejected ? "🚫" : "⚠️"}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {approved
                          ? "Approved and loaded"
                          : rejected
                            ? "Rejected"
                            : "Approval failed"}
                      </p>
                      <p className="text-xs text-zinc-500">{result.entry.fileName}</p>
                    </div>
                  </div>

                  {approved && (
                    <p className="mt-3 text-sm text-zinc-600">
                      {result.insertedCount} rows written to {result.entry.targetTable}.
                    </p>
                  )}
                  {rejected && (
                    <p className="mt-3 text-sm text-zinc-600">
                      {result.entry.uploadedBy} will see this was rejected, with your
                      reason.
                    </p>
                  )}
                  {approvalFailed && (
                    <>
                      <p className="mt-3 text-sm text-zinc-600">
                        The file passed validation, but the database rejected it —
                        possibly a duplicate key created since it was uploaded. It&rsquo;s
                        still pending; you can reject it back to the maker.
                      </p>
                      {result.errors && result.errors.length > 0 && (
                        <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-red-200 bg-red-50/50 p-2 text-xs text-zinc-700">
                          {result.errors.map((e, i) => (
                            <li key={i} className="py-0.5">
                              {e.record !== undefined && (
                                <span className="font-medium">Record {e.record}: </span>
                              )}
                              {e.reason}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setResult(null)}
                      className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                      Done
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </AppShell>
  );
}
