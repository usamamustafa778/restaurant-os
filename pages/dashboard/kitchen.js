import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getOrders, getNextStatuses, updateOrderStatus } from "../../lib/apiClient";
import { useSocket } from "../../contexts/SocketContext";
import {
  Clock, User, ChefHat, Loader2, CheckCircle2, RefreshCw,
  Package, UtensilsCrossed, Headset, PackageCheck, Car, ShoppingBag,
  ChevronLeft, ChevronRight, X,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDisplayOrderId(order) {
  const id = order.id || order.orderNumber || order._id || "";
  if (typeof id === "string" && id.startsWith("ORD-")) return id.replace(/^ORD-/, "");
  return id;
}

function getTokenNumber(order) {
  if (order.tokenNumber) return String(order.tokenNumber).padStart(4, "0");
  const id = order.id || order._id || "";
  return String(id).slice(-4).toUpperCase();
}

function getElapsedMinutes(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function formatElapsed(minutes) {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getUrgency(minutes) {
  if (minutes >= 20) return "critical";
  if (minutes >= 15) return "urgent";
  if (minutes >= 10) return "warning";
  return "normal";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const URGENCY = {
  normal:   { border: "border-gray-200 dark:border-neutral-700", timerBg: "bg-gray-100 dark:bg-neutral-800",     timerText: "text-gray-500 dark:text-neutral-400",  dot: "bg-gray-400" },
  warning:  { border: "border-amber-300 dark:border-amber-500/50",  timerBg: "bg-amber-50 dark:bg-amber-500/10",   timerText: "text-amber-600 dark:text-amber-400",  dot: "bg-amber-400" },
  urgent:   { border: "border-orange-400 dark:border-orange-500/50", timerBg: "bg-orange-50 dark:bg-orange-500/10", timerText: "text-orange-600 dark:text-orange-400", dot: "bg-orange-400" },
  critical: { border: "border-red-400 dark:border-red-500/50",       timerBg: "bg-red-50 dark:bg-red-500/10",       timerText: "text-red-600 dark:text-red-400",       dot: "bg-red-500 animate-pulse" },
};

const TYPE_CONFIG = {
  DINE_IN:  { label: "Dine In",  Icon: UtensilsCrossed, badge: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400" },
  TAKEAWAY: { label: "Takeaway", Icon: ShoppingBag,     badge: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  DELIVERY: { label: "Delivery", Icon: Car,             badge: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
};

const COLUMNS = [
  {
    key: "new",
    title: "New Orders",
    subtitle: "Awaiting kitchen",
    statuses: ["NEW_ORDER", "UNPROCESSED"],
    header: "from-blue-600 to-blue-700",
    advanceLabel: "Start Cooking",
    advanceCls: "bg-orange-500 hover:bg-orange-600 active:bg-orange-700",
    AdvIcon: ChefHat,
    EmptyIcon: Package,
    emptyLabel: "No new orders",
  },
  {
    key: "kitchen",
    title: "In Kitchen",
    subtitle: "Being prepared",
    statuses: ["PROCESSING", "PENDING"],
    header: "from-orange-500 to-orange-600",
    advanceLabel: "Mark Ready",
    advanceCls: "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700",
    AdvIcon: CheckCircle2,
    EmptyIcon: ChefHat,
    emptyLabel: "Kitchen is clear",
  },
  {
    key: "ready",
    title: "Ready",
    subtitle: "Awaiting pickup",
    statuses: ["READY"],
    header: "from-emerald-600 to-emerald-700",
    advanceLabel: "Mark Delivered",
    advanceCls: "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
    AdvIcon: PackageCheck,
    EmptyIcon: CheckCircle2,
    emptyLabel: "No ready orders",
  },
];

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, column, isUpdating, onAdvance, tick }) {
  const orderId = order.id || order._id;
  const nextStatus = getNextStatuses(order.status)[0];
  const minutes = getElapsedMinutes(order.createdAt);
  const urgency = getUrgency(minutes);
  const ug = URGENCY[urgency];
  const typeKey = (order.orderType || order.type || "DINE_IN").toUpperCase();
  const typeConf = TYPE_CONFIG[typeKey] || TYPE_CONFIG.DINE_IN;
  const { AdvIcon } = column;

  return (
    <div
      className={`bg-white dark:bg-neutral-950 rounded-2xl border-2 ${ug.border} flex flex-col overflow-hidden transition-all hover:shadow-lg ${urgency === "critical" ? "shadow-red-100 dark:shadow-red-900/20" : ""}`}
    >
      {/* Card header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          {/* Token + type badge */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl font-black text-gray-900 dark:text-white leading-none tabular-nums">
              #{getTokenNumber(order)}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${typeConf.badge}`}>
              <typeConf.Icon className="w-2.5 h-2.5" />
              {typeConf.label}
            </span>
          </div>
          {/* Urgency timer */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0 ${ug.timerBg}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ug.dot}`} />
            <Clock className={`w-3 h-3 ${ug.timerText}`} />
            <span className={`text-[11px] font-bold tabular-nums ${ug.timerText}`}>{formatElapsed(minutes)}</span>
          </div>
        </div>

        {/* Sub-ID */}
        <p className="text-[10px] text-gray-400 dark:text-neutral-600 mb-2 font-mono">
          #{getDisplayOrderId(order)}
        </p>

        {/* Meta info */}
        <div className="space-y-1">
          {order.customerName && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-neutral-400">
              <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="truncate">{order.customerName}</span>
            </div>
          )}
          {order.orderTakerName && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-500">
              <Headset className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="truncate">{order.orderTakerName}</span>
            </div>
          )}
          {order.tableName && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-500">
              <UtensilsCrossed className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="font-medium">{order.tableName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="mx-3 border-t border-gray-100 dark:border-neutral-800" />
      <div className="px-3 py-2.5 space-y-1.5 flex-1">
        {order.items?.map((item, idx) => (
          <div key={idx} className="flex items-baseline gap-2">
            <span className="text-xs font-black text-primary w-5 flex-shrink-0 tabular-nums">{item.quantity}×</span>
            <span className="text-xs font-semibold text-gray-800 dark:text-neutral-200 leading-snug">{item.name}</span>
          </div>
        ))}
      </div>

      {/* Advance button */}
      {nextStatus && (
        <div className="px-3 pb-3 pt-1.5">
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => onAdvance(order)}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${column.advanceCls}`}
          >
            {isUpdating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <AdvIcon className="w-3.5 h-3.5" />
                {column.advanceLabel}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KitchenPage() {
  const { socket } = useSocket() || {};
  const [orders, setOrders] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [tick, setTick] = useState(0);
  const [typeFilter, setTypeFilter] = useState("all");
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState("delivered");
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);

  // Live timer tick every 30s to re-render urgency
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    fetchOrders();
    const iv = setInterval(fetchOrders, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchOrders();
    socket.on("order:created", handler);
    socket.on("order:updated", handler);
    return () => {
      socket.off("order:created", handler);
      socket.off("order:updated", handler);
    };
  }, [socket]);

  async function fetchOrders() {
    try {
      const data = await getOrders();
      setOrders(data);
      setLastRefreshed(Date.now());
    } catch (err) {
      toast.error(err.message || "Failed to load orders");
    } finally {
      setPageLoading(false);
      setRefreshing(false);
    }
  }

  async function handleManualRefresh() {
    setRefreshing(true);
    await fetchOrders();
  }

  async function handleStatusAdvance(order) {
    const orderId = order.id || order._id;
    const nextStatus = getNextStatuses(order.status)[0];
    if (!nextStatus) return;
    setUpdatingOrderId(orderId);
    try {
      await updateOrderStatus(orderId, nextStatus);
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId || o.id === orderId ? { ...o, status: nextStatus } : o))
      );
      const label = { PROCESSING: "Started cooking", READY: "Marked ready", DELIVERED: "Delivered" }[nextStatus] || nextStatus;
      toast.success(`#${getTokenNumber(order)} — ${label}`);
    } catch (err) {
      toast.error(err.message || "Failed to update");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  // Derived data
  const cutoff48h = Date.now() - 48 * 60 * 60 * 1000;
  const activeOrders = orders.filter((o) => !["DELIVERED", "CANCELLED", "COMPLETED"].includes(o.status));
  const deliveredOrders = orders
    .filter((o) => ["DELIVERED", "COMPLETED"].includes(o.status) && new Date(o.createdAt).getTime() >= cutoff48h)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const cancelledOrders = orders
    .filter((o) => o.status === "CANCELLED" && new Date(o.createdAt).getTime() >= cutoff48h)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const applyTypeFilter = (list) => {
    if (typeFilter === "all") return list;
    return list.filter((o) => (o.orderType || o.type || "").toUpperCase() === typeFilter);
  };

  const columnOrders = COLUMNS.map((col) =>
    applyTypeFilter(activeOrders.filter((o) => col.statuses.includes(o.status)))
  );

  // Per-type counts for filter tabs (always unfiltered)
  const typeCounts = {
    DINE_IN:  activeOrders.filter((o) => (o.orderType || o.type || "").toUpperCase() === "DINE_IN").length,
    TAKEAWAY: activeOrders.filter((o) => (o.orderType || o.type || "").toUpperCase() === "TAKEAWAY").length,
    DELIVERY: activeOrders.filter((o) => (o.orderType || o.type || "").toUpperCase() === "DELIVERY").length,
  };

  const secondsSince = Math.round((Date.now() - lastRefreshed) / 1000);
  const refreshLabel = secondsSince < 5 ? "Just now" : secondsSince < 60 ? `${secondsSince}s ago` : `${Math.floor(secondsSince / 60)}m ago`;

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <AdminLayout title="Kitchen (KDS)">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mb-4">
            <ChefHat className="w-8 h-8 text-orange-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            <p className="text-sm text-gray-500">Loading kitchen orders…</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <AdminLayout title="Kitchen (KDS)">
      <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 110px)" }}>

        {/* ── Top bar ────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
          {/* Filter tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1 gap-0.5">
              {[
                { value: "all", label: "All", count: activeOrders.length },
                { value: "DINE_IN", label: "Dine In", count: typeCounts.DINE_IN },
                { value: "TAKEAWAY", label: "Takeaway", count: typeCounts.TAKEAWAY },
                { value: "DELIVERY", label: "Delivery", count: typeCounts.DELIVERY },
              ].map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setTypeFilter(f.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    typeFilter === f.value
                      ? "bg-gradient-to-r from-primary to-secondary text-white shadow-sm"
                      : "text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {f.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    typeFilter === f.value ? "bg-white/20" : "bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400"
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: urgency legend + refresh */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-3 text-[10px] text-gray-400 dark:text-neutral-500">
              {[
                { cls: "bg-gray-400", label: "< 10m" },
                { cls: "bg-amber-400", label: "10-15m" },
                { cls: "bg-orange-400", label: "15-20m" },
                { cls: "bg-red-500 animate-pulse", label: "> 20m" },
              ].map((u) => (
                <div key={u.label} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${u.cls}`} />
                  {u.label}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-neutral-500">
              <span className="hidden sm:inline">Updated {refreshLabel}</span>
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="p-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-500 hover:text-primary transition-colors disabled:opacity-50"
                title="Refresh orders"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Main content ────────────────────────────────────────────── */}
        <div className="flex gap-3 flex-1 min-h-0">

          {/* Kanban columns */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 min-w-0">
            {COLUMNS.map((col, colIdx) => {
              const colOrs = columnOrders[colIdx];
              const { EmptyIcon } = col;
              return (
                <div
                  key={col.key}
                  className="flex flex-col bg-gray-50 dark:bg-neutral-900/60 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden min-h-0"
                >
                  {/* Column header */}
                  <div className={`bg-gradient-to-r ${col.header} px-4 py-3 flex-shrink-0`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-bold text-sm">{col.title}</div>
                        <div className="text-white/60 text-[11px] mt-0.5">{col.subtitle}</div>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-white font-black text-base">{colOrs.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cards scroll area */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                    {colOrs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full min-h-[120px] opacity-40">
                        <EmptyIcon className="w-10 h-10 text-gray-400 dark:text-neutral-600 mb-2" />
                        <p className="text-xs text-gray-400 dark:text-neutral-600">{col.emptyLabel}</p>
                      </div>
                    ) : (
                      colOrs.map((order) => {
                        const orderId = order.id || order._id;
                        return (
                          <OrderCard
                            key={orderId}
                            order={order}
                            column={col}
                            isUpdating={updatingOrderId === orderId}
                            onAdvance={handleStatusAdvance}
                            tick={tick}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Completed / Cancelled sidebar ──────────────────────────── */}
          <div className="flex items-start gap-1 flex-shrink-0">
            {/* Toggle button */}
            <button
              type="button"
              onClick={() => setShowSidebar((v) => !v)}
              className="mt-2 p-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
              title={showSidebar ? "Collapse" : "Expand completed panel"}
            >
              {showSidebar
                ? <ChevronRight className="w-3.5 h-3.5" />
                : <ChevronLeft className="w-3.5 h-3.5" />
              }
            </button>

            {showSidebar && (
              <div className="w-52 flex flex-col bg-white dark:bg-neutral-950 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden" style={{ height: "100%" }}>
                {/* Tab bar */}
                <div className="flex border-b border-gray-100 dark:border-neutral-800 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setSidebarTab("delivered")}
                    className={`flex-1 py-2.5 text-[11px] font-bold transition-colors ${
                      sidebarTab === "delivered"
                        ? "text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/40 dark:bg-emerald-500/5 dark:text-emerald-400"
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                    }`}
                  >
                    Done ({deliveredOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarTab("cancelled")}
                    className={`flex-1 py-2.5 text-[11px] font-bold transition-colors ${
                      sidebarTab === "cancelled"
                        ? "text-red-600 border-b-2 border-red-500 bg-red-50/40 dark:bg-red-500/5 dark:text-red-400"
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                    }`}
                  >
                    Cancelled ({cancelledOrders.length})
                  </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {(sidebarTab === "delivered" ? deliveredOrders : cancelledOrders).length === 0 ? (
                    <p className="text-[11px] text-gray-400 dark:text-neutral-600 text-center py-8">None yet</p>
                  ) : (
                    (sidebarTab === "delivered" ? deliveredOrders : cancelledOrders).map((order) => {
                      const minutes = getElapsedMinutes(order.createdAt);
                      const isDone = sidebarTab === "delivered";
                      return (
                        <div
                          key={order.id || order._id}
                          className={`px-3 py-2 rounded-xl border text-xs ${
                            isDone
                              ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20"
                              : "bg-red-50 dark:bg-red-500/5 border-red-100 dark:border-red-500/20"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className={`font-black text-sm ${isDone ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              #{getTokenNumber(order)}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-neutral-500 tabular-nums">{formatElapsed(minutes)}</span>
                          </div>
                          {order.items?.length > 0 && (
                            <p className="text-[10px] text-gray-500 dark:text-neutral-500 truncate leading-tight">
                              {order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
