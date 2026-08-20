"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import type { Brf01Metrics } from "@/lib/brf01Template";
import { BRF01_ENTITY_GROUPS, BRF01_DATA_SOURCES } from "@/lib/brf01Template";
import { getReportingPeriod } from "@/lib/reportingPeriod";

type Brf01Entry = {
  code: string;
  description: string;
  isHeader: boolean;
  metrics: Brf01Metrics;
};

type AppliedFilters = { timeKey: string; entityGroups: string[]; dataSources: string[] };

function fmt(value: number | null) {
  if (value === null || value === undefined) return "";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function buildDrillUrl(
  filters: AppliedFilters,
  workingDay: string,
  lineNo: string,
  resident: "RES" | "NONRES",
  currency: "AED" | "FCY"
): string {
  const params = new URLSearchParams();
  filters.entityGroups.forEach((eg) => params.append("entityGroup", eg));
  filters.dataSources.forEach((ds) => params.append("dataSource", ds));
  if (filters.timeKey) params.set("timeKey", filters.timeKey.replace(/-/g, ""));
  if (workingDay) params.set("workingDay", workingDay);
  params.set("lineNo", lineNo);
  params.set("resident", resident);
  params.set("currency", currency);
  return `/reports/brf01/detail?${params.toString()}`;
}

function buildTrendUrl(filters: AppliedFilters): string {
  const params = new URLSearchParams();
  filters.entityGroups.forEach((eg) => params.append("entityGroup", eg));
  filters.dataSources.forEach((ds) => params.append("dataSource", ds));
  if (filters.timeKey) params.set("timeKey", filters.timeKey.replace(/-/g, ""));
  return `/reports/brf01/trend?${params.toString()}`;
}

/** A bucket cell (accounts or amount) that opens the drill-down page in a new tab when it has a real value. */
function DrillCell({
  value,
  isAmount,
  href,
}: {
  value: number | null;
  isAmount: boolean;
  href: string;
}) {
  const display = isAmount ? fmt(value) : (value ?? "");
  if (!value) {
    return <td className="border border-zinc-200 px-2 py-1 text-zinc-400">{display}</td>;
  }
  return (
    <td className="border border-zinc-200 px-2 py-1">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-indigo-700 underline decoration-dotted underline-offset-2 hover:text-indigo-900"
      >
        {display}
      </a>
    </td>
  );
}

function toDateInputValue(timeKey: string) {
  if (timeKey.length !== 8) return "";
  return `${timeKey.slice(0, 4)}-${timeKey.slice(4, 6)}-${timeKey.slice(6, 8)}`;
}

export default function Brf01ReportPage() {
  const [draftTimeKey, setDraftTimeKey] = useState("");
  const [draftEntityGroups, setDraftEntityGroups] = useState<string[]>([BRF01_ENTITY_GROUPS[0]]);
  const [draftDataSources, setDraftDataSources] = useState<string[]>([BRF01_DATA_SOURCES[0]]);

  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters | null>(null);

  const [entries, setEntries] = useState<Brf01Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [workingDayInfo, setWorkingDayInfo] = useState<{ current: string; history: string[] } | null>(null);
  const [selectedWorkingDay, setSelectedWorkingDay] = useState("");

  useEffect(() => {
    const defaultTimeKey = toDateInputValue(getReportingPeriod().timeKey);
    setDraftTimeKey(defaultTimeKey);
    setAppliedFilters({
      timeKey: defaultTimeKey,
      entityGroups: [BRF01_ENTITY_GROUPS[0]],
      dataSources: [BRF01_DATA_SOURCES[0]],
    });
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
    if (selectedWorkingDay) params.set("workingDay", selectedWorkingDay);

    const response = await fetch(`/api/brf01?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      setEntries(data.entries ?? []);
      const history: string[] = data.workingDayHistory ?? ["WD1"];
      setWorkingDayInfo({ current: data.workingDay ?? "WD1", history });
      setSelectedWorkingDay((cur) => (cur && history.includes(cur) ? cur : (data.workingDay ?? "WD1")));
    }
    setIsLoading(false);
  }, [appliedFilters, selectedWorkingDay]);

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
    if (selectedWorkingDay) params.set("workingDay", selectedWorkingDay);
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
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={appliedFilters ? buildTrendUrl(appliedFilters) : "#"}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Analysis
              </a>
              <button
                onClick={handleDownload}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Download Report
              </button>
            </div>
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

            {workingDayInfo && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="workingDayFilter" className="text-sm font-medium text-black">
                  Working day
                </label>
                <select
                  id="workingDayFilter"
                  value={selectedWorkingDay}
                  onChange={(e) => setSelectedWorkingDay(e.target.value)}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                >
                  {workingDayInfo.history.map((wd) => (
                    <option key={wd} value={wd}>
                      {wd}{wd === workingDayInfo.current && wd !== "WD1" ? " (current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
          <p className="mt-3 text-xs text-zinc-400">
            Click any A/cs or Amount cell to drill down into the underlying records (opens in a new tab).
          </p>
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
                  {entries.map((entry) => {
                    const m = entry.metrics;
                    const url = (resident: "RES" | "NONRES", currency: "AED" | "FCY") =>
                      appliedFilters ? buildDrillUrl(appliedFilters, selectedWorkingDay, entry.code, resident, currency) : "#";
                    return (
                      <tr
                        key={entry.code}
                        className={entry.isHeader ? "bg-sky-100 font-semibold" : "hover:bg-zinc-50 transition-colors"}
                      >
                        <td className="border border-zinc-200 px-2 py-1">{entry.code}</td>
                        <td className="border border-zinc-200 px-2 py-1">{entry.description}</td>
                        <DrillCell value={m.resAedAccounts} isAmount={false} href={url("RES", "AED")} />
                        <DrillCell value={m.resAedAmount} isAmount={true} href={url("RES", "AED")} />
                        <DrillCell value={m.resFcyAccounts} isAmount={false} href={url("RES", "FCY")} />
                        <DrillCell value={m.resFcyAmount} isAmount={true} href={url("RES", "FCY")} />
                        <DrillCell value={m.nonresAedAccounts} isAmount={false} href={url("NONRES", "AED")} />
                        <DrillCell value={m.nonresAedAmount} isAmount={true} href={url("NONRES", "AED")} />
                        <DrillCell value={m.nonresFcyAccounts} isAmount={false} href={url("NONRES", "FCY")} />
                        <DrillCell value={m.nonresFcyAmount} isAmount={true} href={url("NONRES", "FCY")} />
                        <td className="border border-zinc-200 px-2 py-1">{m.totalAccounts ?? ""}</td>
                        <td className="border border-zinc-200 px-2 py-1">{fmt(m.totalAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
