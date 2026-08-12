"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { DragEvent } from "react";
import AppShell from "@/components/AppShell";
import { IconFolder } from "@/components/icons";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { UPLOAD_TABLES } from "@/lib/uploadTables";
import type { ValidationIssue } from "@/lib/uploadParser";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

type UploadResult = {
  targetTable: string;
  totalRows: number;
  insertedCount: number;
  skipped: { row: number; reason: string }[];
  errors: { row?: number; reason: string }[];
};

type UploadPreview = {
  fileName: string;
  targetTable: string;
  targetLabel: string;
  rowCount: number;
  columnsMatched: number;
  columnsExpected: number;
  validations: ValidationIssue[];
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "FILE" : name.slice(dot + 1).toUpperCase();
}

export default function UploadPage() {
  const { username } = useRequireAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [targetTable, setTargetTable] = useState(UPLOAD_TABLES[0]?.key ?? "");
  const [timeKey, setTimeKey] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [history, setHistory] = useState<LogEntry[]>([]);

  const loadHistory = useCallback(async () => {
    const response = await fetch("/api/upload-log");
    if (!response.ok) return;
    const data = await response.json();
    setHistory(data.entries ?? []);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  function acceptFile(candidate: File | undefined | null) {
    setError("");
    setResult(null);

    if (!candidate) {
      setFile(null);
      return;
    }

    const lowerName = candidate.name.toLowerCase();
    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".csv")) {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setError("Only .xlsx or .csv files are accepted.");
      return;
    }

    if (candidate.size > MAX_FILE_BYTES) {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setError(
        `That file is ${formatBytes(candidate.size)}. The maximum size is 50 MB.`
      );
      return;
    }

    setFile(candidate);
  }

  function handleFileChange() {
    acceptFile(fileInputRef.current?.files?.[0]);
  }

  function clearFile() {
    setFile(null);
    setError("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    acceptFile(event.dataTransfer.files?.[0]);
  }

  async function handleValidateClick() {
    if (!file) {
      setError("Choose a .xlsx or .csv file first.");
      return;
    }
    if (!targetTable) {
      setError("Choose a data type first.");
      return;
    }
    if (!timeKey) {
      setError("Choose a reporting date first.");
      return;
    }

    setIsPreviewing(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("timeKey", timeKey.replace(/-/g, ""));
    formData.append("targetTable", targetTable);

    try {
      const response = await fetch("/api/upload/preview", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not read that file.");
        return;
      }

      setPreview(data);
    } catch {
      setError("Could not read that file. Check your connection and try again.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleConfirmUpload() {
    if (!file || !preview) return;

    setIsUploading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("timeKey", timeKey.replace(/-/g, ""));
    formData.append("uploadedBy", username);
    formData.append("targetTable", preview.targetTable);

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
      clearFile();
      loadHistory();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setIsUploading(false);
      setPreview(null);
    }
  }

  const reportingDateLabel = timeKey || "Not set";

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
            Pick the data type, choose the reporting date, then drop in an .xlsx
            or .csv file. The file name does not matter.
          </p>

          <div className="mt-4 flex flex-col gap-1.5">
            <label
              htmlFor="targetTable"
              className="text-sm font-medium text-zinc-700"
            >
              Data type
            </label>
            <select
              id="targetTable"
              value={targetTable}
              onChange={(e) => {
                setTargetTable(e.target.value);
                setError("");
                setResult(null);
              }}
              className="w-fit rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
            >
              {UPLOAD_TABLES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

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

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-4 flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
              isDragActive
                ? "border-indigo-400 bg-indigo-50"
                : "border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/60"
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
              <IconFolder className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-zinc-900">
              Drag &amp; drop your file here
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              or click to browse — any file name, max 50 MB
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="mt-3 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              Browse files
            </button>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                XLSX
              </span>
              <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                CSV
              </span>
            </div>
          </div>

          {file && (
            <div className="mt-3 flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white text-[10px] font-semibold text-zinc-600 ring-1 ring-zinc-200">
                {fileExtension(file.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {file.name}
                </p>
                <p className="text-xs text-zinc-500">
                  → {targetTable} · {formatBytes(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={clearFile}
                aria-label="Remove selected file"
                className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700"
              >
                ×
              </button>
            </div>
          )}

          <button
            onClick={handleValidateClick}
            disabled={isPreviewing || isUploading || !file || !timeKey}
            className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {isPreviewing ? "Validating..." : "Validate & upload"}
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
              Load complete — {result.targetTable}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-lg font-semibold text-emerald-700">
                  {result.insertedCount}
                </p>
                <p className="text-xs text-emerald-700">Inserted</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-lg font-semibold text-amber-700">
                  {result.skipped.length}
                </p>
                <p className="text-xs text-amber-700">Skipped</p>
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="text-lg font-semibold text-zinc-700">
                  {result.errors.length}
                </p>
                <p className="text-xs text-zinc-600">Failed</p>
              </div>
            </div>
            {(result.skipped.length > 0 || result.errors.length > 0) && (
              <ul className="mt-3 flex flex-col gap-1 text-sm text-red-600">
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

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <p className="text-sm font-semibold text-zinc-900">
              Confirm data load
            </p>

            <div className="mt-3 flex flex-col gap-1 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
              <p className="truncate">
                <span className="text-zinc-500">File:</span> {preview.fileName}
              </p>
              <p>
                <span className="text-zinc-500">Target table:</span>{" "}
                <strong className="text-zinc-900">{preview.targetTable}</strong>{" "}
                ({preview.targetLabel})
              </p>
              <p>
                <span className="text-zinc-500">Reporting date:</span>{" "}
                {reportingDateLabel}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2">
                <p className="text-lg font-semibold text-indigo-700">
                  {preview.rowCount}
                </p>
                <p className="text-xs text-indigo-700">Rows found</p>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-lg font-semibold text-emerald-700">
                  {preview.columnsMatched} / {preview.columnsExpected}
                </p>
                <p className="text-xs text-emerald-700">Columns matched</p>
              </div>
            </div>

            <div className="mt-3 rounded-md border border-dashed border-zinc-300 px-3 py-2">
              <p className="text-xs font-medium text-zinc-700">Validations</p>
              {preview.validations.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-500">
                  No validation rules configured for this data type yet.
                </p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1 text-xs">
                  {preview.validations.map((issue, i) => (
                    <li
                      key={`validation-${i}`}
                      className={
                        issue.severity === "error"
                          ? "text-red-600"
                          : "text-amber-600"
                      }
                    >
                      {issue.row ? `Row ${issue.row}: ` : ""}
                      {issue.column ? `${issue.column} — ` : ""}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPreview(null)}
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
                {isUploading ? "Loading..." : "Confirm & load"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
