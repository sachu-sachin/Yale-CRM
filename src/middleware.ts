import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Public routes
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Not authenticated -> redirect to login
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Role-based route protection
  const role = (session.user as { role: string })?.role;

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/telecaller", req.url));
  }

  if (pathname.startsWith("/telecaller") && role !== "TELECALLER") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
