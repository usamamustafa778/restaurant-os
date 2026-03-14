import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import DataTable from "../../components/ui/DataTable";
import ViewToggle from "../../components/ui/ViewToggle";
import { useViewMode } from "../../hooks/useViewMode";
import {
  getOrders,
  getNextStatuses,
  updateOrderStatus,
  deleteOrder,
  recordOrderPayment,
  SubscriptionInactiveError,
  getStoredAuth,
  getRestaurantSettings,
  getPaymentAccounts,
} from "../../lib/apiClient";
import { printBillReceipt } from "../../lib/printBillReceipt";
import { useSocket } from "../../contexts/SocketContext";
import { useBranch } from "../../contexts/BranchContext";
import toast from "react-hot-toast";
import { Loader2, Printer, Clock, User, CircleDot, MapPin, Phone, ExternalLink, Trash2, Banknote, CreditCard, Pencil, XCircle, ChevronDown, ShoppingBag, UtensilsCrossed, Headset, Smartphone, X, CircleCheckBig, Receipt } from "lucide-react";

const ORDER_STATUSES = [
  "All Orders",
  "NEW_ORDER",
  "PROCESSING",
  "READY",
  "DELIVERED",
  "CANCELLED"
];

const STATUS_TAB_LABELS = {
  "All Orders": "All Orders",
  NEW_ORDER: "New order",
  PROCESSING: "Processing",
  READY: "Ready",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled"
};

// Map order status to tab (supports legacy UNPROCESSED/PENDING/COMPLETED)
function orderStatusForTab(status) {
  if (!status) return "NEW_ORDER";
  if (status === "UNPROCESSED") return "NEW_ORDER";
  if (status === "PENDING") return "PROCESSING";
  if (status === "COMPLETED") return "DELIVERED";
  return status;
}

// Display order ID as YYYYMMDD-XXXX (strip "ORD-" prefix when present)
function getDisplayOrderId(order) {
  const id = order.id || order.orderNumber || order._id || "";
  if (typeof id === "string" && id.startsWith("ORD-")) return id.replace(/^ORD-/, "");
  return id;
}

// True when payment has been recorded or order is from external platform / cancelled (order should not be editable)
function isOrderPaidOrNonEditable(order) {
  if (order.status === "CANCELLED") return true;
  if (order.status === "DELIVERED" || order.status === "COMPLETED") return true;
  if (order.paymentAmountReceived != null && order.paymentAmountReceived > 0) return true;
  if (order.source === "FOODPANDA") return true;
  const pm = (order.paymentMethod || "").toUpperCase();
  return pm === "CASH" || pm === "CARD" || pm === "ONLINE" || pm === "FOODPANDA";
}

