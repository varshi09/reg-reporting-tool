"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import AppShell from "@/components/AppShell";
import type { Brf01TrendEntry, Brf01PeriodNode } from "@/lib/brf01Trend";

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Fixed categorical order (never cycled) - safe for adjacent-pair bar
// comparisons across all 8 slots per the design system's validated palette.
const SERIES_COLORS = [
  "#2a78d6", "#eb6834", "#1baf7a", "#eda100",
  "#e87ba4", "#008300", "#4a3aa7", "#e34948",
];
function colorForIndex(i: number): string {
  return SERIES_COLORS[Math.min(i, SERIES_COLORS.length - 1)];
}

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

type Selection = { timeKey: string; workingDay: string };

function keyOf(sel: Selection): string {
  return `${sel.timeKey}|${sel.workingDay}`;
}

function seriesLabel(sel: Selection): string {
  return `${formatPeriodLabel(sel.timeKey)} (${sel.workingDay})`;
}

/** Grand total mini bar chart: one bar per selected series, own scale. */
function GrandTotalBar({
  title,
  bars,
  formatValue,
}: {
  title: string;
  bars: { label: string; value: number; color: string }[];
  formatValue: (v: number) => string;
}) {
  const maxValue = Math.max(...bars.map((b) => b.value), 1) * 1.15;
  const plotHeight = 160;
  const barWidth = 56;
  const slot = 90;
  const width = 50 + bars.length * slot;

  return (
    <div className="flex-1 rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <svg viewBox={`0 0 ${width} ${plotHeight + 40}`} className="mt-2 w-full" role="img" aria-label={title}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={40}
            x2={width}
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
          const x = 50 + i * slot;
          const y = plotHeight - h + 10;
          return (
            <g key={bar.label}>
              <title>{`${bar.label}: ${formatValue(bar.value)}`}</title>
              <rect x={x} y={y} width={barWidth} height={h} rx={4} fill={bar.color} />
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={600} fill={SECONDARY_INK}>
                {formatCompact(bar.value)}
              </text>
              <text x={x + barWidth / 2} y={plotHeight + 22} textAnchor="middle" fontSize={8} fill={AXIS_INK}>
                {bar.label}
              </text>
            </g>
          );
        })}
        <line x1={40} x2={width} y1={plotHeight + 10} y2={plotHeight + 10} stroke="#c3c2b7" strokeWidth={1} />
      </svg>
    </div>
  );
}

