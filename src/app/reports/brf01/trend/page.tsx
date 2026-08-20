"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import type { Brf01TrendEntry } from "@/lib/brf01Trend";

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Categorical slots 1 & 2 from the design system's validated palette -
// fixed order, never cycled: blue always means "current period", orange
// always means "compare period", across every chart on this page.
const SERIES_CURRENT = "#2a78d6";
const SERIES_PREVIOUS = "#eb6834";
const AXIS_INK = "#898781";
const GRIDLINE = "#e1e0d9";
const SECONDARY_INK = "#52514e";

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

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

/** One "grand total" mini bar chart: two bars (current vs previous), one measure, own scale. */
function GrandTotalBar({
  title,
  currentLabel,
  previousLabel,
  currentValue,
  previousValue,
  formatValue,
}: {
  title: string;
  currentLabel: string;
  previousLabel: string;
  currentValue: number;
  previousValue: number;
  formatValue: (v: number) => string;
}) {
  const maxValue = Math.max(currentValue, previousValue, 1) * 1.15;
  const plotHeight = 160;
  const barWidth = 64;
  const bars = [
    { label: currentLabel, value: currentValue, color: SERIES_CURRENT },
    { label: previousLabel, value: previousValue, color: SERIES_PREVIOUS },
  ];

  return (
    <div className="flex-1 rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <svg viewBox={`0 0 220 ${plotHeight + 40}`} className="mt-2 w-full" role="img" aria-label={title}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={40}
            x2={220}
            y1={plotHeight - plotHeight * t + 10}
            y2={plotHeight - plotHeight * t + 10}
            stroke={GRIDLINE}
            strokeWidth={1}
          />
        ))}
        {[0, 0.5, 1].map((t) => (
          <text key={t} x={36} y={plotHeight - plotHeight * t + 14} textAnchor="end" fontSize={9} fill={AXIS_INK}>
            {formatCompact(maxValue * t)}
          </text>
        ))}
        {bars.map((bar, i) => {
          const h = (bar.value / maxValue) * plotHeight;
          const x = 60 + i * 100;
          const y = plotHeight - h + 10;
          return (
            <g key={bar.label}>
              <title>{`${bar.label}: ${formatValue(bar.value)}`}</title>
              <rect x={x} y={y} width={barWidth} height={h} rx={4} fill={bar.color} />
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={600} fill={SECONDARY_INK}>
                {formatCompact(bar.value)}
              </text>
              <text x={x + barWidth / 2} y={plotHeight + 26} textAnchor="middle" fontSize={9} fill={AXIS_INK}>
                {bar.label}
              </text>
            </g>
          );
        })}
        <line x1={40} x2={220} y1={plotHeight + 10} y2={plotHeight + 10} stroke="#c3c2b7" strokeWidth={1} />
      </svg>
    </div>
  );
}

