import { useEffect, useState, useMemo } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getSalesReport,
  getDiscountReport,
  getOrders,
  getDaySessions,
  getDaySessionOrders,
  reassignOrdersToSession,
  getDailyCurrency,
  getRestaurantSettings,
  SubscriptionInactiveError,
  getCurrencySymbol,
} from "../../lib/apiClient";
import { useBranch } from "../../contexts/BranchContext";
import {
  BarChart3,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  HelpCircle,
  Loader2,
  Award,
  FileDown,
  Printer,
  ClipboardList,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  FileText,
  Calendar,
  Bike,
  Headset,
  CalendarDays,
  RefreshCw,
  X,
  Banknote,
  CreditCard,
  Package,
  Clock,
  Eye,
  Layers,
  Percent,
} from "lucide-react";
import toast from "react-hot-toast";

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "all", label: "All Time" },
  { id: "custom", label: "Custom" },
];

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "orders", label: "Orders List", icon: ClipboardList },
  { id: "discounts", label: "Discounts", icon: Percent },
  { id: "sessions", label: "Business Day Report", icon: CalendarDays },
];

const DISCOUNT_REASON_LABELS = {
  customer_complaint: "Customer complaint",
  staff_meal: "Staff meal",
  loyalty_reward: "Loyalty reward",
  manager_approval: "Manager approval",
  other: "Other",
  "(no reason recorded)": "(No reason recorded)",
};

function formatDiscountReasonLabel(key) {
  const k = String(key || "").trim();
  return DISCOUNT_REASON_LABELS[k] || k;
}

const FILTER_ALL = "ALL";

