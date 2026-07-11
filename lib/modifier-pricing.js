/**
 * Shared modifier pricing for POS — mirrors eatsdesk-temp1/lib/storefront-modifiers.js
 * so website and POS produce identical totals for the same item + selections.
 */

export function normalizeAttachedGroups(item) {
  return (item?.attachedModifierGroups || [])
    .filter((g) => g && g.isActive !== false)
    .map((g) => ({
      id: g.id,
      name: g.name,
      groupName: g.name,
      type: g.type || "addon",
      required: !!g.required,
      minSelect: g.minSelect ?? 0,
      maxSelect: g.maxSelect ?? 0,
      maxSelections:
        g.maxSelect === 0 ? 99 : Math.max(1, Number(g.maxSelect) || 1),
      displayOrder: g.displayOrder ?? 0,
      sortOrder: g.displayOrder ?? 0,
      source: "attached",
      options: (g.options || [])
        .filter((o) => o && o.isActive !== false)
        .map((o) => ({
          id: o.id,
          name: o.name,
          price: Number(o.price) || 0,
          isAvailable: o.isAvailable !== false,
          sortOrder: o.sortOrder ?? 0,
        })),
    }))
    .filter((g) => g.options.length > 0)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

export function getLegacyGroups(item) {
  if (!item?.hasModifiers) return [];
  return item.modifierGroups || [];
}

export function hasAttachedModifierGroups(item) {
  return normalizeAttachedGroups(item).length > 0;
}

export function getPickerGroupsForItem(item) {
  const legacy =
    item._preselectedRequired != null
      ? [
          ...(item._remainingRequiredGroups || []),
          ...(item._optionalGroups || []),
        ]
      : getLegacyGroups(item);

  return [...legacy, ...normalizeAttachedGroups(item)].sort(
    (a, b) => (a.sortOrder || a.displayOrder || 0) - (b.sortOrder || b.displayOrder || 0),
  );
}

export function itemNeedsModifierPicker(item) {
  if (item?.isDeal) return false;
  if (item?._preselectedRequired) {
    return getPickerGroupsForItem(item).length > 0;
  }
  if (item?.hasModifiers && (item.modifierGroups || []).length > 0) return true;
  return hasAttachedModifierGroups(item);
}

export function buildInitialModifierSelections(item) {
  const initial = {};
  if (item?._preselectedRequired) {
    const presel = item._preselectedRequired;
    initial[presel.groupId] = [
      {
        optionId: presel.option.optionId,
        name: presel.option.name,
        price: Number(presel.option.price) || 0,
      },
    ];
  }
  return initial;
}

export function isModifierSelectionComplete(item, modifierSelections = {}) {
  const pickerGroups = getPickerGroupsForItem(item);
  for (const g of pickerGroups.filter((grp) => grp.required)) {
    if ((modifierSelections[g.id] || []).length === 0) return false;
  }
  for (const g of normalizeAttachedGroups(item).filter((grp) => grp.required)) {
    const sel = modifierSelections[g.id] || [];
    const min = Math.max(1, g.minSelect || 1);
    if (sel.length < min) return false;
  }
  return true;
}

export function computeLegacyUnitPrice(item, modifierSelections = {}) {
  const groups = getLegacyGroups(item);
  if (!groups.length) return null;

  const requiredGroups = groups.filter((g) => g.required);
  const optionalGroups = groups.filter((g) => !g.required);
  const requiredTotal = requiredGroups.reduce((sum, g) => {
    const sel = modifierSelections[g.id] || [];
    return sum + sel.reduce((s, o) => s + (Number(o.price) || 0), 0);
  }, 0);
  const optionalTotal = optionalGroups.reduce((sum, g) => {
    const sel = modifierSelections[g.id] || [];
    return sum + sel.reduce((s, o) => s + (Number(o.price) || 0), 0);
  }, 0);

  return requiredTotal > 0
    ? requiredTotal + optionalTotal
    : Number(item.finalPrice ?? item.price) + optionalTotal;
}

export function computeAttachedModifierTotal(item, modifierSelections = {}) {
  return normalizeAttachedGroups(item).reduce((sum, g) => {
    const sel = modifierSelections[g.id] || [];
    return sum + sel.reduce((s, o) => s + (Number(o.price) || 0), 0);
  }, 0);
}

export function computeItemUnitPrice(item, modifierSelections = {}) {
  const legacyPrice = computeLegacyUnitPrice(item, modifierSelections);
  const base = legacyPrice != null ? legacyPrice : Number(item.finalPrice ?? item.price) || 0;
  return base + computeAttachedModifierTotal(item, modifierSelections);
}

export function buildModifierSelectionsForOrder(item, modifierSelections = {}) {
  const result = [];

  for (const g of getLegacyGroups(item)) {
    const sel = modifierSelections[g.id] || [];
    if (!sel.length) continue;
    result.push({
      groupId: g.id,
      groupName: g.groupName,
      options: sel.map((o) => ({
        optionId: o.optionId,
        name: o.name,
        price: Number(o.price) || 0,
      })),
    });
  }

  for (const g of normalizeAttachedGroups(item)) {
    const sel = modifierSelections[g.id] || [];
    if (!sel.length) continue;
    result.push({
      groupId: g.id,
      groupName: g.name,
      options: sel.map((o) => ({
        optionId: o.optionId,
        name: o.name,
        price: Number(o.price) || 0,
      })),
    });
  }

  return result;
}

export function flattenSelectedModifiers(item, modifierSelections = {}) {
  const flat = [];
  for (const g of getLegacyGroups(item)) {
    for (const o of modifierSelections[g.id] || []) {
      flat.push({
        groupId: g.id,
        groupName: g.groupName,
        optionId: o.optionId,
        optionName: o.name,
        price: Number(o.price) || 0,
      });
    }
  }
  for (const g of normalizeAttachedGroups(item)) {
    for (const o of modifierSelections[g.id] || []) {
      flat.push({
        groupId: g.id,
        groupName: g.name,
        optionId: o.optionId,
        optionName: o.name,
        price: Number(o.price) || 0,
      });
    }
  }
  return flat;
}

export function buildPosCartLine(item, quantity, modifierSelections = {}) {
  const qty = Math.max(1, Math.floor(Number(quantity)) || 1);
  const selectionFingerprint = Object.entries(modifierSelections || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([gId, opts]) =>
        gId + ":" + opts.map((o) => o.optionId).sort().join(","),
    )
    .join("|");
  const cartKeyBase = item._flattenedId || item.id;
  const cartKey =
    cartKeyBase + (selectionFingerprint ? "|" + selectionFingerprint : "");

  const unitPrice = computeItemUnitPrice(item, modifierSelections);
  const modifierSelectionsForOrder = buildModifierSelectionsForOrder(
    item,
    modifierSelections,
  );
  const selectedModifiers = flattenSelectedModifiers(item, modifierSelections);
  const variantLabel =
    selectedModifiers.map((m) => m.optionName).join(", ") || "Regular";

  return {
    cartKey,
    unitPrice,
    quantity: qty,
    variantLabel,
    modifierSelectionsForOrder,
    selectedModifiers,
  };
}

export function isSingleSelectModifierGroup(group) {
  const maxSelections =
    group?.maxSelections ??
    (group?.maxSelect === 0 ? 99 : Math.max(1, Number(group?.maxSelect) || 1));
  return maxSelections === 1;
}

export function modifierSelectionsFromCartItem(cartItem) {
  const selections = {};
  const mods = cartItem?._selectedModifiers;
  if (Array.isArray(mods) && mods.length) {
    for (const mod of mods) {
      const gid = String(mod.groupId);
      if (!selections[gid]) selections[gid] = [];
      selections[gid].push({
        optionId: mod.optionId,
        name: mod.optionName || mod.name,
        price: Number(mod.price) || 0,
      });
    }
  } else if (Array.isArray(cartItem?._modifierSelectionsForOrder)) {
    for (const group of cartItem._modifierSelectionsForOrder) {
      const gid = String(group.groupId);
      selections[gid] = (group.options || []).map((o) => ({
        optionId: o.optionId,
        name: o.name,
        price: Number(o.price) || 0,
      }));
    }
  }
  if (cartItem?._preselectedRequired) {
    const presel = cartItem._preselectedRequired;
    const gid = String(presel.groupId);
    if (!selections[gid]?.length) {
      selections[gid] = [
        {
          optionId: presel.option.optionId,
          name: presel.option.name,
          price: Number(presel.option.price) || 0,
        },
      ];
    }
  }
  return selections;
}

export function resolveMenuItemForCartLine(cartItem, menuItems = []) {
  if (!cartItem) return null;
  const baseId = String(cartItem._flattenedId || cartItem.id).split("|")[0];
  const fromMenu = menuItems.find((m) => String(m.id || m._id) === baseId);
  if (!fromMenu) return cartItem;
  return {
    ...fromMenu,
    ...cartItem,
    id: fromMenu.id || cartItem.id,
    modifierGroups: fromMenu.modifierGroups || cartItem.modifierGroups,
    attachedModifierGroups:
      fromMenu.attachedModifierGroups || cartItem.attachedModifierGroups,
    hasModifiers: fromMenu.hasModifiers ?? cartItem.hasModifiers,
  };
}

export function buildCartItemAfterVariationChange(
  cartItem,
  menuItems,
  groupId,
  option,
) {
  const template = resolveMenuItemForCartLine(cartItem, menuItems);
  const groups = getPickerGroupsForItem(template);
  const group = groups.find((g) => String(g.id) === String(groupId));
  if (!group || !option) return null;

  const selections = modifierSelectionsFromCartItem(cartItem);
  selections[String(groupId)] = [
    {
      optionId: option.id,
      name: option.name,
      price: Number(option.price) || 0,
    },
  ];

  let itemForLine = { ...template, ...cartItem };

  if (cartItem?._preselectedRequired?.groupId === groupId) {
    const baseId = String(template.id || cartItem.id).split("|")[0];
    itemForLine = {
      ...itemForLine,
      _preselectedRequired: {
        groupId,
        groupName: group.groupName || group.name,
        option: {
          optionId: option.id,
          name: option.name,
          price: Number(option.price) || 0,
        },
      },
      _flattenedId: `${baseId}|${option.id}`,
      _flattenedName: `${template.name} ${option.name}`.trim(),
      _flattenedPrice: Number(option.price) || 0,
    };
  }

  const line = buildPosCartLine(itemForLine, cartItem.quantity || 1, selections);
  return { itemForLine, line };
}
