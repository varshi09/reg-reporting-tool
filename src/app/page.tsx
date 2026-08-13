"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Proxy already redirects unauthenticated requests to /login before
    // this page can render, so reaching here means there's a valid session.
    router.replace("/dashboard");
  }, [router]);

  return null;
}