export default function OrdersPage() {
  const router = useRouter();
  const { socket } = useSocket() || {};
  const { currentBranch } = useBranch() || {};
  const [orders, setOrders] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Orders");
  const [sourceFilter, setSourceFilter] = useState("All Sources");
  const [sortOrder, setSortOrder] = useState("Newest First");
  const [suspended, setSuspended] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [onlineProvider, setOnlineProvider] = useState(null);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [paymentAccountsLoading, setPaymentAccountsLoading] = useState(true);
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [expandedOrderItems, setExpandedOrderItems] = useState({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTargetOrder, setCancelTargetOrder] = useState(null);

  const role = getStoredAuth()?.user?.role;
  const isOrderTaker = role === "order_taker";
  const isCashier = role === "cashier";
  const { viewMode, setViewMode } = useViewMode("grid");

  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState("");
  const [restaurantLogoHeight, setRestaurantLogoHeight] = useState(100);
  const [restaurantBillFooter, setRestaurantBillFooter] = useState("Thank you for your order!");

  async function loadOrders() {
    try {
      const data = await getOrders();
      setOrders(data);
      setPageLoading(false);
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) {
        setSuspended(true);
      } else {
        toast.error(err.message || "Failed to load orders");
      }
      setPageLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getRestaurantSettings()
      .then((data) => {
        if (cancelled) return;
        setRestaurantLogoUrl(data?.restaurantLogoUrl || "");
        const height = typeof data?.restaurantLogoHeightPx === "number" ? data.restaurantLogoHeightPx : 100;
        setRestaurantLogoHeight(height);
        setRestaurantBillFooter(data?.billFooterMessage || "Thank you for your order!");
      })
      .catch(() => {
        if (!cancelled) setRestaurantLogoUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPaymentAccountsLoading(true);
    getPaymentAccounts()
      .then((d) => { if (!cancelled) setPaymentAccounts(Array.isArray(d) ? d : (d?.accounts ?? [])); })
      .catch(() => { if (!cancelled) setPaymentAccounts([]); })
      .finally(() => { if (!cancelled) setPaymentAccountsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onOrderEvent = () => loadOrders();
    socket.on("order:created", onOrderEvent);
    socket.on("order:updated", onOrderEvent);
    return () => {
      socket.off("order:created", onOrderEvent);
      socket.off("order:updated", onOrderEvent);
    };
  }, [socket]);

  async function handleUpdateStatus(orderId, newStatus) {
    setUpdatingId(orderId);
    const toastId = toast.loading(`Updating order to ${newStatus}...`);
    try {
      const updated = await updateOrderStatus(orderId, newStatus);
      setOrders(prev =>
        prev.map(o => (o.id === orderId || o._id === orderId ? { ...o, ...updated } : o))
      );
      toast.success(`Order updated to ${newStatus}!`, { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to update status", { id: toastId });
    } finally {
      setUpdatingId(null);
    }
  }

  function openCancelModal(order) {
    setCancelTargetOrder(order);
    setShowCancelModal(true);
  }

  function closeCancelModal() {
    setShowCancelModal(false);
    setCancelTargetOrder(null);
  }

  async function handleDeleteOrder(order) {
    const orderId = order.id || order._id;
    const displayId = getDisplayOrderId(order);
    if (!window.confirm(`Delete order #${displayId}? This cannot be undone.`)) return;
    setDeletingId(orderId);
    const toastId = toast.loading("Deleting order...");
    try {
      await deleteOrder(orderId);
      setOrders(prev => prev.filter(o => (o._id || o.id) !== orderId));
      toast.success(`Order #${displayId} deleted successfully!`, { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to delete order", { id: toastId });
    } finally {
      setDeletingId(null);
    }
  }

  function openPaymentModal(order) {
    setPaymentOrder(order);
    setPaymentMethod("CASH");
    setOnlineProvider(null);
    setAmountReceived("");
    setPaymentError("");
    setShowPaymentModal(true);
  }

  function closePaymentModal() {
    setShowPaymentModal(false);
    setPaymentOrder(null);
    setOnlineProvider(null);
    setPaymentError("");
  }

  function openPrintBill(order, mode) {
    printBillReceipt(order, {
      mode,
      logoUrl: restaurantLogoUrl,
      branchAddress: currentBranch?.address || "",
      logoHeightPx: restaurantLogoHeight,
      footerMessage: restaurantBillFooter,
    });
  }

  async function handleRecordPayment(e) {
    e.preventDefault();
    if (!paymentOrder) return;
    const orderId = paymentOrder.id || paymentOrder._id;
    const billTotal = Number(paymentOrder.total) || 0;
    if (paymentMethod === "CASH") {
      const received = Number(amountReceived);
      if (isNaN(received) || received < billTotal) {
        setPaymentError(`Amount received must be at least Rs ${billTotal}`);
        return;
      }
    }
    setPaymentLoading(true);
    setPaymentError("");
    const toastId = toast.loading("Recording payment...");
    try {
      const payload = { paymentMethod };
      if (paymentMethod === "CASH") {
        const received = Number(amountReceived);
        payload.amountReceived = received;
        payload.amountReturned = received - billTotal;
      }
      if (paymentMethod === "ONLINE" && onlineProvider) {
        payload.paymentProvider = onlineProvider;
      }
      const updated = await recordOrderPayment(orderId, payload);
      setOrders(prev =>
        prev.map(o => (o._id === orderId || o.id === orderId ? { ...o, ...updated } : o))
      );
      toast.success("Payment recorded successfully!", { id: toastId });
      closePaymentModal();
    } catch (err) {
      setPaymentError(err.message || "Failed to record payment");
      toast.error(err.message || "Failed to record payment", { id: toastId });
    } finally {
      setPaymentLoading(false);
    }
  }

  // Cashier scope: today's orders + any still-active orders from previous days
  // (so they can complete pending orders without seeing historical data)
  const cashierBaseOrders = useMemo(() => {
    if (!isCashier) return orders;
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return orders.filter(o => {
      const isToday = (o.createdAt || "").slice(0, 10) === todayStr;
      const isActive = !["DELIVERED", "COMPLETED", "CANCELLED"].includes(
        (o.status || "").toUpperCase()
      );
      return isToday || isActive;
    });
  }, [orders, isCashier]);

  const filtered = useMemo(() => {
    return cashierBaseOrders
      .filter(o => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return (
          (o.id || "").toLowerCase().includes(term) ||
          (o.customerName || "").toLowerCase().includes(term) ||
          (o.orderTakerName || "").toLowerCase().includes(term) ||
          (o.externalOrderId || "").toLowerCase().includes(term) ||
          (o.customerPhone || "").toLowerCase().includes(term)
        );
      })
      .filter(o =>
        statusFilter === "All Orders" ? true : orderStatusForTab(o.status) === statusFilter
      )
      .filter(o =>
        sourceFilter === "All Sources" ? true : o.source === sourceFilter
      )
      .sort((a, b) => {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return sortOrder === "Newest First" ? db - da : da - db;
      });
  }, [cashierBaseOrders, search, statusFilter, sourceFilter, sortOrder]);

  return (
    <AdminLayout title="All Orders" suspended={suspended}>
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order ID, customer, phone..."
          className="flex-1 h-10 px-4 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="h-10 px-4 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all whitespace-nowrap flex-shrink-0"
        >
          <option value="All Sources">All Sources</option>
          <option value="POS">POS</option>
          <option value="FOODPANDA">Foodpanda</option>
          <option value="WEBSITE">Website</option>
        </select>
        {!isCashier && (
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="h-10 px-4 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all whitespace-nowrap flex-shrink-0"
          >
            <option>Newest First</option>
            <option>Oldest First</option>
          </select>
        )}
        <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        <button
          type="button"
          onClick={() => {
            const toastId = toast.loading("Refreshing orders...");
            loadOrders()
              .then(() => { toast.success("Orders refreshed!", { id: toastId }); })
              .catch(() => { toast.dismiss(toastId); });
          }}
          className="h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all whitespace-nowrap flex-shrink-0"
        >
          Refresh
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {ORDER_STATUSES.map(s => {
          const isActive = statusFilter === s;
          const count =
            s === "All Orders"
              ? cashierBaseOrders.length
              : cashierBaseOrders.filter(o => orderStatusForTab(o.status) === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive
                  ? "bg-primary text-white shadow-md"
                  : "bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-primary"
                }`}
            >
              {STATUS_TAB_LABELS[s]} <span className={`ml-1.5 ${isActive ? "opacity-90" : "opacity-60"}`}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {pageLoading && (
        <div className="flex flex-col items-center justify-center min-h-[280px] py-12">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-3">
            <ShoppingBag className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <p className="text-sm font-semibold text-gray-700 dark:text-neutral-300">Loading orders...</p>
          </div>
        </div>
      )}

      {/* Table view */}
      {!pageLoading && viewMode === "table" && (
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          <DataTable
            rows={filtered}
            emptyMessage="No orders found. Try adjusting your filters."
            columns={[
              {
                key: "id",
                header: "Order",
                render: (_, order) => (
                  <span className="font-semibold text-gray-900 dark:text-white">#{getDisplayOrderId(order)}</span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (_, order) => <StatusBadge status={order.status} />,
              },
              {
                key: "customerName",
                header: "Customer",
                render: (_, order) => (
                  <span className="font-medium text-gray-900 dark:text-white text-sm">
                    {(order.customerName || "").trim() || (order.source === "FOODPANDA" ? "Foodpanda Customer" : "N/A")}
                  </span>
                ),
              },
              {
                key: "customerPhone",
                header: "Phone",
                hideOnMobile: true,
                render: (val) => (
                  <span className="text-sm text-gray-600 dark:text-neutral-400">{val || "—"}</span>
                ),
              },
              {
                key: "type",
                header: "Type",
                hideOnMobile: true,
                render: (_, order) => (
                  <div className="text-sm text-gray-600 dark:text-neutral-400 capitalize">
                    {order.tableName ? (
                      <span className="flex items-center gap-1"><UtensilsCrossed className="w-3.5 h-3.5" />{order.tableName}</span>
                    ) : order.deliveryAddress ? (
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />Delivery</span>
                    ) : (
                      order.type || "—"
                    )}
                  </div>
                ),
              },
              {
                key: "createdAt",
                header: "Date & Time",
                hideOnTablet: true,
                render: (val) => {
                  const d = new Date(val);
                  return (
                    <span className="text-sm text-gray-600 dark:text-neutral-400 whitespace-nowrap">
                      {d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}{" "}
                      {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                    </span>
                  );
                },
              },
              {
                key: "paymentMethod",
                header: "Payment",
                hideOnMobile: true,
                render: (val, row) => {
                  const providerLabels = { JAZZCASH: "JazzCash", EASYPAISA: "Easypaisa", BANK: "Bank Account" };
                  const provider = val?.toUpperCase() === "ONLINE" && row?.paymentProvider
                    ? providerLabels[row.paymentProvider] ?? row.paymentProvider
                    : null;
                  return (
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-600 dark:text-neutral-400">{val || "—"}</span>
                      {provider && (
                        <span className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">{provider}</span>
                      )}
                    </div>
                  );
                },
              },
              {
                key: "total",
                header: "Total",
                align: "right",
                render: (val) => (
                  <span className="font-semibold text-primary">Rs {Number(val).toFixed(2)}</span>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (_, order) => {
                  const isUpdating = updatingId === order.id || updatingId === order._id;
                  const nextStatuses = getNextStatuses(order.status);
                  const primaryNext = nextStatuses[0];
                  const NEXT_LABELS = { PROCESSING: "Processing", READY: "Ready", DELIVERED: "Delivered" };
                  return (
                    <div className="inline-flex items-center gap-1">
                      {order.status !== "CANCELLED" && order.status !== "DELIVERED" && order.status !== "COMPLETED" && !isOrderTaker && (
                        <button type="button" disabled={isUpdating} onClick={() => openCancelModal(order)}
                          className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-50" title="Cancel">
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!isOrderPaidOrNonEditable(order) && !isOrderTaker && (
                        <button type="button" onClick={() => router.push(`/pos?edit=${order.id || order._id}`)}
                          className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-primary transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {order.status !== "CANCELLED" && !isOrderTaker && (
                        <button type="button" onClick={() => openPrintBill(order, order.status === "DELIVERED" || order.status === "COMPLETED" ? "receipt" : "bill")}
                          className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-primary transition-colors" title="Print">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {order.status !== "CANCELLED" && !isOrderPaidOrNonEditable(order) && !isOrderTaker && (
                        <button type="button" onClick={() => openPaymentModal(order)}
                          className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors" title="Take payment">
                          <Banknote className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {primaryNext && !isOrderTaker && (
                        <button type="button" disabled={isUpdating}
                          onClick={() => handleUpdateStatus(order.id || order._id, primaryNext)}
                          className="px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 whitespace-nowrap">
                          {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (NEXT_LABELS[primaryNext] || primaryNext)}
                        </button>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
        </div>
      )}

      {/* Order cards grid */}
      {!pageLoading && viewMode === "grid" && (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <>
        {filtered.map(order => {
          const nextStatuses = getNextStatuses(order.status);
          const primaryNext = nextStatuses[0];
          const isUpdating = updatingId === order.id || updatingId === order._id;

          const NEXT_LABELS = {
            PROCESSING: "Processing",
            READY: "Ready",
            DELIVERED: "Delivered"
          };

          const orderDate = new Date(order.createdAt);
          const dateStr = orderDate.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
          const timeStr = orderDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
          const discountPercent = order.subtotal > 0 ? ((order.discountAmount / order.subtotal) * 100) : 0;
          const orderKey = order.id || order._id;
          const itemsExpanded = !!expandedOrderItems[orderKey];

          return (
            <div
              key={order.id}
              className="flex flex-col bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Header: ID, status under ID, edit button top-right */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gradient-to-r from-gray-50/50 dark:from-neutral-900/30 to-transparent">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 ">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        #{getDisplayOrderId(order)}
                      </span>
                      
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 w-full justify-between">
                      <StatusBadge status={order.status} />
                      {order.source === "FOODPANDA" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400 font-semibold">
                          Foodpanda
                        </span>
                      )}
                      {order.source === "WEBSITE" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 font-semibold">
                          Website
                        </span>
                      )}
                    </div>
                  </div>
                  {!isOrderTaker && (
                  <div className="flex items-center gap-2">
                    {order.status !== "CANCELLED" && order.status !== "DELIVERED" && order.status !== "COMPLETED" && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => openCancelModal(order)}
                        className="p-2 rounded-lg bg-white dark:bg-neutral-900 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Cancel order"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    {!isOrderPaidOrNonEditable(order) && (
                      <button
                        type="button"
                        onClick={() => router.push(`/pos?edit=${order.id || order._id}`)}
                        className="p-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-primary hover:border-primary/30 transition-colors"
                        title="Edit order"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  )}
                </div>
                {order.externalOrderId && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-neutral-500">
                    <ExternalLink className="w-3 h-3" />
                    <span>Ext: #{order.externalOrderId}</span>
                  </div>
                )}
              </div>

              {/* Order Details */}
              <div className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
                  <span className="font-medium text-gray-900 dark:text-white">{(order.customerName || "").trim() || (order.source === "FOODPANDA" ? "Foodpanda Customer" : "N/A")}</span>
                </div>
                {order.customerPhone && (
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-neutral-400">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{order.customerPhone}</span>
                  </div>
                )}
                {order.deliveryAddress && (
                  <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-neutral-400">
                    <MapPin className="w-3.5 h-3.5 mt-0.5" />
                    <span className="line-clamp-2">{order.deliveryAddress}</span>
                  </div>
                )}
                {order.tableName && (
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-neutral-400">
                    <UtensilsCrossed className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
                    <span>{order.tableName}</span>
                  </div>
                )}
                {order.orderTakerName && (
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-neutral-400">
                    <Headset className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
                    <span>{order.orderTakerName}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{dateStr} at {timeStr}</span>
                </div>
              </div>

              {/* Items (collapsible) */}
              {order.items && order.items.length > 0 && (
                <div className="px-4 pb-3 border-b border-gray-100 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedOrderItems((prev) => ({
                        ...prev,
                        [orderKey]: !prev[orderKey],
                      }))
                    }
                    className="w-full flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-2"
                  >
                    <span>
                      Order Items ·{" "}
                      <span className="font-bold">
                        {order.items.length} {order.items.length === 1 ? "item" : "items"}
                      </span>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 dark:text-neutral-500 transition-transform ${
                        itemsExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {itemsExpanded && (
                    <div className="space-y-1.5">
                      {order.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 dark:text-neutral-300 truncate max-w-[160px]">
                            {it.name}
                          </span>
                          <span className="text-gray-500 dark:text-neutral-500 font-medium">
                            x{it.qty}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Payment & Pricing */}
              <div className="px-4 py-3 space-y-2">
                {order.paymentMethod && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-neutral-500">Payment</span>
                    <div className="flex flex-col items-end">
                      <span className="font-semibold text-gray-700 dark:text-neutral-300">{order.paymentMethod}</span>
                      {order.paymentMethod?.toUpperCase() === "ONLINE" && order.paymentProvider && (
                        <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400">
                          {{ JAZZCASH: "JazzCash", EASYPAISA: "Easypaisa", BANK: "Bank Account" }[order.paymentProvider] ?? order.paymentProvider}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {discountPercent > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-neutral-500">Discount</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">-{discountPercent.toFixed(0)}%</span>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">Total</span>
                  <span className="text-xl font-bold text-primary">Rs {order.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Actions (hidden for order_taker – view only) */}
              {!isOrderTaker && (
              <div className="mt-auto px-4 pb-4 pt-3 border-t border-gray-100 dark:border-neutral-800 flex flex-wrap items-center gap-2">
                {(order.status === "DELIVERED" || order.status === "COMPLETED") ? (
                  <>
                    {(order.paymentMethod === "To be paid" || order.paymentMethod === "PENDING") && (
                      <button
                        type="button"
                        onClick={() => openPaymentModal(order)}
                        className="p-2.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                        title="Record payment"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openPrintBill(order, "receipt")}
                      className="p-2.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                      title="Print receipt"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    {order.status !== "CANCELLED" && !isOrderPaidOrNonEditable(order) && (
                      <button
                        type="button"
                        onClick={() => openPaymentModal(order)}
                        className="p-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                        title="Take payment"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {order.status !== "CANCELLED" && (
                      <button
                        type="button"
                        onClick={() => openPrintBill(order, "bill")}
                        className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-primary hover:border-primary/30 transition-colors"
                        title="Print bill"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {primaryNext && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(order.id || order._id, primaryNext)}
                        className="flex-1 rounded-lg bg-primary text-white px-4 py-2.5 text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                        ) : (
                          NEXT_LABELS[primaryNext] || `Mark ${primaryNext}`
                        )}
                      </button>
                    )}
                    {/* Delete temporarily hidden */}
                  </>
                )}
              </div>
              )}
            </div>
            );
          })}

        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
              <CircleDot className="w-10 h-10 text-gray-300 dark:text-neutral-700" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-neutral-400">No orders found</p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Try adjusting your filters</p>
          </div>
        )}
        </>
      </div>
      )}

      {/* Take payment modal */}
      {showPaymentModal && paymentOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">Take Payment</h2>
                  <p className="text-[11px] text-gray-400 dark:text-neutral-500">Order #{getDisplayOrderId(paymentOrder)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePaymentModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bill total hero */}
            <div className="px-5 pt-5">
              <div className="text-center py-4 px-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Bill Total</p>
                <p className="text-4xl font-black text-gray-900 dark:text-white tabular-nums leading-none">
                  Rs {Math.round(Number(paymentOrder.total)).toLocaleString()}
                </p>
                {Number(paymentOrder.total) % 1 !== 0 && (
                  <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">{Number(paymentOrder.total).toFixed(2)}</p>
                )}
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="px-5 pt-4 pb-5 space-y-4">
              {paymentError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">{paymentError}</p>
                </div>
              )}

              {/* Payment method tiles */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Payment method</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                      paymentMethod === "CASH"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600"
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CARD")}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                      paymentMethod === "CARD"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
                        : "border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600"
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod("ONLINE"); setOnlineProvider(null); }}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                      paymentMethod === "ONLINE"
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400"
                        : "border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600"
                    }`}
                  >
                    <Smartphone className="w-5 h-5" />
                    Online
                  </button>
                </div>
              </div>

              {/* Online provider sub-options — dynamic from Business Settings */}
              {paymentMethod === "ONLINE" && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Paid to</label>
                  {paymentAccountsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                      <span className="text-xs text-gray-400 dark:text-neutral-500">Loading accounts…</span>
                    </div>
                  ) : paymentAccounts.length === 0 ? (
                    <div className="px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400">
                      No payment accounts configured. Go to <span className="font-semibold">Business Settings → Payment Accounts</span> to add them.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {paymentAccounts.map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => setOnlineProvider(acc.name)}
                          className={`px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                            onlineProvider === acc.name
                              ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10"
                              : "border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600"
                          }`}
                        >
                          <p className={`text-xs font-semibold truncate ${onlineProvider === acc.name ? "text-violet-700 dark:text-violet-400" : "text-gray-700 dark:text-neutral-300"}`}>{acc.name}</p>
                          {acc.description && <p className="text-[10px] text-gray-400 dark:text-neutral-500 truncate mt-0.5">{acc.description}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                  {paymentAccounts.length > 0 && !onlineProvider && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">Please select an account to continue.</p>
                  )}
                </div>
              )}

              {/* Cash-specific fields */}
              {paymentMethod === "CASH" && (() => {
                const orderTotal = Number(paymentOrder.total);
                const exactAmt = Math.ceil(orderTotal);
                const roundDenominations = [100, 200, 500, 1000, 2000, 5000, 10000];
                const quickAmounts = [exactAmt, ...roundDenominations.filter((v) => v > exactAmt)].slice(0, 4);
                const receivedNum = Number(amountReceived);
                const isUnderpaid = amountReceived !== "" && !isNaN(receivedNum) && receivedNum < orderTotal;
                const isOverpaid  = amountReceived !== "" && !isNaN(receivedNum) && receivedNum >= orderTotal;
                return (
                  <>
                    {/* Quick-amount presets */}
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Quick amount</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {quickAmounts.map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setAmountReceived(String(amt))}
                            className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                              receivedNum === amt
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
                            }`}
                          >
                            {amt.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Amount received input */}
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">
                        Amount received (Rs)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required={paymentMethod === "CASH"}
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        placeholder={`Min. ${exactAmt.toLocaleString()}`}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-base font-bold text-gray-900 dark:text-white placeholder:font-normal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                      />
                    </div>

                    {/* Change */}
                    {isOverpaid && (
                      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Change</span>
                        </div>
                        <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                          Rs {(receivedNum - orderTotal).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Short-by warning */}
                    {isUnderpaid && (
                      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-xs font-semibold text-red-700 dark:text-red-400">Short by</span>
                        </div>
                        <span className="text-xl font-black text-red-700 dark:text-red-400 tabular-nums">
                          Rs {(orderTotal - receivedNum).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    paymentLoading ||
                    (paymentMethod === "CASH" && (amountReceived === "" || Number(amountReceived) < Number(paymentOrder.total))) ||
                    (paymentMethod === "ONLINE" && !onlineProvider)
                  }
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {paymentLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                    : <><CircleCheckBig className="w-4 h-4" /> Record Payment</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel order confirmation modal */}
      {showCancelModal && cancelTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cancel order</h2>
              <button
                type="button"
                onClick={closeCancelModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-700 dark:text-neutral-300">
                Are you sure you want to cancel order{" "}
                <span className="font-semibold">
                  #{getDisplayOrderId(cancelTargetOrder)}
                </span>
                ? This cannot be undone.
              </p>
              <p className="text-xs text-gray-500 dark:text-neutral-500">
                Status will be updated to <span className="font-semibold">Cancelled</span> and the order
                will no longer appear in active lists.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeCancelModal}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-neutral-300"
                >
                  Keep order
                </button>
                <button
                  type="button"
                  disabled={updatingId === (cancelTargetOrder.id || cancelTargetOrder._id)}
                  onClick={() => {
                    const id = cancelTargetOrder.id || cancelTargetOrder._id;
                    handleUpdateStatus(id, "CANCELLED");
                    closeCancelModal();
                  }}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {updatingId === (cancelTargetOrder.id || cancelTargetOrder._id)
                    ? "Cancelling..."
                    : "Yes, cancel order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
