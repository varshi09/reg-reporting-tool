"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { detectUploadTable, UPLOAD_TABLES } from "@/lib/uploadTables";

type UploadResult = {
  targetTable: string;
  totalRows: number;
  insertedCount: number;
  skipped: { row: number; reason: string }[];
  errors: { row?: number; reason: string }[];
};

type LogEntry = {
  ID: number;
  TARGET_TABLE: string;
  FILE_NAME: string;
  TIME_KEY: string;
  UPLOADED_BY: string;
  UPLOADED_AT: string;
  TOTAL_ROWS: number;
  INSERTED_COUNT: number;
  FAILED_COUNT: number;
};

export default function UploadPage() {
  const { username } = useRequireAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [timeKey, setTimeKey] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [pendingTable, setPendingTable] = useState<{
    key: string;
    label: string;
  } | null>(null);

  const loadHistory = useCallback(async () => {
    const response = await fetch("/api/upload-log");
    if (!response.ok) return;
    const data = await response.json();
    setHistory(data.entries ?? []);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  function handleFileChange() {
    const file = fileInputRef.current?.files?.[0];
    setFileName(file ? file.name : "");
    setError("");
    setResult(null);
  }

  function handleUploadClick() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a .xlsx or .csv file first.");
      return;
    }
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".csv")) {
      setError("Only .xlsx or .csv files are accepted.");
      return;
    }
    if (!timeKey) {
      setError("Choose a reporting date first.");
      return;
    }

    const table = detectUploadTable(file.name);
    if (!table) {
      setError(
        "Could not determine which table this file belongs to from its name."
      );
      return;
    }

    setError("");
    setPendingTable({ key: table.key, label: table.label });
  }

  async function handleConfirmUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !pendingTable) return;

    setIsUploading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("timeKey", timeKey.replace(/-/g, ""));
    formData.append("uploadedBy", username);
    formData.append("confirmedTable", pendingTable.key);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }

      setResult(data);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFileName("");
      loadHistory();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setIsUploading(false);
      setPendingTable(null);
    }
  }

  return (
    <AppShell active="/upload" title="Upload data">
      <div className="flex flex-col gap-4">
        <div className="max-w-2xl rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-100 text-lg text-indigo-600">
            📤
          </span>
          <p className="mt-3 text-sm font-semibold text-zinc-900">
            Upload data
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            .xlsx or .csv file. The table it loads into is determined by the
            file name:
          </p>
          <ul className="mt-1 text-sm text-zinc-500">
            {UPLOAD_TABLES.map((t) => (
              <li key={t.key}>
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
                  {t.key}_YYYYMMDD.xlsx
                </code>{" "}
                or{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
                  {t.key}_YYYYMMDD.csv
                </code>{" "}
                (e.g. {t.key}_20260810.xlsx)
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-col gap-1.5">
            <label
              htmlFor="timeKey"
              className="text-sm font-medium text-zinc-700"
            >
              Reporting date
            </label>
            <input
              id="timeKey"
              type="date"
              value={timeKey}
              onChange={(e) => setTimeKey(e.target.value)}
              className="w-fit rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFileChange}
              className="text-sm text-zinc-600 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-100"
            />
          </div>

          <button
            onClick={handleUploadClick}
            disabled={isUploading || !fileName || !timeKey}
            className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {isUploading ? "Uploading..." : "Upload"}
          </button>

          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        {result && (
          <div className="max-w-2xl rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-100 text-lg text-emerald-600">
              ✅
            </span>
            <p className="mt-3 text-sm font-semibold text-zinc-900">
              {result.insertedCount} of {result.totalRows} rows loaded into{" "}
              {result.targetTable}
            </p>
            {(result.skipped.length > 0 || result.errors.length > 0) && (
              <ul className="mt-2 flex flex-col gap-1 text-sm text-red-600">
                {result.skipped.map((s, i) => (
                  <li key={`skip-${i}`}>Row {s.row}: {s.reason}</li>
                ))}
                {result.errors.map((e, i) => (
                  <li key={`err-${i}`}>
                    {e.row ? `Row ${e.row}: ` : ""}
                    {e.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-100 text-lg text-sky-600">
            🗂️
          </span>
          <p className="mt-3 text-sm font-semibold text-zinc-900">
            Upload history
          </p>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">
              No uploads yet.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500">
                    <th className="pb-2 pr-4 font-medium">Table</th>
                    <th className="pb-2 pr-4 font-medium">File</th>
                    <th className="pb-2 pr-4 font-medium">Time key</th>
                    <th className="pb-2 pr-4 font-medium">Uploaded by</th>
                    <th className="pb-2 pr-4 font-medium">Uploaded at</th>
                    <th className="pb-2 pr-4 font-medium">Total</th>
                    <th className="pb-2 pr-4 font-medium">Inserted</th>
                    <th className="pb-2 font-medium">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr
                      key={entry.ID}
                      className="border-t border-zinc-100 text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      <td className="py-2 pr-4">{entry.TARGET_TABLE}</td>
                      <td className="py-2 pr-4">{entry.FILE_NAME}</td>
                      <td className="py-2 pr-4">{entry.TIME_KEY}</td>
                      <td className="py-2 pr-4">{entry.UPLOADED_BY}</td>
                      <td className="py-2 pr-4">
                        {new Date(entry.UPLOADED_AT).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">{entry.TOTAL_ROWS}</td>
                      <td className="py-2 pr-4">{entry.INSERTED_COUNT}</td>
                      <td className="py-2">{entry.FAILED_COUNT}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {pendingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <p className="text-sm font-semibold text-zinc-900">
              Confirm upload
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              This file will be loaded into <strong>{pendingTable.key}</strong>{" "}
              ({pendingTable.label}). Continue?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPendingTable(null)}
                disabled={isUploading}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={isUploading}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {isUploading ? "Uploading..." : "Confirm upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
