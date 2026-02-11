// lib/routes.js
// Helper to build tenant-aware routes for the dashboard.
// Ensures all links include /r/:tenantSlug when the current URL has a tenant context.

/**
 * Extract tenant slug from a pathname like:
 *  - /r/my-restaurant/dashboard/overview
 *  - /r/my-restaurant/dashboard
 */
export function getTenantSlugFromPath(pathname) {
  if (typeof pathname !== "string") return null;
  const match = pathname.match(/^\/r\/([^/]+)\//);
  return match ? match[1] : null;
}

/**
 * Build a tenant-aware route.
 *
 * @param {string} currentPath - router.asPath or router.pathname
 * @param {string} targetPath  - dashboard path starting with `/dashboard`
 *
 * If currentPath is already under `/r/:tenantSlug/` we prefix targetPath
 * with the same `/r/:tenantSlug` segment. Otherwise we return targetPath
 * unchanged so legacy routes continue to work.
 */
export function getTenantRoute(currentPath, targetPath) {
  const slug = getTenantSlugFromPath(currentPath || "");
  if (!slug) return targetPath;

  // Avoid double-prefixing if caller already passed a tenant route
  if (targetPath.startsWith(`/r/${slug}/`)) {
    return targetPath;
  }

  return `/r/${encodeURIComponent(slug)}${targetPath}`;
}

