"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCategory } from "@/lib/reportCategories";

type Stats = {
  totalReports: number;
  availableToDownload: number;
  awaitingInput: number;
  pending: number | null;
};

export default function ReportCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categorySlug } = use(params);
  const category = getCategory(categorySlug);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!category) return;
    async function loadStats() {
      const response = await fetch(
        `/api/reports/category-stats?category=${categorySlug}`
      );
      if (response.ok) {
        setStats(await response.json());
      }
    }
    loadStats();
  }, [category, categorySlug]);

  if (!category) {
    notFound();
  }

  const statTiles = [
    {
      label: "Total reports",
      value: stats?.totalReports ?? "…",
      valueColor: "text-indigo-600",
      icon: "📋",
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
    },
    {
      label: "Available to download",
      value: stats?.availableToDownload ?? "…",
      valueColor: "text-emerald-600",
      icon: "⬇️",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
    },
    {
      label: "Pending",
      value: stats?.pending ?? "—",
      valueColor: "text-zinc-300",
      icon: "⏳",
      iconBg: "bg-zinc-100",
      iconColor: "text-zinc-400",
    },
    {
      label: "Awaiting input",
      value: stats?.awaitingInput ?? "…",
      valueColor: "text-amber-600",
      icon: "📥",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
    },
  ];

  return (
    <AppShell active="/reports" title={category.label}>
      <div className="flex flex-col gap-6">
        <Link
          href="/reports"
          className="w-fit text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Back to reports
        </Link>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statTiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-md text-lg ${tile.iconBg} ${tile.iconColor}`}
              >
                {tile.icon}
              </span>
              <p className="mt-3 text-xs text-zinc-500">
                {tile.label}
              </p>
              <p className={`mt-1 text-2xl font-bold ${tile.valueColor}`}>
                {tile.value}
              </p>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-zinc-900">
            Modules
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {category.modules.map((module) => {
              const availableReports = module.reports.filter((r) => !r.comingSoon);
              const hasReports = availableReports.length > 0;
              const catalogCount = module.reports.length;
              return (
                <Link
                  key={module.slug}
                  href={`/reports/${category.slug}/${module.slug}`}
                  className={`flex flex-col gap-2 rounded-lg border p-5 transition-colors ${
                    hasReports
                      ? "border-zinc-200 bg-white hover:border-zinc-400"
                      : "border-zinc-200 bg-white opacity-60 hover:border-zinc-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <i
                      className={`ti ${module.icon} text-xl ${
                        hasReports ? "text-zinc-700" : "text-zinc-400"
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        hasReports
                          ? "bg-green-100 text-green-800"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {hasReports
                        ? `${availableReports.length} report${availableReports.length > 1 ? "s" : ""}`
                        : "Coming soon"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {module.label}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {hasReports
                      ? availableReports.map((r) => r.title).join(", ")
                      : catalogCount > 0
                        ? `${catalogCount} report${catalogCount > 1 ? "s" : ""} mapped, not yet available.`
                        : "Placeholder for future reports."}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
