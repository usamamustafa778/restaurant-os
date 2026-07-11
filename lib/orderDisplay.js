/**
 * Display-only helpers for order item lists (receipts, kanban cards, etc.).
 * Does not mutate order data — KDS and stored orders keep separate lines.
 */

function itemQty(it) {
  return Number(it.qty ?? it.quantity ?? 1) || 1;
}

function modifierKey(it) {
  return (it.modifierSelections || [])
    .flatMap((s) => (s.options || []).map((o) => o.optionId || o.name))
    .sort()
    .join(",");
}

function buildComponentDisplayName(item) {
  const name = String(item.name || "").trim();
  const variant = String(item.variantLabel || "").trim();
  if (variant && !name.toLowerCase().includes(variant.toLowerCase())) {
    return `${name} (${variant})`;
  }
  return name || "Item";
}

function isDealComponentItem(item, dealName) {
  if (item?.lineSource === "deal") return true;
  const name = String(dealName || "").trim();
  return name && String(item?.note || "").startsWith(name);
}

function parseDealSlotLabel(note, dealName) {
  const text = String(note || "");
  const prefix = `${dealName} · `;
  if (text.startsWith(prefix)) return text.slice(prefix.length).trim();
  return "";
}

function inferSlotCount(components, dealName) {
  const labels = new Set();
  for (const comp of components) {
    const slot = parseDealSlotLabel(comp.note, dealName);
    if (slot) labels.add(slot);
  }
  return Math.max(1, labels.size || components.length);
}

function inferDealQtyFromComponents(components, slotCount) {
  const total = components.reduce((sum, c) => sum + itemQty(c), 0);
  const slots = Math.max(1, slotCount || 1);
  return Math.max(1, Math.round(total / slots));
}

function partitionDealInstances(components, dealName, instanceCount) {
  const count = Math.max(1, instanceCount);
  const bySlot = new Map();

  for (const comp of components) {
    const slot = parseDealSlotLabel(comp.note, dealName) || "_default";
    if (!bySlot.has(slot)) bySlot.set(slot, []);
    bySlot.get(slot).push({
      comp,
      remaining: itemQty(comp),
    });
  }

  const instances = Array.from({ length: count }, () => []);
  for (const slotItems of bySlot.values()) {
    let idx = 0;
    for (const entry of slotItems) {
      while (entry.remaining > 0) {
        const { comp } = entry;
        instances[idx].push({
          ...comp,
          qty: 1,
          quantity: 1,
        });
        entry.remaining -= 1;
        idx = (idx + 1) % count;
      }
    }
  }

  return instances.filter((inst) => inst.length > 0);
}

function instanceChoiceFingerprint(instance) {
  return instance
    .map((c) => `${c.menuItemId || c.name}:${modifierKey(c)}`)
    .sort()
    .join("|");
}

function buildDealChoicesFromInstance(instance) {
  const counts = new Map();
  for (const comp of instance) {
    const label = buildComponentDisplayName(comp);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()].map(([name, qty]) => ({ name, qty }));
}

function buildDealReceiptLine(dealName, groupQty, instance) {
  const perInstanceTotal = instance.reduce(
    (sum, c) => sum + Number(c.unitPrice ?? c.price ?? 0),
    0,
  );
  const unitPrice = perInstanceTotal;
  const lineTotal = unitPrice * groupQty;

  return {
    name: dealName,
    quantity: groupQty,
    qty: groupQty,
    unitPrice,
    price: unitPrice,
    lineTotal,
    isDealLine: true,
    dealChoices: buildDealChoicesFromInstance(instance),
  };
}

function collapseAppliedDealsForReceipt(items, appliedDeals = []) {
  const comboDeals = (appliedDeals || []).filter((d) => d.dealType === "COMBO");
  if (!comboDeals.length) return [];

  const processedDealNames = new Set();
  const lines = [];

  for (const applied of comboDeals) {
    const dealName = String(applied.dealName || "").trim() || "Deal";
    if (processedDealNames.has(dealName)) continue;
    processedDealNames.add(dealName);

    const appliedForName = comboDeals.filter((d) => d.dealName === dealName);

    const components = [];
    const used = new Set();
    (items || []).forEach((it, idx) => {
      if (!isDealComponentItem(it, dealName)) return;
      const key = String(idx);
      if (used.has(key)) return;
      used.add(key);
      components.push(it);
    });

    if (!components.length) continue;

    const slotCount = inferSlotCount(components, dealName);
    const instanceCount =
      appliedForName.length > 1
        ? appliedForName.length
        : inferDealQtyFromComponents(components, slotCount);

    const instances = partitionDealInstances(components, dealName, instanceCount);
    const groups = new Map();
    for (const instance of instances) {
      const fp = instanceChoiceFingerprint(instance);
      if (!groups.has(fp)) groups.set(fp, { instance, count: 0 });
      groups.get(fp).count += 1;
    }

    for (const { instance, count: groupQty } of groups.values()) {
      lines.push(buildDealReceiptLine(dealName, groupQty, instance));
    }
  }

  return lines;
}

function mapCartDealToReceiptLine(item) {
  const selections = item._dealSelections || item.dealSelections || {};
  const dealQty = itemQty(item);
  const choiceCounts = new Map();

  for (const picks of Object.values(selections)) {
    for (const pick of picks || []) {
      const label = String(pick.name || "").trim() || "Item";
      const pickQty = Math.max(1, Number(pick.qty) || 1);
      choiceCounts.set(label, (choiceCounts.get(label) || 0) + pickQty * dealQty);
    }
  }

  const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
  return {
    name: item.name || "Deal",
    quantity: dealQty,
    qty: dealQty,
    unitPrice,
    price: unitPrice,
    lineTotal: unitPrice * dealQty,
    isDealLine: true,
    dealChoices: [...choiceCounts.entries()].map(([name, qty]) => ({ name, qty })),
    note: item.note,
  };
}

