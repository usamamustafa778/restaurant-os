import { NextResponse } from "next/server";
import { verifyJwt } from "./lib/auth";

// Root domain for subdomain-based tenant routing.
// In production set NEXT_PUBLIC_ROOT_DOMAIN=eatsdesk.com so urbanspoon.eatsdesk.com → /r/urbanspoon
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "";

const ALLOWED_ROLES = [
  "super_admin", "restaurant_admin", "staff", "admin",
  "product_manager", "cashier", "manager", "kitchen_staff",
  "order_taker",
];

// Dashboard pages that live under pages/dashboard/ and are now served at /<page>
const DASHBOARD_PAGES = new Set([
  "overview", "pos", "orders", "kitchen", "reservations",
  "categories", "menu-items", "menu",
  "customers", "inventory", "deals",
  "users", "branches", "tables", "history",
  "website", "website-content", "integrations",
  "subscription", "profile", "day-report",
  "order-taker",
]);

// Routes that should only be visible to non-authenticated users
const PUBLIC_ONLY_ROUTES = new Set(["/signup"]);

/**
 * Extract tenant subdomain from the Host header.
 * e.g. urbanspoon.eatsdesk.com → "urbanspoon"
 *      urbanspoon.localhost:3000 → "urbanspoon"
 */
function getSubdomain(host) {
  if (!ROOT_DOMAIN || !host) return null;
  const hostname = host.split(":")[0];
  const rootHostname = ROOT_DOMAIN.split(":")[0];
  if (!hostname.endsWith(rootHostname)) return null;
  const prefix = hostname.slice(0, -(rootHostname.length + 1));
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

/**
 * Check if the first path segment is a known dashboard page.
 * e.g. /overview → "overview", /orders → "orders"
 */
function getDashboardPage(pathname) {
  const match = pathname.match(/^\/([^/]+)/);
  return match && DASHBOARD_PAGES.has(match[1]) ? match[1] : null;
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
  const tenantSubdomain = getSubdomain(host);

  if (tenantSubdomain) {
    // Dashboard / auth pages on a subdomain → redirect to main domain
    const dashPage = getDashboardPage(pathname);
    if (
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/super") ||
      dashPage ||
      pathname === "/login"
    ) {
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

  // ─── Backward compat: /dashboard/* → redirect to /* ────────────────────
  if (pathname.startsWith("/dashboard")) {
    const cleanPath = pathname.replace(/^\/dashboard/, "") || "/";
    const url = request.nextUrl.clone();
    url.pathname = cleanPath;
    return NextResponse.redirect(url, 301);
  }

  // ─── Root path: authenticated → dashboard, otherwise → landing page ────
  if (pathname === "/") {
    const payload = await checkAuth(request);
    if (payload) {
      // Order taker → dedicated mobile POS
      if (payload.role === "order_taker") {
        const url = request.nextUrl.clone();
        url.pathname = "/order-taker";
        return NextResponse.redirect(url);
      }
      // Super admin without "acting as" → super overview
      if (payload.role === "super_admin") {
        const actingAs = request.cookies.get("restaurantos_acting_as")?.value;
        if (!actingAs) {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard/super/overview";
          return NextResponse.rewrite(url);
        }
      }
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/overview";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // ─── Super admin pages: /super/* → rewrite to /dashboard/super/* ───────
  if (pathname.startsWith("/super")) {
    const payload = await checkAuth(request);
    if (!payload) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }

    // Non-super-admin trying /super/* → redirect to /overview
    if (payload.role !== "super_admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/overview";
      return NextResponse.redirect(url);
    }

    const url = request.nextUrl.clone();
    url.pathname = `/dashboard${pathname}`;
    return NextResponse.rewrite(url);
  }

  // ─── Dashboard pages: /overview, /orders, /pos, etc. ──────────────────
  if (getDashboardPage(pathname)) {
    const payload = await checkAuth(request);
    if (!payload) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }

    // Order taker can only access /order-taker
    if (payload.role === "order_taker" && pathname !== "/order-taker") {
      const url = request.nextUrl.clone();
      url.pathname = "/order-taker";
      return NextResponse.redirect(url);
    }

    // Non-order-taker roles should not access the order-taker page
    if (payload.role !== "order_taker" && pathname === "/order-taker") {
      const url = request.nextUrl.clone();
      url.pathname = "/overview";
      return NextResponse.redirect(url);
    }

    // Super admin without "acting as" can only see /super/* pages
    if (payload.role === "super_admin") {
      const actingAs = request.cookies.get("restaurantos_acting_as")?.value;
      if (!actingAs) {
        const url = request.nextUrl.clone();
        url.pathname = "/super/overview";
        return NextResponse.redirect(url);
      }
    }

    // Rewrite clean URL to the actual file path under pages/dashboard/
    const url = request.nextUrl.clone();
    url.pathname = `/dashboard${pathname}`;
    return NextResponse.rewrite(url);
  }

  // ─── Public-only routes: redirect authenticated users to / ─────────────
  if (PUBLIC_ONLY_ROUTES.has(pathname)) {
    const payload = await checkAuth(request);
    if (payload) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ─── Legacy clean-path tenant URLs: /<slug>/... ────────────────────────
  const RESERVED_SEGMENTS = new Set([
    "dashboard", "api", "_next", "login", "signup", "r",
    "favicon.ico", "images", "static", "super",
    "privacy-policy", "terms-and-conditions",
    ...DASHBOARD_PAGES,
  ]);
  const pathMatch = pathname.match(/^\/([^/]+)(\/.*)?$/);
  if (pathMatch) {
    const firstSegment = pathMatch[1];
    const rest = pathMatch[2] || "";

    if (!RESERVED_SEGMENTS.has(firstSegment)) {
      // /<slug>/login → redirect to /login
      if (rest.startsWith("/login")) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }

      // /<slug>/dashboard/... → redirect to clean path (strip slug + dashboard)
      if (rest.startsWith("/dashboard")) {
        const cleanPath = rest.replace(/^\/dashboard/, "") || "/";
        const url = request.nextUrl.clone();
        url.pathname = cleanPath;
        const fromParam = url.searchParams.get("from");
        if (fromParam && fromParam.startsWith(`/${firstSegment}/`)) {
          url.searchParams.set("from", fromParam.replace(`/${firstSegment}`, ""));
        }
        return NextResponse.redirect(url);
      }

      // /<slug> or /<slug>/... → customer-facing website (localhost fallback)
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
