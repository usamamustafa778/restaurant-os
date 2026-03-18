import { useState, useEffect, useRef, useCallback } from "react";
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
  LogOut,
  ChevronLeft,
  Plus,
  Minus,
  Trash2,
  Search,
  Utensils,
  Send,
  X,
  ShoppingCart,
  ClipboardList,
  History,
  PackageCheck,
  ChefHat,
  Check,
  Bell,
} from "lucide-react";
import toast from "react-hot-toast";
import SEO from "../../components/SEO";

const TABS = { NEW_ORDER: "new_order", ACTIVE: "active", HISTORY: "history" };
const STEPS = { MENU: "menu", CART: "cart" };

function isBranchRequiredError(msg) {
  return typeof msg === "string" && msg.toLowerCase().includes("branchid") && msg.toLowerCase().includes("required");
}

function getStatusConfig(status) {
  switch (status) {
    case "READY":
      return { label: "Ready to Collect", bg: "bg-emerald-500", bgLight: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-500/20", icon: PackageCheck, pulse: true };
    case "PROCESSING":
    case "PREPARING":
      return { label: "Processing", bg: "bg-amber-500", bgLight: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-500/20", icon: ChefHat, pulse: false };
    case "NEW_ORDER":
      return { label: "In Kitchen", bg: "bg-blue-500", bgLight: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-200 dark:border-blue-500/20", icon: Send, pulse: false };
    case "OUT_FOR_DELIVERY":
      return { label: "Out for Delivery", bg: "bg-violet-500", bgLight: "bg-violet-50 dark:bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", border: "border-violet-200 dark:border-violet-500/20", icon: Truck, pulse: false };
    case "DELIVERED":
    case "COMPLETED":
      return { label: "Delivered", bg: "bg-gray-400", bgLight: "bg-gray-50 dark:bg-neutral-900/50", text: "text-gray-500 dark:text-neutral-400", border: "border-gray-200 dark:border-neutral-800", icon: Check, pulse: false };
    case "CANCELLED":
      return { label: "Cancelled", bg: "bg-red-400", bgLight: "bg-red-50 dark:bg-red-500/10", text: "text-red-500 dark:text-red-400", border: "border-red-200 dark:border-red-500/20", icon: X, pulse: false };
    default:
      return { label: status, bg: "bg-gray-500", bgLight: "bg-gray-50 dark:bg-neutral-900", text: "text-gray-600 dark:text-neutral-400", border: "border-gray-200 dark:border-neutral-800", icon: Clock, pulse: false };
  }
}

function getTimeAgo(createdAt) {
  const diff = Date.now() - new Date(createdAt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function RiderPortalPage() {
  const { socket } = useSocket() || {};
  const { currentBranch, branches, setCurrentBranch } = useBranch() || {};
  const searchRef = useRef(null);

  // Auth
  const [userName, setUserName] = useState("");
  const [riderId, setRiderId] = useState(null);

  // Orders
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [tab, setTab] = useState(TABS.ACTIVE);
  const [collectingId, setCollectingId] = useState(null);
  const [deliveringId, setDeliveringId] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");

  // New order
  const [step, setStep] = useState(STEPS.MENU);
  const [menu, setMenu] = useState({ categories: [], items: [] });
  const [menuLoading, setMenuLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [placing, setPlacing] = useState(false);

  // Customer
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [customersList, setCustomersList] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickCustomerAddress, setQuickCustomerAddress] = useState("");
  const [addingQuickCustomer, setAddingQuickCustomer] = useState(false);

  // UI
  const [showBranchModal, setShowBranchModal] = useState(false);

  // ── Init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const auth = getStoredAuth();
    setUserName(auth?.user?.name || auth?.user?.email || "");
    setRiderId(auth?.user?.id || auth?.user?._id || null);
  }, []);

  async function loadOrders() {
    try {
      const data = await getRiderOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) toast.error("Subscription inactive");
      else toast.error(err.message || "Failed to load orders");
    } finally {
      setOrdersLoading(false);
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
    } finally {
      setCustomersLoading(false);
    }
  }

  useEffect(() => {
    if (step === STEPS.CART) loadCustomers();
  }, [step]);

  // ── Derived data ──────────────────────────────────────────────────────
  const activeOrders = orders.filter((o) => {
    return (
      o.status === "NEW_ORDER" ||
      o.status === "PROCESSING" ||
      o.status === "PREPARING" ||
      o.status === "READY" ||
      o.status === "OUT_FOR_DELIVERY"
    );
  });
  const historyOrders = orders
    .filter((o) => o.status === "DELIVERED" || o.status === "COMPLETED" || o.status === "CANCELLED")
    // History must belong to the delivery handler:
    // - If an order has an assigned rider, only that rider should see it in History.
    // - If no rider was assigned, the creator (who is also the only one who would see it via the API) should see it.
    .filter((o) => !o.assignedRiderId || (riderId && o.assignedRiderId === riderId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const historyRevenue = historyOrders
    .filter((o) => o.status === "DELIVERED" || o.status === "COMPLETED")
    .reduce((sum, o) => sum + (Number(o.grandTotal ?? o.total) || 0), 0);

  const readyOrders = activeOrders.filter((o) => o.status === "READY");
  const newOrders = activeOrders.filter((o) => o.status === "NEW_ORDER");
  const preparingOrders = activeOrders.filter((o) => o.status === "PROCESSING" || o.status === "PREPARING");
  const outForDeliveryOrders = activeOrders.filter((o) => o.status === "OUT_FOR_DELIVERY");

  const filteredActiveOrders =
    activeFilter === "all"
      ? activeOrders
      : activeFilter === "new"
        ? newOrders
        : activeFilter === "preparing"
          ? preparingOrders
          : activeFilter === "ready"
            ? readyOrders
            : outForDeliveryOrders;

  const activeFilterLabel = activeFilter === "all"
    ? "active"
    : activeFilter === "new"
      ? "new"
      : activeFilter === "preparing"
        ? "preparing"
        : activeFilter === "ready"
          ? "ready"
          : "out for delivery";

  const filteredItems = menu.items.filter((item) => {
    const matchCat = selectedCategory === "all" || item.categoryId === selectedCategory;
    const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const isAvailable = item.finalAvailable ?? item.available;
    return matchCat && matchSearch && isAvailable;
  });

  const getCartQty = useCallback((itemId) => cart.find((c) => c.id === itemId)?.quantity || 0, [cart]);
  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const cartBadge = cart.reduce((sum, i) => sum + i.quantity, 0);

  // ── Cart helpers ──────────────────────────────────────────────────────
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

  // ── Actions ───────────────────────────────────────────────────────────
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearStoredAuth();
    window.location.href = "/login";
  }

  async function handlePlaceOrder() {
    if (cart.length === 0) return;
    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
      toast.error("Customer name, phone and delivery address are required");
      return;
    }
    setPlacing(true);
    try {
      await createPosOrder({
        items: cart.map((c) => ({ menuItemId: c.id, quantity: c.quantity })),
        orderType: "DELIVERY",
        paymentMethod: "PENDING",
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        branchId: currentBranch?.id ?? undefined,
      });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryAddress("");
      setCustomerSearch("");
      setStep(STEPS.MENU);
      setTab(TABS.ACTIVE);
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

  async function handleCollectOrder(orderId) {
    setCollectingId(orderId);
    const toastId = toast.loading("Collecting order...");
    try {
      const updated = await collectOrderByRider(orderId);
      setOrders((prev) => prev.map((o) => (o.id === orderId || o._id === orderId ? { ...o, ...updated } : o)));
      toast.success("Out for delivery!", { id: toastId });
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
      setOrders((prev) => prev.map((o) => (o.id === orderId || o._id === orderId ? { ...o, ...updated } : o)));
      toast.success("Order delivered!", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to mark delivered", { id: toastId });
    } finally {
      setDeliveringId(null);
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
    if (!phone || !name) { setCustomersError("Enter customer name and phone to add"); return; }
    if (!address) { setCustomersError("Address is required for delivery orders"); return; }
    setAddingQuickCustomer(true);
    setCustomersError("");
    try {
      const created = await createRiderCustomer({ name, phone, address });
      setCustomersList((prev) => [created, ...prev]);
      selectCustomerForOrder(created);
      toast.success("Customer added");
    } catch (err) {
      setCustomersError(err.message || "Failed to add customer");
    } finally {
      setAddingQuickCustomer(false);
    }
  }

  function getOrderId(order) {
    const id = order.id || order.orderNumber || order._id || "";
    if (typeof id === "string" && id.startsWith("ORD-")) return id.replace(/^ORD-/, "");
    return id;
  }

  // ── Loading screen ────────────────────────────────────────────────────
  if (ordersLoading) {
    return (
      <>
        <SEO title="Rider Portal - Eats Desk" noindex />
        <div className="h-[100dvh] flex flex-col items-center justify-center bg-white dark:bg-black gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
            <Bike className="w-7 h-7 text-white animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Loading your deliveries</p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Getting your orders ready...</p>
          </div>
          <div className="w-32 h-1 rounded-full bg-gray-200 dark:bg-neutral-800 overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-primary animate-[shimmer_1.2s_ease-in-out_infinite]" />
          </div>
        </div>
        <style jsx global>{`
          @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
        `}</style>
      </>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────
  return (
    <>
      <SEO title="Rider Portal - Eats Desk" noindex />
      <div className="h-[100dvh] flex flex-col bg-gray-50 dark:bg-black text-gray-900 dark:text-white overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="flex-shrink-0 bg-white dark:bg-neutral-950 rider-safe-top">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3 min-w-0">
              {tab === TABS.NEW_ORDER && step === STEPS.CART ? (
                <button
                  onClick={() => setStep(STEPS.MENU)}
                  className="w-9 h-9 -ml-1.5 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-900 active:scale-90 transition-all"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-neutral-300" />
                </button>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20">
                  <Bike className="w-[18px] h-[18px] text-white" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-[15px] font-extrabold truncate leading-tight tracking-tight">
                  {tab === TABS.ACTIVE
                    ? "Active Deliveries"
                    : tab === TABS.HISTORY
                      ? "Delivery History"
                      : step === STEPS.MENU
                        ? "New Order"
                        : "Review Order"}
                </h1>
                <p className="text-[11px] text-gray-400 dark:text-neutral-500 truncate leading-tight">
                  {tab === TABS.ACTIVE
                    ? activeFilter === "all"
                      ? `${readyOrders.length} ready · ${activeOrders.length} active`
                      : `${filteredActiveOrders.length} ${activeFilterLabel} · ${activeOrders.length} active`
                    : tab === TABS.HISTORY
                      ? `${historyOrders.length} past delivery${historyOrders.length !== 1 ? "s" : ""}`
                      : step === STEPS.MENU
                        ? userName ? `Hi, ${userName.split(" ")[0]}` : "Rider Portal"
                        : `${cartBadge} item${cartBadge !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {tab === TABS.NEW_ORDER && step === STEPS.MENU && cartBadge > 0 && (
                <button
                  onClick={() => setStep(STEPS.CART)}
                  className="relative h-9 pl-3 pr-3.5 rounded-full bg-primary text-white flex items-center gap-1.5 active:scale-95 transition-transform shadow-md shadow-primary/20"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span className="text-xs font-extrabold">{cartBadge}</span>
                </button>
              )}
              {tab === TABS.NEW_ORDER && step === STEPS.MENU && cartBadge === 0 && (
                <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-gray-400 dark:text-neutral-600" />
                </div>
              )}
              {tab === TABS.NEW_ORDER && step === STEPS.CART && cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="h-9 px-3 rounded-full flex items-center gap-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-xs font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
              {(tab === TABS.ACTIVE || tab === TABS.HISTORY) && (
                <button
                  onClick={() => { setOrdersLoading(true); loadOrders(); }}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
                </button>
              )}
              {tab !== TABS.NEW_ORDER && (
                <button
                  onClick={handleLogout}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Step indicator for new order */}
          {tab === TABS.NEW_ORDER && (
            <div className="flex gap-1 px-4 pb-2.5">
              {[STEPS.MENU, STEPS.CART].map((s, i) => (
                <div
                  key={s}
                  className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${
                    i <= [STEPS.MENU, STEPS.CART].indexOf(step) ? "bg-primary" : "bg-gray-200 dark:bg-neutral-800"
                  }`}
                />
              ))}
            </div>
          )}
        </header>

        {/* ── Content ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* ══════ ACTIVE TAB ══════ */}
          {tab === TABS.ACTIVE && (
            <div className="p-4 pb-24">
              {/* Filter pills */}
              <div className="flex gap-2 mb-4 overflow-x-auto rider-no-scrollbar">
                {[
                  { key: "all", label: "All", count: activeOrders.length },
                  { key: "new", label: "New", count: newOrders.length },
                  { key: "preparing", label: "Preparing", count: preparingOrders.length },
                  { key: "ready", label: "Ready", count: readyOrders.length },
                  { key: "out", label: "Out", count: outForDeliveryOrders.length },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setActiveFilter(f.key)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      activeFilter === f.key
                        ? "bg-primary text-white shadow-sm shadow-primary/20"
                        : "bg-white dark:bg-neutral-950 text-gray-500 dark:text-neutral-400 shadow-sm"
                    }`}
                  >
                    {f.label}
                    <span
                      className={`min-w-[18px] h-[18px] rounded-full text-[10px] font-black flex items-center justify-center px-1 ${
                        activeFilter === f.key
                          ? "bg-white/20"
                          : "bg-gray-100 dark:bg-neutral-800"
                      }`}
                    >
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>

              {activeOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center pt-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                    <Package className="w-7 h-7 text-gray-300 dark:text-neutral-700" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 dark:text-neutral-400 mb-1">No active deliveries</p>
                  <p className="text-xs text-gray-400 dark:text-neutral-600">Create a new order or wait for assignments</p>
                </div>
              ) : filteredActiveOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center pt-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                    <ClipboardList className="w-7 h-7 text-gray-300 dark:text-neutral-700" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 dark:text-neutral-400 mb-1">No orders in this filter</p>
                  <p className="text-xs text-gray-400 dark:text-neutral-600">Try another status</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredActiveOrders.map((order) => {
                    // Backend may still keep some "preparing" deliveries as NEW_ORDER.
                    // In the UI we want them to look like order-taker "Processing" cards
                    // when the user selects the Preparing filter.
                    const effectiveStatus =
                      activeFilter === "preparing" && order.status === "NEW_ORDER" ? "PROCESSING" : order.status;
                    const sc = getStatusConfig(effectiveStatus);
                    const StatusIcon = sc.icon;
                    const orderId = order.id || order._id;
                    return (
                      <div key={orderId} className={`bg-white dark:bg-neutral-950 rounded-2xl overflow-hidden shadow-sm border ${sc.border} ${sc.pulse ? "rider-pulse-border" : ""}`}>
                        <div className={`px-4 py-2 flex items-center justify-between ${sc.bg}`}>
                          <div className="flex items-center gap-2">
                            <StatusIcon className="w-4 h-4 text-white" />
                            <span className="text-xs font-bold text-white">{sc.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-white/70">
                            <Clock className="w-3 h-3" />
                            {getTimeAgo(order.createdAt)}
                          </div>
                        </div>

                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-base font-black text-gray-900 dark:text-white">
                              #{order.tokenNumber || getOrderId(order).toString().slice(-4)}
                            </span>
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              Delivery
                            </span>
                          </div>

                          {order.customerName && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400 mb-1">
                              <User className="w-3 h-3" />
                              {order.customerName}
                            </div>
                          )}
                          {(order.customerPhone || order.phone) && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400 mb-1">
                              <Phone className="w-3 h-3" />
                              {order.customerPhone || order.phone}
                            </div>
                          )}
                          {order.deliveryAddress && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400 mb-3">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="line-clamp-2">{order.deliveryAddress}</span>
                            </div>
                          )}

                          <div className="space-y-1 mb-3">
                            {order.items?.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <span className="text-gray-700 dark:text-neutral-300 font-medium">
                                  <span className="font-bold text-gray-900 dark:text-white">{item.quantity || item.qty}x</span>{" "}
                                  {item.name}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-neutral-900 mb-3">
                            <span className="text-xs text-gray-400 dark:text-neutral-500">Total</span>
                            <span className="text-sm font-black text-gray-900 dark:text-white">
                              Rs. {(order.grandTotal ?? order.total)?.toLocaleString()}
                            </span>
                          </div>

                          {order.status === "READY" && (!order.assignedRiderId || (riderId && order.assignedRiderId === riderId)) && (
                            <button
                              onClick={() => handleCollectOrder(orderId)}
                              disabled={collectingId === orderId}
                              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm shadow-emerald-600/20 active:scale-[0.98] transition-transform"
                            >
                              {collectingId === orderId ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                              Collect from Kitchen
                            </button>
                          )}
                          {order.status === "OUT_FOR_DELIVERY" && order.assignedRiderId && riderId && order.assignedRiderId === riderId && (
                            <button
                              onClick={() => handleMarkDelivered(orderId)}
                              disabled={deliveringId === orderId}
                              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm shadow-violet-600/20 active:scale-[0.98] transition-transform"
                            >
                              {deliveringId === orderId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              Mark as Delivered
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════ HISTORY TAB ══════ */}
          {tab === TABS.HISTORY && (
            <div className="p-4 pb-24">
              {historyOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center pt-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                    <History className="w-7 h-7 text-gray-300 dark:text-neutral-700" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 dark:text-neutral-400 mb-1">No delivery history</p>
                  <p className="text-xs text-gray-400 dark:text-neutral-600">Completed orders will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-gray-200 dark:border-neutral-800 p-4">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Total Revenue (this session)</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                      Rs. {Math.round(historyRevenue).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-neutral-500 mt-1">
                      From delivered orders (cancelled excluded)
                    </p>
                  </div>
                  {historyOrders.map((order) => {
                    const sc = getStatusConfig(order.status);
                    const StatusIcon = sc.icon;
                    const orderId = order.id || order._id;
                    return (
                      <div key={orderId} className={`bg-white dark:bg-neutral-950 rounded-2xl overflow-hidden shadow-sm border ${sc.border}`}>
                        <div className={`px-4 py-2 flex items-center justify-between ${sc.bg}`}>
                          <div className="flex items-center gap-2">
                            <StatusIcon className="w-4 h-4 text-white" />
                            <span className="text-xs font-bold text-white">{sc.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-white/70">
                            <Clock className="w-3 h-3" />
                            {getTimeAgo(order.createdAt)}
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-base font-black text-gray-900 dark:text-white">
                              #{order.tokenNumber || getOrderId(order).toString().slice(-4)}
                            </span>
                            <span className="text-sm font-black text-gray-900 dark:text-white">
                              Rs. {(order.grandTotal ?? order.total)?.toLocaleString()}
                            </span>
                          </div>
                          {order.customerName && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400">
                              <User className="w-3 h-3" />
                              {order.customerName}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════ NEW ORDER TAB ══════ */}
          {tab === TABS.NEW_ORDER && (
            <>
              {/* MENU STEP */}
              {step === STEPS.MENU && (
                <div className="flex flex-col h-full">
                  <div className="sticky top-0 z-10 bg-white dark:bg-neutral-950 shadow-sm">
                    <div className="px-4 pt-3 pb-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          ref={searchRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search menu items..."
                          className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-900 text-sm font-medium placeholder:text-gray-400 dark:placeholder:text-neutral-600 outline-none focus:ring-2 focus:ring-primary/20 transition-all border-0"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 dark:bg-neutral-800 flex items-center justify-center"
                          >
                            <X className="w-3 h-3 text-gray-500" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="px-4 pb-2.5 flex gap-2 overflow-x-auto rider-no-scrollbar">
                      <CategoryPill active={selectedCategory === "all"} onClick={() => setSelectedCategory("all")} label="All" />
                      {menu.categories.map((cat) => (
                        <CategoryPill
                          key={cat.id || cat._id}
                          active={selectedCategory === (cat.id || cat._id)}
                          onClick={() => setSelectedCategory(cat.id || cat._id)}
                          label={cat.name}
                        />
                      ))}
                    </div>
                  </div>

                  {menuLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                      <p className="text-xs text-gray-400">Loading menu...</p>
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-20 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-3">
                        <Search className="w-6 h-6 text-gray-300 dark:text-neutral-700" />
                      </div>
                      <p className="text-sm font-bold text-gray-500 dark:text-neutral-400">No items found</p>
                      <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">Try a different search or category</p>
                    </div>
                  ) : (
                    <div className="flex-1 px-3 pt-2 pb-28 overflow-y-auto">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {filteredItems.map((item) => {
                          const qty = getCartQty(item.id);
                          const price = item.finalPrice ?? item.price ?? 0;
                          return (
                            <div key={item.id || item._id} className="relative bg-white dark:bg-neutral-950 rounded-2xl overflow-hidden shadow-sm active:scale-[0.97] transition-transform">
                              <button onClick={() => addToCart(item)} className="w-full text-left">
                                {item.imageUrl ? (
                                  <div className="w-full aspect-[4/3] bg-gray-100 dark:bg-neutral-900 overflow-hidden">
                                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                                  </div>
                                ) : (
                                  <div className="w-full aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-950 flex items-center justify-center">
                                    <Utensils className="w-8 h-8 text-gray-200 dark:text-neutral-800" />
                                  </div>
                                )}
                                <div className="px-2.5 pt-1.5 pb-2">
                                  <p className="text-[13px] font-bold leading-snug line-clamp-2 pb-0.5">{item.name}</p>
                                  <p className="text-xs font-extrabold text-primary">Rs. {price.toLocaleString()}</p>
                                </div>
                              </button>

                              {qty > 0 && (
                                <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 dark:border-neutral-700/50 px-1 py-0.5">
                                  <button onClick={(e) => { e.stopPropagation(); updateQty(item.id, -1); }} className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800">
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="w-5 text-center text-xs font-black text-primary">{qty}</span>
                                  <button onClick={(e) => { e.stopPropagation(); addToCart(item); }} className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform text-primary hover:bg-primary/10">
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                              {qty === 0 && (
                                <button onClick={(e) => { e.stopPropagation(); addToCart(item); }} className="absolute top-2 right-2 w-8 h-8 rounded-xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm shadow-md flex items-center justify-center active:scale-90 transition-transform border border-gray-200/50 dark:border-neutral-700/50">
                                  <Plus className="w-4 h-4 text-primary" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CART STEP */}
              {step === STEPS.CART && (
                <div className="p-4 pb-44">
                  {/* Cart items */}
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-16 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                        <ShoppingCart className="w-7 h-7 text-gray-300 dark:text-neutral-700" />
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">Nothing here yet</p>
                      <p className="text-xs text-gray-400 dark:text-neutral-500 mb-5">Add items from the menu</p>
                      <button onClick={() => setStep(STEPS.MENU)} className="px-6 py-3 rounded-2xl bg-primary text-white text-sm font-bold active:scale-95 transition-transform shadow-lg shadow-primary/20">Browse Menu</button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2.5 mb-5">
                        {cart.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 bg-white dark:bg-neutral-950 rounded-2xl p-3 shadow-sm">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center flex-shrink-0">
                                <Utensils className="w-5 h-5 text-gray-300 dark:text-neutral-700" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate leading-tight">{item.name}</p>
                              <p className="text-xs font-bold text-primary mt-0.5">Rs. {(item.price * item.quantity).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-0 bg-gray-100 dark:bg-neutral-900 rounded-xl">
                              <button onClick={() => updateQty(item.id, -1)} className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-transform">
                                {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-400" /> : <Minus className="w-3.5 h-3.5 text-gray-500" />}
                              </button>
                              <span className="w-7 text-center text-sm font-black">{item.quantity}</span>
                              <button onClick={() => updateQty(item.id, 1)} className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-transform">
                                <Plus className="w-3.5 h-3.5 text-primary" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Customer section */}
                      <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-sm p-4 space-y-4">
                        <p className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Customer Details</p>

                        {/* Search */}
                        <div>
                          <div className="relative mb-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="tel"
                              value={customerSearch}
                              placeholder="Search by phone..."
                              onChange={(e) => { setCustomerSearch(e.target.value); setCustomersError(""); }}
                              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-900 text-sm font-medium placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary/20 border-0"
                            />
                          </div>

                          {customersLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            </div>
                          ) : (() => {
                            const term = customerSearch.trim();
                            const filtered = customersList.filter((c) => !term ? true : (c.phone || "").includes(term));
                            if (filtered.length > 0) {
                              return (
                                <ul className="space-y-1 max-h-40 overflow-y-auto">
                                  {filtered.map((c) => (
                                    <li key={c.id}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!c.address?.trim()) {
                                            selectCustomerForOrder(c);
                                            toast("No address on file — please enter one below", { icon: "📍" });
                                          } else {
                                            selectCustomerForOrder(c);
                                          }
                                        }}
                                        className="w-full flex items-center px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 text-left text-sm transition-colors"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <span className="font-bold text-gray-900 dark:text-white">{c.name}</span>
                                          {c.phone && <span className="text-gray-500 dark:text-neutral-400 ml-2 text-xs">{c.phone}</span>}
                                          {c.address && <p className="text-xs text-gray-400 dark:text-neutral-500 truncate mt-0.5">{c.address}</p>}
                                        </div>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              );
                            }
                            if (term) {
                              return (
                                <div className="space-y-2.5 bg-gray-50 dark:bg-neutral-900 rounded-xl p-3">
                                  <p className="text-xs text-gray-500 dark:text-neutral-400">No customer found. Add new:</p>
                                  <div className="px-3 py-2 rounded-lg bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white font-medium">{term}</div>
                                  <input type="text" value={quickCustomerName} onChange={(e) => setQuickCustomerName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm" placeholder="Customer name *" />
                                  <input type="text" value={quickCustomerAddress} onChange={(e) => setQuickCustomerAddress(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm" placeholder="Delivery address *" />
                                  <button type="button" onClick={handleQuickAddCustomer} disabled={addingQuickCustomer} className="w-full px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">
                                    {addingQuickCustomer ? "Adding…" : "Add & Select Customer"}
                                  </button>
                                </div>
                              );
                            }
                            return <p className="text-xs text-gray-400 dark:text-neutral-500 py-1">Type a phone number to search customers.</p>;
                          })()}

                          {customersError && <p className="text-xs text-red-500 mt-1">{customersError}</p>}
                        </div>

                        {/* Manual fields when customer selected */}
                        {customerPhone && !customerSearch && (
                          <div className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-neutral-800">
                            <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name *" className="w-full px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-900 text-sm font-medium placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary/20 border-0" />
                            <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone *" className="w-full px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-900 text-sm font-medium placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary/20 border-0" />
                            <textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Delivery address *" rows={2} className="w-full px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-900 text-sm font-medium placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary/20 border-0 resize-none" />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Floating Action Bars ───────────────────────────────────── */}
        {tab === TABS.NEW_ORDER && step === STEPS.MENU && cartBadge > 0 && (
          <div className="fixed bottom-16 inset-x-0 z-20">
            <div className="px-4 pb-3 pt-2">
              <button
                onClick={() => setStep(STEPS.CART)}
                className="w-full flex items-center justify-between py-3.5 px-5 rounded-2xl bg-primary text-white font-bold text-sm active:scale-[0.98] transition-transform shadow-xl shadow-primary/30"
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-[11px] font-black">{cartBadge}</span>
                  View Order
                </span>
                <span className="font-extrabold">Rs. {subtotal.toLocaleString()}</span>
              </button>
            </div>
          </div>
        )}

        {tab === TABS.NEW_ORDER && step === STEPS.CART && cart.length > 0 && (
          <div className="fixed bottom-16 inset-x-0 z-20">
            <div className="bg-white dark:bg-neutral-950 border-t border-gray-100 dark:border-neutral-900 px-4 pt-3 pb-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Total</p>
                  <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Rs. {subtotal.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Items</p>
                  <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{cartBadge}</p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setStep(STEPS.MENU)}
                  className="flex-1 py-3.5 rounded-2xl bg-gray-100 dark:bg-neutral-900 font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5 text-gray-700 dark:text-neutral-300"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={placing}
                  className="flex-[2.5] py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-600/25"
                >
                  {placing ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <>Send to Kitchen <Send className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Bottom Tab Bar ─────────────────────────────────────────── */}
        <nav className="flex-shrink-0 bg-white dark:bg-neutral-950 border-t border-gray-200 dark:border-neutral-800 flex rider-safe-bottom">
          <button
            onClick={() => setTab(TABS.NEW_ORDER)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${tab === TABS.NEW_ORDER ? "text-primary" : "text-gray-400 dark:text-neutral-500"}`}
          >
            <Utensils className="w-5 h-5" />
            <span className="text-[10px] font-bold">New Order</span>
          </button>
          <button
            onClick={() => setTab(TABS.ACTIVE)}
            className={`relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${tab === TABS.ACTIVE ? "text-primary" : "text-gray-400 dark:text-neutral-500"}`}
          >
            <div className="relative">
              <Package className="w-5 h-5" />
              {readyOrders.length > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white dark:ring-neutral-950">
                  {readyOrders.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold">Active</span>
          </button>
          <button
            onClick={() => setTab(TABS.HISTORY)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${tab === TABS.HISTORY ? "text-primary" : "text-gray-400 dark:text-neutral-500"}`}
          >
            <ClipboardList className="w-5 h-5" />
            <span className="text-[10px] font-bold">History</span>
          </button>
        </nav>
      </div>

      {/* Branch modal */}
      {showBranchModal && branches?.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">Select Branch</h2>
                  <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-0.5">Choose a branch to continue</p>
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

      <style jsx global>{`
        .rider-no-scrollbar::-webkit-scrollbar { display: none; }
        .rider-no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .rider-safe-top { padding-top: env(safe-area-inset-top, 0px); }
        .rider-safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
        @keyframes pulse-border { 0%, 100% { border-color: rgba(16,185,129,0.2); } 50% { border-color: rgba(16,185,129,0.6); } }
        .rider-pulse-border { animation: pulse-border 2s ease-in-out infinite; }
      `}</style>
    </>
  );
}

function CategoryPill({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
        active
          ? "bg-primary text-white shadow-sm shadow-primary/20"
          : "bg-gray-100 dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 active:bg-gray-200 dark:active:bg-neutral-800"
      }`}
    >
      {label}
    </button>
  );
}
