import { useState, useEffect } from "react";
import {
  getRiderOrders,
  markOrderDeliveredByRider,
  getStoredAuth,
  clearStoredAuth,
  SubscriptionInactiveError,
} from "../../lib/apiClient";
import { useSocket } from "../../contexts/SocketContext";
import {
  Bike, MapPin, Phone, User, Clock, Loader2, CheckCircle2,
  Package, Truck, RefreshCw, LogOut, ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import SEO from "../../components/SEO";

const TABS = { ACTIVE: "active", HISTORY: "history" };

export default function RiderPortalPage() {
  const { socket } = useSocket() || {};
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
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
        toast.error("Subscription inactive");
      } else {
        toast.error(err.message || "Failed to load orders");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrders(); }, []);

  useEffect(() => {
    if (!socket) return;
    const onOrderEvent = () => loadOrders();
    socket.on("order:updated", onOrderEvent);
    return () => { socket.off("order:updated", onOrderEvent); };
  }, [socket]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearStoredAuth();
    window.location.href = "/login";
  }

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
  const historyOrders = orders
    .filter(o => o.status === "DELIVERED" || o.status === "COMPLETED" || o.status === "CANCELLED")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const displayOrders = tab === TABS.ACTIVE ? activeOrders : historyOrders;

  function getShortOrderId(order) {
    const id = order.id || order.orderNumber || order._id || "";
    const full = String(typeof id === "string" && id.startsWith("ORD-") ? id.replace(/^ORD-/, "") : id);
    const lastDash = full.lastIndexOf("-");
    if (lastDash !== -1 && full.length - lastDash <= 6) return full.slice(lastDash + 1);
    return full.length > 8 ? full.slice(-6) : full;
  }

  function getElapsedMinutes(createdAt) {
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  }

  function formatElapsed(minutes) {
    if (minutes < 1) return "<1m";
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  return (
    <>
      <SEO title="Rider Portal - Eats Desk" noindex />
      <div className="h-[100dvh] flex flex-col bg-gray-50 dark:bg-black text-gray-900 dark:text-white overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="flex-shrink-0 bg-white dark:bg-neutral-950">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20">
                <Bike className="w-[18px] h-[18px] text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-[15px] font-extrabold truncate leading-tight tracking-tight">
                  {userName ? `Hi, ${userName.split(" ")[0]}` : "Rider Portal"}
                </h1>
                <p className="text-[11px] text-gray-400 dark:text-neutral-500 truncate leading-tight">
                  {activeOrders.length === 0 ? "No active deliveries" : `${activeOrders.length} active delivery${activeOrders.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => { setLoading(true); loadOrders(); }}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 text-gray-500 dark:text-neutral-400 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={handleLogout}
                className="h-9 pl-3 pr-3.5 rounded-full flex items-center gap-1.5 text-gray-500 dark:text-neutral-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors text-xs font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-t border-gray-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setTab(TABS.ACTIVE)}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                tab === TABS.ACTIVE
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-400 dark:text-neutral-500"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              Active ({activeOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setTab(TABS.HISTORY)}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                tab === TABS.HISTORY
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-400 dark:text-neutral-500"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              History ({historyOrders.length})
            </button>
          </div>
        </header>

        {/* ── Content ────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 py-4">

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                <p className="text-xs text-gray-400 dark:text-neutral-500">Loading...</p>
              </div>
            )}

            {/* Empty */}
            {!loading && displayOrders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-3">
                  {tab === TABS.ACTIVE
                    ? <Package className="w-6 h-6 text-gray-300 dark:text-neutral-700" />
                    : <CheckCircle2 className="w-6 h-6 text-gray-300 dark:text-neutral-700" />
                  }
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">
                  {tab === TABS.ACTIVE ? "No active deliveries" : "No history yet"}
                </p>
              </div>
            )}

            {/* Order Cards */}
            {!loading && displayOrders.length > 0 && (
              <div className="space-y-2">
                {displayOrders.map(order => {
                  const orderId = order.id || order._id;
                  const isExpanded = expandedOrder === orderId;
                  const isDelivering = deliveringId === orderId;
                  const minutes = getElapsedMinutes(order.createdAt);
                  const items = order.items || [];
                  const subtotal = Number(order.subtotal ?? order.total) || 0;
                  const discount = Number(order.discountAmount) || 0;
                  const tax = Number(order.taxAmount ?? order.tax) || 0;
                  const deliveryChargesAmt = Number(order.deliveryCharges) || Math.max(0, (Number(order.grandTotal) || 0) - (Number(order.total) || 0));
                  const collectAmount = Number(order.grandTotal ?? order.total) || 0;
                  const isDone = order.status === "DELIVERED" || order.status === "COMPLETED";
                  const isCancelled = order.status === "CANCELLED";

                  return (
                    <div
                      key={orderId}
                      className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden"
                    >
                      {/* Header — always visible */}
                      <button
                        type="button"
                        onClick={() => setExpandedOrder(isExpanded ? null : orderId)}
                        className="w-full px-3 pt-2.5 pb-2 text-left"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-gray-900 dark:text-white">#{getShortOrderId(order)}</span>
                            {isDone && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400">Done</span>}
                            {isCancelled && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">Cancelled</span>}
                            {!isDone && !isCancelled && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">In Transit</span>}
                            {!isDone && !isCancelled && (
                              <span className={`text-[10px] font-bold tabular-nums ${minutes >= 20 ? "text-red-500" : minutes >= 10 ? "text-primary" : "text-gray-400"}`}>
                                {formatElapsed(minutes)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!isCancelled && <span className="text-sm font-black text-primary tabular-nums">Rs {collectAmount.toLocaleString()}</span>}
                            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                        </div>
                        {order.deliveryAddress && (
                          <div className="flex items-start gap-1 text-[11px] text-gray-500 dark:text-neutral-400">
                            <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5 text-gray-400" />
                            <span className="truncate leading-snug">{order.deliveryAddress}</span>
                          </div>
                        )}
                      </button>

                      {/* Expanded: customer + items + bill */}
                      {isExpanded && (
                        <>
                          {/* Customer details */}
                          <div className="px-3 pb-2 space-y-1 border-t border-gray-100 dark:border-neutral-800 pt-2">
                            {order.customerName && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <span className="font-semibold text-gray-900 dark:text-white">{order.customerName}</span>
                              </div>
                            )}
                            {order.customerPhone && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Phone className="w-3 h-3 text-primary flex-shrink-0" />
                                <a href={`tel:${order.customerPhone}`} className="font-medium text-primary">{order.customerPhone}</a>
                              </div>
                            )}
                            {order.deliveryAddress && (
                              <div className="flex items-start gap-1.5 text-xs">
                                <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
                                <span className="text-gray-600 dark:text-neutral-400 leading-snug">{order.deliveryAddress}</span>
                              </div>
                            )}
                          </div>

                          {/* Items list */}
                          <div className="border-t border-gray-100 dark:border-neutral-800 px-3 py-1.5">
                            {items.map((item, idx) => {
                              const qty = Number(item.qty ?? item.quantity) || 1;
                              const unit = Number(item.unitPrice ?? item.price) || 0;
                              const lineTotal = unit * qty;
                              return (
                                <div key={idx} className="flex items-center justify-between py-0.5 text-[11px]">
                                  <span className="text-gray-700 dark:text-neutral-300">
                                    <span className="font-bold text-gray-900 dark:text-white">{qty}×</span> {item.name}
                                  </span>
                                  {unit > 0 && <span className="text-gray-500 dark:text-neutral-500 tabular-nums font-medium">Rs {lineTotal.toLocaleString()}</span>}
                                </div>
                              );
                            })}
                          </div>

                          {/* Bill summary */}
                          {!isCancelled && (
                            <div className="border-t border-gray-100 dark:border-neutral-800 px-3 py-2 space-y-0.5 text-[11px]">
                              <div className="flex justify-between text-gray-500 dark:text-neutral-400">
                                <span>Subtotal</span>
                                <span className="tabular-nums">Rs {subtotal.toLocaleString()}</span>
                              </div>
                              {discount > 0 && (
                                <div className="flex justify-between text-gray-500 dark:text-neutral-400">
                                  <span>Discount</span>
                                  <span className="tabular-nums">- Rs {discount.toLocaleString()}</span>
                                </div>
                              )}
                              {tax > 0 && (
                                <div className="flex justify-between text-gray-500 dark:text-neutral-400">
                                  <span>Tax</span>
                                  <span className="tabular-nums">Rs {tax.toLocaleString()}</span>
                                </div>
                              )}
                              {deliveryChargesAmt > 0 && (
                                <div className="flex justify-between text-gray-500 dark:text-neutral-400">
                                  <span>Delivery Charges</span>
                                  <span className="tabular-nums">Rs {deliveryChargesAmt.toLocaleString()}</span>
                                </div>
                              )}
                              <div className="flex justify-between pt-1.5 border-t border-dashed border-gray-200 dark:border-neutral-700 text-sm font-black text-primary">
                                <span>Collect</span>
                                <span className="tabular-nums">Rs {collectAmount.toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Action */}
                      {order.status === "OUT_FOR_DELIVERY" && (
                        <div className="px-3 pb-2.5 pt-1">
                          <button
                            type="button"
                            disabled={isDelivering}
                            onClick={() => handleMarkDelivered(orderId)}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-xs disabled:opacity-50 transition-colors active:scale-[0.98]"
                          >
                            {isDelivering ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Marking...</>
                            ) : (
                              <><CheckCircle2 className="w-3.5 h-3.5" /> Mark as Delivered</>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
