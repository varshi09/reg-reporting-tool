"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getModule } from "@/lib/reportCategories";

export default function ReportModulePage({
  params,
}: {
  params: Promise<{ category: string; module: string }>;
}) {
  const { category: categorySlug, module: moduleSlug } = use(params);
  const found = getModule(categorySlug, moduleSlug);

  if (!found) {
    notFound();
  }

  const { category, module } = found;

  return (
    <AppShell active="/reports" title={module.label}>
      <div className="flex flex-col gap-6">
        <Link
          href={`/reports/${category.slug}`}
          className="w-fit text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Back to {category.label}
        </Link>

        {module.reports.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
            <i
              className={`ti ${module.icon} text-3xl text-zinc-400`}
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-semibold text-zinc-900">
              No {module.label.toLowerCase()} yet
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Reports added to this module will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {module.reports.map((report) =>
              report.href && !report.comingSoon ? (
                <Link
                  key={report.title}
                  href={report.href}
                  className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white shadow-sm p-5 transition-colors hover:border-zinc-400"
                >
                  <p className="text-sm font-semibold text-zinc-900">
                    {report.title}
                  </p>
                  {report.description && (
                    <p className="text-sm text-zinc-500">{report.description}</p>
                  )}
                </Link>
              ) : (
                <div
                  key={report.title}
                  className="flex flex-col gap-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-400">
                      {report.title}
                    </p>
                    <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-400">
                      Coming soon
                    </span>
                  </div>
                  {report.description && (
                    <p className="text-sm text-zinc-400">{report.description}</p>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
