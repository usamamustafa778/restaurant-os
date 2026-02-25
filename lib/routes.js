// lib/routes.js
// Helper to build tenant-aware routes.
//
// ROUTING MODEL:
//   Dashboard:           eatsdesk.com/overview, /orders, etc.  (tenant from JWT)
//   Restaurant website:  slug.eatsdesk.com                     (subdomain)
//   Localhost website:   localhost:3000/slug                    (path-based fallback)

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "";

/**
 * Check if subdomain-based routing is enabled (production).
 */
export function isSubdomainMode() {
  return !!ROOT_DOMAIN;
}

/**
 * Build the full external URL for a tenant's customer-facing website.
 *
 * Production: "https://urbanspoon.sufieats.com"
 * Localhost:  "/urbanspoon"
 */
export function buildTenantWebsiteUrl(slug, path = "") {
  if (!slug) return path || "/";

  // Production: subdomain-based URL
  if (ROOT_DOMAIN) {
    const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
    return `${protocol}//${encodeURIComponent(slug)}.${ROOT_DOMAIN}${path}`;
  }

  // Localhost / non-subdomain: path-based URL
  return `/${encodeURIComponent(slug)}${path}`;
}

/**
 * Build a tenant URL. For backward compatibility.
 * Dashboard URLs are always on the main domain now.
 */
export function buildTenantUrl(slug, path = "") {
  // Dashboard and auth paths are always on the main domain (no slug prefix)
  if (path.startsWith("/login") || path.startsWith("/super") || path === "/") {
    return path;
  }

  // For customer-facing website, use subdomain
  return buildTenantWebsiteUrl(slug, path);
}

/**
 * Get tenant slug from stored auth (localStorage).
 * This is the primary way to get the tenant context for the dashboard.
 */
export function getTenantSlugFromAuth() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("restaurantos_auth");
    if (!raw) return null;
    const auth = JSON.parse(raw);
    return auth?.user?.tenantSlug || auth?.tenantSlug || null;
  } catch {
    return null;
  }
}

/**
 * Extract tenant slug from the current browser context.
 * For subdomains (customer website) or from stored auth (dashboard).
 */
export function getCurrentTenantSlug() {
  if (typeof window === "undefined") return null;

  // Subdomain mode: extract from hostname (for customer website pages)
  if (ROOT_DOMAIN) {
    const hostname = window.location.hostname;
    if (hostname.endsWith(ROOT_DOMAIN)) {
      const prefix = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
      if (prefix && prefix !== "www" && !prefix.includes(".")) {
        return prefix;
      }
    }
  }

  // Dashboard: get from stored auth
  return getTenantSlugFromAuth();
}

/**
 * Extract tenant slug from a clean pathname (for backward compat).
 */
export function getTenantSlugFromPath(pathname) {
  if (typeof pathname !== "string") return null;

  // Legacy /r/ path
  const rMatch = pathname.match(/^\/r\/([^/]+)\//);
  if (rMatch) return rMatch[1];

  return null;
}

/**
 * Build a route for in-app navigation (sidebar links, etc).
 * Dashboard links are always just the path — no slug prefix needed.
 */
export function getTenantRoute(currentPath, targetPath) {
  // Dashboard links are always on the main domain, no prefix needed
  return targetPath;
}
