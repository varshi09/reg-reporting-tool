"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";

type UserRow = { username: string; createdAt: string };

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch("/api/users");
    if (response.ok) {
      const data = await response.json();
      setUsers(data.users ?? []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return (
    <AppShell active="/settings" title="Users">
      <div className="flex flex-col gap-4">
        <Link
          href="/settings"
          className="w-fit text-sm text-zinc-500 hover:text-black"
        >
          ← Back to settings
        </Link>

        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Everyone who can sign in to this application.
          </p>
          <Link
            href="/settings/users/new"
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            + Add user
          </Link>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-zinc-500">No users yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500">
                    <th className="pb-2 pr-4 font-medium">Username</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.username}
                      className="border-t border-zinc-100 text-zinc-700"
                    >
                      <td className="py-2 pr-4">{u.username}</td>
                      <td className="py-2">
                        {new Date(u.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
