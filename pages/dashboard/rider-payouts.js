import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getOrders,
  getDaySessions,
  getCurrencySymbol,
} from "../../lib/apiClient";
import { useBranch } from "../../contexts/BranchContext";
import {
  Truck,
  Loader2,
  Download,
  RefreshCw,
  ChevronDown,
  BookOpen,
  ArrowUpCircle,
} from "lucide-react";
import toast from "react-hot-toast";

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week", label: "This week" },
  { id: "this_month", label: "This month" },
  { id: "custom", label: "Custom" },
];

/** Default COA expense account for rider payments (Chart of Accounts → Expenses). Override via query if your code differs. */
const DEFAULT_RIDER_EXPENSE_ACCOUNT_CODE = "602";

function buildCashPaymentHref({ amount, riderName, periodLabel }) {
  const params = new URLSearchParams();
  params.set("expenseAccountCode", DEFAULT_RIDER_EXPENSE_ACCOUNT_CODE);
  const n = amount != null ? Math.round(Number(amount)) : 0;
  if (n > 0) params.set("suggestedAmount", String(n));
  if (riderName) params.set("riderName", String(riderName));
  const note = riderName
    ? `Rider payout — ${riderName}${periodLabel ? ` (${periodLabel})` : ""}`
    : periodLabel
      ? `Rider payouts — ${periodLabel}`
      : "Rider allowances";
  params.set("notes", note);
  return `/accounting/vouchers/cash-payment?${params.toString()}`;
}

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
    default:
      return null;
  }
}

function getSmartDates(preset, sessions) {
  const now = new Date();
  if (sessions && sessions.length > 0) {
    if (preset === "today") {
      const openSess = sessions.find((s) => s.status === "OPEN");
      if (openSess?.startAt) {
        const openDateStr = new Date(openSess.startAt).toDateString();
        const todaySessions = sessions.filter(
          (s) =>
            s.startAt && new Date(s.startAt).toDateString() === openDateStr,
        );
        const earliestStartMs = todaySessions.reduce(
          (min, s) => Math.min(min, new Date(s.startAt).getTime()),
          new Date(openSess.startAt).getTime(),
        );
        const fromMs = earliestStartMs - 10 * 60 * 1000;
        return { from: new Date(fromMs).toISOString(), to: now.toISOString() };
      }
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
      const lastClosed = sessions.find((s) => s.status === "CLOSED");
      if (lastClosed?.startAt && lastClosed?.endAt)
        return { from: lastClosed.startAt, to: lastClosed.endAt };
    }
  }
  return getCalendarDates(preset);
}

/** Always use date range for orders (same semantics as Sales report orders list). */
function getOrdersQuery(preset, sessions) {
  return getSmartDates(preset, sessions) || getCalendarDates(preset);
}

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

function fmtRs(v) {
  return `${getCurrencySymbol()} ${Math.round(Number(v) || 0).toLocaleString()}`;
}

/** Human-readable order ref + Mongo id for deep links (mapOrder uses orderNumber or _id as `id`). */
function getOrderDisplayFields(o) {
  const mongoId =
    o._id ||
    (typeof o.id === "string" && /^[a-f0-9]{24}$/i.test(o.id) ? o.id : null);
  const label =
    o.orderNumber ||
    (mongoId
      ? `ORD-${String(mongoId).slice(-6).toUpperCase()}`
      : o.id
        ? String(o.id)
        : "—");
  return { mongoId, label };
}

function buildPeriodLabel(preset, customFrom, customTo) {
  if (preset === "custom") {
    if (customFrom && customTo) return `${customFrom} — ${customTo}`;
    return "Custom range";
  }
  return PRESETS.find((p) => p.id === preset)?.label || "";
}

