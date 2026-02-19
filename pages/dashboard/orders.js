import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import {
  getOrders,
  getNextStatuses,
  updateOrderStatus,
  deleteOrder,
  recordOrderPayment,
  SubscriptionInactiveError,
  getStoredAuth,
} from "../../lib/apiClient";
import toast from "react-hot-toast";
import { Loader2, Printer, Clock, User, CircleDot, MapPin, Phone, ExternalLink, Trash2, Banknote, CreditCard, Pencil, XCircle, ChevronDown, ShoppingBag } from "lucide-react";

const ORDER_STATUSES = [
  "All Orders",
  "UNPROCESSED",
  "PENDING",
  "READY",
  "COMPLETED",
  "CANCELLED"
];

const STATUS_TAB_LABELS = {
  "All Orders": "All Orders",
  UNPROCESSED: "Unprocessed",
  PENDING: "Pending",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled"
};

// Display order ID as YYYYMMDD-XXXX (strip "ORD-" prefix when present)
function getDisplayOrderId(order) {
  const id = order.id || order.orderNumber || order._id || "";
  if (typeof id === "string" && id.startsWith("ORD-")) return id.replace(/^ORD-/, "");
  return id;
}

// True when payment has been recorded or order is from external platform / cancelled (order should not be editable)
function isOrderPaidOrNonEditable(order) {
  if (order.status === "CANCELLED") return true;
  if (order.paymentAmountReceived != null && order.paymentAmountReceived > 0) return true;
  if (order.source === "FOODPANDA") return true;
  const pm = (order.paymentMethod || "").toUpperCase();
  return pm === "CASH" || pm === "CARD" || pm === "ONLINE" || pm === "FOODPANDA";
}

