"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import type { Brf01Metrics } from "@/lib/brf01Template";
import { BRF01_ENTITY_GROUPS, BRF01_DATA_SOURCES } from "@/lib/brf01Template";
import { getReportingPeriod } from "@/lib/reportingPeriod";
import type { Brf01DetailRow } from "@/lib/brf01Detail";

type Brf01Entry = {
  code: string;
  description: string;
  isHeader: boolean;
  metrics: Brf01Metrics;
};

type DrillTarget = {
  lineNo: string;
  description: string;
  resident: "RES" | "NONRES";
  currency: "AED" | "FCY";
  accounts: number | null;
  amount: number | null;
};

function fmt(value: number | null) {
  if (value === null || value === undefined) return "";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

/** A bucket cell (accounts or amount) that opens the drill-down when it has a real value. */
function DrillCell({
  value,
  isAmount,
  onClick,
}: {
  value: number | null;
  isAmount: boolean;
  onClick: () => void;
}) {
  const display = isAmount ? fmt(value) : (value ?? "");
  if (!value) {
    return <td className="border border-zinc-200 px-2 py-1 text-zinc-400">{display}</td>;
  }
  return (
    <td className="border border-zinc-200 px-2 py-1">
      <button
        onClick={onClick}
        className="w-full text-left text-indigo-700 underline decoration-dotted underline-offset-2 hover:text-indigo-900"
      >
        {display}
      </button>
    </td>
  );
}

function DrillDownModal({
  target,
  filters,
  onClose,
}: {
  target: DrillTarget;
  filters: { timeKey: string; entityGroups: string[]; dataSources: string[] };
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Brf01DetailRow[] | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    filters.entityGroups.forEach((eg) => params.append("entityGroup", eg));
    filters.dataSources.forEach((ds) => params.append("dataSource", ds));
    if (filters.timeKey) params.set("timeKey", filters.timeKey.replace(/-/g, ""));
    params.set("lineNo", target.lineNo);
    params.set("resident", target.resident);
    params.set("currency", target.currency);

    fetch(`/api/brf01/detail?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setRows(data.rows ?? []));
  }, [target, filters]);

  const residentLabel = target.resident === "RES" ? "Resident" : "Non-Resident";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[85vh] w-full max-w-6xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              {target.lineNo} — {target.description}
            </p>
            <p className="text-xs text-zinc-500">
              {residentLabel} · {target.currency} · {target.accounts ?? 0} a/cs · {fmt(target.amount)} AED
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">
          {rows === null ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No detail rows for this cell.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500">
                    <th className="py-2 pr-3 font-medium">Customer</th>
                    <th className="py-2 pr-3 font-medium">Customer No.</th>
                    <th className="py-2 pr-3 font-medium">Contract No.</th>
                    <th className="py-2 pr-3 font-medium">Currency</th>
                    <th className="py-2 pr-3 text-right font-medium">A/cs</th>
                    <th className="py-2 pr-3 text-right font-medium">Balance (AED)</th>
                    <th className="py-2 pr-3 font-medium">Sector</th>
                    <th className="py-2 pr-3 font-medium">Nationality</th>
                    <th className="py-2 pr-3 font-medium">Emirate</th>
                    <th className="py-2 pr-3 font-medium">Country</th>
                    <th className="py-2 pr-3 font-medium">GL Account</th>
                    <th className="py-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.customerNumber + r.contractNumber} className="border-b border-zinc-50 text-zinc-700">
                      <td className="py-2 pr-3 font-medium text-zinc-900">{r.customerName}</td>
                      <td className="py-2 pr-3 text-zinc-500">{r.customerNumber}</td>
                      <td className="py-2 pr-3 text-zinc-500">{r.contractNumber}</td>
                      <td className="py-2 pr-3 text-zinc-500">{r.currencyCode}</td>
                      <td className="py-2 pr-3 text-right text-zinc-500">{r.noOfAccounts}</td>
                      <td className="py-2 pr-3 text-right text-zinc-900">{fmt(r.closingBalanceAed)}</td>
                      <td className="py-2 pr-3 text-zinc-500">{r.sector ?? "—"}</td>
                      <td className="py-2 pr-3 text-zinc-500">{r.nationalityDesc ?? "—"}</td>
                      <td className="py-2 pr-3 text-zinc-500">{r.emirates ?? "—"}</td>
                      <td className="py-2 pr-3 text-zinc-500">{r.countryName ?? "—"}</td>
                      <td className="py-2 pr-3 text-zinc-500">{r.glAccountId ?? "—"}</td>
                      <td className="py-2 text-zinc-500">{r.target ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
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

  const [appliedFilters, setAppliedFilters] = useState<{
    timeKey: string;
    entityGroups: string[];
    dataSources: string[];
  } | null>(null);

  const [entries, setEntries] = useState<Brf01Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [drillTarget, setDrillTarget] = useState<DrillTarget | null>(null);

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
                  {entries.map((entry) => {
                    const m = entry.metrics;
                    const drill = (
                      resident: "RES" | "NONRES",
                      currency: "AED" | "FCY",
                      accounts: number | null,
                      amount: number | null
                    ) => () =>
                      setDrillTarget({
                        lineNo: entry.code,
                        description: entry.description,
                        resident,
                        currency,
                        accounts,
                        amount,
                      });
                    return (
                      <tr
                        key={entry.code}
                        className={entry.isHeader ? "bg-sky-100 font-semibold" : "hover:bg-zinc-50 transition-colors"}
                      >
                        <td className="border border-zinc-200 px-2 py-1">{entry.code}</td>
                        <td className="border border-zinc-200 px-2 py-1">{entry.description}</td>
                        <DrillCell value={m.resAedAccounts} isAmount={false} onClick={drill("RES", "AED", m.resAedAccounts, m.resAedAmount)} />
                        <DrillCell value={m.resAedAmount} isAmount={true} onClick={drill("RES", "AED", m.resAedAccounts, m.resAedAmount)} />
                        <DrillCell value={m.resFcyAccounts} isAmount={false} onClick={drill("RES", "FCY", m.resFcyAccounts, m.resFcyAmount)} />
                        <DrillCell value={m.resFcyAmount} isAmount={true} onClick={drill("RES", "FCY", m.resFcyAccounts, m.resFcyAmount)} />
                        <DrillCell value={m.nonresAedAccounts} isAmount={false} onClick={drill("NONRES", "AED", m.nonresAedAccounts, m.nonresAedAmount)} />
                        <DrillCell value={m.nonresAedAmount} isAmount={true} onClick={drill("NONRES", "AED", m.nonresAedAccounts, m.nonresAedAmount)} />
                        <DrillCell value={m.nonresFcyAccounts} isAmount={false} onClick={drill("NONRES", "FCY", m.nonresFcyAccounts, m.nonresFcyAmount)} />
                        <DrillCell value={m.nonresFcyAmount} isAmount={true} onClick={drill("NONRES", "FCY", m.nonresFcyAccounts, m.nonresFcyAmount)} />
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

      {drillTarget && appliedFilters && (
        <DrillDownModal
          target={drillTarget}
          filters={appliedFilters}
          onClose={() => setDrillTarget(null)}
        />
      )}
    </AppShell>
  );
}
