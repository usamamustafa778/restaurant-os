/**
 * Shared modifier pricing for POS — mirrors eatsdesk-temp1/lib/storefront-modifiers.js
 * so website and POS produce identical totals for the same item + selections.
 */

import {
  buildDealSelectionsFingerprint,
  getComboItemType,
} from "./dealComboItems";

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

/** Rebuild POS cart lines from a saved order (preserves unitPrice + modifier picks). */
export function buildPosCartItemsFromOrderItems(orderItems = [], menuItems = []) {
  return orderItems.map((it) => {
    const menuItemId = it.menuItemId || null;
    let id = menuItemId;
    const modSels = it.modifierSelections || [];
    const price = Number(it.unitPrice ?? it.unit_price) || 0;

    let imageUrl = "";
    if (id) {
      const mi = menuItems.find((m) => String(m.id || m._id) === String(id));
      if (mi) imageUrl = mi.imageUrl || "";
    } else {
      const byName = menuItems.find(
        (m) => (m.name || "").toLowerCase() === (it.name || "").toLowerCase(),
      );
      if (byName) {
        id = byName.id;
        imageUrl = byName.imageUrl || "";
      } else {
        id = `edit-${it.name}-${Math.random().toString(36).slice(2)}`;
      }
    }

    let cartKey = String(id);
    if (modSels.length > 0) {
      const fingerprint = modSels
        .map(
          (s) =>
            `${String(s.groupId)}:${(s.options || [])
              .map((o) => String(o.optionId))
              .sort()
              .join(",")}`,
        )
        .sort()
        .join("|");
      if (fingerprint) cartKey = `${id}|${fingerprint}`;
    }

    const selectedModifiers = modSels.flatMap((s) =>
      (s.options || []).map((o) => ({
        groupId: s.groupId,
        groupName: s.groupName,
        optionId: o.optionId,
        optionName: o.name,
        price: Number(o.price) || 0,
      })),
    );

    return {
      id,
      name: it.name,
      price,
      quantity: it.qty ?? it.quantity ?? 1,
      imageUrl,
      _cartKey: cartKey,
      _modifierSelectionsForOrder: modSels,
      _selectedModifiers: selectedModifiers,
      size: it.variantLabel || "",
    };
  });
}

/** Map a POS cart line to the admin order-update API payload. */
export function mapPosCartLineToOrderUpdatePayload(item, itemNotes = {}) {
  const cartKey = item._cartKey || item.id;
  return {
    menuItemId: String(item.id).startsWith("edit-") ? null : item.id,
    quantity: item.quantity,
    unitPrice: item.price,
    name: item.name,
    note: itemNotes[cartKey] || undefined,
    modifierSelections:
      item._modifierSelectionsForOrder?.length > 0
        ? item._modifierSelectionsForOrder
        : undefined,
    variantLabel: item.size || item.variantLabel || undefined,
    dealSelections: item._dealSelections || undefined,
  };
}

function inferDealQuantityFromComponents(deal, components = [], applied) {
  if (!components.length) return 1;

  const choiceSlots = (deal?.comboItems || []).filter(
    (ci) => getComboItemType(ci) === "choice",
  );
  const totalPickQty = components.reduce(
    (sum, c) => sum + (Number(c.qty ?? c.quantity) || 1),
    0,
  );

  if (choiceSlots.length > 0) {
    const picksPerDeal = choiceSlots.reduce(
      (sum, ci) =>
        sum + Math.max(1, Number(ci.minSelect ?? ci.quantity ?? 1) || 1),
      0,
    );
    if (picksPerDeal > 0) {
      return Math.max(1, Math.round(totalPickQty / picksPerDeal));
    }
  }

  const fixedItems = (deal?.comboItems || []).filter(
    (ci) => getComboItemType(ci) === "fixed",
  );
  if (fixedItems.length > 0) {
    const perDeal = fixedItems.reduce(
      (sum, ci) => sum + (Number(ci.quantity) || 1),
      0,
    );
    if (perDeal > 0) {
      return Math.max(1, Math.round(totalPickQty / perDeal));
    }
  }

  const slotLabels = new Set();
  for (const comp of components) {
    const note = String(comp.note || "");
    const parts = note.split(" · ");
    if (parts.length >= 2) {
      slotLabels.add(parts.slice(1).join(" · ").trim());
    }
  }
  const inferredSlots = Math.max(1, slotLabels.size || components.length);
  const inferredQty = Math.max(1, Math.round(totalPickQty / inferredSlots));

  const comboPrice = Number(deal?.comboPrice) || 0;
  const discount = Number(applied?.discountAmount) || 0;
  if (comboPrice > 0 && discount > 0) {
    const componentTotal = components.reduce(
      (sum, c) =>
        sum +
        (Number(c.lineTotal) ||
          Number(c.unitPrice) * (Number(c.qty ?? c.quantity) || 1)),
      0,
    );
    const comboTotal = Math.max(0, componentTotal - discount);
    const priceInferredQty = Math.max(1, Math.round(comboTotal / comboPrice));
    return Math.max(inferredQty, priceInferredQty);
  }

  return inferredQty;
}

