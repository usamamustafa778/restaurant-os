/**
 * Edit Order rules for line-item changes (FE).
 *
 * - orders.edit → open Edit and add/increase items (any editable status).
 * - orders.delete_items_* → remove/decrease items at that status only.
 * - Legacy: stage edit keys / add_items grant edit; orders.delete_items grants all removes.
 */

export const ORDER_REMOVE_STAGE_KEYS = {
  NEW_ORDER: "orders.delete_items_new",
  PROCESSING: "orders.delete_items_preparing",
  READY: "orders.delete_items_ready",
  DELIVERED: "orders.delete_items_after_served",
  OUT_FOR_DELIVERY: "orders.delete_items_out_for_delivery",
  COMPLETED: "orders.delete_items_after_served",
};

const EDITABLE_STATUSES = new Set(Object.keys(ORDER_REMOVE_STAGE_KEYS));

function normalizeStatus(status) {
  return String(status || "").toUpperCase();
}

export function getOrderRemoveStageKey(status) {
  return ORDER_REMOVE_STAGE_KEYS[normalizeStatus(status)] || null;
}

export function isAfterServedStatus(status) {
  const s = normalizeStatus(status);
  return s === "DELIVERED" || s === "COMPLETED";
}

/** @param {(key: string) => boolean} hasPermission */
export function canEditOrderAtStatus(hasPermission, status) {
  const s = normalizeStatus(status);
  if (!EDITABLE_STATUSES.has(s)) return false;
  return Boolean(hasPermission("orders.edit"));
}

/**
 * Add/increase qty when Edit is allowed (legacy after-served add still honored).
 * @param {(key: string) => boolean} hasPermission
 */
export function canAddOrderItems(hasPermission, status) {
  if (
    isAfterServedStatus(status) &&
    hasPermission("orders.add_items_after_served")
  ) {
    return true;
  }
  return canEditOrderAtStatus(hasPermission, status);
}

/**
 * Remove/decrease items only when the stage Remove permission matches.
 * @param {(key: string) => boolean} hasPermission
 */
export function canRemoveOrderItems(hasPermission, status) {
  const key = getOrderRemoveStageKey(status);
  if (!key) return false;
  return Boolean(hasPermission(key));
}

/** Open Edit when orders.edit is granted for an editable status. */
export function canOpenOrderEdit(hasPermission, status) {
  return canEditOrderAtStatus(hasPermission, status);
}
