import { useState, useEffect } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  getRiderOrders,
  markOrderDeliveredByRider,
  getStoredAuth,
  SubscriptionInactiveError,
} from "../../lib/apiClient";
import { useSocket } from "../../contexts/SocketContext";
import {
  Bike,
  MapPin,
  Phone,
  User,
  Clock,
  Loader2,
  CheckCircle2,
  Package,
  Truck,
  RefreshCw,
  ChevronDown,
  Banknote,
} from "lucide-react";
import toast from "react-hot-toast";
import SEO from "../../components/SEO";

const TABS = { ACTIVE: "active", HISTORY: "history" };

export default function RiderPortalPage() {
  const { socket } = useSocket() || {};
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suspended, setSuspended] = useState(false);
  const [tab, setTab] = useState(TABS.ACTIVE);
  const [deliveringId, setDeliveringId] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const auth = getStoredAuth();
    setUserName(auth?.user?.name || auth?.user?.email || "");
  }, []);

  async function loadOrders() {
    try {
      const data = await getRiderOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) {
        setSuspended(true);
      } else {
        toast.error(err.message || "Failed to load orders");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onOrderEvent = () => loadOrders();
    socket.on("order:updated", onOrderEvent);
    return () => { socket.off("order:updated", onOrderEvent); };
  }, [socket]);

  async function handleMarkDelivered(orderId) {
    setDeliveringId(orderId);
    const toastId = toast.loading("Marking as delivered...");
    try {
      const updated = await markOrderDeliveredByRider(orderId);
      setOrders(prev => prev.map(o => (o.id === orderId || o._id === orderId ? { ...o, ...updated } : o)));
      toast.success("Order marked as delivered!", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to mark delivered", { id: toastId });
    } finally {
      setDeliveringId(null);
    }
  }

  const activeOrders = orders.filter(o => o.status === "OUT_FOR_DELIVERY");
  const historyOrders = orders.filter(o => o.status === "DELIVERED" || o.status === "COMPLETED" || o.status === "CANCELLED");
  const displayOrders = tab === TABS.ACTIVE ? activeOrders : historyOrders;

  function getDisplayOrderId(order) {
    const id = order.id || order.orderNumber || order._id || "";
    if (typeof id === "string" && id.startsWith("ORD-")) return id.replace(/^ORD-/, "");
    return id;
  }

  return (
    <AdminLayout title="Rider Portal" suspended={suspended}>
      <SEO title="Rider Portal" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              {userName ? `Hello, ${userName.split(" ")[0]}` : "Rider Portal"}
            </h1>
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              {activeOrders.length} active {activeOrders.length === 1 ? "delivery" : "deliveries"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setLoading(true); loadOrders(); }}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab(TABS.ACTIVE)}
          className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            tab === TABS.ACTIVE
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
              : "bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400"
          }`}
        >
          <Truck className="w-4 h-4" />
          Active ({activeOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setTab(TABS.HISTORY)}
          className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            tab === TABS.HISTORY
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
              : "bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          History ({historyOrders.length})
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 flex items-center justify-center mb-3">
            <Bike className="w-8 h-8 text-indigo-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            <p className="text-sm font-semibold text-gray-700 dark:text-neutral-300">Loading orders...</p>
          </div>
        </div>
      )}

      {/* Empty */}
      {!loading && displayOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
            {tab === TABS.ACTIVE ? (
              <Package className="w-8 h-8 text-gray-300 dark:text-neutral-700" />
            ) : (
              <CheckCircle2 className="w-8 h-8 text-gray-300 dark:text-neutral-700" />
            )}
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-neutral-400">
            {tab === TABS.ACTIVE ? "No active deliveries" : "No delivery history yet"}
          </p>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
            {tab === TABS.ACTIVE ? "Orders will appear here when assigned to you." : "Completed deliveries will show up here."}
          </p>
        </div>
      )}

      {/* Order Cards */}
      {!loading && displayOrders.length > 0 && (
        <div className="space-y-4">
          {displayOrders.map(order => {
            const orderId = order.id || order._id;
            const isExpanded = expandedOrder === orderId;
            const isDelivering = deliveringId === orderId;
            const orderDate = new Date(order.createdAt);
            const dateStr = orderDate.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
            const timeStr = orderDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

            return (
              <div
                key={orderId}
                className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Card Header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        #{getDisplayOrderId(order)}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                    <span className="text-xl font-bold text-primary">
                      Rs {Number(order.total).toFixed(0)}
                    </span>
                  </div>
                </div>

                {/* Customer & Delivery Info */}
                <div className="px-4 py-3 space-y-2">
                  {order.customerName && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">{order.customerName}</span>
                    </div>
                  )}
                  {order.customerPhone && (
                    <a href={`tel:${order.customerPhone}`} className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                      <Phone className="w-4 h-4" />
                      <span className="font-medium">{order.customerPhone}</span>
                    </a>
                  )}
                  {order.deliveryAddress && (
                    <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-neutral-400">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
                      <span>{order.deliveryAddress}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-neutral-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{dateStr} at {timeStr}</span>
                  </div>
                </div>

                {/* Expandable Items */}
                <div className="px-4 pb-2">
                  <button
                    type="button"
                    onClick={() => setExpandedOrder(isExpanded ? null : orderId)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-neutral-300 py-2"
                  >
                    <span>
                      Order Items · <span className="font-bold">{order.items?.length || 0} {(order.items?.length || 0) === 1 ? "item" : "items"}</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {isExpanded && order.items && (
                    <div className="space-y-1.5 pb-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700 dark:text-neutral-300">
                            <span className="font-bold text-primary">{item.qty ?? item.quantity}×</span> {item.name}
                          </span>
                          {item.unitPrice && (
                            <span className="text-gray-500 dark:text-neutral-500 text-xs">
                              Rs {(Number(item.unitPrice) * Number(item.qty ?? item.quantity)).toFixed(0)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment Info */}
                <div className="px-4 py-3 border-t border-gray-100 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400">
                      <Banknote className="w-4 h-4" />
                      <span>Collect <span className="font-bold text-gray-900 dark:text-white">Rs {Number(order.total).toFixed(0)}</span> from customer</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {order.status === "OUT_FOR_DELIVERY" && (
                  <div className="px-4 pb-4">
                    <button
                      type="button"
                      disabled={isDelivering}
                      onClick={() => handleMarkDelivered(orderId)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm disabled:opacity-50 transition-colors"
                    >
                      {isDelivering ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Marking...</>
                      ) : (
                        <><CheckCircle2 className="w-4 h-4" /> Mark as Delivered</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
