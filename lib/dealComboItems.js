/** Helpers for combo deal components (fixed items + choice slots). */

export function getComboItemType(ci) {
  return ci?.type === "choice" ? "choice" : "fixed";
}

export function comboItemToComponent(ci) {
  const type = getComboItemType(ci);
  if (type === "choice") {
    return {
      type: "choice",
      label: ci.label || "",
      quantity: ci.quantity || 1,
      optionIds: (ci.options || []).map((o) => o?._id || o?.id || o).filter(Boolean),
      minSelect: ci.minSelect ?? 1,
      maxSelect: ci.maxSelect ?? 1,
    };
  }
  return {
    type: "fixed",
    menuItemId: ci.menuItem?._id || ci.menuItem?.id || ci.menuItem,
    quantity: ci.quantity || 1,
  };
}

export function componentToComboItem(comp) {
  if (comp.type === "choice") {
    return {
      type: "choice",
      label: String(comp.label || "").trim(),
      quantity: Math.max(1, Number(comp.quantity) || 1),
      options: (comp.optionIds || []).map((id) => String(id)),
      minSelect: Math.max(1, Number(comp.minSelect) || 1),
      maxSelect: Math.max(1, Number(comp.maxSelect) || 1),
    };
  }
  return {
    type: "fixed",
    menuItem: comp.menuItemId,
    quantity: Math.max(1, Number(comp.quantity) || 1),
  };
}

/** Choice slots use average option price × quantity for regular-total estimates. */
export function componentRegularPrice(comp, menuItemById) {
  if (comp.type === "choice") {
    const prices = (comp.optionIds || [])
      .map((id) => Number(menuItemById.get(String(id))?.price) || 0)
      .filter((p) => p > 0);
    if (!prices.length) return 0;
    const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    return average * (Number(comp.quantity) || 1);
  }
  const item = menuItemById.get(String(comp.menuItemId));
  return (Number(item?.price) || 0) * (Number(comp.quantity) || 1);
}

export function componentsRegularTotal(components, menuItemById) {
  return (components || []).reduce(
    (sum, comp) => sum + componentRegularPrice(comp, menuItemById),
    0,
  );
}

export function formatComboItemSummary(ci, menuItemById, sym = "") {
  const type = getComboItemType(ci);
  const qty = ci.quantity > 1 ? ` ×${ci.quantity}` : "";
  if (type === "choice") {
    const optionNames = (ci.options || [])
      .map((o) => {
        if (o?.name) return o.name;
        const id = o?._id || o?.id || o;
        return menuItemById?.get(String(id))?.name;
      })
      .filter(Boolean);
    const pickLabel =
      (ci.minSelect ?? 1) === (ci.maxSelect ?? 1) && (ci.minSelect ?? 1) === 1
        ? "pick 1"
        : `pick ${ci.minSelect ?? 1}–${ci.maxSelect ?? 1}`;
    const label = ci.label || "Choice";
    const optionsPreview =
      optionNames.length > 0 ? optionNames.slice(0, 3).join(", ") : "options TBD";
    const extra = optionNames.length > 3 ? ` +${optionNames.length - 3}` : "";
    return `${label}${qty} (${pickLabel}: ${optionsPreview}${extra})`;
  }
  const id = ci.menuItem?._id || ci.menuItem?.id || ci.menuItem;
  const name =
    ci.menuItem?.name || menuItemById?.get(String(id))?.name || "Item";
  return `${name}${qty}`;
}

export function validateComponents(components) {
  if (!components?.length) {
    return "Add at least one component (fixed item or choice slot)";
  }
  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    if (comp.type === "choice") {
      if (!String(comp.label || "").trim()) {
        return `Choice slot ${i + 1}: label is required`;
      }
      if (!comp.optionIds?.length) {
        return `Choice slot ${i + 1}: select at least one option`;
      }
      const min = Math.max(1, Number(comp.minSelect) || 1);
      const max = Math.max(1, Number(comp.maxSelect) || 1);
      if (min > max) {
        return `Choice slot ${i + 1}: min picks cannot exceed max picks`;
      }
      if (max > comp.optionIds.length) {
        return `Choice slot ${i + 1}: max picks cannot exceed number of options`;
      }
    } else if (!comp.menuItemId) {
      return `Fixed item ${i + 1}: select a menu item`;
    }
  }
  return "";
}
