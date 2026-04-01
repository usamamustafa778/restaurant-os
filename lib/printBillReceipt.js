/**
 * Shared utility to print Customer Bill (menu bill / "to be paid") or Order Receipt (payment bill).
 * Used by both POS and Orders pages.
 *
 * Printing strategy:
 *   1. If THERMAL_PRINTER_HOST is configured, sends ESC/POS commands directly to the
 *      thermal printer via /api/print-receipt (silent — no browser dialog).
 *   2. Otherwise falls back to browser printing via a hidden iframe + window.print().
 *
 * @param {Object} orderLike - Normalized order: { items, orderNumber or id, createdAt, customerName, type, paymentMethod, paymentAmountReceived?, paymentAmountReturned?, discountAmount, subtotal, total }
 * @param {{ mode?: 'bill'|'receipt'|'auto', logoUrl?: string }} options
 */

// Thermal receipt paper width (80mm is common; use 58mm for narrower printers)
const THERMAL_WIDTH_MM = 80;

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Returns the complete HTML string for a bill/receipt.
 * Shared by printBillReceipt (opens a print window) and the live preview iframe.
 */
export function buildBillHtml(orderLike, options = {}) {
  const {
    mode = "auto",
    logoUrl = "",
    branchAddress: optBranchAddress = "",
    orderTakerName: optOrderTakerName = "",
    logoHeightPx = 100,
    footerMessage = "Thank you for your order!",
  } = options;

  const items = orderLike.items || [];
  let totalLineItems = 0;
  let totalQuantity = 0;
  const itemsHtml = items
    .map((it, index) => {
      const qty = it.qty ?? it.quantity ?? 1;
      const unit = it.unitPrice ?? it.price ?? 0;
      const lineTotal = it.lineTotal ?? unit * qty;
      totalLineItems += 1;
      totalQuantity += qty;

      const topBorder =
        index === 0 ? "border-top:1px dashed #000;" : "border-top:0;";

      return `<tr>
          <td colspan="4" style="padding:4px 0;${topBorder}border-bottom:0;white-space:normal;">${escapeHtml(it.name || "")}</td>
        </tr>
        <tr>
          <td style="padding:0 0 4px;border-bottom:1px dashed #000;"></td>
          <td style="padding:0 4px 4px;text-align:right;border-bottom:1px dashed #000">${unit.toFixed(2)}</td>
          <td style="padding:0 4px 4px;text-align:center;border-bottom:1px dashed #000">${qty}</td>
          <td style="padding:0 0 4px;text-align:right;border-bottom:1px dashed #000">${lineTotal.toFixed(2)}</td>
        </tr>`;
    })
    .join("");

  const discount = orderLike.discountAmount || 0;
  const hasPaymentDetails =
    orderLike.paymentAmountReceived != null &&
    orderLike.paymentAmountReceived > 0;
  const isReceipt =
    mode === "receipt" || (mode === "auto" && hasPaymentDetails);

  const paymentLabel =
    orderLike.paymentMethod || (isReceipt ? "Cash" : "To be paid");

  const rawOrderId = orderLike.orderNumber || orderLike.id || "";
  const orderId =
    typeof rawOrderId === "string" && rawOrderId.startsWith("ORD-")
      ? rawOrderId.replace(/^ORD-/, "")
      : rawOrderId;

  const returnAmount =
    orderLike.paymentAmountReturned != null
      ? Number(orderLike.paymentAmountReturned)
      : hasPaymentDetails && orderLike.paymentAmountReceived != null
        ? Math.max(
            0,
            Number(orderLike.paymentAmountReceived) - (orderLike.total || 0),
          )
        : 0;

  const paymentExtra =
    isReceipt && hasPaymentDetails
      ? `<div><strong>Amount received:</strong> Rs ${Number(orderLike.paymentAmountReceived || 0).toFixed(2)}</div><div><strong>Return:</strong> Rs ${returnAmount.toFixed(2)}</div>`
      : "";

  const logoHtml = logoUrl
    ? `<div class="center" style="margin-bottom:4px;"><img src="${escapeHtml(logoUrl)}" alt="Restaurant logo" style="max-height:${logoHeightPx}px;object-fit:contain;" /></div>`
    : `<div class="center" style="font-size:16px;font-weight:bold;margin-bottom:4px;">Eats Desk</div>`;

  const branchAddress = optBranchAddress || orderLike.branchAddress || "";
  const branchAddressHtml = branchAddress
    ? `<div class="center" style="font-size:10px;color:#000;margin-bottom:6px;">${escapeHtml(branchAddress)}</div>`
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
  const normalizedCustomerName = customerNameRaw.toLowerCase();
  const isWalkInCustomer =
    !customerNameRaw ||
    normalizedCustomerName === "walk-in" ||
    normalizedCustomerName === "walk-in customer" ||
    normalizedCustomerName === "walkin";

  // Default display name when no real customer is entered.
  const customerName = escapeHtml(customerNameRaw || "");
  const customerPhoneRaw = (orderLike.customerPhone || "").trim();
  const customerPhone = escapeHtml(customerPhoneRaw || "");
  const rawOrderType = orderLike.type ?? orderLike.orderType ?? "dine-in";
  const typeLabel = escapeHtml(rawOrderType);
  const normalizedOrderType = String(rawOrderType).toLowerCase();
  const isDeliveryOrder = normalizedOrderType.includes("delivery");
  const normalizedOrderTypeForTable = normalizedOrderType
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
  const shouldShowTableNo = normalizedOrderTypeForTable === "dine-in";

  const subtotal = orderLike.subtotal ?? orderLike.total ?? 0;
  const total = orderLike.total ?? 0;

  const customerPhoneBlock =
    !isWalkInCustomer && customerPhoneRaw
      ? `<div style="display:flex;justify-content:space-between;">
    <span><strong>Customer Phone:</strong></span>
    <span>${customerPhone}</span>
  </div>`
      : "";

  const customerAddressRaw = (orderLike.deliveryAddress || "").trim();
  const normalizedCustomerAddress = customerAddressRaw.toLowerCase();
  const isWalkInAddress =
    normalizedCustomerAddress === "walk-in" ||
    normalizedCustomerAddress === "walk-in customer" ||
    normalizedCustomerAddress === "walkin";

  const customerAddressBlock =
    isDeliveryOrder &&
    !isWalkInCustomer &&
    customerAddressRaw &&
    !isWalkInAddress
      ? `<div style="display:flex;justify-content:space-between;">
    <span><strong>Customer Address:</strong></span>
    <span>${escapeHtml(customerAddressRaw)}</span>
  </div>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <title>${isReceipt ? "Receipt" : "Bill"} – ${escapeHtml(String(orderId))}</title>
  <style>
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Courier New', monospace; margin: 0; padding: 16px; font-size: 15px; color: #000; font-weight: 600; box-sizing: border-box; }
    .center { text-align: center; }
    hr { border: none; border-top: 1px dashed #000; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; }
    .total-row td { font-weight: bold; padding-top: 6px; }
    @media print {
      @page { size: ${THERMAL_WIDTH_MM}mm auto; margin: 2mm; }
      body { width: ${THERMAL_WIDTH_MM}mm; max-width: ${THERMAL_WIDTH_MM}mm; margin: 0; padding: 4mm; font-size: 14px; font-weight: 600; }
      img { max-width: 100%; max-height: ${logoHeightPx}px; object-fit: contain; }
    }
  </style>
</head>
<body>
  ${logoHtml}
  ${branchAddressHtml}
  <hr/>
  <div style="display:flex;justify-content:space-between;">
    <span><strong>Invoice #:</strong></span>
    <span>${escapeHtml(String(orderId))}</span>
  </div>
  <div style="display:flex;justify-content:space-between;">
    <span><strong>Order Time:</strong></span>
    <span>${createdAt}</span>
  </div>
  <div style="display:flex;justify-content:space-between;">
    <span><strong>Order Type:</strong></span>
    <span>${typeLabel}</span>
  </div>
  <div style="display:flex;justify-content:space-between;">
    <span><strong>Payment Type:</strong></span>
    <span>${escapeHtml(paymentLabel)}</span>
  </div>
  ${
    !isWalkInCustomer && customerNameRaw
      ? `<div style="display:flex;justify-content:space-between;">
    <span><strong>Customer Name:</strong></span>
    <span>${customerName}</span>
  </div>`
      : ""
  }
  ${customerPhoneBlock}
  ${customerAddressBlock}
  ${
    shouldShowTableNo
      ? `<div style="display:flex;justify-content:space-between;">
    <span><strong>Table No:</strong></span>
    <span>${escapeHtml(orderLike.tableName || orderLike.tableNumber || "-")}</span>
  </div>`
      : ""
  }
  <div style="display:flex;justify-content:space-between;">
    <span><strong>Order Taker:</strong></span>
    <span>${orderTakerDisplay}</span>
  </div>
  ${paymentExtra}
  <hr/>
  <table>
    <thead>
      <tr style="font-weight:bold;border-bottom:1px solid #000">
        <td style="padding:4px 0">Items</td>
        <td style="padding:4px 4px;text-align:right">Unit</td>
        <td style="padding:4px 4px;text-align:center">Qty</td>
        <td style="padding:4px 0;text-align:right">Price</td>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <hr/>
  <table>
    <tr><td><strong>Total Items:</strong></td><td style="text-align:right">${totalLineItems}</td></tr>
    <tr><td><strong>Total Qty:</strong></td><td style="text-align:right">${totalQuantity}</td></tr>
    <tr><td><strong>Subtotal</strong></td><td style="text-align:right">${Number(subtotal).toFixed(2)}</td></tr>
    ${discount > 0 ? `<tr><td><strong>Discount</strong></td><td style="text-align:right">- ${Number(discount).toFixed(2)}</td></tr>` : ""}
    ${Number(orderLike.deliveryCharges || 0) > 0 ? `<tr><td><strong>Delivery Charges</strong></td><td style="text-align:right">${Number(orderLike.deliveryCharges).toFixed(2)}</td></tr>` : ""}
    <tr class="total-row" style="font-size:16px"><td>Grand Total</td><td style="text-align:right">${(Number(total) + Number(orderLike.deliveryCharges || 0)).toFixed(2)}</td></tr>
  </table>
  <hr/>
  <div class="center" style="font-size:11px;color:#000;margin-top:12px;font-weight:700;">${escapeHtml(footerMessage)}</div>
  <div class="center" style="font-size:11px;color:#000;margin-top:12px;border-top:1px dashed #000;padding-top:8px;font-weight:600;">
    Powered by EatsDesk &mdash; eatsdesk.com
  </div>
</body>
</html>`;
}

