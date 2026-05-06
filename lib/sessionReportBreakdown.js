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
    DINE_IN: { amt: 0, n: 0 },
    TAKEAWAY: { amt: 0, n: 0 },
    DELIVERY: { amt: 0, n: 0, items: 0, fees: 0 },
  };

  const sources = {
    WEBSITE: { amt: 0, n: 0 },
    POS: { amt: 0, n: 0 },
    FOODPANDA: { amt: 0, n: 0 },
    OTHER: { amt: 0, n: 0 },
  };

  const itemAgg = new Map();
  const staffAgg = new Map();

  for (const o of revenue) {
    const g = gt(o);
    const pm = String(o.paymentMethod || "").toUpperCase();

    if (pm === "CASH") {
      cash += g;
      cashOrders.add(o.id);
    } else if (pm === "CARD") {
      card += g;
      cardOrders.add(o.id);
    } else if (pm === "ONLINE") {
      online += g;
      onlineOrders.add(o.id);
      const prov =
        (o.paymentProvider && String(o.paymentProvider).trim()) || "Online";
      onlineByProv[prov] = (onlineByProv[prov] || 0) + g;
    } else if (pm === "SPLIT") {
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