/** Merge identical lines by item + variant + modifiers + price + note. */
export function mergeReceiptItems(items) {
  const merged = [];
  for (const it of items || []) {
    if (it.isDealLine) {
      merged.push({ ...it });
      continue;
    }

    const key = [
      it.menuItemId || it.menuItem || it.name,
      it.variantLabel || "",
      modifierKey(it),
      it.unitPrice ?? it.price ?? 0,
      (it.note || "").trim(),
    ].join("|");

    const existing = merged.find((m) => m._mergeKey === key);
    if (existing) {
      const addQty = itemQty(it);
      existing.quantity = Number(existing.quantity) + addQty;
      existing.qty = existing.quantity;
      existing.lineTotal =
        Number(existing.unitPrice ?? existing.price ?? 0) * existing.quantity;
    } else {
      merged.push({
        ...it,
        quantity: itemQty(it),
        qty: itemQty(it),
        _mergeKey: key,
      });
    }
  }
  return merged;
}

/**
 * Format order items for customer bills/receipts.
 * Collapses expanded combo deal components into one line per deal (with flavour sub-lines).
 */
export function formatReceiptItemsForBill(orderLike) {
  const items = orderLike?.items || [];
  const appliedDeals = orderLike?.appliedDeals || [];

  const preformatted = items.filter((it) => it.isDealLine);
  if (preformatted.length > 0) {
    const regular = items.filter((it) => !it.isDealLine);
    return mergeReceiptItems([...mergeReceiptItems(regular), ...preformatted]);
  }

  const cartDeals = items.filter(
    (it) => it.isDeal || it._isDeal || String(it.id || "").startsWith("deal-"),
  );
  if (cartDeals.length > 0 && !appliedDeals.some((d) => d.dealType === "COMBO")) {
    const regular = items.filter(
      (it) => !(it.isDeal || it._isDeal || String(it.id || "").startsWith("deal-")),
    );
    return mergeReceiptItems([
      ...mergeReceiptItems(regular),
      ...cartDeals.map(mapCartDealToReceiptLine),
    ]);
  }

  const comboDeals = appliedDeals.filter((d) => d.dealType === "COMBO");
  if (!comboDeals.length) {
    return mergeReceiptItems(items);
  }

  const dealNames = new Set(
    comboDeals.map((d) => String(d.dealName || "").trim()).filter(Boolean),
  );
  const regularItems = items.filter(
    (it) => ![...dealNames].some((name) => isDealComponentItem(it, name)),
  );
  const dealLines = collapseAppliedDealsForReceipt(items, appliedDeals);

  return mergeReceiptItems([...mergeReceiptItems(regularItems), ...dealLines]);
}

function isMeaningfulVariantLabel(label) {
  const text = String(label || "").trim();
  if (!text) return false;
  return text.toLowerCase() !== "regular";
}

function isVariationGroupName(groupName) {
  return /size|variation|flavour|flavor|crust|choose/i.test(
    String(groupName || ""),
  );
}

/** Variation labels (size, crust, flavour) for display on orders and bills. */
export function getOrderItemVariationLabels(item) {
  const name = String(item?.name || "");
  const labels = [];
  const seen = new Set();

  const push = (raw) => {
    const text = String(raw || "").trim();
    if (!text || !isMeaningfulVariantLabel(text)) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    if (name.toLowerCase().includes(key)) return;
    seen.add(key);
    labels.push(text);
  };

  push(item?.variantLabel || item?.size);

  for (const sel of item?.modifierSelections || []) {
    const isVariation = isVariationGroupName(sel.groupName);
    for (const opt of sel.options || []) {
      if (isVariation) push(opt.name);
    }
  }

  if (!labels.length) {
    for (const sel of item?.modifierSelections || []) {
      for (const opt of sel.options || []) {
        push(opt.name);
        if (labels.length) break;
      }
      if (labels.length) break;
    }
  }

  return labels;
}

/** Add-on modifier lines for receipts (excludes variation labels shown on the item name). */
export function getOrderItemBillModifierLines(item) {
  const variationKeys = new Set(
    getOrderItemVariationLabels(item).map((l) => l.toLowerCase()),
  );
  const lines = [];
  for (const sel of item?.modifierSelections || []) {
    const isVariation = isVariationGroupName(sel.groupName);
    for (const opt of sel.options || []) {
      const name = String(opt.name || "").trim();
      if (!name) continue;
      if (isVariation || variationKeys.has(name.toLowerCase())) continue;
      lines.push({ name, price: Number(opt.price) || 0 });
    }
  }
  return lines;
}

/** Item name with size/variation inline, e.g. "Crown Crust (Large)". */
export function formatOrderItemDisplayName(item) {
  const name = String(item?.name || "Item").trim() || "Item";
  const variations = getOrderItemVariationLabels(item);
  if (!variations.length) return name;
  return `${name} (${variations.join(", ")})`;
}

/** Sub-lines for order cards (add-ons and any modifier groups not folded into the name). */
export function getOrderItemModifierSubtexts(item) {
  const variationKeys = new Set(
    getOrderItemVariationLabels(item).map((l) => l.toLowerCase()),
  );
  const lines = [];
  for (const sel of item?.modifierSelections || []) {
    const optionNames = (sel.options || [])
      .map((o) => String(o.name || "").trim())
      .filter(Boolean)
      .filter((n) => !variationKeys.has(n.toLowerCase()));
    if (!optionNames.length) continue;
    const group = String(sel.groupName || "").trim();
    lines.push(group ? `${group}: ${optionNames.join(", ")}` : optionNames.join(", "));
  }
  return lines;
}
