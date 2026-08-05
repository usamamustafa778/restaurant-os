import { useEffect, useState, useRef, useMemo, useId } from "react";
import Link from "next/link";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getOverview,
  getSalesReport,
  getOrders,
  getDailyCurrency,
  saveDailyCurrency,
  SubscriptionInactiveError,
  getDaySessions,
  getCurrentDaySession,
  getDaySessionOrders,
  endDaySession,
  updateBranch,
  getInventory,
  getRestaurantSettings,
  updateRestaurantSettings,
  openCashDrawer,
  getCurrencySymbol,
  getProfitLoss,
  getTables,
  getReservations,
  getTenantSubscriptionSummary,
  getUsers,
  getPurchaseOrders,
} from "../../lib/apiClient";
import { usePermissions } from "../../contexts/PermissionContext";
import { getBusinessDate, formatBusinessDate } from "../../lib/businessDay";
import { localISODate, localToday } from "../../lib/accountingFormat";
import { getDefaultReportPreset } from "../../lib/reportPresetDefault";
import PremiumModulesPanel, {
  PremiumModuleCard,
} from "../../components/overview/PremiumModulesPanel";

/**
 * Derive the P&L calendar date range for a given period.
 * For session-scoped periods, prefer the actual session boundaries so the
 * ledger numbers cover the same window as the sales report.
 */
function derivePlDateRange({
  reportPeriod,
  selectedYear,
  selectedMonth,
  reportFrom,
  reportTo,
  customFrom,
  customTo,
}) {
  const validDate = (d) => d && !Number.isNaN(d.getTime());

  if (reportPeriod === "today" || reportPeriod === "yesterday") {
    const prFrom = reportFrom ? new Date(reportFrom) : null;
    const prTo = reportTo ? new Date(reportTo) : null;
    if (validDate(prFrom) && validDate(prTo)) {
      return { from: localISODate(prFrom), to: localISODate(prTo) };
    }
    if (reportPeriod === "today") {
      const t = localToday();
      return { from: t, to: t };
    }
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = localISODate(y);
    return { from: yStr, to: yStr };
  }

  // Custom range (monthly tab)
  if (customFrom && customTo) return { from: customFrom, to: customTo };
  const now = new Date();
  const isCurrent =
    selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
  return {
    from: localISODate(new Date(selectedYear, selectedMonth, 1)),
    to: isCurrent
      ? localToday()
      : localISODate(new Date(selectedYear, selectedMonth + 1, 0)),
  };
}

function shiftBusinessDateStr(dateStr, deltaDays) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getCalendarYesterdayRange() {
  const s = new Date();
  s.setDate(s.getDate() - 1);
  s.setHours(0, 0, 0, 0);
  const e = new Date(s);
  e.setHours(23, 59, 59, 999);
  return { from: s.toISOString(), to: e.toISOString() };
}

function findSessionsForDate(sessions, cutoffHour, targetDateStr) {
  if (!Array.isArray(sessions) || !targetDateStr) return [];
  return sessions.filter((s) => {
    if (s?.status !== "CLOSED" || !s?.startAt) return false;
    const sessionDateStr = getBusinessDate(new Date(s.startAt), cutoffHour);
    return sessionDateStr === targetDateStr;
  });
}

