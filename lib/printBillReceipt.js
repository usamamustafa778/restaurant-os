/**
 * Shared utility to print Customer Bill (menu bill / "to be paid") or Order Receipt (payment bill).
 * Used by both POS and Orders pages.
 *
 * @param {Object} orderLike - Normalized order: { items, orderNumber or id, createdAt, customerName, type, paymentMethod, paymentAmountReceived?, paymentAmountReturned?, discountAmount, subtotal, total }
 * @param {{ mode?: 'bill'|'receipt'|'auto', logoUrl?: string }} options - mode: 'bill' = Customer Bill, 'receipt' = Order Receipt, 'auto' = receipt if payment details present. logoUrl = restaurant logo URL for header.
 * @returns {Window|null} - The print window, or null if popup blocked
 */

// Thermal receipt paper width (80mm is common; use 58mm for narrower printers)
const THERMAL_WIDTH_MM = 80;

export function printBillReceipt(orderLike, options = {}) {
  const { mode = "auto", logoUrl = "", branchAddress: optBranchAddress = "", orderTakerName: optOrderTakerName = "" } = options;

  // Popup size ~80mm at 96dpi (~302px); use 320 for comfortable preview
  const previewWidth = 320;
  const win = window.open("", "_blank", `width=${previewWidth},height=600`);
  if (!win) return null;

  const items = orderLike.items || [];
  const itemsHtml = items
    .map(
      (it) =>
        `<tr>
          <td style="padding:4px 0;border-bottom:1px dashed #ddd">${escapeHtml(it.name || "")}</td>
          <td style="padding:4px 8px;text-align:center;border-bottom:1px dashed #ddd">${it.qty ?? 1}</td>
          <td style="padding:4px 0;text-align:right;border-bottom:1px dashed #ddd">Rs ${((it.unitPrice || 0) * (it.qty || 1)).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const discount = orderLike.discountAmount || 0;
  const hasPaymentDetails =
    orderLike.paymentAmountReceived != null && orderLike.paymentAmountReceived > 0;
  const isReceipt = mode === "receipt" || (mode === "auto" && hasPaymentDetails);

  const headerLabel = isReceipt ? "Order Receipt" : "Customer Bill";
  const paymentLabel =
    orderLike.paymentMethod ||
    (isReceipt ? "Cash" : "To be paid");

  const rawOrderId = orderLike.orderNumber || orderLike.id || "";
  const orderId = typeof rawOrderId === "string" && rawOrderId.startsWith("ORD-")
    ? rawOrderId.replace(/^ORD-/, "")
    : rawOrderId;

  const returnAmount =
    orderLike.paymentAmountReturned != null
      ? Number(orderLike.paymentAmountReturned)
      : hasPaymentDetails && orderLike.paymentAmountReceived != null
        ? Math.max(0, Number(orderLike.paymentAmountReceived) - (orderLike.total || 0))
        : 0;

  const paymentExtra =
    isReceipt && hasPaymentDetails
      ? `<div><strong>Amount received:</strong> Rs ${Number(orderLike.paymentAmountReceived || 0).toFixed(2)}</div><div><strong>Return:</strong> Rs ${returnAmount.toFixed(2)}</div>`
      : "";

  const logoHtml = logoUrl
    ? `<div class="center" style="margin-bottom:4px;"><img src="${escapeHtml(logoUrl)}" alt="Restaurant logo" style="max-height:100px;object-fit:contain;" /></div>`
    : `<div class="center" style="font-size:16px;font-weight:bold;margin-bottom:4px;">Eats Desk</div>`;

  const branchAddress = optBranchAddress || orderLike.branchAddress || "";
  const branchAddressHtml = branchAddress
    ? `<div class="center" style="font-size:10px;color:#444;margin-bottom:6px;">${escapeHtml(branchAddress)}</div>`
    : "";

  const createdAt = orderLike.createdAt
    ? new Date(orderLike.createdAt).toLocaleString()
    : new Date().toLocaleString();
  const orderTakerName =
    optOrderTakerName ||
    orderLike.orderTakerName ||
    (orderLike.createdBy && orderLike.createdBy.name) ||
    "";
  const orderTakerDisplay = escapeHtml(orderTakerName || "N/A");
  const customerNameRaw = (orderLike.customerName || "").trim();
  const customerName = escapeHtml(customerNameRaw || "N/A");
  const typeLabel = escapeHtml(orderLike.type || "dine-in");

  const subtotal = (orderLike.subtotal ?? orderLike.total ?? 0);
  const total = orderLike.total ?? 0;

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${isReceipt ? "Receipt" : "Bill"} – ${escapeHtml(String(orderId))}</title>
  <style>
    body { font-family: 'Courier New', monospace; margin: 0; padding: 16px; font-size: 13px; color: #222; box-sizing: border-box; }
    .center { text-align: center; }
    hr { border: none; border-top: 1px dashed #999; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; }
    .total-row td { font-weight: bold; padding-top: 6px; }
    @media print {
      @page { size: ${THERMAL_WIDTH_MM}mm auto; margin: 2mm; }
      body { width: ${THERMAL_WIDTH_MM}mm; max-width: ${THERMAL_WIDTH_MM}mm; margin: 0; padding: 4mm; font-size: 11px; }
      img { max-width: 100%; max-height: 24mm; object-fit: contain; }
    }
  </style>
</head>
<body>
  ${logoHtml}
  ${branchAddressHtml}
  <div class="center" style="font-size:11px;color:#666;margin-bottom:8px;">${headerLabel}</div>
  <hr/>
  <div><strong>Order:</strong> ${escapeHtml(String(orderId))}</div>
  <div><strong>Date:</strong> ${createdAt}</div>
  <div><strong>Order taker:</strong> ${orderTakerDisplay}</div>
  <div><strong>Customer:</strong> ${customerName}</div>
  <div><strong>Type:</strong> ${typeLabel}</div>
  <div><strong>Payment:</strong> ${escapeHtml(paymentLabel)}</div>
  ${paymentExtra}
  <hr/>
  <table>
    <thead>
      <tr style="font-weight:bold;border-bottom:1px solid #999">
        <td style="padding:4px 0">Item</td>
        <td style="padding:4px 8px;text-align:center">Qty</td>
        <td style="padding:4px 0;text-align:right">Amount</td>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <hr/>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">Rs ${Number(subtotal).toFixed(2)}</td></tr>
    ${discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">- Rs ${Number(discount).toFixed(2)}</td></tr>` : ""}
    <tr class="total-row" style="font-size:15px"><td>Grand Total</td><td style="text-align:right">Rs ${Number(total).toFixed(2)}</td></tr>
  </table>
  <hr/>
  <div class="center" style="font-size:11px;color:#888;margin-top:12px;">Thank you for your order!</div>
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`);
  win.document.close();
  return win;
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
