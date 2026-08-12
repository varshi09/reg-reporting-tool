"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function useRequireAuth() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    const isLoggedIn = sessionStorage.getItem("rrt_logged_in") === "true";
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }
    setUsername(sessionStorage.getItem("rrt_username") ?? "");
    setChecked(true);
  }, [router]);

  function logout() {
    sessionStorage.removeItem("rrt_logged_in");
    sessionStorage.removeItem("rrt_username");
    router.push("/login");
  }

  return { checked, logout, username };
}
