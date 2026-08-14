"use client";

import Link from "next/link";
import AppShell from "@/components/AppShell";
import { IconUser, IconArrowRight } from "@/components/icons";

const SETTINGS_SECTIONS = [
  {
    href: "/settings/users",
    title: "Users",
    description: "See who has access and add new accounts.",
    icon: IconUser,
  },
] as const;

export default function SettingsPage() {
  return (
    <AppShell active="/settings" title="Settings">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-500">
          Manage your application and account settings.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group flex items-start justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-black">{section.title}</p>
                    <p className="mt-0.5 text-sm text-zinc-500">{section.description}</p>
                  </div>
                </div>
                <IconArrowRight className="mt-1.5 h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500" />
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
