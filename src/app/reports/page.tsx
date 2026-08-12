"use client";

import Link from "next/link";
import AppShell from "@/components/AppShell";
import { REPORT_CATEGORIES } from "@/lib/reportCategories";

const OTHER_SECTIONS = [
  {
    title: "Data uploads",
    reports: [
      {
        href: "/reports/upload-activity",
        title: "Upload activity",
        description: "Upload history and outcomes across data tables.",
      },
    ],
  },
] as const;

export default function ReportsPage() {
  return (
    <AppShell active="/reports" title="Generate Report">
      <div className="flex flex-col gap-8">
        <div>
          <p className="mb-3 text-sm font-semibold text-zinc-900">
            Central Bank Reporting
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {REPORT_CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                href={`/reports/${category.slug}`}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white shadow-sm p-5 transition-colors hover:border-zinc-400"
              >
                <p className="text-sm font-semibold text-zinc-900">
                  {category.label}
                </p>
                <p className="text-sm text-zinc-500">
                  {category.modules.length} report modules.
                </p>
              </Link>
            ))}
          </div>
        </div>

        {OTHER_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-3 text-sm font-semibold text-zinc-900">
              {section.title}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {section.reports.map((report) => (
                <Link
                  key={report.href}
                  href={report.href}
                  className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white shadow-sm p-5 transition-colors hover:border-zinc-400"
                >
                  <p className="text-sm font-semibold text-zinc-900">
                    {report.title}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {report.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