function printBill(order, mode = "auto") {
  const win = window.open("", "_blank", "width=360,height=600");
  if (!win) return;

  const itemsHtml = (order.items || [])
    .map(
      (it) =>
        `<tr>
          <td style="padding:4px 0;border-bottom:1px dashed #ddd">${it.name}</td>
          <td style="padding:4px 8px;text-align:center;border-bottom:1px dashed #ddd">${it.qty}</td>
          <td style="padding:4px 0;text-align:right;border-bottom:1px dashed #ddd">Rs ${(it.unitPrice * it.qty).toFixed(0)}</td>
        </tr>`
    )
    .join("");

  const discount = order.discountAmount || 0;

  const hasPaymentDetails =
    order.paymentAmountReceived != null && order.paymentAmountReceived > 0;

  // Decide whether this printout is a bill (before payment) or a receipt (after payment)
  const isReceipt =
    mode === "receipt" || (mode === "auto" && hasPaymentDetails);

  const titleLabel = isReceipt ? "Receipt" : "Bill";
  const headerLabel = isReceipt ? "Order Receipt" : "Customer Bill";
  const paymentLabel =
    order.paymentMethod ||
    (isReceipt ? "Cash" : "To be paid");

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${titleLabel} – ${getDisplayOrderId(order)}</title>
  <style>
    body { font-family: 'Courier New', monospace; margin: 0; padding: 16px; font-size: 13px; color: #222; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    hr { border: none; border-top: 1px dashed #999; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; }
    .total-row td { font-weight: bold; padding-top: 6px; }
  </style>
</head>
<body>
  <div class="center bold" style="font-size:16px;margin-bottom:4px;">Eats Desk</div>
  <div class="center" style="font-size:11px;color:#666;margin-bottom:8px;">${headerLabel}</div>
  <hr/>
  <div><strong>Order:</strong> ${getDisplayOrderId(order)}</div>
  <div><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</div>
  <div><strong>Customer:</strong> ${order.customerName || "Walk‑in"}</div>
  <div><strong>Type:</strong> ${order.type || "dine-in"}</div>
  <div><strong>Payment:</strong> ${paymentLabel}</div>
  ${
    isReceipt && hasPaymentDetails
      ? `<div><strong>Amount received:</strong> Rs ${order.paymentAmountReceived.toFixed(
          0,
        )}</div><div><strong>Return:</strong> Rs ${
          order.paymentAmountReturned != null
            ? order.paymentAmountReturned
            : 0
        }.toFixed(0)</div>`
      : ""
  }
  <hr/>
  <table>
    <thead>
      <tr style="font-weight:bold;border-bottom:1px solid #999">
        <td style="padding:4px 0">Item</td>
        <td style="padding:4px 8px;text-align:center">Qty</td>
        <td style="padding:4px 0;text-align:right">Amount</td>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>
  <hr/>
  <table>
    <tr>
      <td>Subtotal</td>
      <td style="text-align:right">Rs ${(order.subtotal || order.total).toFixed(0)}</td>
    </tr>
    ${discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">- Rs ${discount.toFixed(0)}</td></tr>` : ""}
    <tr class="total-row" style="font-size:15px">
      <td>Grand Total</td>
      <td style="text-align:right">Rs ${order.total.toFixed(0)}</td>
    </tr>
  </table>
  <hr/>
  <div class="center" style="font-size:11px;color:#888;margin-top:12px;">Thank you for your order!</div>
  <script>
    window.onload = function() { window.print(); };
  <\/script>
</body>
</html>`);
  win.document.close();
}

export default function OrdersPage() {
  const router = useRouter();
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
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [expandedOrderItems, setExpandedOrderItems] = useState({});

  const role = getStoredAuth()?.user?.role;
  const isOrderTaker = role === "order_taker";

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

  async function handleDeleteOrder(order) {
    const orderId = order._id || order.id;
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
    setAmountReceived("");
    setPaymentError("");
    setShowPaymentModal(true);
  }

  function closePaymentModal() {
    setShowPaymentModal(false);
    setPaymentOrder(null);
    setPaymentError("");
  }

  async function handleRecordPayment(e) {
    e.preventDefault();
    if (!paymentOrder) return;
    const orderId = paymentOrder._id || paymentOrder.id;
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

  const filtered = useMemo(() => {
    return orders
      .filter(o => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return (
          (o.id || "").toLowerCase().includes(term) ||
          (o.customerName || "").toLowerCase().includes(term) ||
          (o.externalOrderId || "").toLowerCase().includes(term) ||
          (o.customerPhone || "").toLowerCase().includes(term)
        );
      })
      .filter(o =>
        statusFilter === "All Orders" ? true : o.status === statusFilter
      )
      .filter(o =>
        sourceFilter === "All Sources" ? true : o.source === sourceFilter
      )
      .sort((a, b) => {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return sortOrder === "Newest First" ? db - da : da - db;
      });
  }, [orders, search, statusFilter, sourceFilter, sortOrder]);

  return (
    <AdminLayout title="All Orders" suspended={suspended}>
      {/* Page Loader */}
      {pageLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-200 dark:border-neutral-800 border-t-primary rounded-full animate-spin"></div>
              <ShoppingBag className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-neutral-300">Loading orders...</p>
          </div>
        </div>
      )}
      
      {/* Filters Bar */}
      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by order ID, customer, phone..."
            className="flex-1 min-w-[200px] px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="All Sources">All Sources</option>
            <option value="POS">POS</option>
            <option value="FOODPANDA">Foodpanda</option>
            <option value="WEBSITE">Website</option>
          </select>
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option>Newest First</option>
            <option>Oldest First</option>
          </select>
          <button
            type="button"
            onClick={() => {
              const toastId = toast.loading("Refreshing orders...");
              loadOrders().then(() => {
                toast.success("Orders refreshed!", { id: toastId });
              }).catch(() => {
                toast.dismiss(toastId);
              });
            }}
            className="px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {ORDER_STATUSES.map(s => {
          const isActive = statusFilter === s;
          const count =
            s === "All Orders"
              ? orders.length
              : orders.filter(o => o.status === s).length;
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

      {/* Order cards grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map(order => {
          const nextStatuses = getNextStatuses(order.status);
          const primaryNext = nextStatuses[0];
          const isUpdating = updatingId === order.id || updatingId === order._id;

          const NEXT_LABELS = {
            PENDING: "Pending",
            READY: "Ready",
            COMPLETED: "Completed"
          };

          const orderDate = new Date(order.createdAt);
          const dateStr = orderDate.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
          const timeStr = orderDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
          const discountPercent = order.subtotal > 0 ? ((order.discountAmount / order.subtotal) * 100) : 0;
          const orderKey = order._id || order.id;
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
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        #{getDisplayOrderId(order)}
                      </span>
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
                    <div className="mt-0.5">
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                  {!isOrderTaker && (
                  <div className="flex items-center gap-2">
                    {order.status !== "CANCELLED" && order.status !== "COMPLETED" && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(order._id || order.id, "CANCELLED")}
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
                        onClick={() => router.push(`/dashboard/pos?edit=${order._id || order.id}`)}
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
                  <span className="font-medium text-gray-900 dark:text-white">{order.customerName || "Walk-in"}</span>
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
                    <span className="font-semibold text-gray-700 dark:text-neutral-300">{order.paymentMethod}</span>
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
                  <span className="text-xl font-bold text-primary">Rs {order.total.toFixed(0)}</span>
                </div>
              </div>

              {/* Actions (hidden for order_taker – view only) */}
              {!isOrderTaker && (
              <div className="mt-auto px-4 pb-4 pt-3 border-t border-gray-100 dark:border-neutral-800 flex flex-wrap items-center gap-2">
                {order.status === "COMPLETED" ? (
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
                      onClick={() => printBill(order, "receipt")}
                      className="p-2.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                      title="Print receipt"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    {!isOrderPaidOrNonEditable(order) && (
                      <button
                        type="button"
                        disabled={deletingId === (order._id || order.id)}
                        onClick={() => handleDeleteOrder(order)}
                        className="p-2.5 rounded-lg border border-gray-200 dark:border-neutral-600 text-gray-600 dark:text-neutral-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-500/30 transition-colors disabled:opacity-50"
                        title="Delete order"
                      >
                        {deletingId === (order._id || order.id) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {order.status !== "CANCELLED" && (
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
                        onClick={() => printBill(order, "bill")}
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
                        onClick={() => handleUpdateStatus(order._id || order.id, primaryNext)}
                        className="flex-1 rounded-lg bg-primary text-white px-4 py-2.5 text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                        ) : (
                          NEXT_LABELS[primaryNext] || `Mark ${primaryNext}`
                        )}
                      </button>
                    )}
                    {!isOrderPaidOrNonEditable(order) && (
                      <button
                        type="button"
                        disabled={deletingId === (order._id || order.id)}
                        onClick={() => handleDeleteOrder(order)}
                        className="p-2.5 rounded-lg border border-gray-200 dark:border-neutral-600 text-gray-600 dark:text-neutral-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-500/30 transition-colors disabled:opacity-50"
                        title="Delete order"
                      >
                        {deletingId === (order._id || order.id) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
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
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
              Try adjusting your filters
            </p>
          </div>
        )}
      </div>

      {/* Take payment modal */}
      {showPaymentModal && paymentOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Take payment</h2>
              <button
                type="button"
                onClick={closePaymentModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-neutral-400">
                Order #{getDisplayOrderId(paymentOrder)} · Rs {Number(paymentOrder.total).toFixed(0)}
              </p>
              {paymentError && (
                <p className="text-sm text-red-600 dark:text-red-400">{paymentError}</p>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-2">Payment method</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${paymentMethod === "CASH" ? "border-primary bg-primary/10 text-primary" : "border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300"}`}
                  >
                    <Banknote className="w-4 h-4" /> Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CARD")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${paymentMethod === "CARD" ? "border-primary bg-primary/10 text-primary" : "border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300"}`}
                  >
                    <CreditCard className="w-4 h-4" /> Card
                  </button>
                </div>
              </div>
              {paymentMethod === "CASH" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">Bill total (Rs)</label>
                    <div className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-sm font-semibold text-gray-900 dark:text-white">
                      Rs {Number(paymentOrder.total).toFixed(0)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">Amount received (Rs) *</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required={paymentMethod === "CASH"}
                      value={amountReceived}
                      onChange={e => setAmountReceived(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                  {amountReceived !== "" && !isNaN(Number(amountReceived)) && Number(amountReceived) >= Number(paymentOrder.total) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">Return to customer (Rs)</label>
                      <div className="px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        Rs {(Number(amountReceived) - Number(paymentOrder.total)).toFixed(0)}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentLoading || (paymentMethod === "CASH" && (amountReceived === "" || Number(amountReceived) < Number(paymentOrder.total)))}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {paymentLoading ? "Recording…" : "Record payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
