/**
 * Tenant permission aliases (Phase 4 — permission keys primary).
 */

export const TENANT_PERMISSION_ALIASES = {
  "pos.view": ["orders.view"],
  "pos.apply_discount": ["orders.apply_discount"],
  "pos.void_order": ["orders.cancel"],
  "pos.modify_paid_order": ["orders.edit", "orders.edit_after_served"],
  // Legacy: Send Delivery / Mark Delivered previously required orders.edit
  "orders.send_delivery": ["orders.edit"],
  "orders.mark_delivered": ["orders.edit"],
  // Legacy stage/add keys satisfy Edit Orders (and reverse via permissionMatches)
  "orders.edit_new": ["orders.edit"],
  "orders.edit_preparing": ["orders.edit"],
  "orders.edit_ready": ["orders.edit"],
  "orders.edit_after_served": ["orders.edit"],
  "orders.edit_out_for_delivery": ["orders.edit"],
  "orders.add_items": ["orders.edit"],
  // Stage remove — legacy umbrella orders.delete_items grants all
  "orders.delete_items_new": ["orders.delete_items"],
  "orders.delete_items_preparing": ["orders.delete_items"],
  "orders.delete_items_ready": ["orders.delete_items"],
  "orders.delete_items_out_for_delivery": ["orders.delete_items"],
  "orders.delete_items_after_served": ["orders.delete_items"],
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
