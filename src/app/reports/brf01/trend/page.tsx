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

function formatMonthYear(timeKey: string): string {
  if (timeKey.length !== 8) return timeKey;
  const year = timeKey.slice(0, 4);
  const month = Number(timeKey.slice(4, 6));
  return `${SHORT_MONTH_NAMES[month - 1]} ${year}`;
}

function daysInMonth(timeKey: string): number {
  const year = Number(timeKey.slice(0, 4));
  const month = Number(timeKey.slice(4, 6));
  return new Date(year, month, 0).getDate();
}

/** Integer calendar months between two YYYYMMDD keys - day-of-month is ignored since our periods are always month-ends. */
function monthsBetween(laterKey: string, earlierKey: string): number {
  const laterTotal = Number(laterKey.slice(0, 4)) * 12 + (Number(laterKey.slice(4, 6)) - 1);
  const earlierTotal = Number(earlierKey.slice(0, 4)) * 12 + (Number(earlierKey.slice(4, 6)) - 1);
  return laterTotal - earlierTotal;
}

/** The month-end date `months` calendar months before `timeKey`, clamped to that target month's length. */
function shiftMonthsEnd(timeKey: string, months: number): string {
  const year = Number(timeKey.slice(0, 4));
  const month = Number(timeKey.slice(4, 6));
  const day = Number(timeKey.slice(6, 8));
  const total = year * 12 + (month - 1) - months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = ((total % 12) + 12) % 12;
  const targetDay = Math.min(day, new Date(targetYear, targetMonth + 1, 0).getDate());
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${targetYear}${pad(targetMonth + 1)}${pad(targetDay)}`;
}

/** Numeric-aware WD compare so "WD10" sorts after "WD2" - mirrors the same rule used server-side. */
function compareWorkingDay(a: string, b: string): number {
  const na = /^WD(\d+)$/i.exec(a);
  const nb = /^WD(\d+)$/i.exec(b);
  if (na && nb) return Number(na[1]) - Number(nb[1]);
  return a.localeCompare(b);
}

/** [later, earlier] by (timeKey, workingDay) - "current" is always the more recent side, regardless of pick order. */
function orderByRecency(selections: Selection[]): [Selection, Selection] | null {
  if (selections.length !== 2) return null;
  const [a, b] = selections;
  if (a.timeKey !== b.timeKey) return a.timeKey > b.timeKey ? [a, b] : [b, a];
  return compareWorkingDay(a.workingDay, b.workingDay) >= 0 ? [a, b] : [b, a];
}

function latestSelection(selections: Selection[]): Selection | null {
  if (selections.length === 0) return null;
  return selections.reduce((latest, sel) => {
    if (sel.timeKey !== latest.timeKey) return sel.timeKey > latest.timeKey ? sel : latest;
    return compareWorkingDay(sel.workingDay, latest.workingDay) > 0 ? sel : latest;
  });
}

type ChangeStats = {
  current: number | null;
  previous: number | null;
  absChange: number | null;
  pctChange: number | null;
  trend: "positive" | "negative" | "neutral";
};

function computeChange(current: number | null, previous: number | null): ChangeStats {
  const absChange = current !== null && previous !== null ? current - previous : null;
  const pctChange = absChange !== null && previous ? (absChange / previous) * 100 : null;
  const trend = absChange === null || absChange === 0 ? "neutral" : absChange > 0 ? "positive" : "negative";
  return { current, previous, absChange, pctChange, trend };
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

function TrendAnalysisHeader({ context }: { context: Context }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
      <p className="text-lg font-semibold text-black">Trend Analysis</p>
      <p className="mt-1 text-sm text-zinc-500">Compare key metrics over time to identify trends and changes.</p>
      <p className="mt-2 text-xs text-zinc-400">
        {context.entityGroups.join(", ") || "All entities"} · {context.dataSources.join(", ") || "All sources"}
      </p>
    </div>
  );
}

type ViewBy = "both" | "amount" | "accounts";

const COMPARISON_MODES: { key: string; label: string; months: number }[] = [
  { key: "mom", label: "Month-over-Month", months: 1 },
  { key: "qoq", label: "Quarter-over-Quarter", months: 3 },
  { key: "yoy", label: "Year-over-Year", months: 12 },
];

/** Comparison-period label plus quick-picks (MoM/QoQ/YoY) that fill the picker with a matched pair, and the amount/accounts view filter. */
function ComparisonControls({
  hierarchy,
  appliedSelections,
  onApply,
  viewBy,
  onViewByChange,
}: {
  hierarchy: Brf01PeriodNode[];
  appliedSelections: Selection[];
  onApply: (selections: Selection[]) => void;
  viewBy: ViewBy;
  onViewByChange: (v: ViewBy) => void;
}) {
  const ordered = orderByRecency(appliedSelections);
  const referenceNode =
    (ordered && hierarchy.find((n) => n.timeKey === ordered[0].timeKey)) ?? hierarchy[0] ?? null;
  const activeMonths = ordered ? monthsBetween(ordered[0].timeKey, ordered[1].timeKey) : null;

  function applyMode(months: number) {
    if (!referenceNode) return;
    const targetKey = shiftMonthsEnd(referenceNode.timeKey, months);
    const targetNode = hierarchy.find((n) => n.timeKey === targetKey);
    if (!targetNode) return;
    const referenceWd = referenceNode.workingDays[referenceNode.workingDays.length - 1];
    const targetWd = targetNode.workingDays[targetNode.workingDays.length - 1];
    onApply([
      { timeKey: referenceNode.timeKey, workingDay: referenceWd },
      { timeKey: targetNode.timeKey, workingDay: targetWd },
    ]);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white shadow-sm p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-medium text-zinc-500">Comparison period</p>
        <p className="mt-0.5 text-base font-semibold text-black">
          {ordered
            ? `${formatMonthYear(ordered[0].timeKey)} vs. ${formatMonthYear(ordered[1].timeKey)}`
            : appliedSelections.length > 0
              ? `${appliedSelections.length} periods selected`
              : "No periods selected"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-x-auto rounded-md border border-zinc-300 text-sm" role="group" aria-label="Comparison mode">
          {COMPARISON_MODES.map((mode) => {
            const targetKey = referenceNode ? shiftMonthsEnd(referenceNode.timeKey, mode.months) : null;
            const targetNode = targetKey ? hierarchy.find((n) => n.timeKey === targetKey) : null;
            const disabled = !targetNode;
            const active = activeMonths === mode.months;
            return (
              <button
                key={mode.key}
                type="button"
                disabled={disabled}
                onClick={() => applyMode(mode.months)}
                title={disabled && targetKey ? `No data for ${formatMonthYear(targetKey)}` : undefined}
                aria-pressed={active}
                className={`whitespace-nowrap px-3 py-1.5 font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                  active
                    ? "bg-indigo-600 text-white"
                    : disabled
                      ? "cursor-not-allowed bg-zinc-50 text-zinc-300"
                      : "bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        <div className="flex overflow-x-auto rounded-md border border-zinc-300 text-sm" role="group" aria-label="View by">
          {(["both", "amount", "accounts"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewByChange(v)}
              aria-pressed={viewBy === v}
              className={`whitespace-nowrap px-3 py-1.5 font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                viewBy === v ? "bg-indigo-50 text-indigo-700" : "bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {v === "both" ? "Both metrics" : v === "amount" ? "Amount" : "Accounts"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const TREND_STYLES: Record<ChangeStats["trend"], { badge: string; text: string; arrow: string }> = {
  positive: { badge: "bg-emerald-50 text-emerald-700", text: "text-emerald-600", arrow: "↑" },
  negative: { badge: "bg-red-50 text-red-700", text: "text-red-600", arrow: "↓" },
  neutral: { badge: "bg-zinc-100 text-zinc-600", text: "text-zinc-500", arrow: "→" },
};

function trendLabel(trend: ChangeStats["trend"]): string {
  if (trend === "positive") return "Positive Trend";
  if (trend === "negative") return "Negative Trend";
  return "Flat";
}

/** One metric's current-vs-previous summary: big value, delta badge, and the absolute/percentage/monthly-avg row. */
function MetricTrendCard({
  title,
  stats,
  formatValue,
  monthlyAvg,
  monthlyAvgLabel,
}: {
  title: string;
  stats: ChangeStats;
  formatValue: (v: number) => string;
  monthlyAvg: number | null;
  monthlyAvgLabel: string;
}) {
  const style = TREND_STYLES[stats.trend];
  return (
    <div className="min-w-[260px] flex-1 rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
        {stats.current !== null ? formatValue(stats.current) : "N/A"}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
        <span>vs. {stats.previous !== null ? formatValue(stats.previous) : "N/A"}</span>
        {stats.pctChange !== null && (
          <span className={`inline-flex items-center gap-0.5 font-medium ${style.text}`}>
            <span aria-hidden="true">{style.arrow}</span>
            {fmtPct(stats.pctChange)}
          </span>
        )}
      </div>
      <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}>
        {stats.absChange === null ? "No prior data" : trendLabel(stats.trend)}
      </span>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-zinc-100 pt-3 text-sm">
        <div>
          <p className="text-xs text-zinc-500">Absolute Change</p>
          <p className={`mt-0.5 font-semibold ${style.text}`}>
            {stats.absChange !== null ? `${stats.absChange > 0 ? "+" : ""}${formatValue(stats.absChange)}` : "N/A"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Percentage Change</p>
          <p className={`mt-0.5 font-semibold ${style.text}`}>{fmtPct(stats.pctChange)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">{monthlyAvgLabel}</p>
          <p className="mt-0.5 font-semibold text-zinc-900">{monthlyAvg !== null ? formatValue(monthlyAvg) : "N/A"}</p>
        </div>
      </div>
    </div>
  );
}

type TwoWayStats = {
  laterSel: Selection;
  earlierSel: Selection;
  amount: ChangeStats;
  accounts: ChangeStats;
};

/** Current-vs-previous totals for exactly two selections - "current" is always the more recent one, regardless of pick order. */
function computeTwoWayStats(entries: Brf01TrendEntry[], selections: Selection[]): TwoWayStats | null {
  const ordered = orderByRecency(selections);
  if (!ordered) return null;
  const [laterSel, earlierSel] = ordered;
  const laterIdx = selections.findIndex((s) => keyOf(s) === keyOf(laterSel));
  const earlierIdx = selections.findIndex((s) => keyOf(s) === keyOf(earlierSel));
  const leaf = entries.filter((e) => !e.isHeader);
  const sumAt = (idx: number, pick: (s: Brf01TrendEntry["series"][number]) => number | null) =>
    leaf.reduce((total, e) => {
      const v = pick(e.series[idx]);
      return v === null ? total : total + v;
    }, 0);
  return {
    laterSel,
    earlierSel,
    amount: computeChange(sumAt(laterIdx, (s) => s.amount), sumAt(earlierIdx, (s) => s.amount)),
    accounts: computeChange(sumAt(laterIdx, (s) => s.accounts), sumAt(earlierIdx, (s) => s.accounts)),
  };
}

function GrandTotalsSection({ stats, viewBy }: { stats: TwoWayStats; viewBy: ViewBy }) {
  const monthlyAvgLabel = `Monthly Avg (${formatMonthYear(stats.laterSel.timeKey).split(" ")[0]})`;
  const days = daysInMonth(stats.laterSel.timeKey);
  const amountAvg = stats.amount.current !== null ? stats.amount.current / days : null;
  const accountAvg = stats.accounts.current !== null ? stats.accounts.current / days : null;

  return (
    <div className="mt-3 flex flex-wrap gap-4">
      {viewBy !== "accounts" && (
        <MetricTrendCard
          title="Total Amount (AED)"
          stats={stats.amount}
          formatValue={(v) => `${fmt(v)} AED`}
          monthlyAvg={amountAvg}
          monthlyAvgLabel={monthlyAvgLabel}
        />
      )}
      {viewBy !== "amount" && (
        <MetricTrendCard
          title="Total Accounts"
          stats={stats.accounts}
          formatValue={(v) => `${v.toLocaleString()} a/cs`}
          monthlyAvg={accountAvg}
          monthlyAvgLabel={monthlyAvgLabel}
        />
      )}
    </div>
  );
}

function InsightCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-900">{value}</p>
      <p className="text-sm font-semibold text-zinc-700">{detail}</p>
    </div>
  );
}

function describeMetric(label: string, stats: ChangeStats, formatAbs: (v: number) => string): string {
  if (stats.pctChange === null || stats.absChange === null) {
    return `${label} could not be compared with the previous period`;
  }
  const verb = stats.trend === "positive" ? "increased" : stats.trend === "negative" ? "decreased" : "stayed flat";
  const sign = stats.absChange > 0 ? "+" : "";
  return `${label} ${verb} by ${fmtPct(stats.pctChange)} (${sign}${formatAbs(stats.absChange)}) compared with the previous period`;
}

/** Management-friendly summary generated from the actual current/previous totals - never a canned sentence. */
function TrendInsightPanel({ stats }: { stats: TwoWayStats }) {
  const amountSentence = describeMetric("Total Amount (AED)", stats.amount, (v) => `${fmt(v)} AED`);
  const accountSentence = describeMetric("Total Accounts", stats.accounts, (v) => `${v.toLocaleString()} a/cs`);

  let closing = "";
  if (stats.amount.trend !== "neutral" || stats.amount.absChange !== null) {
    if (stats.amount.absChange !== null && stats.accounts.absChange !== null) {
      if (stats.amount.trend === "positive" && stats.accounts.trend === "positive") closing = "Both metrics show positive growth.";
      else if (stats.amount.trend === "negative" && stats.accounts.trend === "negative") closing = "Both metrics declined.";
      else closing = "Metrics show mixed movement.";
    }
  }

  const metrics = [
    { label: "Total Amount (AED)", stats: stats.amount, formatValue: (v: number) => `${fmt(v)} AED` },
    { label: "Total Accounts", stats: stats.accounts, formatValue: (v: number) => `${v.toLocaleString()} a/cs` },
  ];
  const growthCandidates = metrics.filter((m) => m.stats.pctChange !== null);
  const strongest = growthCandidates.length
    ? growthCandidates.reduce((best, m) => (Math.abs(m.stats.pctChange!) > Math.abs(best.stats.pctChange!) ? m : best))
    : null;
  const absCandidates = metrics.filter((m) => m.stats.absChange !== null);
  const highestAbs = absCandidates.length
    ? absCandidates.reduce((best, m) => (Math.abs(m.stats.absChange!) > Math.abs(best.stats.absChange!) ? m : best))
    : null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
      <p className="text-sm font-semibold text-black">Insights</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-700">
        {amountSentence}, while {accountSentence.charAt(0).toLowerCase()}
        {accountSentence.slice(1)}.{closing ? ` ${closing}` : ""}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {strongest && (
          <InsightCard
            label={strongest.stats.trend === "negative" ? "Largest Decline" : "Strongest Growth"}
            value={strongest.label}
            detail={fmtPct(strongest.stats.pctChange)}
          />
        )}
        {highestAbs && (
          <InsightCard
            label="Highest Absolute Change"
            value={highestAbs.label}
            detail={`${highestAbs.stats.absChange! > 0 ? "+" : ""}${highestAbs.formatValue(highestAbs.stats.absChange!)}`}
          />
        )}
      </div>
    </div>
  );
}

function DataFreshnessIndicator({ selections }: { selections: Selection[] }) {
  const latest = latestSelection(selections);
  if (!latest) return null;
  return (
    <p className="text-xs text-zinc-400">
      Data as of{" "}
      <span className="font-medium text-zinc-500">
        {formatPeriodLabel(latest.timeKey)} · {latest.workingDay}
      </span>
    </p>
  );
}

type TrendResult = { selections: Selection[]; entries: Brf01TrendEntry[] };

export default function Brf01TrendPage() {
  const [context] = useState<Context>(readContext);
  const [hierarchy, setHierarchy] = useState<Brf01PeriodNode[] | null>(null);
  const [appliedSelections, setAppliedSelections] = useState<Selection[]>([]);
  // Bundled with the selections that produced it, so a render can never see
  // entries from one selection set paired with a longer/shorter selections array.
  const [result, setResult] = useState<TrendResult | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [viewBy, setViewBy] = useState<ViewBy>("both");

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
      setResult(null);
      return;
    }
    const params = new URLSearchParams();
    context.entityGroups.forEach((eg) => params.append("entityGroup", eg));
    context.dataSources.forEach((ds) => params.append("dataSource", ds));
    appliedSelections.forEach((sel) => params.append("selection", `${sel.timeKey}:${sel.workingDay}`));

    setResult(null);
    fetch(`/api/brf01/trend?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setResult({ selections: appliedSelections, entries: data.entries ?? [] }));
  }, [appliedSelections, context]);

  const twoWayStats = result !== null ? computeTwoWayStats(result.entries, result.selections) : null;
  const canShowTable = twoWayStats !== null;

  return (
    <AppShell active="/reports" title="BRF 01 - Trend Analysis">
      <div className="flex flex-col gap-4">
        <a href="/reports/brf01" className="w-fit text-sm text-zinc-500 hover:text-black">
          ← Back to BRF 01 summary
        </a>

        <TrendAnalysisHeader context={context} />

        {hierarchy && (
          <ComparisonControls
            hierarchy={hierarchy}
            appliedSelections={appliedSelections}
            onApply={setAppliedSelections}
            viewBy={viewBy}
            onViewByChange={setViewBy}
          />
        )}

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          <p className="text-sm font-medium text-zinc-700">Custom comparison</p>
          <p className="mt-0.5 text-xs text-zinc-400">Choose specific periods and working days, including more than two at once.</p>

          <div className="mt-3">
            {hierarchy && (
              <PeriodPicker hierarchy={hierarchy} applied={appliedSelections} onApply={setAppliedSelections} />
            )}
          </div>
          {hierarchy && hierarchy.length < 2 && (
            <p className="mt-2 text-sm text-amber-700">Only one period has data — nothing to compare yet.</p>
          )}
        </div>

        {result !== null && (() => {
          const { selections, entries } = result;
          const leaf = entries.filter((e) => !e.isHeader);
          const sumSeries = (pick: (s: (typeof leaf)[number]["series"][number]) => number | null) =>
            selections.map((_, i) => leaf.reduce((total, e) => total + (pick(e.series[i]) ?? 0), 0));

          const amountSums = sumSeries((s) => s.amount);
          const accountSums = sumSeries((s) => s.accounts);

          return (
            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <p className="text-sm font-semibold text-black">Grand totals</p>
                {twoWayStats && (
                  <p className="text-xs text-zinc-400">
                    vs. Previous Period ({formatPeriodLabel(twoWayStats.earlierSel.timeKey)})
                  </p>
                )}
              </div>

              {twoWayStats ? (
                <GrandTotalsSection stats={twoWayStats} viewBy={viewBy} />
              ) : (
                <div className="mt-3 flex flex-wrap gap-4">
                  <GrandTotalBar
                    title="Total Amount (AED)"
                    bars={selections.map((sel, i) => ({ label: seriesLabel(sel), value: amountSums[i], color: colorForIndex(i) }))}
                    formatValue={(v) => `${fmt(v)} AED`}
                  />
                  <GrandTotalBar
                    title="Total Accounts"
                    bars={selections.map((sel, i) => ({ label: seriesLabel(sel), value: accountSums[i], color: colorForIndex(i) }))}
                    formatValue={(v) => `${v.toLocaleString()} a/cs`}
                  />
                </div>
              )}

              <p className="mt-6 text-sm font-semibold text-black">By line — Total Amount</p>
              <div className="mt-3">
                <ByLineChart entries={entries} selections={selections} />
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
              ) : selections.length > 2 ? (
                <p className="mt-5 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
                  The detailed comparison table (with variance) is only available when exactly 2 periods are selected — {selections.length} are selected now.
                </p>
              ) : null}
            </div>
          );
        })()}

        {twoWayStats && <TrendInsightPanel stats={twoWayStats} />}

        {canShowTable && showTable && result !== null && twoWayStats && (() => {
          const { selections, entries } = result;
          const curSel = twoWayStats.laterSel;
          const prevSel = twoWayStats.earlierSel;
          const curIdx = selections.findIndex((s) => keyOf(s) === keyOf(curSel));
          const prevIdx = selections.findIndex((s) => keyOf(s) === keyOf(prevSel));
          const rows = entries.map((entry) => {
            const currentAmount = entry.series[curIdx]?.amount ?? null;
            const previousAmount = entry.series[prevIdx]?.amount ?? null;
            const currentAccounts = entry.series[curIdx]?.accounts ?? null;
            const previousAccounts = entry.series[prevIdx]?.accounts ?? null;
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

        {result !== null && (
          <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-center sm:justify-between">
            <DataFreshnessIndicator selections={result.selections} />
            <p className="text-xs text-zinc-400">All amounts are in AED. Figures may be rounded.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
