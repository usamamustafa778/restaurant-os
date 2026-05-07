/**
 * Session / day report aggregates shared by POS Today's Report and sales tooling.
 * Payment-unpaid semantics align with dashboard/sales-report.js.
 */

function normalizeOrderStatusForPayment(status) {
  if (!status) return "NEW_ORDER";
  if (status === "UNPROCESSED") return "NEW_ORDER";
  if (status === "PENDING") return "PROCESSING";
  if (status === "COMPLETED") return "DELIVERED";
  return status;
}

function isDeliveryOrderForPayment(order) {
  const type = String(order?.type || order?.orderType || "").toUpperCase();
  return type.includes("DELIVERY");
}

function normalizePaymentMethodUpper(order) {
  return String(order?.paymentMethod ?? "").trim().toUpperCase();
}

/**
 * Buckets closed-sale totals for Cash / Card / Online KPIs.
 * Treats website/POS delivery COD (PENDING / unset method) as cash once the
 * sale is in the revenue set; maps missing method + paymentProvider to online.
 */
export function classifySessionReportPaymentLine(order) {
  const pm = normalizePaymentMethodUpper(order);
  const prov = order?.paymentProvider && String(order.paymentProvider).trim();

  if (pm === "SPLIT") return { kind: "SPLIT" };
  if (pm === "CASH") return { kind: "CASH" };
  if (pm === "CARD") return { kind: "CARD" };
  if (pm === "ONLINE") return { kind: "ONLINE" };
  if (pm === "FOODPANDA") return { kind: "ONLINE" };

  if (prov && pm !== "CASH" && pm !== "CARD") return { kind: "ONLINE" };

  if (isDeliveryOrderForPayment(order)) {
    if (pm !== "CARD" && pm !== "ONLINE") return { kind: "CASH" };
  }

  if (
    !pm ||
    pm === "PENDING" ||
    pm === "TO BE PAID" ||
    pm.includes("TO BE PAID")
  ) {
    return { kind: "CASH" };
  }

  return { kind: "CASH" };
}

/**
 * Diagnostics for drawer vs "Cash" in Today's session report.
 * Enable logs: localStorage.setItem("DEBUG_SESSION_PAYMENTS","1") then reload / open report.
 */
export function auditSessionReportPayments(orders) {
  const list = Array.isArray(orders) ? orders : [];
  const gt = (o) => Number(o.grandTotal ?? o.total ?? 0);

  const active = list.filter((o) => o.status !== "CANCELLED");

  const paidCashOrMissingPm = active.filter((o) => {
    if (!o.isPaid) return false;
    const pm = normalizePaymentMethodUpper(o);
    return pm === "CASH" || pm === "" || pm === "PENDING";
  });

  const revenue = list.filter(
    (o) =>
      (o.status === "DELIVERED" || o.status === "COMPLETED") &&
      o.isPaid === true,
  );

  let uncategorizedBeforeLine = 0;
  let uncategorizedAmt = 0;
  for (const o of revenue) {
    const pm = normalizePaymentMethodUpper(o);
    if (
      pm === "CASH" ||
      pm === "CARD" ||
      pm === "ONLINE" ||
      pm === "SPLIT" ||
      pm === "FOODPANDA"
    )
      continue;
    uncategorizedBeforeLine += 1;
    uncategorizedAmt += gt(o);
  }

  const codWebsitePaidClosed = revenue.filter((o) => {
    if (String(o.source || "").toUpperCase() !== "WEBSITE") return false;
    if (!isDeliveryOrderForPayment(o)) return false;
    const pm = normalizePaymentMethodUpper(o);
    return (
      pm === "PENDING" ||
      pm === "" ||
      pm === "TO BE PAID" ||
      pm.includes("TO BE PAID") ||
      o.deliveryPaymentCollected === true
    );
  });

  const paidClosedMissingPm = revenue.filter(
    (o) => normalizePaymentMethodUpper(o) === "",
  );

  const unpaid = active.filter((o) => !isOrderPaidForReport(o));
  const unpaidCashMethod = unpaid.filter(
    (o) => normalizePaymentMethodUpper(o) === "CASH",
  );

  const unpaidDeliveredDeliveryCodLike = unpaid.filter((o) => {
    const s = normalizeOrderStatusForPayment(o.status);
    if (s !== "DELIVERED") return false;
    if (!isDeliveryOrderForPayment(o)) return false;
    const pm = normalizePaymentMethodUpper(o);
    return (
      pm === "PENDING" ||
      pm === "" ||
      pm === "TO BE PAID" ||
      pm.includes("TO BE PAID")
    );
  });

  const unpaidLikelyCashCollected = unpaid.filter((o) => {
    const pm = normalizePaymentMethodUpper(o);
    if (pm === "CASH") return true;
    if (!isDeliveryOrderForPayment(o)) return false;
    return (
      pm === "PENDING" ||
      pm === "" ||
      pm === "TO BE PAID" ||
      pm.includes("TO BE PAID") ||
      o.deliveryPaymentCollected === true
    );
  });

  const sumList = (arr) => ({
    count: arr.length,
    total: arr.reduce((s, o) => s + gt(o), 0),
  });

  return {
    sessionActiveOrders: active.length,
    paidCashOrMissingPm: sumList(paidCashOrMissingPm),
    revenuePaidClosedCount: revenue.length,
    strictUncategorizedPaidClosed: {
      count: uncategorizedBeforeLine,
      total: uncategorizedAmt,
    },
    websiteDeliveryPaidClosedCodLike: sumList(codWebsitePaidClosed),
    paidClosedEmptyPaymentMethod: sumList(paidClosedMissingPm),
    unpaidTotal: sumList(unpaid),
    unpaidCashPaymentMethod: sumList(unpaidCashMethod),
    unpaidDeliveredCodNotMarkedPaid: sumList(unpaidDeliveredDeliveryCodLike),
    unpaidLikelyPhysicalCash: sumList(unpaidLikelyCashCollected),
  };
}

