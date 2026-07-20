import { NextResponse } from "next/server";
import { verifyJwt } from "./lib/auth";

// Root domain for subdomain-based tenant routing.
// Production app host: set NEXT_PUBLIC_ROOT_DOMAIN=app.eatsdesk.com
// (If left as eatsdesk.com while the app runs on app.eatsdesk.com, "app" is
// reserved and will not be treated as a restaurant tenant.)
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "";
// Subdomain for Food Hub (e.g. food.eatsdesk.com → /food). Do not use "food" as a restaurant slug.
const FOOD_HUB_SUBDOMAIN =
  (process.env.NEXT_PUBLIC_FOOD_HUB_SUBDOMAIN || "food").toLowerCase();

const SYSTEM_ROLES = [
  "super_admin",
  "restaurant_admin",
  "staff",
  "admin",
  "product_manager",
  "cashier",
  "manager",
  "kitchen_staff",
  "order_taker",
  "delivery_rider",
];

function isAllowedDashboardRole(role) {
  if (!role || typeof role !== "string" || !role.trim()) return false;
  if (SYSTEM_ROLES.includes(role)) return true;
  return role.length > 0;
}

// Dashboard pages that live under pages/dashboard/ and are now served at /<page>
const DASHBOARD_PAGES = new Set([
  "overview", "pos", "orders", "kitchen", "reservations",
  "categories", "menu-items", "menu", "modifier-groups",
  "customers", "inventory", "deals",
  "users", "business-settings", "settings", "tables", "history",
  "website-settings", "integrations", "whatsapp",
  "subscription", "profile", "day-report",
  "order-taker", "rider", "migrate-pending",
  "sales-report",
  "riders",
  "rider-payouts",
  "accounting", "vouchers",
]);

// Routes that should only be visible to non-authenticated users
const PUBLIC_ONLY_ROUTES = new Set(["/signup", "/login"]);

/**
 * Extract tenant subdomain from the Host header.
 * e.g. urbanspoon.eatsdesk.app → "urbanspoon"
 *      urbanspoon.localhost:3000 → "urbanspoon"
 */
