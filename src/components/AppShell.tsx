"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, type ReactNode, type MouseEvent } from "react";
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
  IconX,
  IconGitBranch,
} from "@/components/icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: IconHome },
  { href: "/upload", label: "Upload Data", icon: IconCloudUpload },
  { href: "/approvals", label: "Approvals", icon: IconCheckCircle },
  { href: "/reports", label: "Generate Report", icon: IconDocument },
  { href: "/pipeline-status", label: "Pipeline Status", icon: IconGitBranch },
  { href: "/pipeline-builder", label: "Pipeline Builder", icon: IconGitBranch },
  { href: "/validation", label: "Validation", icon: IconShieldCheck },
  { href: "/submissions", label: "Submissions", icon: IconSend },
  { href: "/report-library", label: "Report Library", icon: IconFolder },
  { href: "/reconciliation", label: "Reconciliation", icon: IconScale },
  { href: "/settings", label: "Settings", icon: IconSettings },
] as const;

export type NavHref = (typeof NAV_ITEMS)[number]["href"];

type Notification = {
  id: number;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    const response = await fetch("/api/notifications");
    if (!response.ok) return;
    const data = await response.json();
    setNotifications(data.notifications ?? []);
    setUnreadCount(data.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    if (!checked) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [checked, loadNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      await fetch(`/api/notifications/${notification.id}/read`, { method: "POST" });
      loadNotifications();
    }
    setNotifOpen(false);
    if (notification.link) router.push(notification.link);
  }

  async function handleMarkAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    loadNotifications();
  }

  async function handleClearOne(event: MouseEvent, id: number) {
    event.stopPropagation();
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    loadNotifications();
  }

  async function handleClearAll() {
    await fetch("/api/notifications/clear-all", { method: "POST" });
    loadNotifications();
  }

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
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative text-zinc-400 transition-colors hover:text-zinc-600"
                aria-label="Notifications"
              >
                <IconBell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-zinc-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
                    <p className="text-sm font-semibold text-zinc-900">Notifications</p>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          Mark all read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={handleClearAll}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-700"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-zinc-500">
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`group relative border-b border-zinc-50 last:border-b-0 ${
                            n.isRead ? "" : "bg-indigo-50/50"
                          }`}
                        >
                          <button
                            onClick={() => handleNotificationClick(n)}
                            className="flex w-full flex-col gap-0.5 py-2.5 pl-4 pr-9 text-left transition-colors hover:bg-zinc-50"
                          >
                            <span className="flex items-start gap-2">
                              {!n.isRead && (
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                              )}
                              <span
                                className={`text-sm ${n.isRead ? "text-zinc-600" : "font-medium text-zinc-900"}`}
                              >
                                {n.message}
                              </span>
                            </span>
                            <span className="pl-3.5 text-xs text-zinc-400">
                              {timeAgo(n.createdAt)}
                            </span>
                          </button>
                          <button
                            onClick={(e) => handleClearOne(e, n.id)}
                            aria-label="Clear notification"
                            className="absolute right-2.5 top-2.5 rounded p-1 text-zinc-300 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-600 group-hover:opacity-100"
                          >
                            <IconX className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
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
