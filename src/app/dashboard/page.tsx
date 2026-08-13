"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/lib/useRequireAuth";
import {
  IconDocument,
  IconHourglass,
  IconCheckCircle,
  IconCalendar,
  IconScale,
  IconFolder,
  IconArrowRight,
  IconShieldCheck,
} from "@/components/icons";

const QUICK_ACTIONS = [
  {
    href: "/reports",
    title: "Generate BRF Report",
    description: "Choose from the full CBUAE BRF catalog.",
    icon: IconDocument,
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  },
  {
    href: "/reconciliation",
    title: "Reconciliation",
    description: "GL-vs-BRF break analysis.",
    icon: IconScale,
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
  },
  {
    href: "/report-library",
    title: "Report Library",
    description: "Browse all generated returns.",
    icon: IconFolder,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
] as const;


type ReportDetail = { title: string; href: string; generated: boolean };

export default function DashboardPage() {
  const { username } = useRequireAuth();
  const [reportsGenerated, setReportsGenerated] = useState<number | null>(null);
  const [submittedToCbuae, setSubmittedToCbuae] = useState<number | null>(null);
  const [totalReports, setTotalReports] = useState<number | null>(null);
  // Period labels come from the API so the dashboard and the backend can
  // never disagree about which reporting period is current.
  const [cycleLabel, setCycleLabel] = useState("");
  const [reportDetails, setReportDetails] = useState<ReportDetail[]>([]);
  const [showReportsModal, setShowReportsModal] = useState(false);

  useEffect(() => {
    async function loadStats() {
      const response = await fetch("/api/dashboard/stats");
      if (!response.ok) return;
      const data = await response.json();
      setReportsGenerated(data.reportsGenerated ?? 0);
      setSubmittedToCbuae(data.submittedToCbuae ?? 0);
      setTotalReports(data.totalReports ?? 0);
      setCycleLabel(data.cycleLabel ?? "");
      setReportDetails(data.reportDetails ?? []);
    }
    loadStats();
  }, []);

  const reportsPct =
    totalReports && totalReports > 0 && reportsGenerated !== null
      ? Math.round((reportsGenerated / totalReports) * 100)
      : null;
  const submittedPct =
    totalReports && totalReports > 0 && submittedToCbuae !== null
      ? Math.round((submittedToCbuae / totalReports) * 100)
      : null;

  const stats = [
    {
      label: "Reports generated",
      value: reportsGenerated === null ? "…" : String(reportsGenerated),
      valueColor: "text-indigo-600",
      helper:
        totalReports === null
          ? "Loading…"
          : `of ${totalReports} available`,
      helperColor: "text-emerald-600",
      icon: IconDocument,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      progressPct: reportsPct,
      progressColor: "bg-indigo-500",
      onClick: () => setShowReportsModal(true),
    },
    {
      label: "Pending validation",
      value: "—",
      valueColor: "text-zinc-300",
      helper: "Not available yet",
      helperColor: "text-zinc-400",
      icon: IconHourglass,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      progressPct: null,
      progressColor: "bg-amber-500",
      onClick: undefined,
    },
    {
      label: "Submitted to CBUAE",
      value: submittedToCbuae === null ? "…" : String(submittedToCbuae),
      valueColor: "text-indigo-600",
      helper:
        totalReports === null
          ? "Loading…"
          : `of ${totalReports} submitted`,
      helperColor: "text-emerald-600",
      icon: IconCheckCircle,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      progressPct: submittedPct,
      progressColor: "bg-emerald-500",
      onClick: undefined,
    },
    {
      label: "Next deadline",
      value: "—",
      valueColor: "text-zinc-300",
      helper: "Not available yet",
      helperColor: "text-zinc-400",
      icon: IconCalendar,
      iconBg: "bg-sky-100",
      iconColor: "text-sky-600",
      progressPct: null,
      progressColor: "bg-sky-500",
      onClick: undefined,
    },
  ];

  return (
    <AppShell active="/dashboard" title="Overview">
      <div className="flex flex-col gap-8">
        <div className="relative -mx-6 -mt-6 overflow-hidden rounded-b-2xl bg-gradient-to-br from-indigo-100 via-indigo-50 to-transparent px-6 pt-6 pb-8">
          <div className="relative z-10 max-w-lg">
            <p className="text-xl font-semibold text-black">
              Welcome back{username ? `, ${username}` : ""} 👋
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Here is the status of your CBUAE BRF reporting cycle for{" "}
              {cycleLabel || "the current period"}
              .
            </p>
          </div>

          <div className="pointer-events-none absolute right-8 top-1/2 hidden -translate-y-1/2 sm:block">
            <div className="relative h-24 w-24">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-400 opacity-20" />
              <div className="absolute left-4 top-2 flex h-16 w-12 flex-col gap-1.5 rounded-md bg-white p-2 shadow-md">
                <div className="h-1.5 w-6 rounded-full bg-indigo-200" />
                <div className="h-1.5 w-8 rounded-full bg-indigo-100" />
                <div className="mt-1 flex items-end gap-1">
                  <div className="h-3 w-1.5 rounded-sm bg-indigo-300" />
                  <div className="h-5 w-1.5 rounded-sm bg-indigo-400" />
                  <div className="h-4 w-1.5 rounded-sm bg-purple-400" />
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md">
                <IconCheckCircle className="h-4 w-4" />
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                onClick={stat.onClick}
                className={`rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
                  stat.onClick ? "cursor-pointer" : ""
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-md ${stat.iconBg} ${stat.iconColor}`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {stat.label}
                </p>
                <p className={`mt-1 text-2xl font-bold ${stat.valueColor}`}>
                  {stat.value}
                </p>
                <p className={`mt-1 text-xs font-medium ${stat.helperColor}`}>
                  {stat.helper}
                </p>
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      stat.progressPct === null ? "bg-zinc-200" : stat.progressColor
                    }`}
                    style={{ width: `${stat.progressPct ?? 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-black">Quick actions</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group relative flex flex-col gap-3 overflow-hidden rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
                >
                  <Icon
                    className={`pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 opacity-[0.06] ${action.iconColor}`}
                  />
                  <span
                    className={`relative flex h-9 w-9 items-center justify-center rounded-md ${action.iconBg} ${action.iconColor}`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="relative flex flex-1 items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-black">
                        {action.title}
                      </p>
                      <p className="text-sm text-zinc-500">{action.description}</p>
                    </div>
                    <IconArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2.5 border-t border-zinc-200 pt-4">
          <IconShieldCheck className="h-4 w-4 shrink-0 text-indigo-500" />
          <p className="text-xs text-zinc-500">
            <span className="font-medium text-zinc-700">Secure. Compliant. Reliable.</span>{" "}
            Built for regulatory excellence.
          </p>
        </div>
      </div>

      {showReportsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <p className="text-sm font-semibold text-zinc-900">
              Reports generated
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              Status of each report for the current reporting cycle.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {reportDetails.length === 0 ? (
                <p className="text-sm text-zinc-500">No reports available.</p>
              ) : (
                reportDetails.map((report) => (
                  <div
                    key={report.href}
                    className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2"
                  >
                    <Link
                      href={report.href}
                      onClick={() => setShowReportsModal(false)}
                      className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                      {report.title}
                    </Link>
                    {report.generated ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Generated
                      </span>
                    ) : (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Not yet generated
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowReportsModal(false)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
