"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function useRequireAuth() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      const response = await fetch("/api/auth/me");
      if (cancelled) return;

      if (!response.ok) {
        router.replace("/login");
        return;
      }

      const data = await response.json();
      setUsername(data.username ?? "");
      setChecked(true);
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return { checked, logout, username };
}
