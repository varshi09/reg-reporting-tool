"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const isLoggedIn = sessionStorage.getItem("rrt_logged_in") === "true";
    router.replace(isLoggedIn ? "/dashboard" : "/login");
  }, [router]);

  return null;
}
