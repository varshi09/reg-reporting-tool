"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";

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
      </div>
    </AppShell>
  );
}
