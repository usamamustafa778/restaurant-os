import { useState, useEffect, useRef, useCallback } from "react";
import {
  getMenu,
  getBranchMenu,
  createPosOrder,
  getTables,
  getOrders,
  getStoredAuth,
  clearStoredAuth,
  SubscriptionInactiveError,
} from "../../lib/apiClient";
import { useBranch } from "../../contexts/BranchContext";
import { useSocket } from "../../contexts/SocketContext";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  LogOut,
  ChevronLeft,
  Loader2,
  Utensils,
  X,
  Search,
  Send,
  Check,
  User,
  ArrowRight,
  Coffee,
  Hash,
  ClipboardList,
  ChefHat,
  Clock,
  Bell,
  PackageCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import SEO from "../../components/SEO";

const STEPS = { TABLE: "table", MENU: "menu", CART: "cart" };
const TABS = { ORDER: "order", ACTIVE: "active" };

export default function OrderTakerPage() {
  const { currentBranch } = useBranch() || {};
  const { socket } = useSocket() || {};

  const [activeTab, setActiveTab] = useState(TABS.ORDER);
  const [step, setStep] = useState(STEPS.TABLE);
  const [menu, setMenu] = useState({ categories: [], items: [] });
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null);
  const [userName, setUserName] = useState("");
  const searchRef = useRef(null);
  const categoryScrollRef = useRef(null);
  const cartBadge = cart.reduce((sum, i) => sum + i.quantity, 0);

  // Active orders state
  const [activeOrders, setActiveOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    const auth = getStoredAuth();
    setUserName(auth?.user?.name || auth?.user?.email || "");
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const auth = getStoredAuth();
        const restaurantId = auth?.user?.restaurantId;
        let data;
        if (currentBranch?.id && restaurantId) {
          data = await getBranchMenu(currentBranch.id, restaurantId);
        } else {
          data = await getMenu();
        }
        setMenu(data);
        const tbl = await getTables();
        setTables(Array.isArray(tbl) ? tbl : []);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) {
          toast.error("Subscription inactive");
        } else {
          toast.error(err.message || "Failed to load data");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentBranch]);

  // Fetch active orders
  const fetchActiveOrders = useCallback(async () => {
    try {
      const data = await getOrders();
      const active = data.filter(
        (o) => o.status !== "COMPLETED" && o.status !== "CANCELLED"
      );
      setActiveOrders(active);
    } catch (err) {
      console.error("Failed to load active orders:", err);
    }
  }, []);

  useEffect(() => {
    fetchActiveOrders();
    const interval = setInterval(fetchActiveOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchActiveOrders]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;
    const onOrderEvent = () => fetchActiveOrders();
    socket.on("order:created", onOrderEvent);
    socket.on("order:updated", onOrderEvent);
    return () => {
      socket.off("order:created", onOrderEvent);
      socket.off("order:updated", onOrderEvent);
    };
  }, [socket, fetchActiveOrders]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearStoredAuth();
    window.location.href = "/login";
  }

  const filteredItems = menu.items.filter((item) => {
    const matchCat =
      selectedCategory === "all" || item.categoryId === selectedCategory;
    const matchSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const isAvailable = item.finalAvailable ?? item.available;
    return matchCat && matchSearch && isAvailable;
  });

  const getCartQty = useCallback(
    (itemId) => cart.find((c) => c.id === itemId)?.quantity || 0,
    [cart],
  );

  function addToCart(item, qty = 1) {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.finalPrice ?? item.price ?? 0,
          quantity: qty,
          imageUrl: item.imageUrl || "",
        },
      ];
    });
  }

  function updateQty(id, delta) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.id === id ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c,
        )
        .filter((c) => c.quantity > 0),
    );
  }

  function removeFromCart(id) {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  async function handlePlaceOrder() {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      const result = await createPosOrder({
        items: cart.map((c) => ({ menuItemId: c.id, quantity: c.quantity })),
        orderType: "DINE_IN",
        paymentMethod: "PENDING",
        tableName: selectedTable?.name || selectedTable?.label || "",
        branchId: currentBranch?.id ?? undefined,
      });
      setOrderPlaced(result);
      setCart([]);
      fetchActiveOrders();
    } catch (err) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  }

  function handleNewOrder() {
    setOrderPlaced(null);
    setSelectedTable(null);
    setSearchQuery("");
    setSelectedCategory("all");
    setStep(STEPS.TABLE);
    setActiveTab(TABS.ORDER);
  }

  // Active orders derived data
  const readyOrders = activeOrders.filter((o) => o.status === "READY");
  const preparingOrders = activeOrders.filter(
    (o) => o.status === "PENDING" || o.status === "UNPROCESSED"
  );
  const filteredActiveOrders =
    activeFilter === "ready"
      ? readyOrders
      : activeFilter === "preparing"
        ? preparingOrders
        : activeOrders;

  function getTimeAgo(createdAt) {
    const diff = Date.now() - new Date(createdAt).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  }

  function getStatusConfig(status) {
    switch (status) {
      case "READY":
        return {
          label: "Ready to Serve",
          bg: "bg-emerald-500",
          bgLight: "bg-emerald-50 dark:bg-emerald-500/10",
          text: "text-emerald-600 dark:text-emerald-400",
          border: "border-emerald-200 dark:border-emerald-500/20",
          icon: PackageCheck,
          pulse: true,
        };
      case "PENDING":
        return {
          label: "Preparing",
          bg: "bg-amber-500",
          bgLight: "bg-amber-50 dark:bg-amber-500/10",
          text: "text-amber-600 dark:text-amber-400",
          border: "border-amber-200 dark:border-amber-500/20",
          icon: ChefHat,
          pulse: false,
        };
      case "UNPROCESSED":
        return {
          label: "New",
          bg: "bg-blue-500",
          bgLight: "bg-blue-50 dark:bg-blue-500/10",
          text: "text-blue-600 dark:text-blue-400",
          border: "border-blue-200 dark:border-blue-500/20",
          icon: Clock,
          pulse: false,
        };
      default:
        return {
          label: status,
          bg: "bg-gray-500",
          bgLight: "bg-gray-50 dark:bg-neutral-900",
          text: "text-gray-600 dark:text-neutral-400",
          border: "border-gray-200 dark:border-neutral-800",
          icon: Clock,
          pulse: false,
        };
    }
  }

  function getDisplayOrderId(order) {
    const id = order.id || order.orderNumber || order._id || "";
    if (typeof id === "string" && id.startsWith("ORD-"))
      return id.replace(/^ORD-/, "");
    return id;
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <SEO title="Order Taker - Eats Desk" noindex />
        <div className="h-[100dvh] flex flex-col items-center justify-center bg-white dark:bg-black gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
            <Coffee className="w-7 h-7 text-white animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              Setting up your station
            </p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
              Loading menu & tables...
            </p>
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

  // ── Order Success ──────────────────────────────────────────────────────
  if (orderPlaced) {
    return (
      <>
        <SEO title="Order Placed - Eats Desk" noindex />
        <div className="h-[100dvh] flex flex-col items-center justify-center bg-white dark:bg-black px-6">
          <div className="w-full max-w-xs text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                <Check className="w-10 h-10 text-white" strokeWidth={3} />
              </div>
            </div>

            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-1 tracking-tight">
              Order Sent!
            </h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 dark:bg-neutral-900 text-xs font-bold text-gray-600 dark:text-neutral-300 mb-4">
              <Hash className="w-3 h-3" />
              {orderPlaced.orderNumber || orderPlaced._id?.slice(-6)}
            </div>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mb-2">
              {selectedTable?.name || "Walk-in"}
            </p>
            <p className="text-3xl font-black text-gray-900 dark:text-white mb-8 tracking-tight">
              Rs. {(orderPlaced.total ?? subtotal).toLocaleString()}
            </p>
            <div className="space-y-2.5">
              <button
                onClick={handleNewOrder}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-white font-bold text-base active:scale-[0.98] transition-transform shadow-lg shadow-primary/25"
              >
                Take Next Order
              </button>
              <button
                onClick={() => {
                  setOrderPlaced(null);
                  setActiveTab(TABS.ACTIVE);
                }}
                className="w-full py-3.5 rounded-2xl bg-gray-100 dark:bg-neutral-900 text-sm font-bold text-gray-700 dark:text-neutral-300 active:scale-[0.98] transition-transform"
              >
                View Active Orders
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Main App Shell ─────────────────────────────────────────────────────
  return (
    <>
      <SEO title="Order Taker - Eats Desk" noindex />
      <div className="h-[100dvh] flex flex-col bg-gray-50 dark:bg-black text-gray-900 dark:text-white overflow-hidden">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="flex-shrink-0 bg-white dark:bg-neutral-950 ot-safe-top">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3 min-w-0">
              {activeTab === TABS.ORDER && step !== STEPS.TABLE ? (
                <button
                  onClick={() =>
                    step === STEPS.CART
                      ? setStep(STEPS.MENU)
                      : setStep(STEPS.TABLE)
                  }
                  className="w-9 h-9 -ml-1.5 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-900 active:scale-90 transition-all"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-neutral-300" />
                </button>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20">
                  <Utensils className="w-[18px] h-[18px] text-white" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-[15px] font-extrabold truncate leading-tight tracking-tight">
                  {activeTab === TABS.ACTIVE
                    ? "Active Orders"
                    : step === STEPS.TABLE
                      ? "Eats Desk"
                      : step === STEPS.MENU
                        ? selectedTable?.name || "Menu"
                        : "Review Order"}
                </h1>
                <p className="text-[11px] text-gray-400 dark:text-neutral-500 truncate leading-tight">
                  {activeTab === TABS.ACTIVE
                    ? `${readyOrders.length} ready · ${preparingOrders.length} preparing`
                    : step === STEPS.TABLE
                      ? userName || "Order Taker"
                      : step === STEPS.MENU
                        ? `${filteredItems.length} item${filteredItems.length !== 1 ? "s" : ""} available`
                        : `${selectedTable?.name || "Walk-in"} · ${cartBadge} item${cartBadge !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === TABS.ORDER && step === STEPS.MENU && cartBadge > 0 && (
                <button
                  onClick={() => setStep(STEPS.CART)}
                  className="relative h-9 pl-3 pr-3.5 rounded-full bg-primary text-white flex items-center gap-1.5 active:scale-95 transition-transform shadow-md shadow-primary/20"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span className="text-xs font-extrabold">{cartBadge}</span>
                </button>
              )}
              {activeTab === TABS.ORDER && step === STEPS.MENU && cartBadge === 0 && (
                <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-gray-400 dark:text-neutral-600" />
                </div>
              )}
              {activeTab === TABS.ORDER && step === STEPS.TABLE && (
                <button
                  onClick={handleLogout}
                  className="h-9 pl-3 pr-3.5 rounded-full flex items-center gap-1.5 text-gray-500 dark:text-neutral-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors text-xs font-semibold"
                  title="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              )}
              {activeTab === TABS.ORDER && step === STEPS.CART && cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="h-9 px-3 rounded-full flex items-center gap-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-xs font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
              {activeTab === TABS.ACTIVE && (
                <button
                  onClick={handleLogout}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Step indicator — only on ORDER tab */}
          {activeTab === TABS.ORDER && (
            <div className="flex gap-1 px-4 pb-2.5">
              {[STEPS.TABLE, STEPS.MENU, STEPS.CART].map((s, i) => (
                <div
                  key={s}
                  className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${
                    i <= [STEPS.TABLE, STEPS.MENU, STEPS.CART].indexOf(step)
                      ? "bg-primary"
                      : "bg-gray-200 dark:bg-neutral-800"
                  }`}
                />
              ))}
            </div>
          )}
        </header>

        {/* ── Content ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* ════════════════ ACTIVE ORDERS TAB ════════════════ */}
          {activeTab === TABS.ACTIVE && (
            <div className="p-4 pb-24">
              {/* Filter pills */}
              <div className="flex gap-2 mb-4 overflow-x-auto ot-no-scrollbar">
                {[
                  { key: "all", label: "All", count: activeOrders.length },
                  { key: "ready", label: "Ready", count: readyOrders.length },
                  { key: "preparing", label: "Preparing", count: preparingOrders.length },
                ].map((f) => (
                  <button
                    key={f.key}
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

              {filteredActiveOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center pt-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                    <ClipboardList className="w-7 h-7 text-gray-300 dark:text-neutral-700" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 dark:text-neutral-400 mb-1">
                    No active orders
                  </p>
                  <p className="text-xs text-gray-400 dark:text-neutral-600">
                    Orders you place will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredActiveOrders.map((order) => {
                    const sc = getStatusConfig(order.status);
                    const StatusIcon = sc.icon;
                    return (
                      <div
                        key={order.id || order._id}
                        className={`bg-white dark:bg-neutral-950 rounded-2xl overflow-hidden shadow-sm border ${sc.border} ${
                          sc.pulse ? "ot-pulse-border" : ""
                        }`}
                      >
                        {/* Status banner */}
                        <div className={`px-4 py-2 flex items-center justify-between ${sc.bgLight}`}>
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`w-4 h-4 ${sc.text}`} />
                            <span className={`text-xs font-bold ${sc.text}`}>
                              {sc.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-neutral-400">
                            <Clock className="w-3 h-3" />
                            {getTimeAgo(order.createdAt)}
                          </div>
                        </div>

                        <div className="p-4">
                          {/* Order meta */}
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="text-base font-black text-gray-900 dark:text-white">
                                #{order.tokenNumber || getDisplayOrderId(order).toString().slice(-4)}
                              </span>
                              {order.tableName && (
                                <span className="ml-2 text-xs font-semibold text-gray-400 dark:text-neutral-500">
                                  {order.tableName}
                                </span>
                              )}
                            </div>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                              order.orderType === "DINE_IN" || order.type === "dine-in"
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            }`}>
                              {order.orderType === "DINE_IN" || order.type === "dine-in"
                                ? "Dine-in"
                                : order.orderType === "TAKEAWAY" || order.type === "takeaway"
                                  ? "Takeaway"
                                  : "Delivery"}
                            </span>
                          </div>

                          {/* Customer */}
                          {order.customerName && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400 mb-3">
                              <User className="w-3 h-3" />
                              {order.customerName}
                            </div>
                          )}

                          {/* Items list */}
                          <div className="space-y-1 mb-3">
                            {order.items?.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="text-gray-700 dark:text-neutral-300 font-medium">
                                  <span className="font-bold text-gray-900 dark:text-white">
                                    {item.quantity || item.qty}x
                                  </span>{" "}
                                  {item.name}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Footer */}
                          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-neutral-900">
                            <span className="text-xs text-gray-400 dark:text-neutral-500">
                              Total
                            </span>
                            <span className="text-sm font-black text-gray-900 dark:text-white">
                              Rs. {order.total?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════════ ORDER TAB ════════════════ */}
          {activeTab === TABS.ORDER && (
            <>
              {/* TABLE SELECTION */}
              {step === STEPS.TABLE && (
                <div className="p-4 pb-24">
                  {tables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-20 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                        <Utensils className="w-7 h-7 text-gray-300 dark:text-neutral-700" />
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                        No tables set up
                      </p>
                      <p className="text-xs text-gray-400 dark:text-neutral-500 mb-6 max-w-[200px]">
                        You can still take orders without selecting a table
                      </p>
                      <button
                        onClick={() => {
                          setSelectedTable({ name: "Walk-in" });
                          setStep(STEPS.MENU);
                        }}
                        className="px-6 py-3 rounded-2xl bg-primary text-white text-sm font-bold active:scale-95 transition-transform shadow-lg shadow-primary/20 flex items-center gap-2"
                      >
                        Start Order
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {tables.map((table) => {
                          const occupied = table.status === "occupied";
                          return (
                            <button
                              key={table.id || table._id}
                              onClick={() => {
                                setSelectedTable(table);
                                setStep(STEPS.MENU);
                              }}
                              className={`group relative flex flex-col items-center justify-center py-5 px-2 rounded-2xl border-2 transition-all active:scale-[0.93] ${
                                occupied
                                  ? "border-amber-200 bg-amber-50/80 dark:bg-amber-500/5 dark:border-amber-500/20"
                                  : "border-transparent bg-white dark:bg-neutral-950 shadow-sm hover:shadow-md hover:border-primary/30"
                              }`}
                            >
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-colors ${
                                  occupied
                                    ? "bg-amber-100 dark:bg-amber-500/10"
                                    : "bg-gray-100 dark:bg-neutral-900 group-active:bg-primary/10"
                                }`}
                              >
                                <Utensils
                                  className={`w-5 h-5 ${
                                    occupied
                                      ? "text-amber-500"
                                      : "text-gray-400 dark:text-neutral-500 group-active:text-primary"
                                  }`}
                                />
                              </div>
                              <span className="text-xs font-bold truncate w-full text-center leading-tight">
                                {table.name || table.label || `T-${table.number}`}
                              </span>
                              {table.capacity && (
                                <span className="text-[10px] text-gray-400 dark:text-neutral-600 flex items-center gap-0.5 mt-1">
                                  <User className="w-2.5 h-2.5" />
                                  {table.capacity}
                                </span>
                              )}
                              {occupied && (
                                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-amber-400/20">
                                  <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                                    Busy
                                  </span>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedTable({ name: "Walk-in" });
                          setStep(STEPS.MENU);
                        }}
                        className="mt-4 w-full py-3.5 rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 text-sm font-bold text-gray-600 dark:text-neutral-300 active:scale-[0.98] transition-transform shadow-sm flex items-center justify-center gap-2"
                      >
                        Walk-in / No Table
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* MENU */}
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
                            onClick={() => {
                              setSearchQuery("");
                              searchRef.current?.focus();
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 dark:bg-neutral-800 flex items-center justify-center"
                          >
                            <X className="w-3 h-3 text-gray-500" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div
                      ref={categoryScrollRef}
                      className="px-4 pb-2.5 flex gap-2 overflow-x-auto ot-no-scrollbar"
                    >
                      <CategoryPill
                        active={selectedCategory === "all"}
                        onClick={() => setSelectedCategory("all")}
                        label="All"
                      />
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

                  <div className="flex-1 px-3 pt-2 pb-28 overflow-y-auto">
                    {filteredItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center pt-20 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-3">
                          <Search className="w-6 h-6 text-gray-300 dark:text-neutral-700" />
                        </div>
                        <p className="text-sm font-bold text-gray-500 dark:text-neutral-400">
                          No items found
                        </p>
                        <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">
                          Try a different search or category
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {filteredItems.map((item) => {
                          const qty = getCartQty(item.id);
                          const price = item.finalPrice ?? item.price ?? 0;
                          return (
                            <div
                              key={item.id || item._id}
                              className="relative bg-white dark:bg-neutral-950 rounded-2xl overflow-hidden shadow-sm active:scale-[0.97] transition-transform"
                            >
                              <button
                                onClick={() => addToCart(item)}
                                className="w-full text-left"
                              >
                                {item.imageUrl ? (
                                  <div className="w-full aspect-[4/3] bg-gray-100 dark:bg-neutral-900 overflow-hidden">
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-full aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-950 flex items-center justify-center">
                                    <Utensils className="w-8 h-8 text-gray-200 dark:text-neutral-800" />
                                  </div>
                                )}
                                <div className="px-2.5 pt-1.5 pb-2">
                                  <p className="text-[13px] font-bold leading-snug line-clamp-2 pb-0.5">
                                    {item.name}
                                  </p>
                                  <p className="text-xs font-extrabold text-primary">
                                    Rs. {price.toLocaleString()}
                                  </p>
                                </div>
                              </button>

                              {qty > 0 && (
                                <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 dark:border-neutral-700/50 px-1 py-0.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateQty(item.id, -1);
                                    }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="w-5 text-center text-xs font-black text-primary">
                                    {qty}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addToCart(item);
                                    }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform text-primary hover:bg-primary/10"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}

                              {qty === 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToCart(item);
                                  }}
                                  className="absolute top-2 right-2 w-8 h-8 rounded-xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm shadow-md flex items-center justify-center active:scale-90 transition-transform border border-gray-200/50 dark:border-neutral-700/50"
                                >
                                  <Plus className="w-4 h-4 text-primary" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CART */}
              {step === STEPS.CART && (
                <div className="p-4 pb-44">
                  {selectedTable && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 dark:bg-primary/20 mb-4">
                      <Utensils className="w-3 h-3 text-primary" />
                      <span className="text-xs font-bold text-primary">
                        {selectedTable.name || selectedTable.label}
                      </span>
                    </div>
                  )}

                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-16 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                        <ShoppingCart className="w-7 h-7 text-gray-300 dark:text-neutral-700" />
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                        Nothing here yet
                      </p>
                      <p className="text-xs text-gray-400 dark:text-neutral-500 mb-5">
                        Add items from the menu
                      </p>
                      <button
                        onClick={() => setStep(STEPS.MENU)}
                        className="px-6 py-3 rounded-2xl bg-primary text-white text-sm font-bold active:scale-95 transition-transform shadow-lg shadow-primary/20"
                      >
                        Browse Menu
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {cart.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 bg-white dark:bg-neutral-950 rounded-2xl p-3 shadow-sm"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center flex-shrink-0">
                              <Utensils className="w-5 h-5 text-gray-300 dark:text-neutral-700" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate leading-tight">
                              {item.name}
                            </p>
                            <p className="text-xs font-bold text-primary mt-0.5">
                              Rs. {(item.price * item.quantity).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-0 bg-gray-100 dark:bg-neutral-900 rounded-xl">
                            <button
                              onClick={() => updateQty(item.id, -1)}
                              className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
                            >
                              {item.quantity === 1 ? (
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              ) : (
                                <Minus className="w-3.5 h-3.5 text-gray-500" />
                              )}
                            </button>
                            <span className="w-7 text-center text-sm font-black">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQty(item.id, 1)}
                              className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
                            >
                              <Plus className="w-3.5 h-3.5 text-primary" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Floating Action Bars ───────────────────────────────────── */}

        {activeTab === TABS.ORDER && step === STEPS.MENU && cartBadge > 0 && (
          <div className="fixed bottom-16 inset-x-0 z-20">
            <div className="px-4 pb-3 pt-2">
              <button
                onClick={() => setStep(STEPS.CART)}
                className="w-full flex items-center justify-between py-3.5 px-5 rounded-2xl bg-primary text-white font-bold text-sm active:scale-[0.98] transition-transform shadow-xl shadow-primary/30"
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-[11px] font-black">
                    {cartBadge}
                  </span>
                  View Order
                </span>
                <span className="font-extrabold">
                  Rs. {subtotal.toLocaleString()}
                </span>
              </button>
            </div>
          </div>
        )}

        {activeTab === TABS.ORDER && step === STEPS.CART && cart.length > 0 && (
          <div className="fixed bottom-16 inset-x-0 z-20">
            <div className="bg-white dark:bg-neutral-950 border-t border-gray-100 dark:border-neutral-900 px-4 pt-3 pb-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">
                    Total
                  </p>
                  <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                    Rs. {subtotal.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">
                    Items
                  </p>
                  <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                    {cartBadge}
                  </p>
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
                  {placing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send to Kitchen
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Bottom Tab Bar ─────────────────────────────────────────── */}
        <nav className="flex-shrink-0 bg-white dark:bg-neutral-950 border-t border-gray-200 dark:border-neutral-800 flex ot-safe-bottom">
          <button
            onClick={() => setActiveTab(TABS.ORDER)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
              activeTab === TABS.ORDER
                ? "text-primary"
                : "text-gray-400 dark:text-neutral-500"
            }`}
          >
            <Utensils className="w-5 h-5" />
            <span className="text-[10px] font-bold">New Order</span>
          </button>
          <button
            onClick={() => {
              setActiveTab(TABS.ACTIVE);
              fetchActiveOrders();
            }}
            className={`relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
              activeTab === TABS.ACTIVE
                ? "text-primary"
                : "text-gray-400 dark:text-neutral-500"
            }`}
          >
            <div className="relative">
              <ClipboardList className="w-5 h-5" />
              {readyOrders.length > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white dark:ring-neutral-950">
                  {readyOrders.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold">Orders</span>
          </button>
        </nav>
      </div>

      <style jsx global>{`
        .ot-no-scrollbar::-webkit-scrollbar { display: none; }
        .ot-no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .ot-safe-top { padding-top: env(safe-area-inset-top, 0px); }
        .ot-safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
        @keyframes pulse-border { 0%, 100% { border-color: rgba(16, 185, 129, 0.2); } 50% { border-color: rgba(16, 185, 129, 0.6); } }
        .ot-pulse-border { animation: pulse-border 2s ease-in-out infinite; }
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
