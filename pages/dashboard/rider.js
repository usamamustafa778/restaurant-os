import { useState, useEffect, useCallback } from "react";
import {
  getRiderOrders,
  collectOrderByRider,
  markOrderDeliveredByRider,
  getRiderMenu,
  getRiderCustomers,
  createRiderCustomer,
  createPosOrder,
  getStoredAuth,
  clearStoredAuth,
  SubscriptionInactiveError,
} from "../../lib/apiClient";
import { useSocket } from "../../contexts/SocketContext";
import { useBranch } from "../../contexts/BranchContext";
import {
  Bike, MapPin, Phone, User, Clock, Loader2, CheckCircle2,
  Package, Truck, RefreshCw, LogOut, ChevronDown,
  Plus, Minus, Trash2, Search, ChevronLeft, Utensils, Send, X,
} from "lucide-react";
import toast from "react-hot-toast";
import SEO from "../../components/SEO";

const TABS = { ACTIVE: "active", HISTORY: "history", NEW_ORDER: "new_order" };
const STEPS = { MENU: "menu", CART: "cart" };

function isBranchRequiredError(msg) {
  return typeof msg === "string" && msg.toLowerCase().includes("branchid") && msg.toLowerCase().includes("required");
}

export default function RiderPortalPage() {
  const { socket } = useSocket() || {};
  const { currentBranch, branches, setCurrentBranch } = useBranch() || {};
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(TABS.ACTIVE);
  const [deliveringId, setDeliveringId] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [userName, setUserName] = useState("");
  const [showBranchModal, setShowBranchModal] = useState(false);

  // New order (rider-created delivery) state
  const [step, setStep] = useState(STEPS.MENU);
  const [menu, setMenu] = useState({ categories: [], items: [] });
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [menuLoading, setMenuLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  // Customer search (inline, POS-style by phone)
  const [customersList, setCustomersList] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickCustomerAddress, setQuickCustomerAddress] = useState("");
  const [addingQuickCustomer, setAddingQuickCustomer] = useState(false);

  useEffect(() => {
    const auth = getStoredAuth();
    setUserName(auth?.user?.name || auth?.user?.email || "");
  }, []);

  async function loadCustomers() {
    if (customersLoaded) return;
    setCustomersLoading(true);
    setCustomersError("");
    try {
      const list = await getRiderCustomers();
      setCustomersList(Array.isArray(list) ? list : []);
      setCustomersLoaded(true);
    } catch (err) {
      setCustomersError(err.message || "Failed to load customers");
      setCustomersList([]);
    } finally {
      setCustomersLoading(false);
    }
  }

  async function loadMenu() {
    setMenuLoading(true);
    try {
      const data = await getRiderMenu();
      setMenu(data || { categories: [], items: [] });
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) toast.error("Subscription inactive");
      else toast.error(err.message || "Failed to load menu");
    } finally {
      setMenuLoading(false);
    }
  }

  useEffect(() => {
    if (tab === TABS.NEW_ORDER && menu.items.length === 0) loadMenu();
  }, [tab]);

  useEffect(() => {
    if (step === STEPS.CART) loadCustomers();
  }, [step]);

  const filteredItems = menu.items.filter((item) => {
    const matchCat = selectedCategory === "all" || item.categoryId === selectedCategory;
    const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const isAvailable = item.finalAvailable ?? item.available;
    return matchCat && matchSearch && isAvailable;
  });

  const getCartQty = useCallback((itemId) => cart.find((c) => c.id === itemId)?.quantity || 0, [cart]);
  function addToCart(item, qty = 1) {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [...prev, { id: item.id, name: item.name, price: item.finalPrice ?? item.price ?? 0, quantity: qty, imageUrl: item.imageUrl || "" }];
    });
  }
  function updateQty(id, delta) {
    setCart((prev) =>
      prev.map((c) => (c.id === id ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c)).filter((c) => c.quantity > 0)
    );
  }
  function removeFromCart(id) {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }
  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const cartBadge = cart.reduce((sum, i) => sum + i.quantity, 0);

  async function handlePlaceOrder() {
    if (cart.length === 0) return;
    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
      toast.error("Customer name, phone and delivery address are required");
      return;
    }
    setPlacing(true);
    try {
      const result = await createPosOrder({
        items: cart.map((c) => ({ menuItemId: c.id, quantity: c.quantity })),
        orderType: "DELIVERY",
        paymentMethod: "PENDING",
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        branchId: currentBranch?.id ?? undefined,
      });
      setOrderPlaced(result);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryAddress("");
      loadOrders();
      toast.success("Order sent to kitchen!");
    } catch (err) {
      if (isBranchRequiredError(err.message) && branches?.length > 0) {
        setShowBranchModal(true);
      } else {
        toast.error(err.message || "Failed to place order");
      }
    } finally {
      setPlacing(false);
    }
  }

  function selectCustomerForOrder(c) {
    setCustomerName(c.name || "");
    setCustomerPhone(c.phone || "");
    setDeliveryAddress(c.address || "");
    setCustomerSearch("");
  }

  async function handleQuickAddCustomer() {
    const phone = customerSearch.trim();
    const name = quickCustomerName.trim();
    const address = quickCustomerAddress.trim();
    if (!phone || !name) {
      setCustomersError("Enter customer name and phone to add");
      return;
    }
    if (!address) {
      setCustomersError("Address is required for delivery orders");
      return;
    }
    setAddingQuickCustomer(true);
    setCustomersError("");
    try {
      const created = await createRiderCustomer({ name, phone, address: address || undefined });
      setCustomersList((prev) => [created, ...prev]);
      selectCustomerForOrder(created);
      toast.success("Customer added");
    } catch (err) {
      setCustomersError(err.message || "Failed to add customer");
    } finally {
      setAddingQuickCustomer(false);
    }
  }

  function handleNewOrder() {
    setOrderPlaced(null);
    setStep(STEPS.MENU);
    setSearchQuery("");
    setSelectedCategory("all");
  }

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
    socket.on("order:created", onOrderEvent);
    return () => {
      socket.off("order:updated", onOrderEvent);
      socket.off("order:created", onOrderEvent);
    };
  }, [socket]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearStoredAuth();
    window.location.href = "/login";
  }

  const [collectingId, setCollectingId] = useState(null);

  async function handleCollectOrder(orderId) {
    setCollectingId(orderId);
    const toastId = toast.loading("Collecting order...");
    try {
      const updated = await collectOrderByRider(orderId);
      setOrders(prev => prev.map(o => (o.id === orderId || o._id === orderId ? { ...o, ...updated } : o)));
      toast.success("Order collected! Out for delivery.", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to collect order", { id: toastId });
    } finally {
      setCollectingId(null);
    }
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

  const activeOrders = orders.filter(o =>
    o.status === "NEW_ORDER" || o.status === "PREPARING" || o.status === "READY" || o.status === "OUT_FOR_DELIVERY"
  );
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
              onClick={() => setTab(TABS.NEW_ORDER)}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                tab === TABS.NEW_ORDER
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-400 dark:text-neutral-500"
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              New Order
            </button>
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

            {/* ════════════════ NEW ORDER TAB ════════════════ */}
            {tab === TABS.NEW_ORDER && (
              <>
                {orderPlaced ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">Order sent!</p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4">Kitchen will prepare it. You can assign yourself when ready.</p>
                    <button
                      type="button"
                      onClick={handleNewOrder}
                      className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold active:scale-95"
                    >
                      New delivery order
                    </button>
                  </div>
                ) : step === STEPS.MENU ? (
                  <div className="flex flex-col h-full">
                    <div className="sticky top-0 z-10 bg-gray-50 dark:bg-black">
                      <div className="pt-2 pb-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search items..."
                            className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 text-sm placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          {searchQuery && (
                            <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 dark:bg-neutral-800 flex items-center justify-center">
                              <X className="w-3 h-3 text-gray-500" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        <button type="button" onClick={() => setSelectedCategory("all")} className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold ${selectedCategory === "all" ? "bg-primary text-white" : "bg-white dark:bg-neutral-900 text-gray-500 border border-gray-200 dark:border-neutral-800"}`}>All</button>
                        {menu.categories.map((cat) => (
                          <button key={cat.id || cat._id} type="button" onClick={() => setSelectedCategory(cat.id || cat._id)} className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold ${selectedCategory === (cat.id || cat._id) ? "bg-primary text-white" : "bg-white dark:bg-neutral-900 text-gray-500 border border-gray-200 dark:border-neutral-800"}`}>{cat.name}</button>
                        ))}
                      </div>
                    </div>
                    {menuLoading ? (
                      <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                        <p className="text-xs text-gray-400">Loading menu...</p>
                      </div>
                    ) : filteredItems.length === 0 ? (
                      <div className="py-16 text-center text-sm text-gray-500">No items found</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5 pt-2 pb-24">
                        {filteredItems.map((item) => {
                          const qty = getCartQty(item.id);
                          const price = item.finalPrice ?? item.price ?? 0;
                          return (
                            <div key={item.id || item._id} className="relative bg-white dark:bg-neutral-950 rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800">
                              <button type="button" onClick={() => addToCart(item)} className="w-full text-left">
                                {item.imageUrl ? (
                                  <div className="w-full aspect-[4/3] bg-gray-100 dark:bg-neutral-900"><img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" /></div>
                                ) : (
                                  <div className="w-full aspect-[4/3] bg-gray-100 dark:bg-neutral-900 flex items-center justify-center"><Utensils className="w-8 h-8 text-gray-300" /></div>
                                )}
                                <div className="px-2.5 pt-1.5 pb-2">
                                  <p className="text-[13px] font-bold line-clamp-2">{item.name}</p>
                                  <p className="text-xs font-extrabold text-primary">Rs. {price.toLocaleString()}</p>
                                </div>
                              </button>
                              {qty > 0 && (
                                <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-white/95 dark:bg-neutral-900/95 rounded-xl shadow border border-gray-200/50 px-1 py-0.5">
                                  <button type="button" onClick={(e) => { e.stopPropagation(); updateQty(item.id, -1); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100"><Minus className="w-3.5 h-3.5" /></button>
                                  <span className="w-5 text-center text-xs font-black text-primary">{qty}</span>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); addToCart(item); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10"><Plus className="w-3.5 h-3.5" /></button>
                                </div>
                              )}
                              {qty === 0 && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); addToCart(item); }} className="absolute top-2 right-2 w-8 h-8 rounded-xl bg-white/90 dark:bg-neutral-900/90 shadow border border-gray-200/50 flex items-center justify-center">
                                  <Plus className="w-4 h-4 text-primary" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {cartBadge > 0 && (
                      <div className="fixed bottom-0 inset-x-0 z-20 p-4 bg-gray-50 dark:bg-black border-t border-gray-200 dark:border-neutral-800">
                        <button type="button" onClick={() => setStep(STEPS.CART)} className="w-full flex items-center justify-between py-3.5 px-5 rounded-2xl bg-primary text-white font-bold text-sm">
                          <span className="flex items-center gap-2"><span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-[11px] font-black">{cartBadge}</span>View order</span>
                          <span className="font-extrabold">Rs. {subtotal.toLocaleString()}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pb-32">
                    <button type="button" onClick={() => setStep(STEPS.MENU)} className="flex items-center gap-1.5 py-2 text-gray-500 dark:text-neutral-400 text-sm font-semibold">
                      <ChevronLeft className="w-4 h-4" /> Back to menu
                    </button>
                    {cart.length === 0 ? (
                      <div className="py-12 text-center">
                        <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">Cart is empty</p>
                        <button type="button" onClick={() => setStep(STEPS.MENU)} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold">Browse menu</button>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2.5 mt-2">
                          {cart.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 bg-white dark:bg-neutral-950 rounded-xl p-3 border border-gray-200 dark:border-neutral-800">
                              {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" /> : <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center flex-shrink-0"><Utensils className="w-5 h-5 text-gray-400" /></div>}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{item.name}</p>
                                <p className="text-xs font-bold text-primary">Rs. {(item.price * item.quantity).toLocaleString()}</p>
                              </div>
                              <div className="flex items-center gap-0 bg-gray-100 dark:bg-neutral-900 rounded-xl">
                                <button type="button" onClick={() => updateQty(item.id, -1)} className="w-9 h-9 rounded-xl flex items-center justify-center">{item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-400" /> : <Minus className="w-3.5 h-3.5 text-gray-500" />}</button>
                                <span className="w-7 text-center text-sm font-black">{item.quantity}</span>
                                <button type="button" onClick={() => updateQty(item.id, 1)} className="w-9 h-9 rounded-xl flex items-center justify-center"><Plus className="w-3.5 h-3.5 text-primary" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-6 space-y-3">
                          <p className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase">Delivery details</p>

                          {customersError && (
                            <p className="text-sm text-red-600 dark:text-red-400">{customersError}</p>
                          )}

                          {/* Selected customer summary */}
                          {customerPhone && !customerSearch && (
                            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{customerName}</p>
                                <p className="text-xs text-gray-500 dark:text-neutral-400">{customerPhone}{deliveryAddress ? ` · ${deliveryAddress}` : ""}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => { setCustomerName(""); setCustomerPhone(""); setDeliveryAddress(""); }}
                                className="text-xs font-bold text-primary ml-2 flex-shrink-0"
                              >
                                Change
                              </button>
                            </div>
                          )}

                          {/* Phone search + results (shown when no customer selected) */}
                          {(!customerPhone || customerSearch) && (
                            <>
                              <input
                                type="text"
                                placeholder="Search customer by phone..."
                                value={customerSearch}
                                onChange={(e) => { setCustomerSearch(e.target.value); setCustomersError(""); }}
                                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                              />

                              {customersLoading ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                </div>
                              ) : (
                                (() => {
                                  const term = customerSearch.trim();
                                  const filtered = customersList.filter((c) =>
                                    !term ? true : (c.phone || "").includes(term)
                                  );

                                  if (filtered.length > 0) {
                                    return (
                                      <ul className="space-y-1 max-h-48 overflow-y-auto">
                                        {filtered.map((c) => (
                                          <li key={c.id}>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (!c.address?.trim()) {
                                                  selectCustomerForOrder(c);
                                                  toast("No address on file — please enter one below", { icon: "📍" });
                                                  return;
                                                }
                                                selectCustomerForOrder(c);
                                              }}
                                              className="w-full flex items-center px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800/50 text-left text-sm transition-colors"
                                            >
                                              <div className="flex-1 min-w-0">
                                                <div>
                                                  <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                                                  {c.phone && <span className="text-gray-500 dark:text-neutral-400 ml-2">{c.phone}</span>}
                                                </div>
                                                {c.address && <p className="text-xs text-gray-400 dark:text-neutral-500 truncate mt-0.5">{c.address}</p>}
                                              </div>
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    );
                                  }

                                  if (!term) {
                                    return customersList.length === 0 ? (
                                      <p className="text-xs text-gray-400 py-2">No customers yet. Type a phone number to add.</p>
                                    ) : (
                                      <p className="text-xs text-gray-400 py-2">Type a phone number to search.</p>
                                    );
                                  }

                                  return (
                                    <div className="space-y-2.5 bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800 p-3">
                                      <p className="text-xs text-gray-500 dark:text-neutral-400">No customer found. Add new:</p>
                                      <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900 text-sm text-gray-900 dark:text-white font-medium">{term}</div>
                                      <input type="text" value={quickCustomerName} onChange={(e) => setQuickCustomerName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white" placeholder="Customer name *" />
                                      <input type="text" value={quickCustomerAddress} onChange={(e) => setQuickCustomerAddress(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white" placeholder="Delivery address *" />
                                      <button type="button" onClick={handleQuickAddCustomer} disabled={addingQuickCustomer} className="w-full px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">
                                        {addingQuickCustomer ? "Adding…" : "Add & Select Customer"}
                                      </button>
                                    </div>
                                  );
                                })()
                              )}
                            </>
                          )}

                          {/* Manual override fields (shown when customer selected but needs edits) */}
                          {customerPhone && !customerSearch && (
                            <div className="space-y-2.5">
                              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Customer phone" className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                              <textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Delivery address" rows={2} className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                            </div>
                          )}
                        </div>
                        <div className="fixed bottom-0 inset-x-0 z-20 p-4 bg-gray-50 dark:bg-black border-t border-gray-200 dark:border-neutral-800">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Total</p>
                            <p className="text-xl font-black text-gray-900 dark:text-white">Rs. {subtotal.toLocaleString()}</p>
                          </div>
                          <button type="button" onClick={handlePlaceOrder} disabled={placing} className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                            {placing ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send delivery order</>}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Loading */}
            {tab !== TABS.NEW_ORDER && loading && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                <p className="text-xs text-gray-400 dark:text-neutral-500">Loading...</p>
              </div>
            )}

            {/* Empty */}
            {tab !== TABS.NEW_ORDER && !loading && displayOrders.length === 0 && (
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
            {tab !== TABS.NEW_ORDER && !loading && displayOrders.length > 0 && (
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
                            {order.status === "NEW_ORDER" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">New</span>}
                            {order.status === "PREPARING" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">Preparing</span>}
                            {order.status === "READY" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Ready</span>}
                            {order.status === "OUT_FOR_DELIVERY" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">In Transit</span>}
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
                      {order.status === "READY" && (
                        <div className="px-3 pb-2.5 pt-1">
                          <button
                            type="button"
                            disabled={collectingId === orderId}
                            onClick={() => handleCollectOrder(orderId)}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50 transition-colors active:scale-[0.98]"
                          >
                            {collectingId === orderId ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Collecting...</>
                            ) : (
                              <><Package className="w-3.5 h-3.5" /> Collect Order</>
                            )}
                          </button>
                        </div>
                      )}
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

      {showBranchModal && branches?.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">Select Branch</h2>
                  <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-0.5">Choose a branch to place delivery orders</p>
                </div>
              </div>
            </div>
            <div className="p-3 max-h-[320px] overflow-y-auto space-y-1.5">
              {branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => { setCurrentBranch(b); setShowBranchModal(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all border-2 border-transparent hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 active:scale-[0.98]"
                >
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{b.name}</p>
                    {b.address && <p className="text-[11px] text-gray-400 dark:text-neutral-500 truncate">{b.address}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
