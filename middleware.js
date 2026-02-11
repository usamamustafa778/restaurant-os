import { NextResponse } from "next/server";
import { verifyJwt } from "./lib/auth";

// Root domain(s) where the main app is hosted.
// Requests to <tenant>.sufieats.com will be rewritten to /r/<tenant>.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "";

/**
 * Extract tenant subdomain from the Host header.
 * Returns null for the root domain, www, or localhost.
 *
 * Examples (ROOT_DOMAIN = "sufieats.com"):
 *   urbanspoon.sufieats.com  → "urbanspoon"
 *   www.sufieats.com         → null
 *   sufieats.com             → null
 *   localhost:3000           → null
 */
function getSubdomain(host) {
  if (!ROOT_DOMAIN || !host) return null;

  // Strip port if present
  const hostname = host.split(":")[0];

  // Must end with the root domain
  if (!hostname.endsWith(ROOT_DOMAIN)) return null;

  // Extract the part before .rootdomain
  const prefix = hostname.slice(0, -(ROOT_DOMAIN.length + 1)); // +1 for the dot

  // Ignore empty (bare domain), "www", or multi-level subdomains
  if (!prefix || prefix === "www" || prefix.includes(".")) return null;

  return prefix;
}

function buildLoginRedirect(request, pathname, tenantDashboardMatch) {
  const url = request.nextUrl.clone();

  if (tenantDashboardMatch) {
    const slug = tenantDashboardMatch[1];
    const role = tenantDashboardMatch[2];
    url.pathname = role ? `/r/${slug}/${role}/login` : `/r/${slug}/login`;
  } else {
    url.pathname = "/login";
  }

  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

  // ─── Subdomain-based tenant website routing ───────────────────────────
  // Rewrite urbanspoon.sufieats.com → /r/urbanspoon (internally)
  const tenantSubdomain = getSubdomain(host);

  if (tenantSubdomain) {
    // If the path is the root or doesn't start with /r/ or /dashboard or /_next or /api,
    // rewrite to the tenant public website page
    if (
      pathname === "/" ||
      (!pathname.startsWith("/r/") &&
        !pathname.startsWith("/dashboard") &&
        !pathname.startsWith("/_next") &&
        !pathname.startsWith("/api") &&
        !pathname.startsWith("/login") &&
        !pathname.startsWith("/signup") &&
        !pathname.startsWith("/favicon"))
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `/r/${tenantSubdomain}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  // ─── Dashboard auth protection ────────────────────────────────────────
  const isPlatformDashboard = pathname.startsWith("/dashboard");
  const tenantDashboardMatch = pathname.match(/^\/r\/([^/]+)\/(?:([^/]+)\/)?dashboard(\/.*)?$/);

  if (!isPlatformDashboard && !tenantDashboardMatch) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;

  if (!token) {
    return buildLoginRedirect(request, pathname, tenantDashboardMatch);
  }

  const payload = await verifyJwt(token);

  const allowedRoles = [
    "super_admin",
    "restaurant_admin",
    "staff",
    "admin",
    "product_manager",
    "cashier",
    "manager",
    "kitchen_staff"
  ];
  if (!payload || !allowedRoles.includes(payload.role)) {
    return buildLoginRedirect(request, pathname, tenantDashboardMatch);
  }

  // Prevent cross-tenant access: redirect to the user's own restaurant dashboard
  if (tenantDashboardMatch && payload.tenantSlug) {
    const slugFromPath = tenantDashboardMatch[1];
    if (slugFromPath !== payload.tenantSlug) {
      const url = request.nextUrl.clone();
      const dashPath = tenantDashboardMatch[3] || '';
      url.pathname = `/r/${payload.tenantSlug}/dashboard${dashPath}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Dashboard protection
    "/dashboard/:path*",
    "/r/:tenantSlug/dashboard/:path*",
    "/r/:tenantSlug/:role/dashboard/:path*",
    // Catch-all for subdomain routing (exclude static files and api)
    "/((?!_next/static|_next/image|favicon.ico).*)"
  ]
};