function buildPrintPayload(orderLike, options = {}) {
  const {
    mode = "auto",
    branchAddress = "",
    orderTakerName = "",
    footerMessage = "Thank you for your order!",
  } = options;

  const hasPayment =
    orderLike.paymentAmountReceived != null &&
    orderLike.paymentAmountReceived > 0;
  const isReceipt = mode === "receipt" || (mode === "auto" && hasPayment);

  const rawId = orderLike.orderNumber || orderLike.id || "";
  const orderId =
    typeof rawId === "string" && rawId.startsWith("ORD-")
      ? rawId.replace(/^ORD-/, "")
      : rawId;

  const returnAmount =
    orderLike.paymentAmountReturned != null
      ? Number(orderLike.paymentAmountReturned)
      : hasPayment
        ? Math.max(
            0,
            Number(orderLike.paymentAmountReceived) - (orderLike.total || 0),
          )
        : 0;

  const rawCustomerName = (orderLike.customerName || "").trim();
  const normalizedCustomerName = rawCustomerName.toLowerCase();
  const isWalkInCustomer =
    !rawCustomerName ||
    normalizedCustomerName === "walk-in" ||
    normalizedCustomerName === "walk-in customer" ||
    normalizedCustomerName === "walkin";

  // When customer is not provided, we intentionally keep this empty so
  // the receipt doesn't show "Walk-in" anymore.
  const customerName = isWalkInCustomer ? "" : rawCustomerName;

  const rawDeliveryAddress = (orderLike.deliveryAddress || "").trim();
  const normalizedDeliveryAddress = rawDeliveryAddress.toLowerCase();
  const isWalkInAddress =
    normalizedDeliveryAddress === "walk-in" ||
    normalizedDeliveryAddress === "walk-in customer" ||
    normalizedDeliveryAddress === "walkin";

  const rawOrderType = orderLike.type ?? orderLike.orderType ?? "dine-in";
  const normalizedOrderType = String(rawOrderType).toLowerCase();
  const isDeliveryOrder = normalizedOrderType.includes("delivery");

  const deliveryAddress =
    !isDeliveryOrder || isWalkInCustomer || isWalkInAddress
      ? "-"
      : rawDeliveryAddress || "-";

  return {
    restaurantName: "Eats Desk",
    branchName: orderLike.branchName || "",
    branchAddress: branchAddress || orderLike.branchAddress || "",
    orderId: String(orderId),
    createdAt: orderLike.createdAt
      ? new Date(orderLike.createdAt).toLocaleString()
      : new Date().toLocaleString(),
    type: rawOrderType,
    paymentMethod:
      orderLike.paymentMethod || (isReceipt ? "Cash" : "To be paid"),
    customerName,
    deliveryAddress,
    tableName: orderLike.tableName || orderLike.tableNumber || "-",
    waiter:
      orderTakerName ||
      orderLike.orderTakerName ||
      (orderLike.createdBy && orderLike.createdBy.name) ||
      "N/A",
    items: orderLike.items || [],
    subtotal: orderLike.subtotal ?? orderLike.total ?? 0,
    total: orderLike.total ?? 0,
    discount: orderLike.discountAmount || 0,
    deliveryCharges: orderLike.deliveryCharges || 0,
    amountReceived: hasPayment ? orderLike.paymentAmountReceived : null,
    returnAmount: hasPayment ? returnAmount : null,
    footerMessage,
  };
}

function browserPrint(orderLike, options) {
  const html = buildBillHtml(orderLike, options);

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;width:0;height:0;border:none;left:-9999px;top:-9999px;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = (() => {
    let fired = false;
    return () => {
      if (fired) return;
      fired = true;
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch (_) {}
      }, 1000);
    };
  })();

  const images = doc.querySelectorAll("img");
  if (images.length > 0) {
    let loaded = 0;
    const onLoad = () => {
      if (++loaded >= images.length) triggerPrint();
    };
    images.forEach((img) => {
      if (img.complete) onLoad();
      else {
        img.addEventListener("load", onLoad);
        img.addEventListener("error", onLoad);
      }
    });
    setTimeout(triggerPrint, 2000);
  } else {
    setTimeout(triggerPrint, 100);
  }
}

export function printBillReceipt(orderLike, options = {}) {
  const payload = buildPrintPayload(orderLike, options);

  fetch("/api/print-receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok) throw new Error("api");
    })
    .catch(() => {
      browserPrint(orderLike, options);
    });
}