/** Grouped bar chart, current vs previous Total Amount, one group per leaf line - horizontally scrollable. */
function ByLineChart({
  entries,
  currentLabel,
  previousLabel,
}: {
  entries: Brf01TrendEntry[];
  currentLabel: string;
  previousLabel: string;
}) {
  const leaf = entries.filter((e) => !e.isHeader);
  const maxValue =
    Math.max(1, ...leaf.flatMap((e) => [e.currentAmount ?? 0, e.previousAmount ?? 0])) * 1.1;

  const plotHeight = 220;
  const barWidth = 8;
  const barGap = 2;
  const groupWidth = barWidth * 2 + barGap;
  const groupGap = 16;
  const groupSlot = groupWidth + groupGap;
  const chartWidth = Math.max(leaf.length * groupSlot + 20, 400);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  if (leaf.length === 0) {
    return <p className="text-sm text-zinc-500">No line-level data for these periods.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-zinc-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_CURRENT }} />
          {currentLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_PREVIOUS }} />
          {previousLabel}
        </span>
      </div>
      <div className="flex">
        <svg width={44} height={plotHeight + 34} className="shrink-0" role="presentation">
          {ticks.map((t) => (
            <text key={t} x={40} y={plotHeight - plotHeight * t + 14} textAnchor="end" fontSize={9} fill={AXIS_INK}>
              {formatCompact(maxValue * t)}
            </text>
          ))}
        </svg>
        <div className="overflow-x-auto">
          <svg width={chartWidth} height={plotHeight + 34} role="img" aria-label="Total amount by line, current vs previous period">
            {ticks.map((t) => (
              <line
                key={t}
                x1={0}
                x2={chartWidth}
                y1={plotHeight - plotHeight * t + 10}
                y2={plotHeight - plotHeight * t + 10}
                stroke={GRIDLINE}
                strokeWidth={1}
              />
            ))}
            {leaf.map((entry, i) => {
              const cur = entry.currentAmount ?? 0;
              const prev = entry.previousAmount ?? 0;
              const curH = (cur / maxValue) * plotHeight;
              const prevH = (prev / maxValue) * plotHeight;
              const gx = 10 + i * groupSlot;
              return (
                <g key={entry.code}>
                  <title>
                    {`${entry.code} — ${entry.description}\n${currentLabel}: ${fmt(entry.currentAmount)}\n${previousLabel}: ${fmt(entry.previousAmount)}`}
                  </title>
                  <rect x={gx} y={plotHeight - curH + 10} width={barWidth} height={curH} rx={2} fill={SERIES_CURRENT} />
                  <rect
                    x={gx + barWidth + barGap}
                    y={plotHeight - prevH + 10}
                    width={barWidth}
                    height={prevH}
                    rx={2}
                    fill={SERIES_PREVIOUS}
                  />
                  <text
                    x={gx + groupWidth / 2}
                    y={plotHeight + 24}
                    textAnchor="middle"
                    fontSize={8}
                    fill={AXIS_INK}
                    transform={`rotate(-60 ${gx + groupWidth / 2} ${plotHeight + 24})`}
                  >
                    {entry.code}
                  </text>
                </g>
              );
            })}
            <line x1={0} x2={chartWidth} y1={plotHeight + 10} y2={plotHeight + 10} stroke="#c3c2b7" strokeWidth={1} />
          </svg>
        </div>
      </div>
    </div>
  );
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

type WdInfo = { current: string; history: string[] };

