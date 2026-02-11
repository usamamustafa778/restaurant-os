// lib/routes.js
// Helper to build tenant-aware routes for the dashboard.
// User-facing URLs never contain /r/ — the middleware handles rewriting internally.

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "";

/**
 * Check if subdomain-based routing is enabled (production).
 */
export function isSubdomainMode() {
  return !!ROOT_DOMAIN;
}

/**
 * Build the full external URL for a tenant (used for window.location redirects).
 *
 * Production: "https://urbanspoon.sufieats.com/dashboard/overview"
 * Localhost:  "/urbanspoon/dashboard/overview"
 */
export function buildTenantUrl(slug, path = "") {
  if (!slug) return path || "/";

  // Production: subdomain-based URL
  if (ROOT_DOMAIN) {
    const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
    return `${protocol}//${encodeURIComponent(slug)}.${ROOT_DOMAIN}${path}`;
  }

  // Localhost / non-subdomain: clean path-based URL (no /r/)
  return `/${encodeURIComponent(slug)}${path}`;
}

/**
 * Extract tenant slug from a clean pathname like:
 *  - /urbanspoon/dashboard/overview
 *  - /urbanspoon/login
 *  - /r/urbanspoon/dashboard  (legacy, still supported)
 */
export function getTenantSlugFromPath(pathname) {
  if (typeof pathname !== "string") return null;

  // Legacy /r/ path
  const rMatch = pathname.match(/^\/r\/([^/]+)\//);
  if (rMatch) return rMatch[1];

  // Clean path: /<slug>/dashboard or /<slug>/login or /<slug>/<role>/dashboard
  const RESERVED = new Set([
    "dashboard", "api", "_next", "login", "signup", "r", "favicon.ico", "images", "static"
  ]);
  const cleanMatch = pathname.match(/^\/([^/]+)\//);
  if (cleanMatch && !RESERVED.has(cleanMatch[1])) {
    return cleanMatch[1];
  }

  return null;
}

/**
 * Extract tenant slug from the current browser context:
 * hostname (subdomain mode) or URL path.
 */
export function getCurrentTenantSlug() {
  if (typeof window === "undefined") return null;

  // Subdomain mode: extract from hostname
  if (ROOT_DOMAIN) {
    const hostname = window.location.hostname;
    if (hostname.endsWith(ROOT_DOMAIN)) {
      const prefix = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
      if (prefix && prefix !== "www" && !prefix.includes(".")) {
        return prefix;
      }
    }
  }

  // Path mode: extract from URL
  return getTenantSlugFromPath(window.location.pathname);
}

/**
 * Build a tenant-aware route for in-app navigation (sidebar links, etc).
 *
 * Subdomain mode: returns just the path ("/dashboard/overview")
 * Path mode:      returns "/<slug>/dashboard/overview"
 */
export function getTenantRoute(currentPath, targetPath) {
  // Subdomain mode: tenant context comes from hostname
  if (ROOT_DOMAIN) {
    return targetPath;
  }

  // Path mode: prefix with /<slug>
  const slug = getTenantSlugFromPath(currentPath || "");
  if (!slug) return targetPath;

  // Avoid double-prefixing
  if (targetPath.startsWith(`/${slug}/`)) {
    return targetPath;
  }

  return `/${encodeURIComponent(slug)}${targetPath}`;
}
