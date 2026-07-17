import { useMemo, useState } from "react";
import { X, User, Phone, MapPin, ChevronDown } from "lucide-react";
import { formatPrice } from "../../lib/api";
import { formatReceiptItemsForBill, getDealDisplayItems } from "../../lib/orderDisplay";
import { formatPaymentMethod, getOrderTotals } from "../../lib/order-totals";

function formatReceiptDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "—";
  }
}

function orderTypeLabel(orderType) {
  const normalized = String(orderType || "").toUpperCase();
  if (normalized === "TAKEAWAY") return "Pickup";
  if (normalized === "DELIVERY") return "Delivery";
  if (normalized === "DINE_IN") return "Dine-in";
  return "—";
}

function statusLabel(status, orderType) {
  const s = String(status || "").toUpperCase().replace(/\s+/g, "_");
  const type = String(orderType || "").toUpperCase();
  const map = {
    DELIVERED: type === "DINE_IN" ? "Served" : "Delivered",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    READY: "Ready",
    OUT_FOR_DELIVERY: "Out for delivery",
  };
  return map[s] || String(status || "—").replace(/_/g, " ");
}

function DealItemRow({ item, primaryColor = "#F97316" }) {
  const [open, setOpen] = useState(false);
  const qty = item.quantity ?? item.qty ?? 1;
  const children = getDealDisplayItems(item);

  return (
    <tr className="border-b border-stone-100">
      <td className="py-2.5 pr-2 align-top text-stone-800">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-start justify-between gap-2 text-left"
        >
          <div className="min-w-0">
            <div className="font-semibold text-stone-900">
              {item.name}
              <span
                className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                style={{ backgroundColor: primaryColor }}
              >
                Deal
              </span>
            </div>
            {!open && children.length > 0 ? (
              <p className="mt-1 text-xs text-stone-500">
                {children
                  .map((choice) =>
                    choice.qty > 1 ? `${choice.name} ×${choice.qty}` : choice.name,
                  )
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <ChevronDown
            className={`mt-0.5 h-4 w-4 shrink-0 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open ? (
          <div
            className="mt-2 space-y-1 border-l-2 pl-3"
            style={{ borderColor: `${primaryColor}55` }}
          >
            {children.map((choice, index) => (
              <p
                key={`${choice.name}-${index}`}
                className="flex flex-wrap items-center gap-1.5 text-xs text-stone-600"
              >
                <span>
                  · {choice.name}
                  {choice.qty > 1 ? ` ×${choice.qty}` : ""}
                </span>
                {choice.isChoice ? (
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Choice
                  </span>
                ) : null}
              </p>
            ))}
          </div>
        ) : null}
        {item.note ? (
          <p className="mt-2 text-xs italic text-stone-500">📝 {item.note}</p>
        ) : null}
      </td>
      <td className="py-2.5 text-center align-top tabular-nums text-stone-600">
        {qty}
      </td>
      <td className="py-2.5 text-right align-top tabular-nums font-semibold text-stone-800">
        {item.lineTotal != null ? formatPrice(item.lineTotal) : "—"}
      </td>
    </tr>
  );
}

function OrderBillItemsTable({ order, primaryColor = "#F97316" }) {
  const rows = useMemo(() => formatReceiptItemsForBill(order), [order]);
  if (!rows.length) return null;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-stone-200 text-left text-[10px] font-bold uppercase tracking-wide text-stone-400">
          <th className="pb-2 pr-2">Item</th>
          <th className="pb-2 text-center">Qty</th>
          <th className="pb-2 text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((it, i) =>
          it.isDealLine ? (
            <DealItemRow key={`deal-${i}`} item={it} primaryColor={primaryColor} />
          ) : (
            <tr key={i} className="border-b border-stone-100 last:border-0">
              <td className="py-2.5 pr-2 align-top text-stone-800">
                <div>{it.name}</div>
                {it.variantLabel?.trim() && !it.modifiers?.length ? (
                  <p className="mt-0.5 pl-2 text-xs text-stone-500">
                    ({it.variantLabel.trim()})
                  </p>
                ) : null}
                {(it.modifiers || []).map((mod, mi) => (
                  <p
                    key={`${mod.optionName}-${mi}`}
                    className="mt-0.5 pl-3 text-xs leading-relaxed text-stone-500"
                  >
                    + {mod.optionName}
                    {mod.price > 0 ? ` (${formatPrice(mod.price)})` : ""}
                  </p>
                ))}
                {it.note?.trim() ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
                    {it.note.trim()}
                  </p>
                ) : null}
              </td>
              <td className="py-2.5 text-center align-top tabular-nums text-stone-600">
                {it.qty ?? it.quantity ?? 1}
              </td>
              <td className="py-2.5 text-right align-top tabular-nums font-semibold text-stone-800">
                {it.lineTotal != null ? formatPrice(it.lineTotal) : "—"}
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

function OrderBillPaymentBreakdown({
  order,
  primaryColor = "#F97316",
  showPaymentMethod = true,
}) {
  const totals = getOrderTotals(order);

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between text-stone-600">
        <span>Subtotal</span>
        <span className="tabular-nums">{formatPrice(totals.subtotal)}</span>
      </div>
      {totals.showDiscountRow ? (
        <div className="flex items-center justify-between text-emerald-700">
          <span>Discount</span>
          <span className="tabular-nums">−{formatPrice(totals.discountAmount)}</span>
        </div>
      ) : null}
      {totals.showTaxRow ? (
        <div className="flex items-center justify-between text-stone-600">
          <span>
            {totals.taxLabel}
            {totals.taxRate > 0 ? ` (${totals.taxRateText}%)` : ""}
          </span>
          <span className="tabular-nums">{formatPrice(totals.taxAmount)}</span>
        </div>
      ) : null}
      {totals.showDeliveryRow ? (
        <div className="flex items-center justify-between text-stone-600">
          <span>Delivery fee</span>
          <span className="tabular-nums">{formatPrice(totals.deliveryCharges)}</span>
        </div>
      ) : null}
      <div className="flex items-center justify-between border-t border-stone-200 pt-3 text-base font-black text-stone-900">
        <span>Total</span>
        <span className="tabular-nums" style={{ color: primaryColor }}>
          {formatPrice(totals.grandTotal)}
        </span>
      </div>
      {showPaymentMethod && order?.paymentMethod ? (
        <div className="flex items-center justify-between border-t border-dashed border-stone-200 pt-3 text-xs text-stone-500">
          <span>Payment</span>
          <span className="font-semibold text-stone-700">
            {formatPaymentMethod(order.paymentMethod)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default function OrderBillReceiptModal({
  order,
  restaurantName = "",
  logoUrl = "",
  primaryColor = "#F97316",
  onClose,
}) {
  if (!order) return null;

  const isDeliveryOrder = String(order?.orderType || "").toUpperCase() === "DELIVERY";
  const rawNumber =
    order?.tokenNumber != null && order.tokenNumber !== ""
      ? String(order.tokenNumber).padStart(4, "0")
      : order?.orderNumber ||
        String(order?.id || order?._id || "").slice(-6);
  const orderNumber = String(rawNumber).replace(/^#/, "");
  // Prefer short display (…-0001 → 0001) when the full ORD-… id is used
  const displayNumber = (() => {
    const parts = orderNumber.split(/[-_/]/).filter(Boolean);
    const tail = parts[parts.length - 1];
    if (parts.length > 1 && /^\d+$/.test(tail)) return tail.padStart(4, "0");
    return orderNumber;
  })();

  return (
    <div
      className="fixed inset-0 z-[220] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-stone-100 p-2 text-stone-500 transition hover:bg-stone-200 hover:text-stone-700"
          aria-label="Close receipt"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="overflow-y-auto">
          <div className="flex items-start gap-3 border-b border-stone-100 px-4 py-4 pr-12">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-11 w-11 shrink-0 rounded-2xl object-cover ring-1 ring-stone-200"
              />
            ) : (
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-black text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {(restaurantName || "ED").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {restaurantName ? (
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-stone-400">
                  {restaurantName}
                </p>
              ) : null}
              <p className="mt-0.5 text-lg font-black tabular-nums text-stone-900">
                #{displayNumber}
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                {formatReceiptDate(order?.createdAt)}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-600">
                  {orderTypeLabel(order?.orderType || order?.type)}
                </span>
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  {statusLabel(order?.status, order?.orderType || order?.type)}
                </span>
              </div>
            </div>
          </div>

          {(order?.customerName ||
            order?.customerPhone ||
            order?.phone ||
            order?.tableName ||
            (isDeliveryOrder && order?.deliveryAddress)) && (
            <section className="space-y-2 border-b border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
              {order?.customerName ? (
                <p className="flex items-center gap-2 text-stone-600">
                  <User className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                  {order.customerName}
                </p>
              ) : null}
              {(order?.customerPhone || order?.phone) ? (
                <p className="flex items-center gap-2 text-stone-600">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                  {order.customerPhone || order.phone}
                </p>
              ) : null}
              {order?.tableName ? (
                <p className="flex items-center gap-2 text-stone-600">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                  Table {order.tableName}
                </p>
              ) : null}
              {isDeliveryOrder && order?.deliveryAddress ? (
                <p className="flex items-start gap-2 text-stone-600">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
                  <span>{order.deliveryAddress}</span>
                </p>
              ) : null}
            </section>
          )}

          <section className="space-y-3 bg-white px-4 py-3 text-sm text-stone-700">
            <OrderBillItemsTable order={order} primaryColor={primaryColor} />
            <OrderBillPaymentBreakdown
              order={order}
              primaryColor={primaryColor}
              showPaymentMethod
            />
            <p className="border-t border-stone-200 pt-3 text-center text-xs text-stone-400">
              Thank you for your order
            </p>
          </section>

          <div className="border-t border-stone-200 bg-white px-4 py-3">
            <p className="text-center text-[10px] text-stone-400">
              Powered by{" "}
              <a
                href="https://eatsdesk.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-stone-500 underline-offset-2 hover:underline"
              >
                eatsdesk.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
