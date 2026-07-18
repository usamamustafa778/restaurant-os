import { useMemo, useState } from "react";
import { X, Phone, MapPin, ChevronDown } from "lucide-react";
import { formatPrice } from "../../lib/api";
import { formatReceiptItemsForBill, getDealDisplayItems } from "../../lib/orderDisplay";
import { formatPaymentMethod, getOrderTotals } from "../../lib/order-totals";

function digitsOnlyPhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function WhatsAppIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

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
      {totals.showReservationRow ? (
        <div className="flex items-center justify-between text-stone-600">
          <span>Reservation / party fee</span>
          <span className="tabular-nums">{formatPrice(totals.reservationCharges)}</span>
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
  const fullOrderId = String(
    order?.orderNumber ||
      order?.id ||
      order?._id ||
      "",
  ).replace(/^#/, "");
  const tokenLabel =
    order?.tokenNumber != null && order.tokenNumber !== ""
      ? String(order.tokenNumber).padStart(4, "0")
      : null;

  const customerPhone = String(order?.customerPhone || order?.phone || "").trim();
  const customerPhoneDigits = digitsOnlyPhone(customerPhone);

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
              <p className="mt-0.5 break-all text-base font-black tabular-nums leading-snug text-stone-900 sm:text-lg">
                {fullOrderId ? `#${fullOrderId}` : "—"}
              </p>
              {tokenLabel && fullOrderId && !fullOrderId.endsWith(tokenLabel) ? (
                <p className="mt-0.5 text-xs font-semibold text-stone-500">
                  Token #{tokenLabel}
                </p>
              ) : null}
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
            customerPhone ||
            order?.tableName ||
            (isDeliveryOrder && order?.deliveryAddress)) && (
            <section className="border-b border-dashed border-stone-300 px-4 py-3">
              <div className="space-y-2">
                {(order?.customerName || customerPhone) && (
                  <div className="min-w-0 space-y-0.5">
                    {order?.customerName ? (
                      <p className="truncate text-sm font-bold text-stone-900">
                        {order.customerName}
                      </p>
                    ) : null}
                    {customerPhone ? (
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] tabular-nums text-stone-600">
                        <span>{customerPhone}</span>
                        {customerPhoneDigits ? (
                          <span className="inline-flex items-center gap-1">
                            <a
                              href={`tel:${customerPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              title="Call"
                              aria-label="Call customer"
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 active:scale-95"
                            >
                              <Phone className="h-3 w-3" />
                              Call
                            </a>
                            <a
                              href={`https://wa.me/${customerPhoneDigits}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="WhatsApp"
                              aria-label="WhatsApp customer"
                              className="inline-flex items-center gap-1 rounded-md border border-[#25D366]/35 bg-[#25D366]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#128C7E] active:scale-95"
                            >
                              <WhatsAppIcon className="h-3 w-3" />
                              Chat
                            </a>
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                )}

                {(order?.tableName ||
                  (isDeliveryOrder && order?.deliveryAddress)) && (
                  <div
                    className={`space-y-1 text-[12px] leading-snug text-stone-500 ${
                      order?.customerName || customerPhone
                        ? "border-t border-dashed border-stone-200 pt-2"
                        : ""
                    }`}
                  >
                    {order?.tableName ? (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 shrink-0 text-stone-400" />
                        Table {order.tableName}
                      </p>
                    ) : null}
                    {isDeliveryOrder && order?.deliveryAddress ? (
                      <p className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-stone-400" />
                        <span>{order.deliveryAddress}</span>
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
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