export default function RiderPayoutsPage() {
  const { currentBranch } = useBranch();
  const [preset, setPreset] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sessions, setSessions] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async (dates) => {
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
    } catch {
      setAllOrders([]);
    }
  }, []);

  const loadSessionsAndOrders = useCallback(
    async (presetId, customRange) => {
      setRefreshing(true);
      try {
        let loadedSessions = [];
        try {
          const res = await getDaySessions(currentBranch?.id, { limit: 30 });
          loadedSessions = Array.isArray(res?.sessions) ? res.sessions : [];
          setSessions(loadedSessions);
        } catch {
          setSessions([]);
        }
        let q;
        if (presetId === "custom" && customRange?.from && customRange?.to) {
          q = {
            from: new Date(customRange.from + "T00:00:00").toISOString(),
            to: new Date(customRange.to + "T23:59:59.999").toISOString(),
          };
        } else {
          q = getOrdersQuery(presetId, loadedSessions);
        }
        await loadOrders(q);
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [currentBranch?.id, loadOrders],
  );

  useEffect(() => {
    if (preset === "custom") {
      setAllOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadSessionsAndOrders(preset, null);
  }, [currentBranch?.id, preset, loadSessionsAndOrders]);

  const activeDateRange = useMemo(() => {
    if (preset === "custom") {
      return {
        from: customFrom ? new Date(customFrom + "T00:00:00") : null,
        to: customTo ? new Date(customTo + "T23:59:59.999") : null,
      };
    }
    if (preset === "today" && sessions?.length) {
      const open = sessions.find((s) => s.status === "OPEN");
      if (open?.startAt) {
        const openDateStr = new Date(open.startAt).toDateString();
        const todaySessions = sessions.filter(
          (s) =>
            s.startAt && new Date(s.startAt).toDateString() === openDateStr,
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

  const riderDeliveryFeeRows = useMemo(() => {
    const rows = [];
    for (const o of dateFilteredOrders) {
      if (String(o.type || "").toLowerCase() !== "delivery") continue;
      if (!o.assignedRiderName) continue;
      const dc = Math.round(Number(o.deliveryCharges) || 0);
      const { mongoId, label: orderLabel } = getOrderDisplayFields(o);
      rows.push({
        id: mongoId || o.id || o._id,
        orderLabel,
        orderMongoId: mongoId,
        riderName: o.assignedRiderName,
        deliveryCharges: dc,
        grandTotal: Math.round(Number(o.grandTotal ?? o.total) || 0),
        status: o.status,
        isPaid: !!o.isPaid,
        createdAt: o.createdAt,
      });
    }
    rows.sort((a, b) => {
      const c = a.riderName.localeCompare(b.riderName);
      if (c !== 0) return c;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
    return rows;
  }, [dateFilteredOrders]);

  const riderTotalsByName = useMemo(() => {
    const m = {};
    for (const r of riderDeliveryFeeRows) {
      if (r.status === "CANCELLED") continue;
      if (!m[r.riderName])
        m[r.riderName] = { name: r.riderName, deliveryFees: 0, orders: 0 };
      m[r.riderName].deliveryFees += r.deliveryCharges;
      m[r.riderName].orders += 1;
    }
    return Object.values(m).sort((a, b) => b.deliveryFees - a.deliveryFees);
  }, [riderDeliveryFeeRows]);

  const summary = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const r of riderDeliveryFeeRows) {
      if (r.status === "CANCELLED") continue;
      total += r.deliveryCharges;
      count += 1;
    }
    return { total, count };
  }, [riderDeliveryFeeRows]);

  const periodLabel = buildPeriodLabel(preset, customFrom, customTo);

  function applyPreset(id) {
    setPreset(id);
  }

  function applyCustom(e) {
    e.preventDefault();
    if (!customFrom || !customTo) {
      toast.error("Choose both dates");
      return;
    }
    setPreset("custom");
    setLoading(true);
    loadSessionsAndOrders("custom", { from: customFrom, to: customTo });
  }

  const selectCls = (active) =>
    `h-9 px-3 pr-8 rounded-lg text-xs font-semibold appearance-none cursor-pointer border transition-colors ${
      active
        ? "bg-primary/10 text-primary border-primary/30"
        : "bg-gray-50 dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-700"
    }`;

  return (
    <AdminLayout title="Rider payouts">
      <div className="space-y-6 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1 max-w-2xl">
              Operational totals from delivery orders. To recognise payouts in
              your books, post a{" "}
              <span className="font-medium text-gray-700 dark:text-neutral-300">
                Cash Payment
              </span>{" "}
              from Cash in Hand to expense account{" "}
              <span className="font-medium text-gray-700 dark:text-neutral-300">
                {DEFAULT_RIDER_EXPENSE_ACCOUNT_CODE} Rider Allowances
              </span>{" "}
              (or the account you use in{" "}
              <Link
                href="/accounting/chart-of-accounts"
                className="text-primary hover:underline font-medium"
              >
                Chart of Accounts
              </Link>
              ).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {["today", "this_week", "this_month"].map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyPreset(id)}
                  className={`h-8 px-2.5 rounded-lg text-xs font-semibold border transition-colors ${
                    preset === id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  {PRESETS.find((p) => p.id === id)?.label || id}
                </button>
              ))}
            </div>
            <div className="relative">
              <select
                value={preset}
                onChange={(e) => applyPreset(e.target.value)}
                className={selectCls(true)}
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                if (preset === "custom" && customFrom && customTo) {
                  loadSessionsAndOrders("custom", {
                    from: customFrom,
                    to: customTo,
                  });
                } else if (preset !== "custom") {
                  loadSessionsAndOrders(preset, null);
                } else {
                  toast.error("Choose both dates and click Apply");
                }
              }}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {!loading && summary.count > 0 && (
          <div className="rounded-xl border border-amber-200/80 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Record in books (Chart of Accounts)
                </p>
                <p className="text-xs text-gray-600 dark:text-neutral-400 mt-0.5 max-w-xl">
                  Open Cash Payment with line 1 prefilled to{" "}
                  <span className="font-mono">
                    {DEFAULT_RIDER_EXPENSE_ACCOUNT_CODE}
                  </span>{" "}
                  and this period&apos;s total. Adjust the amount if your payout
                  rule differs from fees collected.
                </p>
              </div>
            </div>
            <Link
              href={buildCashPaymentHref({
                amount: summary.total,
                periodLabel: periodLabel,
              })}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold shadow-sm shrink-0"
            >
              <ArrowUpCircle className="w-4 h-4" />
              Cash payment — rider total
            </Link>
          </div>
        )}

        {preset === "custom" && (
          <form
            onSubmit={applyCustom}
            className="flex flex-wrap items-end gap-2 p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950"
          >
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">
                From
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 px-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">
                To
              </label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 px-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
              />
            </div>
            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold"
            >
              Apply
            </button>
          </form>
        )}

        {loading && allOrders.length === 0 ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Period
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                  {periodLabel}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5 p-4">
                <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                  Total delivery fees
                </p>
                <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mt-1 tabular-nums">
                  {fmtRs(summary.total)}
                </p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                  Excludes cancelled · {summary.count} orders
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Riders
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                  {riderTotalsByName.length}
                </p>
              </div>
            </div>

            {riderTotalsByName.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                    By rider
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    Sum of delivery fees charged on each rider&apos;s orders
                  </p>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {riderTotalsByName.map((r) => (
                    <div
                      key={r.name}
                      className="flex items-center justify-between px-4 py-3 gap-3"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">
                        {r.name}
                      </span>
                      <div className="text-right flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <div>
                          <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                            {fmtRs(r.deliveryFees)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-neutral-500 ml-2">
                            ({r.orders} orders)
                          </span>
                        </div>
                        {r.deliveryFees > 0 && (
                          <Link
                            href={buildCashPaymentHref({
                              amount: r.deliveryFees,
                              riderName: r.name,
                              periodLabel,
                            })}
                            className="inline-flex items-center h-8 px-3 rounded-lg bg-primary/10 text-primary border border-primary/25 text-xs font-semibold hover:bg-primary/15 whitespace-nowrap"
                          >
                            Mark as paid
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {riderDeliveryFeeRows.length > 0 ? (
              <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
                <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-neutral-800">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      Per-order detail
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-neutral-400">
                      Export for your records; apply your own payout rules per
                      rider.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      downloadCSV(
                        `rider-payouts-${preset}-${new Date().toISOString().slice(0, 10)}.csv`,
                        [
                          [
                            "Order #",
                            "Rider",
                            "Delivery fee (charged)",
                            "Order total",
                            "Status",
                            "Paid",
                            "Created (ISO)",
                          ],
                          ...riderDeliveryFeeRows.map((r) => [
                            r.orderLabel || "",
                            r.riderName,
                            r.deliveryCharges,
                            r.grandTotal,
                            r.status,
                            r.isPaid ? "Yes" : "No",
                            r.createdAt
                              ? new Date(r.createdAt).toISOString()
                              : "",
                          ]),
                        ],
                      );
                      toast.success("CSV downloaded");
                    }}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/40">
                        <th className="py-2.5 px-4 font-semibold">Order</th>
                        <th className="py-2.5 px-4 font-semibold">Rider</th>
                        <th className="py-2.5 px-4 font-semibold text-right">
                          Delivery fee
                        </th>
                        <th className="py-2.5 px-4 font-semibold text-right">
                          Order total
                        </th>
                        <th className="py-2.5 px-4 font-semibold">Status</th>
                        <th className="py-2.5 px-4 font-semibold">Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                      {riderDeliveryFeeRows.map((r) => (
                        <tr
                          key={String(r.id)}
                          className={
                            r.status === "CANCELLED"
                              ? "opacity-45"
                              : "hover:bg-gray-50/60 dark:hover:bg-neutral-900/30"
                          }
                        >
                          <td className="py-2.5 px-4 font-mono text-xs text-gray-900 dark:text-white">
                            {r.orderMongoId ? (
                              <Link
                                href={`/dashboard/orders?editOrder=${encodeURIComponent(r.orderMongoId)}`}
                                className="text-primary font-semibold hover:underline"
                              >
                                {r.orderLabel}
                              </Link>
                            ) : (
                              r.orderLabel || "—"
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-gray-900 dark:text-white">
                            {r.riderName}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                            {fmtRs(r.deliveryCharges)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-gray-700 dark:text-neutral-300">
                            {fmtRs(r.grandTotal)}
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                STATUS_COLORS[r.status] ||
                                "bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300"
                              }`}
                            >
                              {STATUS_LABELS[r.status] || r.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            {r.isPaid ? (
                              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                                Yes
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                                No
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-neutral-700 p-10 text-center text-sm text-gray-500 dark:text-neutral-400">
                No delivery orders with an assigned rider in this period.
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
