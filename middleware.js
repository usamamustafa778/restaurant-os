import { NextResponse } from "next/server";
import { verifyJwt } from "./lib/auth";

// Root domain for subdomain-based tenant routing.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "";

// Paths that are NOT tenant slugs (first segment of the URL)
const RESERVED_SEGMENTS = new Set([
  "dashboard", "api", "_next", "login", "signup", "r", "favicon.ico", "images", "static"
]);

const ALLOWED_ROLES = [
  "super_admin", "restaurant_admin", "staff", "admin",
  "product_manager", "cashier", "manager", "kitchen_staff"
];

/**
 * Extract tenant subdomain from the Host header (production only).
 */
function getSubdomain(host) {
  if (!ROOT_DOMAIN || !host) return null;
  const hostname = host.split(":")[0];
  if (!hostname.endsWith(ROOT_DOMAIN)) return null;
  const prefix = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
  if (!prefix || prefix === "www" || prefix.includes(".")) return null;
  return prefix;
}

/**
 * Try to extract a tenant slug from a clean URL path like:
 *   /urbanspoon/dashboard/pos      → { slug: "urbanspoon", rest: "/dashboard/pos" }
 *   /urbanspoon/login              → { slug: "urbanspoon", rest: "/login" }
 *   /urbanspoon/cashier/dashboard  → { slug: "urbanspoon", rest: "/cashier/dashboard" }
 *
 * Returns null if the first segment is a reserved/known route.
 */
function extractTenantFromPath(pathname) {
  // Must have at least /<slug>/<something>
  const match = pathname.match(/^\/([^/]+)(\/.*)?$/);
  if (!match) return null;

  const firstSegment = match[1];
  const rest = match[2] || "";

  // If first segment is a known route, it's not a tenant slug
  if (RESERVED_SEGMENTS.has(firstSegment)) return null;

  // The rest must start with /dashboard, /login, or be a role-scoped dashboard
  // e.g. /urbanspoon/dashboard/..., /urbanspoon/login, /urbanspoon/cashier/dashboard/...
  if (
    rest.startsWith("/dashboard") ||
    rest.startsWith("/login") ||
    rest === "" ||
    /^\/[^/]+\/dashboard/.test(rest) ||
    /^\/[^/]+\/login/.test(rest)
  ) {
    return { slug: firstSegment, rest };
  }

  return null;
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

  // Block direct /r/ URLs — redirect to clean format (strip /r/)
  // e.g. /r/urbanspoon/dashboard/website → /urbanspoon/dashboard/website
  if (pathname.startsWith("/r/")) {
    const withoutR = pathname.replace(/^\/r\//, "/");
    const url = request.nextUrl.clone();
    url.pathname = withoutR;
    return NextResponse.redirect(url);
  }

  // ─── Subdomain-based routing (production) ──────────────────────────────
  const tenantSubdomain = getSubdomain(host);

  if (tenantSubdomain) {
    const url = request.nextUrl.clone();
    const internalPath = pathname === "/" ? "" : pathname;
    url.pathname = `/r/${tenantSubdomain}${internalPath}`;

    // Auth-protect dashboard routes
    if (pathname.startsWith("/dashboard")) {
      const payload = await checkAuth(request);
      if (!payload) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Cross-tenant protection: wrong tenant → clear stale cookie, send to this tenant's login
      if (payload.role !== "super_admin" && payload.tenantSlug && payload.tenantSlug !== tenantSubdomain) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.searchParams.set("from", pathname);
        const res = NextResponse.redirect(loginUrl);
        // Clear cookie on root domain and current domain
        res.cookies.set("token", "", { path: "/", maxAge: 0, domain: ROOT_DOMAIN ? `.${ROOT_DOMAIN}` : undefined });
        res.cookies.set("token", "", { path: "/", maxAge: 0 });
        return res;
      }
    }

    return NextResponse.rewrite(url);
  }

  // ─── Clean-path tenant routing (localhost & non-subdomain hosts) ───────
  // Detect /<slug>/dashboard/... or /<slug>/login patterns
  const tenantPath = extractTenantFromPath(pathname);

  if (tenantPath) {
    const { slug, rest } = tenantPath;

    // Auth-protect dashboard routes
    const isDashboard = rest.startsWith("/dashboard") || /^\/[^/]+\/dashboard/.test(rest);
    if (isDashboard) {
      const payload = await checkAuth(request);
      if (!payload) {
        const url = request.nextUrl.clone();
        url.pathname = `/${slug}/login`;
        url.searchParams.set("from", pathname);
        return NextResponse.redirect(url);
      }

      // Cross-tenant protection: wrong tenant → clear stale cookie, send to this tenant's login
      if (payload.role !== "super_admin" && payload.tenantSlug && payload.tenantSlug !== slug) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = `/${slug}/login`;
        loginUrl.searchParams.set("from", pathname);
        const res = NextResponse.redirect(loginUrl);
        res.cookies.set("token", "", { path: "/", maxAge: 0, domain: ROOT_DOMAIN ? `.${ROOT_DOMAIN}` : undefined });
        res.cookies.set("token", "", { path: "/", maxAge: 0 });
        return res;
      }
    }

    // Rewrite /<slug>/... → /r/<slug>/... internally
    const url = request.nextUrl.clone();
    url.pathname = `/r/${slug}${rest}`;
    return NextResponse.rewrite(url);
  }

  // ─── Platform-level dashboard auth (no tenant) ─────────────────────────
  if (pathname.startsWith("/dashboard")) {
    const payload = await checkAuth(request);
    if (!payload) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }

    // Restaurant users must always have their slug in the URL.
    // Redirect /dashboard/... → /<slug>/dashboard/... for non-super_admin users.
    if (payload.role !== "super_admin" && payload.tenantSlug) {
      const url = request.nextUrl.clone();
      const dashPath = pathname; // e.g. /dashboard/overview
      url.pathname = `/${payload.tenantSlug}${dashPath}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)"
  ]
};
