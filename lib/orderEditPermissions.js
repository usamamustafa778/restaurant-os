/**
 * Stage + action rules for editing order line items (FE).
 *
 * - Stage key → can open Edit at that status (and add/increase items).
 * - orders.delete_items → can remove/decrease items.
 * - orders.add_items → explicit add grant (also covered by stage keys).
 */

export const ORDER_EDIT_STAGE_KEYS = {
  NEW_ORDER: "orders.edit_new",
  PROCESSING: "orders.edit_preparing",
  READY: "orders.edit_ready",
  DELIVERED: "orders.edit_after_served",
  OUT_FOR_DELIVERY: "orders.edit_out_for_delivery",
};

function normalizeStatus(status) {
  return String(status || "").toUpperCase();
}

export function getOrderEditStageKey(status) {
  return ORDER_EDIT_STAGE_KEYS[normalizeStatus(status)] || null;
}

export function isAfterServedStatus(status) {
  const s = normalizeStatus(status);
  return s === "DELIVERED" || s === "COMPLETED";
}

/** @param {(key: string) => boolean} hasPermission */
export function canEditOrderAtStatus(hasPermission, status) {
  const key = getOrderEditStageKey(status);
  if (!key) return false;
  return Boolean(hasPermission(key));
}

/**
 * Add/increase qty when stage edit is allowed, or via explicit/legacy add keys.
 * @param {(key: string) => boolean} hasPermission
 */
export function canAddOrderItems(hasPermission, status) {
  if (hasPermission("orders.add_items")) return true;
  if (
    isAfterServedStatus(status) &&
    hasPermission("orders.add_items_after_served")
  ) {
    return true;
  }
  // Stage edit permission implies adding items at that status
  if (canEditOrderAtStatus(hasPermission, status)) return true;
  return false;
}

/** @param {(key: string) => boolean} hasPermission */
export function canRemoveOrderItems(hasPermission) {
  return Boolean(hasPermission("orders.delete_items"));
}

/** Open Edit when the stage permission matches the order status. */
export function canOpenOrderEdit(hasPermission, status) {
  return canEditOrderAtStatus(hasPermission, status);
}
