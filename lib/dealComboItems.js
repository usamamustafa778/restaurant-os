/** Helpers for combo deal components (fixed items + choice slots). */

export function getComboItemType(ci) {
  return ci?.type === "choice" ? "choice" : "fixed";
}

export function normalizeModifierSelections(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((sel) => ({
      groupId: String(sel.groupId || sel.group?._id || sel.group?.id || ""),
      groupName: sel.groupName || sel.group?.groupName || sel.group?.name || "",
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

export function normalizeChoiceOption(raw) {
  if (!raw) return null;
  if (typeof raw === "string" || typeof raw === "number") {
    const menuItemId = String(raw);
    return menuItemId ? { menuItemId, modifierSelections: [] } : null;
  }
  if (raw._id && !raw.menuItem && !raw.menuItemId && !raw.modifierSelections) {
    const menuItemId = String(raw._id || raw.id);
    return menuItemId ? { menuItemId, modifierSelections: [] } : null;
  }
  const menuItemId = String(
    raw.menuItemId ||
      raw.menuItem?._id ||
      raw.menuItem?.id ||
      raw.menuItem ||
      raw.id ||
      "",
  );
  if (!menuItemId) return null;
  return {
    menuItemId,
    modifierSelections: normalizeModifierSelections(raw.modifierSelections),
  };
}

export function choiceOptionKey(raw) {
  const opt = normalizeChoiceOption(raw);
  if (!opt) return "";
  return `${opt.menuItemId}|${modifierSelectionsFingerprint(opt.modifierSelections)}`;
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

export function formatChoiceOptionLabel(opt, menuItemById) {
  const normalized = normalizeChoiceOption(opt);
  if (!normalized) return "Item";
  const item = menuItemById?.get(String(normalized.menuItemId));
  const baseName = item?.name || "Item";
  const variation = formatVariationLabel(normalized.modifierSelections);
  return variation ? `${baseName} (${variation})` : baseName;
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
    const quantity = ci.quantity || 1;
    return {
      type: "choice",
      label: ci.label || "",
      quantity,
      options: (ci.options || []).map(normalizeChoiceOption).filter(Boolean),
      minSelect: ci.minSelect ?? quantity,
      maxSelect: ci.maxSelect ?? quantity,
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
    const quantity = Math.max(1, Number(comp.quantity) || 1);
    return {
      type: "choice",
      label: String(comp.label || "").trim(),
      quantity,
      options: (comp.options || [])
        .map((opt) => {
          const normalized = normalizeChoiceOption(opt);
          if (!normalized) return null;
          const payload = { menuItem: normalized.menuItemId };
          const mods = normalizeModifierSelections(normalized.modifierSelections);
          if (mods.length) payload.modifierSelections = mods;
          return payload;
        })
        .filter(Boolean),
      minSelect: quantity,
      maxSelect: quantity,
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

function choiceOptionUnitPrice(opt, menuItemById) {
  const normalized = normalizeChoiceOption(opt);
  if (!normalized) return 0;
  const item = menuItemById.get(String(normalized.menuItemId));
  return priceFromModifierSelections(item, normalized.modifierSelections);
}

/** Choice slots use average option price × quantity for regular-total estimates. */
export function componentRegularPrice(comp, menuItemById) {
  if (comp.type === "choice") {
    const prices = (comp.options || [])
      .map((opt) => choiceOptionUnitPrice(opt, menuItemById))
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
      .map((o) => formatChoiceOptionLabel(o, menuItemById))
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
      if (!comp.options?.length) {
        return `Choice slot ${i + 1}: add at least one option with size/flavour if needed`;
      }
      const quantity = Math.max(1, Number(comp.quantity) || 1);
      if (comp.options.length < quantity) {
        return `Choice slot ${i + 1}: add at least ${quantity} option(s) for customers to pick from`;
      }
      for (const opt of comp.options) {
        const normalized = normalizeChoiceOption(opt);
        const item = menuItemById?.get(String(normalized?.menuItemId));
        if (item && itemHasRequiredVariations(item) && !hasValidModifierSelections(item, normalized.modifierSelections)) {
          return `Choice slot ${i + 1}: "${item.name}" needs size/flavour selected for each option`;
        }
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

export function choiceOptionIsSelected(components, choiceIndex, menuItemId, modifierSelections) {
  const comp = components[choiceIndex];
  if (!comp || comp.type !== "choice") return false;
  const key = choiceOptionKey({ menuItemId, modifierSelections });
  return (comp.options || []).some((opt) => choiceOptionKey(opt) === key);
}

export function toggleChoiceOptionInComponent(comp, menuItemId, modifierSelections = []) {
  const key = choiceOptionKey({ menuItemId, modifierSelections });
  const options = [...(comp.options || [])];
  const idx = options.findIndex((opt) => choiceOptionKey(opt) === key);
  if (idx >= 0) {
    options.splice(idx, 1);
  } else {
    options.push({ menuItemId: String(menuItemId), modifierSelections: normalizeModifierSelections(modifierSelections) });
  }
  return { ...comp, options };
}
