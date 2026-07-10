/** Helpers for combo deal components (fixed items + choice slots). */

export function getComboItemType(ci) {
  return ci?.type === "choice" ? "choice" : "fixed";
}

export function normalizeModifierSelections(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((sel) => ({
      groupId: String(sel.groupId || sel.group?._id || sel.group?.id || ""),
      groupName: sel.groupName || sel.group?.groupName || "",
      options: (sel.options || [])
        .map((opt) => ({
          optionId: String(opt.optionId || opt.id || opt._id || ""),
          name: opt.name || "",
          price: Number(opt.price) || 0,
        }))
        .filter((opt) => opt.optionId),
    }))
    .filter((sel) => sel.groupId && sel.options.length);
}

export function modifierSelectionsFingerprint(modifierSelections) {
  return normalizeModifierSelections(modifierSelections)
    .map(
      (sel) =>
        `${sel.groupId}:${sel.options
          .map((o) => o.optionId)
          .sort()
          .join(",")}`,
    )
    .sort()
    .join("|");
}

export function getRequiredVariationGroups(item) {
  if (!item?.hasModifiers) return [];
  return (item.modifierGroups || []).filter((g) => g.required !== false);
}

export function itemHasRequiredVariations(item) {
  return getRequiredVariationGroups(item).length > 0;
}

export function buildModifierSelectionsFromPicks(item, picksByGroupId = {}) {
  return getRequiredVariationGroups(item)
    .map((group) => {
      const groupId = String(group.id);
      const optionId = picksByGroupId[groupId];
      const option = (group.options || []).find((o) => String(o.id) === String(optionId));
      if (!option) return null;
      return {
        groupId,
        groupName: group.groupName,
        options: [
          {
            optionId: String(option.id),
            name: option.name,
            price: Number(option.price) || 0,
          },
        ],
      };
    })
    .filter(Boolean);
}

export function formatVariationLabel(modifierSelections) {
  const names = normalizeModifierSelections(modifierSelections).flatMap((sel) =>
    (sel.options || []).map((o) => o.name).filter(Boolean),
  );
  return names.join(", ");
}

export function formatFixedComponentLabel(comp, menuItemById) {
  const item = menuItemById?.get(String(comp.menuItemId));
  const baseName = item?.name || "Item";
  const variation = formatVariationLabel(comp.modifierSelections);
  const qty = comp.quantity > 1 ? ` ×${comp.quantity}` : "";
  return variation ? `${baseName} (${variation})${qty}` : `${baseName}${qty}`;
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
    modifierSelections: normalizeModifierSelections(ci.modifierSelections),
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
  const payload = {
    type: "fixed",
    menuItem: comp.menuItemId,
    quantity: Math.max(1, Number(comp.quantity) || 1),
  };
  const mods = normalizeModifierSelections(comp.modifierSelections);
  if (mods.length) payload.modifierSelections = mods;
  return payload;
}

function priceFromModifierSelections(menuItem, modifierSelections) {
  const normalized = normalizeModifierSelections(modifierSelections);
  if (!normalized.length) return Number(menuItem?.price) || 0;

  let requiredTotal = 0;
  let optionalTotal = 0;
  let hasRequiredSelection = false;

  for (const sel of normalized) {
    const group = (menuItem?.modifierGroups || []).find(
      (g) => String(g.id) === String(sel.groupId),
    );
    for (const opt of sel.options || []) {
      const price = Number(opt.price) || 0;
      if (group?.required !== false) {
        requiredTotal += price;
        hasRequiredSelection = true;
      } else {
        optionalTotal += price;
      }
    }
  }

  if (hasRequiredSelection) return requiredTotal + optionalTotal;
  return (Number(menuItem?.price) || 0) + optionalTotal;
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
  const unit = priceFromModifierSelections(item, comp.modifierSelections);
  return unit * (Number(comp.quantity) || 1);
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
  const variation = formatVariationLabel(ci.modifierSelections);
  return variation ? `${name} (${variation})${qty}` : `${name}${qty}`;
}

function hasValidModifierSelections(item, modifierSelections) {
  const requiredGroups = getRequiredVariationGroups(item);
  if (!requiredGroups.length) return true;
  const normalized = normalizeModifierSelections(modifierSelections);
  return requiredGroups.every((group) =>
    normalized.some(
      (sel) =>
        String(sel.groupId) === String(group.id) && (sel.options || []).length > 0,
    ),
  );
}

export function validateComponents(components, menuItemById) {
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
    } else {
      const item = menuItemById?.get(String(comp.menuItemId));
      if (item && itemHasRequiredVariations(item) && !hasValidModifierSelections(item, comp.modifierSelections)) {
        return `Fixed item ${i + 1}: select a size/variation for "${item.name}"`;
      }
    }
  }
  return "";
}

export function findMatchingFixedComponentIndex(components, menuItemId, modifierSelections) {
  const fp = modifierSelectionsFingerprint(modifierSelections);
  return (components || []).findIndex(
    (c) =>
      c.type !== "choice" &&
      String(c.menuItemId) === String(menuItemId) &&
      modifierSelectionsFingerprint(c.modifierSelections) === fp,
  );
}

export function getFixedComponentQtyForVariation(components, menuItemId, modifierSelections) {
  const idx = findMatchingFixedComponentIndex(components, menuItemId, modifierSelections);
  if (idx < 0) return 0;
  return Number(components[idx]?.quantity) || 0;
}
