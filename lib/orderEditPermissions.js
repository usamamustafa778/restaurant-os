/**
 * Stage + action rules for editing order line items (FE).
 * Stage key allows edits at that status; add/remove decide what may change.
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

/** @param {(key: string) => boolean} hasPermission */
export function canAddOrderItems(hasPermission, status) {
  if (hasPermission("orders.add_items")) return true;
  if (
    isAfterServedStatus(status) &&
    hasPermission("orders.add_items_after_served")
  ) {
    return true;
  }
  return false;
}

/** @param {(key: string) => boolean} hasPermission */
export function canRemoveOrderItems(hasPermission) {
  return Boolean(hasPermission("orders.delete_items"));
}

/** Open edit when stage is allowed and at least one item action is allowed. */
export function canOpenOrderEdit(hasPermission, status) {
  if (!canEditOrderAtStatus(hasPermission, status)) return false;
  return (
    canAddOrderItems(hasPermission, status) ||
    canRemoveOrderItems(hasPermission)
  );
}
