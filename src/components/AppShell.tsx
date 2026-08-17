"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRequireAuth } from "@/lib/useRequireAuth";
import {
  IconHome,
  IconCloudUpload,
  IconDocument,
  IconShieldCheck,
  IconSend,
  IconFolder,
  IconScale,
  IconSettings,
  IconBell,
  IconMenu,
  IconLogout,
  IconChevronDown,
  IconCheckCircle,
} from "@/components/icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: IconHome },
  { href: "/upload", label: "Upload Data", icon: IconCloudUpload },
  { href: "/approvals", label: "Approvals", icon: IconCheckCircle },
  { href: "/reports", label: "Generate Report", icon: IconDocument },
  { href: "/validation", label: "Validation", icon: IconShieldCheck },
  { href: "/submissions", label: "Submissions", icon: IconSend },
  { href: "/report-library", label: "Report Library", icon: IconFolder },
  { href: "/reconciliation", label: "Reconciliation", icon: IconScale },
  { href: "/settings", label: "Settings", icon: IconSettings },
] as const;

export type NavHref = (typeof NAV_ITEMS)[number]["href"];

export default function AppShell({
  active,
  title,
  children,
}: {
  active: NavHref;
  title: string;
  children: ReactNode;
}) {
  const { checked, logout, username } = useRequireAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!checked) {
    return null;
  }

  const initial = username ? username.charAt(0).toUpperCase() : "?";

  return (
    <div className="flex flex-1 bg-zinc-100">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`${mobileNavOpen ? "flex" : "hidden"} fixed inset-y-0 left-0 z-40 w-64 flex-col overflow-hidden bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-950 lg:static lg:flex`}
      >
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-[11px] font-bold text-indigo-700">
            BRF
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">CBUAE Regulatory</p>
            <p className="text-sm font-semibold text-white">Reporting</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-950/50"
                    : "text-indigo-200 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative mt-auto overflow-hidden px-5 pt-6 pb-5">
          <div
            className="pointer-events-none absolute -bottom-8 -left-10 h-44 w-64 opacity-[0.15] mix-blend-luminosity"
            style={{
              backgroundImage: "url('/brand-logo.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "13% center",
            }}
          />
          <div className="relative flex items-center gap-3 border-t border-white/10 pt-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{username || "—"}</p>
              <p className="text-xs text-indigo-300">Administrator</p>
            </div>
            <IconChevronDown className="h-4 w-4 shrink-0 text-indigo-300" />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="text-zinc-500 hover:text-zinc-900 lg:hidden"
              aria-label="Open navigation"
            >
              <IconMenu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              className="text-zinc-400 transition-colors hover:text-zinc-600"
              aria-label="Notifications"
            >
              <IconBell className="h-5 w-5" />
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              <IconLogout className="h-4 w-4" />
              Log out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
