import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getOrders, getNextStatuses, updateOrderStatus } from "../../lib/apiClient";
import { useSocket } from "../../contexts/SocketContext";
import { Clock, User, Package, CheckCircle, ChefHat, Loader2, ChevronRight, PackageCheck } from "lucide-react";
import toast from "react-hot-toast";

// Reuse the same order ID format as Orders page (YYYYMMDD-XXXX without ORD- prefix)
function getDisplayOrderId(order) {
  const id = order.id || order.orderNumber || order._id || "";
  if (typeof id === "string" && id.startsWith("ORD-")) return id.replace(/^ORD-/, "");
  return id;
}

const STATUS_LABELS = { NEW_ORDER: "New order", PROCESSING: "Processing", READY: "Ready", DELIVERED: "Delivered" };

export default function KitchenPage() {
  const { socket } = useSocket() || {};
  const [orders, setOrders] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  useEffect(() => {
    fetchOrders();
    // Fallback poll every 30 seconds if socket is disconnected
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onOrderEvent = () => fetchOrders();
    socket.on("order:created", onOrderEvent);
    socket.on("order:updated", onOrderEvent);
    return () => {
      socket.off("order:created", onOrderEvent);
      socket.off("order:updated", onOrderEvent);
    };
  }, [socket]);

  async function fetchOrders() {
    try {
      const data = await getOrders();
      setOrders(data);
    } catch (err) {
      toast.error(err.message || "Failed to load orders");
    } finally {
      setPageLoading(false);
    }
  }

  const now = Date.now();
  const cutoff48h = now - 48 * 60 * 60 * 1000;

  const activeOrders = orders.filter(
    (o) => o.status !== "DELIVERED" && o.status !== "CANCELLED" && o.status !== "COMPLETED"
  );

  const deliveredOrders = [...orders]
    .filter(
      (o) =>
        (o.status === "DELIVERED" || o.status === "COMPLETED") &&
        new Date(o.createdAt).getTime() >= cutoff48h
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const cancelledOrders = [...orders]
    .filter(
      (o) =>
        o.status === "CANCELLED" &&
        new Date(o.createdAt).getTime() >= cutoff48h
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const newOrders = activeOrders.filter((o) => o.status === "NEW_ORDER" || o.status === "UNPROCESSED");
  const inKitchen = activeOrders.filter((o) => o.status === "PROCESSING" || o.status === "PENDING");
  const ready = activeOrders.filter((o) => o.status === "READY");

  const statusColumns = [
    { title: "New Orders", count: newOrders.length, orders: newOrders, color: "blue", icon: Package },
    { title: "In Kitchen", count: inKitchen.length, orders: inKitchen, color: "orange", icon: ChefHat },
    { title: "Ready", count: ready.length, orders: ready, color: "green", icon: CheckCircle },
  ];

  async function handleStatusAdvance(order) {
    const orderId = order.id || order._id;
    const nextStatuses = getNextStatuses(order.status);
    const nextStatus = nextStatuses[0];
    if (!nextStatus) return;
    setUpdatingOrderId(orderId);
    try {
      await updateOrderStatus(orderId, nextStatus);
      setOrders((prev) =>
        prev.map((o) =>
          o._id === orderId || o.id === orderId ? { ...o, status: nextStatus } : o
        )
      );
      toast.success(`Order #${getDisplayOrderId(order)} → ${STATUS_LABELS[nextStatus] || nextStatus}`);
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  const getColorClasses = (color) => {
    const colors = {
      blue: "bg-primary text-white border-primary",
      orange: "bg-orange-500 text-white border-orange-600",
      red: "bg-red-500 text-white border-red-600",
      green: "bg-emerald-500 text-white border-emerald-600",
    };
    return colors[color] || colors.blue;
  };

  const getTimeElapsed = (createdAt) => {
    const orderTime = new Date(createdAt);
    const now = new Date();
    const minutesElapsed = Math.floor((now - orderTime) / 60000);
    if (minutesElapsed < 60) return `${minutesElapsed}m ago`;
    const hours = Math.floor(minutesElapsed / 60);
    return `${hours}h ago`;
  };

  return (
    <AdminLayout title="Kitchen Display System">
      {pageLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
            <ChefHat className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
              Loading kitchen orders...
            </p>
          </div>
        </div>
      ) : (
        <div className="flex gap-4 h-[calc(100vh-120px)]">
          {/* Status columns */}
          <div className="flex-1 grid gap-4 lg:grid-cols-3 min-w-0">
            {statusColumns.map((column) => {
              const Icon = column.icon;
              return (
                <div key={column.title} className="flex flex-col bg-gray-50 dark:bg-neutral-900 rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800">
                  <div className={`px-4 py-3 ${getColorClasses(column.color)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span className="font-bold text-sm">{column.title}</span>
                      </div>
                      <span className="text-sm font-bold bg-white/20 px-2 py-0.5 rounded-full">
                        {column.count}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {column.orders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-8">
                        <Icon className="w-12 h-12 text-gray-300 dark:text-neutral-700 mb-2" />
                        <p className="text-xs text-gray-400 dark:text-neutral-500">No orders</p>
                      </div>
                    ) : (
                      column.orders.map((order) => {
                        const orderId = order.id || order._id;
                        const nextStatuses = getNextStatuses(order.status);
                        const nextStatus = nextStatuses[0];
                        const isUpdating = updatingOrderId === orderId;
                        const typeLabel = (order.type || order.orderType || "").toLowerCase() === "dine-in" ? "Dine-in" : (order.type || order.orderType || "").toLowerCase() === "delivery" ? "Delivery" : "Takeaway";
                        return (
                          <div
                            key={orderId}
                            className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                                    #{order.tokenNumber || String(orderId).slice(-4)}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                    {typeLabel}
                                  </span>
                                </div>
                                <span className="text-[10px] font-medium text-gray-500 dark:text-neutral-400">
                                  Order ID: #{getDisplayOrderId(order)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-neutral-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {getTimeElapsed(order.createdAt)}
                                </span>
                                {nextStatus && (
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => handleStatusAdvance(order)}
                                    className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title={`Mark as ${STATUS_LABELS[nextStatus] || nextStatus}`}
                                  >
                                    {isUpdating ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-neutral-400 mb-3">
                              <User className="w-3 h-3 shrink-0" />
                              <span>{(order.customerName || "").trim() || order.orderTakerName || "N/A"}</span>
                            </div>

                            <div className="space-y-1.5 mb-3">
                              {order.items?.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                  <span className="text-gray-700 dark:text-neutral-300">
                                    {item.quantity}x {item.name}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div className="pt-3 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                              <span className="text-xs text-gray-500 dark:text-neutral-400">Total</span>
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
                                Rs {Number(order.total).toFixed(0)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right side: delivered and cancelled order lists (side by side) */}
          <div className="w-64 shrink-0 flex flex-col bg-gray-50 dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="px-4 py-3 bg-emerald-600 text-white flex items-center gap-2">
              <PackageCheck className="w-4 h-4" />
              <span className="font-bold text-sm">Delivered order list</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {deliveredOrders.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-neutral-500 p-3 text-center">No delivered orders</p>
              ) : (
                deliveredOrders.map((order) => (
                  <div
                    key={order.id || order._id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white block truncate">
                        #{getDisplayOrderId(order)}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-neutral-400 block">
                        {getTimeElapsed(order.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="w-64 shrink-0 flex flex-col bg-gray-50 dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="px-4 py-3 bg-red-600 text-white flex items-center gap-2">
              <PackageCheck className="w-4 h-4 rotate-180" />
              <span className="font-bold text-sm">Cancelled order list</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {cancelledOrders.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-neutral-500 p-3 text-center">No cancelled orders</p>
              ) : (
                cancelledOrders.map((order) => (
                  <div
                    key={order.id || order._id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white block truncate">
                        #{getDisplayOrderId(order)}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-neutral-400 block">
                        {getTimeElapsed(order.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