export default function Brf01TrendPage() {
  const [context] = useState<Context>(readContext);
  const [periods, setPeriods] = useState<string[] | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState(readInitialTimeKey);
  const [comparePeriod, setComparePeriod] = useState("");
  const [currentWdInfo, setCurrentWdInfo] = useState<WdInfo | null>(null);
  const [compareWdInfo, setCompareWdInfo] = useState<WdInfo | null>(null);
  const [selectedCurrentWd, setSelectedCurrentWd] = useState("");
  const [selectedCompareWd, setSelectedCompareWd] = useState("");
  const [entries, setEntries] = useState<Brf01TrendEntry[] | null>(null);
  const [showTable, setShowTable] = useState(false);

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

  // Each period has its own independent working-day history - fetched
  // fresh whenever that side's period changes, defaulting to that
  // period's own latest working day.
  useEffect(() => {
    if (!currentPeriod) return;
    fetch(`/api/brf01/working-days?timeKey=${currentPeriod}`)
      .then((r) => r.json())
      .then((info: WdInfo) => {
        setCurrentWdInfo(info);
        setSelectedCurrentWd((cur) => (cur && info.history.includes(cur) ? cur : info.current));
      });
  }, [currentPeriod]);

  useEffect(() => {
    if (!comparePeriod) return;
    fetch(`/api/brf01/working-days?timeKey=${comparePeriod}`)
      .then((r) => r.json())
      .then((info: WdInfo) => {
        setCompareWdInfo(info);
        setSelectedCompareWd((cur) => (cur && info.history.includes(cur) ? cur : info.current));
      });
  }, [comparePeriod]);

  useEffect(() => {
    if (!currentPeriod || !comparePeriod || !selectedCurrentWd || !selectedCompareWd) return;
    const params = new URLSearchParams();
    context.entityGroups.forEach((eg) => params.append("entityGroup", eg));
    context.dataSources.forEach((ds) => params.append("dataSource", ds));
    params.set("currentTimeKey", currentPeriod);
    params.set("previousTimeKey", comparePeriod);
    params.set("currentWorkingDay", selectedCurrentWd);
    params.set("previousWorkingDay", selectedCompareWd);

    setEntries(null);
    fetch(`/api/brf01/trend?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setEntries(data.entries ?? []));
  }, [currentPeriod, comparePeriod, selectedCurrentWd, selectedCompareWd, context]);

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

            {currentWdInfo && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="currentWd" className="text-sm font-medium text-black">
                  Working day
                </label>
                <select
                  id="currentWd"
                  value={selectedCurrentWd}
                  onChange={(e) => setSelectedCurrentWd(e.target.value)}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                >
                  {currentWdInfo.history.map((wd) => (
                    <option key={wd} value={wd}>
                      {wd}{wd === currentWdInfo.current && wd !== "WD1" ? " (current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

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

            {compareWdInfo && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="compareWd" className="text-sm font-medium text-black">
                  Working day
                </label>
                <select
                  id="compareWd"
                  value={selectedCompareWd}
                  onChange={(e) => setSelectedCompareWd(e.target.value)}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                >
                  {compareWdInfo.history.map((wd) => (
                    <option key={wd} value={wd}>
                      {wd}{wd === compareWdInfo.current && wd !== "WD1" ? " (current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {periods && periods.length < 2 && (
            <p className="mt-2 text-sm text-amber-700">Only one period has data — nothing to compare yet.</p>
          )}
        </div>

        {entries !== null && (() => {
          const leaf = entries.filter((e) => !e.isHeader);
          const sum = (pick: (e: Brf01TrendEntry) => number | null) =>
            leaf.reduce((total, e) => total + (pick(e) ?? 0), 0);
          const curLabel = `${formatPeriodLabel(currentPeriod)} (${selectedCurrentWd})`;
          const prevLabel = `${formatPeriodLabel(comparePeriod)} (${selectedCompareWd})`;

          return (
            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
              <p className="text-sm font-semibold text-black">Grand totals</p>
              <div className="mt-3 flex flex-wrap gap-4">
                <GrandTotalBar
                  title="Total Amount (AED)"
                  currentLabel={curLabel}
                  previousLabel={prevLabel}
                  currentValue={sum((e) => e.currentAmount)}
                  previousValue={sum((e) => e.previousAmount)}
                  formatValue={(v) => `${fmt(v)} AED`}
                />
                <GrandTotalBar
                  title="Total Accounts"
                  currentLabel={curLabel}
                  previousLabel={prevLabel}
                  currentValue={sum((e) => e.currentAccounts)}
                  previousValue={sum((e) => e.previousAccounts)}
                  formatValue={(v) => `${v.toLocaleString()} a/cs`}
                />
              </div>

              <p className="mt-6 text-sm font-semibold text-black">By line — Total Amount</p>
              <div className="mt-3">
                <ByLineChart entries={entries} currentLabel={curLabel} previousLabel={prevLabel} />
              </div>

              <div className="mt-5 border-t border-zinc-100 pt-4">
                <button
                  onClick={() => setShowTable((v) => !v)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  {showTable ? "Hide" : "Show"} detailed comparison table
                </button>
              </div>
            </div>
          );
        })()}

        {showTable && (
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
                      {formatPeriodLabel(currentPeriod)} ({selectedCurrentWd})
                    </th>
                    <th colSpan={2} className="border border-sky-400 bg-sky-300 px-2 py-1 text-center font-semibold text-sky-950">
                      {formatPeriodLabel(comparePeriod)} ({selectedCompareWd})
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
        )}
      </div>
    </AppShell>
  );
}
