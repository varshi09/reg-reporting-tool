"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { formatDateTime } from "@/lib/formatDateTime";

type Period = {
  reportKey: string;
  reportTitle: string;
  version: string;
  frequency: string;
  timeKey: string;
  month: string;
  year: string;
  submitted: boolean;
  submittedBy: string | null;
  submittedAt: string | null;
};

type Filters = {
  version: string;
  frequency: string;
  month: string;
  year: string;
  status: string;
  submittedBy: string;
};

const EMPTY_FILTERS: Filters = {
  version: "",
  frequency: "",
  month: "",
  year: "",
  status: "",
  submittedBy: "",
};

function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort();
}

// Fixed, calendar-order list so every month is selectable even before any
// data exists for it — matches the API's timeKeyToMonthYear() naming.
const ALL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function nowForDatetimeLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export default function SubmissionsPage() {
  const { username } = useRequireAuth();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  const [pendingPeriod, setPendingPeriod] = useState<Period | null>(null);
  const [submittedAtInput, setSubmittedAtInput] = useState("");

  const loadPeriods = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch("/api/submissions");
    if (response.ok) {
      const data = await response.json();
      setPeriods(data.periods ?? []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  // Default the filters to the latest reporting period, same as the Home
  // page's "for <month> <year>" framing — applied once, so it doesn't fight
  // the user's own filter changes afterward.
  useEffect(() => {
    if (defaultsApplied || periods.length === 0) return;
    const latest = periods.reduce((max, p) => (p.timeKey > max.timeKey ? p : max));
    setFilters((prev) => ({
      ...prev,
      month: latest.month,
      year: latest.year,
    }));
    setDefaultsApplied(true);
  }, [periods, defaultsApplied]);

  function openConfirm(period: Period) {
    setPendingPeriod(period);
    setSubmittedAtInput(nowForDatetimeLocal());
  }

  async function handleConfirmSubmitted() {
    if (!pendingPeriod) return;
    const period = pendingPeriod;
    const rowKey = `${period.reportKey}|${period.timeKey}`;
    setSubmittingKey(rowKey);
    try {
      // Sent as-is (no toISOString conversion) - the raw datetime-local
      // value has no timezone of its own, and converting it through a JS
      // Date here would silently reinterpret it via the browser's own
      // local timezone before the server ever sees it. The API parses this
      // string directly as GST wall-clock via TO_TIMESTAMP.
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportKey: period.reportKey,
          timeKey: period.timeKey,
          submittedBy: username,
          submittedAt: submittedAtInput || undefined,
        }),
      });
      if (response.ok) {
        await loadPeriods();
      }
    } finally {
      setSubmittingKey(null);
      setPendingPeriod(null);
    }
  }

  const filterOptions = useMemo(
    () => ({
      versions: uniqueSorted(periods.map((p) => p.version)),
      frequencies: uniqueSorted(periods.map((p) => p.frequency)),
      months: ALL_MONTHS,
      years: uniqueSorted(periods.map((p) => p.year)),
      submitters: uniqueSorted(periods.map((p) => p.submittedBy)),
    }),
    [periods]
  );

  const filteredPeriods = useMemo(() => {
    return periods.filter((p) => {
      if (filters.version && p.version !== filters.version) return false;
      if (filters.frequency && p.frequency !== filters.frequency) return false;
      if (filters.month && p.month !== filters.month) return false;
      if (filters.year && p.year !== filters.year) return false;
      if (filters.status && (filters.status === "submitted") !== p.submitted) return false;
      // Only filters out already-submitted rows by a different user — a
      // period nobody has submitted yet has no "submitted by" to match, and
      // should stay visible so it's clear it's still awaiting action.
      if (filters.submittedBy && p.submitted && p.submittedBy !== filters.submittedBy) return false;
      return true;
    });
  }, [periods, filters]);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const overview = useMemo(() => {
    const totalPeriods = filteredPeriods.length;
    const totalSubmitted = filteredPeriods.filter((p) => p.submitted).length;
    const totalPending = totalPeriods - totalSubmitted;

    const byUser = new Map<string, number>();
    for (const p of filteredPeriods) {
      if (p.submitted && p.submittedBy) {
        byUser.set(p.submittedBy, (byUser.get(p.submittedBy) ?? 0) + 1);
      }
    }
    const userCounts = Array.from(byUser.entries())
      .map(([user, count]) => ({ user, count }))
      .sort((a, b) => b.count - a.count);

    return { totalPeriods, totalSubmitted, totalPending, userCounts };
  }, [filteredPeriods]);

  const statTiles = [
    { label: "Submitted", value: overview.totalSubmitted, valueColor: "text-emerald-600" },
    { label: "Yet to submit", value: overview.totalPending, valueColor: "text-amber-600" },
  ];

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <AppShell active="/submissions" title="Submissions">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-500">
          Track which reporting periods have been submitted to CBUAE.
        </p>

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-black">Filters</p>
            {hasActiveFilters && (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-xs font-medium text-zinc-500 hover:text-black"
              >
                Reset filters
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Version</label>
              <select
                value={filters.version}
                onChange={(e) => updateFilter("version", e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              >
                <option value="">All</option>
                {filterOptions.versions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Frequency</label>
              <select
                value={filters.frequency}
                onChange={(e) => updateFilter("frequency", e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              >
                <option value="">All</option>
                {filterOptions.frequencies.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Month</label>
              <select
                value={filters.month}
                onChange={(e) => updateFilter("month", e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              >
                <option value="">All</option>
                {filterOptions.months.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Year</label>
              <select
                value={filters.year}
                onChange={(e) => updateFilter("year", e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              >
                <option value="">All</option>
                {filterOptions.years.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Status</label>
              <select
                value={filters.status}
                onChange={(e) => updateFilter("status", e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              >
                <option value="">All</option>
                <option value="submitted">Submitted</option>
                <option value="not-submitted">Not submitted</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Submitted by</label>
              <select
                value={filters.submittedBy}
                onChange={(e) => updateFilter("submittedBy", e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              >
                <option value="">All</option>
                {filterOptions.submitters.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {statTiles.map((tile) => (
            <div key={tile.label} className="rounded-lg border border-zinc-200 bg-white shadow-sm p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {tile.label}
              </p>
              <p className={`mt-1 text-2xl font-bold ${tile.valueColor}`}>
                {isLoading ? "…" : tile.value}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          <p className="text-sm font-semibold text-black">Submissions by user</p>
          {isLoading ? (
            <p className="mt-2 text-sm text-zinc-500">Loading...</p>
          ) : overview.userCounts.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No submissions yet.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {overview.userCounts.map(({ user, count }, i) => (
                <div key={user} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        i === 0
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {user.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-black">{user}</span>
                  </div>
                  <span className="text-xs font-medium text-zinc-500">
                    {count} {count === 1 ? "report" : "reports"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : filteredPeriods.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {periods.length === 0
                ? "No reporting periods with data yet."
                : "No periods match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500">
                    <th className="pb-2 pr-4 font-medium">Version</th>
                    <th className="pb-2 pr-4 font-medium">Frequency</th>
                    <th className="pb-2 pr-4 font-medium">Month</th>
                    <th className="pb-2 pr-4 font-medium">Year</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Submitted by</th>
                    <th className="pb-2 pr-4 font-medium">Submitted at</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPeriods.map((period) => {
                    const rowKey = `${period.reportKey}|${period.timeKey}`;
                    return (
                      <tr key={rowKey} className="border-t border-zinc-100 text-zinc-700 hover:bg-zinc-50 transition-colors">
                        <td className="py-2 pr-4">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              period.version === "Sup Tech"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-zinc-100 text-zinc-700"
                            }`}
                          >
                            {period.version}
                          </span>
                        </td>
                        <td className="py-2 pr-4">{period.frequency}</td>
                        <td className="py-2 pr-4">{period.month}</td>
                        <td className="py-2 pr-4">{period.year}</td>
                        <td className="py-2 pr-4">
                          {period.submitted ? (
                            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                              Submitted
                            </span>
                          ) : (
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Not submitted
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4">{period.submittedBy ?? "—"}</td>
                        <td className="py-2 pr-4">{formatDateTime(period.submittedAt)}</td>
                        <td className="py-2">
                          {!period.submitted && (
                            <button
                              onClick={() => openConfirm(period)}
                              disabled={submittingKey === rowKey}
                              className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                            >
                              {submittingKey === rowKey ? "Marking..." : "Mark as submitted"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {pendingPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <p className="text-sm font-semibold text-black">Mark as submitted?</p>
            <p className="mt-2 text-sm text-zinc-600">
              Are you sure {pendingPeriod.version} — {pendingPeriod.month}{" "}
              {pendingPeriod.year} has been submitted to CBUAE?
            </p>

            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor="submittedAt" className="text-sm font-medium text-black">
                When was it submitted?
              </label>
              <input
                id="submittedAt"
                type="datetime-local"
                value={submittedAtInput}
                onChange={(e) => setSubmittedAtInput(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPendingPeriod(null)}
                disabled={submittingKey !== null}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmitted}
                disabled={submittingKey !== null || !submittedAtInput}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {submittingKey !== null ? "Marking..." : "Yes, mark as submitted"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
