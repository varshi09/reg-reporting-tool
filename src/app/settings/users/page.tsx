"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { formatDateTime } from "@/lib/formatDateTime";

type UserRow = { username: string; createdAt: string; isAdmin: boolean };

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUsername, setCurrentUsername] = useState("");
  const [copiedUsername, setCopiedUsername] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState("");
  const [deletingUsername, setDeletingUsername] = useState("");
  const [error, setError] = useState("");

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
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCurrentUsername(data?.username ?? ""));
  }, [loadUsers]);

  async function copyUsername(username: string) {
    await navigator.clipboard.writeText(username);
    setCopiedUsername(username);
    setTimeout(() => setCopiedUsername(""), 1500);
  }

  async function confirmDelete(username: string) {
    setError("");
    setDeletingUsername(username);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(username)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Couldn't delete the user.");
        return;
      }
      setConfirmingDelete("");
      loadUsers();
    } finally {
      setDeletingUsername("");
    }
  }

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

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

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
                    <th className="pb-2 pr-4 font-medium">Created</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.username}
                      className="border-t border-zinc-100 text-zinc-700"
                    >
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span>{u.username}</span>
                          {u.isAdmin && (
                            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                              Admin
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => copyUsername(u.username)}
                            className="text-xs text-zinc-400 hover:text-zinc-700"
                          >
                            {copiedUsername === u.username ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        {formatDateTime(u.createdAt)}
                      </td>
                      <td className="py-2">
                        {confirmingDelete === u.username ? (
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">Delete this user?</span>
                            <button
                              type="button"
                              onClick={() => confirmDelete(u.username)}
                              disabled={deletingUsername === u.username}
                              className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                            >
                              {deletingUsername === u.username ? "Deleting..." : "Yes, delete"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDelete("")}
                              className="text-xs text-zinc-500 hover:text-zinc-700"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <span className="flex items-center gap-3">
                            <Link
                              href={`/settings/users/${encodeURIComponent(u.username)}/edit`}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                            >
                              Edit
                            </Link>
                            {u.username === currentUsername ? (
                              <span
                                className="text-xs text-zinc-300"
                                title="You can't delete the account you're signed in as."
                              >
                                Delete
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setError("");
                                  setConfirmingDelete(u.username);
                                }}
                                className="text-xs font-medium text-red-600 hover:text-red-700"
                              >
                                Delete
                              </button>
                            )}
                          </span>
                        )}
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