const STATUS_FILTERS = {
  ALL: "ALL",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

const TYPE_FILTERS = {
  ALL: "ALL",
  DINE_IN: "DINE_IN",
  DELIVERY: "DELIVERY",
  TAKEAWAY: "TAKEAWAY",
};
const TYPE_API_MAP = {
  [TYPE_FILTERS.DINE_IN]: "dine-in",
  [TYPE_FILTERS.DELIVERY]: "delivery",
  [TYPE_FILTERS.TAKEAWAY]: "takeaway",
};
const TYPE_LABEL_MAP = {
  "dine-in": "Dine-in",
  delivery: "Delivery",
  takeaway: "Takeaway",
};

const PAID_FILTERS = { ALL: "ALL", PAID: "PAID", UNPAID: "UNPAID" };

const STATUS_LABELS = {
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NEW_ORDER: "New",
  PROCESSING: "Processing",
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for Delivery",
};
const STATUS_COLORS = {
  DELIVERED:
    "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  COMPLETED:
    "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  CANCELLED: "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400",
  NEW_ORDER: "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
  PROCESSING:
    "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
  READY:
    "bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400",
  OUT_FOR_DELIVERY:
    "bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

const CURRENCY_SYMBOLS = {
  PKR: "Rs",
  USD: "$",
  EUR: "€",
  INR: "₹",
  GBP: "£",
};

/** Match dashboard/overview.js — same rules as backend `isOrderPaid` */
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

function isOrderPaidForReport(order) {
  if (!order) return false;
  if (typeof order.isPaid === "boolean") return order.isPaid;
  if (order.source === "FOODPANDA") return true;
  if (
    order.paymentAmountReceived != null &&
    Number(order.paymentAmountReceived) > 0
  )
    return true;
  const pm = String(order?.paymentMethod || "").toUpperCase();
  if (pm === "CASH" || pm === "CARD" || pm === "ONLINE" || pm === "FOODPANDA")
    return true;
  if (pm === "TO BE PAID" || pm.includes("TO BE PAID")) return false;
  if (isDeliveryOrderForPayment(order) && order?.deliveryPaymentCollected === true)
    return true;
  return false;
}

const UNPAID_PIPELINE_STATUSES = [
  "NEW_ORDER",
  "PROCESSING",
  "READY",
  "OUT_FOR_DELIVERY",
];

/** Split unpaid amounts so session report matches dashboard semantics */
function getSessionUnpaidBreakdown(sessionOrders) {
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
    unpaid,
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

const ORDER_TYPE_CARD_COLORS = {
  "Dine In":
    "border-orange-200 dark:border-orange-500/30 bg-orange-50/60 dark:bg-orange-500/10 hover:border-orange-400 dark:hover:border-orange-500/50",
  Delivery:
    "border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/10 hover:border-blue-400 dark:hover:border-blue-500/50",
  Takeaway:
    "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/10 hover:border-emerald-400 dark:hover:border-emerald-500/50",
};
const ORDER_TYPE_FILTER_MAP = {
  "Dine In": TYPE_FILTERS.DINE_IN,
  Delivery: TYPE_FILTERS.DELIVERY,
  Takeaway: TYPE_FILTERS.TAKEAWAY,
};

const TH_CLS =
  "py-2.5 px-3 text-left font-semibold text-gray-500 dark:text-neutral-400 whitespace-nowrap";
const TD_CLS =
  "py-2.5 px-3 text-gray-600 dark:text-neutral-400 whitespace-nowrap";

function selectCls(active) {
  return `h-8 px-2.5 pr-7 rounded-lg text-[11px] font-semibold appearance-none cursor-pointer outline-none transition-all border hover:border-primary/40 ${
    active
      ? "bg-primary/10 dark:bg-primary/20 text-primary border-primary/30 dark:border-primary/40"
      : "bg-gray-50 dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-700"
  }`;
}

function FilterSelect({ value, onChange, active, children, small }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className={`${selectCls(active)}${small ? " !h-7 !text-[10px] !px-2 !pr-6" : ""}`}
      >
        {children}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${small ? "w-3 h-3" : "w-3.5 h-3.5"} ${active ? "text-primary" : "text-gray-400 dark:text-neutral-500"}`}
      />
    </div>
  );
}

const DEFAULT_REPORT = {
  totalRevenue: 0,
  totalOrders: 0,
  topItems: [],
  paymentRows: [],
  paymentAccountRows: [],
  orderTypeRows: [],
  tableBreakdown: [],
  cancelledSummary: { count: 0, amount: 0, orders: [] },
  typeDetails: {},
  reservationSummary: {
    total: 0,
    totalGuests: 0,
    byStatus: {},
    reservations: [],
  },
  completedSummary: { count: 0, amount: 0, orders: [] },
};

// Calendar-based fallback dates (used when no session data is available)
function getCalendarDates(preset) {
  const today = new Date();
  switch (preset) {
    case "today": {
      const s = new Date(today);
      s.setHours(0, 0, 0, 0);
      const e = new Date(today);
      e.setDate(e.getDate() + 1);
      e.setHours(0, 0, 0, 0);
      return { from: s.toISOString(), to: e.toISOString() };
    }
    case "yesterday": {
      const s = new Date(today);
      s.setDate(s.getDate() - 1);
      s.setHours(0, 0, 0, 0);
      const e = new Date(s);
      e.setHours(23, 59, 59, 999);
      return { from: s.toISOString(), to: e.toISOString() };
    }
    case "this_week": {
      const dow = today.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      const e = new Date(today);
      e.setDate(e.getDate() + 1);
      e.setHours(0, 0, 0, 0);
      return { from: monday.toISOString(), to: e.toISOString() };
    }
    case "this_month": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      first.setHours(0, 0, 0, 0);
      const e = new Date(today);
      e.setDate(e.getDate() + 1);
      e.setHours(0, 0, 0, 0);
      return { from: first.toISOString(), to: e.toISOString() };
    }
    case "last_month": {
      const firstThis = new Date(today.getFullYear(), today.getMonth(), 1);
      firstThis.setHours(0, 0, 0, 0);
      const firstLast = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      firstLast.setHours(0, 0, 0, 0);
      return { from: firstLast.toISOString(), to: firstThis.toISOString() };
    }
    case "all": {
      const ALL_TIME_START = new Date(2020, 0, 1);
      ALL_TIME_START.setHours(0, 0, 0, 0);
      const e = new Date(today);
      e.setDate(e.getDate() + 1);
      e.setHours(0, 0, 0, 0);
      return { from: ALL_TIME_START.toISOString(), to: e.toISOString() };
    }
    default:
      return null;
  }
}

/**
 * Build the query params for the sales report.
 *
 * For "today": if there is exactly ONE session today (the open one), scope by
 * daySessionId so the report aligns with the Business Day Report.
 * If there are MULTIPLE sessions today (e.g. a session was closed mid-day and a
 * new one opened), we must NOT restrict to just the open session — that would
 * silently drop all orders from the earlier closed session. Fall back to the
 * smart date-range in that case so the backend returns all of today's orders.
 */
function getSalesReportQuery(preset, sessions) {
  if (preset === "today" && sessions && sessions.length > 0) {
    const open = sessions.find((s) => s.status === "OPEN");
    if (open?.id) {
      // Count how many sessions started on the same calendar day as the open session
      const openDate = open.startAt ? new Date(open.startAt).toDateString() : null;
      const todaySessions = openDate
        ? sessions.filter((s) => s.startAt && new Date(s.startAt).toDateString() === openDate)
        : [open];
      // Only session-scope when it is the sole session for today to avoid gaps
      if (todaySessions.length === 1) return { daySessionId: open.id };
    }
  }
  return getSmartDates(preset, sessions);
}

// Session-aware date resolver: uses actual session start/end times for Today and Yesterday
// so that reports match the business day rather than calendar midnight boundaries.
function getSmartDates(preset, sessions) {
  const now = new Date();
  if (sessions && sessions.length > 0) {
    if (preset === "today") {
      const openSess = sessions.find((s) => s.status === "OPEN");
      if (openSess?.startAt) {
        // Find ALL sessions from the same calendar day as the open session.
        // Using the earliest start ensures orders from a previously-closed session
        // earlier that day are not silently excluded.
        const openDateStr = new Date(openSess.startAt).toDateString();
        const todaySessions = sessions.filter(
          (s) => s.startAt && new Date(s.startAt).toDateString() === openDateStr,
        );
        const earliestStartMs = todaySessions.reduce(
          (min, s) => Math.min(min, new Date(s.startAt).getTime()),
          new Date(openSess.startAt).getTime(),
        );
        // Subtract a 10-minute buffer to capture orders whose createdAt is right at
        // (or marginally before) the session startAt — this happens when the session
        // was auto-created during the very first order request of the day.
        const fromMs = earliestStartMs - 10 * 60 * 1000;
        return { from: new Date(fromMs).toISOString(), to: now.toISOString() };
      }
      // No open session — fall back to most recent session that started today (local time)
      const todayStr = now.toDateString();
      const todaySess = sessions.find(
        (s) => new Date(s.startAt).toDateString() === todayStr,
      );
      if (todaySess?.startAt)
        return {
          from: todaySess.startAt,
          to: todaySess.endAt || now.toISOString(),
        };
    }
    if (preset === "yesterday") {
      // The most recently CLOSED session = the previous business day
      const lastClosed = sessions.find((s) => s.status === "CLOSED");
      if (lastClosed?.startAt && lastClosed?.endAt)
        return { from: lastClosed.startAt, to: lastClosed.endAt };
    }
  }
  return getCalendarDates(preset);
}

// Keep old name as alias so any remaining callers still work
const getPresetDates = getCalendarDates;

function toCSVRow(cells) {
  return cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",");
}

function downloadCSV(filename, rows) {
  const content = rows.map(toCSVRow).join("\n");
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildPeriodLabel(preset, customFrom, customTo) {
  if (preset === "custom") {
    if (customFrom && customTo)
      return `${new Date(customFrom).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} — ${new Date(customTo).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    if (customFrom)
      return `From ${new Date(customFrom).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    if (customTo)
      return `Up to ${new Date(customTo).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    return "Custom range";
  }
  return PRESETS.find((p) => p.id === preset)?.label || "All Time";
}

function fmtRs(v) {
  return `${getCurrencySymbol()} ${Math.round(Number(v) || 0).toLocaleString()}`;
}
function fmtDate(d) {
  return new Date(d).toLocaleString("en-PK", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
function fmtDuration(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end) - new Date(start);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtShortDate(d) {
  return new Date(d).toLocaleDateString("en-PK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
function fmtTime(d) {
  return d
    ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";
}
function getStatusTime(order, status) {
  const entry = (order.statusHistory || []).find((h) => h.status === status);
  return entry?.at || null;
}

function isCompletedSaleOrder(order) {
  const s = String(order?.status || "").toUpperCase();
  return s === "DELIVERED" || s === "COMPLETED";
}

function orderGrandTotalForReport(order) {
  return Number(order?.grandTotal ?? order?.total) || 0;
}

function orderDeliveryFeeAmount(order) {
  return Number(order?.deliveryCharges) || 0;
}

function Skeleton({ className = "" }) {
  return (
    <div
      className={`bg-gray-200 dark:bg-neutral-800 animate-pulse rounded-lg ${className}`}
    />
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  gradient,
  shadow,
  compact = false,
}) {
  return (
    <div
      className={`group relative bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 transition-all overflow-hidden ${
        compact
          ? "rounded-xl p-3 hover:shadow-md"
          : "rounded-2xl p-5 hover:shadow-xl"
      }`}
    >
      <div className="relative flex items-start justify-between">
        <div>
          <p
            className={`font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider ${
              compact ? "text-[10px] mb-1.5" : "text-xs mb-3"
            }`}
          >
            {label}
          </p>
          <p
            className={`font-extrabold text-gray-900 dark:text-white ${
              compact ? "text-[18px] leading-tight" : "text-2xl"
            }`}
          >
            {value}
          </p>
          {sub && (
            <p
              className={`text-gray-400 dark:text-neutral-500 ${
                compact ? "text-[10px] mt-0.5" : "text-xs mt-1"
              }`}
            >
              {sub}
            </p>
          )}
        </div>
        <div
          className={`bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg ${shadow} flex-shrink-0 ${
            compact ? "h-9 w-9 rounded-xl" : "h-11 w-11 rounded-2xl"
          }`}
        >
          <Icon className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-white`} />
        </div>
      </div>
    </div>
  );
}

function SalesReportScreenSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/90 shadow-sm p-1.5 w-[460px] max-w-full">
          <div className="flex items-center gap-1">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-36 rounded-xl" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      <div className="space-y-5 max-w-7xl mx-auto">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`kpi-sk-${i}`}
              className="rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-11 w-11 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SectionSkeleton bodyHeightClass="h-24" />
          <SectionSkeleton bodyHeightClass="h-24" />
        </div>

        {Array.from({ length: 4 }).map((_, i) => (
          <SectionSkeleton key={`section-sk-${i}`} bodyHeightClass="h-28" />
        ))}
      </div>
    </div>
  );
}

function SectionSkeleton({ bodyHeightClass = "h-24" }) {
  return (
    <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-lg" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
      </div>
      <div className="border-t border-gray-100 dark:border-neutral-800 p-5">
        <Skeleton className={`w-full ${bodyHeightClass}`} />
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon: Icon,
  iconGradient,
  badge,
  badgeValue,
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          {Icon && (
            <div
              className={`h-9 w-9 rounded-xl flex items-center justify-center shadow-md ${iconGradient || "bg-gray-200 dark:bg-neutral-800"}`}
            >
              <Icon className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="text-left">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-neutral-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg">
              {badge}
            </span>
          )}
          {badgeValue && (
            <span className="text-xs font-bold text-primary bg-primary/10 dark:bg-primary/20 px-2.5 py-1 rounded-lg">
              {badgeValue}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100 dark:border-neutral-800">
          {children}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, message, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-3">
        <Icon className="w-8 h-8 text-gray-300 dark:text-neutral-700" />
      </div>
      <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400">
        {message}
      </p>
      {sub && (
        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
          {sub}
        </p>
      )}
    </div>
  );
}

function TopItemsList({ items, title, subtitle, onItemClick }) {
  if (!items || items.length === 0)
    return (
      <EmptyState
        icon={Award}
        message="No item data"
        sub="Try a different period"
      />
    );
  const topRevenue = items[0]?.revenue || 1;
  const totalRevenue = items.reduce((s, i) => s + (i.revenue || 0), 0) || 1;
  const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
  return (
    <Section
      title={title || "Top Selling Items"}
      subtitle={subtitle}
      icon={Award}
      iconGradient="bg-gradient-to-br from-primary to-secondary shadow-primary/25"
      badge={`${items.length} items`}
    >
      <div className="divide-y divide-gray-100 dark:divide-neutral-800">
        {items.map((item, index) => {
          const barPct = Math.round((item.revenue / topRevenue) * 100);
          const sharePct = Math.round((item.revenue / totalRevenue) * 100);
          return (
            <button
              key={item.name + index}
              type="button"
              onClick={() => onItemClick?.(item.name)}
              className="w-full text-left px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-neutral-900/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-7 text-center flex-shrink-0">
                  {index < 3 ? (
                    <span className="text-lg leading-none">
                      {medals[index]}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-gray-400 dark:text-neutral-500">
                      #{index + 1}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-2 py-0.5 rounded-md whitespace-nowrap">
                        <ShoppingBag className="w-3 h-3" />
                        {item.quantity} sold
                      </span>
                      <span className="text-xs text-gray-400 dark:text-neutral-500 font-medium hidden sm:block">
                        {sharePct}% share
                      </span>
                      <span className="text-sm font-bold text-primary min-w-[72px] text-right">
                        {fmtRs(item.revenue)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-700"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

export default function HistoryPage() {
  const { currentBranch } = useBranch() || {};

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [preset, setPreset] = useState("today");
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [ordersExportColumns, setOrdersExportColumns] = useState([
    "orderNumber",
    "status",
    "grandTotal",
    "type",
    "payment",
    "paid",
    "customer",
    "created",
  ]);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [report, setReport] = useState(DEFAULT_REPORT);
  const [suspended, setSuspended] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [sessions, setSessions] = useState([]);

  // Sessions tab state
  const [sessionsList, setSessionsList] = useState([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionsPage, setSessionsPage] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  /** "single" = one session; "day" = ?dayScope=all merged same-calendar-day sessions */
  const [sessionDetailScope, setSessionDetailScope] = useState("single");
  const [sessionDetail, setSessionDetail] = useState(null);
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false);
  const [selectedSessionOrderIds, setSelectedSessionOrderIds] = useState([]);
  const [moveTargetSessionId, setMoveTargetSessionId] = useState("");
  const [movingOrders, setMovingOrders] = useState(false);
  const [sessionOrderSearch, setSessionOrderSearch] = useState("");
  const [sessionOrderStatusFilter, setSessionOrderStatusFilter] = useState("");
  const [sessionOrderTypeFilter, setSessionOrderTypeFilter] = useState("");
  const [sessionOrderPositionFilter, setSessionOrderPositionFilter] =
    useState("all");
  const [settingsCurrencyCode, setSettingsCurrencyCode] = useState("PKR");
  const [sessionCurrency, setSessionCurrency] = useState({});
  const [sessionCurrencyLoading, setSessionCurrencyLoading] = useState(false);
  const [showExportColumns, setShowExportColumns] = useState(false);
  const [exportColumns, setExportColumns] = useState([
    "orderNumber",
    "time",
    "type",
    "status",
    "customer",
    "staff",
    "total",
    "payment",
  ]);
  const SESSIONS_PER_PAGE = 20;
  const [sessionsViewMode, setSessionsViewMode] = useState("daily"); // "daily" | "sessions"
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [sessionsDateFrom, setSessionsDateFrom] = useState("");
  const [sessionsDateTo, setSessionsDateTo] = useState("");
  const [sessionsDatePreset, setSessionsDatePreset] = useState("all");
  const [showSessionsDateDropdown, setShowSessionsDateDropdown] = useState(false);

  const [discountReport, setDiscountReport] = useState(null);
  const [discountReportLoading, setDiscountReportLoading] = useState(false);

  // Orders tab state
  const [allOrders, setAllOrders] = useState([]);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState(FILTER_ALL);
  const [ordersTypeFilter, setOrdersTypeFilter] = useState(FILTER_ALL);
  const [ordersPaymentFilter, setOrdersPaymentFilter] = useState(FILTER_ALL);
  const [ordersSourceFilter, setOrdersSourceFilter] = useState(FILTER_ALL);
  const [ordersPaidFilter, setOrdersPaidFilter] = useState(FILTER_ALL);
  const [ordersRiderFilter, setOrdersRiderFilter] = useState(FILTER_ALL);
  const [ordersWaiterFilter, setOrdersWaiterFilter] = useState(FILTER_ALL);
  const [ordersCashierFilter, setOrdersCashierFilter] = useState(FILTER_ALL);
  const [ordersAdminFilter, setOrdersAdminFilter] = useState(FILTER_ALL);
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersPage, setOrdersPage] = useState(0);
  const [itemsDropdownId, setItemsDropdownId] = useState(null);
  const [paymentDropdownId, setPaymentDropdownId] = useState(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);
  const [ordersPerPage, setOrdersPerPage] = useState(25);
  const ORDER_EXPORT_COLUMN_OPTIONS = [
    { key: "orderNumber", label: "Order #" },
    { key: "status", label: "Status" },
    { key: "subtotal", label: "Subtotal" },
    { key: "deliveryCharges", label: "Delivery Fee" },
    { key: "discount", label: "Discount" },
    { key: "grandTotal", label: "Grand Total" },
    { key: "items", label: "Items" },
    { key: "type", label: "Type" },
    { key: "payment", label: "Payment" },
    { key: "paid", label: "Paid" },
    { key: "customer", label: "Customer" },
    { key: "phone", label: "Phone" },
    { key: "table", label: "Table" },
    { key: "source", label: "Source" },
    { key: "orderTaker", label: "Order Taker" },
    { key: "rider", label: "Rider" },
    { key: "deliveryAddress", label: "Delivery Address" },
    { key: "cancelReason", label: "Cancel Reason" },
    { key: "created", label: "Created" },
    { key: "preparing", label: "Preparing" },
    { key: "ready", label: "Ready" },
    { key: "outForDelivery", label: "Out for Delivery" },
    { key: "closed", label: "Closed / Cancelled" },
  ];

  function orderExportValueByKey(o, key) {
    switch (key) {
      case "orderNumber":
        return o.id;
      case "status":
        return o.status;
      case "grandTotal":
        return Math.round(o.grandTotal ?? o.total ?? 0);
      case "subtotal":
        return Math.round(o.subtotal ?? 0);
      case "discount":
        return Math.round(o.discountAmount ?? 0);
      case "items":
        return (o.items || []).map((i) => `${i.name} x${i.qty}`).join(", ");
      case "type":
        return o.type;
      case "payment":
        return o.paymentMethod || "";
      case "paid":
        return o.isPaid ? "Paid" : "Unpaid";
      case "customer":
        return o.customerName || "";
      case "phone":
        return o.customerPhone || "";
      case "table":
        return o.tableName || "";
      case "source":
        return o.source || "";
      case "orderTaker":
        return o.orderTakerName || "";
      case "rider":
        return o.assignedRiderName || "";
      case "deliveryAddress":
        return o.deliveryAddress || "";
      case "deliveryCharges":
        return o.deliveryCharges > 0 ? Math.round(o.deliveryCharges) : "";
      case "cancelReason":
        return o.cancelReason || "";
      case "created":
        return o.createdAt ? new Date(o.createdAt).toLocaleString() : "";
      case "preparing":
        return fmtTime(getStatusTime(o, "PROCESSING"));
      case "ready":
        return fmtTime(getStatusTime(o, "READY"));
      case "outForDelivery":
        return fmtTime(getStatusTime(o, "OUT_FOR_DELIVERY"));
      case "closed":
        return o.status === "CANCELLED"
          ? fmtTime(o.cancelledAt || getStatusTime(o, "CANCELLED"))
          : fmtTime(getStatusTime(o, "DELIVERED") || o.updatedAt);
      default:
        return "";
    }
  }

  async function loadReport(input) {
    try {
      const data = await getSalesReport(input);
      setReport(
        Object.fromEntries(
          Object.entries(DEFAULT_REPORT).map(([key, fallback]) => [
            key,
            data[key] ?? fallback,
          ]),
        ),
      );
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) setSuspended(true);
      else toast.error(err.message || "Failed to load sales report");
    } finally {
      setPageLoading(false);
      setLoading(false);
    }
  }

  async function loadOrders(dates) {
    setOrdersLoading(true);
    try {
      const params = { limit: 2000 };
      if (dates?.from) params.from = dates.from;
      if (dates?.to) params.to = dates.to;

      const data = await getOrders(params);

      if (data && typeof data === "object" && Array.isArray(data.orders)) {
        let all = data.orders;
        let pg = 1;
        while (all.length < data.total && pg < 20) {
          pg += 1;
          const next = await getOrders({ ...params, page: pg });
          if (!next?.orders?.length) break;
          all = all.concat(next.orders);
        }
        setAllOrders(all);
      } else {
        setAllOrders(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setAllOrders([]);
      console.error("Failed to load orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      // Load sessions first so we can use OPEN day session (same scope as Business Day Report)
      let loadedSessions = [];
      try {
        const res = await getDaySessions(currentBranch?.id, { limit: 30 });
        loadedSessions = Array.isArray(res?.sessions) ? res.sessions : [];
        setSessions(loadedSessions);
      } catch {
        // Falls back to calendar dates
      }
      const q = getSalesReportQuery(preset, loadedSessions);
      loadReport(q);
      loadOrders(q);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBranch?.id, preset]);

  function applyPreset(id) {
    setPreset(id);
    if (id === "custom") return;
    const q = getSalesReportQuery(id, sessions);
    setLoading(true);
    setOrdersPage(0);
    loadReport(q);
    loadOrders(q);
  }

  function applyCustom(e) {
    e.preventDefault();
    setLoading(true);
    setOrdersPage(0);
    const from = customFrom
      ? new Date(customFrom + "T00:00:00").toISOString()
      : "";
    const to = customTo
      ? new Date(customTo + "T23:59:59.999").toISOString()
      : "";
    loadReport({ from, to });
    loadOrders({ from, to });
  }

  useEffect(() => {
    if (activeTab !== "discounts") return;
    let cancelled = false;
    async function run() {
      setDiscountReportLoading(true);
      try {
        let params;
        if (preset === "custom") {
          params = {
            from: customFrom
              ? new Date(customFrom + "T00:00:00").toISOString()
              : "",
            to: customTo
              ? new Date(customTo + "T23:59:59.999").toISOString()
              : "",
          };
        } else {
          const q = getSalesReportQuery(preset, sessions);
          params =
            q.daySessionId != null
              ? { daySessionId: q.daySessionId }
              : { from: q.from || "", to: q.to || "" };
        }
        const data = await getDiscountReport(params);
        if (!cancelled) setDiscountReport(data);
      } catch (err) {
        if (!cancelled) {
          setDiscountReport(null);
          toast.error(err.message || "Failed to load discount report");
        }
      } finally {
        if (!cancelled) setDiscountReportLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeTab, preset, customFrom, customTo, sessions, currentBranch?.id]);

  async function loadSessions(pageNum = 0, fromDate, toDate) {
    setSessionsLoading(true);
    const from = fromDate !== undefined ? fromDate : sessionsDateFrom;
    const to = toDate !== undefined ? toDate : sessionsDateTo;
    try {
      const res = await getDaySessions(currentBranch?.id, {
        limit: SESSIONS_PER_PAGE,
        offset: pageNum * SESSIONS_PER_PAGE,
        ...(from ? { from: new Date(from + "T00:00:00").toISOString() } : {}),
        ...(to ? { to: new Date(to + "T23:59:59.999").toISOString() } : {}),
      });
      setSessionsList(Array.isArray(res?.sessions) ? res.sessions : []);
      setSessionsTotal(res?.total || 0);
    } catch {
      toast.error("Failed to load sessions");
    } finally {
      setSessionsLoading(false);
    }
  }

  async function openSessionDetail(session, opts = {}) {
    setSelectedSession(session);
    setSessionDetailScope(opts.dayScope === "all" ? "day" : "single");
    setSessionDetail(null);
    setSelectedSessionOrderIds([]);
    setMoveTargetSessionId("");
    setSessionOrderSearch("");
    setSessionOrderStatusFilter("");
    setSessionOrderTypeFilter("");
    setSessionOrderPositionFilter("all");
    setShowExportColumns(false);
    setSessionCurrency({});
    setSessionDetailLoading(true);
    try {
      const res = await getDaySessionOrders(session.id, opts);
      setSessionDetail(res);
    } catch {
      toast.error("Failed to load session orders");
    } finally {
      setSessionDetailLoading(false);
    }
  }

  /** Combined report: all sessions on the same calendar day (uses any session as anchor). */
  function openFullDayCombinedReport(day) {
    const sessions = day?.sessions || [];
    if (sessions.length === 0) return;
    if (sessions.length === 1) {
      openSessionDetail(sessions[0]);
      return;
    }
    const rep =
      sessions.find((s) => s.status === "OPEN") || sessions[0];
    openSessionDetail(rep, { dayScope: "all" });
  }

  useEffect(() => {
    getRestaurantSettings()
      .then((s) => {
        const code = String(s?.currencyCode || "PKR").toUpperCase();
        setSettingsCurrencyCode(code || "PKR");
      })
      .catch(() => setSettingsCurrencyCode("PKR"));
  }, []);

  useEffect(() => {
    if (!selectedSession?.startAt) return;
    const d = new Date(selectedSession.startAt);
    if (Number.isNaN(d.getTime())) return;
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setSessionCurrencyLoading(true);
    getDailyCurrency(date)
      .then((res) => {
        setSessionCurrency(
          res?.quantities && typeof res.quantities === "object"
            ? res.quantities
            : {},
        );
      })
      .catch(() => setSessionCurrency({}))
      .finally(() => setSessionCurrencyLoading(false));
  }, [selectedSession?.id, selectedSession?.startAt]);

  function resetFilters() {
    setOrdersStatusFilter(FILTER_ALL);
    setOrdersTypeFilter(FILTER_ALL);
    setOrdersPaymentFilter(FILTER_ALL);
    setOrdersSourceFilter(FILTER_ALL);
    setOrdersPaidFilter(FILTER_ALL);
    setOrdersRiderFilter(FILTER_ALL);
    setOrdersWaiterFilter(FILTER_ALL);
    setOrdersCashierFilter(FILTER_ALL);
    setOrdersAdminFilter(FILTER_ALL);
    setOrdersSearch("");
    setOrdersPage(0);
  }

  function goToOrders({
    type,
    payment,
    search,
    rider,
    waiter,
    cashier,
    admin,
  } = {}) {
    resetFilters();
    if (type) setOrdersTypeFilter(type);
    if (payment) setOrdersPaymentFilter(payment);
    if (search) setOrdersSearch(search);
    if (rider) {
      setOrdersTypeFilter(TYPE_FILTERS.DELIVERY);
      setOrdersRiderFilter(rider);
    }
    if (waiter) setOrdersWaiterFilter(waiter);
    if (cashier) setOrdersCashierFilter(cashier);
    if (admin) setOrdersAdminFilter(admin);
    setActiveTab("orders");
  }

  const periodLabel = buildPeriodLabel(preset, customFrom, customTo);

  const activeDateRange = useMemo(() => {
    if (preset === "custom") {
      return {
        from: customFrom ? new Date(customFrom + "T00:00:00") : null,
        to: customTo ? new Date(customTo + "T23:59:59.999") : null,
      };
    }
    // Today with OPEN session: include orders from ALL sessions that started today,
    // not just the current open session — so a prior closed session's orders are visible.
    if (preset === "today" && sessions?.length) {
      const open = sessions.find((s) => s.status === "OPEN");
      if (open?.startAt) {
        const openDateStr = new Date(open.startAt).toDateString();
        const todaySessions = sessions.filter(
          (s) => s.startAt && new Date(s.startAt).toDateString() === openDateStr,
        );
        const earliestStartMs = todaySessions.reduce(
          (min, s) => Math.min(min, new Date(s.startAt).getTime()),
          new Date(open.startAt).getTime(),
        );
        return {
          from: new Date(earliestStartMs - 10 * 60 * 1000),
          to: new Date(),
        };
      }
    }
    const d = getSmartDates(preset, sessions);
    return {
      from: d?.from ? new Date(d.from) : null,
      to: d?.to ? new Date(d.to) : null,
    };
  }, [preset, customFrom, customTo, sessions]);

  const dateFilteredOrders = useMemo(() => {
    const { from, to } = activeDateRange;
    return allOrders.filter((o) => {
      const t = new Date(o.createdAt);
      if (from && t < from) return false;
      if (to && t > to) return false;
      return true;
    });
  }, [allOrders, activeDateRange]);

  /** Split grand total into menu sales vs delivery fees (matches rider portal breakdown). */
  const revenueBreakdown = useMemo(() => {
    const completed = dateFilteredOrders.filter(isCompletedSaleOrder);
    let salesAmount = 0;
    let deliveryFees = 0;
    for (const o of completed) {
      const gt = orderGrandTotalForReport(o);
      const dc = orderDeliveryFeeAmount(o);
      deliveryFees += dc;
      salesAmount += Math.max(0, gt - dc);
    }
    const grandTotal = salesAmount + deliveryFees;
    return {
      orderCount: completed.length,
      salesAmount,
      deliveryFees,
      grandTotal,
    };
  }, [dateFilteredOrders]);

  const avgTicket = revenueBreakdown.orderCount
    ? Math.round(revenueBreakdown.grandTotal / revenueBreakdown.orderCount)
    : report.totalOrders
      ? Math.round(report.totalRevenue / report.totalOrders)
      : 0;

  // All active filters applied — used by both the table UI and CSV/print export
  const ordersFiltered = useMemo(() => {
    let filtered = dateFilteredOrders;

    if (ordersStatusFilter === STATUS_FILTERS.COMPLETED)
      filtered = filtered.filter((o) => o.status !== STATUS_FILTERS.CANCELLED);
    else if (ordersStatusFilter === STATUS_FILTERS.CANCELLED)
      filtered = filtered.filter((o) => o.status === STATUS_FILTERS.CANCELLED);

    if (ordersTypeFilter !== FILTER_ALL) {
      filtered = filtered.filter(
        (o) =>
          o.type ===
          (TYPE_API_MAP[ordersTypeFilter] || ordersTypeFilter.toLowerCase()),
      );
    }

    if (ordersPaymentFilter !== FILTER_ALL) {
      filtered = filtered.filter(
        (o) =>
          (o.paymentMethod || "").toLowerCase() ===
          ordersPaymentFilter.toLowerCase(),
      );
    }

    if (ordersSourceFilter !== FILTER_ALL) {
      filtered = filtered.filter(
        (o) => (o.source || "").toUpperCase() === ordersSourceFilter,
      );
    }

    if (ordersPaidFilter !== FILTER_ALL) {
      filtered = filtered.filter((o) =>
        ordersPaidFilter === PAID_FILTERS.PAID ? o.isPaid : !o.isPaid,
      );
    }

    if (ordersRiderFilter !== FILTER_ALL) {
      filtered = filtered.filter(
        (o) => (o.assignedRiderName || "") === ordersRiderFilter,
      );
    }

    if (ordersWaiterFilter !== FILTER_ALL) {
      filtered = filtered.filter(
        (o) =>
          (o.orderTakerName || "") === ordersWaiterFilter &&
          o.createdByRole === "order_taker",
      );
    }

    if (ordersCashierFilter !== FILTER_ALL) {
      filtered = filtered.filter(
        (o) =>
          (o.orderTakerName || "") === ordersCashierFilter &&
          o.createdByRole === "cashier",
      );
    }

    if (ordersAdminFilter !== FILTER_ALL) {
      filtered = filtered.filter(
        (o) =>
          (o.orderTakerName || "") === ordersAdminFilter &&
          ["restaurant_admin", "admin", "super_admin"].includes(
            o.createdByRole,
          ),
      );
    }

    if (ordersSearch.trim()) {
      const q = ordersSearch.trim().toLowerCase();
      filtered = filtered.filter(
        (o) =>
          (o.id || "").toString().toLowerCase().includes(q) ||
          (o.customerName || "").toLowerCase().includes(q) ||
          (o.tableName || "").toLowerCase().includes(q) ||
          (o.customerPhone || "").includes(q) ||
          (o.assignedRiderName || "").toLowerCase().includes(q) ||
          (o.items || []).some((item) =>
            (item.name || "").toLowerCase().includes(q),
          ),
      );
    }

    return filtered;
  }, [
    dateFilteredOrders,
    ordersStatusFilter,
    ordersTypeFilter,
    ordersPaymentFilter,
    ordersSourceFilter,
    ordersPaidFilter,
    ordersRiderFilter,
    ordersWaiterFilter,
    ordersCashierFilter,
    ordersAdminFilter,
    ordersSearch,
  ]);

  const dateFilteredOrdersCount = dateFilteredOrders.length;

  const paymentRows = (report.paymentRows || []).filter(
    (r) => r && r.method && r.method !== "Total",
  );
  const paymentAccountRows = report.paymentAccountRows || [];
  const orderTypeRows = report.orderTypeRows || [];

  const paymentTotals = useMemo(
    () =>
      paymentRows.reduce((acc, row) => {
        const key = (row.method || "").toUpperCase();
        if (!key) return acc;
        if (!acc[key]) acc[key] = { amount: 0, orders: 0 };
        acc[key].amount += Number(row.amount || 0);
        acc[key].orders += Number(row.orders || 0);
        return acc;
      }, {}),
    [paymentRows],
  );

  const riderStats = useMemo(() => {
    const map = {};
    for (const o of dateFilteredOrders) {
      const type = String(o.type || "").toLowerCase();
      if (type !== "delivery" || !o.assignedRiderName) continue;
      const name = o.assignedRiderName;
      if (!map[name])
        map[name] = {
          name,
          deliveries: 0,
          revenue: 0,
          salesRevenue: 0,
          deliveryFees: 0,
          paidDeliveries: 0,
          unpaidDeliveries: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          cancelled: 0,
        };
      if (o.status === "CANCELLED") {
        map[name].cancelled += 1;
        continue;
      }
      const amount = Math.round(Number(o.grandTotal ?? o.total) || 0);
      const dc = Math.round(Number(o.deliveryCharges) || 0);
      const salesPart = Math.max(0, amount - dc);

      // Paid/Unpaid delivery orders (must match Orders tab filters).
      if (o.isPaid) {
        map[name].paidDeliveries += 1;
        map[name].paidAmount += amount;
      } else {
        map[name].unpaidDeliveries += 1;
        map[name].unpaidAmount += amount;
      }

      // Count delivery only once it is actually completed.
      if (o.status === "DELIVERED" || o.status === "COMPLETED") {
        map[name].deliveries += 1;
        map[name].revenue += amount;
        map[name].salesRevenue += salesPart;
        map[name].deliveryFees += dc;
      }
    }
    return Object.values(map).sort((a, b) => b.deliveries - a.deliveries);
  }, [dateFilteredOrders]);

  const waiterStats = useMemo(() => {
    const map = {};
    for (const o of dateFilteredOrders) {
      const name = o.orderTakerName;
      if (!name || o.createdByRole !== "order_taker") continue;
      // Prevent overlap with Riders Overview:
      // Order taker overview should focus on non-delivery orders only.
      if (o.type === "delivery") continue;
      if (!map[name]) map[name] = { name, orders: 0, revenue: 0, cancelled: 0 };

      if (o.status === "CANCELLED") {
        map[name].cancelled += 1;
        continue;
      }

      // Count revenue/orders only once the order is actually closed.
      if (o.status === "DELIVERED" || o.status === "COMPLETED") {
        map[name].orders += 1;
        map[name].revenue += Math.round(Number(o.grandTotal ?? o.total) || 0);
      }
    }
    return Object.values(map).sort((a, b) => b.orders - a.orders);
  }, [dateFilteredOrders]);

  const cashierStats = useMemo(() => {
    const map = {};
    for (const o of dateFilteredOrders) {
      const name = o.orderTakerName;
      if (!name || o.createdByRole !== "cashier") continue;
      // Prevent overlap with Riders Overview:
      // Cashier overview should focus on non-delivery orders only.
      if (o.type === "delivery") continue;
      if (!map[name]) map[name] = { name, orders: 0, revenue: 0, cancelled: 0 };

      if (o.status === "CANCELLED") {
        map[name].cancelled += 1;
        continue;
      }

      // Count revenue/orders only once the order is actually closed.
      if (o.status === "DELIVERED" || o.status === "COMPLETED") {
        map[name].orders += 1;
        map[name].revenue += Math.round(Number(o.grandTotal ?? o.total) || 0);
      }
    }
    return Object.values(map).sort((a, b) => b.orders - a.orders);
  }, [dateFilteredOrders]);

  const adminStats = useMemo(() => {
    const map = {};
    for (const o of dateFilteredOrders) {
      const name = o.orderTakerName;
      const isAdminCreator = [
        "restaurant_admin",
        "admin",
        "super_admin",
      ].includes(o.createdByRole);
      if (!name || !isAdminCreator) continue;
      // Prevent overlap with Riders Overview:
      // Admin overview should focus on non-delivery orders only.
      if (o.type === "delivery") continue;
      if (!map[name]) map[name] = { name, orders: 0, revenue: 0, cancelled: 0 };

      if (o.status === "CANCELLED") {
        map[name].cancelled += 1;
        continue;
      }

      // Count revenue/orders only once the order is actually closed.
      if (o.status === "DELIVERED" || o.status === "COMPLETED") {
        map[name].orders += 1;
        map[name].revenue += Math.round(Number(o.grandTotal ?? o.total) || 0);
      }
    }
    return Object.values(map).sort((a, b) => b.orders - a.orders);
  }, [dateFilteredOrders]);

  // Export CSV for current tab
  function handleExportCSV() {
    if (activeTab === "discounts" && !discountReport) {
      toast.error("Discount report is still loading");
      return;
    }
    const activeFilters = [
      ordersStatusFilter !== FILTER_ALL ? `Status: ${ordersStatusFilter}` : null,
      ordersTypeFilter !== FILTER_ALL ? `Type: ${ordersTypeFilter}` : null,
      ordersPaymentFilter !== FILTER_ALL ? `Payment: ${ordersPaymentFilter}` : null,
      ordersSourceFilter !== FILTER_ALL ? `Source: ${ordersSourceFilter}` : null,
      ordersPaidFilter !== FILTER_ALL ? `Paid: ${ordersPaidFilter}` : null,
      ordersRiderFilter !== FILTER_ALL ? `Rider: ${ordersRiderFilter}` : null,
      ordersWaiterFilter !== FILTER_ALL ? `Waiter: ${ordersWaiterFilter}` : null,
      ordersCashierFilter !== FILTER_ALL ? `Cashier: ${ordersCashierFilter}` : null,
      ordersAdminFilter !== FILTER_ALL ? `Admin: ${ordersAdminFilter}` : null,
      ordersSearch.trim() ? `Search: ${ordersSearch.trim()}` : null,
    ].filter(Boolean);

    const rows = [
      ["Eats Desk Reports — " + TABS.find((t) => t.id === activeTab)?.label],
      ["Period", periodLabel],
      ...(activeFilters.length > 0 ? [["Filters", activeFilters.join(", ")]] : []),
      ["Generated", new Date().toLocaleString("en-PK")],
      [],
    ];
    if (activeTab === "overview") {
      rows.push(
        ["SUMMARY"],
        ["Metric", "Value"],
        ["Total Revenue", fmtRs(revenueBreakdown.grandTotal)],
        ["Sales (items)", fmtRs(revenueBreakdown.salesAmount)],
        ["Delivery Fees", fmtRs(revenueBreakdown.deliveryFees)],
        ["Total Orders", revenueBreakdown.orderCount],
        ["Avg Ticket Size", fmtRs(avgTicket)],
        [],
        ...(paymentRows.length > 0
          ? [
              ["PAYMENT WISE SALES"],
              ["Method", "Orders", "Amount", "%"],
              ...paymentRows.map((r) => [
                r.method,
                r.orders,
                r.amount,
                r.percent,
              ]),
            ]
          : []),
        [],
        ["TOP SELLING ITEMS"],
        ["Rank", "Item", "Qty", "Revenue"],
        ...report.topItems.map((item, i) => [
          i + 1,
          item.name,
          item.quantity ?? 0,
          Math.round(item.revenue || 0),
        ]),
      );
    } else if (activeTab === "discounts" && discountReport) {
      rows.push(
        ["DISCOUNT SUMMARY"],
        ["Total discount amount", discountReport.totalDiscount],
        ["Orders with discount", discountReport.orderCount],
        [],
        ["BY REASON"],
        ["Reason", "Orders", "Total"],
        ...(discountReport.byReason || []).map((r) => [
          formatDiscountReasonLabel(r.reason),
          r.count,
          r.total,
        ]),
        [],
        ["BY STAFF"],
        ["Staff", "Orders", "Total"],
        ...(discountReport.byStaff || []).map((r) => [
          r.name || r.staffId,
          r.count,
          r.total,
        ]),
        [],
        ["BY DAY"],
        ["Day", "Orders", "Total"],
        ...(discountReport.byDay || []).map((r) => [
          r.day,
          r.count,
          r.total,
        ]),
      );
    } else if (activeTab === "orders") {
      const selectedCols = ordersExportColumns.length
        ? ordersExportColumns
        : ORDER_EXPORT_COLUMN_OPTIONS.map((c) => c.key);
      const headers = selectedCols.map(
        (k) => ORDER_EXPORT_COLUMN_OPTIONS.find((c) => c.key === k)?.label || k,
      );
      rows.push(
        ["ALL ORDERS"],
        headers,
        ...ordersFiltered.map((o) =>
          selectedCols.map((k) => orderExportValueByKey(o, k)),
        ),
      );
    }
    downloadCSV(
      `report-${activeTab}-${periodLabel.replace(/[\s/]/g, "-")}.csv`,
      rows,
    );
    toast.success("CSV exported");
  }

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Pop-up blocked");
      return;
    }
    const generated = new Date().toLocaleString("en-PK");
    const tabLabel = TABS.find((t) => t.id === activeTab)?.label || "Report";
    const escHtml = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    let bodyContent = `<div class="kpis">
      <div class="kpi"><div class="kpi-label">Sales (items)</div><div class="kpi-value">${fmtRs(revenueBreakdown.salesAmount)}</div></div>
      <div class="kpi"><div class="kpi-label">Delivery fees</div><div class="kpi-value">${fmtRs(revenueBreakdown.deliveryFees)}</div></div>
      <div class="kpi"><div class="kpi-label">Total revenue</div><div class="kpi-value">${fmtRs(revenueBreakdown.grandTotal)}</div></div>
      <div class="kpi"><div class="kpi-label">Orders</div><div class="kpi-value">${revenueBreakdown.orderCount}</div></div>
      <div class="kpi"><div class="kpi-label">Avg Ticket</div><div class="kpi-value">${fmtRs(avgTicket)}</div></div>
    </div>`;
    if (activeTab === "discounts") {
      if (!discountReport) {
        bodyContent =
          "<p>Discount data is not loaded yet. Close print and try again.</p>";
      } else {
      const rRows = (discountReport.byReason || [])
        .map(
          (r) =>
            `<tr><td>${escHtml(formatDiscountReasonLabel(r.reason))}</td><td>${r.count}</td><td>${fmtRs(r.total)}</td></tr>`,
        )
        .join("");
      const sRows = (discountReport.byStaff || [])
        .map(
          (r) =>
            `<tr><td>${escHtml(r.name || r.staffId)}</td><td>${r.count}</td><td>${fmtRs(r.total)}</td></tr>`,
        )
        .join("");
      const dRows = (discountReport.byDay || [])
        .map(
          (r) =>
            `<tr><td>${escHtml(r.day)}</td><td>${r.count}</td><td>${fmtRs(r.total)}</td></tr>`,
        )
        .join("");
      bodyContent = `<h2>Discounts</h2><p><strong>Total:</strong> ${fmtRs(discountReport.totalDiscount)} &nbsp;|&nbsp; <strong>Orders:</strong> ${discountReport.orderCount}</p>
        <h3>By reason</h3><table class="t"><thead><tr><th>Reason</th><th>Orders</th><th>Total</th></tr></thead><tbody>${rRows}</tbody></table>
        <h3>By staff</h3><table class="t"><thead><tr><th>Staff</th><th>Orders</th><th>Total</th></tr></thead><tbody>${sRows}</tbody></table>
        <h3>By day</h3><table class="t"><thead><tr><th>Day</th><th>Orders</th><th>Total</th></tr></thead><tbody>${dRows}</tbody></table>`;
      }
    } else if (activeTab === "orders") {
      const selectedCols = ordersExportColumns.length
        ? ordersExportColumns
        : ORDER_EXPORT_COLUMN_OPTIONS.map((c) => c.key);
      const headers = selectedCols.map(
        (k) => ORDER_EXPORT_COLUMN_OPTIONS.find((c) => c.key === k)?.label || k,
      );
      bodyContent =
        `<h2>Orders (${ordersFiltered.length})</h2><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>` +
        ordersFiltered
          .map((o) => {
            const cols = selectedCols
              .map(
                (k) => `<td>${String(orderExportValueByKey(o, k) ?? "")}</td>`,
              )
              .join("");
            return `<tr>${cols}</tr>`;
          })
          .join("") +
        `</tbody></table>`;
    } else if (report.topItems.length > 0) {
      bodyContent +=
        `<h2>Top Selling Items</h2><table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Revenue</th></tr></thead><tbody>` +
        report.topItems
          .map(
            (item, i) =>
              `<tr><td>${i + 1}</td><td>${item.name}</td><td>${item.quantity ?? 0}</td><td>${fmtRs(item.revenue)}</td></tr>`,
          )
          .join("") +
        `</tbody></table>`;
    }
    win.document
      .write(`<!DOCTYPE html><html><head><title>${tabLabel} — ${periodLabel}</title>
    <style>body{font-family:system-ui,sans-serif;padding:40px;color:#111;max-width:1000px;margin:0 auto}h1{font-size:22px;font-weight:800;margin-bottom:4px}.meta{font-size:12px;color:#6b7280;margin-bottom:28px}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:28px}.kpi{border:1px solid #e5e7eb;border-radius:12px;padding:14px}.kpi-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:4px}.kpi-value{font-size:20px;font-weight:800;color:#111}h2{font-size:14px;font-weight:700;margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid #e5e7eb}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;padding:8px 12px;border-bottom:2px solid #e5e7eb}td{padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:13px}@media print{body{padding:0}}</style></head><body>
    <h1>Eats Desk — ${tabLabel}</h1>
    <p class="meta">Period: <strong>${periodLabel}</strong> · Generated: ${generated}</p>
    ${bodyContent}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }

  // ── Tab renderers ────────────────────────────────────────────────────────

  function renderOverview() {
    if (loading) {
      return (
        <div className="space-y-5 max-w-7xl mx-auto">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={`overview-kpi-sk-${i}`}
                className="rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-11 w-11 rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SectionSkeleton bodyHeightClass="h-24" />
            <SectionSkeleton bodyHeightClass="h-24" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <SectionSkeleton key={`overview-section-sk-${i}`} bodyHeightClass="h-28" />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-5 max-w-7xl mx-auto">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Sales (items)"
            value={fmtRs(revenueBreakdown.salesAmount)}
            sub="Menu & food, excl. delivery"
            icon={ShoppingBag}
            gradient="from-violet-500 to-violet-600"
            shadow="shadow-violet-500/30"
          />
          <KpiCard
            label="Delivery fees"
            value={fmtRs(revenueBreakdown.deliveryFees)}
            sub="Rider / delivery charges"
            icon={Bike}
            gradient="from-sky-500 to-blue-600"
            shadow="shadow-sky-500/30"
          />
          <KpiCard
            label="Total revenue"
            value={fmtRs(revenueBreakdown.grandTotal)}
            sub="Sales + delivery fees"
            icon={DollarSign}
            gradient="from-primary to-secondary"
            shadow="shadow-primary/30"
          />
          <KpiCard
            label="Total orders"
            value={revenueBreakdown.orderCount.toLocaleString()}
            sub="completed & delivered"
            icon={Package}
            gradient="from-amber-500 to-orange-600"
            shadow="shadow-amber-500/30"
          />
          <KpiCard
            label="Avg. ticket"
            value={fmtRs(avgTicket)}
            sub="revenue per order"
            icon={TrendingUp}
            gradient="from-emerald-500 to-emerald-600"
            shadow="shadow-emerald-500/30"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Section
            title="Payment Summary"
            subtitle="How customers paid in this period"
            icon={DollarSign}
            iconGradient="bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/25"
            defaultOpen
          >
            <div className="p-5 grid gap-3 sm:grid-cols-3">
              {["CASH", "CARD", "ONLINE"].map((method) => {
                const d = paymentTotals[method] || { amount: 0, orders: 0 };
                const label =
                  method === "CASH"
                    ? "Cash"
                    : method === "CARD"
                      ? "Card"
                      : "Online";
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => goToOrders({ payment: label })}
                    className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-900/60 px-3 py-3 text-left cursor-pointer transition-all hover:border-primary/40 hover:shadow-sm"
                  >
                    <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      {label}
                    </p>
                    <p className="mt-1 text-lg font-extrabold text-gray-900 dark:text-white">
                      {fmtRs(d.amount)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400 dark:text-neutral-500">
                      {d.orders.toLocaleString()} orders
                    </p>
                  </button>
                );
              })}
            </div>
          </Section>
          <Section
            title="Online Payment Accounts"
            subtitle="Breakdown by JazzCash, bank, etc."
            icon={DollarSign}
            iconGradient="bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/25"
            defaultOpen
          >
            <div className="p-5">
              {paymentAccountRows.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400 dark:text-neutral-500">
                  No online payments in this period.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-neutral-800 text-xs">
                  {paymentAccountRows.map((row) => (
                    <div
                      key={row.accountName}
                      className="flex items-center justify-between py-2.5"
                    >
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {row.accountName}
                      </p>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">
                          {fmtRs(row.amount)}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                          {row.orders} orders
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        </div>
        {/* Order Type Breakdown */}
        {orderTypeRows.length > 0 && (
          <Section
            title="Order Type Breakdown"
            subtitle={`${orderTypeRows.length} types`}
            icon={ShoppingBag}
            iconGradient="bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/25"
          >
            <div className="p-5 grid gap-3 sm:grid-cols-3">
              {orderTypeRows.map((row) => (
                <button
                  key={row.type}
                  type="button"
                  onClick={() =>
                    goToOrders({
                      type: ORDER_TYPE_FILTER_MAP[row.type] || FILTER_ALL,
                    })
                  }
                  className={`rounded-xl border px-4 py-3 text-left cursor-pointer transition-all ${ORDER_TYPE_CARD_COLORS[row.type] || "border-gray-200 dark:border-neutral-800 bg-gray-50/60 hover:border-gray-400"}`}
                >
                  <p className="text-xs font-semibold text-gray-600 dark:text-neutral-300">
                    {row.type}
                  </p>
                  <p className="text-lg font-extrabold text-gray-900 dark:text-white mt-1">
                    {fmtRs(row.amount)}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                    {row.orders} orders · {row.percent}
                  </p>
                </button>
              ))}
            </div>
          </Section>
        )}
        <TopItemsList
          items={report.topItems}
          title="Top Selling Items"
          subtitle="Best performers in selected period"
          onItemClick={(itemName) => goToOrders({ search: itemName })}
        />

        {/* Riders Overview */}
        {ordersLoading ? (
          <SectionSkeleton bodyHeightClass="h-32" />
        ) : riderStats.length > 0 && (
          <Section
            title="Riders Overview"
            subtitle="Delivery performance in selected period"
            icon={Bike}
            iconGradient="bg-gradient-to-br from-sky-500 to-blue-600 shadow-sky-500/25"
            badge={`${riderStats.length} rider${riderStats.length !== 1 ? "s" : ""} · ${riderStats.reduce((s, r) => s + r.deliveries, 0)} orders`}
            badgeValue={fmtRs(
              riderStats.reduce((s, r) => s + Number(r.revenue || 0), 0),
            )}
            defaultOpen
          >
            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
              {riderStats.map((rider, idx) => {
                const topDeliveries = riderStats[0]?.deliveries || 1;
                const barPct = Math.round(
                  (rider.deliveries / topDeliveries) * 100,
                );
                return (
                  <button
                    key={rider.name}
                    type="button"
                    onClick={() => goToOrders({ rider: rider.name })}
                    className="w-full text-left px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-neutral-900/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                          {rider.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2 mb-1.5">
                          <div className="min-w-0">
                            <span className="font-semibold text-sm text-gray-900 dark:text-white truncate block">
                              {rider.name}
                            </span>
                            <p className="text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mt-0.5 tabular-nums">
                              Items {fmtRs(rider.salesRevenue)} · Delivery{" "}
                              {fmtRs(rider.deliveryFees)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end flex-shrink-0">
                            <span className="inline-flex items-center gap-1 font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 px-1.5 py-0.5 rounded-md leading-tight text-[10px] sm:text-[11px]">
                              Paid: {fmtRs(rider.paidAmount)} · {rider.paidDeliveries} del.
                            </span>
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-md leading-tight text-[10px] sm:text-[11px]">
                              Unpaid: {fmtRs(rider.unpaidAmount)} · {rider.unpaidDeliveries}
                            </span>
                            {rider.cancelled > 0 && (
                              <span className="text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded">
                                {rider.cancelled} cancelled
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-700"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* Order Takers Overview */}
        {ordersLoading ? (
          <SectionSkeleton bodyHeightClass="h-32" />
        ) : waiterStats.length > 0 && (
          <Section
            title="Order Takers Overview"
            subtitle="Order taker performance in selected period"
            icon={Headset}
            iconGradient="bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/25"
            badge={`${waiterStats.length} order taker${waiterStats.length !== 1 ? "s" : ""} · ${waiterStats.reduce((s, w) => s + w.orders, 0)} orders`}
            badgeValue={fmtRs(waiterStats.reduce((s, w) => s + w.revenue, 0))}
          >
            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
              {waiterStats.map((waiter, idx) => {
                const topOrders = waiterStats[0]?.orders || 1;
                const barPct = Math.round((waiter.orders / topOrders) * 100);
                return (
                  <button
                    key={waiter.name}
                    type="button"
                    onClick={() => goToOrders({ waiter: waiter.name })}
                    className="w-full text-left px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-neutral-900/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                          {waiter.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {waiter.name}
                          </span>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-2 py-0.5 rounded-md whitespace-nowrap">
                              <Headset className="w-3 h-3" />
                              {waiter.orders} orders
                            </span>
                            {waiter.cancelled > 0 && (
                              <span className="text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded">
                                {waiter.cancelled} cancelled
                              </span>
                            )}
                            <span className="text-sm font-bold text-primary min-w-[72px] text-right">
                              {fmtRs(waiter.revenue)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500 transition-all duration-700"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* Cashiers Overview */}
        {ordersLoading ? (
          <SectionSkeleton bodyHeightClass="h-32" />
        ) : cashierStats.length > 0 && (
          <Section
            title="Cashiers Overview"
            subtitle="Cashier performance in selected period"
            icon={Headset}
            iconGradient="bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/25"
            badge={`${cashierStats.length} cashier${cashierStats.length !== 1 ? "s" : ""} · ${cashierStats.reduce((s, c) => s + c.orders, 0)} orders`}
            badgeValue={fmtRs(cashierStats.reduce((s, c) => s + c.revenue, 0))}
          >
            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
              {cashierStats.map((cashier) => {
                const topOrders = cashierStats[0]?.orders || 1;
                const barPct = Math.round((cashier.orders / topOrders) * 100);
                return (
                  <button
                    key={cashier.name}
                    type="button"
                    onClick={() => goToOrders({ cashier: cashier.name })}
                    className="w-full text-left px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-neutral-900/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                          {cashier.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {cashier.name}
                          </span>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-md whitespace-nowrap">
                              <Headset className="w-3 h-3" />
                              {cashier.orders} orders
                            </span>
                            {cashier.cancelled > 0 && (
                              <span className="text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded">
                                {cashier.cancelled} cancelled
                              </span>
                            )}
                            <span className="text-sm font-bold text-primary min-w-[72px] text-right">
                              {fmtRs(cashier.revenue)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* Admins Overview */}
        {ordersLoading ? (
          <SectionSkeleton bodyHeightClass="h-32" />
        ) : adminStats.length > 0 && (
          <Section
            title="Admins Overview"
            subtitle="Admin performance in selected period"
            icon={Headset}
            iconGradient="bg-gradient-to-br from-red-500 to-rose-600 shadow-rose-500/25"
            badge={`${adminStats.length} admin${adminStats.length !== 1 ? "s" : ""} · ${adminStats.reduce((s, a) => s + a.orders, 0)} orders`}
            badgeValue={fmtRs(adminStats.reduce((s, a) => s + a.revenue, 0))}
          >
            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
              {adminStats.map((admin) => {
                const topOrders = adminStats[0]?.orders || 1;
                const barPct = Math.round((admin.orders / topOrders) * 100);
                return (
                  <button
                    key={admin.name}
                    type="button"
                    onClick={() => goToOrders({ admin: admin.name })}
                    className="w-full text-left px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-neutral-900/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-red-700 dark:text-rose-300">
                          {admin.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {admin.name}
                          </span>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-rose-300 bg-red-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-md whitespace-nowrap">
                              <Headset className="w-3 h-3" />
                              {admin.orders} orders
                            </span>
                            {admin.cancelled > 0 && (
                              <span className="text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded">
                                {admin.cancelled} cancelled
                              </span>
                            )}
                            <span className="text-sm font-bold text-primary min-w-[72px] text-right">
                              {fmtRs(admin.revenue)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-red-400 to-rose-500 transition-all duration-700"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    );
  }

  function renderPaymentCell(order, rowId) {
    if (!order?.paymentMethod) return "—";
    const isSplit = String(order.paymentMethod || "").toUpperCase() === "SPLIT";
    return (
      <div className="flex items-center">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            order.isPaid
              ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
          }`}
        >
          {order.isPaid ? order.paymentMethod : "Unpaid"}
        </span>
        {isSplit && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPaymentDropdownId(paymentDropdownId === rowId ? null : rowId);
              }}
              className="ml-1.5 inline-flex items-center justify-center h-5 w-5 rounded-md bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  paymentDropdownId === rowId ? "rotate-180" : ""
                }`}
              />
            </button>
            {paymentDropdownId === rowId && (
              <div className="absolute top-0 right-0 mt-8 mr-3 z-10 min-w-[180px] bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl p-2 space-y-1">
                {(Number(order.splitCashAmount) || 0) > 0 && (
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-gray-700 dark:text-neutral-300">Cash</span>
                    <span className="font-bold text-gray-700 dark:text-neutral-300 flex-shrink-0">
                      {fmtRs(Number(order.splitCashAmount) || 0)}
                    </span>
                  </div>
                )}
                {(Number(order.splitCardAmount) || 0) > 0 && (
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-gray-700 dark:text-neutral-300">Card</span>
                    <span className="font-bold text-gray-700 dark:text-neutral-300 flex-shrink-0">
                      {fmtRs(Number(order.splitCardAmount) || 0)}
                    </span>
                  </div>
                )}
                {(Number(order.splitOnlineAmount) || 0) > 0 && (
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-gray-700 dark:text-neutral-300">
                      Online{order.splitOnlineProvider ? ` (${order.splitOnlineProvider})` : ""}
                    </span>
                    <span className="font-bold text-gray-700 dark:text-neutral-300 flex-shrink-0">
                      {fmtRs(Number(order.splitOnlineAmount) || 0)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  function renderOrders() {
    const dateFiltered = dateFilteredOrders;

    const totalAll = dateFiltered.length;
    const totalCompleted = dateFiltered.filter(
      (o) => o.status !== STATUS_FILTERS.CANCELLED,
    ).length;
    const totalCancelled = dateFiltered.filter(
      (o) => o.status === STATUS_FILTERS.CANCELLED,
    ).length;

    const filtered = ordersFiltered;

    const availableRiders = [
      ...new Set(
        dateFiltered
          .filter((o) => o.type === "delivery" && o.assignedRiderName)
          .map((o) => o.assignedRiderName),
      ),
    ].sort();

    const availableWaiters = [
      ...new Set(
        dateFiltered
          .filter((o) => o.orderTakerName && o.createdByRole === "order_taker")
          .map((o) => o.orderTakerName),
      ),
    ].sort();

    const availableCashiers = [
      ...new Set(
        dateFiltered
          .filter((o) => o.orderTakerName && o.createdByRole === "cashier")
          .map((o) => o.orderTakerName),
      ),
    ].sort();

    const availableAdmins = [
      ...new Set(
        dateFiltered
          .filter(
            (o) =>
              o.orderTakerName &&
              ["restaurant_admin", "admin", "super_admin"].includes(
                o.createdByRole,
              ),
          )
          .map((o) => o.orderTakerName),
      ),
    ].sort();

    const hasActiveFilters =
      ordersStatusFilter !== FILTER_ALL ||
      ordersTypeFilter !== FILTER_ALL ||
      ordersPaymentFilter !== FILTER_ALL ||
      ordersSourceFilter !== FILTER_ALL ||
      ordersPaidFilter !== FILTER_ALL ||
      ordersRiderFilter !== FILTER_ALL ||
      ordersWaiterFilter !== FILTER_ALL ||
      ordersCashierFilter !== FILTER_ALL ||
      ordersAdminFilter !== FILTER_ALL ||
      ordersSearch.trim();

    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / ordersPerPage);
    const safePage = Math.min(ordersPage, Math.max(0, totalPages - 1));
    const paged = filtered.slice(
      safePage * ordersPerPage,
      (safePage + 1) * ordersPerPage,
    );

    return (
      <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Row 1: Status tabs + search */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
          {[
            { value: "ALL", label: "All", count: totalAll },
            { value: "COMPLETED", label: "Completed", count: totalCompleted },
            { value: "CANCELLED", label: "Cancelled", count: totalCancelled },
          ].map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setOrdersStatusFilter(f.value);
                setOrdersPage(0);
              }}
              className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[11px] font-semibold transition-all ${
                ordersStatusFilter === f.value
                  ? "bg-gradient-to-r from-primary to-secondary text-white shadow-sm"
                  : "bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700"
              }`}
            >
              {f.label}
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ordersStatusFilter === f.value ? "bg-white/20" : "bg-gray-200 dark:bg-neutral-700"}`}
              >
                {f.count}
              </span>
            </button>
          ))}

          <div className="flex-1 min-w-[180px] ml-auto relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-neutral-500" />
            <input
              type="text"
              value={ordersSearch}
              onChange={(e) => {
                setOrdersSearch(e.target.value);
                setOrdersPage(0);
              }}
              placeholder="Search order #, customer, table, phone, rider..."
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
        </div>

        {/* Row 2: Dropdown filters */}
        <div className="px-5 py-2.5 border-b border-gray-100 dark:border-neutral-800 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mr-1">
            Filters
          </span>

          <FilterSelect
            value={ordersTypeFilter}
            active={ordersTypeFilter !== FILTER_ALL}
            onChange={(e) => {
              setOrdersTypeFilter(e.target.value);
              if (e.target.value !== TYPE_FILTERS.DELIVERY)
                setOrdersRiderFilter(FILTER_ALL);
              setOrdersPage(0);
            }}
          >
            <option value="ALL">All Types</option>
            <option value="DINE_IN">Dine-in</option>
            <option value="DELIVERY">Delivery</option>
            <option value="TAKEAWAY">Takeaway</option>
          </FilterSelect>

          <FilterSelect
            value={ordersPaymentFilter}
            active={ordersPaymentFilter !== FILTER_ALL}
            onChange={(e) => {
              setOrdersPaymentFilter(e.target.value);
              setOrdersPage(0);
            }}
          >
            <option value="ALL">All Payments</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Online">Online</option>
            <option value="To be paid">Unpaid</option>
          </FilterSelect>

          <FilterSelect
            value={ordersSourceFilter}
            active={ordersSourceFilter !== FILTER_ALL}
            onChange={(e) => {
              setOrdersSourceFilter(e.target.value);
              setOrdersPage(0);
            }}
          >
            <option value="ALL">All Sources</option>
            <option value="POS">POS</option>
            <option value="ONLINE">Online</option>
          </FilterSelect>

          <FilterSelect
            value={ordersPaidFilter}
            active={ordersPaidFilter !== FILTER_ALL}
            onChange={(e) => {
              setOrdersPaidFilter(e.target.value);
              setOrdersPage(0);
            }}
          >
            <option value="ALL">Paid & Unpaid</option>
            <option value="PAID">Paid Only</option>
            <option value="UNPAID">Unpaid Only</option>
          </FilterSelect>

          {ordersTypeFilter === TYPE_FILTERS.DELIVERY &&
            availableRiders.length > 0 && (
              <FilterSelect
                value={ordersRiderFilter}
                active={ordersRiderFilter !== FILTER_ALL}
                onChange={(e) => {
                  setOrdersRiderFilter(e.target.value);
                  setOrdersPage(0);
                }}
              >
                <option value="ALL">All Riders</option>
                {availableRiders.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </FilterSelect>
            )}

          {availableWaiters.length > 0 && (
            <FilterSelect
              value={ordersWaiterFilter}
              active={ordersWaiterFilter !== FILTER_ALL}
              onChange={(e) => {
                setOrdersWaiterFilter(e.target.value);
                setOrdersCashierFilter(FILTER_ALL);
                setOrdersPage(0);
              }}
            >
              <option value="ALL">All Order Takers</option>
              {availableWaiters.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </FilterSelect>
          )}

          {availableCashiers.length > 0 && (
            <FilterSelect
              value={ordersCashierFilter}
              active={ordersCashierFilter !== FILTER_ALL}
              onChange={(e) => {
                setOrdersCashierFilter(e.target.value);
                setOrdersWaiterFilter(FILTER_ALL);
                setOrdersPage(0);
              }}
            >
              <option value="ALL">All Cashiers</option>
              {availableCashiers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </FilterSelect>
          )}

          {availableAdmins.length > 0 && (
            <FilterSelect
              value={ordersAdminFilter}
              active={ordersAdminFilter !== FILTER_ALL}
              onChange={(e) => {
                setOrdersAdminFilter(e.target.value);
                setOrdersWaiterFilter(FILTER_ALL);
                setOrdersCashierFilter(FILTER_ALL);
                setOrdersPage(0);
              }}
            >
              <option value="ALL">All Admins</option>
              {availableAdmins.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </FilterSelect>
          )}

          <div className="flex-1" />

          <span className="text-[11px] font-medium text-gray-400 dark:text-neutral-500">
            {totalFiltered} result{totalFiltered !== 1 ? "s" : ""}
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="h-7 px-3 rounded-lg text-[11px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
            >
              Reset All
            </button>
          )}
        </div>

        {paged.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="w-8 h-8 text-gray-300 dark:text-neutral-700 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400">
              No orders found
            </p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
              Try adjusting the filters or date range
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="text-xs min-w-[2000px]">
                <thead className="bg-gray-50 dark:bg-neutral-900/80 sticky top-0">
                  <tr>
                    <th className={`${TH_CLS} text-center`}>#</th>
                    <th className={TH_CLS}>Order #</th>
                    <th className={TH_CLS}>View</th>
                    <th className={TH_CLS}>Status</th>
                    <th className={`${TH_CLS} text-right`}>Subtotal</th>
                    <th className={`${TH_CLS} text-right`}>Delivery Fee</th>
                    <th className={`${TH_CLS} text-right`}>Discount</th>
                    <th className={`${TH_CLS} text-right`}>Grand Total</th>
                    <th className={TH_CLS}>Items</th>
                    <th className={TH_CLS}>Type</th>
                    <th className={TH_CLS}>Payment</th>
                    <th className={TH_CLS}>Paid</th>
                    <th className={TH_CLS}>Received</th>
                    <th className={TH_CLS}>Change</th>
                    <th className={TH_CLS}>Provider</th>
                    <th className={TH_CLS}>Customer</th>
                    <th className={TH_CLS}>Phone</th>
                    <th className={TH_CLS}>Table</th>
                    <th className={TH_CLS}>Source</th>
                    <th className={TH_CLS}>Order Taker</th>
                    <th className={TH_CLS}>Rider</th>
                    <th className={TH_CLS}>Delivery Address</th>
                    <th className={TH_CLS}>Cancel Reason</th>
                    <th className={TH_CLS}>Created</th>
                    <th className={TH_CLS}>Preparing</th>
                    <th className={TH_CLS}>Ready</th>
                    <th className={TH_CLS}>Out for Delivery</th>
                    <th className={TH_CLS}>Closed / Cancelled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-neutral-800/60">
                  {paged.map((o, i) => (
                    <tr
                      key={o._id || i}
                      className="hover:bg-gray-50/70 dark:hover:bg-neutral-900/40 transition-colors"
                    >
                      <td className={`${TD_CLS} text-center text-gray-400 dark:text-neutral-600 select-none`}>
                        {safePage * ordersPerPage + i + 1}
                      </td>
                      <td
                        className={`${TD_CLS} font-semibold text-gray-900 dark:text-white`}
                      >
                        #{o.id}
                      </td>
                      <td className={TD_CLS}>
                        <button
                          type="button"
                          onClick={() => setSelectedOrderDetail(o)}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-300 hover:border-primary/40 hover:text-primary transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className={TD_CLS}>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[o.status] || "bg-gray-100 text-gray-600"}`}
                        >
                          {STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                      <td className={`${TD_CLS} text-right`}>
                        {fmtRs(o.subtotal)}
                      </td>
                      <td className={`${TD_CLS} text-right`}>
                        {Number(o.deliveryCharges) > 0
                          ? fmtRs(o.deliveryCharges)
                          : "—"}
                      </td>
                      <td className={`${TD_CLS} text-right`}>
                        {o.discountAmount > 0 ? fmtRs(o.discountAmount) : "—"}
                      </td>
                      <td
                        className={`${TD_CLS} text-right font-bold text-gray-900 dark:text-white`}
                      >
                        {fmtRs(o.grandTotal ?? o.total)}
                      </td>
                      <td className={`${TD_CLS} relative`}>
                        {(o.items || []).length > 0 ? (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemsDropdownId(
                                  itemsDropdownId === o._id ? null : o._id,
                                );
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${itemsDropdownId === o._id ? "bg-primary/10 text-primary" : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700"}`}
                            >
                              {o.items.length} item
                              {o.items.length > 1 ? "s" : ""}
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${itemsDropdownId === o._id ? "rotate-180" : ""}`}
                              />
                            </button>
                            {itemsDropdownId === o._id && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setItemsDropdownId(null)}
                                />
                                <div className="absolute left-0 top-full mt-1 z-50 w-64 bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden">
                                  <table className="w-full text-[11px]">
                                    <thead>
                                      <tr className="bg-gray-50 dark:bg-neutral-900/80">
                                        <th className="py-1.5 px-3 text-left font-semibold text-gray-500 dark:text-neutral-400">
                                          Item
                                        </th>
                                        <th className="py-1.5 px-3 text-center font-semibold text-gray-500 dark:text-neutral-400">
                                          Qty
                                        </th>
                                        <th className="py-1.5 px-3 text-right font-semibold text-gray-500 dark:text-neutral-400">
                                          Total
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                      {o.items.map((item, idx) => (
                                        <tr key={idx}>
                                          <td className="py-1.5 px-3 font-medium text-gray-900 dark:text-white">
                                            {item.name}
                                          </td>
                                          <td className="py-1.5 px-3 text-center text-gray-600 dark:text-neutral-400">
                                            x{item.qty}
                                          </td>
                                          <td className="py-1.5 px-3 text-right font-semibold text-gray-900 dark:text-white">
                                            {fmtRs(item.lineTotal)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={TD_CLS}>
                        {TYPE_LABEL_MAP[o.type] || o.type}
                      </td>
                      <td className={`${TD_CLS} relative`}>
                        {renderPaymentCell(o, o._id || o.id)}
                      </td>
                      <td className={TD_CLS}>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${o.isPaid ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}
                        >
                          {o.isPaid ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                      <td className={`${TD_CLS} text-right`}>
                        {o.paymentAmountReceived != null
                          ? fmtRs(o.paymentAmountReceived)
                          : "—"}
                      </td>
                      <td className={`${TD_CLS} text-right`}>
                        {o.paymentAmountReturned > 0
                          ? fmtRs(o.paymentAmountReturned)
                          : "—"}
                      </td>
                      <td className={TD_CLS}>{o.paymentProvider || "—"}</td>
                      <td className={TD_CLS}>{o.customerName || "—"}</td>
                      <td className={TD_CLS}>{o.customerPhone || "—"}</td>
                      <td className={TD_CLS}>{o.tableName || "—"}</td>
                      <td className={TD_CLS}>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${o.source === "POS" ? "bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400" : "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"}`}
                        >
                          {o.source}
                        </span>
                      </td>
                      <td className={TD_CLS}>
                        {o.orderTakerName
                          ? o.createdByRole === "delivery_rider"
                            ? `Rider: ${o.orderTakerName}`
                            : o.orderTakerName
                          : "—"}
                      </td>
                      <td className={TD_CLS}>{o.assignedRiderName || "—"}</td>
                      <td
                        className={`${TD_CLS} max-w-[200px] truncate`}
                        title={o.deliveryAddress || ""}
                      >
                        {o.deliveryAddress || "—"}
                      </td>
                      <td
                        className={`${TD_CLS} max-w-[150px] truncate`}
                        title={o.cancelReason || ""}
                      >
                        {o.cancelReason || "—"}
                      </td>
                      <td className={TD_CLS}>{fmtShortDate(o.createdAt)}</td>
                      <td className={TD_CLS}>
                        {fmtTime(getStatusTime(o, "PROCESSING"))}
                      </td>
                      <td className={TD_CLS}>
                        {fmtTime(getStatusTime(o, "READY"))}
                      </td>
                      <td className={TD_CLS}>
                        {fmtTime(getStatusTime(o, "OUT_FOR_DELIVERY"))}
                      </td>
                      <td className={TD_CLS}>
                        {o.status === "CANCELLED" ? (
                          <span className="text-red-500">
                            {fmtTime(
                              o.cancelledAt || getStatusTime(o, "CANCELLED"),
                            )}
                          </span>
                        ) : (
                          fmtTime(getStatusTime(o, "DELIVERED") || o.updatedAt)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalFiltered > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-[11px] text-gray-500 dark:text-neutral-400">
                    Showing {safePage * ordersPerPage + 1}–
                    {Math.min((safePage + 1) * ordersPerPage, totalFiltered)} of{" "}
                    {totalFiltered}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 dark:text-neutral-500">
                      Per page
                    </span>
                    <FilterSelect
                      value={ordersPerPage}
                      active={ordersPerPage !== 25}
                      small
                      onChange={(e) => {
                        setOrdersPerPage(Number(e.target.value));
                        setOrdersPage(0);
                      }}
                    >
                      {[10, 25, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </FilterSelect>
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setOrdersPage(Math.max(0, safePage - 1))}
                      disabled={safePage === 0}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let page = i;
                      if (totalPages > 5) {
                        const start = Math.max(
                          0,
                          Math.min(safePage - 2, totalPages - 5),
                        );
                        page = start + i;
                      }
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setOrdersPage(page)}
                          className={`w-7 h-7 rounded-lg text-[11px] font-semibold transition-all ${
                            page === safePage
                              ? "bg-primary text-white"
                              : "text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
                          }`}
                        >
                          {page + 1}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() =>
                        setOrdersPage(Math.min(totalPages - 1, safePage + 1))
                      }
                      disabled={safePage >= totalPages - 1}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  function renderSessions() {
    const sessionPages = Math.ceil(sessionsTotal / SESSIONS_PER_PAGE);
    const summary = sessionDetail?.summary || {};
    const sessionOrders = Array.isArray(sessionDetail?.orders)
      ? [...sessionDetail.orders].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        )
      : [];
    const filteredSessionOrders = (() => {
      const q = String(sessionOrderSearch || "").trim().toLowerCase();
      const base = sessionOrders.filter((o) => {
        if (sessionOrderStatusFilter && o.status !== sessionOrderStatusFilter) {
          return false;
        }
        if (sessionOrderTypeFilter && o.orderType !== sessionOrderTypeFilter) {
          return false;
        }
        if (!q) return true;
        const staff = o.riderName || o.waiterName || o.orderTakerName || "";
        const payment = o.isPaid ? o.paymentMethod || "" : "Unpaid";
        const haystack = [
          o.orderNumber || o.id,
          o.customerName || "",
          staff,
          o.orderType || "",
          o.status || "",
          payment,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
      if (sessionOrderPositionFilter === "first" && base.length > 0) {
        return [
          [...base].sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
          )[0],
        ];
      }
      if (sessionOrderPositionFilter === "last" && base.length > 0) {
        return [
          [...base].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
          )[0],
        ];
      }
      return base;
    })();
    const sessionStatusOptions = Array.from(
      new Set(sessionOrders.map((o) => o.status).filter(Boolean)),
    );
    const sessionTypeOptions = Array.from(
      new Set(sessionOrders.map((o) => o.orderType).filter(Boolean)),
    );
    const sessionUnpaid = getSessionUnpaidBreakdown(sessionOrders);
    const allOrdersSelected =
      filteredSessionOrders.length > 0 &&
      filteredSessionOrders.every((o) => selectedSessionOrderIds.includes(o.id));
    const movableTargetSessions = sessionsList.filter(
      (s) => s.id !== selectedSession?.id,
    );
    const exportColumnOptions = [
      { key: "orderNumber", label: "Order #" },
      { key: "time", label: "Time" },
      { key: "type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "customer", label: "Customer" },
      { key: "staff", label: "Staff" },
      { key: "items", label: "Items" },
      { key: "total", label: "Total" },
      { key: "payment", label: "Payment" },
    ];
    const csvEscape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const sessionOnlineSales = Math.max(
      0,
      Number(summary.totalSales || 0) -
        Number(summary.cashSales || 0) -
        Number(summary.cardSales || 0),
    );
    const currencySymbol = CURRENCY_SYMBOLS[settingsCurrencyCode] || "¤";
    const fmtMoney = (v) =>
      `${currencySymbol} ${Math.round(Number(v || 0)).toLocaleString()}`;
    const currencyRows = Object.entries(sessionCurrency || {})
      .map(([denom, qty]) => ({
        denom: Number(denom),
        qty: Number(qty) || 0,
      }))
      .filter((r) => Number.isFinite(r.denom) && r.denom > 0 && r.qty > 0)
      .sort((a, b) => b.denom - a.denom)
      .map((r) => ({ ...r, subtotal: r.denom * r.qty }));
    const notesRows = currencyRows.filter((r) => r.denom >= 1);
    const coinsRows = currencyRows.filter((r) => r.denom < 1);
    const countedCashTotal = currencyRows.reduce(
      (sum, r) => sum + Number(r.subtotal || 0),
      0,
    );
    const expectedCashTotal = Number(summary.cashSales || 0);
    const cashDiff = countedCashTotal - expectedCashTotal;

    const getSessionExportRows = () => {
      const labelsByKey = Object.fromEntries(
        exportColumnOptions.map((c) => [c.key, c.label]),
      );
      const header = exportColumns.map((k) => csvEscape(labelsByKey[k] || k));
      const rows = filteredSessionOrders.map((o) => {
        const staff = o.riderName || o.waiterName || o.orderTakerName || "";
        const items = (o.items || [])
          .map((it) => `${it.name} x${it.qty || 1}`)
          .join(" | ");
        const valuesByKey = {
          orderNumber: o.orderNumber || o.id,
          time: o.createdAt
            ? new Date(o.createdAt).toLocaleTimeString("en-PK", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })
            : "",
          type: o.orderType || "",
          status: o.status || "",
          customer: o.customerName || "",
          staff,
          items,
          total: o.total || 0,
          payment: o.isPaid ? o.paymentMethod || "" : "Unpaid",
        };
        return exportColumns.map((k) => csvEscape(valuesByKey[k]));
      });
      return { labelsByKey, header, rows };
    };

    const printSessionOrders = (pdfMode = false) => {
      const win = window.open("", "_blank");
      if (!win) return;
      const selectedCols = exportColumns.length
        ? exportColumns
        : exportColumnOptions.map((c) => c.key);
      const headers = selectedCols.map(
        (k) => exportColumnOptions.find((c) => c.key === k)?.label || k,
      );
      const body = filteredSessionOrders
        .map((o) => {
          const staff = o.riderName || o.waiterName || o.orderTakerName || "";
          const items = (o.items || [])
            .map((it) => `${it.name} x${it.qty || 1}`)
            .join(" | ");
          const valuesByKey = {
            orderNumber: o.orderNumber || o.id,
            time: o.createdAt
              ? new Date(o.createdAt).toLocaleTimeString("en-PK", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })
              : "",
            type: o.orderType || "",
            status: o.status || "",
            customer: o.customerName || "",
            staff,
            items,
            total: o.total || 0,
            payment: o.isPaid ? o.paymentMethod || "" : "Unpaid",
          };
          return `<tr>${selectedCols.map((k) => `<td>${String(valuesByKey[k] ?? "")}</td>`).join("")}</tr>`;
        })
        .join("");
      win.document.write(`<!DOCTYPE html><html><head><title>Business Day Orders</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}h2{margin:0 0 12px}table{width:100%;border-collapse:collapse}th,td{padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:left}th{font-size:11px;text-transform:uppercase;color:#6b7280}@media print{body{padding:0}}</style></head><body><h2>Business Day Orders (${filteredSessionOrders.length})</h2><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></body></html>`);
      win.document.close();
      setTimeout(() => win.print(), 250);
      if (pdfMode) {
        toast.success("Choose 'Save as PDF' in print dialog");
      }
    };

    // Order type breakdown from detail orders (display: delivery splits items vs fees)
    const typeBreakdown = sessionOrders
      .filter((o) => o.status === "DELIVERED" || o.status === "COMPLETED")
      .reduce((map, o) => {
        const t = (o.orderType || "other").toLowerCase().replace(/_/g, "-");
        const grand =
          Math.round(Number(o.grandTotal ?? o.total ?? 0) || 0) || 0;
        const sub = Math.round(Number(o.subtotal ?? 0) || 0) || 0;
        const dc = Math.round(Number(o.deliveryCharges ?? 0) || 0) || 0;
        if (!map[t]) {
          map[t] = {
            count: 0,
            revenue: 0,
            itemSales: 0,
            deliveryFees: 0,
          };
        }
        map[t].count += 1;
        map[t].revenue += grand;
        if (t === "delivery") {
          map[t].itemSales += sub;
          map[t].deliveryFees += dc;
        }
        return map;
      }, {});

    async function handleMoveSelectedOrders() {
      if (!moveTargetSessionId || selectedSessionOrderIds.length === 0) return;
      setMovingOrders(true);
      try {
        const res = await reassignOrdersToSession({
          orderIds: selectedSessionOrderIds,
          targetSessionId: moveTargetSessionId,
          branchId: currentBranch?.id,
        });
        toast.success(
          `Moved ${Number(res?.movedOrders || 0).toLocaleString()} orders`,
        );
        if (selectedSession?.id) await openSessionDetail(selectedSession);
        await loadSessions(sessionsPage);
      } catch (err) {
        toast.error(err.message || "Failed to move orders");
      } finally {
        setMovingOrders(false);
      }
    }

    return (
      <div className="space-y-4">
        {/* Sessions table */}
        <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          {currentBranch && (
            <div className="px-5 py-2.5 border-b border-gray-100 dark:border-neutral-800">
              <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                {currentBranch.name}
              </p>
            </div>
          )}

          {sessionsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : sessionsList.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400 dark:text-neutral-600">
              No sessions found
            </div>
          ) : (
            <>
              {sessionsViewMode === "daily" ? (() => {
                const dayKey = (s) =>
                  new Date(s.startAt).toLocaleDateString("en-CA");
                const grouped = [];
                const seen = {};
                for (const s of sessionsList) {
                  const k = dayKey(s);
                  if (!seen[k]) {
                    seen[k] = { key: k, sessions: [], totalOrders: 0, totalSales: 0, hasOpen: false };
                    grouped.push(seen[k]);
                  }
                  seen[k].sessions.push(s);
                  seen[k].totalOrders += Number(s.totalOrders || 0);
                  seen[k].totalSales += Number(s.totalSales || 0);
                  if (s.status === "OPEN") seen[k].hasOpen = true;
                }
                const maxSales = Math.max(...grouped.map((d) => d.totalSales), 1);
                return (
                  <div className="divide-y divide-gray-100 dark:divide-neutral-800/70">
                    {grouped.map((day) => {
                      const isExpanded = expandedDays.has(day.key);
                      const d = new Date(day.key + "T00:00:00");
                      const weekday = d.toLocaleDateString("en-PK", { weekday: "long" });
                      const dateStr = d.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
                      const barPct = Math.round((day.totalSales / maxSales) * 100);
                      return (
                        <div key={day.key}>
                          {/* Day header row */}
                          <button
                            type="button"
                            className={`w-full text-left transition-colors group ${isExpanded ? "bg-gray-50/80 dark:bg-neutral-900/60" : "hover:bg-gray-50/60 dark:hover:bg-neutral-900/30"}`}
                            onClick={() => {
                              setExpandedDays((prev) => {
                                const next = new Set(prev);
                                if (next.has(day.key)) next.delete(day.key);
                                else next.add(day.key);
                                return next;
                              });
                            }}
                          >
                            <div className="flex items-center gap-3 px-4 py-2.5">
                              {/* Chevron */}
                              <ChevronDown
                                className={`w-3.5 h-3.5 flex-shrink-0 transition-transform text-gray-400 dark:text-neutral-500 ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                              />
                              {/* Date block */}
                              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 flex flex-col items-center justify-center border border-primary/15 dark:border-primary/25">
                                <span className="text-[8px] font-bold text-primary uppercase leading-none">
                                  {d.toLocaleDateString("en-PK", { month: "short" })}
                                </span>
                                <span className="text-[13px] font-extrabold text-primary leading-tight">
                                  {d.getDate()}
                                </span>
                              </div>
                              {/* Date label */}
                              <div className="flex-shrink-0 min-w-[160px]">
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] font-bold text-gray-900 dark:text-white">{weekday}</span>
                                  <span className="text-[11px] text-gray-400 dark:text-neutral-500">{dateStr}</span>
                                  {day.hasOpen && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      LIVE
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* Revenue bar — centre of row */}
                              <div className="flex-1 flex items-center gap-2 min-w-0 px-4">
                                <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                                    style={{ width: `${barPct}%` }}
                                  />
                                </div>
                              </div>
                              {/* Session count + Stats */}
                              <div className="flex items-center gap-2.5 flex-shrink-0">
                                <span className="text-[11px] text-gray-400 dark:text-neutral-500">
                                  {day.sessions.length} session{day.sessions.length !== 1 ? "s" : ""}
                                </span>
                                {day.sessions.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openFullDayCombinedReport(day);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border border-primary/35 bg-primary/10 text-primary hover:bg-primary/15 dark:hover:bg-primary/20 transition-colors"
                                    title="View one report with all sessions this day combined"
                                  >
                                    <Layers className="w-3 h-3 flex-shrink-0" />
                                    Full day total
                                  </button>
                                )}
                                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700">
                                  <ShoppingBag className="w-3 h-3 text-gray-400 dark:text-neutral-500" />
                                  <span className="text-[12px] font-semibold text-gray-700 dark:text-neutral-300">{day.totalOrders.toLocaleString()}</span>
                                  <span className="text-[10px] text-gray-400 dark:text-neutral-500">orders</span>
                                </div>
                                <div className="px-2.5 py-1 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/25">
                                  <span className="text-[13px] font-extrabold text-primary">{fmtRs(day.totalSales)}</span>
                                </div>
                                <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-all ${isExpanded ? "opacity-0" : "text-gray-300 dark:text-neutral-600 group-hover:text-primary"}`} />
                              </div>
                            </div>
                          </button>

                          {/* Expanded sessions */}
                          {isExpanded && (
                            <div className="border-t border-gray-100 dark:border-neutral-800 bg-gray-50/40 dark:bg-neutral-900/30">
                              {day.sessions.map((s, idx) => (
                                <div
                                  key={s.id}
                                  className={`flex items-center gap-3 pl-[52px] pr-4 py-2.5 cursor-pointer hover:bg-white dark:hover:bg-neutral-900/60 transition-colors group ${idx !== day.sessions.length - 1 ? "border-b border-gray-100 dark:border-neutral-800/50" : ""}`}
                                  onClick={() => openSessionDetail(s)}
                                >
                                  {/* Session badge */}
                                  <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold border ${
                                    s.status === "OPEN"
                                      ? "bg-emerald-500 border-emerald-500 text-white"
                                      : "bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-600 text-gray-500 dark:text-neutral-400"
                                  }`}>
                                    {s.status === "OPEN" ? <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> : idx + 1}
                                  </div>
                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[12px] font-semibold ${s.status === "OPEN" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-700 dark:text-neutral-300"}`}>
                                        {s.status === "OPEN" ? "Current session" : `Session ${idx + 1}`}
                                      </span>
                                      <span className="text-[11px] text-gray-400 dark:text-neutral-500">
                                        {new Date(s.startAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                        {s.endAt ? ` → ${new Date(s.endAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true })}` : " → Ongoing"}
                                        {fmtDuration(s.startAt, s.endAt) ? ` · ${fmtDuration(s.startAt, s.endAt)}` : ""}
                                      </span>
                                    </div>
                                  </div>
                                  {/* Stats */}
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className="text-[11px] text-gray-400 dark:text-neutral-500">{(s.totalOrders || 0).toLocaleString()} orders</span>
                                    <span className="text-[12px] font-bold text-gray-800 dark:text-neutral-200">{fmtRs(s.totalSales)}</span>
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-neutral-700 group-hover:text-primary transition-colors" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 dark:bg-neutral-900/70 border-b border-gray-200 dark:border-neutral-800">
                    <tr>
                      {[
                        "Status",
                        "Start",
                        "End",
                        "Duration",
                        "Branch",
                        "Opened By",
                        "Closed By",
                        "Orders",
                        "Revenue",
                        "",
                      ].map((h) => (
                        <th
                          key={h}
                          className={`py-2.5 px-3 text-left text-[11px] font-semibold text-gray-500 dark:text-neutral-400 whitespace-nowrap uppercase tracking-wide ${h === "Revenue" || h === "Orders" ? "text-right" : ""}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {sessionsList.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-gray-50/70 dark:hover:bg-neutral-900/40 transition-colors cursor-pointer group"
                        onClick={() => openSessionDetail(s)}
                      >
                        <td className="py-2.5 px-3 text-[12px] whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              s.status === "OPEN"
                                ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400"
                            }`}
                          >
                            {s.status === "OPEN" && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                            {s.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[12px] text-gray-700 dark:text-neutral-300 whitespace-nowrap">
                          {fmtDate(s.startAt)}
                        </td>
                        <td className="py-2.5 px-3 text-[12px] text-gray-700 dark:text-neutral-300 whitespace-nowrap">
                          {s.endAt ? (
                            fmtDate(s.endAt)
                          ) : (
                            <span className="text-emerald-500 font-medium text-xs">
                              Ongoing
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[12px] text-gray-500 dark:text-neutral-400 whitespace-nowrap">
                          {fmtDuration(s.startAt, s.endAt) || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-[12px] text-gray-700 dark:text-neutral-300 whitespace-nowrap">
                          {s.branchName ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                              {s.branchName}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[12px] text-gray-700 dark:text-neutral-300 whitespace-nowrap">
                          {s.openedBy?.name || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-[12px] text-gray-700 dark:text-neutral-300 whitespace-nowrap">
                          {s.closedBy?.name || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-[12px] text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          {(s.totalOrders || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-[12px] text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                          {fmtRs(s.totalSales)}
                        </td>
                        <td className="py-2.5 px-3">
                          <ChevronRight className="w-4 h-4 text-gray-300 dark:text-neutral-600 group-hover:text-primary transition-colors" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
              {sessionPages > 1 && (
                <div className="flex items-center justify-center gap-3 px-5 py-4 border-t border-gray-100 dark:border-neutral-800">
                  <button
                    type="button"
                    disabled={sessionsPage === 0}
                    onClick={() => {
                      const p = sessionsPage - 1;
                      setSessionsPage(p);
                      loadSessions(p);
                    }}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-gray-500 dark:text-neutral-400">
                    Page {sessionsPage + 1} of {sessionPages} · {sessionsTotal}{" "}
                    total
                  </span>
                  <button
                    type="button"
                    disabled={sessionsPage >= sessionPages - 1}
                    onClick={() => {
                      const p = sessionsPage + 1;
                      setSessionsPage(p);
                      loadSessions(p);
                    }}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Session detail slide-over */}
        {selectedSession && (
          <div className="fixed inset-0 z-50 flex items-stretch p-0">
            <div
              className="fixed inset-0 bg-black/50 top-0 backdrop-blur-sm"
              onClick={() => {
                setSelectedSession(null);
                setSessionDetailScope("single");
              }}
            />
            <div className="fixed top-0 inset-y-0 right-0 w-full max-w-3xl bg-white dark:bg-neutral-950 border-l border-gray-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-neutral-800 flex-shrink-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      Business Day Report
                    </h2>
                    {sessionDetailScope === "day" ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 dark:bg-primary/20 text-primary border border-primary/25">
                        <Layers className="w-3 h-3" />
                        Full day total
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          selectedSession.status === "OPEN"
                            ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400"
                        }`}
                      >
                        {selectedSession.status === "OPEN" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                        {selectedSession.status}
                      </span>
                    )}
                  </div>
                  {sessionDetailScope === "day" ? (
                    <p className="text-[11px] text-gray-500 dark:text-neutral-400 mt-0.5">
                      All sessions on this calendar day combined — same totals as the day row
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400 dark:text-neutral-500 mt-0.5">
                      {fmtDate(selectedSession.startAt)}
                      {selectedSession.endAt
                        ? ` → ${fmtDate(selectedSession.endAt)}`
                        : " · Ongoing"}
                      {fmtDuration(
                        selectedSession.startAt,
                        selectedSession.endAt,
                      ) &&
                        ` · ${fmtDuration(selectedSession.startAt, selectedSession.endAt)}`}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSession(null);
                    setSessionDetailScope("single");
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {sessionDetailLoading ? (
                  <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {/* Compact stats rows */}
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2.5 py-2">
                          <p className="text-[9px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide leading-none">
                            Total Revenue
                          </p>
                          <p className="mt-1 text-[22px] leading-none font-black text-gray-900 dark:text-white tabular-nums">
                            {fmtRs(summary.totalSales)}
                          </p>
                          {sessionUnpaid.totalCount > 0 ? (
                            <div className="mt-1 space-y-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                              <p className="font-semibold">
                                Unpaid total: {fmtRs(sessionUnpaid.totalAmt)} ·{" "}
                                {sessionUnpaid.totalCount} orders
                              </p>
                              <p className="text-[9px] leading-snug opacity-95">
                                In progress: {fmtRs(sessionUnpaid.pipelineAmt)} (
                                {sessionUnpaid.pipelineCount}) · Delivered, payment
                                pending: {fmtRs(sessionUnpaid.deliveredAmt)} (
                                {sessionUnpaid.deliveredCount})
                                {sessionUnpaid.otherCount > 0
                                  ? ` · Other unpaid: ${fmtRs(sessionUnpaid.otherAmt)} (${sessionUnpaid.otherCount})`
                                  : ""}
                              </p>
                    </div>
                          ) : (
                            <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                              All recorded orders paid
                            </p>
                          )}
                        </div>
                        <div className="rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2.5 py-2">
                          <p className="text-[9px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide leading-none">
                            Orders
                          </p>
                          <p className="mt-1 text-[22px] leading-none font-black text-gray-900 dark:text-white tabular-nums">
                            {(summary.totalOrders || 0).toString()}
                          </p>
                          <p className="mt-1 text-[10px] text-gray-500 dark:text-neutral-400">
                            Paid (closed) orders in revenue
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { label: "Cash", value: fmtRs(summary.cashSales) },
                          { label: "Card", value: fmtRs(summary.cardSales) },
                          {
                            label: "Online",
                            value: fmtRs(sessionOnlineSales),
                          },
                        ].map((kpi) => (
                          <div
                            key={kpi.label}
                            className="rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2 py-1.5"
                          >
                            <p className="text-[9px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide leading-none">
                              {kpi.label}
                            </p>
                            <p className="mt-1 text-[18px] leading-none font-black text-gray-900 dark:text-white tabular-nums">
                              {kpi.value}
                          </p>
                        </div>
                      ))}
                      </div>
                    </div>

                    {/* Session cash denomination breakdown */}
                    <div className="rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2.5 py-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <h3 className="text-[11px] font-bold text-gray-900 dark:text-white">
                          Cash Breakdown
                        </h3>
                        <span className="text-[10px] text-gray-500 dark:text-neutral-400">
                          Saved denomination count
                        </span>
                      </div>

                      {sessionCurrencyLoading ? (
                        <div className="py-3 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        </div>
                      ) : currencyRows.length === 0 ? (
                        <p className="text-[11px] text-gray-500 dark:text-neutral-400 py-1">
                          No denomination count saved for this day.
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            <div className="rounded-md border border-gray-100 dark:border-neutral-800 px-2 py-1.5">
                              <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500 mb-1">
                                Notes
                              </p>
                              <div className="space-y-1">
                                {notesRows.length === 0 ? (
                                  <p className="text-[10px] text-gray-400 dark:text-neutral-500">None</p>
                                ) : (
                                  notesRows.map((r) => (
                                    <div
                                      key={`n-${r.denom}`}
                                      className="flex items-center justify-between text-[10px]"
                                    >
                                      <span className="text-gray-600 dark:text-neutral-400">
                                        {fmtMoney(r.denom)} x {r.qty}
                                      </span>
                                      <span className="font-semibold text-gray-900 dark:text-white">
                                        {fmtMoney(r.subtotal)}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                            <div className="rounded-md border border-gray-100 dark:border-neutral-800 px-2 py-1.5">
                              <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500 mb-1">
                                Coins
                              </p>
                              <div className="space-y-1">
                                {coinsRows.length === 0 ? (
                                  <p className="text-[10px] text-gray-400 dark:text-neutral-500">None</p>
                                ) : (
                                  coinsRows.map((r) => (
                                    <div
                                      key={`c-${r.denom}`}
                                      className="flex items-center justify-between text-[10px]"
                                    >
                                      <span className="text-gray-600 dark:text-neutral-400">
                                        {fmtMoney(r.denom)} x {r.qty}
                                      </span>
                                      <span className="font-semibold text-gray-900 dark:text-white">
                                        {fmtMoney(r.subtotal)}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                            <div className="rounded-md bg-gray-50 dark:bg-neutral-800/60 px-2 py-1.5">
                              <p className="text-[9px] uppercase tracking-wide text-gray-400 dark:text-neutral-500">Expected Cash</p>
                              <p className="text-[12px] font-bold text-gray-900 dark:text-white">{fmtMoney(expectedCashTotal)}</p>
                            </div>
                            <div className="rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1.5">
                              <p className="text-[9px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Counted Cash</p>
                              <p className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400">{fmtMoney(countedCashTotal)}</p>
                            </div>
                            <div className={`rounded-md px-2 py-1.5 ${cashDiff === 0 ? "bg-gray-50 dark:bg-neutral-800/60" : cashDiff > 0 ? "bg-amber-50 dark:bg-amber-500/10" : "bg-rose-50 dark:bg-rose-500/10"}`}>
                              <p className="text-[9px] uppercase tracking-wide text-gray-400 dark:text-neutral-500">Difference</p>
                              <p className={`text-[12px] font-bold ${cashDiff === 0 ? "text-gray-900 dark:text-white" : cashDiff > 0 ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400"}`}>
                                {cashDiff > 0 ? "+" : ""}
                                {fmtMoney(cashDiff)}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Order type breakdown */}
                    {Object.keys(typeBreakdown).length > 0 && (
                      <div>
                        <h3 className="text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">
                          Order Type Breakdown
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {Object.entries(typeBreakdown).map(([type, d]) => (
                            <div
                              key={type}
                              className="rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2.5 py-2 min-h-[62px]"
                            >
                              <p className="text-[10px] font-semibold text-gray-500 dark:text-neutral-400 capitalize leading-none mb-1">
                                {type.replace(/-/g, " ")}
                              </p>
                              <p className="text-[20px] leading-none font-black text-gray-900 dark:text-white tabular-nums">
                                {fmtRs(d.revenue)}
                              </p>
                              {type === "delivery" &&
                                (d.itemSales > 0 || d.deliveryFees > 0) && (
                                  <p className="mt-0.5 text-[9px] text-gray-500 dark:text-neutral-400 leading-snug">
                                    {fmtRs(d.itemSales)} (items) +{" "}
                                    {fmtRs(d.deliveryFees)} (delivery fees)
                                  </p>
                                )}
                              <p className="mt-0.5 text-[9px] text-gray-400 dark:text-neutral-500">
                                {d.count} order{d.count !== 1 ? "s" : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Orders table */}
                    <div>
                      <div className="mb-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2">
                        <div className="relative sm:col-span-2 lg:col-span-4">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            type="text"
                            value={sessionOrderSearch}
                            onChange={(e) =>
                              setSessionOrderSearch(e.target.value)
                            }
                            placeholder="Search orders in this session..."
                            className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px] text-gray-700 dark:text-neutral-300 outline-none focus:border-primary"
                          />
                        </div>
                        <select
                          value={sessionOrderStatusFilter}
                          onChange={(e) =>
                            setSessionOrderStatusFilter(e.target.value)
                          }
                          className="h-8 w-full lg:col-span-2 px-2.5 rounded-lg text-[11px] font-semibold bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border border-gray-200 dark:border-neutral-700"
                        >
                          <option value="">All status</option>
                          {sessionStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <select
                          value={sessionOrderTypeFilter}
                          onChange={(e) =>
                            setSessionOrderTypeFilter(e.target.value)
                          }
                          className="h-8 w-full lg:col-span-2 px-2.5 rounded-lg text-[11px] font-semibold bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border border-gray-200 dark:border-neutral-700"
                        >
                          <option value="">All type</option>
                          {sessionTypeOptions.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <select
                          value={sessionOrderPositionFilter}
                          onChange={(e) =>
                            setSessionOrderPositionFilter(e.target.value)
                          }
                          className="h-8 w-full lg:col-span-2 px-2.5 rounded-lg text-[11px] font-semibold bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border border-gray-200 dark:border-neutral-700"
                        >
                          <option value="all">All orders</option>
                          <option value="first">First order</option>
                          <option value="last">Last order</option>
                        </select>
                        <div className="relative lg:col-span-2">
                        <button
                          type="button"
                            onClick={() => setShowExportColumns((v) => !v)}
                            className="h-8 w-full inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-[11px] font-semibold whitespace-nowrap border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Export
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          {showExportColumns && (
                            <div className="absolute right-0 mt-1 z-30 w-[320px] max-w-[90vw] rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl p-2">
                              <p className="text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5">
                                Select columns
                              </p>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                {exportColumnOptions.map((col) => (
                                  <label
                                    key={col.key}
                                    className="flex items-center gap-2 text-[11px] text-gray-700 dark:text-neutral-300"
                                  >
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5 accent-primary"
                                      checked={exportColumns.includes(col.key)}
                                      onChange={(e) => {
                                        setExportColumns((prev) =>
                                          e.target.checked
                                            ? [...prev, col.key]
                                            : prev.filter(
                                                (k) => k !== col.key,
                                              ),
                                        );
                                      }}
                                    />
                                    {col.label}
                                  </label>
                                ))}
                              </div>
                              <div className="mt-2 grid grid-cols-3 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    printSessionOrders(true);
                                    setShowExportColumns(false);
                                  }}
                                  className="h-8 rounded-lg text-[11px] font-semibold border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-200"
                                >
                                  PDF
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    printSessionOrders(false);
                                    setShowExportColumns(false);
                                  }}
                                  className="h-8 rounded-lg text-[11px] font-semibold border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-200"
                                >
                                  Print
                                </button>
                                <button
                                  type="button"
                                  disabled={exportColumns.length === 0}
                                  onClick={() => {
                                    const { header, rows } = getSessionExportRows();
                                    const csvRows = [
                                      header.join(","),
                                      ...rows.map((r) => r.join(",")),
                            ].join("\n");
                                    const b = new Blob([csvRows], {
                                      type: "text/csv",
                                    });
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(b);
                            a.download = `session-${selectedSession.id.slice(-6)}-orders.csv`;
                            a.click();
                                    setShowExportColumns(false);
                          }}
                                  className="h-8 rounded-lg text-[11px] font-semibold bg-gray-900 text-white dark:bg-white dark:text-black disabled:opacity-50"
                        >
                                  CSV
                        </button>
                      </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {selectedSessionOrderIds.length > 0 && (
                        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5 p-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
                            {selectedSessionOrderIds.length} selected
                          </span>
                          <select
                            value={moveTargetSessionId}
                            onChange={(e) =>
                              setMoveTargetSessionId(e.target.value)
                            }
                            className="h-8 min-w-[260px] max-w-[360px] px-2.5 rounded-lg text-[11px] font-semibold bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border border-gray-200 dark:border-neutral-700"
                          >
                            <option value="">Move selected to session...</option>
                            {movableTargetSessions.map((s) => (
                              <option key={s.id} value={s.id}>
                                {`${s.status} · ${fmtDate(s.startAt)}${s.endAt ? ` → ${fmtDate(s.endAt)}` : ""}`}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleMoveSelectedOrders}
                            disabled={movingOrders || !moveTargetSessionId}
                            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-[11px] font-semibold whitespace-nowrap border border-amber-200 dark:border-amber-500/30 bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                          >
                            {movingOrders ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Package className="w-3.5 h-3.5" />
                            )}
                            Move Selected
                          </button>
                        </div>
                      )}
                      {filteredSessionOrders.length === 0 ? (
                        <div className="text-center py-10 text-sm text-gray-400 dark:text-neutral-600">
                          No orders in this session
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-800">
                          <table className="min-w-full">
                            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-neutral-900/90 border-b border-gray-200 dark:border-neutral-800 backdrop-blur">
                              <tr>
                                <th className="py-2.5 px-3 text-center text-[11px] font-semibold text-gray-500 dark:text-neutral-400 whitespace-nowrap uppercase tracking-wide align-middle">
                                  <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 accent-primary align-middle"
                                    checked={allOrdersSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedSessionOrderIds(
                                          filteredSessionOrders.map((o) => o.id),
                                        );
                                      } else {
                                        setSelectedSessionOrderIds([]);
                                      }
                                    }}
                                  />
                                </th>
                                {[
                                  "Order #",
                                  "View",
                                  "Time",
                                  "Type",
                                  "Status",
                                  "Customer",
                                  "Staff",
                                  "Items",
                                  "Total",
                                  "Payment",
                                ].map((h) => (
                                  <th
                                    key={h}
                                    className={`py-2.5 px-3 text-left text-[11px] font-semibold text-gray-500 dark:text-neutral-400 whitespace-nowrap uppercase tracking-wide align-middle ${h === "Total" ? "text-right" : ""}`}
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                              {filteredSessionOrders.map((o) => {
                                const items = o.items || [];
                                const itemCount = items.reduce(
                                  (s, i) => s + (i.qty || 1),
                                  0,
                                );
                                const staff = o.riderName
                                  ? `Rider: ${o.riderName}`
                                  : o.waiterName
                                    ? `Waiter: ${o.waiterName}`
                                    : o.orderTakerName
                                      ? `Taker: ${o.orderTakerName}`
                                      : "—";
                                return (
                                  <tr
                                    key={o.id}
                                    className={`transition-colors ${
                                      selectedSessionOrderIds.includes(o.id)
                                        ? "bg-amber-50/60 dark:bg-amber-500/5"
                                        : "hover:bg-gray-50/50 dark:hover:bg-neutral-900/30"
                                    }`}
                                  >
                                    <td className="py-2.5 px-3 text-center text-[12px] whitespace-nowrap align-middle">
                                      <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5 accent-primary align-middle"
                                        checked={selectedSessionOrderIds.includes(
                                          o.id,
                                        )}
                                        onChange={(e) => {
                                          setSelectedSessionOrderIds((prev) =>
                                            e.target.checked
                                              ? [...prev, o.id]
                                              : prev.filter(
                                                  (id) => id !== o.id,
                                                ),
                                          );
                                        }}
                                      />
                                    </td>
                                    <td className="py-2.5 px-3 text-[12px] whitespace-nowrap font-bold text-gray-900 dark:text-white">
                                      #{o.orderNumber || o.id?.slice(-4)}
                                    </td>
                                    <td className="py-2.5 px-3 text-[12px] whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedOrderDetail(o);
                                        }}
                                        className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-300 hover:border-primary/40 hover:text-primary transition-colors"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                    <td className="py-2.5 px-3 text-[12px] text-gray-600 dark:text-neutral-400 whitespace-nowrap">
                                      {o.createdAt
                                        ? new Date(
                                            o.createdAt,
                                          ).toLocaleTimeString("en-PK", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            hour12: true,
                                          })
                                        : "—"}
                                    </td>
                                    <td className="py-2.5 px-3 text-[12px] text-gray-600 dark:text-neutral-400 whitespace-nowrap capitalize">
                                      {(o.orderType || "")
                                        .replace(/_/g, " ")
                                        .toLowerCase()}
                                    </td>
                                    <td className="py-2.5 px-3 text-[12px] whitespace-nowrap">
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                          STATUS_COLORS[o.status] ||
                                          "bg-gray-100 text-gray-500"
                                        }`}
                                      >
                                        {STATUS_LABELS[o.status] || o.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-[12px] text-gray-600 dark:text-neutral-400 whitespace-nowrap">
                                      {o.customerName || "—"}
                                    </td>
                                    <td className="py-2.5 px-3 text-[12px] text-gray-600 dark:text-neutral-400 whitespace-nowrap">
                                      {staff}
                                    </td>
                                    <td className="py-2.5 px-3 text-[12px] text-gray-600 dark:text-neutral-400 whitespace-nowrap">
                                      {itemCount > 0 ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setItemsDropdownId(
                                              itemsDropdownId === o.id
                                                ? null
                                                : o.id,
                                            );
                                          }}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                                        >
                                          {itemCount} item
                                          {itemCount !== 1 ? "s" : ""}
                                          <ChevronDown
                                            className={`w-3 h-3 transition-transform ${itemsDropdownId === o.id ? "rotate-180" : ""}`}
                                          />
                                        </button>
                                      ) : (
                                        "—"
                                      )}
                                      {itemsDropdownId === o.id && (
                                        <div className="absolute mt-1 z-10 min-w-[180px] bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl p-2 space-y-1">
                                          {items.map((it, idx) => (
                                            <div
                                              key={idx}
                                              className="flex items-center justify-between gap-3 text-[11px]"
                                            >
                                              <span className="text-gray-700 dark:text-neutral-300 truncate">
                                                {it.name}
                                              </span>
                                              <span className="font-bold text-gray-500 dark:text-neutral-500 flex-shrink-0">
                                                ×{it.qty}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-[12px] text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                      {fmtRs(o.total)}
                                    </td>
                                    <td className="py-2.5 px-3 text-[12px] whitespace-nowrap relative">
                                      {renderPaymentCell(o, o.id)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderDiscounts() {
    if (discountReportLoading) {
      return (
        <div className="flex items-center justify-center gap-2 py-20 text-gray-500 dark:text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading discount report…
        </div>
      );
    }
    if (!discountReport) {
      return (
        <p className="text-sm text-gray-500 dark:text-neutral-400 py-12 text-center">
          No discount data for this period.
        </p>
      );
    }
    const byReason = discountReport.byReason || [];
    const byStaff = discountReport.byStaff || [];
    const byDay = discountReport.byDay || [];
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
            Summary
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-6">
            <div>
              <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                {fmtRs(discountReport.totalDiscount || 0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-neutral-400">
                Total discounts (paid orders)
              </p>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-800 dark:text-neutral-200">
                {discountReport.orderCount ?? 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-neutral-400">
                Orders with a discount
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
              By reason
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-neutral-400 border-b border-gray-100 dark:border-neutral-800">
                    <th className="pb-2 pr-2">Reason</th>
                    <th className="pb-2 pr-2">Orders</th>
                    <th className="pb-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byReason.map((row) => (
                    <tr
                      key={row.reason}
                      className="border-b border-gray-50 dark:border-neutral-900"
                    >
                      <td className="py-2 pr-2 text-gray-800 dark:text-neutral-200">
                        {formatDiscountReasonLabel(row.reason)}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{row.count}</td>
                      <td className="py-2 tabular-nums font-semibold">
                        {fmtRs(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
              By staff
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-neutral-400 border-b border-gray-100 dark:border-neutral-800">
                    <th className="pb-2 pr-2">Staff</th>
                    <th className="pb-2 pr-2">Orders</th>
                    <th className="pb-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byStaff.map((row) => (
                    <tr
                      key={row.staffId}
                      className="border-b border-gray-50 dark:border-neutral-900"
                    >
                      <td className="py-2 pr-2 text-gray-800 dark:text-neutral-200">
                        {row.name || "Unknown"}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{row.count}</td>
                      <td className="py-2 tabular-nums font-semibold">
                        {fmtRs(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-sm lg:col-span-1">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
              By day
            </h3>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-neutral-400 border-b border-gray-100 dark:border-neutral-800 sticky top-0 bg-white dark:bg-neutral-950">
                    <th className="pb-2 pr-2">Day</th>
                    <th className="pb-2 pr-2">Orders</th>
                    <th className="pb-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byDay.map((row) => (
                    <tr
                      key={row.day}
                      className="border-b border-gray-50 dark:border-neutral-900"
                    >
                      <td className="py-2 pr-2 font-medium text-gray-800 dark:text-neutral-200">
                        {row.day}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{row.count}</td>
                      <td className="py-2 tabular-nums font-semibold">
                        {fmtRs(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderActiveTab() {
    switch (activeTab) {
      case "orders":
        return renderOrders();
      case "discounts":
        return renderDiscounts();
      case "sessions":
        return renderSessions();
      default:
        return renderOverview();
    }
  }

  return (
    <AdminLayout title="Sales & Reports" suspended={suspended}>
      {pageLoading ? (
        <SalesReportScreenSkeleton />
      ) : (
        <div className="space-y-5">
          {/* ── Toolbar: Tabs (left) + Date & Export (right) ── */}
          <div className="flex items-center justify-between gap-3">
            {/* Tabs */}
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/90 shadow-sm backdrop-blur-sm">
              <nav className="flex flex-wrap sm:flex-nowrap items-stretch gap-1 p-1 sm:p-1.5 overflow-x-auto" aria-label="Report views">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                let badge = null;
                if (tab.id === "orders")
                  badge = dateFilteredOrdersCount || null;
                if (tab.id === "sessions") badge = sessionsTotal || null;
                if (tab.id === "discounts" && discountReport?.orderCount != null)
                  badge = discountReport.orderCount;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id === "sessions" && sessionsList.length === 0)
                        loadSessions(0);
                    }}
                    className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all min-h-[2.5rem] sm:min-h-0 ${
                      isActive
                        ? "bg-orange-500 text-white shadow-md shadow-orange-500/25 ring-1 ring-orange-400/30"
                        : "text-gray-600 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white border border-transparent hover:border-gray-200 dark:hover:border-neutral-700"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "opacity-95" : "opacity-70"}`} aria-hidden />
                    {tab.label}
                    {badge != null && (
                      <span
                        className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${isActive ? "bg-white/25 text-white" : "bg-gray-200 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300"}`}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
              </nav>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Sessions view toggle — only on sessions tab */}
              {activeTab === "sessions" && (
                <>
                  {/* Sessions date filter */}
                  {(() => {
                    const SESSION_DATE_PRESETS = [
                      { id: "all", label: "All Time" },
                      { id: "yesterday", label: "Yesterday" },
                      { id: "last3days", label: "Last 3 Days" },
                      { id: "this_week", label: "This Week" },
                      { id: "this_month", label: "This Month" },
                      { id: "custom", label: "Custom" },
                    ];
                    const getSessionPresetDates = (id) => {
                      const today = new Date();
                      const fmt = (d) => d.toISOString().slice(0, 10);
                      switch (id) {
                        case "yesterday": {
                          const y = new Date(today); y.setDate(y.getDate() - 1);
                          return { from: fmt(y), to: fmt(y) };
                        }
                        case "last3days": {
                          const s = new Date(today); s.setDate(s.getDate() - 2);
                          return { from: fmt(s), to: fmt(today) };
                        }
                        case "this_week": {
                          const dow = today.getDay();
                          const diff = dow === 0 ? -6 : 1 - dow;
                          const mon = new Date(today); mon.setDate(today.getDate() + diff);
                          return { from: fmt(mon), to: fmt(today) };
                        }
                        case "this_month": {
                          const first = new Date(today.getFullYear(), today.getMonth(), 1);
                          return { from: fmt(first), to: fmt(today) };
                        }
                        default: return { from: "", to: "" };
                      }
                    };
                    const activePreset = SESSION_DATE_PRESETS.find(p => p.id === sessionsDatePreset);
                    const isFiltered = sessionsDatePreset !== "all";
                    const presetLabel = sessionsDatePreset === "custom" && (sessionsDateFrom || sessionsDateTo)
                      ? `${sessionsDateFrom || "…"} → ${sessionsDateTo || "…"}`
                      : activePreset?.label || "All Time";
                    return (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowSessionsDateDropdown(v => !v)}
                          className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                            isFiltered
                              ? "border-primary/40 bg-primary/5 dark:bg-primary/10 text-primary"
                              : "border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-700 dark:text-neutral-300 hover:border-primary/40"
                          }`}
                        >
                          <Calendar className={`w-3.5 h-3.5 ${isFiltered ? "text-primary" : "text-gray-400"}`} />
                          {presetLabel}
                          {isFiltered ? (
                            <span
                              className="hover:text-red-500 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSessionsDatePreset("all");
                                setSessionsDateFrom("");
                                setSessionsDateTo("");
                                setSessionsPage(0);
                                loadSessions(0, "", "");
                                setShowSessionsDateDropdown(false);
                              }}
                            >
                              <X className="w-3 h-3" />
                            </span>
                          ) : (
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSessionsDateDropdown ? "rotate-180" : ""}`} />
                          )}
                        </button>
                        {showSessionsDateDropdown && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowSessionsDateDropdown(false)} />
                            <div className="absolute right-0 top-full mt-1.5 z-50 w-64 bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 rounded-2xl shadow-xl overflow-hidden">
                              <div className="p-2 space-y-0.5">
                                {SESSION_DATE_PRESETS.filter(p => p.id !== "custom").map(p => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      setSessionsDatePreset(p.id);
                                      const { from, to } = getSessionPresetDates(p.id);
                                      setSessionsDateFrom(from);
                                      setSessionsDateTo(to);
                                      setSessionsPage(0);
                                      loadSessions(0, from, to);
                                      setShowSessionsDateDropdown(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                                      sessionsDatePreset === p.id
                                        ? "bg-gradient-to-r from-primary to-secondary text-white"
                                        : "text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                                    }`}
                                  >
                                    {p.label}
                                  </button>
                                ))}
                                {/* Custom range */}
                                <div className="pt-1 mt-1 border-t border-gray-100 dark:border-neutral-800">
                                  <p className="px-3 py-1 text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Custom Range</p>
                                  <div className="px-3 pb-2 space-y-2">
                                    <div>
                                      <label className="text-[10px] text-gray-400 dark:text-neutral-500 font-medium">From</label>
                                      <input
                                        type="date"
                                        value={sessionsDateFrom}
                                        onChange={(e) => {
                                          setSessionsDateFrom(e.target.value);
                                          setSessionsDatePreset("custom");
                                        }}
                                        className="mt-0.5 w-full h-8 px-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-xs text-gray-700 dark:text-neutral-300 outline-none focus:border-primary"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-gray-400 dark:text-neutral-500 font-medium">To</label>
                                      <input
                                        type="date"
                                        value={sessionsDateTo}
                                        onChange={(e) => {
                                          setSessionsDateTo(e.target.value);
                                          setSessionsDatePreset("custom");
                                        }}
                                        className="mt-0.5 w-full h-8 px-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-xs text-gray-700 dark:text-neutral-300 outline-none focus:border-primary"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      disabled={!sessionsDateFrom && !sessionsDateTo}
                                      onClick={() => {
                                        setSessionsPage(0);
                                        loadSessions(0, sessionsDateFrom, sessionsDateTo);
                                        setShowSessionsDateDropdown(false);
                                      }}
                                      className="w-full h-8 rounded-lg bg-gradient-to-r from-primary to-secondary text-white text-xs font-semibold disabled:opacity-40 transition-opacity"
                                    >
                                      Apply
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex items-center bg-gray-100 dark:bg-neutral-800 rounded-lg p-0.5 gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSessionsViewMode("daily");
                        setExpandedDays(new Set());
                      }}
                      className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-[11px] font-semibold transition-all ${
                        sessionsViewMode === "daily"
                          ? "bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200"
                      }`}
                    >
                      <BarChart3 className="w-3 h-3" />
                      Daily
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionsViewMode("sessions")}
                      className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-[11px] font-semibold transition-all ${
                        sessionsViewMode === "sessions"
                          ? "bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200"
                      }`}
                    >
                      <CalendarDays className="w-3 h-3" />
                      All sessions
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadSessions(sessionsPage)}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-400 hover:text-gray-600 hover:border-primary/40 transition-all"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${sessionsLoading ? "animate-spin" : ""}`} />
                  </button>
                </>
              )}
              {/* Date + Export + Help — hidden on sessions tab */}
              {activeTab !== "sessions" && (
              <>
              {/* Date dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowDateDropdown((v) => !v);
                    setShowExportDropdown(false);
                  }}
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs font-semibold text-gray-900 dark:text-white hover:border-primary/40 transition-all"
                >
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  {periodLabel}
                  {loading && (
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showDateDropdown ? "rotate-180" : ""}`}
                  />
                </button>
                {showDateDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowDateDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 rounded-2xl shadow-xl overflow-hidden">
                      <div className="p-2 space-y-0.5">
                        {PRESETS.filter((p) => p.id !== "custom").map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              applyPreset(p.id);
                              setShowDateDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                              preset === p.id
                                ? "bg-gradient-to-r from-primary to-secondary text-white"
                                : "text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 dark:border-neutral-800 p-3">
                        <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400 mb-2">
                          Custom Range
                        </p>
                        <form
                          onSubmit={(e) => {
                            applyCustom(e);
                            setShowDateDropdown(false);
                          }}
                          className="space-y-2"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="date"
                              value={customFrom}
                              onChange={(e) => {
                                setCustomFrom(e.target.value);
                                setPreset("custom");
                              }}
                              className="h-8 px-2.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary transition-all"
                            />
                            <input
                              type="date"
                              value={customTo}
                              onChange={(e) => {
                                setCustomTo(e.target.value);
                                setPreset("custom");
                              }}
                              className="h-8 px-2.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary transition-all"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={loading || (!customFrom && !customTo)}
                            className="w-full h-8 rounded-lg bg-gradient-to-r from-primary to-secondary text-white text-xs font-semibold hover:shadow-md hover:shadow-primary/25 transition-all disabled:opacity-50"
                          >
                            {loading ? "Loading..." : "Apply Range"}
                          </button>
                        </form>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Export dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowExportDropdown((v) => !v);
                    setShowDateDropdown(false);
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs font-semibold text-gray-700 dark:text-neutral-300 hover:border-primary/40 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                  <ChevronDown
                    className={`w-3 h-3 text-gray-400 transition-transform ${showExportDropdown ? "rotate-180" : ""}`}
                  />
                </button>
                {showExportDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowExportDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-80 bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden p-1.5">
                      {activeTab === "orders" && (
                        <div className="mb-1 border-b border-gray-100 dark:border-neutral-800 pb-1.5">
                          <div className="px-2 py-1 flex items-center justify-between gap-2">
                            <p className="text-[10px] font-semibold text-gray-500 dark:text-neutral-400">
                              Select columns
                            </p>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setOrdersExportColumns(
                                    ORDER_EXPORT_COLUMN_OPTIONS.map((c) => c.key),
                                  )
                                }
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-primary hover:bg-primary/10 transition-colors"
                              >
                                Select all
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setOrdersExportColumns([
                                    "orderNumber",
                                    "status",
                                    "grandTotal",
                                    "type",
                                    "payment",
                                    "paid",
                                    "customer",
                                    "created",
                                  ])
                                }
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                              >
                                Default
                              </button>
                            </div>
                          </div>
                          <div className="max-h-72 overflow-auto px-2 grid grid-cols-2 gap-x-3 gap-y-1">
                            {ORDER_EXPORT_COLUMN_OPTIONS.map((col) => (
                              <label
                                key={col.key}
                                className="flex items-center gap-2 text-[11px] text-gray-700 dark:text-neutral-300"
                              >
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 accent-primary"
                                  checked={ordersExportColumns.includes(
                                    col.key,
                                  )}
                                  onChange={(e) => {
                                    setOrdersExportColumns((prev) =>
                                      e.target.checked
                                        ? [...prev, col.key]
                                        : prev.filter((k) => k !== col.key),
                                    );
                                  }}
                                />
                                {col.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          handleExportCSV();
                          setShowExportDropdown(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                        CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handlePrint();
                          setShowExportDropdown(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handlePrint();
                          setShowExportDropdown(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5 text-violet-600" />
                        Print
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Help */}
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="h-9 w-9 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary/40 transition-all"
                title="How does date filtering work?"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              </>
              )}
            </div>
          </div>

          {/* ── Active tab content ── */}
          {renderActiveTab()}
        </div>
      )}

      {/* ── Help modal ── */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                How date filtering works
              </h3>
            </div>
            <div className="space-y-3 text-sm text-gray-700 dark:text-neutral-300">
              <p>
                All date presets use your <strong>business day sessions</strong>{" "}
                so reports match your actual session boundaries.
              </p>
              <p>
                <strong>Yesterday</strong> covers the most recently closed
                session (e.g. 5 PM – 4 AM).
              </p>
              <p>
                <strong>Today</strong> covers the current open session from its
                start time to now.
              </p>
              <p>
                <strong>Custom range</strong>: "From" includes from the start of
                that day, "To" includes up to the end of that day.
              </p>
              <p className="text-gray-500 dark:text-neutral-400">
                Only <strong>delivered</strong> orders count towards revenue.
                Cancelled orders are tracked separately.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedOrderDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setSelectedOrderDetail(null)}
        >
          <div
            className="bg-white dark:bg-neutral-950 border border-gray-200/80 dark:border-neutral-800 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-gray-100 dark:border-neutral-800 flex items-start justify-between bg-gradient-to-b from-gray-50/80 to-white dark:from-neutral-900/60 dark:to-neutral-950">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-neutral-500">
                  Order Details
                </p>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight truncate mt-0.5">
                  #{selectedOrderDetail.orderNumber || selectedOrderDetail.id?.slice(-4)}
                </h3>
                <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1.5">
                  {selectedOrderDetail.createdAt
                    ? new Date(selectedOrderDetail.createdAt).toLocaleString("en-PK")
                    : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[selectedOrderDetail.status] || "bg-gray-100 text-gray-500"}`}>
                  {STATUS_LABELS[selectedOrderDetail.status] || selectedOrderDetail.status || "—"}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedOrderDetail(null)}
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(88vh-84px)] space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-950 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-neutral-500 mb-3">
                    Order Info
                  </p>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-gray-500 dark:text-neutral-500">Type</span><span className="font-semibold text-gray-900 dark:text-white">{(selectedOrderDetail.orderType || "").replace(/_/g, " ") || "—"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500 dark:text-neutral-500">Source</span><span className="font-semibold text-gray-900 dark:text-white">{selectedOrderDetail.source || "POS"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500 dark:text-neutral-500">Table</span><span className="font-semibold text-gray-900 dark:text-white">{selectedOrderDetail.tableName || "—"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500 dark:text-neutral-500">Payment</span><span className="font-semibold text-gray-900 dark:text-white">{selectedOrderDetail.isPaid ? selectedOrderDetail.paymentMethod || "Paid" : "Unpaid"}</span></div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-950 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-neutral-500 mb-3">
                    Customer & Staff
                  </p>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-gray-500 dark:text-neutral-500">Customer</span><span className="font-semibold text-gray-900 dark:text-white">{selectedOrderDetail.customerName || "—"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500 dark:text-neutral-500">Phone</span><span className="font-semibold text-gray-900 dark:text-white">{selectedOrderDetail.customerPhone || "—"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500 dark:text-neutral-500">Staff</span><span className="font-semibold text-gray-900 dark:text-white text-right">{selectedOrderDetail.assignedRiderName || selectedOrderDetail.riderName ? `Rider: ${selectedOrderDetail.assignedRiderName || selectedOrderDetail.riderName}` : selectedOrderDetail.waiterName ? `Waiter: ${selectedOrderDetail.waiterName}` : selectedOrderDetail.orderTakerName ? `Taker: ${selectedOrderDetail.orderTakerName}` : selectedOrderDetail.createdBy?.name ? `Taker: ${selectedOrderDetail.createdBy.name}` : "—"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500 dark:text-neutral-500">Address</span><span className="font-semibold text-gray-900 dark:text-white text-right">{selectedOrderDetail.deliveryAddress || "—"}</span></div>
                  </div>
                </div>
              </div>

              {String(selectedOrderDetail.paymentMethod || "").toUpperCase() === "SPLIT" && (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-gradient-to-r from-amber-50/80 to-orange-50/40 dark:from-amber-500/10 dark:to-amber-500/5 p-4 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300 mb-2.5">
                    Split Payment
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-sm">
                    <div className="rounded-xl bg-white/90 dark:bg-neutral-900/70 px-3.5 py-2.5 border border-amber-100 dark:border-amber-500/20"><p className="text-[10px] uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">Cash</p><p className="font-extrabold text-amber-900 dark:text-amber-100 text-base">{fmtRs(Number(selectedOrderDetail.splitCashAmount) || 0)}</p></div>
                    <div className="rounded-xl bg-white/90 dark:bg-neutral-900/70 px-3.5 py-2.5 border border-amber-100 dark:border-amber-500/20"><p className="text-[10px] uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">Card</p><p className="font-extrabold text-amber-900 dark:text-amber-100 text-base">{fmtRs(Number(selectedOrderDetail.splitCardAmount) || 0)}</p></div>
                    <div className="rounded-xl bg-white/90 dark:bg-neutral-900/70 px-3.5 py-2.5 border border-amber-100 dark:border-amber-500/20"><p className="text-[10px] uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">Online</p><p className="font-extrabold text-amber-900 dark:text-amber-100 text-base">{fmtRs(Number(selectedOrderDetail.splitOnlineAmount) || 0)}</p><p className="text-[10px] text-amber-700/80 dark:text-amber-300/80 truncate mt-0.5">{selectedOrderDetail.splitOnlineProvider || "—"}</p></div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-neutral-400">
                    Items
                  </p>
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400">
                    {(selectedOrderDetail.items || []).reduce((s, it) => s + Number(it.qty || it.quantity || 1), 0)} qty
                  </p>
                </div>
                {(selectedOrderDetail.items || []).length === 0 ? (
                  <p className="px-4 py-4 text-sm text-gray-500 dark:text-neutral-500">
                    No item details found.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50/70 dark:bg-neutral-900/40 text-[11px] uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                      <tr>
                        <th className="text-left px-4 py-2 font-semibold">Item</th>
                        <th className="text-center px-2 py-2 font-semibold">Qty</th>
                        <th className="text-right px-4 py-2 font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                      {(selectedOrderDetail.items || []).map((it, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/70 dark:hover:bg-neutral-900/40">
                          <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{it.name || "Item"}</td>
                          <td className="px-2 py-2.5 text-center text-gray-600 dark:text-neutral-400">{it.qty || it.quantity || 1}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">{fmtRs(Number(it.lineTotal ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm p-4 bg-white dark:bg-neutral-950">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-neutral-500 mb-3">
                  Order total breakdown
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500 dark:text-neutral-400">Items subtotal</span>
                    <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                      {fmtRs(Number(selectedOrderDetail.subtotal ?? 0))}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500 dark:text-neutral-400">Delivery fee</span>
                    <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                      {fmtRs(Number(selectedOrderDetail.deliveryCharges ?? 0))}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500 dark:text-neutral-400">Discount</span>
                    <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                      {fmtRs(Number(selectedOrderDetail.discountAmount ?? 0))}
                    </span>
                  </div>
                  <div className="border-t border-gray-100 dark:border-neutral-800 pt-2 mt-2 flex justify-between gap-3 items-baseline">
                    <span className="font-bold text-gray-900 dark:text-white">Total</span>
                    <span className="text-lg font-black text-primary tabular-nums">
                      {fmtRs(Number(selectedOrderDetail.grandTotal ?? selectedOrderDetail.total ?? 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
