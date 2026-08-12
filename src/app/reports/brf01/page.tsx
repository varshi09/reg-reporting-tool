"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import type { Brf01Metrics } from "@/lib/brf01Template";
import { BRF01_ENTITY_GROUPS, BRF01_DATA_SOURCES } from "@/lib/brf01Template";

type Brf01Entry = {
  code: string;
  description: string;
  isHeader: boolean;
  metrics: Brf01Metrics;
};

function fmt(value: number | null) {
  if (value === null || value === undefined) return "";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function toDateInputValue(timeKey: string) {
  if (timeKey.length !== 8) return "";
  return `${timeKey.slice(0, 4)}-${timeKey.slice(4, 6)}-${timeKey.slice(6, 8)}`;
}

export default function Brf01ReportPage() {
  const [draftTimeKey, setDraftTimeKey] = useState("");
  const [draftEntityGroups, setDraftEntityGroups] = useState<string[]>([BRF01_ENTITY_GROUPS[0]]);
  const [draftDataSources, setDraftDataSources] = useState<string[]>([BRF01_DATA_SOURCES[0]]);

  const [appliedFilters, setAppliedFilters] = useState<{
    timeKey: string;
    entityGroups: string[];
    dataSources: string[];
  } | null>(null);

  const [entries, setEntries] = useState<Brf01Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initDefaults() {
      const response = await fetch("/api/brf01/latest-time-key");
      const data = response.ok ? await response.json() : { timeKey: null };
      const latest = data.timeKey ? toDateInputValue(data.timeKey) : "";
      setDraftTimeKey(latest);
      setAppliedFilters({
        timeKey: latest,
        entityGroups: [BRF01_ENTITY_GROUPS[0]],
        dataSources: [BRF01_DATA_SOURCES[0]],
      });
    }
    initDefaults();
  }, []);

  const loadEntries = useCallback(async () => {
    if (!appliedFilters) return;
    setIsLoading(true);
    const params = new URLSearchParams();
    appliedFilters.entityGroups.forEach((eg) => params.append("entityGroup", eg));
    appliedFilters.dataSources.forEach((ds) => params.append("dataSource", ds));
    if (appliedFilters.timeKey) {
      params.set("timeKey", appliedFilters.timeKey.replace(/-/g, ""));
    }

    const response = await fetch(`/api/brf01?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      setEntries(data.entries ?? []);
    }
    setIsLoading(false);
  }, [appliedFilters]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  function handleApply() {
    setAppliedFilters({
      timeKey: draftTimeKey,
      entityGroups: draftEntityGroups,
      dataSources: draftDataSources,
    });
  }

  function handleDownload() {
    if (!appliedFilters) return;
    const params = new URLSearchParams();
    appliedFilters.entityGroups.forEach((eg) => params.append("entityGroup", eg));
    appliedFilters.dataSources.forEach((ds) => params.append("dataSource", ds));
    if (appliedFilters.timeKey) {
      params.set("timeKey", appliedFilters.timeKey.replace(/-/g, ""));
    }
    window.location.href = `/api/brf01/export?${params.toString()}`;
  }

  return (
    <AppShell active="/reports" title="BRF 01 - Assets">
      <div className="flex flex-col gap-4">
        <a
          href="/reports"
          className="w-fit text-sm text-zinc-500 hover:text-black"
        >
          ← Back to reports
        </a>

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-semibold text-black">
              CBUAE Banking Return Form 01 — Assets
            </p>
            <button
              onClick={handleDownload}
              className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Download Report
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-6">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="timeKeyFilter"
                className="text-sm font-medium text-black"
              >
                Time key
              </label>
              <input
                id="timeKeyFilter"
                type="date"
                value={draftTimeKey}
                onChange={(e) => setDraftTimeKey(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
            </div>

            <MultiSelectDropdown
              label="Entity group"
              options={BRF01_ENTITY_GROUPS}
              selected={draftEntityGroups}
              onChange={setDraftEntityGroups}
            />

            <MultiSelectDropdown
              label="Data source"
              options={BRF01_DATA_SOURCES}
              selected={draftDataSources}
              onChange={setDraftDataSources}
            />

            <button
              onClick={handleApply}
              disabled={draftEntityGroups.length === 0 || draftDataSources.length === 0}
              className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              Apply filter
            </button>
          </div>
          {(draftEntityGroups.length === 0 || draftDataSources.length === 0) && (
            <p className="mt-2 text-sm text-red-600">
              Select at least one entity group and one data source.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full border-collapse text-left text-sm text-zinc-900">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th rowSpan={3} className="border border-sky-400 bg-sky-300 px-2 py-2 align-bottom font-semibold text-sky-950">Line No</th>
                    <th rowSpan={3} className="border border-sky-400 bg-sky-300 px-2 py-2 align-bottom font-semibold text-sky-950">Description</th>
                    <th colSpan={4} className="border border-sky-400 bg-sky-300 px-2 py-1 text-center font-semibold text-sky-950">RESIDENT</th>
                    <th colSpan={4} className="border border-sky-400 bg-sky-300 px-2 py-1 text-center font-semibold text-sky-950">NON-RESIDENT</th>
                    <th colSpan={2} rowSpan={2} className="border border-sky-400 bg-sky-300 px-2 py-1 text-center font-semibold text-sky-950">TOTAL</th>
                  </tr>
                  <tr>
                    <th colSpan={2} className="border border-sky-400 bg-sky-300 px-2 py-1 text-center font-semibold text-sky-950">AED</th>
                    <th colSpan={2} className="border border-sky-400 bg-sky-300 px-2 py-1 text-center font-semibold text-sky-950">FCY</th>
                    <th colSpan={2} className="border border-sky-400 bg-sky-300 px-2 py-1 text-center font-semibold text-sky-950">AED</th>
                    <th colSpan={2} className="border border-sky-400 bg-sky-300 px-2 py-1 text-center font-semibold text-sky-950">FCY</th>
                  </tr>
                  <tr>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">A/cs</th>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">Amount</th>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">A/cs</th>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">Amount</th>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">A/cs</th>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">Amount</th>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">A/cs</th>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">Amount</th>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">A/cs</th>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.code}
                      className={entry.isHeader ? "bg-sky-100 font-semibold" : "hover:bg-zinc-50 transition-colors"}
                    >
                      <td className="border border-zinc-200 px-2 py-1">{entry.code}</td>
                      <td className="border border-zinc-200 px-2 py-1">{entry.description}</td>
                      <td className="border border-zinc-200 px-2 py-1">{entry.metrics.resAedAccounts ?? ""}</td>
                      <td className="border border-zinc-200 px-2 py-1">{fmt(entry.metrics.resAedAmount)}</td>
                      <td className="border border-zinc-200 px-2 py-1">{entry.metrics.resFcyAccounts ?? ""}</td>
                      <td className="border border-zinc-200 px-2 py-1">{fmt(entry.metrics.resFcyAmount)}</td>
                      <td className="border border-zinc-200 px-2 py-1">{entry.metrics.nonresAedAccounts ?? ""}</td>
                      <td className="border border-zinc-200 px-2 py-1">{fmt(entry.metrics.nonresAedAmount)}</td>
                      <td className="border border-zinc-200 px-2 py-1">{entry.metrics.nonresFcyAccounts ?? ""}</td>
                      <td className="border border-zinc-200 px-2 py-1">{fmt(entry.metrics.nonresFcyAmount)}</td>
                      <td className="border border-zinc-200 px-2 py-1">{entry.metrics.totalAccounts ?? ""}</td>
                      <td className="border border-zinc-200 px-2 py-1">{fmt(entry.metrics.totalAmount)}</td>
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
