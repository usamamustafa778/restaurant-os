import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import {
  getOrders,
  getNextStatuses,
  updateOrderStatus,
  SubscriptionInactiveError
} from "../../lib/apiClient";
import { Loader2, Printer, Clock, User, CircleDot, MapPin, Phone, ExternalLink } from "lucide-react";

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

function printBill(order) {
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

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Receipt – ${order.id}</title>
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
  <div class="center bold" style="font-size:16px;margin-bottom:4px;">RestaurantOS</div>
  <div class="center" style="font-size:11px;color:#666;margin-bottom:8px;">Order Receipt</div>
  <hr/>
  <div><strong>Order:</strong> ${order.id}</div>
  <div><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</div>
  <div><strong>Customer:</strong> ${order.customerName || "Walk‑in"}</div>
  <div><strong>Type:</strong> ${order.type || "dine-in"}</div>
  <div><strong>Payment:</strong> ${order.paymentMethod || "Cash"}</div>
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
  const [orders, setOrders] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Orders");
  const [sourceFilter, setSourceFilter] = useState("All Sources");
  const [sortOrder, setSortOrder] = useState("Newest First");
  const [suspended, setSuspended] = useState(false);
  const [error, setError] = useState("");

  async function loadOrders() {
    try {
      const data = await getOrders();
      setOrders(data);
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) {
        setSuspended(true);
      } else {
        setError(err.message || "Failed to load orders");
      }
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function handleUpdateStatus(orderId, newStatus) {
    setUpdatingId(orderId);
    try {
      const updated = await updateOrderStatus(orderId, newStatus);
      setOrders(prev =>
        prev.map(o => (o.id === orderId || o._id === orderId ? { ...o, ...updated } : o))
      );
    } catch (err) {
      setError(err.message || "Failed to update status");
    } finally {
      setUpdatingId(null);
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
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <Card
        title="Orders"
        description="View, manage and print orders."
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-xs">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by order ID, customer, phone..."
            className="flex-1 px-3 py-1.5 min-w-[180px] max-w-sm rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
          />
          <div className="flex items-center gap-2">
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white"
            >
              <option value="All Sources">All Sources</option>
              <option value="POS">POS</option>
              <option value="FOODPANDA">Foodpanda</option>
              <option value="WEBSITE">Website</option>
            </select>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white"
            >
              <option>Newest First</option>
              <option>Oldest First</option>
            </select>
            <Button type="button" variant="ghost" className="text-xs" onClick={loadOrders}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2 mb-4 text-xs">
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
                className={`px-3 py-1.5 rounded-full border text-[11px] font-medium transition-colors ${isActive
                    ? "bg-primary text-white border-primary"
                    : "bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border-gray-300 dark:border-neutral-700 hover:bg-bg-primary dark:hover:bg-neutral-800"
                  }`}
              >
                {STATUS_TAB_LABELS[s]} ({count})
              </button>
            );
          })}
        </div>

        {/* Order cards grid */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map(order => {
            const nextStatuses = getNextStatuses(order.status);
            const primaryNext = nextStatuses[0];
            const isUpdating = updatingId === order.id || updatingId === order._id;

            const statusAccent =
              order.status === "UNPROCESSED"
                ? "border-orange-300 bg-orange-50"
                : order.status === "PENDING"
                  ? "border-amber-300 bg-amber-50"
                  : order.status === "READY"
                    ? "border-sky-300 bg-sky-50"
                    : order.status === "COMPLETED"
                      ? "border-emerald-300 bg-emerald-50"
                      : order.status === "CANCELLED"
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300 bg-bg-primary";

            const NEXT_LABELS = {
              PENDING: "Mark Pending",
              READY: "Mark Ready",
              COMPLETED: "Mark Completed"
            };

            const orderDate = new Date(order.createdAt);
            const dateStr = orderDate.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
            const timeStr = orderDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
            const discountPercent = order.subtotal > 0 ? ((order.discountAmount / order.subtotal) * 100) : 0;

            return (
              <div
                key={order.id}
                className={`flex flex-col rounded-xl border ${statusAccent} dark:bg-neutral-950 dark:border-neutral-800 shadow-sm`}
              >
                {/* Header: ID + Source + Status */}
                <div className="flex items-start justify-between gap-2 px-4 pt-3 pb-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-bold text-gray-900 dark:text-white">ID: {order.id}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {order.source === "FOODPANDA" && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-300 text-[9px] font-bold dark:bg-pink-500/20 dark:text-pink-400 dark:border-pink-500/40">
                          🐼 FoodPanda Order
                        </span>
                      )}
                      {order.source === "WEBSITE" && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-300 text-[9px] font-bold dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40">
                          🌐 Website Order
                        </span>
                      )}
                      {order.externalOrderId && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-neutral-400">
                          <ExternalLink className="w-2.5 h-2.5" />
                          #{order.externalOrderId}
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                {/* Order Details */}
                <div className="px-4 space-y-1.5 text-[12px] text-neutral-700 dark:text-neutral-300">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-neutral-400" />
                    <span><strong>Customer Name:</strong> {order.customerName || "Walk‑in Customer"}</span>
                  </div>
                  {order.deliveryAddress && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400 mt-0.5" />
                      <span><strong>Address:</strong> {order.deliveryAddress}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-neutral-400" />
                    <span><strong>Phone:</strong> {order.customerPhone || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    <span><strong>Order Date:</strong> {dateStr}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    <span><strong>Order Time:</strong> {timeStr}</span>
                  </div>
                </div>

                {/* Items */}
                {order.items && order.items.length > 0 && (
                  <div className="px-4 mt-2">
                    <p className="font-semibold text-[11px] text-neutral-700 dark:text-neutral-200 mb-1">Items</p>
                    <ul className="space-y-0.5">
                      {order.items.slice(0, 4).map((it, idx) => (
                        <li key={idx} className="flex justify-between text-[11px] text-neutral-600 dark:text-neutral-300">
                          <span className="truncate max-w-[150px]">{it.name}</span>
                          <span className="ml-2 text-neutral-500">x{it.qty}</span>
                        </li>
                      ))}
                      {order.items.length > 4 && (
                        <li className="text-[10px] text-neutral-500">+{order.items.length - 4} more</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Totals */}
                <div className="px-4 mt-3 pt-2 border-t border-neutral-200 dark:border-neutral-700 space-y-1 text-[12px] text-neutral-700 dark:text-neutral-300">
                  <div className="flex justify-between">
                    <span><strong>Total Amount:</strong></span>
                    <span>PKR {(order.subtotal || order.total).toFixed(2)}/-</span>
                  </div>
                  <div className="flex justify-between">
                    <span><strong>Discount:</strong> {discountPercent.toFixed(2)}%</span>
                    <span><strong>Tax:</strong> 0.00%</span>
                  </div>
                  <div className="flex justify-between text-[13px] font-bold text-gray-900 dark:text-white pt-1">
                    <span>Grand Total:</span>
                    <span className="text-primary">PKR {order.total.toFixed(2)}/-</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-auto px-4 pb-3 pt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 mt-2">
                  {order.status === "COMPLETED" ? (
                    <button
                      type="button"
                      onClick={() => printBill(order)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-[11px] font-medium hover:bg-emerald-700 transition-colors"
                    >
                      <Printer className="w-3 h-3" />
                      Print Receipt
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex gap-1">
                    {primaryNext && (
                      <Button
                        type="button"
                        variant="subtle"
                        disabled={isUpdating}
                        onClick={() =>
                          handleUpdateStatus(order._id || order.id, primaryNext)
                        }
                        className="px-3 py-1.5 text-[11px] bg-primary text-white hover:bg-secondary border border-primary"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          NEXT_LABELS[primaryNext] || `Mark ${primaryNext.toLowerCase()}`
                        )}
                      </Button>
                    )}
                    {order.status !== "CANCELLED" &&
                      order.status !== "COMPLETED" && (
                        <Button
                          type="button"
                          variant="subtle"
                          disabled={isUpdating}
                          onClick={() =>
                            handleUpdateStatus(
                              order._id || order.id,
                              "CANCELLED"
                            )
                          }
                          className="px-3 py-1.5 text-[11px] bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                        >
                          {isUpdating ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            "Cancel"
                          )}
                        </Button>
                      )}
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-full flex items-center justify-center py-12">
              <p className="text-sm text-neutral-500">
                No orders match your filters.
              </p>
            </div>
          )}
        </div>
      </Card>
    </AdminLayout>
  );
}