export function isOrderPaidForReport(order) {
  if (!order) return false;
  if (order.isPaid === true) return true;
  if (order.source === "FOODPANDA") return true;
  if (order.paymentAmountReceived != null) {
    const gross = Number(order.paymentAmountReceived) || 0;
    const returned = Number(order.paymentAmountReturned) || 0;
    const totalDue = Number(order?.grandTotal ?? order?.total ?? 0) || 0;
    if (gross - returned >= totalDue) return true;
  }
  const pm = String(order?.paymentMethod || "").toUpperCase();
  if (
    pm === "CASH" ||
    pm === "CARD" ||
    pm === "ONLINE" ||
    pm === "SPLIT" ||
    pm === "FOODPANDA"
  )
    return true;
  if (pm === "TO BE PAID" || pm.includes("TO BE PAID")) return false;
  if (
    isDeliveryOrderForPayment(order) &&
    order?.deliveryPaymentCollected === true
  )
    return true;
  return false;
}

const UNPAID_PIPELINE_STATUSES = [
  "NEW_ORDER",
  "PROCESSING",
  "READY",
  "OUT_FOR_DELIVERY",
];

export function getSessionUnpaidBreakdown(sessionOrders) {
  const list = Array.isArray(sessionOrders) ? sessionOrders : [];
  const unpaid = list.filter(
    (o) => o.status !== "CANCELLED" && !isOrderPaidForReport(o),
  );
  const amt = (o) => Number((o.grandTotal ?? o.total) || 0);
  let pipelineAmt = 0;
  let pipelineCount = 0;
  let deliveredAmt = 0;
  let deliveredCount = 0;
  let otherAmt = 0;
  let otherCount = 0;
  for (const o of unpaid) {
    const s = normalizeOrderStatusForPayment(o.status);
    if (UNPAID_PIPELINE_STATUSES.includes(s)) {
      pipelineAmt += amt(o);
      pipelineCount += 1;
    } else if (s === "DELIVERED") {
      deliveredAmt += amt(o);
      deliveredCount += 1;
    } else {
      otherAmt += amt(o);
      otherCount += 1;
    }
  }
  const totalAmt = unpaid.reduce((sum, o) => sum + amt(o), 0);
  return {
    totalAmt,
    totalCount: unpaid.length,
    pipelineAmt,
    pipelineCount,
    deliveredAmt,
    deliveredCount,
    otherAmt,
    otherCount,
  };
}

