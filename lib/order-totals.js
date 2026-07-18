/** Normalize order financial fields for receipt UI. */
export function getOrderTotals(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const subtotal =
    order?.subtotal != null
      ? Number(order.subtotal)
      : items.reduce((sum, it) => sum + Number(it.lineTotal || 0), 0);
  const discountAmount = Math.max(0, Number(order?.discountAmount || 0));
  const taxAmount = Math.max(0, Number(order?.taxAmount || 0));
  const taxRate = Math.max(0, Number(order?.taxRate || 0));
  const taxLabel = String(order?.taxLabel || "Tax").trim() || "Tax";
  const taxRateText = Number.isInteger(taxRate)
    ? String(taxRate)
    : taxRate.toFixed(2).replace(/\.?0+$/, "");
  const deliveryCharges = Math.max(0, Number(order?.deliveryCharges || 0));
  const reservationCharges = Math.max(0, Number(order?.reservationCharges || 0));
  const grandTotal =
    order?.grandTotal != null
      ? Number(order.grandTotal)
      : Number(
          order?.total ??
            subtotal -
              discountAmount +
              taxAmount +
              deliveryCharges +
              reservationCharges,
        );

  return {
    subtotal,
    discountAmount,
    taxAmount,
    taxRate,
    taxLabel,
    taxRateText,
    showTaxRow: taxAmount > 0,
    showDiscountRow: discountAmount > 0,
    deliveryCharges,
    showDeliveryRow: deliveryCharges > 0,
    reservationCharges,
    showReservationRow: reservationCharges > 0,
    grandTotal,
  };
}

export function formatPaymentMethod(method) {
  const key = String(method || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  const map = {
    PENDING: "To be paid",
    COD: "Cash on delivery",
    CASH: "Cash",
    CARD: "Card",
    ONLINE: "Paid online",
    SPLIT: "Split payment",
    FOODPANDA: "Foodpanda",
  };
  return (
    map[key] ||
    (key
      ? key.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
      : "—")
  );
}
