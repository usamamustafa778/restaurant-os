import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getOrders, getNextStatuses, updateOrderStatus } from "../../lib/apiClient";
import { useSocket } from "../../contexts/SocketContext";
import {
  Clock, User, ChefHat, Loader2, CheckCircle2, RefreshCw,
  Package, UtensilsCrossed, Headset, ShoppingBag, Truck, MapPin,
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

function getOrderTypeLabel(order) {
  const type = (order.type || order.orderType || "").toUpperCase();
  if (type.includes("DELIVERY")) return "Delivery";
  if (type.includes("DINE") || type.includes("DINE_IN")) return "Dine In";
  if (type.includes("TAKE") || type.includes("PICKUP")) return "Takeaway";
  if (order.deliveryAddress) return "Delivery";
  if (order.tableName) return "Dine In";
  return "Walk-in";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const URGENCY = {
  normal:   { border: "border-gray-200 dark:border-neutral-700", timerBg: "bg-gray-100 dark:bg-neutral-800",     timerText: "text-gray-500 dark:text-neutral-400",  dot: "bg-gray-400" },
  warning:  { border: "border-amber-300 dark:border-amber-500/50",  timerBg: "bg-amber-50 dark:bg-amber-500/10",   timerText: "text-amber-600 dark:text-amber-400",  dot: "bg-amber-400" },
  urgent:   { border: "border-orange-400 dark:border-orange-500/50", timerBg: "bg-orange-50 dark:bg-orange-500/10", timerText: "text-orange-600 dark:text-orange-400", dot: "bg-orange-400" },
  critical: { border: "border-red-400 dark:border-red-500/50",       timerBg: "bg-red-50 dark:bg-red-500/10",       timerText: "text-red-600 dark:text-red-400",       dot: "bg-red-500 animate-pulse" },
};

const TYPE_BADGE = "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400";

const TYPE_CONFIG = {
  "Dine In":  { Icon: UtensilsCrossed, badge: TYPE_BADGE },
  "Takeaway": { Icon: ShoppingBag,     badge: TYPE_BADGE },
  "Delivery": { Icon: Truck,           badge: TYPE_BADGE },
  "Walk-in":  { Icon: User,            badge: TYPE_BADGE },
};

const COLUMNS = [
  {
    key: "new",
    title: "New Orders",
    subtitle: "Awaiting kitchen",
    statuses: ["NEW_ORDER", "UNPROCESSED"],
    header: "bg-orange-500",
    colBg: "bg-orange-50/60 dark:bg-orange-950/20",
    colBorder: "border-orange-200/60 dark:border-orange-500/15",
    countBg: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
    advanceLabel: "Start Cooking",
    advanceCls: "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
    AdvIcon: ChefHat,
    EmptyIcon: Package,
    emptyLabel: "No new orders",
  },
  {
    key: "kitchen",
    title: "In Kitchen",
    subtitle: "Being prepared",
    statuses: ["PROCESSING", "PENDING"],
    header: "bg-blue-500",
    colBg: "bg-blue-50/60 dark:bg-blue-950/20",
    colBorder: "border-blue-200/60 dark:border-blue-500/15",
    countBg: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
    advanceLabel: "Mark Ready",
    advanceCls: "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700",
    AdvIcon: CheckCircle2,
    EmptyIcon: ChefHat,
    emptyLabel: "Kitchen is clear",
  },
  {
    key: "ready",
    title: "Ready",
    subtitle: "Awaiting pickup / service",
    statuses: ["READY"],
    header: "bg-emerald-500",
    colBg: "bg-emerald-50/60 dark:bg-emerald-950/20",
    colBorder: "border-emerald-200/60 dark:border-emerald-500/15",
    countBg: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
    advanceLabel: null,
    advanceCls: "",
    AdvIcon: null,
    EmptyIcon: CheckCircle2,
    emptyLabel: "No ready orders",
  },
];

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, column, isUpdating, onAdvance, tick }) {
  const typeLabel = getOrderTypeLabel(order);
  const typeConf = TYPE_CONFIG[typeLabel] || TYPE_CONFIG["Walk-in"];
  const minutes = getElapsedMinutes(order.createdAt);
  const urgency = getUrgency(minutes);
  const ug = URGENCY[urgency];
  const { AdvIcon } = column;
  const totalQty = order.items?.reduce((sum, i) => sum + (Number(i.qty ?? i.quantity) || 1), 0) || 0;

  return (
    <div
      className={`bg-white dark:bg-neutral-950 rounded-2xl border-2 ${ug.border} flex flex-col overflow-hidden transition-all hover:shadow-lg ${urgency === "critical" ? "shadow-red-100 dark:shadow-red-900/20" : ""}`}
    >
      {/* Card header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl font-black text-gray-900 dark:text-white leading-none tabular-nums">
              #{getTokenNumber(order)}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${typeConf.badge}`}>
              <typeConf.Icon className="w-2.5 h-2.5" />
              {typeLabel}
            </span>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0 ${ug.timerBg}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ug.dot}`} />
            <Clock className={`w-3 h-3 ${ug.timerText}`} />
            <span className={`text-[11px] font-bold tabular-nums ${ug.timerText}`}>{formatElapsed(minutes)}</span>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 dark:text-neutral-600 mb-2 font-mono">
          #{getDisplayOrderId(order)}
        </p>

        <div className="space-y-1">
          {order.customerName && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-neutral-400">
              <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="truncate">{order.customerName}</span>
            </div>
          )}
          {typeLabel === "Dine In" && order.tableName && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span>{order.tableName}</span>
            </div>
          )}
          {typeLabel === "Delivery" && order.deliveryAddress && (
            <div className="flex items-start gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <Truck className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="truncate font-medium">{order.deliveryAddress}</span>
            </div>
          )}
          {order.orderTakerName && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-neutral-500">
              <Headset className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{order.orderTakerName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="mx-3 border-t border-gray-100 dark:border-neutral-800" />
      <div className="px-3 pt-2 pb-0.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Items</span>
        {totalQty > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-[10px] font-bold text-gray-500 dark:text-neutral-400 tabular-nums">
            {totalQty} qty
          </span>
        )}
      </div>
      <div className="px-3 py-2 space-y-1.5 flex-1">
        {order.items?.map((item, idx) => (
          <div key={idx} className="flex items-baseline gap-2">
            <span className="text-xs font-black text-primary w-5 flex-shrink-0 tabular-nums">{item.qty ?? item.quantity}×</span>
            <span className="text-xs font-semibold text-gray-800 dark:text-neutral-200 leading-snug">{item.name}</span>
          </div>
        ))}
      </div>

      {/* Advance button — only for New and In Kitchen columns */}
      {column.advanceLabel && AdvIcon && (
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
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);

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
      setOrders(Array.isArray(data) ? data : (data?.orders ?? []));
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
    const typeKey = (order.orderType || order.type || "DINE_IN").toUpperCase();
    const nextStatus = getNextStatuses(order.status, typeKey)[0];
    if (!nextStatus) return;
    setUpdatingOrderId(orderId);
    try {
      await updateOrderStatus(orderId, nextStatus);
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId || o.id === orderId ? { ...o, status: nextStatus } : o))
      );
      const label = { PROCESSING: "Started cooking", READY: "Marked ready" }[nextStatus] || nextStatus;
      toast.success(`#${getTokenNumber(order)} — ${label}`);
    } catch (err) {
      toast.error(err.message || "Failed to update");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  // Derived data — kitchen only cares about active orders (not delivered/cancelled)
  const activeOrders = orders.filter((o) => !["DELIVERED", "CANCELLED", "COMPLETED", "OUT_FOR_DELIVERY"].includes(o.status));

  const applyTypeFilter = (list) => {
    if (typeFilter === "all") return list;
    return list.filter((o) => {
      const label = getOrderTypeLabel(o);
      if (typeFilter === "DINE_IN") return label === "Dine In";
      if (typeFilter === "TAKEAWAY") return label === "Takeaway";
      if (typeFilter === "DELIVERY") return label === "Delivery";
      return true;
    });
  };

  const columnOrders = COLUMNS.map((col) =>
    applyTypeFilter(activeOrders.filter((o) => col.statuses.includes(o.status)))
  );

  const typeCounts = {
    DINE_IN:  activeOrders.filter((o) => getOrderTypeLabel(o) === "Dine In").length,
    TAKEAWAY: activeOrders.filter((o) => getOrderTypeLabel(o) === "Takeaway").length,
    DELIVERY: activeOrders.filter((o) => getOrderTypeLabel(o) === "Delivery").length,
  };

  const totalActive = activeOrders.length;
  const secondsSince = Math.round((Date.now() - lastRefreshed) / 1000);
  const refreshLabel = secondsSince < 5 ? "Just now" : secondsSince < 60 ? `${secondsSince}s ago` : `${Math.floor(secondsSince / 60)}m ago`;

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

  return (
    <AdminLayout title="Kitchen (KDS)">
      <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 110px)" }}>

        {/* ── Top bar ────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1 gap-0.5">
              {[
                { value: "all", label: "All", count: totalActive },
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

        {/* ── 3-column Kanban ────────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 min-h-0">
          {COLUMNS.map((col, colIdx) => {
            const colOrs = columnOrders[colIdx];
            const { EmptyIcon } = col;
            return (
              <div
                key={col.key}
                className={`flex flex-col rounded-2xl border ${col.colBorder} ${col.colBg} overflow-hidden min-h-0`}
              >
                <div className={`flex items-center gap-2 px-4 py-2.5 flex-shrink-0 border-b ${col.colBorder}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${col.header} flex-shrink-0`} />
                  <span className="text-[13px] font-bold text-gray-800 dark:text-neutral-200 truncate">{col.title}</span>
                  <span className={`ml-auto text-[11px] font-bold min-w-[24px] text-center px-1.5 py-0.5 rounded-full ${col.countBg}`}>
                    {colOrs.length}
                  </span>
                </div>

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
      </div>
    </AdminLayout>
  );
}