function resolveYesterdaySessionScope(sessions, cutoffHour = 4) {
  const yesterdayStr = shiftBusinessDateStr(
    getBusinessDate(new Date(), cutoffHour),
    -1,
  );
  const yesterdaySessions = findSessionsForDate(
    sessions,
    cutoffHour,
    yesterdayStr,
  ).filter((s) => s?.startAt && s?.endAt);

  if (yesterdaySessions.length === 0) {
    return getCalendarYesterdayRange();
  }

  if (yesterdaySessions.length === 1) {
    const s = yesterdaySessions[0];
    const sessionId = s.id || s._id;
    return {
      from: s.startAt,
      to: s.endAt,
      ...(sessionId ? { daySessionId: String(sessionId) } : {}),
    };
  }

  const earliestStart = yesterdaySessions.reduce(
    (min, s) => Math.min(min, new Date(s.startAt).getTime()),
    new Date(yesterdaySessions[0].startAt).getTime(),
  );
  const latestEnd = yesterdaySessions.reduce(
    (max, s) => Math.max(max, new Date(s.endAt).getTime()),
    new Date(yesterdaySessions[0].endAt).getTime(),
  );
  return {
    from: new Date(earliestStart).toISOString(),
    to: new Date(latestEnd).toISOString(),
  };
}
import { useBranch } from "../../contexts/BranchContext";
import {
  ShoppingBag,
  TrendingUp,
  Package,
  CreditCard,
  Loader2,
  Clock,
  Wallet,
  X,
  Power,
  ChevronDown,
  Banknote,
  Coins,
  Pencil,
  ArrowRight,
  Globe,
  Crown,
  Users,
  Sparkles,
  ClipboardList,
  Wrench,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Smooth area chart (Catmull-Rom → cubic bezier) ───────────────────────────
function SalesAreaChart({
  period,
  dailySales,
  hourlySales,
  remainingHoursStart,
  hourBucketSize = 1,
  hourStartHours = null,
  currencySymbol = "Rs",
}) {
  const uid = useId().replace(/:/g, "");
  const W = 640;
  const H = 240;
  const pL = 44;
  const pR = 14;
  const pT = 28;
  const pB = 32;
  const iW = W - pL - pR;
  const iH = H - pT - pB;

  const isMonthly = period === "monthly";
  const data = isMonthly
    ? (dailySales || []).map((d) => ({
        y: d.sales ?? 0,
        label:
          d.label ??
          (d.day != null && d.day !== "" ? String(d.day) : ""),
        isRem: !!d.isRemaining,
        show: d.show !== false,
      }))
    : (() => {
        const points = hourlySales || [];
        const tickStep = points.length <= 12 ? 2 : 4;
        const starts =
          Array.isArray(hourStartHours) && hourStartHours.length === points.length
            ? hourStartHours
            : Array.from(
                { length: points.length },
                (_, i) => i * hourBucketSize,
              );
        return Array.from({ length: points.length }, (_, i) => {
          const hourStart = Number(starts[i]) || 0;
          return {
            y: points[i] || 0,
            label: i % tickStep === 0 ? formatHourLabel12(hourStart) : "",
            isRem: remainingHoursStart != null && hourStart >= remainingHoursStart,
            show: i % tickStep === 0,
          };
        });
      })();

  const n = data.length;
  if (n === 0)
    return (
      <div className="h-[200px] sm:h-[240px] flex items-center justify-center text-sm text-gray-400 dark:text-neutral-500">
        No data for this period
      </div>
    );

  const maxY = Math.max(...data.map((d) => d.y), 1);
  const peakIdx = data.reduce(
    (best, d, i) => (d.y > data[best].y ? i : best),
    0,
  );
  const xOf = (i) => pL + (n > 1 ? (i / (n - 1)) * iW : iW / 2);
  const yOf = (v) => pT + iH - (Math.min(v, maxY) / maxY) * iH;
  const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.y) }));

  const smooth = (arr) => {
    if (!arr || arr.length < 2)
      return arr?.length === 1 ? `M ${arr[0].x},${arr[0].y}` : "";
    const k = 0.3;
    let d = `M ${arr[0].x.toFixed(1)},${arr[0].y.toFixed(1)}`;
    for (let i = 0; i < arr.length - 1; i++) {
      const a = arr[Math.max(0, i - 1)];
      const b = arr[i];
      const c = arr[i + 1];
      const e = arr[Math.min(arr.length - 1, i + 2)];
      d += ` C ${(b.x + (c.x - a.x) * k).toFixed(1)},${(b.y + (c.y - a.y) * k).toFixed(1)} ${(c.x - (e.x - b.x) * k).toFixed(1)},${(c.y - (e.y - b.y) * k).toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
    }
    return d;
  };

  const linePath = smooth(pts);
  const areaPath = linePath
    ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)},${pT + iH} L ${pts[0].x.toFixed(1)},${pT + iH} Z`
    : "";
  const splitIdx = data.findIndex((d) => d.isRem);
  const splitX = splitIdx > 0 ? xOf(splitIdx) : splitIdx === 0 ? pL : W + 10;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxY * f);
  const fmt = (v) =>
    v === 0
      ? "0"
      : v >= 1e6
        ? `${(v / 1e6).toFixed(1)}M`
        : v >= 1000
          ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
          : String(Math.round(v));
  const fmtMoney = (v) =>
    `${currencySymbol} ${Math.round(v).toLocaleString()}`;

  const fillId = `ovFill-${uid}`;
  const lineId = `ovLine-${uid}`;
  const solidId = `ovSolid-${uid}`;
  const remId = `ovRem-${uid}`;

  const nonZeroCount = data.filter((d) => d.y > 0).length;
  const useBars = !isMonthly && nonZeroCount > 0 && nonZeroCount <= 6;

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-gray-50/80 dark:bg-neutral-900/50 px-0.5 pt-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[180px] sm:h-[220px]"
        preserveAspectRatio="none"
        role="img"
        aria-label="Sales chart"
      >
        <defs>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#FF5400" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#FF5400" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id={lineId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#FF5400" />
            <stop offset="100%" stopColor="#ff8a4c" />
          </linearGradient>
          <clipPath id={solidId}>
            <rect x={pL} y={0} width={Math.max(0, splitX - pL)} height={H} />
          </clipPath>
          <clipPath id={remId}>
            <rect x={Math.max(pL, splitX - 1)} y={0} width={W} height={H} />
          </clipPath>
        </defs>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={pL}
              y1={yOf(v)}
              x2={W - pR}
              y2={yOf(v)}
              stroke="currentColor"
              strokeWidth={i === 0 ? 1.25 : 0.75}
              strokeDasharray={i > 0 ? "3 5" : "none"}
              className="text-gray-200 dark:text-neutral-800"
            />
            <text
              x={pL - 6}
              y={yOf(v)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="10"
              fontWeight="600"
              className="fill-gray-400 dark:fill-neutral-500"
            >
              {fmt(v)}
            </text>
          </g>
        ))}
        {useBars
          ? data.map((d, i) => {
              const barW = Math.max(8, iW / n - 4);
              const x = xOf(i) - barW / 2;
              const y = yOf(d.y);
              const h = Math.max(0, pT + iH - y);
              return (
                <rect
                  key={`bar-${i}`}
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx="3"
                  fill={d.isRem ? "#d4d4d8" : i === peakIdx ? "#FF5400" : "#ff8a4c"}
                  opacity={d.y > 0 ? (d.isRem ? 0.45 : 0.9) : 0.12}
                />
              );
            })
          : (
            <>
              {areaPath && (
                <path
                  d={areaPath}
                  fill={`url(#${fillId})`}
                  clipPath={`url(#${solidId})`}
                />
              )}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke={`url(#${lineId})`}
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  clipPath={`url(#${solidId})`}
                />
              )}
              {linePath && splitIdx >= 0 && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="5 6"
                  strokeLinecap="round"
                  clipPath={`url(#${remId})`}
                  className="text-gray-300 dark:text-neutral-600"
                />
              )}
            </>
          )}
        {data[peakIdx]?.y > 0 && (
          <g>
            <circle
              cx={xOf(peakIdx)}
              cy={yOf(data[peakIdx].y)}
              r="4"
              fill="#FF5400"
              stroke="#fff"
              strokeWidth="2"
            />
            <text
              x={Math.min(Math.max(xOf(peakIdx), pL + 28), W - pR - 28)}
              y={Math.max(14, yOf(data[peakIdx].y) - 10)}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              className="fill-primary"
            >
              {fmtMoney(data[peakIdx].y)}
            </text>
          </g>
        )}
        {data.map((d, i) =>
          d.show && d.label ? (
            <text
              key={i}
              x={xOf(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              className={
                d.isRem
                  ? "fill-gray-300 dark:fill-neutral-600"
                  : "fill-gray-500 dark:fill-neutral-400"
              }
            >
              {d.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

// ── Map distribution keys to display labels and colors ────────────────────────
const productColors = ["#f97316", "#3b82f6", "#22c55e", "#6366f1", "#eab308"];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function normalizeHourlySales(input) {
  if (Array.isArray(input)) {
    return Array.from({ length: 24 }, (_, i) => Number(input[i] || 0));
  }
  if (input && typeof input === "object") {
    return Array.from({ length: 24 }, (_, i) =>
      Number(input[i] || input[String(i)] || 0),
    );
  }
  return new Array(24).fill(0);
}

function formatHourLabel12(hour) {
  const h = Number(hour) || 0;
  const hour12 = h % 12 || 12;
  const suffix = h < 12 ? "AM" : "PM";
  return `${hour12}${suffix}`;
}

function buildHourSequence(startHour, endHour) {
  const normalizeHour = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return ((Math.trunc(n) % 24) + 24) % 24;
  };
  const start = normalizeHour(startHour);
  const end = normalizeHour(endHour);
  if (start === end) {
    return Array.from({ length: 24 }, (_, i) => i);
  }
  const hours = [start];
  let cursor = start;
  while (cursor !== end && hours.length <= 24) {
    cursor = (cursor + 1) % 24;
    hours.push(cursor);
  }
  return hours;
}

function buildHourlySalesFromOrders(orders, { from, to } = {}) {
  const buckets = new Array(24).fill(0);
  const fromMs = from ? new Date(from).getTime() : -Infinity;
  const toMs = to ? new Date(to).getTime() : Infinity;

  for (const order of Array.isArray(orders) ? orders : []) {
    if (!isRevenueOrder(order)) continue;
    const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) continue;
    const t = createdAt.getTime();
    if (t < fromMs || t > toMs) continue;
    const hour = createdAt.getHours();
    buckets[hour] += Number(order?.grandTotal ?? order?.total) || 0;
  }

  return buckets;
}

function normalizeOrderStatus(status) {
  if (!status) return "NEW_ORDER";
  if (status === "UNPROCESSED") return "NEW_ORDER";
  if (status === "PENDING") return "PROCESSING";
  if (status === "COMPLETED") return "DELIVERED";
  return status;
}

function isDeliveryOrder(order) {
  const type = String(order?.type || order?.orderType || "").toUpperCase();
  return type.includes("DELIVERY");
}

function isOrderPaid(order) {
  // Trust explicit paid=true from API; if false/missing, infer (mapOrder can be conservative on WEBSITE).
  if (order?.isPaid === true) return true;
  if (order?.source === "FOODPANDA") return true;
  if (order?.paymentAmountReceived != null) {
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
  if (isDeliveryOrder(order) && order?.deliveryPaymentCollected === true)
    return true;
  return false;
}

/** Same as POS “closed” revenue: delivered/completed and paid (excludes unpaid delivered). */
function isRevenueOrder(order) {
  const s = String(order?.status || "").toUpperCase();
  if (s !== "DELIVERED" && s !== "COMPLETED") return false;
  return isOrderPaid(order);
}

function computeUpcomingPayments(orders) {
  const rows = {
    NEW_ORDER: { label: "New Orders", count: 0, amount: 0 },
    PROCESSING: { label: "Preparing", count: 0, amount: 0 },
    READY: { label: "Ready", count: 0, amount: 0 },
    OUT_FOR_DELIVERY: { label: "Out for Delivery", count: 0, amount: 0 },
  };
  for (const order of Array.isArray(orders) ? orders : []) {
    const status = normalizeOrderStatus(order?.status);
    if (!rows[status]) continue;
    // Upcoming payments should be unpaid active orders only.
    if (isOrderPaid(order)) continue;
    rows[status].count += 1;
    rows[status].amount += Number(order?.grandTotal ?? order?.total) || 0;
  }
  const list = Object.values(rows);
  return {
    rows: list,
    totalCount: list.reduce((s, r) => s + r.count, 0),
    totalAmount: list.reduce((s, r) => s + r.amount, 0),
  };
}

/** Delivered/completed but payment not recorded (excluded from "Upcoming" above) */
function computeDeliveredUnpaid(orders) {
  let count = 0;
  let amount = 0;
  for (const order of Array.isArray(orders) ? orders : []) {
    const status = normalizeOrderStatus(order?.status);
    if (status !== "DELIVERED") continue;
    if (isOrderPaid(order)) continue;
    count += 1;
    amount += Number(order?.grandTotal ?? order?.total) || 0;
  }
  return { count, amount };
}

/**
 * Client-side revenue breakdown: paid + delivered/completed only (matches POS closed bar).
 */
function computeRevenueBreakdown(orders) {
  let salesAmount = 0;
  let deliveryFees = 0;
  let orderCount = 0;
  for (const order of Array.isArray(orders) ? orders : []) {
    if (!isRevenueOrder(order)) continue;
    orderCount += 1;
    const gt = Number(order?.grandTotal ?? order?.total) || 0;
    const dc = Number(order?.deliveryCharges) || 0;
    deliveryFees += dc;
    salesAmount += Math.max(0, gt - dc);
  }
  return {
    orderCount,
    salesAmount,
    deliveryFees,
    grandTotal: salesAmount + deliveryFees,
  };
}

/** Paid + completed/delivered revenue by order source (POS / WEBSITE / FOODPANDA). */
function emptySourceChannelBreakdown() {
  return {
    POS: { orders: 0, revenue: 0 },
    WEBSITE: { orders: 0, revenue: 0 },
    FOODPANDA: { orders: 0, revenue: 0 },
    OTHER: { orders: 0, revenue: 0 },
  };
}

function computeSourceChannelBreakdown(orders) {
  const buckets = emptySourceChannelBreakdown();
  for (const order of Array.isArray(orders) ? orders : []) {
    if (!isRevenueOrder(order)) continue;
    const raw = String(order?.source || "POS").toUpperCase();
    const key = buckets[raw] ? raw : "OTHER";
    buckets[key].orders += 1;
    buckets[key].revenue += Number(order?.grandTotal ?? order?.total) || 0;
  }
  return buckets;
}

function Skeleton({ className = "" }) {
  return (
    <div
      className={`bg-gray-200 dark:bg-neutral-800 animate-pulse rounded-lg ${className}`}
    />
  );
}

function OverviewSectionSkeleton({ bodyHeightClass = "h-24" }) {
  return (
    <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5 min-w-0">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-44 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-5 w-20 rounded-md flex-shrink-0" />
      </div>
      <div className="border-t border-gray-100 dark:border-neutral-800 p-5">
        <Skeleton className={`w-full ${bodyHeightClass}`} />
      </div>
    </div>
  );
}

/** KPI strip + sales chart row + three summary cards (matches period report fetch). */
function OverviewPeriodContentSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={`ov-period-kpi-${i}`}
            className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
            </div>
            <Skeleton className="h-2.5 w-14 mb-2" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-2 w-16 mt-2" />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-52 max-w-full" />
            </div>
            <div className="text-right space-y-1">
              <Skeleton className="h-7 w-28 ml-auto" />
              <Skeleton className="h-2.5 w-20 ml-auto" />
            </div>
          </div>
          <Skeleton className="w-full h-[260px] rounded-xl" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[100px] rounded-2xl" />
          <div className="flex-1 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 min-h-[200px]">
            <Skeleton className="h-3 w-24 mb-4" />
            <Skeleton className="h-[140px] w-full rounded-xl" />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 xl:grid-cols-4 gap-5 mb-5">
        <OverviewSectionSkeleton bodyHeightClass="h-36" />
        <OverviewSectionSkeleton bodyHeightClass="h-36" />
        <OverviewSectionSkeleton bodyHeightClass="h-36" />
        <OverviewSectionSkeleton bodyHeightClass="h-36" />
      </div>
    </>
  );
}

function OverviewScreenSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-9 w-[280px] max-w-full rounded-xl" />
        </div>
      </div>

      <OverviewPeriodContentSkeleton />

      <OverviewSectionSkeleton bodyHeightClass="h-28" />
      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-2.5 w-48" />
            </div>
          </div>
        </div>
        <div className="px-4 py-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

export default function OverviewPage() {
  const { currentBranch, setCurrentBranch } = useBranch() || {};
  const [monthlyChartMode, setMonthlyChartMode] = useState("peaks"); // peaks | trend
  const [chartStartHour, setChartStartHour] = useState(0);
  const [chartEndHour, setChartEndHour] = useState(23);

  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    revenue: 0,
    totalBudgetCost: 0,
    totalProfit: 0,
    lowStockItems: [],
    hourlySales: new Array(24).fill(0),
    salesTypeDistribution: {},
    paymentDistribution: {},
    sourceDistribution: {},
    topProducts: [],
    productsPerformance: [],
  });

  const [invItems, setInvItems] = useState([]);
  const [invLoading, setInvLoading] = useState(true);

  const [floorSummary, setFloorSummary] = useState({
    occupied: 0,
    available: 0,
    todayReservations: 0,
    nextReservationTime: null,
  });

  const [staffKpis, setStaffKpis] = useState({
    total: 0,
    activeToday: 0,
    waiters: 0,
    kitchen: 0,
    riders: 0,
    neverLoggedIn: 0,
    inactive: 0,
  });
  const [staffLoading, setStaffLoading] = useState(true);

  const [poKpis, setPoKpis] = useState({
    total: 0,
    draft: 0,
    sent: 0,
    partial: 0,
    received: 0,
    openValue: 0,
  });
  const [poLoading, setPoLoading] = useState(true);

  const [suspended, setSuspended] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [periodReport, setPeriodReport] = useState({
    totalRevenue: 0,
    salesAmount: 0,
    deliveryFees: 0,
    totalProfit: 0,
    totalOrders: 0,
    topItems: [],
    dailySales: [],
    hourlySales: null,
    paymentDistribution: {},
    paymentRows: [],
    paymentAccountRows: [],
    upcomingPayments: { rows: [], totalCount: 0, totalAmount: 0 },
    deliveredUnpaid: { count: 0, amount: 0 },
    sourceChannelBreakdown: emptySourceChannelBreakdown(),
  });
  const [reportPeriod, setReportPeriod] = useState(null);
  const [periodLoading, setPeriodLoading] = useState(true);
  /** Accounting P&L for the same calendar range as the sales period (ledger net profit). */
  const [periodAccountingPl, setPeriodAccountingPl] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    new Date().getMonth(),
  );
  const [selectedYear, setSelectedYear] = useState(() =>
    new Date().getFullYear(),
  );
  const [reportCustomFrom, setReportCustomFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [reportCustomTo, setReportCustomTo] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  // ─── Accounting P&L widget (this-month, refreshes when month changes) ────
  const [plData, setPlData] = useState(null);
  const [plLoading, setPlLoading] = useState(true);
  const [plSetup, setPlSetup] = useState(true);
  /** Active subscription module keys from billing summary. */
  const [activeModuleKeys, setActiveModuleKeys] = useState(null);
  const modulesLoaded = activeModuleKeys != null;
  const isModuleActive = (key) =>
    modulesLoaded ? activeModuleKeys.has(key) : false;
  const accountingUnlocked = isModuleActive("accounting");
  const whatsappUnlocked = isModuleActive("aiReceptionist");
  const inventoryUnlocked = isModuleActive("inventory");
  const kdsUnlocked = isModuleActive("kds");
  const websiteAnalyticsUnlocked = isModuleActive("websiteAnalytics");
  const reservationsUnlocked = isModuleActive("reservations");

  useEffect(() => {
    let cancelled = false;
    getTenantSubscriptionSummary()
      .then((response) => {
        if (cancelled) return;
        const modules = response?.summary?.billing?.modules;
        const activeKeys = new Set(
          Array.isArray(modules)
            ? modules
                .filter((m) => m?.active && m?.key)
                .map((m) => String(m.key))
            : [],
        );
        setActiveModuleKeys(activeKeys);
      })
      .catch(() => {
        if (!cancelled) setActiveModuleKeys(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPlLoading(true);
    const now = new Date();
    const { from, to } = derivePlDateRange({
      reportPeriod: "monthly",
      selectedYear: now.getFullYear(),
      selectedMonth: now.getMonth(),
      reportFrom: null,
      reportTo: null,
    });
    getProfitLoss({ dateFrom: from, dateTo: to })
      .then((d) => {
        if (cancelled) return;
        if (d) {
          setPlData(d);
          setPlSetup(true);
        } else {
          setPlSetup(false);
        }
      })
      .catch(() => {
        if (!cancelled) setPlSetup(false);
      })
      .finally(() => {
        if (!cancelled) setPlLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  const cutoffHour = currentBranch?.businessDayCutoffHour ?? 4;
  const businessDate = getBusinessDate(new Date(), cutoffHour);

  const [showEndDayModal, setShowEndDayModal] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [endingDay, setEndingDay] = useState(false);
  const [savingCutoff, setSavingCutoff] = useState(false);
  // Manual end-day: auto-close uses cutoff on the backend; this modal allows selecting an order boundary.
  const [endMode, setEndMode] = useState("selectedOrder"); // 'cutoff' | 'selectedOrder'

  // Compute the cutoff endAt the same way the backend would (today at cutoffHour, or yesterday if before cutoffHour)
  const cutoffEndAt = (() => {
    const d = new Date();
    d.setHours(cutoffHour, 0, 0, 0);
    if (new Date() < d) d.setDate(d.getDate() - 1);
    return d;
  })();
  const [loadingEndOrders, setLoadingEndOrders] = useState(false);
  const [endOrderOptions, setEndOrderOptions] = useState([]); // {id, orderNumber, createdAt, status}
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [endOrderSearch, setEndOrderSearch] = useState("");
  const [showEndOrderMenu, setShowEndOrderMenu] = useState(false);

  async function openEndDayModal() {
    if (!currentBranch?.id) {
      toast.error("Select a branch first to end the business day");
      return;
    }
    setCurrentSession(null);
    setEndMode("cutoff");
    setEndOrderOptions([]);
    setSelectedOrderId(null);
    setEndOrderSearch("");
    setShowEndOrderMenu(false);
    setShowEndDayModal(true);
    setLoadingSession(true);
    try {
      const session = await getCurrentDaySession(currentBranch?.id);
      setCurrentSession(session);

      // Load orders for selecting the end boundary (manual closing only).
      setLoadingEndOrders(true);
      try {
        if (session?.id) {
          const res = await getDaySessionOrders(session.id, {
            dayScope: "all",
          });
          const orders = Array.isArray(res?.orders) ? res.orders : [];
          const eligible = orders
            .filter((o) => o && o.status !== "CANCELLED")
            .slice(0, 50);
          setEndOrderOptions(eligible);
          setSelectedOrderId(eligible[0]?.id || null);
          if (eligible[0]) {
            const dt = eligible[0]?.createdAt
              ? new Date(eligible[0].createdAt).toLocaleString("en-PK", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })
              : "";
            setEndOrderSearch(
              `${(eligible[0].orderNumber || eligible[0].id || "").toString()} · ${dt}`,
            );
          }
        }
      } catch {
        setEndOrderOptions([]);
        setSelectedOrderId(null);
        setEndOrderSearch("");
      } finally {
        setLoadingEndOrders(false);
      }
    } catch {
      setCurrentSession(null);
      setEndOrderOptions([]);
      setSelectedOrderId(null);
      setEndOrderSearch("");
    } finally {
      setLoadingSession(false);
    }
  }

  async function handleEndDay() {
    if (!currentBranch?.id) {
      toast.error("Select a branch first to end the business day");
      return;
    }
    setEndingDay(true);
    try {
      await endDaySession(currentBranch?.id, {
        endMode,
        selectedOrderId,
        // For cutoff mode send the pre-computed timestamp so the backend uses the
        // correct boundary regardless of any server/client clock skew.
        endAt: endMode === "cutoff" ? cutoffEndAt : null,
      });
      toast.success("Business day ended");
      setShowEndDayModal(false);
    } catch (err) {
      toast.error(err.message || "Failed to end business day");
    } finally {
      setEndingDay(false);
    }
  }

  async function handleCutoffChange(e) {
    const newHour = Number(e.target.value);
    if (!currentBranch?.id) return;
    setSavingCutoff(true);
    try {
      await updateBranch(currentBranch.id, {
        ...currentBranch,
        businessDayCutoffHour: newHour,
      });
      setCurrentBranch({ ...currentBranch, businessDayCutoffHour: newHour });
      toast.success("Day reset time updated");
    } catch (err) {
      toast.error(err.message || "Failed to update");
    } finally {
      setSavingCutoff(false);
    }
  }

  const CURRENCY_SYMBOLS = {
    PKR: "Rs",
    USD: "$",
    EUR: "€",
    INR: "₹",
    GBP: "£",
  };
  const { hasPermission, permissionsLoaded } = usePermissions();
  const canOpenDrawer =
    permissionsLoaded &&
    (hasPermission("orders.collect_payment") ||
      hasPermission("session.manage") ||
      hasPermission("pos.close_business_day"));

  const buildGenericRows = () => [];
  const [currencyCode, setCurrencyCode] = useState(null);
  const [defaultDenominations, setDefaultDenominations] = useState([]);
  const [currencyRows, setCurrencyRows] = useState(() => buildGenericRows());
  const [editingDenomId, setEditingDenomId] = useState(null);
  const [currencyDate, setCurrencyDate] = useState(null);
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [currencySaving, setCurrencySaving] = useState(false);
  const [drawerOpening, setDrawerOpening] = useState(false);
  const [expectedCashSales, setExpectedCashSales] = useState(0);
  const [expectedCashLoading, setExpectedCashLoading] = useState(false);
  const currencySaveTimeoutRef = useRef(null);
  const currencyDirtyRef = useRef(false);
  const currencyDateValue = useMemo(() => {
    if (!currencyDate) return null;
    if (currencyDate === "today") {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [currencyDate]);
  const currencySymbol = getCurrencySymbol();
  const isCurrencyEditable = true;
  const currencyTotal = currencyRows.reduce((sum, row) => {
    const v = Number(row.value);
    const q = Number(row.qty);
    if (!Number.isFinite(v) || v <= 0 || !Number.isFinite(q) || q <= 0)
      return sum;
    return sum + v * q;
  }, 0);
  const currencyDifference = currencyTotal - Number(expectedCashSales || 0);

  function normalizeDenomKey(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "";
    return n.toString();
  }

  function setCurrencyQty(rowId, value) {
    currencyDirtyRef.current = true;
    setCurrencyRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, qty: value.replace(/[^\d]/g, "") } : row,
      ),
    );
  }

  function setCurrencyDenomination(rowId, value) {
    currencyDirtyRef.current = true;
    setCurrencyRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, value: value.replace(/[^0-9.]/g, "") }
          : row,
      ),
    );
  }

  useEffect(() => {
    getRestaurantSettings()
      .then((s) => {
        const code = String(s?.currencyCode || "")
          .trim()
          .toUpperCase();
        setCurrencyCode(code || null);
        if (Array.isArray(s?.currencyDenominations)) {
          setDefaultDenominations(
            s.currencyDenominations
              .map((v) => Number(v))
              .filter((v) => Number.isFinite(v) && v > 0),
          );
        }
      })
      .catch(() => {
        setCurrencyCode(null);
        setDefaultDenominations([]);
      });
  }, []);

  useEffect(() => {
    const rows =
      (defaultDenominations || []).length > 0
        ? (defaultDenominations || []).map((v, idx) => ({
            id: `d-${idx}-${v}`,
            type: v >= 1 ? "note" : "coin",
            value: String(v),
            qty: "",
          }))
        : buildGenericRows();
    setCurrencyRows(rows);
  }, [defaultDenominations]);

  function formatMoney(value) {
    return `${currencySymbol} ${Math.abs(Number(value || 0)).toLocaleString(
      undefined,
      {
        minimumFractionDigits: Number.isInteger(Number(value || 0)) ? 0 : 2,
        maximumFractionDigits: 2,
      },
    )}`;
  }

  function formatDenomination(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "Enter value";
    return Number.isInteger(n)
      ? `${currencySymbol} ${n.toLocaleString()}`
      : `${currencySymbol} ${n}`;
  }

  useEffect(() => {
    if (!currencyDateValue) return;
    let cancelled = false;
    currencyDirtyRef.current = false;
    setCurrencyLoading(true);
    const templateRows =
      (defaultDenominations || []).length > 0
        ? (defaultDenominations || []).map((v, idx) => ({
            id: `t-${idx}-${v}`,
            type: v >= 1 ? "note" : "coin",
            value: String(v),
            qty: "",
          }))
        : [];
    getDailyCurrency(currencyDateValue)
      .then((res) => {
        if (cancelled) return;
        const q = res?.quantities || {};
        const entries = Object.entries(q)
          .map(([denom, qty], idx) => ({
            id: `saved-${idx}`,
            value: denom,
            qty: qty != null ? String(qty) : "",
            type: Number(denom) >= 1 ? "note" : "coin",
          }))
          .sort((a, b) => Number(b.value) - Number(a.value));
        setCurrencyRows(entries.length > 0 ? entries : templateRows);
      })
      .catch(() => {
        if (!cancelled) setCurrencyRows(templateRows);
      })
      .finally(() => {
        if (!cancelled) setCurrencyLoading(false);
      });
    return () => {
      cancelled = true;
      if (currencySaveTimeoutRef.current)
        clearTimeout(currencySaveTimeoutRef.current);
    };
  }, [currencyDateValue, defaultDenominations]);

  useEffect(() => {
    if (!currencyDate || !currencyDateValue) return;
    let cancelled = false;
    setExpectedCashLoading(true);
    (async () => {
      try {
        let from = currencyDateValue;
        const toDate = new Date(`${currencyDateValue}T00:00:00`);
        toDate.setDate(toDate.getDate() + 1);
        let to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;
        let daySessionId;

        // Keep expected cash aligned with business-day sessions (same as report cards),
        // otherwise midnight calendar windows can skew the difference.
        if (currencyDate === "today" || currencyDate === "yesterday") {
          try {
            if (currencyDate === "today" && currentBranch?.id) {
              const cur = await getCurrentDaySession(currentBranch.id);
              if (cur?.id) daySessionId = cur.id;
            }
            const res = await getDaySessions(currentBranch?.id, { limit: 10 });
            const sessions = Array.isArray(res?.sessions) ? res.sessions : [];
            if (currencyDate === "today" && !daySessionId) {
              const openSess = sessions.find((s) => s.status === "OPEN");
              if (openSess?.id) daySessionId = openSess.id;
            }
            if (currencyDate === "yesterday") {
              const yScope = resolveYesterdaySessionScope(sessions, cutoffHour);
              if (yScope?.daySessionId) {
                daySessionId = yScope.daySessionId;
              } else if (yScope?.from && yScope?.to) {
                from = yScope.from;
                to = yScope.to;
              }
            }
          } catch {
            // fallback to calendar date window
          }
        }

        const report = daySessionId
          ? await getSalesReport({ daySessionId })
          : await getSalesReport({ from, to });
        if (cancelled) return;
        const cash = Array.isArray(report?.paymentRows)
          ? report.paymentRows
              .filter(
                (r) =>
                  String(r?.method || "")
                    .trim()
                    .toUpperCase() === "CASH",
              )
              .reduce((sum, r) => sum + Number(r?.amount || 0), 0)
          : 0;
        setExpectedCashSales(cash);
      } catch {
        if (!cancelled) setExpectedCashSales(0);
      } finally {
        if (!cancelled) setExpectedCashLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currencyDateValue, currencyDate, currentBranch?.id, cutoffHour]);

  function handleSaveCurrency() {
    if (!isCurrencyEditable) return;
    const quantitiesToSave = {};
    currencyRows.forEach((row) => {
      const denomKey = normalizeDenomKey(row.value);
      const qtyNum = Number(row.qty);
      if (!denomKey) return;
      if (!Number.isNaN(qtyNum) && qtyNum >= 0) {
        quantitiesToSave[denomKey] = (quantitiesToSave[denomKey] || 0) + qtyNum;
      }
    });
    setCurrencySaving(true);
    saveDailyCurrency(currencyDateValue, quantitiesToSave)
      .then(() => {
        setCurrencySaving(false);
        currencyDirtyRef.current = false;
        toast.success("Currency saved");
      })
      .catch((err) => {
        setCurrencySaving(false);
        toast.error(err.message || "Failed to save currency");
      });
  }

  function handleOpenDrawer() {
    setDrawerOpening(true);
    openCashDrawer({ reason: "manual" })
      .then(() => {
        toast.success("Drawer opened");
      })
      .catch((err) => {
        toast.error(err.message || "Failed to open drawer");
      })
      .finally(() => setDrawerOpening(false));
  }

  function handleSaveDenominationsAsDefault() {
    const denoms = currencyRows
      .map((row) => Number(row.value))
      .filter((v) => Number.isFinite(v) && v > 0);
    const uniqueSorted = Array.from(new Set(denoms)).sort((a, b) => b - a);
    if (uniqueSorted.length === 0) {
      toast.error("Add at least one denomination to save as default");
      return;
    }
    toast
      .promise(
        updateRestaurantSettings({
          currencyCode: currencyCode || null,
          currencyDenominations: uniqueSorted,
        }),
        {
          loading: "Saving denominations…",
          success: "Denominations saved for future days",
          error: (err) => err.message || "Failed to save denominations",
        },
      )
      .then((updated) => {
        if (updated?.currencyDenominations) {
          setDefaultDenominations(updated.currencyDenominations);
        }
      });
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await getOverview();
        setStats(data);
        setPageLoading(false);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) setSuspended(true);
        else {
          console.error("Failed to load overview:", err);
          toast.error(err.message || "Failed to load overview");
        }
        setPageLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    getInventory()
      .then((data) => setInvItems(Array.isArray(data) ? data : []))
      .catch(() => setInvItems([]))
      .finally(() => setInvLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStaffLoading(true);
    getUsers()
      .then((users) => {
        if (cancelled) return;
        const list = Array.isArray(users) ? users : [];
        const todayKey = localISODate(new Date());
        const lastActive = (u) => u?.lastActiveAt || u?.lastLoginAt || null;
        const isToday = (iso) => {
          if (!iso) return false;
          const d = new Date(iso);
          if (Number.isNaN(d.getTime())) return false;
          return localISODate(d) === todayKey;
        };
        const active = list.filter((u) => u.isActive !== false);
        setStaffKpis({
          total: active.length,
          activeToday: active.filter((u) => isToday(lastActive(u))).length,
          waiters: active.filter((u) => u.role === "order_taker").length,
          kitchen: active.filter((u) => u.role === "kitchen_staff").length,
          riders: active.filter((u) => u.role === "delivery_rider").length,
          neverLoggedIn: active.filter((u) => !lastActive(u)).length,
          inactive: list.filter((u) => u.isActive === false).length,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setStaffKpis({
            total: 0,
            activeToday: 0,
            waiters: 0,
            kitchen: 0,
            riders: 0,
            neverLoggedIn: 0,
            inactive: 0,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setStaffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentBranch?.id]);

  useEffect(() => {
    let cancelled = false;
    setPoLoading(true);
    getPurchaseOrders()
      .then((data) => {
        if (cancelled) return;
        const orders = Array.isArray(data?.orders) ? data.orders : [];
        const draft = orders.filter((o) => o.status === "draft").length;
        const sent = orders.filter((o) => o.status === "sent").length;
        const partial = orders.filter(
          (o) => o.status === "partially_received",
        ).length;
        const received = orders.filter((o) => o.status === "received").length;
        const openValue = orders
          .filter((o) => ["draft", "sent", "partially_received"].includes(o.status))
          .reduce((sum, o) => sum + Number(o.totalEstimatedCost || 0), 0);
        setPoKpis({
          total: orders.length,
          draft,
          sent,
          partial,
          received,
          openValue,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setPoKpis({
            total: 0,
            draft: 0,
            sent: 0,
            partial: 0,
            received: 0,
            openValue: 0,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setPoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentBranch?.id, inventoryUnlocked]);

  useEffect(() => {
    (async () => {
      try {
        const todayStr = (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })();
        const [tables, reservations] = await Promise.all([
          getTables(),
          getReservations({ date: todayStr }),
        ]);
        const tableList = Array.isArray(tables) ? tables : [];
        const occupied = tableList.filter((t) => t.status === "occupied").length;
        const available = tableList.filter((t) => t.status === "available").length;
        const active = reservations.filter((r) =>
          ["pending", "confirmed", "seated"].includes(r.status),
        );
        const now = new Date();
        const upcoming = active
          .filter((r) => {
            if (!r.time) return false;
            const [h, m] = r.time.split(":").map(Number);
            const rDate = new Date(r.date || todayStr);
            rDate.setHours(h, m, 0, 0);
            return rDate > now;
          })
          .sort((a, b) => a.time.localeCompare(b.time));
        let nextReservationTime = null;
        if (upcoming.length > 0) {
          const [h, m] = upcoming[0].time.split(":").map(Number);
          nextReservationTime = new Date(0, 0, 0, h, m).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
        }
        setFloorSummary({
          occupied,
          available,
          todayReservations: active.length,
          nextReservationTime,
        });
      } catch {
        // non-critical — silently ignore
      }
    })();
  }, [currentBranch?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loadedSessions = [];
      try {
        const res = await getDaySessions(currentBranch?.id, { limit: 10 });
        loadedSessions = Array.isArray(res?.sessions) ? res.sessions : [];
      } catch {
        loadedSessions = [];
      }
      if (cancelled) return;
      const def = getDefaultReportPreset(loadedSessions);
      setReportPeriod(def);
      setCurrencyDate(def);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentBranch?.id]);

  useEffect(() => {
    if (!reportPeriod) return;
    let cancelled = false;
    setPeriodLoading(true);
    setPeriodAccountingPl(null);
    (async () => {
      const now = new Date();
      let fromStr, toStr;
      /** Same scope as Business Day Report — session link or paid/closed in session window. */
      let daySessionId;

      if (reportPeriod === "today" || reportPeriod === "yesterday") {
        try {
          // Prefer /current — same OPEN session as POS & Business Day Report (reliable x-branch-id).
          if (reportPeriod === "today" && currentBranch?.id) {
            const cur = await getCurrentDaySession(currentBranch.id);
            if (cur?.id) daySessionId = cur.id;
          }
          const res = await getDaySessions(currentBranch?.id, { limit: 10 });
          const sessions = Array.isArray(res?.sessions) ? res.sessions : [];
          if (reportPeriod === "today" && !daySessionId) {
            const openSess = sessions.find((s) => s.status === "OPEN");
            if (openSess?.id) daySessionId = openSess.id;
          }
          if (reportPeriod === "yesterday") {
            const yScope = resolveYesterdaySessionScope(sessions, cutoffHour);
            if (yScope?.daySessionId) {
              daySessionId = yScope.daySessionId;
            } else if (yScope?.from && yScope?.to) {
              fromStr = yScope.from;
              toStr = yScope.to;
            }
          }
        } catch {
          /* fall through to calendar dates */
        }
      }

      // Calendar fallback (also used for "monthly" period)
      if (!daySessionId && !fromStr) {
        if (reportPeriod === "yesterday") {
          const s = new Date(now);
          s.setDate(s.getDate() - 1);
          s.setHours(0, 0, 0, 0);
          const e = new Date(s);
          e.setHours(23, 59, 59, 999);
          fromStr = s.toISOString();
          toStr = e.toISOString();
        } else if (reportPeriod === "today") {
          fromStr = now.toISOString().slice(0, 10);
          const t = new Date(now);
          t.setDate(t.getDate() + 1);
          toStr = t.toISOString().slice(0, 10);
        } else {
          // Range (monthly tab) — use custom from/to
          if (reportCustomFrom) {
            fromStr = reportCustomFrom;
            if (reportCustomTo) {
              const toDate = new Date(reportCustomTo);
              toDate.setDate(toDate.getDate() + 1);
              toStr = toDate.toISOString().slice(0, 10);
            } else {
              toStr = new Date().toISOString().slice(0, 10);
            }
          } else {
            fromStr = new Date(selectedYear, selectedMonth, 1)
              .toISOString()
              .slice(0, 10);
            toStr = new Date(selectedYear, selectedMonth + 1, 1)
              .toISOString()
              .slice(0, 10);
          }
        }
      }

      try {
        const [report, ordersResp] = await Promise.all([
          daySessionId
            ? getSalesReport({ daySessionId })
            : getSalesReport({ from: fromStr, to: toStr }),
          daySessionId
            ? getOrders({ daySessionId, limit: 2000 })
            : getOrders({ from: fromStr, to: toStr, limit: 2000 }),
        ]);

        const parsedOrders =
          ordersResp &&
          typeof ordersResp === "object" &&
          Array.isArray(ordersResp.orders)
            ? ordersResp.orders
            : Array.isArray(ordersResp)
              ? ordersResp
              : [];

        const sessionIdForMetrics = report.daySessionId || daySessionId;
        const ordersForMetrics =
          report.scope === "daySession" && sessionIdForMetrics
            ? parsedOrders.filter(
                (o) =>
                  !o.daySessionId ||
                  String(o.daySessionId) === String(sessionIdForMetrics),
              )
            : parsedOrders;

        const hourlyFrom = report.from ?? fromStr;
        const hourlyTo = report.to ?? toStr;
        const apiHourlySales = normalizeHourlySales(report.hourlySales);
        const localHourlySales = buildHourlySalesFromOrders(ordersForMetrics, {
          from: hourlyFrom,
          to: hourlyTo,
        });
        const localHasHourlyPoints = localHourlySales.some((v) => Number(v) > 0);
        const resolvedHourlySales =
          reportPeriod === "today" || reportPeriod === "yesterday"
            ? localHourlySales
            : localHasHourlyPoints
              ? localHourlySales
              : apiHourlySales;

        const { from: plFrom, to: plTo } = derivePlDateRange({
          reportPeriod,
          selectedYear,
          selectedMonth,
          reportFrom: report.from,
          reportTo: report.to,
          customFrom: reportCustomFrom,
          customTo: reportCustomTo,
        });

        let accountingPlJson = null;
        try {
          accountingPlJson = await getProfitLoss({
            dateFrom: plFrom,
            dateTo: plTo,
          });
        } catch {
          /* ledger P&L is optional — fall back to sales-based profit */
        }

        // Compute revenue/orders client-side from raw orders so the numbers
        // exactly match the Sales page (same DELIVERED|COMPLETED filter, same
        // grandTotal − deliveryCharges split).
        const clientBreakdown = computeRevenueBreakdown(ordersForMetrics);

        if (!cancelled) {
          setPeriodReport({
            totalRevenue: clientBreakdown.grandTotal,
            salesAmount: clientBreakdown.salesAmount,
            deliveryFees: clientBreakdown.deliveryFees,
            totalProfit: report.totalProfit ?? 0,
            totalOrders: clientBreakdown.orderCount,
            topItems: report.topItems ?? [],
            dailySales: report.dailySales ?? [],
            hourlySales: resolvedHourlySales,
            paymentDistribution: report.paymentDistribution ?? {},
            paymentRows: report.paymentRows ?? [],
            paymentAccountRows: report.paymentAccountRows ?? [],
            upcomingPayments: computeUpcomingPayments(ordersForMetrics),
            deliveredUnpaid: computeDeliveredUnpaid(ordersForMetrics),
            sourceChannelBreakdown:
              computeSourceChannelBreakdown(ordersForMetrics),
          });
          setPeriodAccountingPl(accountingPlJson);
        }
      } catch (err) {
        if (!cancelled) console.error("Failed to load period report:", err);
      } finally {
        if (!cancelled) setPeriodLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    reportPeriod,
    selectedMonth,
    selectedYear,
    reportCustomFrom,
    reportCustomTo,
    currentBranch?.id,
    cutoffHour,
  ]);

  // Computed values
  const hasOrders = (periodReport.totalOrders ?? 0) > 0;
  const paymentRows = (periodReport.paymentRows || []).filter(
    (row) => row && row.method && row.method !== "Total",
  );
  const paymentAccountRows = periodReport.paymentAccountRows || [];

  const paymentSummary = paymentRows.reduce(
    (acc, row) => {
      const label = String(row.method || "").trim();
      const key = label.toUpperCase();
      const amount = Number(row.amount || 0);
      const orders = Number(row.orders || 0);
      if (key === "CASH") {
        acc.CASH.amount += amount;
        acc.CASH.orders += orders;
      } else if (key === "CARD") {
        acc.CARD.amount += amount;
        acc.CARD.orders += orders;
      } else if (key === "ONLINE") {
        acc.ONLINE.amount += amount;
        acc.ONLINE.orders += orders;
      } else if (
        key === "TO BE PAID" ||
        key === "PENDING" ||
        key === "UNPAID" ||
        key === "PENDING PAYMENT"
      ) {
        // Exclude unpaid rows from Payments accounting.
      } else {
        acc.OTHER.amount += amount;
        acc.OTHER.orders += orders;
      }
      return acc;
    },
    {
      CASH: { amount: 0, orders: 0 },
      CARD: { amount: 0, orders: 0 },
      ONLINE: { amount: 0, orders: 0 },
      OTHER: { amount: 0, orders: 0 },
    },
  );

  const upcomingPayments = periodReport.upcomingPayments || {
    rows: [],
    totalCount: 0,
    totalAmount: 0,
  };
  const deliveredUnpaid = periodReport.deliveredUnpaid || {
    count: 0,
    amount: 0,
  };
  const totalUnpaidExposure =
    Number(upcomingPayments.totalAmount || 0) +
    Number(deliveredUnpaid.amount || 0);

  const sourceChannelBreakdown =
    periodReport.sourceChannelBreakdown || emptySourceChannelBreakdown();

  const sourceChannelRows = (() => {
    const base = [
      { key: "POS", label: "POS", color: "#8b5cf6" },
      { key: "WEBSITE", label: "Website", color: "#db2777" },
      { key: "FOODPANDA", label: "Foodpanda", color: "#ea580c" },
    ].map((r) => ({
      ...r,
      orders: sourceChannelBreakdown[r.key]?.orders ?? 0,
      revenue: sourceChannelBreakdown[r.key]?.revenue ?? 0,
    }));
    if ((sourceChannelBreakdown.OTHER?.orders ?? 0) > 0) {
      base.push({
        key: "OTHER",
        label: "Other",
        color: "#9ca3af",
        orders: sourceChannelBreakdown.OTHER.orders,
        revenue: sourceChannelBreakdown.OTHER.revenue,
      });
    }
    return base;
  })();

  const totalSourceChannelRevenue = sourceChannelRows.reduce(
    (s, r) => s + Number(r.revenue || 0),
    0,
  );

  const receivedRows = [
    { key: "CASH", label: "Cash", color: "#0ea5e9" },
    { key: "CARD", label: "Card", color: "#22c55e" },
    { key: "ONLINE", label: "Online", color: "#6366f1" },
  ].map((r) => ({
    ...r,
    ...(paymentSummary[r.key] || { amount: 0, orders: 0 }),
  }));
  const totalReceivedAmount = receivedRows.reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0,
  );

  const displayTopItems = (periodReport.topItems || [])
    .slice(0, 5)
    .map((p, i) => ({
      label: p.name,
      value: p.quantity,
      color: productColors[i % productColors.length],
    }));

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentHour = now.getHours();
  const viewingYear =
    reportPeriod === "monthly"
      ? reportCustomFrom
        ? new Date(reportCustomFrom + "T00:00:00").getFullYear()
        : selectedYear
      : currentYear;
  const viewingMonthIndex =
    reportPeriod === "monthly"
      ? reportCustomFrom
        ? new Date(reportCustomFrom + "T00:00:00").getMonth()
        : selectedMonth
      : currentMonth;
  // For custom range: compute number of days between from and to
  const rangeFromDate =
    reportPeriod === "monthly" && reportCustomFrom
      ? new Date(reportCustomFrom + "T00:00:00")
      : new Date(viewingYear, viewingMonthIndex, 1);
  const rangeToDate =
    reportPeriod === "monthly" && reportCustomTo
      ? new Date(reportCustomTo + "T00:00:00")
      : new Date(viewingYear, viewingMonthIndex + 1, 0);
  const rangeDaysCount =
    reportPeriod === "monthly"
      ? Math.max(1, Math.round((rangeToDate - rangeFromDate) / 86400000) + 1)
      : new Date(viewingYear, viewingMonthIndex + 1, 0).getDate();

  // Keep today's chart consistent with yesterday/monthly data source.
  // Prefer period report hourly data; fall back to overview snapshot.
  const baseHourlySales = normalizeHourlySales(
    periodReport.hourlySales || stats.hourlySales,
  );
  const hourWindowHours = useMemo(
    () => buildHourSequence(chartStartHour, chartEndHour),
    [chartStartHour, chartEndHour],
  );
  const chartTimeLabel = `${formatHourLabel12(chartStartHour)} – ${formatHourLabel12(
    chartEndHour,
  )}`;
  // For "today", do not zero-out higher hour buckets.
  // This avoids a blank chart when the business day spans midnight.
  const fullDayHourlySales =
    reportPeriod === "today"
      ? baseHourlySales
      : Array.from({ length: 24 }, (_, i) =>
          i <= currentHour ? baseHourlySales[i] || 0 : 0,
        );
  const dayHourlyWindowSales = hourWindowHours.map(
    (h) => Number(fullDayHourlySales[h] || 0),
  );
  const yesterdayHourlyBase = normalizeHourlySales(periodReport.hourlySales);
  const yesterdayHourlyWindowSales = hourWindowHours.map(
    (h) => Number(yesterdayHourlyBase[h] || 0),
  );
  const monthlyHourlySales = normalizeHourlySales(periodReport.hourlySales);
  const monthlyPeakBucketStartHours = [];
  const monthlyHourlySales12 = [];
  for (let i = 0; i < hourWindowHours.length; i += 2) {
    const firstHour = hourWindowHours[i];
    const secondHour =
      i + 1 < hourWindowHours.length ? hourWindowHours[i + 1] : null;
    monthlyPeakBucketStartHours.push(firstHour);
    monthlyHourlySales12.push(
      Number(monthlyHourlySales[firstHour] || 0) +
        Number(secondHour != null ? monthlyHourlySales[secondHour] || 0 : 0),
    );
  }
  const monthlyHasHourlyData = monthlyHourlySales12.some((v) => Number(v) > 0);
  const salesByDateKey = new Map();
  (periodReport.dailySales || []).forEach((d) => {
    const key =
      typeof d?.date === "string" && d.date
        ? String(d.date).slice(0, 10)
        : null;
    if (!key) return;
    salesByDateKey.set(key, Number(d?.sales || 0));
  });
  const trendLabelStep =
    rangeDaysCount > 90 ? 10 : rangeDaysCount > 60 ? 7 : rangeDaysCount > 30 ? 5 : 3;
  const monthlyDailyTrendSales = Array.from({ length: rangeDaysCount }, (_, i) => {
    const dayDate = new Date(rangeFromDate);
    dayDate.setDate(dayDate.getDate() + i);
    const key = dayDate.toISOString().slice(0, 10);
    return {
      day: i + 1,
      label: String(dayDate.getDate()),
      sales: salesByDateKey.get(key) ?? 0,
      show: i === 0 || i === rangeDaysCount - 1 || i % trendLabelStep === 0,
    };
  });
  const monthlyHasTrendData = monthlyDailyTrendSales.some(
    (d) => Number(d.sales) > 0,
  );
  const remainingHoursStart = reportPeriod === "today" ? 24 : currentHour + 1;

  const viewTotalOrders = periodReport.totalOrders ?? 0;
  const viewTotalRevenue = periodReport.totalRevenue ?? 0;
  const viewTotalProfit =
    periodAccountingPl != null &&
    typeof periodAccountingPl.netProfit === "number"
      ? periodAccountingPl.netProfit
      : (periodReport.totalProfit ?? 0);
  const viewPendingOrders = stats.pendingOrders;
  const viewAvgOrder = viewTotalOrders
    ? Math.round(viewTotalRevenue / viewTotalOrders)
    : 0;

  const peakHourSource =
    reportPeriod === "yesterday"
      ? yesterdayHourlyBase
      : reportPeriod === "monthly"
        ? monthlyHourlySales
        : baseHourlySales;
  const peakHourIdx = peakHourSource.reduce(
    (best, v, i) => (Number(v) > Number(peakHourSource[best] || 0) ? i : best),
    0,
  );
  const peakHourAmount = Number(peakHourSource[peakHourIdx] || 0);

  // Inventory health stats
  const invFiltered = invItems.filter((i) => i.hasBranchRecord !== false);
  const invTotal = invFiltered.length;
  const invOut = invFiltered.filter((i) => (i.currentStock ?? 0) <= 0).length;
  const invLow = invFiltered.filter((i) => {
    const s = i.currentStock ?? 0,
      t = i.lowStockThreshold ?? 0;
    return s > 0 && t > 0 && s <= t;
  }).length;
  const invHealthy = invTotal - invOut - invLow;
  const invNeedAttn = invFiltered.filter(
    (i) => (i.currentStock ?? 0) <= (i.lowStockThreshold ?? 0),
  );

  const fmtRangeDate = (s) =>
    s
      ? new Date(s + "T00:00:00").toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "";
  const periodLabel =
    reportPeriod === "yesterday"
      ? "Yesterday"
      : reportPeriod === "monthly"
        ? reportCustomFrom && reportCustomTo
          ? `${fmtRangeDate(reportCustomFrom)} – ${fmtRangeDate(reportCustomTo)}`
          : `${MONTH_NAMES[viewingMonthIndex]} ${viewingYear}`
        : "Today";

  return (
    <AdminLayout title="Overview" suspended={suspended}>
      {pageLoading ? (
        <OverviewScreenSkeleton />
      ) : (
        <>
          {/* ─── Control bar ─────────────────────────────────────────────── */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            {/* ── Row 1 on mobile: Date (left) + End Day (right) ── */}
            <div className="flex items-center justify-between sm:justify-start sm:gap-2">
              {/* Business day indicator */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                  {formatBusinessDate(businessDate)}
                </span>
              </div>

              {/* End Day — visible on both mobile and desktop */}
              <button
                type="button"
                onClick={openEndDayModal}
                disabled={!currentBranch?.id}
                title={
                  currentBranch?.id
                    ? "End current branch business day"
                    : "Select a branch to end day"
                }
                className="sm:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Power className="w-3.5 h-3.5" />
                End Day
              </button>
            </div>

            {/* ── Row 2 on mobile: Resets (left) + Tabs (right) ── */}
            <div className="flex items-center justify-between sm:justify-end sm:gap-2">
              {/* Default exit time (editable) — left on mobile, inline on desktop */}
              <div className="relative flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                <Clock className="w-3 h-3 text-gray-400 dark:text-neutral-500 flex-shrink-0" />
                <span className="text-[11px] text-gray-500 dark:text-neutral-400 whitespace-nowrap">
                  Resets
                </span>
                <div className="relative flex items-center">
                  <select
                    value={cutoffHour}
                    onChange={handleCutoffChange}
                    disabled={savingCutoff || !currentBranch?.id}
                    className="appearance-none pr-4 text-xs font-semibold text-gray-700 dark:text-neutral-200 bg-transparent border-none outline-none cursor-pointer disabled:opacity-50"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i === 0
                          ? "12 AM"
                          : i < 12
                            ? `${i} AM`
                            : i === 12
                              ? "12 PM"
                              : `${i - 12} PM`}
                      </option>
                    ))}
                  </select>
                  {savingCutoff ? (
                    <Loader2 className="absolute right-0 w-2.5 h-2.5 animate-spin text-primary pointer-events-none" />
                  ) : (
                    <ChevronDown className="absolute right-0 w-2.5 h-2.5 text-gray-400 pointer-events-none" />
                  )}
                </div>
              </div>

              {/* Period tabs */}
              <div className="flex items-center gap-1.5">
                <div className="flex rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-0.5 gap-0.5">
                  {[
                    { value: "yesterday", label: "Yesterday" },
                    { value: "today", label: "Today" },
                    { value: "monthly", label: "Range" },
                  ].map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setReportPeriod(p.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                        reportPeriod === p.value
                          ? "bg-gradient-to-r from-primary to-secondary text-white shadow-sm"
                          : "text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {reportPeriod === "monthly" && (
                <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap">
                  <span className="text-[11px] text-gray-400 dark:text-neutral-500 hidden sm:inline">
                    From
                  </span>
                  <input
                    type="date"
                    value={reportCustomFrom}
                    onChange={(e) => setReportCustomFrom(e.target.value)}
                    className="h-8 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs rounded-lg px-2 text-gray-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-[11px] text-gray-400 dark:text-neutral-500">
                    →
                  </span>
                  <input
                    type="date"
                    value={reportCustomTo}
                    min={reportCustomFrom}
                    onChange={(e) => setReportCustomTo(e.target.value)}
                    className="h-8 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs rounded-lg px-2 text-gray-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {/* End Day — desktop only, always last */}
              <button
                type="button"
                onClick={openEndDayModal}
                disabled={!currentBranch?.id}
                title={
                  currentBranch?.id
                    ? "End current branch business day"
                    : "Select a branch to end day"
                }
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Power className="w-3.5 h-3.5" />
                End Day
              </button>
            </div>
          </div>

          {periodLoading ? (
            <OverviewPeriodContentSkeleton />
          ) : (
            <>
              {/* Money band: Accounts | Sales+Floor | Inventory */}
              <div className="mb-3 grid gap-3 sm:mb-4 lg:grid-cols-12 lg:items-stretch">
              {/* ─── Accounts hero (main) — sales-report RevenueHero layout ── */}
              <div className="order-1 relative flex h-full overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 lg:col-span-5 lg:row-span-2 lg:row-start-1">
                <div className="flex w-full flex-col justify-between bg-gradient-to-br from-primary/[0.08] via-transparent to-transparent px-4 py-4 sm:px-6 sm:py-5">
                  {!modulesLoaded ||
                  (accountingUnlocked &&
                    plLoading &&
                    periodAccountingPl == null) ? (
                    <div className="space-y-4">
                      <div className="flex justify-between gap-2">
                        <div className="h-8 w-28 animate-pulse rounded bg-gray-100 dark:bg-neutral-800" />
                        <div className="h-8 w-36 animate-pulse rounded-full bg-gray-100 dark:bg-neutral-800" />
                      </div>
                      <div className="h-10 w-48 animate-pulse rounded bg-gray-100 dark:bg-neutral-800" />
                      <div className="h-2.5 w-full animate-pulse rounded-full bg-gray-100 dark:bg-neutral-800" />
                      <div className="h-3 w-64 animate-pulse rounded bg-gray-100 dark:bg-neutral-800" />
                    </div>
                  ) : accountingUnlocked === false ? (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                              Accounts
                            </p>
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/80 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-300">
                              <Crown className="h-3 w-3" />
                              Premium
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500 dark:text-neutral-400">
                            Ledger · revenue vs expenses
                          </p>
                        </div>
                        <Link
                          href="/subscription"
                          className="text-[11px] font-semibold text-primary hover:underline"
                        >
                          Profit and loss statement →
                        </Link>
                      </div>

                      <p className="mt-4 text-[2rem] font-black leading-none tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                        —
                      </p>
                      <p className="mt-1.5 text-xs font-medium text-gray-500 dark:text-neutral-400">
                        Net profit
                      </p>

                      <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-neutral-800" />

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-gray-600 dark:text-neutral-300">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-primary" />
                            Revenue —
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-sky-400" />
                            Expenses —
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-violet-400" />
                            Unpaid —
                          </span>
                        </div>
                        <Link
                          href="/subscription"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-md shadow-amber-500/30 transition hover:-translate-y-0.5"
                        >
                          Unlock
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </>
                  ) : periodAccountingPl != null || plData ? (
                    (() => {
                      const revenue = Math.max(
                        0,
                        periodAccountingPl?.grossRevenue ??
                          plData?.grossRevenue ??
                          viewTotalRevenue ??
                          0,
                      );
                      const expenses = Math.max(
                        0,
                        periodAccountingPl?.totalExpenses ??
                          plData?.totalExpenses ??
                          0,
                      );
                      const net =
                        periodAccountingPl?.netProfit ??
                        plData?.netProfit ??
                        viewTotalProfit ??
                        0;
                      const mixBase = revenue + expenses;
                      const revenueShare =
                        mixBase > 0
                          ? Math.round((revenue / mixBase) * 100)
                          : 0;
                      const expenseShare = Math.max(0, 100 - revenueShare);
                      const marginPct =
                        revenue > 0
                          ? Math.round((net / revenue) * 100)
                          : 0;
                      const plHref =
                        periodAccountingPl != null || plSetup
                          ? "/accounting/reports/profit-loss"
                          : "/accounting";
                      const fmtAmt = (n) =>
                        `${currencySymbol} ${Math.round(n).toLocaleString()}`;
                      return (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                                Accounts
                              </p>
                              <p className="mt-1 text-[11px] text-gray-500 dark:text-neutral-400">
                                {periodAccountingPl != null
                                  ? "Ledger P&L · revenue vs expenses"
                                  : "Estimated from sales"}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-300">
                                Margin {marginPct}% · Unpaid{" "}
                                {fmtAmt(totalUnpaidExposure)}
                              </div>
                              <Link
                                href={plHref}
                                className="text-[11px] font-semibold text-primary hover:underline"
                              >
                                Profit and loss statement →
                              </Link>
                            </div>
                          </div>

                          <p
                            className={`mt-4 text-[2rem] font-black tabular-nums leading-none tracking-tight sm:text-4xl ${
                              net >= 0
                                ? "text-gray-900 dark:text-white"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {net < 0 ? "−" : ""}
                            {fmtAmt(Math.abs(net))}
                          </p>
                          <p className="mt-1.5 text-xs font-medium text-gray-500 dark:text-neutral-400">
                            Net {net >= 0 ? "profit" : "loss"}
                          </p>

                          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-neutral-800">
                            <div className="flex h-full w-full">
                              <div
                                className="h-full bg-primary transition-all duration-700"
                                style={{ width: `${revenueShare}%` }}
                                title="Revenue"
                              />
                              <div
                                className="h-full bg-sky-400 transition-all duration-700"
                                style={{ width: `${expenseShare}%` }}
                                title="Expenses"
                              />
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-gray-600 dark:text-neutral-300">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-primary" />
                              Revenue {fmtAmt(revenue)} ({revenueShare}%)
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-sky-400" />
                              Expenses {fmtAmt(expenses)} ({expenseShare}%)
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-violet-400" />
                              Unpaid {fmtAmt(totalUnpaidExposure)}
                            </span>
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                            Accounts
                          </p>
                          <p className="mt-1 text-[11px] text-gray-500 dark:text-neutral-400">
                            Ledger P&amp;L · cash &amp; payables
                          </p>
                        </div>
                        <Link
                          href="/accounting"
                          className="text-[11px] font-semibold text-primary hover:underline"
                        >
                          Set up Accounts →
                        </Link>
                      </div>
                      <p className="mt-4 text-[2rem] font-black leading-none tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                        —
                      </p>
                      <p className="mt-1.5 text-xs font-medium text-gray-500 dark:text-neutral-400">
                        Net profit
                      </p>
                      <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-neutral-800" />
                      <p className="mt-3 text-[11px] font-medium text-gray-500 dark:text-neutral-400">
                        Finish Accounts setup to see live P&amp;L for this period.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Sales — middle column, top */}
              <Link
                href="/sales-report"
                className="order-3 group flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-primary/35 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-primary/40 lg:col-span-3 lg:col-start-6 lg:row-start-1"
              >
                <div className="flex h-full flex-col justify-between bg-gradient-to-br from-primary/[0.08] via-transparent to-transparent px-4 py-3.5 sm:px-4 sm:py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                        Sales
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-neutral-400">
                        {periodLabel}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary opacity-80 transition group-hover:opacity-100">
                      Details
                      <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-[1.75rem] font-black tabular-nums leading-none tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                      {currencySymbol}{" "}
                      {Math.round(viewTotalRevenue).toLocaleString()}
                    </p>
                    <p className="mt-1.5 text-xs font-medium text-gray-500 dark:text-neutral-400">
                      {viewTotalOrders.toLocaleString()} orders
                      {viewPendingOrders > 0
                        ? ` · ${viewPendingOrders} live`
                        : ""}
                    </p>
                  </div>
                </div>
              </Link>

              {/* Floor — Tables + Reservations — under sales */}
              <div className="order-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950 lg:col-span-3 lg:col-start-6 lg:row-start-2">
                <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-neutral-800">
                  <div className="px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                      Tables
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
                      <span className="text-red-500">{floorSummary.occupied} occ</span>
                      <span className="mx-1 text-gray-300 dark:text-neutral-700">·</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {floorSummary.available} free
                      </span>
                    </p>
                    <Link
                      href="/tables"
                      className="mt-0.5 inline-block text-[10px] font-semibold text-primary hover:underline"
                    >
                      View tables →
                    </Link>
                  </div>
                  <div className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                        Reservations
                      </p>
                      {modulesLoaded && !reservationsUnlocked && (
                        <span className="inline-flex items-center gap-0.5 rounded border border-amber-300/80 bg-amber-50 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-300">
                          <Crown className="h-2.5 w-2.5" />
                          Premium
                        </span>
                      )}
                    </div>
                    {reservationsUnlocked ? (
                      <>
                        <p className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
                          {floorSummary.todayReservations === 0
                            ? "None today"
                            : `${floorSummary.todayReservations} today`}
                        </p>
                        <Link
                          href="/reservations"
                          className="mt-0.5 inline-block text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                        >
                          View →
                        </Link>
                      </>
                    ) : (
                      <>
                        <p className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
                          —
                        </p>
                        <Link
                          href="/subscription"
                          className="mt-0.5 inline-block text-[10px] font-semibold text-amber-600 hover:underline dark:text-amber-400"
                        >
                          Unlock →
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Inventory — desktop right of Sales / Floor */}
              <div className="order-5 flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950 lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1">
                <div className="flex h-full flex-col bg-gradient-to-br from-violet-500/[0.07] via-transparent to-transparent px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                        Inventory Health
                      </h3>
                      {modulesLoaded && !inventoryUnlocked && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/80 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-300">
                          <Crown className="h-3 w-3" />
                          Premium
                        </span>
                      )}
                    </div>
                    {inventoryUnlocked ? (
                      <Link
                        href="/dashboard/inventory"
                        className="text-[11px] font-semibold text-violet-600 hover:underline dark:text-violet-400"
                      >
                        View all →
                      </Link>
                    ) : (
                      <Link
                        href="/subscription"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-md shadow-amber-500/30"
                      >
                        Unlock
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>

                  {!modulesLoaded || (inventoryUnlocked && invLoading) ? (
                    <div className="mt-2.5 grid flex-1 grid-cols-2 gap-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton
                          key={`inv-top-sk-${i}`}
                          className="h-full min-h-[3.25rem] rounded-xl"
                        />
                      ))}
                    </div>
                  ) : !inventoryUnlocked ? (
                    <div className="mt-2.5 grid flex-1 grid-cols-2 gap-2">
                      {["Total", "Healthy", "Low", "Out"].map((label) => (
                        <div
                          key={label}
                          className="flex flex-col items-center justify-center rounded-xl bg-gray-50 px-2 py-2 dark:bg-neutral-900/70"
                        >
                          <p className="text-lg font-black tabular-nums leading-none text-gray-900 dark:text-white">
                            —
                          </p>
                          <p className="mt-1 text-[10px] font-semibold text-gray-500 dark:text-neutral-400">
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : invTotal === 0 ? (
                    <p className="mt-6 flex-1 text-center text-xs text-gray-400 dark:text-neutral-600">
                      No inventory items found
                    </p>
                  ) : (
                    <>
                      <div className="mt-2.5 grid flex-1 grid-cols-2 gap-2">
                        {[
                          {
                            label: "Total",
                            value: invTotal,
                            color: "text-blue-700 dark:text-blue-400",
                            bg: "bg-blue-50 dark:bg-blue-500/10",
                          },
                          {
                            label: "Healthy",
                            value: invHealthy,
                            color: "text-emerald-700 dark:text-emerald-400",
                            bg: "bg-emerald-50 dark:bg-emerald-500/10",
                          },
                          {
                            label: "Low",
                            value: invLow,
                            color: "text-orange-700 dark:text-orange-400",
                            bg: "bg-orange-50 dark:bg-orange-500/10",
                          },
                          {
                            label: "Out",
                            value: invOut,
                            color: "text-red-700 dark:text-red-400",
                            bg: "bg-red-50 dark:bg-red-500/10",
                          },
                        ].map(({ label, value, color, bg }) => (
                          <div
                            key={label}
                            className={`flex flex-col items-center justify-center rounded-xl px-2 py-2 ${bg}`}
                          >
                            <p
                              className={`text-lg font-black tabular-nums leading-none ${color}`}
                            >
                              {value}
                            </p>
                            <p className="mt-1 text-[10px] font-semibold text-gray-500 dark:text-neutral-400">
                              {label}
                            </p>
                          </div>
                        ))}
                      </div>
                      {invNeedAttn.length > 0 && (
                        <div className="mt-2.5 border-t border-gray-100 pt-2 dark:border-neutral-800">
                          <div className="flex flex-wrap gap-1">
                            {invNeedAttn.slice(0, 4).map((item) => {
                              const isOut = (item.currentStock ?? 0) <= 0;
                              return (
                                <span
                                  key={item.id}
                                  className={`inline-flex max-w-[9.5rem] truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                    isOut
                                      ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                                      : "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
                                  }`}
                                >
                                  {item.name}
                                </span>
                              );
                            })}
                            {invNeedAttn.length > 4 && (
                              <span className="self-center text-[10px] text-gray-400">
                                +{invNeedAttn.length - 4}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              </div>

              {/* ─── Second row: Sales Overview + WhatsApp ─────────────── */}
              <div className="mb-3 grid gap-3 sm:mb-4 lg:grid-cols-3 lg:items-stretch">
                <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-neutral-800 sm:px-5">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                        Sales Overview
                      </h3>
                      <p className="mt-0.5 text-[11px] text-gray-400 dark:text-neutral-500">
                        {peakHourAmount > 0
                          ? `Peak ${formatHourLabel12(peakHourIdx)} · ${chartTimeLabel}`
                          : chartTimeLabel}
                      </p>
                      {reportPeriod === "monthly" && (
                        <div className="mt-2 inline-flex rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 p-0.5">
                          <button
                            type="button"
                            onClick={() => setMonthlyChartMode("peaks")}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                              monthlyChartMode === "peaks"
                                ? "bg-white dark:bg-neutral-800 text-primary shadow-sm"
                                : "text-gray-500 dark:text-neutral-400"
                            }`}
                          >
                            Peak Hours
                          </button>
                          <button
                            type="button"
                            onClick={() => setMonthlyChartMode("trend")}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                              monthlyChartMode === "trend"
                                ? "bg-white dark:bg-neutral-800 text-primary shadow-sm"
                                : "text-gray-500 dark:text-neutral-400"
                            }`}
                          >
                            Ups & Downs
                          </button>
                        </div>
                      )}
                      {(reportPeriod !== "monthly" ||
                        monthlyChartMode === "peaks") && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-neutral-700 dark:bg-neutral-900">
                          <select
                            value={chartStartHour}
                            onChange={(e) =>
                              setChartStartHour(Number(e.target.value))
                            }
                            className="h-7 rounded-md border border-gray-200 bg-white px-2 text-[11px] font-semibold text-gray-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                          >
                            {Array.from({ length: 24 }, (_, h) => (
                              <option key={`start-${h}`} value={h}>
                                {formatHourLabel12(h)}
                              </option>
                            ))}
                          </select>
                          <span className="text-[11px] text-gray-400">→</span>
                          <select
                            value={chartEndHour}
                            onChange={(e) =>
                              setChartEndHour(Number(e.target.value))
                            }
                            className="h-7 rounded-md border border-gray-200 bg-white px-2 text-[11px] font-semibold text-gray-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                          >
                            {Array.from({ length: 24 }, (_, h) => (
                              <option key={`end-${h}`} value={h}>
                                {formatHourLabel12(h)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-bold tabular-nums text-gray-900 dark:text-white sm:text-lg">
                        {currencySymbol}{" "}
                        {Math.round(viewTotalRevenue).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500">
                        {viewTotalOrders.toLocaleString()} orders
                      </p>
                    </div>
                  </div>
                  <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
                  {reportPeriod === "monthly" ? (
                    monthlyChartMode === "trend" ? (
                      monthlyHasTrendData ? (
                        <SalesAreaChart
                          period="monthly"
                          dailySales={monthlyDailyTrendSales}
                          hourlySales={null}
                          remainingHoursStart={null}
                          currencySymbol={currencySymbol}
                        />
                      ) : (
                        <div className="h-64 flex items-center justify-center text-sm text-gray-400 dark:text-neutral-600">
                          No daily sales data for selected range
                        </div>
                      )
                    ) : (
                      monthlyHasHourlyData ? (
                        <SalesAreaChart
                          period="today"
                          dailySales={null}
                          hourlySales={monthlyHourlySales12}
                          remainingHoursStart={24}
                          hourBucketSize={2}
                          hourStartHours={monthlyPeakBucketStartHours}
                          currencySymbol={currencySymbol}
                        />
                      ) : (
                        <div className="h-64 flex items-center justify-center text-sm text-gray-400 dark:text-neutral-600">
                          No hourly sales data for selected range
                        </div>
                      )
                    )
                  ) : reportPeriod === "yesterday" ? (
                    yesterdayHourlyWindowSales.some((v) => Number(v) > 0) ? (
                      <SalesAreaChart
                        period="today"
                        dailySales={null}
                        hourlySales={yesterdayHourlyWindowSales}
                        remainingHoursStart={24}
                        hourStartHours={hourWindowHours}
                        currencySymbol={currencySymbol}
                      />
                    ) : (
                      <div className="h-64 flex items-center justify-center text-sm text-gray-400 dark:text-neutral-600">
                        No data for yesterday
                      </div>
                    )
                  ) : (
                    <SalesAreaChart
                      period="today"
                      dailySales={null}
                      hourlySales={dayHourlyWindowSales}
                      remainingHoursStart={remainingHoursStart}
                      hourStartHours={hourWindowHours}
                      currencySymbol={currencySymbol}
                    />
                  )}
                  </div>
                </div>
                <div className="h-full min-h-0">
                  <PremiumModuleCard
                    moduleKey="aiReceptionist"
                    unlocked={whatsappUnlocked}
                  />
                </div>
              </div>

              {/* Payments + Source + Top Selling */}
              <div className="mb-3 grid gap-3 sm:mb-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-stretch">
                {/* Received Payments */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-500 to-blue-600 opacity-80" />
                  <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3 dark:border-neutral-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-md shadow-sky-500/30">
                      <CreditCard className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                        Received Payments
                      </h3>
                      <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                        {periodLabel}
                      </p>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                      {currencySymbol}{" "}
                      {Math.round(totalReceivedAmount).toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-2.5 p-4">
                    {hasOrders ? (
                      <>
                        {receivedRows.map((row) => {
                          const pct =
                            totalReceivedAmount > 0
                              ? Math.round(
                                  (Number(row.amount || 0) /
                                    totalReceivedAmount) *
                                    100,
                                )
                              : 0;
                          return (
                            <div key={row.key}>
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: row.color }}
                                  />
                                  <span className="text-xs text-gray-700 dark:text-neutral-300">
                                    {row.label}
                                  </span>
                                  <span className="text-[10px] text-gray-400">
                                    {Number(row.orders || 0).toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold tabular-nums text-gray-900 dark:text-white">
                                    {currencySymbol}{" "}
                                    {Math.round(
                                      Number(row.amount || 0),
                                    ).toLocaleString()}
                                  </span>
                                  <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-neutral-800 dark:text-neutral-400">
                                    {pct}%
                                  </span>
                                </div>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-neutral-800">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: row.color,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        {paymentAccountRows.length > 0 && (
                          <div className="border-t border-gray-100 pt-2.5 dark:border-neutral-800">
                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                              Online accounts
                            </p>
                            <div className="max-h-24 space-y-1 overflow-auto">
                              {paymentAccountRows.map((row) => (
                                <div
                                  key={row.accountName}
                                  className="flex items-center justify-between gap-2 text-[11px]"
                                >
                                  <span className="truncate text-gray-600 dark:text-neutral-300">
                                    {row.accountName}
                                  </span>
                                  <span className="shrink-0 font-semibold text-gray-900 dark:text-white">
                                    {currencySymbol}{" "}
                                    {Number(row.amount || 0).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="py-4 text-center text-xs text-gray-400">
                        No payment data
                      </p>
                    )}
                  </div>
                </div>

                {/* Upcoming Payments */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-500 to-orange-500 opacity-80" />
                  <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3 dark:border-neutral-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 shadow-md shadow-amber-500/30">
                      <Clock className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                        Upcoming Payments
                      </h3>
                      <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                        Unpaid orders
                      </p>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
                      {currencySymbol}{" "}
                      {Math.round(totalUnpaidExposure).toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1 p-4">
                    {hasOrders ? (
                      <>
                        {(upcomingPayments.rows || []).map((row) => (
                          <div
                            key={row.label}
                            className="flex items-center justify-between border-b border-gray-50 py-1.5 dark:border-neutral-800/80"
                          >
                            <span className="text-[11px] text-gray-600 dark:text-neutral-400">
                              {row.label} · {row.count.toLocaleString()}
                            </span>
                            <p className="text-[11px] font-semibold tabular-nums text-gray-900 dark:text-white">
                              {currencySymbol}{" "}
                              {Math.round(row.amount || 0).toLocaleString()}
                            </p>
                          </div>
                        ))}
                        <div className="flex items-center justify-between border-b border-gray-50 py-1.5 dark:border-neutral-800/80">
                          <span className="text-[11px] text-gray-600 dark:text-neutral-400">
                            Delivered · pending ·{" "}
                            {deliveredUnpaid.count.toLocaleString()}
                          </span>
                          <p className="text-[11px] font-semibold tabular-nums text-gray-900 dark:text-white">
                            {currencySymbol}{" "}
                            {Math.round(
                              deliveredUnpaid.amount || 0,
                            ).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center justify-between border-t border-dashed border-gray-200 pt-2 dark:border-neutral-700">
                          <span className="text-[11px] font-semibold text-gray-700 dark:text-neutral-300">
                            Total unpaid
                          </span>
                          <p className="text-[11px] font-bold tabular-nums text-amber-700 dark:text-amber-400">
                            {currencySymbol}{" "}
                            {Math.round(totalUnpaidExposure).toLocaleString()}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="py-4 text-center text-xs text-gray-400">
                        No upcoming payment data
                      </p>
                    )}
                  </div>
                </div>
                {/* Orders by source */}
                <div className="relative bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-fuchsia-500 to-pink-600 opacity-80" />
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 shadow-md shadow-fuchsia-500/30 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex items-center justify-between w-full flex-1 min-w-0">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                          Orders by source
                        </h3>
                        <p className="text-[11px] text-gray-500 dark:text-neutral-400 hidden sm:block">
                          Completed &amp; paid
                        </p>
                      </div>
                      <h2 className="font-bold text-sm text-gray-900 dark:text-white shrink-0 ml-2">
                        {currencySymbol}{" "}
                        {Math.round(totalSourceChannelRevenue).toLocaleString()}
                      </h2>
                    </div>
                  </div>

                  {hasOrders ? (
                    <div className="space-y-2.5">
                      {sourceChannelRows.map((row) => {
                        const pct =
                          totalSourceChannelRevenue > 0
                            ? Math.round(
                                (Number(row.revenue || 0) /
                                  totalSourceChannelRevenue) *
                                  100,
                              )
                            : 0;
                        return (
                          <div key={row.key}>
                            <div className="flex items-center justify-between mb-1 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: row.color }}
                                />
                                <span className="text-xs text-gray-700 dark:text-neutral-300 truncate">
                                  {row.label}
                                </span>
                                <span className="text-[10px] text-gray-400 dark:text-neutral-500 whitespace-nowrap">
                                  {Number(row.orders || 0).toLocaleString()}{" "}
                                  orders
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums">
                                  {currencySymbol}{" "}
                                  {Math.round(
                                    Number(row.revenue || 0),
                                  ).toLocaleString()}
                                </span>
                                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400">
                                  {pct}%
                                </span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: row.color,
                                }}
                              />
                            </div>
                            <div className="pt-0.5 text-right">
                              <Link
                                href={
                                  row.key === "OTHER"
                                    ? "/dashboard/sales-report?tab=orders"
                                    : `/dashboard/sales-report?tab=orders&source=${row.key}`
                                }
                                className="text-[10px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
                              >
                                List {row.label} orders
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Globe className="w-7 h-7 text-gray-200 dark:text-neutral-700 mb-2" />
                      <p className="text-xs text-gray-400 dark:text-neutral-600">
                        No channel data this period
                      </p>
                    </div>
                  )}
                </div>

                {/* Top Selling Items */}
                <div className="relative bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-orange-500 to-primary opacity-80" />
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-primary shadow-md shadow-orange-500/30 flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                          Top Selling
                        </h3>
                        <p className="text-[10px] text-gray-400 dark:text-neutral-500">
                          {periodLabel}
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/sales-report/#top-selling-items"
                      className="shrink-0 text-[11px] font-semibold text-primary hover:underline"
                    >
                      View All →
                    </Link>
                  </div>
                  {displayTopItems.length > 0 ? (
                    <div className="space-y-1">
                      {displayTopItems.map((item, i) => (
                        <div
                          key={item.label}
                          className={`flex items-center gap-3 px-2.5 py-2 rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-neutral-900 ${i === 0 ? "bg-orange-50/60 dark:bg-orange-500/5" : ""}`}
                        >
                          <span
                            className={`flex-shrink-0 w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center ${
                              i === 0
                                ? "bg-orange-500 text-white"
                                : "bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 dark:text-neutral-200 truncate">
                              {item.label}
                            </p>
                            <div className="h-1 bg-gray-100 dark:bg-neutral-800 rounded-full mt-1 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${displayTopItems[0].value ? (item.value / displayTopItems[0].value) * 100 : 0}%`,
                                  backgroundColor: item.color,
                                }}
                              />
                            </div>
                          </div>
                          <span className="flex-shrink-0 text-xs font-bold text-gray-900 dark:text-white">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <ShoppingBag className="w-7 h-7 text-gray-200 dark:text-neutral-700 mb-2" />
                      <p className="text-xs text-gray-400 dark:text-neutral-600">
                        No sales data yet
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 4th row: Kitchen + Website Analytics + Purchase Orders */}
              <div className="mb-3 grid gap-3 sm:mb-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-stretch">
                <PremiumModuleCard moduleKey="kds" unlocked={kdsUnlocked} />
                <PremiumModuleCard
                  moduleKey="websiteAnalytics"
                  unlocked={websiteAnalyticsUnlocked}
                />

                {/* Purchase Orders report */}
                <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-orange-500 to-amber-500 opacity-80" />
                  <div className="flex items-center gap-2.5 border-b border-gray-100 px-3.5 py-3 dark:border-neutral-800 sm:px-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-md shadow-orange-500/25">
                      <ClipboardList className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                          Purchase Orders
                        </h3>
                        {modulesLoaded && !inventoryUnlocked && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/80 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-300">
                            <Crown className="h-3 w-3" />
                            Premium
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                        Open POs &amp; receiving
                      </p>
                    </div>
                    <Link
                      href={
                        inventoryUnlocked
                          ? "/inventory/purchase-orders"
                          : "/subscription"
                      }
                      className="text-[11px] font-semibold text-orange-600 hover:underline dark:text-orange-400"
                    >
                      {inventoryUnlocked ? "View all →" : "Unlock →"}
                    </Link>
                  </div>
                  <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                    {!modulesLoaded || (inventoryUnlocked && poLoading) ? (
                      <div className="grid flex-1 grid-cols-2 gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton
                            key={`po-sk-${i}`}
                            className="h-14 rounded-xl"
                          />
                        ))}
                      </div>
                    ) : !inventoryUnlocked ? (
                      <div className="grid flex-1 grid-cols-2 gap-2">
                        {["Draft", "Sent", "Partial", "Received"].map(
                          (label) => (
                            <div
                              key={label}
                              className="rounded-xl bg-gray-50 px-2.5 py-2 dark:bg-neutral-900/70"
                            >
                              <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                                {label}
                              </p>
                              <p className="mt-0.5 text-lg font-extrabold tabular-nums leading-none text-gray-900 dark:text-white">
                                —
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            {
                              label: "Draft",
                              value: poKpis.draft,
                              tone: "text-gray-900 dark:text-white",
                              bg: "bg-gray-50 dark:bg-neutral-900/70",
                            },
                            {
                              label: "Sent",
                              value: poKpis.sent,
                              tone: "text-sky-700 dark:text-sky-400",
                              bg: "bg-sky-50 dark:bg-sky-500/10",
                            },
                            {
                              label: "Partial",
                              value: poKpis.partial,
                              tone: "text-amber-700 dark:text-amber-400",
                              bg: "bg-amber-50 dark:bg-amber-500/10",
                            },
                            {
                              label: "Received",
                              value: poKpis.received,
                              tone: "text-emerald-700 dark:text-emerald-400",
                              bg: "bg-emerald-50 dark:bg-emerald-500/10",
                            },
                          ].map(({ label, value, tone, bg }) => (
                            <div
                              key={label}
                              className={`rounded-xl px-2.5 py-2 ${bg}`}
                            >
                              <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                                {label}
                              </p>
                              <p
                                className={`mt-0.5 text-lg font-extrabold tabular-nums leading-none ${tone}`}
                              >
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-gray-600 dark:text-neutral-300">
                          <span>
                            Total{" "}
                            <span className="font-bold text-gray-900 dark:text-white">
                              {poKpis.total}
                            </span>
                          </span>
                          <span>
                            Open value{" "}
                            <span className="font-bold text-gray-900 dark:text-white">
                              {currencySymbol}{" "}
                              {Math.round(poKpis.openValue).toLocaleString()}
                            </span>
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── Locked premium modules — report previews ──────────────── */}
              <PremiumModulesPanel />


            </>
          )}

          {/* ─── Currency | Cleanliness + Staff ───────────────────────────── */}
          <div className="mb-3 grid gap-3 sm:mb-5 lg:grid-cols-2 lg:items-start">
          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-emerald-500 to-teal-600 opacity-80" />
            <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/30 flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                    Currency Counter
                  </h3>
                  <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                    {currencyCode
                      ? `Counting in ${currencyCode} (manual denominations)`
                      : "Manual denomination mode — set your currency in Business Settings"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 p-0.5">
                  {["today", "yesterday"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setCurrencyDate(d)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all capitalize ${currencyDate === d ? "bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-neutral-400"}`}
                    >
                      {d === "today" ? "Today" : "Yesterday"}
                    </button>
                  ))}
                </div>
                {currencyLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                )}
              </div>
            </div>
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {[
                  { key: "note", label: "Cash Notes", icon: Banknote },
                  { key: "coin", label: "Coins", icon: Coins },
                ].map((section) => {
                  const sectionRows = currencyRows.filter(
                    (row) => row.type === section.key,
                  );
                  return (
                    <div
                      key={section.key}
                      className="rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden h-full"
                    >
                      <div className="px-3 py-1.5 bg-gray-50/80 dark:bg-neutral-900/50 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <section.icon className="w-3 h-3 text-gray-500 dark:text-neutral-400" />
                          <p className="text-[11px] font-semibold text-gray-700 dark:text-neutral-300">
                            {section.label}
                          </p>
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-neutral-500">
                          {sectionRows.length} rows
                        </span>
                      </div>
                      <div className="p-2 space-y-1.5">
                        <div className="grid grid-cols-12 gap-2 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                          <div className="col-span-4">Value</div>
                          <div className="col-span-4">Qty</div>
                          <div className="col-span-4 text-right">Total</div>
                        </div>
                        <div className="max-h-52 overflow-auto pr-1 space-y-1">
                          {sectionRows.length === 0 ? (
                            <p className="text-[11px] text-gray-400 dark:text-neutral-500 px-2 py-2">
                              No {section.label.toLowerCase()} configured
                            </p>
                          ) : (
                            sectionRows.map((row, rowIdx) => {
                              const qty = Number(row.qty) || 0;
                              const denom = Number(row.value) || 0;
                              const amount = qty * denom;
                              return (
                                <div
                                  key={row.id}
                                  className="grid grid-cols-12 gap-2 items-center px-2 py-1 rounded-md bg-gray-50/70 dark:bg-neutral-900/35 border border-transparent hover:border-gray-200 dark:hover:border-neutral-700 transition-colors"
                                >
                                  <div className="col-span-4">
                                    {editingDenomId === row.id ? (
                                      <input
                                        autoFocus
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={row.value}
                                        onChange={(e) =>
                                          setCurrencyDenomination(
                                            row.id,
                                            e.target.value,
                                          )
                                        }
                                        onBlur={() => setEditingDenomId(null)}
                                        onKeyDown={(e) => {
                                          if (
                                            e.key === "Enter" ||
                                            e.key === "Escape"
                                          ) {
                                            setEditingDenomId(null);
                                          } else if (e.key === "Tab") {
                                            e.preventDefault();
                                            setEditingDenomId(null);
                                            setTimeout(() => {
                                              document
                                                .getElementById(`qty-${row.id}`)
                                                ?.focus();
                                            }, 0);
                                          }
                                        }}
                                        className="w-full h-7 rounded-md border border-primary/60 bg-white dark:bg-neutral-950 px-2 text-[11px] font-semibold text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        tabIndex={-1}
                                        onClick={() =>
                                          setEditingDenomId(row.id)
                                        }
                                        className="group flex items-center gap-1.5 w-full text-left"
                                      >
                                        <span className="text-[11px] font-semibold text-gray-800 dark:text-white tabular-nums truncate">
                                          {row.value !== "" ? (
                                            row.value
                                          ) : (
                                            <span className="text-gray-400 dark:text-neutral-500 font-normal">
                                              —
                                            </span>
                                          )}
                                        </span>
                                        <Pencil className="w-3 h-3 text-gray-400 dark:text-neutral-500 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="col-span-4">
                                    <input
                                      id={`qty-${row.id}`}
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={row.qty}
                                      onChange={(e) =>
                                        setCurrencyQty(row.id, e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Tab" && !e.shiftKey) {
                                          const nextRow =
                                            sectionRows[rowIdx + 1];
                                          if (nextRow) {
                                            e.preventDefault();
                                            document
                                              .getElementById(
                                                `qty-${nextRow.id}`,
                                              )
                                              ?.focus();
                                          }
                                        }
                                      }}
                                      placeholder="0"
                                      className="w-full h-8 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 text-[11px] font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                  </div>
                                  <div className="col-span-4 text-right">
                                    <p className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums">
                                      {formatMoney(amount)}
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setCurrencyRows((prev) => [
                              ...prev,
                              {
                                id: `${section.key}-${Date.now()}-${prev.length}`,
                                type: section.key,
                                value: "",
                                qty: "",
                              },
                            ])
                          }
                          className="mt-0.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-gray-200 dark:border-neutral-700 text-[10px] font-semibold text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900"
                        >
                          + Add {section.label.slice(0, -1)}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {currencyRows.every((row) => !(Number(row.qty) > 0)) && (
                <div className="rounded-md border border-dashed border-gray-200 dark:border-neutral-800 px-2.5 py-1.5">
                  <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                    Enter quantities to start cash counting.
                  </p>
                </div>
              )}
              <div className="sticky bottom-0 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur px-2.5 py-2 shadow-[0_-6px_14px_rgba(0,0,0,0.04)] dark:shadow-none">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mb-2">
                  <div className="rounded-md bg-gray-50 dark:bg-neutral-900 px-2.5 py-1.5">
                    <p className="text-[10px] text-gray-500 dark:text-neutral-400">
                      Expected cash sales
                    </p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">
                      {expectedCashLoading
                        ? "…"
                        : formatMoney(expectedCashSales)}
                    </p>
                  </div>
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1.5">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      Actual counted
                    </p>
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      {formatMoney(currencyTotal)}
                    </p>
                  </div>
                  <div
                    className={`rounded-md px-2.5 py-1.5 ${currencyDifference === 0 ? "bg-gray-50 dark:bg-neutral-900" : currencyDifference > 0 ? "bg-amber-50 dark:bg-amber-500/10" : "bg-rose-50 dark:bg-rose-500/10"}`}
                  >
                    <p className="text-[10px] text-gray-500 dark:text-neutral-400">
                      Difference
                    </p>
                    <p
                      className={`text-xs font-bold ${currencyDifference === 0 ? "text-gray-900 dark:text-white" : currencyDifference > 0 ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400"}`}
                    >
                      {currencyDifference > 0 ? "+" : ""}
                      {formatMoney(currencyDifference)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={handleSaveCurrency}
                    disabled={!isCurrencyEditable || currencySaving}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-gradient-to-r from-primary to-secondary text-white text-[11px] font-semibold hover:shadow-md hover:shadow-primary/25 disabled:opacity-50 transition-all"
                  >
                    {currencySaving ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save cash count"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDenominationsAsDefault}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dashed border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 text-[11px] font-semibold hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors"
                  >
                    Save layout
                  </button>
                  {canOpenDrawer && (
                    <button
                      type="button"
                      onClick={handleOpenDrawer}
                      disabled={drawerOpening}
                      className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 text-[11px] font-semibold hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors disabled:opacity-60"
                    >
                      {drawerOpening ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wallet className="w-3.5 h-3.5" />
                      )}
                      Open cash drawer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {/* Cleanliness & maintenance report */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-cyan-500 to-sky-600 opacity-80" />
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-neutral-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 shadow-md shadow-cyan-500/30">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                        Cleanliness Report
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/80 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-300">
                        <Crown className="h-3 w-3" />
                        Premium
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                      Hygiene &amp; maintenance
                    </p>
                  </div>
                </div>
                <Link
                  href="/subscription"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-md shadow-amber-500/30"
                >
                  Unlock
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                      Hygiene score
                    </p>
                    <p className="mt-0.5 text-2xl font-black tabular-nums text-gray-900 dark:text-white">
                      —
                    </p>
                  </div>
                  <p className="inline-flex items-center gap-1 pb-1 text-[11px] font-medium text-gray-500 dark:text-neutral-400">
                    <Wrench className="h-3.5 w-3.5" />
                    Last inspection —
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Due today", value: "—" },
                    { label: "Open issues", value: "—" },
                    { label: "Completed", value: "—" },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-xl bg-cyan-50/80 px-2.5 py-2 dark:bg-cyan-500/10"
                    >
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                        {label}
                      </p>
                      <p className="mt-0.5 text-base font-extrabold tabular-nums leading-none text-gray-900 dark:text-white">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-2.5 dark:border-neutral-800">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                    Areas
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Kitchen",
                      "Washrooms",
                      "Dining",
                      "Storage",
                      "Equipment",
                    ].map((area) => (
                      <span
                        key={area}
                        className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        {area}
                        <span className="text-gray-400">—</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Staff KPIs — under cleanliness */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-slate-500 to-slate-700 opacity-80" />
              <div className="flex items-center gap-2.5 border-b border-gray-100 px-3.5 py-3 dark:border-neutral-800 sm:px-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 shadow-md shadow-slate-500/25">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Staff
                  </h3>
                  <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                    Team KPIs
                  </p>
                </div>
                <Link
                  href="/users"
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Manage →
                </Link>
              </div>
              <div className="p-3.5 sm:p-4">
                {staffLoading ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton
                        key={`staff-sk-${i}`}
                        className="h-14 rounded-xl"
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {
                          label: "Total",
                          value: staffKpis.total,
                          tone: "text-gray-900 dark:text-white",
                          bg: "bg-slate-50 dark:bg-neutral-900/70",
                        },
                        {
                          label: "Active today",
                          value: staffKpis.activeToday,
                          tone: "text-emerald-700 dark:text-emerald-400",
                          bg: "bg-emerald-50 dark:bg-emerald-500/10",
                        },
                        {
                          label: "Waiters",
                          value: staffKpis.waiters,
                          tone: "text-teal-700 dark:text-teal-400",
                          bg: "bg-teal-50 dark:bg-teal-500/10",
                        },
                        {
                          label: "Kitchen",
                          value: staffKpis.kitchen,
                          tone: "text-amber-700 dark:text-amber-400",
                          bg: "bg-amber-50 dark:bg-amber-500/10",
                        },
                      ].map(({ label, value, tone, bg }) => (
                        <div
                          key={label}
                          className={`rounded-xl px-2.5 py-2 ${bg}`}
                        >
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                            {label}
                          </p>
                          <p
                            className={`mt-0.5 text-lg font-extrabold tabular-nums leading-none ${tone}`}
                          >
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-gray-600 dark:text-neutral-300">
                      <span>
                        Riders{" "}
                        <span className="font-bold text-gray-900 dark:text-white">
                          {staffKpis.riders}
                        </span>
                      </span>
                      <span>
                        Never logged in{" "}
                        <span
                          className={`font-bold ${
                            staffKpis.neverLoggedIn > 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {staffKpis.neverLoggedIn}
                        </span>
                      </span>
                      {staffKpis.inactive > 0 && (
                        <span>
                          Inactive{" "}
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {staffKpis.inactive}
                          </span>
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          </div>
        </>
      )}

      {/* End Day Confirmation Modal */}
      {showEndDayModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !endingDay)
              setShowEndDayModal(false);
          }}
        >
          <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <Power className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                    End Business Day
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!endingDay) setShowEndDayModal(false);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Session summary */}
            <div className="px-5 py-4">
              {loadingSession ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : currentSession ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-neutral-400">
                    Are you sure you want to end today&apos;s session?
                    Here&apos;s the current summary:
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800">
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase tracking-wide font-semibold mb-0.5">
                        Revenue
                      </p>
                      <p className="text-base font-bold text-gray-900 dark:text-white">
                        {currencySymbol}{" "}
                        {(currentSession.totalSales || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800">
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase tracking-wide font-semibold mb-0.5">
                        Orders
                      </p>
                      <p className="text-base font-bold text-gray-900 dark:text-white">
                        {currentSession.totalOrders || 0}
                      </p>
                    </div>
                  </div>
                  {currentSession.startAt && (
                    <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                      Session started{" "}
                      {new Date(currentSession.startAt).toLocaleString(
                        "en-PK",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        },
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-neutral-400 py-2">
                  Are you sure you want to end the current business day? All
                  open orders will remain, but new orders will start a new
                  session.
                </p>
              )}
            </div>

            {/* Manual end boundary selection */}
            <div className="px-5 pb-3">
              <div className="text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-2">
                End day at
              </div>
              <select
                value={endMode}
                onChange={(e) => setEndMode(e.target.value)}
                disabled={endingDay}
                className="w-full h-9 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs rounded-lg px-3 text-gray-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <option value="cutoff">
                  Cutoff time ({cutoffHour}:00 AM today)
                </option>
                <option value="selectedOrder">Selected order</option>
              </select>

              {endMode === "cutoff" && (
                <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg px-3 py-2">
                  Session will end at {cutoffHour}:00 AM today (
                  {cutoffEndAt.toLocaleDateString("en-PK", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  )
                </p>
              )}

              {endMode === "selectedOrder" && (
                <div className="mt-3">
                  <div className="text-[10px] font-semibold text-gray-600 dark:text-neutral-400 mb-1">
                    Select the order where the day should end
                  </div>
                  {loadingEndOrders ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  ) : endOrderOptions.length === 0 ? (
                    <p className="text-[10px] text-gray-500 dark:text-neutral-400 py-1">
                      No orders found in this session. Falling back to cutoff.
                    </p>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={endOrderSearch}
                        onChange={(e) => {
                          setEndOrderSearch(e.target.value);
                          setShowEndOrderMenu(true);
                          setSelectedOrderId(null);
                        }}
                        onFocus={() => setShowEndOrderMenu(true)}
                        disabled={endingDay}
                        placeholder="Search order number..."
                        className="w-full h-9 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs rounded-lg px-3 text-gray-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                      {showEndOrderMenu && (
                        <div className="absolute z-20 mt-1 w-full max-h-40 overflow-auto rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg">
                          {endOrderOptions
                            .filter((o) => {
                              const dt = o?.createdAt
                                ? new Date(o.createdAt).toLocaleString(
                                    "en-PK",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: true,
                                    },
                                  )
                                : "";
                              const label =
                                `${(o.orderNumber || o.id || "").toString()} ${dt}`.toLowerCase();
                              return label.includes(
                                (endOrderSearch || "").toLowerCase(),
                              );
                            })
                            .map((o) => {
                              const dt = o?.createdAt
                                ? new Date(o.createdAt).toLocaleString(
                                    "en-PK",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: true,
                                    },
                                  )
                                : "";
                              const label = `${(o.orderNumber || o.id || "").toString()} · ${dt}`;
                              return (
                                <button
                                  key={o.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedOrderId(o.id);
                                    setEndOrderSearch(label);
                                    setShowEndOrderMenu(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800"
                                >
                                  {label}
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-gray-500 dark:text-neutral-400 mt-1">
                    This affects <b>manual</b> closing only. Orders after the
                    selected time will be moved to a new OPEN session so today
                    counts correctly.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5 px-5 pb-5">
              <button
                type="button"
                onClick={() => {
                  if (!endingDay) setShowEndDayModal(false);
                }}
                disabled={endingDay}
                className="flex-1 h-9 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndDay}
                disabled={
                  endingDay || (endMode === "selectedOrder" && !selectedOrderId)
                }
                className="flex-1 h-9 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {endingDay ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Power className="w-3.5 h-3.5" />
                )}
                {endingDay ? "Ending…" : "End Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