/** Paid closed orders — aligns with POS closed bar / payment breakdown. */
export function buildTodayReportBreakdown(orders) {
  const list = Array.isArray(orders) ? orders : [];
  const revenue = list.filter(
    (o) =>
      (o.status === "DELIVERED" || o.status === "COMPLETED") &&
      o.isPaid === true,
  );
  const gt = (o) => Number(o.grandTotal ?? o.total ?? 0);

  let cash = 0;
  let card = 0;
  let online = 0;
  const cashOrders = new Set();
  const cardOrders = new Set();
  const onlineOrders = new Set();
  const onlineByProv = {};

  const ot = {
    DINE_IN: { amt: 0, n: 0, unpaidN: 0 },
    TAKEAWAY: { amt: 0, n: 0, unpaidN: 0 },
    DELIVERY: { amt: 0, n: 0, items: 0, fees: 0, unpaidN: 0 },
  };

  const sources = {
    WEBSITE: { amt: 0, n: 0, unpaidN: 0 },
    POS: { amt: 0, n: 0, unpaidN: 0 },
    FOODPANDA: { amt: 0, n: 0, unpaidN: 0 },
    OTHER: { amt: 0, n: 0, unpaidN: 0 },
  };

  const itemAgg = new Map();
  const staffAgg = new Map();

  for (const o of revenue) {
    const g = gt(o);
    const line = classifySessionReportPaymentLine(o);

    if (line.kind === "SPLIT") {
      const sc = Number(o.splitCashAmount) || 0;
      const sd = Number(o.splitCardAmount) || 0;
      const so = Number(o.splitOnlineAmount) || 0;
      if (sc > 0) {
        cash += sc;
        cashOrders.add(o.id);
      }
      if (sd > 0) {
        card += sd;
        cardOrders.add(o.id);
      }
      if (so > 0) {
        online += so;
        onlineOrders.add(o.id);
        const pv =
          (o.splitOnlineProvider && String(o.splitOnlineProvider).trim()) ||
          (o.paymentProvider && String(o.paymentProvider).trim()) ||
          "Online";
        onlineByProv[pv] = (onlineByProv[pv] || 0) + so;
      }
    } else if (line.kind === "CASH") {
      cash += g;
      cashOrders.add(o.id);
    } else if (line.kind === "CARD") {
      card += g;
      cardOrders.add(o.id);
    } else if (line.kind === "ONLINE") {
      online += g;
      onlineOrders.add(o.id);
      const prov =
        (o.paymentProvider && String(o.paymentProvider).trim()) || "Online";
      onlineByProv[prov] = (onlineByProv[prov] || 0) + g;
    }

    const rawSrc = String(o.source || "POS").toUpperCase();
    const srcKey =
      rawSrc === "WEBSITE"
        ? "WEBSITE"
        : rawSrc === "FOODPANDA"
          ? "FOODPANDA"
          : rawSrc === "POS"
            ? "POS"
            : "OTHER";
    sources[srcKey].amt += g;
    sources[srcKey].n += 1;

    const ty = String(o.orderType || "DINE_IN").toUpperCase();
    if (ty === "DELIVERY") {
      ot.DELIVERY.amt += g;
      ot.DELIVERY.n += 1;
      const dc = Number(o.deliveryCharges) || 0;
      ot.DELIVERY.fees += dc;
      ot.DELIVERY.items += Math.max(0, g - dc);
    } else if (ty === "TAKEAWAY") {
      ot.TAKEAWAY.amt += g;
      ot.TAKEAWAY.n += 1;
    } else {
      ot.DINE_IN.amt += g;
      ot.DINE_IN.n += 1;
    }

    for (const it of o.items || []) {
      const name = it.name || "Item";
      const q = Number(it.qty ?? it.quantity ?? 0) || 0;
      const lt = Number(it.lineTotal) || 0;
      const row = itemAgg.get(name) || { qty: 0, rev: 0 };
      row.qty += q;
      row.rev += lt;
      itemAgg.set(name, row);
    }

    const staff =
      (o.orderTakerName && String(o.orderTakerName).trim()) ||
      (o.createdBy?.name && String(o.createdBy.name).trim()) ||
      "";
    if (staff) {
      const row = staffAgg.get(staff) || { n: 0, rev: 0 };
      row.n += 1;
      row.rev += g;
      staffAgg.set(staff, row);
    }
  }

  const isClosedPaidSale = (o) =>
    o.status !== "CANCELLED" &&
    (o.status === "DELIVERED" || o.status === "COMPLETED") &&
    o.isPaid === true;

  for (const o of list) {
    if (o.status === "CANCELLED" || isClosedPaidSale(o)) continue;

    const ty = String(o.orderType || "DINE_IN").toUpperCase();
    if (ty === "DELIVERY") ot.DELIVERY.unpaidN += 1;
    else if (ty === "TAKEAWAY") ot.TAKEAWAY.unpaidN += 1;
    else ot.DINE_IN.unpaidN += 1;

    const rawSrc = String(o.source || "POS").toUpperCase();
    const srcKey =
      rawSrc === "WEBSITE"
        ? "WEBSITE"
        : rawSrc === "FOODPANDA"
          ? "FOODPANDA"
          : rawSrc === "POS"
            ? "POS"
            : "OTHER";
    sources[srcKey].unpaidN += 1;
  }

  const topItems = Array.from(itemAgg.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.rev - a.rev)
    .slice(0, 5);

  const staffList = Array.from(staffAgg.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.rev - a.rev);

  const onlineProviders = Object.entries(onlineByProv).sort(
    (a, b) => b[1] - a[1],
  );

  const totalRevenue = revenue.reduce((sum, o) => sum + gt(o), 0);
  const totalOrders = revenue.length;

  const unpaid = getSessionUnpaidBreakdown(list);

  return {
    totalRevenue,
    totalOrders,
    sources,
    unpaid,
    payment: {
      cash,
      cashOrders: cashOrders.size,
      card,
      cardOrders: cardOrders.size,
      online,
      onlineOrders: onlineOrders.size,
      onlineProviders,
    },
    orderTypes: ot,
    topItems,
    staffList,
  };
}
