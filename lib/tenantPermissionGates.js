/**
 * Tenant permission aliases (Phase 4 — permission keys primary).
 */

export const TENANT_PERMISSION_ALIASES = {
  "pos.apply_discount": ["orders.apply_discount"],
  "pos.void_order": ["orders.cancel"],
  "pos.modify_paid_order": ["orders.edit_after_served"],
  "pos.view_session_report": [
    "orders.view_session_report",
    "session.view_reports",
  ],
  "pos.start_business_day": ["session.manage"],
  "pos.close_business_day": ["session.manage"],
  "accounting.access": ["accounts.view_board"],
  "deals_modifiers.manage": ["menu.manage_deals"],
  "orders.reprint": ["orders.print", "orders.download_closed_report"],
  "menu.change_prices": ["menu.manage"],
  "reports.view_all_staff_sales": ["reports.view_sales"],
};

export const OWNER_LIKE_ROLES = [
  "restaurant_admin",
  "admin",
  "super_admin",
];

/** @deprecated use OWNER_LIKE_ROLES */
export const MANAGER_LIKE_ROLES = OWNER_LIKE_ROLES;

export function permissionMatches(permissions, key) {
  if (!Array.isArray(permissions)) return false;
  if (permissions.includes("*")) return true;
  if (permissions.includes(key)) return true;
  const aliases = TENANT_PERMISSION_ALIASES[key] || [];
  if (aliases.some((a) => permissions.includes(a))) return true;
  for (const [newKey, legacyKeys] of Object.entries(TENANT_PERMISSION_ALIASES)) {
    if (legacyKeys.includes(key) && permissions.includes(newKey)) return true;
  }
  return false;
}

export function roleAllows(role, allowRoles = []) {
  return Boolean(role && allowRoles.includes(role));
}
