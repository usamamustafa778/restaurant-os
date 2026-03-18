import { useEffect, useState, useMemo, useCallback } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getDaySessions,
  getDaySessionOrders,
  SubscriptionInactiveError,
} from "../../lib/apiClient";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  DollarSign,
  ShoppingBag,
  CreditCard,
  Banknote,
  TrendingUp,
  Package,
  User,
  Bike,
  RefreshCw,
  ClipboardList,
  X,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";
import { useBranch } from "../../contexts/BranchContext";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
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

function fmtRs(n) {
  return `Rs ${(n || 0).toLocaleString()}`;
}

const TH_CLS =
  "py-2.5 px-3 text-left text-[11px] font-semibold text-gray-500 dark:text-neutral-400 whitespace-nowrap uppercase tracking-wide";
const TD_CLS =
  "py-2.5 px-3 text-[12px] text-gray-700 dark:text-neutral-300 whitespace-nowrap";

const STATUS_COLORS = {
  DELIVERED:
    "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  COMPLETED:
    "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  CANCELLED:
    "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400",
  NEW_ORDER:
    "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
  PROCESSING:
    "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
  READY:
    "bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400",
  OUT_FOR_DELIVERY:
    "bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

const STATUS_LABELS = {
  DELIVERED: "Closed",
  COMPLETED: "Closed",
  CANCELLED: "Cancelled",
  NEW_ORDER: "New",
  PROCESSING: "Preparing",
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for Delivery",
};

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, iconGradient, label, value, sub }) {
  return (
    <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 flex items-start gap-3">
      <div
        className={`h-9 w-9 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 ${iconGradient || "bg-gray-200 dark:bg-neutral-800"}`}
      >
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight mt-0.5">
          {value}
        </p>
        {sub && (
          <p className="text-[11px] text-gray-400 dark:text-neutral-500 mt-0.5">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Orders table for a session ────────────────────────────────────────────────

function SessionOrdersTable({ orders }) {
  const [expandedItems, setExpandedItems] = useState({});
  const [page, setPage] = useState(0);
  const perPage = 20;
  const pages = Math.ceil(orders.length / perPage);
  const visible = orders.slice(page * perPage, page * perPage + perPage);

  function exportCsv() {
    const rows = [
      [
        "Order #", "Date", "Type", "Status", "Customer", "Rider", "Waiter",
        "Items", "Subtotal", "Discount", "Delivery", "Total", "Payment",
      ].join(","),
      ...orders.map((o) => {
        const items = (o.items || []).map((i) => `${i.name} x${i.qty}`).join("; ");
        return [
          o.orderNumber || o.id,
          new Date(o.createdAt).toLocaleString("en-PK"),
          o.orderType || "",
          o.status || "",
          o.customerName || "",
          o.riderName || "",
          o.waiterName || o.orderTakerName || "",
          `"${items}"`,
          o.subtotal || 0,
          o.discountAmount || 0,
          o.deliveryCharge || 0,
          o.total || 0,
          o.paymentMethod || "",
        ].join(",");
      }),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "session-orders.csv";
    a.click();
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-400 dark:text-neutral-600">
        No orders in this session
      </div>
    );
  }

  return (
    <div>
      {/* Export + pagination */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs text-gray-500 dark:text-neutral-400 font-medium">
          {orders.length} orders
        </span>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-800">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-neutral-900/70 border-b border-gray-200 dark:border-neutral-800">
            <tr>
              <th className={TH_CLS}>Order #</th>
              <th className={TH_CLS}>Time</th>
              <th className={TH_CLS}>Type</th>
              <th className={TH_CLS}>Status</th>
              <th className={TH_CLS}>Customer</th>
              <th className={TH_CLS}>Staff</th>
              <th className={TH_CLS}>Items</th>
              <th className={TH_CLS + " text-right"}>Total</th>
              <th className={TH_CLS}>Payment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
            {visible.map((o) => {
              const itemsOpen = expandedItems[o.id];
              const items = o.items || [];
              const itemCount = items.reduce((s, i) => s + (i.qty || 1), 0);
              const staff =
                o.riderName
                  ? `Rider: ${o.riderName}`
                  : o.waiterName
                    ? `Waiter: ${o.waiterName}`
                    : o.orderTakerName
                      ? `Taker: ${o.orderTakerName}`
                      : "—";
              return (
                <tr
                  key={o.id}
                  className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors"
                >
                  <td className={TD_CLS}>
                    <span className="font-bold text-gray-900 dark:text-white">
                      #{o.orderNumber || o.id?.slice(-4)}
                    </span>
                  </td>
                  <td className={TD_CLS}>
                    {o.createdAt
                      ? new Date(o.createdAt).toLocaleTimeString("en-PK", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "—"}
                  </td>
                  <td className={TD_CLS}>
                    <span className="capitalize text-xs">
                      {(o.orderType || "").replace(/_/g, " ").toLowerCase()}
                    </span>
                  </td>
                  <td className={TD_CLS}>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[o.status] || "bg-gray-100 text-gray-500"}`}
                    >
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </td>
                  <td className={TD_CLS}>
                    {o.customerName || "—"}
                  </td>
                  <td className={TD_CLS + " text-xs"}>{staff}</td>
                  <td className={TD_CLS}>
                    {items.length > 0 ? (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedItems((prev) => ({
                              ...prev,
                              [o.id]: !prev[o.id],
                            }))
                          }
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                          {itemCount} item{itemCount !== 1 ? "s" : ""}
                          <ChevronDown
                            className={`w-3 h-3 transition-transform ${itemsOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        {itemsOpen && (
                          <div className="absolute top-full left-0 mt-1 z-10 min-w-[180px] bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl p-2 space-y-1">
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
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className={TD_CLS + " text-right font-bold text-gray-900 dark:text-white"}>
                    {fmtRs(o.total)}
                  </td>
                  <td className={TD_CLS}>
                    {o.paymentMethod ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          o.isPaid
                            ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {o.isPaid ? o.paymentMethod : "Unpaid"}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
          >
            Prev
          </button>
          <span className="text-xs text-gray-500 dark:text-neutral-400">
            Page {page + 1} of {pages}
          </span>
          <button
            type="button"
            disabled={page === pages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ── Session detail panel ──────────────────────────────────────────────────────

function SessionDetail({ session, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDaySessionOrders(session.id)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load session orders");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [session.id]);

  const summary = data?.summary || {};
  const orders = useMemo(() => {
    const raw = Array.isArray(data?.orders) ? data.orders : [];
    return [...raw].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }, [data]);

  // Order type breakdown from orders
  const typeBreakdown = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const t = (o.orderType || "other").toLowerCase().replace(/_/g, "-");
      if (!map[t]) map[t] = { count: 0, revenue: 0 };
      map[t].count += 1;
      map[t].revenue += o.total || 0;
    });
    return Object.entries(map).map(([type, d]) => ({ type, ...d }));
  }, [orders]);

  const duration = fmtDuration(session.startAt, session.endAt || new Date());

  return (
    <div className="fixed inset-0 z-50 flex items-stretch">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-4xl bg-white dark:bg-neutral-950 border-l border-gray-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Session Report
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  session.status === "OPEN"
                    ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400"
                }`}
              >
                {session.status === "OPEN" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                {session.status}
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
              {fmtDate(session.startAt)}
              {session.endAt ? ` → ${fmtDate(session.endAt)}` : " · Ongoing"}
              {duration && ` · ${duration}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <KpiCard
                  icon={TrendingUp}
                  iconGradient="bg-gradient-to-br from-primary to-secondary"
                  label="Total Revenue"
                  value={fmtRs(summary.totalSales)}
                />
                <KpiCard
                  icon={ShoppingBag}
                  iconGradient="bg-gradient-to-br from-blue-500 to-blue-600"
                  label="Orders"
                  value={summary.totalOrders || orders.length}
                />
                <KpiCard
                  icon={Banknote}
                  iconGradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
                  label="Cash Sales"
                  value={fmtRs(summary.cashSales)}
                />
                <KpiCard
                  icon={CreditCard}
                  iconGradient="bg-gradient-to-br from-violet-500 to-violet-600"
                  label="Card Sales"
                  value={fmtRs(summary.cardSales)}
                />
                <KpiCard
                  icon={Package}
                  iconGradient="bg-gradient-to-br from-amber-500 to-orange-500"
                  label="Discount"
                  value={fmtRs(summary.totalDiscount)}
                />
              </div>

              {/* Session meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-neutral-900 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Opened By
                  </p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                    {session.openedBy?.name || "—"}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-neutral-900 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Closed By
                  </p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                    {session.closedBy?.name || (session.status === "OPEN" ? "Ongoing" : "—")}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-neutral-900 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Branch
                  </p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                    {session.branchName || "—"}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-neutral-900 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Duration
                  </p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                    {duration || "—"}
                  </p>
                </div>
              </div>

              {/* Order type breakdown */}
              {typeBreakdown.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
                    Order Type Breakdown
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {typeBreakdown.map((t) => (
                      <div
                        key={t.type}
                        className="bg-gray-50 dark:bg-neutral-900 rounded-xl p-3 border border-gray-200 dark:border-neutral-800"
                      >
                        <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 capitalize mb-1">
                          {t.type.replace(/-/g, " ")}
                        </p>
                        <p className="text-base font-bold text-gray-900 dark:text-white">
                          {fmtRs(t.revenue)}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                          {t.count} order{t.count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders table */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
                  Orders
                </h3>
                <SessionOrdersTable orders={orders} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const { currentBranch } = useBranch() || {};

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const perPage = 20;

  const [selectedSession, setSelectedSession] = useState(null);
  const [suspended, setSuspended] = useState(false);

  const load = useCallback(
    async (pageNum = 0) => {
      setLoading(true);
      try {
        const res = await getDaySessions(currentBranch?.id, {
          limit: perPage,
          offset: pageNum * perPage,
        });
        setSessions(Array.isArray(res?.sessions) ? res.sessions : []);
        setTotal(res?.total || 0);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) {
          setSuspended(true);
        } else {
          toast.error("Failed to load sessions");
        }
      } finally {
        setLoading(false);
      }
    },
    [currentBranch?.id]
  );

  useEffect(() => {
    setPage(0);
    load(0);
  }, [load]);

  function handlePageChange(newPage) {
    setPage(newPage);
    load(newPage);
  }

  const pages = Math.ceil(total / perPage);

  // Aggregate quick stats from loaded sessions
  const stats = useMemo(() => {
    const closed = sessions.filter((s) => s.status === "CLOSED");
    return {
      totalSessions: total,
      avgRevenue:
        closed.length > 0
          ? closed.reduce((s, x) => s + (x.totalSales || 0), 0) / closed.length
          : 0,
      totalOrders: sessions.reduce((s, x) => s + (x.totalOrders || 0), 0),
      totalRevenue: sessions.reduce((s, x) => s + (x.totalSales || 0), 0),
    };
  }, [sessions, total]);

  return (
    <AdminLayout
      title="Session Reports"
      subtitle="View detailed reports for each POS session"
      suspended={suspended}
    >
      <div className="space-y-5">
        {/* Summary KPIs */}
        {!loading && sessions.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              icon={Calendar}
              iconGradient="bg-gradient-to-br from-primary to-secondary"
              label="Total Sessions"
              value={total}
              sub="All time"
            />
            <KpiCard
              icon={TrendingUp}
              iconGradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
              label="Revenue (This Page)"
              value={fmtRs(stats.totalRevenue)}
            />
            <KpiCard
              icon={ShoppingBag}
              iconGradient="bg-gradient-to-br from-blue-500 to-blue-600"
              label="Orders (This Page)"
              value={stats.totalOrders.toLocaleString()}
            />
            <KpiCard
              icon={DollarSign}
              iconGradient="bg-gradient-to-br from-amber-500 to-orange-500"
              label="Avg Revenue / Session"
              value={fmtRs(Math.round(stats.avgRevenue))}
              sub="Closed sessions"
            />
          </div>
        )}

        {/* Sessions list */}
        <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Table header */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md">
                <ClipboardList className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Sessions
                </h2>
                {currentBranch && (
                  <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                    {currentBranch.name}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => load(page)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-20 text-sm text-gray-400 dark:text-neutral-600">
              No sessions found
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 dark:bg-neutral-900/70 border-b border-gray-200 dark:border-neutral-800">
                    <tr>
                      <th className={TH_CLS}>Status</th>
                      <th className={TH_CLS}>Start</th>
                      <th className={TH_CLS}>End</th>
                      <th className={TH_CLS}>Duration</th>
                      <th className={TH_CLS}>Branch</th>
                      <th className={TH_CLS}>Opened By</th>
                      <th className={TH_CLS}>Closed By</th>
                      <th className={TH_CLS + " text-right"}>Orders</th>
                      <th className={TH_CLS + " text-right"}>Revenue</th>
                      <th className={TH_CLS}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {sessions.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-gray-50/70 dark:hover:bg-neutral-900/40 transition-colors cursor-pointer group"
                        onClick={() => setSelectedSession(s)}
                      >
                        <td className={TD_CLS}>
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
                        <td className={TD_CLS}>
                          <span className="text-xs">{fmtDate(s.startAt)}</span>
                        </td>
                        <td className={TD_CLS}>
                          {s.endAt ? (
                            <span className="text-xs">{fmtDate(s.endAt)}</span>
                          ) : (
                            <span className="text-xs text-emerald-500 font-medium">
                              Ongoing
                            </span>
                          )}
                        </td>
                        <td className={TD_CLS}>
                          <span className="text-xs text-gray-500 dark:text-neutral-400">
                            {fmtDuration(s.startAt, s.endAt) || "—"}
                          </span>
                        </td>
                        <td className={TD_CLS}>
                          {s.branchName ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                              {s.branchName}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={TD_CLS}>
                          <span className="text-xs">
                            {s.openedBy?.name || "—"}
                          </span>
                        </td>
                        <td className={TD_CLS}>
                          <span className="text-xs">
                            {s.closedBy?.name ||
                              (s.status === "OPEN" ? "—" : "—")}
                          </span>
                        </td>
                        <td className={TD_CLS + " text-right"}>
                          <span className="font-semibold">
                            {(s.totalOrders || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className={TD_CLS + " text-right"}>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {fmtRs(s.totalSales)}
                          </span>
                        </td>
                        <td className={TD_CLS}>
                          <ChevronRight className="w-4 h-4 text-gray-300 dark:text-neutral-600 group-hover:text-primary transition-colors" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <div className="flex items-center justify-center gap-3 px-5 py-4 border-t border-gray-100 dark:border-neutral-800">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => handlePageChange(page - 1)}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-gray-500 dark:text-neutral-400">
                    Page {page + 1} of {pages} · {total} sessions total
                  </span>
                  <button
                    type="button"
                    disabled={page >= pages - 1}
                    onClick={() => handlePageChange(page + 1)}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Session detail slide-over */}
      {selectedSession && (
        <SessionDetail
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </AdminLayout>
  );
}