function getSubdomain(host) {
  if (!ROOT_DOMAIN || !host) return null;
  const hostname = host.split(":")[0];
  const rootHostname = ROOT_DOMAIN.split(":")[0];
  if (!hostname.endsWith(rootHostname)) return null;
  const prefix = hostname.slice(0, -(rootHostname.length + 1));
  // Never treat the app host itself (or www) as a restaurant tenant.
  // e.g. host=app.eatsdesk.com with ROOT_DOMAIN=eatsdesk.com must NOT yield "app".
  if (
    !prefix ||
    prefix === "www" ||
    prefix === "app" ||
    prefix.includes(".")
  ) {
    return null;
  }
  return prefix;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const STOREFRONT_DOMAIN = (process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "").split(":")[0].toLowerCase();

/**
 * Custom domain (e.g. sufibiryani.com) → tenant subdomain via backend lookup on website.customDomain.
 */
async function resolveCustomDomainToSubdomain(hostHeader) {
  const raw = hostHeader.split(":")[0].toLowerCase();
  if (!raw || raw === "localhost" || raw.endsWith(".localhost")) return null;
  if (!API_BASE) return null;

  const root = (ROOT_DOMAIN || "").split(":")[0].toLowerCase();
  if (root && (raw === root || raw === `www.${root}`)) return null;

  if (
    STOREFRONT_DOMAIN &&
    (raw === STOREFRONT_DOMAIN || raw === `www.${STOREFRONT_DOMAIN}`)
  ) {
    return null;
  }

  if (raw.endsWith(".vercel.app")) return null;

  try {
    const url = `${API_BASE}/api/storefront/resolve-host?host=${encodeURIComponent(raw)}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    return data.subdomain || null;
  } catch {
    return null;
  }
}

async function checkAuth(request) {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;
  const payload = await verifyJwt(token);
  if (!payload || !isAllowedDashboardRole(payload.role)) return null;
  return payload;
}

/**
 * Check if the first path segment is a known dashboard page.
 * e.g. /overview → "overview", /pos → "pos"
 */
function getDashboardPage(pathname) {
  const match = pathname.match(/^\/([^/]+)/);
  return match && DASHBOARD_PAGES.has(match[1]) ? match[1] : null;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  // Prefer x-forwarded-host when behind a proxy (Vercel, Cloudflare, etc.)
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("x-vercel-forwarded-host") ||
    request.headers.get("host") ||
    "";

  // Skip static/internal paths early (including public folder assets)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/st-images/") ||
    /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf|eot)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Legacy /r/* → /public/* (storefront pages live under pages/public/[slug])
  if (pathname.startsWith("/r/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/r\//, "/public/");
    return NextResponse.redirect(url);
  }

  // ─── Subdomain-based routing (production) ──────────────────────────────
  let tenantSubdomain = getSubdomain(host);
  // Fallback when ROOT_DOMAIN isn't set at build: detect food.eatsdesk.com explicitly
  if (!tenantSubdomain && host) {
    const h = host.split(":")[0].toLowerCase();
    if (h === "food.eatsdesk.com") tenantSubdomain = "food";
  }
  if (!tenantSubdomain && host) {
    const fromCustom = await resolveCustomDomainToSubdomain(host);
    if (fromCustom) tenantSubdomain = fromCustom;
  }

  if (tenantSubdomain) {
    // Food discovery hub (Foodpanda-style) — not a restaurant tenant
    if (tenantSubdomain === FOOD_HUB_SUBDOMAIN) {
      const url = request.nextUrl.clone();
      url.pathname = "/food";
      url.search = request.nextUrl.search;
      return NextResponse.rewrite(url);
    }

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

    // Customer-facing restaurant website: rewrite to /public/<slug>/... (see pages/public/[slug])
    const url = request.nextUrl.clone();
    const internalPath = pathname === "/" ? "" : pathname;
    url.pathname = `/public/${tenantSubdomain}${internalPath}`;
    return NextResponse.rewrite(url);
  }

  // ─── Legacy website settings URLs ───────────────────────────────────────
  if (pathname === "/website-content") {
    const url = request.nextUrl.clone();
    url.pathname = "/website-settings";
    return NextResponse.redirect(url, 301);
  }
  if (pathname === "/website-analytics") {
    const url = request.nextUrl.clone();
    url.pathname = "/website-settings";
    url.searchParams.set("section", "analytics");
    return NextResponse.redirect(url, 301);
  }

  // ─── Backward compat: /dashboard/* → redirect to /* ────────────────────
  if (pathname.startsWith("/dashboard")) {
    let cleanPath = pathname.replace(/^\/dashboard/, "") || "/";
    if (cleanPath === "/orders" || cleanPath.startsWith("/orders/")) {
      cleanPath = `/pos${cleanPath.slice("/orders".length)}`;
    }
    const url = request.nextUrl.clone();
    url.pathname = cleanPath;
    return NextResponse.redirect(url, 301);
  }

  // ─── Root path: authenticated → dashboard, otherwise → login ───────────
  if (pathname === "/") {
    const payload = await checkAuth(request);
    if (payload) {
      // Order taker → dedicated mobile POS
      if (payload.role === "order_taker") {
        const url = request.nextUrl.clone();
        url.pathname = "/order-taker";
        return NextResponse.redirect(url);
      }
      // Delivery rider → rider portal
      if (payload.role === "delivery_rider") {
        const url = request.nextUrl.clone();
        url.pathname = "/rider";
        return NextResponse.redirect(url);
      }
      // Super admin without "acting as" → super overview
      if (payload.role === "super_admin") {
        const actingAs = request.cookies.get("restaurantos_acting_as")?.value;
        if (!actingAs) {
          const url = request.nextUrl.clone();
          url.pathname = "/super/overview";
          return NextResponse.redirect(url);
        }
      }
      const url = request.nextUrl.clone();
      if (!SYSTEM_ROLES.includes(payload.role)) {
        url.pathname = "/pos";
      } else {
        url.pathname = "/overview";
      }
      return NextResponse.redirect(url);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
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

  // ─── Legacy /orders → /pos (bookmarks) ─────────────────────────────────
  if (pathname === "/orders" || pathname.startsWith("/orders/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/pos${pathname.slice("/orders".length)}`;
    return NextResponse.redirect(url, 301);
  }

  // ─── Dashboard pages: /overview, /pos, etc. ────────────────────────────
  if (getDashboardPage(pathname)) {
    const payload = await checkAuth(request);
    if (!payload) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }

    // Order taker can only access /order-taker and /profile
    if (
      payload.role === "order_taker" &&
      pathname !== "/order-taker" &&
      pathname !== "/profile"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/order-taker";
      return NextResponse.redirect(url);
    }

    // Delivery rider can only access /rider and /profile
    if (payload.role === "delivery_rider" && pathname !== "/rider" && pathname !== "/profile") {
      const url = request.nextUrl.clone();
      url.pathname = "/rider";
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
    "dashboard", "api", "_next", "login", "signup", "r", "public",
    "favicon.ico", "images", "static", "super",
    "st-images", "fonts", "icons", "assets",
    "privacy-policy", "terms-and-conditions", "read-more", "blog",
    "food", "sitemap.xml",
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
      url.pathname = `/public/${firstSegment}${rest}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|st-images/).*)"
  ]
};
