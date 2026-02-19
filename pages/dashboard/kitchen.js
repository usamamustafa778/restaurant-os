import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getOrders } from "../../lib/apiClient";
import { Clock, User, Package, CheckCircle, AlertCircle, ChefHat, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

// Reuse the same order ID format as Orders page (YYYYMMDD-XXXX without ORD- prefix)
function getDisplayOrderId(order) {
  const id = order.id || order.orderNumber || order._id || "";
  if (typeof id === "string" && id.startsWith("ORD-")) return id.replace(/^ORD-/, "");
  return id;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchOrders() {
    try {
      const data = await getOrders();
      setOrders(data.filter(o => o.status !== "COMPLETED" && o.status !== "CANCELLED"));
    } catch (err) {
      toast.error(err.message || "Failed to load orders");
    } finally {
      setPageLoading(false);
    }
  }

  // Group orders by status (matches backend: UNPROCESSED → PENDING → READY)
  const newOrders = orders.filter(o => o.status === "UNPROCESSED");
  const inKitchen = orders.filter(o => o.status === "PENDING");
  const delayed = orders.filter(o => {
    const orderTime = new Date(o.createdAt);
    const now = new Date();
    const minutesElapsed = (now - orderTime) / 60000;
    return minutesElapsed > 15 && o.status !== "COMPLETED";
  });
  const ready = orders.filter(o => o.status === "READY");

  const statusColumns = [
    { title: "New Orders", count: newOrders.length, orders: newOrders, color: "blue", icon: Package },
    { title: "In Kitchen", count: inKitchen.length, orders: inKitchen, color: "orange", icon: ChefHat },
    { title: "Delayed", count: delayed.length, orders: delayed, color: "red", icon: AlertCircle },
    { title: "Ready", count: ready.length, orders: ready, color: "green", icon: CheckCircle },
  ];

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
        <div className="grid gap-4 lg:grid-cols-4 h-[calc(100vh-200px)]">
          {statusColumns.map((column) => {
            const Icon = column.icon;
            return (
              <div key={column.title} className="flex flex-col bg-gray-50 dark:bg-neutral-900 rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800">
                {/* Column Header */}
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

                {/* Orders List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {column.orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <Icon className="w-12 h-12 text-gray-300 dark:text-neutral-700 mb-2" />
                      <p className="text-xs text-gray-400 dark:text-neutral-500">No orders</p>
                    </div>
                  ) : (
                    column.orders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 hover:shadow-md transition-shadow"
                      >
                        {/* Order Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-gray-900 dark:text-white">
                                #{order.tokenNumber || order.id.slice(0, 4)}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                {order.orderType === "DINE_IN" ? "Dine-in" : "Takeaway"}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-gray-500 dark:text-neutral-400">
                              Order ID: #{getDisplayOrderId(order)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-neutral-400">
                            <Clock className="w-3 h-3" />
                            <span>{getTimeElapsed(order.createdAt)}</span>
                          </div>
                        </div>

                        {/* Customer Info */}
                        {order.customerName && (
                          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-neutral-400 mb-3">
                            <User className="w-3 h-3" />
                            <span>{order.customerName}</span>
                          </div>
                        )}

                        {/* Order Items */}
                        <div className="space-y-1.5 mb-3">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-gray-700 dark:text-neutral-300">
                                {item.quantity}x {item.name}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Order Total */}
                        <div className="pt-3 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-neutral-400">Total</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            Rs {order.total?.toFixed(0)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
