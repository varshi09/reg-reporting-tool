"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";

type LogEntry = {
  ID: number;
  FILE_NAME: string;
  TIME_KEY: string;
  UPLOADED_BY: string;
  UPLOADED_AT: string;
  TOTAL_ROWS: number;
  INSERTED_COUNT: number;
  FAILED_COUNT: number;
  FAILURE_REASONS: string | null;
  STATUS: "PENDING" | "APPROVED" | "REJECTED";
};

const TARGET_TABLE = "REF_BRF_CONS_MAPPING_TABLE";

export default function ReportsPage() {
  const [userOptions, setUserOptions] = useState<string[]>([]);
  const [timeKey, setTimeKey] = useState("");
  const [uploadedBy, setUploadedBy] = useState("");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadFilters() {
      const response = await fetch(
        `/api/upload-log/filters?targetTable=${TARGET_TABLE}`
      );
      if (!response.ok) return;
      const data = await response.json();
      setUserOptions(data.users ?? []);
    }
    loadFilters();
  }, []);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({ targetTable: TARGET_TABLE, limit: "100" });
    if (timeKey) params.set("timeKey", timeKey.replace(/-/g, ""));
    if (uploadedBy) params.set("uploadedBy", uploadedBy);

    const response = await fetch(`/api/upload-log?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      setEntries(data.entries ?? []);
    }
    setIsLoading(false);
  }, [timeKey, uploadedBy]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const totals = entries.reduce(
    (acc, e) => ({
      total: acc.total + e.TOTAL_ROWS,
      inserted: acc.inserted + e.INSERTED_COUNT,
      failed: acc.failed + e.FAILED_COUNT,
    }),
    { total: 0, inserted: 0, failed: 0 }
  );

  function formatTimeKey(value: string) {
    if (value.length !== 8) return value;
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  return (
    <AppShell active="/reports" title="Upload activity report">
      <div className="flex flex-col gap-4">
        <a
          href="/reports"
          className="w-fit text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Back to reports
        </a>
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          <p className="text-sm font-semibold text-zinc-900">
            BS Consolidated Mapping Data upload report
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="timeKeyFilter"
                className="text-sm font-medium text-zinc-700"
              >
                Time key
              </label>
              <input
                id="timeKeyFilter"
                type="date"
                value={timeKey}
                onChange={(e) => setTimeKey(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="userFilter"
                className="text-sm font-medium text-zinc-700"
              >
                User
              </label>
              <select
                id="userFilter"
                value={uploadedBy}
                onChange={(e) => setUploadedBy(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              >
                <option value="">All</option>
                {userOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">Total rows</p>
            <p className="mt-1 text-2xl font-bold text-indigo-600">
              {totals.total}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">Inserted</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {totals.inserted}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">Failed</p>
            <p className="mt-1 text-2xl font-bold text-rose-600">
              {totals.failed}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No uploads match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500">
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">File</th>
                    <th className="pb-2 pr-4 font-medium">Time key</th>
                    <th className="pb-2 pr-4 font-medium">Uploaded by</th>
                    <th className="pb-2 pr-4 font-medium">Uploaded at</th>
                    <th className="pb-2 pr-4 font-medium">Total</th>
                    <th className="pb-2 pr-4 font-medium">Inserted</th>
                    <th className="pb-2 pr-4 font-medium">Failed</th>
                    <th className="pb-2 font-medium">Failure reason</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.ID}
                      className="border-t border-zinc-100 text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            entry.STATUS === "APPROVED"
                              ? "bg-emerald-100 text-emerald-700"
                              : entry.STATUS === "REJECTED"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {entry.STATUS === "APPROVED"
                            ? "Approved"
                            : entry.STATUS === "REJECTED"
                              ? "Rejected"
                              : "Pending"}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{entry.FILE_NAME}</td>
                      <td className="py-2 pr-4">{formatTimeKey(entry.TIME_KEY)}</td>
                      <td className="py-2 pr-4">{entry.UPLOADED_BY}</td>
                      <td className="py-2 pr-4">
                        {new Date(entry.UPLOADED_AT).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">{entry.TOTAL_ROWS}</td>
                      <td className="py-2 pr-4">{entry.INSERTED_COUNT}</td>
                      <td className="py-2 pr-4">{entry.FAILED_COUNT}</td>
                      <td className="max-w-xs py-2">
                        {entry.FAILURE_REASONS ? (
                          <span
                            className="block truncate text-red-600"
                            title={entry.FAILURE_REASONS}
                          >
                            {entry.FAILURE_REASONS}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
