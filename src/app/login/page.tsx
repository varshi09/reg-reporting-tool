"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  IconLock,
  IconUser,
  IconEye,
  IconEyeOff,
  IconShieldCheck,
  IconDocument,
  IconArrowRight,
} from "@/components/icons";

const CHECKLIST = [
  { icon: IconDocument, line1: "Automated BRF report generation", line2: "across entities" },
  { icon: IconShieldCheck, line1: "Built-in validation &", line2: "reconciliation checks" },
  { icon: IconLock, line1: "Secure submission &", line2: "full audit trail" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        router.push("/dashboard");
        return;
      }

      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Invalid username or password.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-stretch bg-white">
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-950 via-indigo-800 to-blue-600 px-10 pt-10 pb-10 md:flex">
        <div
          className="pointer-events-none absolute right-0 top-0 h-56 w-56 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1.5px)",
            backgroundSize: "18px 18px",
            maskImage: "radial-gradient(circle at top right, black, transparent 70%)",
            WebkitMaskImage: "radial-gradient(circle at top right, black, transparent 70%)",
          }}
        />

        <div className="pointer-events-none absolute -bottom-16 -right-24 h-[32rem] w-[32rem] -rotate-6 overflow-hidden">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: "url('/brand-logo.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "13% center",
            }}
          />
          <div className="absolute inset-0 bg-blue-700 mix-blend-color" />
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-indigo-950" />
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-950 via-transparent to-transparent" />
        </div>

        <div className="relative flex flex-col gap-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[11px] font-bold text-indigo-700">
              BRF
            </span>
            <span className="text-sm font-medium text-indigo-100">
              CBUAE Regulatory Reporting
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="text-2xl font-semibold leading-tight">
              <span className="text-white">Banking Return Framework</span>
              <br />
              <span className="text-indigo-300">Reporting Portal</span>
            </h1>
            <p className="max-w-xs text-sm leading-relaxed text-indigo-200">
              Generate, validate and submit Central Bank of the UAE BRF
              returns with confidence.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {CHECKLIST.map(({ icon: Icon, line1, line2 }) => (
              <div
                key={line1}
                className="flex items-start gap-3 border-b border-white/10 pb-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-sm leading-snug text-indigo-100">
                  {line1}
                  <br />
                  {line2}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2.5">
          <IconShieldCheck className="h-4 w-4 shrink-0 text-indigo-300" />
          <div>
            <p className="text-sm font-semibold text-white">
              Secure. Compliant. Reliable.
            </p>
            <p className="text-xs text-indigo-300">
              Built for regulatory excellence.
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-white px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <h1 className="text-xl font-semibold text-black">
              Banking Return Framework Reporting Portal
            </h1>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-xl">
            <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-purple-500" />
            <div className="p-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
                <IconLock className="h-6 w-6 text-indigo-600" />
              </div>
              <h2 className="mt-4 text-center text-2xl font-bold text-black">
                Welcome back
              </h2>
              <p className="mt-1 text-center text-sm text-zinc-500">
                Sign in to continue to your account.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="username" className="text-sm font-medium text-black">
                    Username
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <IconUser className="h-4 w-4" />
                    </span>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-black outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      placeholder="Enter your username"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="password" className="text-sm font-medium text-black">
                    Password
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <IconLock className="h-4 w-4" />
                    </span>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-9 text-sm text-black outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <IconEyeOff className="h-4 w-4" />
                      ) : (
                        <IconEye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="rememberMe"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="rememberMe" className="text-sm text-zinc-600">
                    Remember me
                  </label>
                </div>

                {error && (
                  <p className="text-sm text-red-600" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    "Signing in..."
                  ) : (
                    <>
                      Sign in
                      <IconArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="relative mt-6 flex items-center justify-center">
                <div className="h-px w-full bg-zinc-200" />
                <span className="absolute flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400">
                  <IconShieldCheck className="h-3.5 w-3.5" />
                </span>
              </div>

            </div>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-400">
            © 2026 CBUAE Regulatory Reporting Portal. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