/** Grouped bar chart, one bar per selected series per leaf line - horizontally scrollable. */
function ByLineChart({ entries, selections }: { entries: Brf01TrendEntry[]; selections: Selection[] }) {
  const leaf = entries.filter((e) => !e.isHeader);
  const n = selections.length;
  const maxValue = Math.max(1, ...leaf.flatMap((e) => e.series.map((s) => s.amount ?? 0))) * 1.1;

  const plotHeight = 220;
  const barWidth = Math.max(3, Math.min(8, Math.floor(24 / n)));
  const barGap = 2;
  const groupWidth = barWidth * n + barGap * (n - 1);
  const groupGap = 16;
  const groupSlot = groupWidth + groupGap;
  const chartWidth = Math.max(leaf.length * groupSlot + 20, 400);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  if (leaf.length === 0) {
    return <p className="text-sm text-zinc-500">No line-level data for these selections.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-zinc-600">
        {selections.map((sel, i) => (
          <span key={keyOf(sel)} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colorForIndex(i) }} />
            {seriesLabel(sel)}
          </span>
        ))}
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
          <svg width={chartWidth} height={plotHeight + 34} role="img" aria-label="Total amount by line across selected periods">
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
            {leaf.map((entry, gi) => {
              const gx = 10 + gi * groupSlot;
              return (
                <g key={entry.code}>
                  <title>
                    {`${entry.code} — ${entry.description}\n${entry.series
                      .map((s, i) => `${seriesLabel(selections[i])}: ${fmt(s.amount)}`)
                      .join("\n")}`}
                  </title>
                  {entry.series.map((s, i) => {
                    const h = ((s.amount ?? 0) / maxValue) * plotHeight;
                    return (
                      <rect
                        key={i}
                        x={gx + i * (barWidth + barGap)}
                        y={plotHeight - h + 10}
                        width={barWidth}
                        height={h}
                        rx={2}
                        fill={colorForIndex(i)}
                      />
                    );
                  })}
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

function TriStateCheckbox({
  checked,
  indeterminate,
  onChange,
  ...rest
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
} & InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} {...rest} />;
}

/** Excel-style hierarchical picker: period > working day, multi-select with tri-state checkboxes. */
function PeriodPicker({
  hierarchy,
  applied,
  onApply,
}: {
  hierarchy: Brf01PeriodNode[];
  applied: Selection[];
  onApply: (selections: Selection[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(new Set(applied.map(keyOf)));
  const [expanded, setExpanded] = useState<Set<string>>(new Set(applied.map((s) => s.timeKey)));

  function openPicker() {
    setDraft(new Set(applied.map(keyOf)));
    setOpen(true);
  }

  function toggleWd(timeKey: string, wd: string) {
    const k = `${timeKey}|${wd}`;
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function togglePeriod(node: Brf01PeriodNode) {
    const keys = node.workingDays.map((wd) => `${node.timeKey}|${wd}`);
    const allChecked = keys.every((k) => draft.has(k));
    setDraft((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (allChecked ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  function toggleAll() {
    const allKeys = hierarchy.flatMap((n) => n.workingDays.map((wd) => `${n.timeKey}|${wd}`));
    const allChecked = allKeys.every((k) => draft.has(k));
    setDraft(allChecked ? new Set() : new Set(allKeys));
  }

  function toggleExpand(timeKey: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(timeKey)) next.delete(timeKey);
      else next.add(timeKey);
      return next;
    });
  }

  const allKeys = hierarchy.flatMap((n) => n.workingDays.map((wd) => `${n.timeKey}|${wd}`));
  const allChecked = allKeys.length > 0 && allKeys.every((k) => draft.has(k));
  const someChecked = allKeys.some((k) => draft.has(k));

  return (
    <div className="relative flex flex-col gap-1.5">
      <label className="text-sm font-medium text-black">Periods to compare</label>
      <button
        onClick={() => (open ? setOpen(false) : openPicker())}
        className="flex w-72 items-center justify-between rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
      >
        <span>{applied.length > 0 ? `${applied.length} selected` : "Select periods and working days"}</span>
        <span className="text-zinc-400">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-80 rounded-lg border border-zinc-200 bg-white shadow-lg">
            <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
              <TriStateCheckbox checked={allChecked} indeterminate={!allChecked && someChecked} onChange={toggleAll} className="h-4 w-4" />
              <span className="text-sm font-medium text-zinc-900">Select all</span>
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {hierarchy.map((node) => {
                const keys = node.workingDays.map((wd) => `${node.timeKey}|${wd}`);
                const nodeAll = keys.every((k) => draft.has(k));
                const nodeSome = keys.some((k) => draft.has(k));
                const isExpanded = expanded.has(node.timeKey);
                return (
                  <div key={node.timeKey}>
                    <div className="flex items-center gap-1.5 px-3 py-1.5">
                      <button
                        onClick={() => toggleExpand(node.timeKey)}
                        className="w-4 shrink-0 text-center text-xs text-zinc-400"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? "▾" : "▸"}
                      </button>
                      <TriStateCheckbox
                        checked={nodeAll}
                        indeterminate={!nodeAll && nodeSome}
                        onChange={() => togglePeriod(node)}
                        className="h-4 w-4"
                      />
                      <span className="flex-1 text-sm text-zinc-800">{formatPeriodLabel(node.timeKey)}</span>
                    </div>
                    {isExpanded && (
                      <div className="pl-9">
                        {node.workingDays.map((wd) => (
                          <label key={wd} className="flex items-center gap-2 py-1 pr-3 text-xs text-zinc-600">
                            <input
                              type="checkbox"
                              checked={draft.has(`${node.timeKey}|${wd}`)}
                              onChange={() => toggleWd(node.timeKey, wd)}
                              className="h-3.5 w-3.5"
                            />
                            {wd}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2.5">
              <button onClick={() => setDraft(new Set())} className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
                Clear
              </button>
              <button
                onClick={() => {
                  const selections = [...draft].map((k) => {
                    const [timeKey, workingDay] = k.split("|");
                    return { timeKey, workingDay };
                  });
                  onApply(selections);
                  setOpen(false);
                }}
                className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}

      {applied.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {applied.map((sel, i) => (
            <span
              key={keyOf(sel)}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{ background: `${colorForIndex(i)}1a`, color: colorForIndex(i) }}
            >
              {seriesLabel(sel)}
            </span>
          ))}
        </div>
      )}
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

export default function Brf01TrendPage() {
  const [context] = useState<Context>(readContext);
  const [hierarchy, setHierarchy] = useState<Brf01PeriodNode[] | null>(null);
  const [appliedSelections, setAppliedSelections] = useState<Selection[]>([]);
  const [entries, setEntries] = useState<Brf01TrendEntry[] | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    fetch("/api/brf01/period-hierarchy")
      .then((r) => r.json())
      .then((data: { periods: Brf01PeriodNode[] }) => {
        const periods = data.periods ?? [];
        setHierarchy(periods);
        if (periods.length === 0) return;
        const initialTimeKey = readInitialTimeKey();
        const first = periods.find((p) => p.timeKey === initialTimeKey) ?? periods[0];
        const firstSel: Selection = { timeKey: first.timeKey, workingDay: first.workingDays[first.workingDays.length - 1] };
        const secondNode = periods.find((p) => p.timeKey !== first.timeKey && p.timeKey < first.timeKey) ?? periods.find((p) => p.timeKey !== first.timeKey);
        const defaults: Selection[] = secondNode
          ? [firstSel, { timeKey: secondNode.timeKey, workingDay: secondNode.workingDays[secondNode.workingDays.length - 1] }]
          : [firstSel];
        setAppliedSelections(defaults);
      });
  }, []);

  useEffect(() => {
    if (appliedSelections.length === 0) {
      setEntries(null);
      return;
    }
    const params = new URLSearchParams();
    context.entityGroups.forEach((eg) => params.append("entityGroup", eg));
    context.dataSources.forEach((ds) => params.append("dataSource", ds));
    appliedSelections.forEach((sel) => params.append("selection", `${sel.timeKey}:${sel.workingDay}`));

    setEntries(null);
    fetch(`/api/brf01/trend?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setEntries(data.entries ?? []));
  }, [appliedSelections, context]);

  const canShowTable = appliedSelections.length === 2;

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

          <div className="mt-4">
            {hierarchy && (
              <PeriodPicker hierarchy={hierarchy} applied={appliedSelections} onApply={setAppliedSelections} />
            )}
          </div>
          {hierarchy && hierarchy.length < 2 && (
            <p className="mt-2 text-sm text-amber-700">Only one period has data — nothing to compare yet.</p>
          )}
        </div>

        {entries !== null && appliedSelections.length > 0 && (() => {
          const leaf = entries.filter((e) => !e.isHeader);
          const sumSeries = (pick: (s: (typeof leaf)[number]["series"][number]) => number | null) =>
            appliedSelections.map((_, i) => leaf.reduce((total, e) => total + (pick(e.series[i]) ?? 0), 0));

          const amountSums = sumSeries((s) => s.amount);
          const accountSums = sumSeries((s) => s.accounts);

          return (
            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
              <p className="text-sm font-semibold text-black">Grand totals</p>
              <div className="mt-3 flex flex-wrap gap-4">
                <GrandTotalBar
                  title="Total Amount (AED)"
                  bars={appliedSelections.map((sel, i) => ({ label: seriesLabel(sel), value: amountSums[i], color: colorForIndex(i) }))}
                  formatValue={(v) => `${fmt(v)} AED`}
                />
                <GrandTotalBar
                  title="Total Accounts"
                  bars={appliedSelections.map((sel, i) => ({ label: seriesLabel(sel), value: accountSums[i], color: colorForIndex(i) }))}
                  formatValue={(v) => `${v.toLocaleString()} a/cs`}
                />
              </div>

              <p className="mt-6 text-sm font-semibold text-black">By line — Total Amount</p>
              <div className="mt-3">
                <ByLineChart entries={entries} selections={appliedSelections} />
              </div>

              {canShowTable ? (
                <div className="mt-5 border-t border-zinc-100 pt-4">
                  <button
                    onClick={() => setShowTable((v) => !v)}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    {showTable ? "Hide" : "Show"} detailed comparison table
                  </button>
                </div>
              ) : appliedSelections.length > 2 ? (
                <p className="mt-5 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
                  The detailed comparison table (with variance) is only available when exactly 2 periods are selected — {appliedSelections.length} are selected now.
                </p>
              ) : null}
            </div>
          );
        })()}

        {canShowTable && showTable && entries !== null && (() => {
          const [curSel, prevSel] = appliedSelections;
          const rows = entries.map((entry) => {
            const currentAmount = entry.series[0]?.amount ?? null;
            const previousAmount = entry.series[1]?.amount ?? null;
            const currentAccounts = entry.series[0]?.accounts ?? null;
            const previousAccounts = entry.series[1]?.accounts ?? null;
            const varianceAmount = currentAmount !== null && previousAmount !== null ? currentAmount - previousAmount : null;
            const varianceAccounts = currentAccounts !== null && previousAccounts !== null ? currentAccounts - previousAccounts : null;
            const variancePct = varianceAmount !== null && previousAmount ? (varianceAmount / previousAmount) * 100 : null;
            return { entry, currentAmount, previousAmount, currentAccounts, previousAccounts, varianceAmount, varianceAccounts, variancePct };
          });

          return (
            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full border-collapse text-left text-sm text-zinc-900">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th rowSpan={2} className="border border-sky-400 bg-sky-300 px-2 py-2 align-bottom font-semibold text-sky-950">Line No</th>
                      <th rowSpan={2} className="border border-sky-400 bg-sky-300 px-2 py-2 align-bottom font-semibold text-sky-950">Description</th>
                      <th colSpan={2} className="border border-sky-400 bg-sky-300 px-2 py-1 text-center font-semibold text-sky-950">
                        {seriesLabel(curSel)}
                      </th>
                      <th colSpan={2} className="border border-sky-400 bg-sky-300 px-2 py-1 text-center font-semibold text-sky-950">
                        {seriesLabel(prevSel)}
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
                    {rows.map(({ entry, currentAccounts, currentAmount, previousAccounts, previousAmount, varianceAccounts, varianceAmount, variancePct }) => (
                      <tr
                        key={entry.code}
                        className={entry.isHeader ? "bg-sky-100 font-semibold" : "hover:bg-zinc-50 transition-colors"}
                      >
                        <td className="border border-zinc-200 px-2 py-1">{entry.code}</td>
                        <td className="border border-zinc-200 px-2 py-1">{entry.description}</td>
                        <td className="border border-zinc-200 px-2 py-1">{fmtInt(currentAccounts)}</td>
                        <td className="border border-zinc-200 px-2 py-1">{fmt(currentAmount)}</td>
                        <td className="border border-zinc-200 px-2 py-1">{fmtInt(previousAccounts)}</td>
                        <td className="border border-zinc-200 px-2 py-1">{fmt(previousAmount)}</td>
                        <td className={`border border-zinc-200 px-2 py-1 ${varianceColor(varianceAccounts)}`}>
                          {varianceAccounts !== null && varianceAccounts > 0 ? "+" : ""}
                          {fmtInt(varianceAccounts)}
                        </td>
                        <td className={`border border-zinc-200 px-2 py-1 ${varianceColor(varianceAmount)}`}>
                          {varianceAmount !== null && varianceAmount > 0 ? "+" : ""}
                          {fmt(varianceAmount)}
                        </td>
                        <td className={`border border-zinc-200 px-2 py-1 ${varianceColor(variancePct)}`}>
                          {fmtPct(variancePct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    </AppShell>
  );
}
