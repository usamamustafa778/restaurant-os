/**
 * Display-only helpers for order item lists (receipts, kanban cards, etc.).
 * Does not mutate order data — KDS and stored orders keep separate lines.
 */

/** Merge identical lines by item + variant + modifiers + price + note. */
export function mergeReceiptItems(items) {
  const merged = [];
  for (const it of items || []) {
    const modKey = (it.modifierSelections || [])
      .flatMap((s) => (s.options || []).map((o) => o.optionId || o.name))
      .sort()
      .join(",");
    const key = [
      it.menuItemId || it.menuItem || it.name,
      it.variantLabel || "",
      modKey,
      it.unitPrice ?? it.price ?? 0,
      (it.note || "").trim(),
    ].join("|");

    const existing = merged.find((m) => m._mergeKey === key);
    if (existing) {
      const addQty = Number(it.qty ?? it.quantity ?? 1);
      existing.quantity = Number(existing.quantity) + addQty;
      existing.qty = existing.quantity;
      existing.lineTotal =
        Number(existing.unitPrice ?? existing.price ?? 0) * existing.quantity;
    } else {
      merged.push({
        ...it,
        quantity: Number(it.qty ?? it.quantity ?? 1),
        qty: Number(it.qty ?? it.quantity ?? 1),
        _mergeKey: key,
      });
    }
  }
  return merged;
}