function rebuildDealSelectionsFromComponents(deal, components = []) {
  const selectionsBySlot = {};
  if (!deal?.comboItems?.length) {
    components.forEach((comp, idx) => {
      if (!comp.menuItemId) return;
      selectionsBySlot[idx] = [
        {
          menuItemId: comp.menuItemId,
          name: comp.name,
          qty: 1,
          modifierSelections: comp.modifierSelections || [],
        },
      ];
    });
    return selectionsBySlot;
  }

  for (let slotIndex = 0; slotIndex < deal.comboItems.length; slotIndex++) {
    const ci = deal.comboItems[slotIndex];
    if (getComboItemType(ci) !== "choice") continue;
    const slotLabel = String(ci.label || "").trim();
    const match = components.find((c) => {
      const note = String(c.note || "");
      if (slotLabel && note.includes(slotLabel)) return true;
      return false;
    });
    if (!match?.menuItemId) continue;
    selectionsBySlot[slotIndex] = [
      {
        menuItemId: match.menuItemId,
        name: match.name,
        qty: 1,
        modifierSelections: match.modifierSelections || [],
      },
    ];
  }
  return selectionsBySlot;
}

function isDealComponentLine(item, comboApplied = []) {
  if (item?.lineSource === "deal") return true;
  return comboApplied.some((d) => {
    const dealName = String(d.dealName || "").trim();
    return dealName && String(item?.note || "").startsWith(dealName);
  });
}

function inferComboAppliedFromOrderItems(items = [], availableDeals = []) {
  const dealNames = new Set();
  for (const it of items) {
    const note = String(it.note || "");
    const idx = note.indexOf(" · ");
    if (idx > 0) dealNames.add(note.slice(0, idx).trim());
  }

  const applied = [];
  for (const dealName of dealNames) {
    const components = items.filter(
      (it) =>
        it.lineSource === "deal" || String(it.note || "").startsWith(dealName),
    );
    if (!components.length) continue;

    const dealDoc = availableDeals.find((d) => d.name === dealName);
    const slotLabels = new Set();
    for (const comp of components) {
      const note = String(comp.note || "");
      const prefix = `${dealName} · `;
      if (note.startsWith(prefix)) {
        slotLabels.add(note.slice(prefix.length).trim());
      }
    }
    const slotCount = Math.max(1, slotLabels.size || components.length);
    const totalQty = components.reduce(
      (sum, c) => sum + (Number(c.qty ?? c.quantity) || 1),
      0,
    );
    const dealQty = Math.max(1, Math.round(totalQty / slotCount));
    const componentTotal = components.reduce(
      (sum, c) =>
        sum +
        (Number(c.lineTotal) ||
          Number(c.unitPrice) * (Number(c.qty ?? c.quantity) || 1)),
      0,
    );
    const comboPrice = Number(dealDoc?.comboPrice) || 0;
    const savings =
      comboPrice > 0 ? Math.max(0, componentTotal - comboPrice * dealQty) : 0;

    applied.push({
      dealId: dealDoc ? String(dealDoc._id || dealDoc.id) : "",
      dealName,
      dealType: "COMBO",
      discountAmount: savings,
    });
  }

  return applied;
}

/**
 * Collapse expanded combo deal component lines back into deal cart rows for POS edit.
 */
export function rebuildPosCartFromOrder(order, menuItems = [], availableDeals = []) {
  const items = order?.items || [];
  let comboApplied = (order?.appliedDeals || []).filter((d) => d.dealType === "COMBO");

  if (!comboApplied.length) {
    comboApplied = inferComboAppliedFromOrderItems(items, availableDeals);
  }

  if (!comboApplied.length) {
    return buildPosCartItemsFromOrderItems(items, menuItems);
  }

  const regularItems = items.filter((it) => !isDealComponentLine(it, comboApplied));
  const cartItems = buildPosCartItemsFromOrderItems(regularItems, menuItems);

  const processedDealNames = new Set();
  for (const applied of comboApplied) {
    const dealName = applied.dealName || "Deal";
    if (processedDealNames.has(dealName)) continue;
    processedDealNames.add(dealName);

    const dealDoc =
      availableDeals.find((d) => d.name === dealName) ||
      availableDeals.find(
        (d) =>
          String(d._id || d.id) ===
          String(applied.dealId || applied.deal?._id || applied.deal || ""),
      );
    const dealId = String(
      applied.dealId ||
        applied.deal?._id ||
        applied.deal ||
        dealDoc?._id ||
        dealDoc?.id ||
        dealName,
    );

    const components = items.filter((it) => isDealComponentLine(it, [applied]));
    const selectionsBySlot = rebuildDealSelectionsFromComponents(dealDoc, components);
    const fingerprint = buildDealSelectionsFingerprint(
      dealDoc || { comboItems: [] },
      selectionsBySlot,
    );

    const componentTotal = components.reduce(
      (sum, c) =>
        sum +
        (Number(c.lineTotal) ||
          Number(c.unitPrice) * (Number(c.qty ?? c.quantity) || 1)),
      0,
    );
    const dealQty = inferDealQuantityFromComponents(dealDoc, components, applied);
    const discount = Number(applied.discountAmount) || 0;
    const comboPrice =
      Number(dealDoc?.comboPrice) ||
      (dealQty > 0
        ? Math.max(0, (componentTotal - discount) / dealQty)
        : Math.max(0, componentTotal - discount));

    cartItems.push({
      id: `deal-${dealId}`,
      _cartKey: `deal-${dealId}${fingerprint ? `|${fingerprint}` : ""}`,
      name: dealName,
      price: comboPrice,
      quantity: dealQty,
      imageUrl: dealDoc?.imageUrl || "",
      isDeal: true,
      _dealId: dealId,
      _dealSelections: selectionsBySlot,
    });
  }

  return cartItems;
}
