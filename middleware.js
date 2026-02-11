import { NextResponse } from "next/server";
import { verifyJwt } from "./lib/auth";

// Root domain for subdomain-based tenant routing.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "";

const ALLOWED_ROLES = [
  "super_admin", "restaurant_admin", "staff", "admin",
  "product_manager", "cashier", "manager", "kitchen_staff"
];

/**
 * Extract tenant subdomain from the Host header (production only).
 * e.g. urbanspoon.sufieats.com → "urbanspoon"
 */
function getSubdomain(host) {
  if (!ROOT_DOMAIN || !host) return null;
  const hostname = host.split(":")[0];
  if (!hostname.endsWith(ROOT_DOMAIN)) return null;
  const prefix = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
  if (!prefix || prefix === "www" || prefix.includes(".")) return null;
  return prefix;
}

async function checkAuth(request) {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;
  const payload = await verifyJwt(token);
  if (!payload || !ALLOWED_ROLES.includes(payload.role)) return null;
  return payload;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

  // Skip static/internal paths early
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Block direct /r/ URLs — redirect to clean format
  if (pathname.startsWith("/r/")) {
    const withoutR = pathname.replace(/^\/r\//, "/");
    const url = request.nextUrl.clone();
    url.pathname = withoutR;
    return NextResponse.redirect(url);
  }

  // ─── Subdomain-based routing (production) ──────────────────────────────
  // Subdomains are ONLY for the customer-facing restaurant website.
  // Dashboard is always on the main domain: sufieats.com/dashboard/...
  const tenantSubdomain = getSubdomain(host);

  if (tenantSubdomain) {
    // If someone tries to access /dashboard on a subdomain, redirect to main domain
    if (pathname.startsWith("/dashboard") || pathname === "/login") {
      const url = request.nextUrl.clone();
      const protocol = url.protocol || "https:";
      url.host = ROOT_DOMAIN;
      url.pathname = pathname;
      return NextResponse.redirect(url);
    }

    // Customer-facing restaurant website: rewrite subdomain to /r/<slug>/...
    const url = request.nextUrl.clone();
    const internalPath = pathname === "/" ? "" : pathname;
    url.pathname = `/r/${tenantSubdomain}${internalPath}`;
    return NextResponse.rewrite(url);
  }

  // ─── Dashboard auth (main domain: sufieats.com/dashboard/...) ──────────
  // Tenant context comes from JWT token, NOT from the URL.
  if (pathname.startsWith("/dashboard")) {
    const payload = await checkAuth(request);
    if (!payload) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }

    // Super admin accessing /dashboard but not /dashboard/super → redirect
    if (payload.role === "super_admin" && !pathname.startsWith("/dashboard/super")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/super/overview";
      return NextResponse.redirect(url);
    }

    // Restaurant users accessing /dashboard/super → redirect to their dashboard
    if (payload.role !== "super_admin" && pathname.startsWith("/dashboard/super")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/overview";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // ─── Legacy clean-path tenant URLs: /<slug>/dashboard/... ──────────────
  // Redirect these to /dashboard/... on the main domain (backward compat)
  const RESERVED_SEGMENTS = new Set([
    "dashboard", "api", "_next", "login", "signup", "r", "favicon.ico", "images", "static"
  ]);
  const pathMatch = pathname.match(/^\/([^/]+)(\/.*)?$/);
  if (pathMatch) {
    const firstSegment = pathMatch[1];
    const rest = pathMatch[2] || "";

    if (!RESERVED_SEGMENTS.has(firstSegment)) {
      // /<slug>/dashboard/... → redirect to /dashboard/...
      if (rest.startsWith("/dashboard")) {
        const url = request.nextUrl.clone();
        url.pathname = rest;
        // Clean the 'from' param too — strip slug prefix if present
        const fromParam = url.searchParams.get("from");
        if (fromParam && fromParam.startsWith(`/${firstSegment}/`)) {
          url.searchParams.set("from", fromParam.replace(`/${firstSegment}`, ""));
        }
        return NextResponse.redirect(url);
      }

      // /<slug>/login → redirect to /login
      if (rest.startsWith("/login") || rest === "") {
        const url = request.nextUrl.clone();
        url.pathname = rest || "/login";
        return NextResponse.redirect(url);
      }

      // /<slug>/... → customer-facing website on localhost
      // Rewrite to /r/<slug>/... internally
      const url = request.nextUrl.clone();
      url.pathname = `/r/${firstSegment}${rest}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)"
  ]
};
