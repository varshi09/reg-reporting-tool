"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { UPLOAD_TABLES } from "@/lib/uploadTables";

type RoleValue = "MAKER" | "CHECKER" | "";

export default function EditUserPage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const username = decodeURIComponent(params.username);

  const [newUsername, setNewUsername] = useState(username);
  const [renameError, setRenameError] = useState("");
  const [renameSuccess, setRenameSuccess] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);

  const [roles, setRoles] = useState<Record<string, RoleValue>>({});
  const [rolesError, setRolesError] = useState("");
  const [rolesSuccess, setRolesSuccess] = useState("");
  const [isSavingRoles, setIsSavingRoles] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);

  const loadDetails = useCallback(async () => {
    setIsLoadingRoles(true);
    const [usersRes, rolesRes] = await Promise.all([
      fetch("/api/users"),
      fetch(`/api/users/${encodeURIComponent(username)}/roles`),
    ]);
    if (usersRes.ok) {
      const data = await usersRes.json();
      const match = data.users?.find(
        (u: { username: string; isAdmin: boolean }) => u.username === username
      );
      setIsAdmin(match?.isAdmin ?? false);
    }
    if (rolesRes.ok) {
      const data = await rolesRes.json();
      const map: Record<string, RoleValue> = {};
      for (const r of data.roles ?? []) {
        map[r.datasetKey] = r.role;
      }
      setRoles(map);
    }
    setIsLoadingRoles(false);
  }, [username]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  async function handleSaveRoles() {
    setRolesError("");
    setRolesSuccess("");
    setIsSavingRoles(true);
    try {
      const payload: Record<string, RoleValue | null> = {};
      for (const table of UPLOAD_TABLES) {
        payload[table.key] = roles[table.key] || null;
      }
      const response = await fetch(`/api/users/${encodeURIComponent(username)}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: payload }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRolesError(data.error ?? "Couldn't save roles.");
        return;
      }
      setRolesSuccess("Roles saved.");
    } catch {
      setRolesError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsSavingRoles(false);
    }
  }

  async function handleToggleAdmin() {
    setAdminError("");
    setAdminSuccess("");
    setIsSavingAdmin(true);
    const nextValue = !isAdmin;
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: nextValue }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAdminError(data.error ?? "Couldn't update admin access.");
        return;
      }
      setIsAdmin(nextValue);
      setAdminSuccess(nextValue ? "Admin access granted." : "Admin access removed.");
    } catch {
      setAdminError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsSavingAdmin(false);
    }
  }

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRenameError("");
    setRenameSuccess("");

    if (!newUsername || newUsername === username) {
      setRenameError("Enter a different username.");
      return;
    }

    setIsRenaming(true);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUsername }),
      });
      const data = await response.json();

      if (!response.ok) {
        setRenameError(data.error ?? "Couldn't rename the user.");
        return;
      }

      router.push("/settings/users");
    } catch {
      setRenameError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsRenaming(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetError("");
    setResetSuccess("");

    if (!password) {
      setResetError("Enter a new password.");
      return;
    }
    if (password !== confirmPassword) {
      setResetError("Passwords don't match.");
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setResetError(data.error ?? "Couldn't reset the password.");
        return;
      }

      setResetSuccess("Password reset. They'll need to sign in again.");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setResetError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <AppShell active="/settings" title={`Edit ${username}`}>
      <div className="flex flex-col gap-4">
        <Link
          href="/settings/users"
          className="w-fit text-sm text-zinc-500 hover:text-black"
        >
          ← Back to users
        </Link>

        <div className="max-w-md rounded-lg border border-zinc-200 bg-white shadow-sm p-6">
          <p className="text-sm font-semibold text-black">Rename</p>
          <form onSubmit={handleRename} className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="newUsername" className="text-sm font-medium text-zinc-700">
                Username
              </label>
              <input
                id="newUsername"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            {renameError && (
              <p className="text-sm text-red-600" role="alert">
                {renameError}
              </p>
            )}
            {renameSuccess && <p className="text-sm text-emerald-600">{renameSuccess}</p>}
            <button
              type="submit"
              disabled={isRenaming}
              className="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {isRenaming ? "Saving..." : "Save username"}
            </button>
          </form>
        </div>

        <div className="max-w-md rounded-lg border border-zinc-200 bg-white shadow-sm p-6">
          <p className="text-sm font-semibold text-black">Reset password</p>
          <p className="mt-1 text-sm text-zinc-500">
            This signs them out everywhere until they log in again with the
            new password.
          </p>
          <form onSubmit={handleResetPassword} className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-zinc-700">
                New password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
              <p className="text-xs text-zinc-400">
                At least 8 characters, with a letter and a number.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-700">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            {resetError && (
              <p className="text-sm text-red-600" role="alert">
                {resetError}
              </p>
            )}
            {resetSuccess && <p className="text-sm text-emerald-600">{resetSuccess}</p>}
            <button
              type="submit"
              disabled={isResetting}
              className="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {isResetting ? "Resetting..." : "Reset password"}
            </button>
          </form>
        </div>

        <div className="max-w-md rounded-lg border border-zinc-200 bg-white shadow-sm p-6">
          <p className="text-sm font-semibold text-black">Admin access</p>
          <p className="mt-1 text-sm text-zinc-500">
            Admins can manage users and see Settings and Report Library.
            They can also approve or reject any upload as a backup checker,
            regardless of dataset roles below.
          </p>
          <label className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={handleToggleAdmin}
              disabled={isSavingAdmin}
              className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-zinc-700">This user is an admin</span>
          </label>
          {adminError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {adminError}
            </p>
          )}
          {adminSuccess && <p className="mt-2 text-sm text-emerald-600">{adminSuccess}</p>}
        </div>

        <div className="max-w-md rounded-lg border border-zinc-200 bg-white shadow-sm p-6">
          <p className="text-sm font-semibold text-black">Dataset roles</p>
          <p className="mt-1 text-sm text-zinc-500">
            Maker can upload this dataset. Checker can approve or reject
            uploads for it. A person can only hold one of the two per
            dataset.
          </p>
          {isLoadingRoles ? (
            <p className="mt-4 text-sm text-zinc-500">Loading...</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {UPLOAD_TABLES.map((table) => (
                <div key={table.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-zinc-700">{table.label}</span>
                  <select
                    value={roles[table.key] ?? ""}
                    onChange={(e) =>
                      setRoles((prev) => ({
                        ...prev,
                        [table.key]: e.target.value as RoleValue,
                      }))
                    }
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                  >
                    <option value="">None</option>
                    <option value="MAKER">Maker</option>
                    <option value="CHECKER">Checker</option>
                  </select>
                </div>
              ))}
            </div>
          )}
          {rolesError && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {rolesError}
            </p>
          )}
          {rolesSuccess && <p className="mt-3 text-sm text-emerald-600">{rolesSuccess}</p>}
          <button
            type="button"
            onClick={handleSaveRoles}
            disabled={isSavingRoles || isLoadingRoles}
            className="mt-4 w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSavingRoles ? "Saving..." : "Save roles"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
