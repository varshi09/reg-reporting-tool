"use client";

import AppShell, { type NavHref } from "@/components/AppShell";

export default function ComingSoonPage({
  active,
  title,
  description,
}: {
  active: NavHref;
  title: string;
  description: string;
}) {
  return (
    <AppShell active={active} title={title}>
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-black">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">{description}</p>
        <p className="mt-4 text-xs text-zinc-400">Coming soon.</p>
      </div>
    </AppShell>
  );
}
