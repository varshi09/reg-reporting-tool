import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSession, SESSION_COOKIE } from "@/lib/auth";

// Requests that must work without a session — the login form itself and the
// auth endpoints it calls.
const PUBLIC_PATHS = new Set(["/login"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const username = token ? await validateSession(token) : null;

  if (!username) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next's own static/image assets and files in
    // public/ (identified by having a file extension).
    "/((?!_next/static|_next/image|.*\\..*).*)",
  ],
};
