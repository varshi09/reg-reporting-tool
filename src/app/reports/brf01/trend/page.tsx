"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import type { Brf01TrendEntry } from "@/lib/brf01Trend";

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatPeriodLabel(timeKey: string): string {
  if (timeKey.length !== 8) return timeKey;
  const year = timeKey.slice(0, 4);
  const month = Number(timeKey.slice(4, 6));
  const day = Number(timeKey.slice(6, 8));
  return `${day} ${SHORT_MONTH_NAMES[month - 1]} ${year}`;
}

function fmt(value: number | null) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function fmtInt(value: number | null) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString();
}

function fmtPct(value: number | null) {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function varianceColor(value: number | null): string {
  if (value === null || value === 0) return "text-zinc-500";
  return value > 0 ? "text-emerald-600" : "text-red-600";
}

type Context = { entityGroups: string[]; dataSources: string[] };

function readContext(): Context {
  if (typeof window === "undefined") return { entityGroups: [], dataSources: [] };
  const params = new URLSearchParams(window.location.search);
  return {
    entityGroups: params.getAll("entityGroup"),
    dataSources: params.getAll("dataSource"),
  };
}

function readInitialTimeKey(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("timeKey") ?? "";
}

export default function Brf01TrendPage() {
  const [context] = useState<Context>(readContext);
  const [periods, setPeriods] = useState<string[] | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState(readInitialTimeKey);
  const [comparePeriod, setComparePeriod] = useState("");
  const [entries, setEntries] = useState<Brf01TrendEntry[] | null>(null);

  // Load available periods once, then default current/compare if not
  // already resolvable - "previous" is the most recent period strictly
  // earlier than "current" that actually has data, since periods here
  // aren't consecutive calendar months.
  useEffect(() => {
    fetch("/api/brf01/periods")
      .then((r) => r.json())
      .then((data: { periods: string[] }) => {
        const list = data.periods ?? [];
        setPeriods(list);
        setCurrentPeriod((cur) => (cur && list.includes(cur) ? cur : list[0] ?? ""));
      });
  }, []);

  useEffect(() => {
    if (!periods || !currentPeriod) return;
    setComparePeriod((cmp) => {
      if (cmp && periods.includes(cmp) && cmp !== currentPeriod) return cmp;
      const earlier = periods.filter((p) => p < currentPeriod);
      return earlier[0] ?? "";
    });
  }, [periods, currentPeriod]);

  useEffect(() => {
    if (!currentPeriod || !comparePeriod) return;
    const params = new URLSearchParams();
    context.entityGroups.forEach((eg) => params.append("entityGroup", eg));
    context.dataSources.forEach((ds) => params.append("dataSource", ds));
    params.set("currentTimeKey", currentPeriod);
    params.set("previousTimeKey", comparePeriod);

    setEntries(null);
    fetch(`/api/brf01/trend?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setEntries(data.entries ?? []));
  }, [currentPeriod, comparePeriod, context]);

  return (
    <AppShell active="/reports" title="BRF 01 - Trend Analysis">
      <div className="flex flex-col gap-4">
        <a href="/reports/brf01" className="w-fit text-sm text-zinc-500 hover:text-black">
          ← Back to BRF 01 summary
        </a>

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          <p className="text-sm font-semibold text-black">CBUAE Banking Return Form 01 — Trend Analysis</p>
          <p className="mt-1 text-sm text-zinc-500">
            {context.entityGroups.join(", ") || "All entities"} · {context.dataSources.join(", ") || "All sources"}
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="currentPeriod" className="text-sm font-medium text-black">
                Current period
              </label>
              <select
                id="currentPeriod"
                value={currentPeriod}
                onChange={(e) => setCurrentPeriod(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              >
                {(periods ?? []).map((p) => (
                  <option key={p} value={p}>
                    {formatPeriodLabel(p)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="comparePeriod" className="text-sm font-medium text-black">
                Compare to
              </label>
              <select
                id="comparePeriod"
                value={comparePeriod}
                onChange={(e) => setComparePeriod(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              >
                {(periods ?? []).map((p) => (
                  <option key={p} value={p}>
                    {formatPeriodLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {periods && periods.length < 2 && (
            <p className="mt-2 text-sm text-amber-700">Only one period has data — nothing to compare yet.</p>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          {entries === null ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full border-collapse text-left text-sm text-zinc-900">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th rowSpan={2} className="border border-sky-400 bg-sky-300 px-2 py-2 align-bottom font-semibold text-sky-950">Line No</th>
                    <th rowSpan={2} className="border border-sky-400 bg-sky-300 px-2 py-2 align-bottom font-semibold text-sky-950">Description</th>
                    <th colSpan={2} className="border border-sky-400 bg-sky-300 px-2 py-1 text-center font-semibold text-sky-950">
                      {formatPeriodLabel(currentPeriod)}
                    </th>
                    <th colSpan={2} className="border border-sky-400 bg-sky-300 px-2 py-1 text-center font-semibold text-sky-950">
                      {formatPeriodLabel(comparePeriod)}
                    </th>
                    <th colSpan={3} className="border border-sky-400 bg-sky-300 px-2 py-1 text-center font-semibold text-sky-950">Variance</th>
                  </tr>
                  <tr>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">A/cs</th>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">Amount</th>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">A/cs</th>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">Amount</th>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">A/cs</th>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">Amount</th>
                    <th className="border border-sky-400 bg-sky-300 px-2 py-1 text-xs font-medium text-sky-950">%</th>
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
                      <td className="border border-zinc-200 px-2 py-1">{fmtInt(entry.currentAccounts)}</td>
                      <td className="border border-zinc-200 px-2 py-1">{fmt(entry.currentAmount)}</td>
                      <td className="border border-zinc-200 px-2 py-1">{fmtInt(entry.previousAccounts)}</td>
                      <td className="border border-zinc-200 px-2 py-1">{fmt(entry.previousAmount)}</td>
                      <td className={`border border-zinc-200 px-2 py-1 ${varianceColor(entry.varianceAccounts)}`}>
                        {entry.varianceAccounts !== null && entry.varianceAccounts > 0 ? "+" : ""}
                        {fmtInt(entry.varianceAccounts)}
                      </td>
                      <td className={`border border-zinc-200 px-2 py-1 ${varianceColor(entry.varianceAmount)}`}>
                        {entry.varianceAmount !== null && entry.varianceAmount > 0 ? "+" : ""}
                        {fmt(entry.varianceAmount)}
                      </td>
                      <td className={`border border-zinc-200 px-2 py-1 ${varianceColor(entry.variancePct)}`}>
                        {fmtPct(entry.variancePct)}
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
