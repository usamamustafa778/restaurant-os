/** Super-admin nav routes and permission keys (labels/icons live in AdminLayout). */
export const SUPER_ADMIN_NAV_ITEMS = [
  { href: "/super/overview", permission: "platform.overview.view" },
  { href: "/super/team", permission: "platform.staff.view" },
  { href: "/super/restaurants", permission: "platform.restaurants.view" },
  { href: "/super/subscriptions", permission: "platform.subscriptions.view" },
  { href: "/super/invoices", permission: "platform.invoices.view" },
  { href: "/super/users", permission: "platform.restaurants.view" },
  { href: "/super/roles", permission: "platform.roles.manage" },
  { href: "/super/permissions", permission: "platform.permissions.manage" },
  { href: "/super/leads", permission: "platform.leads.view" },
  { href: "/super/whatsapp", permission: "platform.whatsapp.view" },
  { href: "/super/settings", permission: "platform.settings.manage" },
  { href: "/super/audit", permission: "platform.audit.view" },
];

/** First super page the user can open; profile is the universal fallback. */
export function getFirstSuperAdminPath(hasPermissionFn) {
  for (const item of SUPER_ADMIN_NAV_ITEMS) {
    if (item.permission && hasPermissionFn(item.permission)) {
      return item.href;
    }
  }
  return "/super/profile";
}

/** Normalize Next.js path to /super/... for comparisons. */
export function normalizeSuperPath(pathname) {
  const path = String(pathname || "");
  const withoutDashboard = path.replace(/^\/dashboard/, "") || path;
  return withoutDashboard.split("?")[0] || "/super/profile";
}

export function isSuperAdminPath(pathname) {
  return normalizeSuperPath(pathname).startsWith("/super");
}
