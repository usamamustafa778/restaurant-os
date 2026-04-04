import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  getRiderOrders,
  collectOrderByRider,
  markOrderDeliveredByRider,
  getRiderMenu,
  getRiderCustomers,
  createRiderCustomer,
  createPosOrder,
  getWebsiteSettings,
  getStoredAuth,
  clearStoredAuth,
  SubscriptionInactiveError,
  getCurrencySymbol,
  getCurrentDaySession,
  getDeals,
} from "../../lib/apiClient";
import { useSocket } from "../../contexts/SocketContext";
import { useBranch } from "../../contexts/BranchContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  Bike,
  MapPin,
  Phone,
  User,
  Clock,
  BarChart3,
  Loader2,
  Package,
  Truck,
  RefreshCw,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  Wallet,
  Sun,
  Moon,
  Tag,
} from "lucide-react";
import toast from "react-hot-toast";
import SEO from "../../components/SEO";

const TABS = { NEW_ORDER: "new_order", HOME: "home", ACTIVE: "active", HISTORY: "history" };
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
      return {
        label: "Out for Delivery",
        bg: "bg-primary",
        bgLight: "bg-primary/10 dark:bg-primary/20",
        text: "text-primary dark:text-primary",
        border: "border-primary/20 dark:border-primary/30",
        icon: Truck,
        pulse: false
      };
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

/** Grand total for an order (rider-facing). */
function orderGrandTotal(order) {
  return Number(order.grandTotal ?? order.total) || 0;
}

/** Paid online/at POS — nothing for rider to hand in at the shop. */
function isDeliveryPrepaid(order) {
  const pm = String(order.paymentMethod || "").toUpperCase();
  return pm === "ONLINE" || pm === "CARD" || pm === "FOODPANDA";
}

/**
 * Delivered delivery where cash/COD was not yet marked collected at the shop.
 * Matches API: paymentMethod PENDING + deliveryPaymentCollected false, etc.
 * Rider API historically omitted orderType — treat missing as DELIVERY (rider app is delivery-only).
 */
function isDeliveryPaymentNotSubmitted(order) {
  if (order.status !== "DELIVERED" && order.status !== "COMPLETED") return false;
  const ot = String(order.orderType || "DELIVERY").toUpperCase();
  if (ot !== "DELIVERY") return false;
  if (isDeliveryPrepaid(order)) return false;
  return order.deliveryPaymentCollected !== true;
}

export default function RiderPortalPage() {
  const sym = getCurrencySymbol();
  const { socket } = useSocket() || {};
  const { currentBranch, branches, setCurrentBranch, loading: branchLoading } = useBranch() || {};
  const { theme, toggleTheme } = useTheme() || {
    theme: "light",
    toggleTheme: () => {},
  };
  const searchRef = useRef(null);
  /** Ignore stale menu responses if branch changes quickly or an early unscoped request finishes late. */
  const menuLoadSeqRef = useRef(0);
  const dealsLoadSeqRef = useRef(0);

  // Auth
  const [userName, setUserName] = useState("");
  const [riderId, setRiderId] = useState(null);

  // Orders
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [tab, setTab] = useState(TABS.HOME);
  const [collectingId, setCollectingId] = useState(null);
  const [deliveringId, setDeliveringId] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  /** History: all | pending_payment | cleared — default to pending so riders see what to submit first */
  const [historyFilter, setHistoryFilter] = useState("pending_payment");
  const [expandedOrderIds, setExpandedOrderIds] = useState([]);

  function toggleOrderDetails(orderKey) {
    setExpandedOrderIds((prev) =>
      prev.includes(orderKey)
        ? prev.filter((id) => id !== orderKey)
        : prev.concat(orderKey),
    );
  }

  // New order
  const [step, setStep] = useState(STEPS.MENU);
  const [menu, setMenu] = useState({ categories: [], items: [] });
  /** Active COMBO deals for current branch (same rules as POS grid). */
  const [availableDeals, setAvailableDeals] = useState([]);
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
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [deliveryLocationId, setDeliveryLocationId] = useState("");

  const [showCustomerEdit, setShowCustomerEdit] = useState(false);
  const [zoneQuery, setZoneQuery] = useState("");
  const [zoneOpen, setZoneOpen] = useState(false);
  const zoneRef = useRef(null);

  // UI
  const [showBranchModal, setShowBranchModal] = useState(false);

  // Session gate
  const [sessionGateChecked, setSessionGateChecked] = useState(false);
  const [noActiveSession, setNoActiveSession] = useState(false);

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

  // ── Session gate check ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setSessionGateChecked(false);
    getCurrentDaySession(currentBranch?.id)
      .then((session) => {
        if (cancelled) return;
        setNoActiveSession(!session);
        setSessionGateChecked(true);
      })
      .catch(() => {
        if (!cancelled) {
          setNoActiveSession(false);
          setSessionGateChecked(true);
        }
      });
    return () => { cancelled = true; };
  }, [currentBranch?.id]);

  useEffect(() => {
    let cancelled = false;
    getWebsiteSettings()
      .then((ws) => {
        if (cancelled || !ws) return;
        const raw = Array.isArray(ws.deliveryLocations) ? ws.deliveryLocations : [];
        const mapped = raw
          .map((z) => ({
            id: z._id != null ? String(z._id) : z.id != null ? String(z.id) : "",
            name: String(z.name || "").trim(),
            fee: Math.max(0, Number(z.fee) || 0),
            sortOrder: Number(z.sortOrder) || 0,
          }))
          .filter((z) => z.name && z.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setDeliveryZones(mapped);
        setDeliveryLocationId((prev) => (prev && mapped.some((m) => m.id === prev) ? prev : ""));
      })
      .catch(() => {
        if (!cancelled) {
          setDeliveryZones([]);
          setDeliveryLocationId("");
        }
      });
    return () => { cancelled = true; };
  }, [currentBranch?.id]);

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

  const loadMenu = useCallback(async () => {
    const seq = ++menuLoadSeqRef.current;
    setMenuLoading(true);
    try {
      const data = await getRiderMenu(currentBranch?.id);
      if (seq !== menuLoadSeqRef.current) return;
      setMenu(data || { categories: [], items: [] });
    } catch (err) {
      if (seq !== menuLoadSeqRef.current) return;
      if (err instanceof SubscriptionInactiveError) toast.error("Subscription inactive");
      else toast.error(err.message || "Failed to load menu");
    } finally {
      if (seq === menuLoadSeqRef.current) setMenuLoading(false);
    }
  }, [currentBranch?.id]);

  const loadDeals = useCallback(async () => {
    const seq = ++dealsLoadSeqRef.current;
    try {
      const allDeals = await getDeals(false);
      if (seq !== dealsLoadSeqRef.current) return;
      const branchId = currentBranch?.id;
      const deals = Array.isArray(allDeals)
        ? allDeals.filter((d) => {
            if (!d.isActive) return false;
            if (d.endDate && new Date(d.endDate) < new Date()) return false;
            if (branchId && d.branches?.length > 0) {
              return d.branches.some((b) => String(b._id || b) === String(branchId));
            }
            return true;
          })
        : [];
      setAvailableDeals(deals);
    } catch {
      if (seq !== dealsLoadSeqRef.current) return;
      setAvailableDeals([]);
    }
  }, [currentBranch?.id]);

  useEffect(() => {
    if (tab !== TABS.NEW_ORDER) return;
    // Wait for branch context so we don't call /menu without a branch while localStorage already has x-branch-id (matches POS inventory).
    if (branchLoading) return;
    if (branches.length > 0 && !currentBranch) return;
    loadMenu();
    loadDeals();
  }, [tab, loadMenu, loadDeals, branchLoading, branches.length, currentBranch?.id]);

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

  useEffect(() => {
    function handleClickOutside(e) {
      if (zoneRef.current && !zoneRef.current.contains(e.target)) setZoneOpen(false);
    }
    if (zoneOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [zoneOpen]);

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

  const deliveredHistory = historyOrders.filter(
    (o) => o.status === "DELIVERED" || o.status === "COMPLETED",
  );
  /** Delivered & payment cleared at shop (prepaid or cash marked collected). */
  const clearedDeliveredPaid = deliveredHistory.filter((o) => !isDeliveryPaymentNotSubmitted(o));
  /** Full cleared amount (items + delivery fee on the bill). */
  const riderClearedRevenue = clearedDeliveredPaid.reduce((sum, o) => sum + orderGrandTotal(o), 0);
  /** Delivery fee portion of cleared orders (what was charged for delivery). */
  const riderClearedDeliveryFees = clearedDeliveredPaid.reduce(
    (sum, o) => sum + (Number(o.deliveryCharges) || 0),
    0,
  );
  /** Items / food subtotal portion (grand total minus delivery charges). */
  const riderClearedOrderAmount = Math.max(0, riderClearedRevenue - riderClearedDeliveryFees);

  /** COD / PENDING still to be submitted at the shop. */
  const riderPendingPaymentOrders = deliveredHistory.filter(isDeliveryPaymentNotSubmitted);
  const riderPendingPaymentTotal = riderPendingPaymentOrders.reduce(
    (sum, o) => sum + orderGrandTotal(o),
    0,
  );
  const riderPendingDeliveryFees = riderPendingPaymentOrders.reduce(
    (sum, o) => sum + (Number(o.deliveryCharges) || 0),
    0,
  );
  const riderPendingOrderAmount = Math.max(0, riderPendingPaymentTotal - riderPendingDeliveryFees);

  const deliveredCount = deliveredHistory.length;
  const cancelledCount = historyOrders.filter((o) => o.status === "CANCELLED").length;
  const activeRevenue = activeOrders.reduce(
    (sum, o) => sum + (Number(o.grandTotal ?? o.total) || 0),
    0,
  );

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

  const filteredHistoryOrders =
    historyFilter === "all"
      ? historyOrders
      : historyFilter === "pending_payment"
        ? historyOrders.filter(isDeliveryPaymentNotSubmitted)
        : historyOrders.filter((o) => {
            if (o.status === "CANCELLED") return true;
            if (o.status !== "DELIVERED" && o.status !== "COMPLETED") return false;
            return !isDeliveryPaymentNotSubmitted(o);
          });

  const clearedHistoryCount = historyOrders.filter((o) => {
    if (o.status === "CANCELLED") return true;
    if (o.status !== "DELIVERED" && o.status !== "COMPLETED") return false;
    return !isDeliveryPaymentNotSubmitted(o);
  }).length;

  const activeFilterLabel = activeFilter === "all"
    ? "active"
    : activeFilter === "new"
      ? "new"
      : activeFilter === "preparing"
        ? "preparing"
        : activeFilter === "ready"
          ? "ready"
          : "out for delivery";

  const dealMenuItems = useMemo(
    () =>
      (availableDeals || [])
        .filter((d) => d.dealType === "COMBO" && d.showOnPOS !== false)
        .map((d) => ({
          id: `deal-${d._id || d.id}`,
          _id: `deal-${d._id || d.id}`,
          name: d.name,
          price: d.comboPrice || 0,
          finalPrice: d.comboPrice || 0,
          imageUrl: d.imageUrl || "",
          isDeal: true,
          categoryId: null,
          available: true,
          finalAvailable: true,
          inventorySufficient: true,
        })),
    [availableDeals],
  );

  const allMenuItems = useMemo(
    () => [...(menu.items || []), ...dealMenuItems],
    [menu.items, dealMenuItems],
  );

  const filteredItems = allMenuItems.filter((item) => {
    if (item.available === false || item.finalAvailable === false) return false;
    const matchCat =
      selectedCategory === "all" ||
      (selectedCategory === "deals" ? item.isDeal : item.categoryId === selectedCategory);
    const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const isAvailable = item.finalAvailable ?? item.available;
    return matchCat && matchSearch && isAvailable !== false;
  });

  useEffect(() => {
    if (selectedCategory === "deals" && dealMenuItems.length === 0) {
      setSelectedCategory("all");
    }
  }, [selectedCategory, dealMenuItems.length]);

  const getCartQty = useCallback((itemId) => cart.find((c) => c.id === itemId)?.quantity || 0, [cart]);
  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const cartBadge = cart.reduce((sum, i) => sum + i.quantity, 0);
  const deliveryZonesActive = deliveryZones.length > 0;
  const selectedDeliveryZone = deliveryZones.find((z) => z.id === deliveryLocationId);
  const deliveryFee = selectedDeliveryZone ? Math.round(selectedDeliveryZone.fee * 100) / 100 : 0;
  const cartTotalDue = Math.round((subtotal + deliveryFee) * 100) / 100;

  // ── Cart helpers ──────────────────────────────────────────────────────
  function addToCart(item, qty = 1) {
    if (!item.isDeal && (item.inventorySufficient === false || item.inventorySufficient === "false")) {
      toast.error(`${item.name} is out of stock`);
      return;
    }
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
          isDeal: !!item.isDeal,
        },
      ];
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
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Customer name and phone are required");
      return;
    }
    if (deliveryZonesActive && !deliveryLocationId) {
      toast.error("Select a delivery area");
      return;
    }
    if (!deliveryZonesActive && !deliveryAddress.trim()) {
      toast.error("Delivery address is required");
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
        ...(deliveryLocationId ? { deliveryLocationId } : {}),
        branchId: currentBranch?.id ?? undefined,
      });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryAddress("");
      setDeliveryLocationId("");
      setCustomerSearch("");
      setQuickCustomerName("");
      setQuickCustomerAddress("");
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
    setQuickCustomerName("");
    setQuickCustomerAddress("");
    setShowCustomerEdit(false);
  }

  async function handleQuickAddCustomer() {
    const phone = customerSearch.trim();
    const name = quickCustomerName.trim();
    const address = quickCustomerAddress.trim();
    if (!phone || !name) { setCustomersError("Enter customer name and phone to add"); return; }
    if (!deliveryZonesActive && !address) { setCustomersError("Address is required for delivery orders"); return; }
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
                  {tab === TABS.HOME
                    ? "Overview"
                    : tab === TABS.ACTIVE
                      ? "Active Deliveries"
                      : tab === TABS.HISTORY
                        ? "Delivery History"
                        : step === STEPS.MENU
                          ? "New Order"
                          : "Review Order"}
                </h1>
                <p className="text-[11px] text-gray-400 dark:text-neutral-500 truncate leading-tight">
                  {tab === TABS.HOME
                    ? (() => {
                        const parts = [`${deliveredCount} delivered`];
                        if (riderClearedRevenue > 0) {
                          parts.push(
                            `Rs. ${Math.round(riderClearedRevenue).toLocaleString()} cleared`,
                          );
                        }
                        if (riderPendingPaymentTotal > 0) {
                          parts.push(
                            `Rs. ${Math.round(riderPendingPaymentTotal).toLocaleString()} to submit`,
                          );
                        }
                        return parts.join(" · ");
                      })()
                    : tab === TABS.ACTIVE
                      ? activeFilter === "all"
                        ? `${readyOrders.length} ready · ${activeOrders.length} active`
                        : `${filteredActiveOrders.length} ${activeFilterLabel} · ${activeOrders.length} active`
                      : tab === TABS.HISTORY
                        ? (() => {
                            const label =
                              historyFilter === "pending_payment"
                                ? "Pending payment"
                                : historyFilter === "cleared"
                                  ? "Cleared"
                                  : "All orders";
                            return `${label} · ${filteredHistoryOrders.length} of ${historyOrders.length}`;
                          })()
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
              {(tab === TABS.HOME || tab === TABS.ACTIVE || tab === TABS.HISTORY) && (
                <button
                  onClick={() => { setOrdersLoading(true); loadOrders(); }}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
                </button>
              )}
              <button
                onClick={toggleTheme}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
                title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
                aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              >
                {theme === "light" ? (
                  <Moon className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
                ) : (
                  <Sun className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
                )}
              </button>
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
          {/* ══════ HOME TAB ══════ */}
          {tab === TABS.HOME && (
            <div className="p-3 sm:p-4 pb-24 space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-gray-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3.5 py-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bike className="w-[18px] h-[18px] text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-extrabold text-gray-900 dark:text-white leading-tight truncate">
                    {userName ? `Hi, ${userName.split(" ")[0]}` : "Rider"}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-neutral-400 mt-0.5 leading-snug">
                    {userName ? "Good luck on your route today." : "Sign in to continue."}
                  </p>
                </div>
              </div>

              {riderPendingPaymentTotal > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200 dark:border-amber-500/25 p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">Submit at shop</p>
                    <p className="text-base font-black text-amber-950 dark:text-amber-100 mt-0.5">
                      Rs. {Math.round(riderPendingPaymentTotal).toLocaleString()}
                      <span className="text-xs font-bold text-amber-700/90 dark:text-amber-400/90 ml-1.5">
                        · {riderPendingPaymentOrders.length} order{riderPendingPaymentOrders.length !== 1 ? "s" : ""}
                      </span>
                    </p>
                    <p className="text-[10px] text-amber-900/90 dark:text-amber-300/90 mt-1 tabular-nums leading-snug">
                      Orders Rs. {Math.round(riderPendingOrderAmount).toLocaleString()} · Delivery Rs.{" "}
                      {Math.round(riderPendingDeliveryFees).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-amber-800/80 dark:text-amber-400/80 mt-1">Cash / COD not recorded yet — use History → Pending payment</p>
                  </div>
                </div>
              )}

              {/* Cleared today — full width; counts in one row */}
              <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent dark:from-primary/10 dark:to-transparent p-3.5 sm:p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary/90 dark:text-primary/80">
                  Cleared today
                </p>
                <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white mt-0.5 tracking-tight">
                  Rs. {Math.round(riderClearedRevenue).toLocaleString()}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/80 dark:bg-neutral-950/80 border border-gray-200/60 dark:border-neutral-800 px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                      Orders
                    </p>
                    <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white mt-0.5">
                      Rs. {Math.round(riderClearedOrderAmount).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/80 dark:bg-neutral-950/80 border border-gray-200/60 dark:border-neutral-800 px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                      Delivery fees
                    </p>
                    <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white mt-0.5">
                      Rs. {Math.round(riderClearedDeliveryFees).toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-neutral-500 mt-2.5 leading-snug">
                  Prepaid + cash already marked with the shop
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Delivered", value: deliveredCount },
                  { label: "Active", value: activeOrders.length },
                  { label: "Cancelled", value: cancelledCount },
                ].map((cell) => (
                  <div
                    key={cell.label}
                    className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-2 py-2.5 text-center"
                  >
                    <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 dark:text-neutral-500 leading-none">
                      {cell.label}
                    </p>
                    <p className="text-xl font-black text-gray-900 dark:text-white mt-1.5 tabular-nums leading-none">
                      {cell.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3.5">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500">
                    Kitchen &amp; route
                  </p>
                  <span className="text-[10px] font-semibold text-gray-500 dark:text-neutral-400 tabular-nums">
                    Active Rs. {Math.round(activeRevenue).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Kitchen", n: preparingOrders.length },
                    { label: "Ready", n: readyOrders.length },
                    { label: "Out", n: outForDeliveryOrders.length },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="rounded-xl bg-gray-50 dark:bg-neutral-900/80 py-2 px-1"
                    >
                      <p className="text-lg font-black text-primary tabular-nums leading-none">{row.n}</p>
                      <p className="text-[9px] font-semibold text-gray-500 dark:text-neutral-500 mt-0.5">{row.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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
                    const orderKey = String(orderId);
                    const isExpanded = expandedOrderIds.includes(orderKey);
                    const totalWrapClass = isExpanded
                      ? "flex items-center justify-between pt-3 border-t border-gray-100 dark:border-neutral-900 mb-3"
                      : "flex items-center justify-between mb-3";
                    return (
                      <div key={orderKey} className={`bg-white dark:bg-neutral-950 rounded-2xl overflow-hidden shadow-sm border ${sc.border} ${sc.pulse ? "rider-pulse-border" : ""}`}>
                        <div className={`px-4 py-2 flex items-center justify-between ${sc.bgLight}`}>
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`w-4 h-4 ${sc.text}`} />
                            <span className={`text-xs font-bold ${sc.text}`}>{sc.label}</span>
                          </div>
                          <div className={`flex items-center gap-1.5 text-[11px] ${sc.text} opacity-80`}>
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

                          <button
                            type="button"
                            onClick={() => toggleOrderDetails(orderKey)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors border ${
                              isExpanded
                                ? "bg-primary/10 border-primary/20 text-primary"
                                : "bg-gray-50 dark:bg-neutral-900 border-gray-200/70 dark:border-neutral-800 text-gray-600 dark:text-neutral-300"
                            }`}
                          >
                            <span>{isExpanded ? "Hide Details" : "View Details"}</span>
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </button>

                          {isExpanded && (
                            <>
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
                            </>
                          )}

                          <div className={totalWrapClass}>
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
                              className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm shadow-primary/20 active:scale-[0.98] transition-transform"
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
                <div className="flex flex-col items-center justify-center pt-16 text-center px-2">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                    <History className="w-7 h-7 text-gray-300 dark:text-neutral-700" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 dark:text-neutral-400 mb-1">No delivery history</p>
                  <p className="text-xs text-gray-400 dark:text-neutral-600">Completed orders will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Summary strip — single card, two columns */}
                  <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden shadow-sm">
                    <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-neutral-800">
                      <div className="p-3.5 sm:p-4">
                        <p className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">
                          Cleared
                        </p>
                        <p className="text-base sm:text-lg font-black text-gray-900 dark:text-white tabular-nums leading-tight mt-1">
                          Rs. {Math.round(riderClearedRevenue).toLocaleString()}
                        </p>
                        <p className="text-[9px] text-gray-500 dark:text-neutral-400 mt-1 leading-snug tabular-nums">
                          Orders Rs. {Math.round(riderClearedOrderAmount).toLocaleString()} · Del. Rs.{" "}
                          {Math.round(riderClearedDeliveryFees).toLocaleString()}
                        </p>
                        <p className="text-[9px] text-gray-400 dark:text-neutral-500 mt-0.5 leading-snug">
                          Prepaid + submitted
                        </p>
                      </div>
                      <div
                        className={`p-3.5 sm:p-4 ${
                          riderPendingPaymentTotal > 0 ? "bg-amber-50/90 dark:bg-amber-500/10" : ""
                        }`}
                      >
                        <p
                          className={`text-[9px] font-bold uppercase tracking-wider ${
                            riderPendingPaymentTotal > 0
                              ? "text-amber-800 dark:text-amber-300"
                              : "text-gray-400 dark:text-neutral-500"
                          }`}
                        >
                          To submit
                        </p>
                        <p
                          className={`text-base sm:text-lg font-black tabular-nums leading-tight mt-1 ${
                            riderPendingPaymentTotal > 0
                              ? "text-amber-950 dark:text-amber-100"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          Rs. {Math.round(riderPendingPaymentTotal).toLocaleString()}
                        </p>
                        <p className="text-[9px] text-gray-500 dark:text-neutral-400 mt-1 leading-snug tabular-nums">
                          Orders Rs. {Math.round(riderPendingOrderAmount).toLocaleString()} · Del. Rs.{" "}
                          {Math.round(riderPendingDeliveryFees).toLocaleString()}
                        </p>
                        <p className="text-[9px] text-gray-500 dark:text-neutral-500 mt-0.5">
                          {riderPendingPaymentOrders.length} order
                          {riderPendingPaymentOrders.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Segmented filter — pending first (default) */}
                  <div className="rounded-2xl p-1 bg-gray-100/90 dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800">
                    <div className="flex gap-0.5">
                      {[
                        {
                          key: "pending_payment",
                          label: "Pending",
                          count: riderPendingPaymentOrders.length,
                          activeClass: "bg-amber-500 text-white shadow-sm shadow-amber-500/20",
                          inactiveClass: "text-gray-600 dark:text-neutral-400",
                        },
                        {
                          key: "all",
                          label: "All",
                          count: historyOrders.length,
                          activeClass: "bg-primary text-white shadow-sm shadow-primary/20",
                          inactiveClass: "text-gray-600 dark:text-neutral-400",
                        },
                        {
                          key: "cleared",
                          label: "Cleared",
                          count: clearedHistoryCount,
                          activeClass: "bg-primary text-white shadow-sm shadow-primary/20",
                          inactiveClass: "text-gray-600 dark:text-neutral-400",
                        },
                      ].map((f) => {
                        const active = historyFilter === f.key;
                        return (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => setHistoryFilter(f.key)}
                            className={`flex-1 min-w-0 py-2 px-1.5 rounded-xl text-[11px] font-extrabold transition-all flex flex-col items-center justify-center gap-0.5 sm:flex-row sm:gap-1.5 ${
                              active ? f.activeClass : `bg-transparent ${f.inactiveClass} hover:bg-white/60 dark:hover:bg-neutral-800/80`
                            }`}
                          >
                            <span className="truncate">{f.label}</span>
                            <span
                              className={`text-[10px] font-black tabular-nums min-w-[1.25rem] ${
                                active ? "opacity-95" : "opacity-70"
                              }`}
                            >
                              {f.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 dark:text-neutral-500 px-0.5 -mt-1">
                    {historyFilter === "pending_payment"
                      ? "Delivered orders still marked “To be paid” — hand in cash at the shop."
                      : historyFilter === "cleared"
                        ? "Paid at order, cancelled, or cash already submitted at the shop."
                        : "Every delivery in your history for this session."}
                  </p>

                  {filteredHistoryOrders.length === 0 ? (
                    historyFilter === "pending_payment" && riderPendingPaymentOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center pt-10 pb-6 text-center px-3 rounded-2xl border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-3">
                          <Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="text-sm font-extrabold text-gray-900 dark:text-white mb-1">All caught up</p>
                        <p className="text-xs text-gray-500 dark:text-neutral-400 max-w-[260px] leading-relaxed">
                          Nothing waiting to be submitted. Switch to <span className="font-semibold text-gray-700 dark:text-neutral-300">All</span> to browse past deliveries.
                        </p>
                        <button
                          type="button"
                          onClick={() => setHistoryFilter("all")}
                          className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-extrabold shadow-sm shadow-primary/25 active:scale-[0.98] transition-transform"
                        >
                          View all deliveries
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-12 text-center px-2">
                        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-3">
                          <ClipboardList className="w-6 h-6 text-gray-300 dark:text-neutral-700" />
                        </div>
                        <p className="text-sm font-bold text-gray-500 dark:text-neutral-400 mb-1">No orders here</p>
                        <p className="text-xs text-gray-400 dark:text-neutral-600">Try a different filter above</p>
                      </div>
                    )
                  ) : (
                    filteredHistoryOrders.map((order) => {
                      const paymentPending = isDeliveryPaymentNotSubmitted(order);
                      const sc = getStatusConfig(order.status);
                      const StatusIcon = paymentPending ? Wallet : sc.icon;
                      const orderId = order.id || order._id;
                      const headerBg = paymentPending
                        ? "bg-amber-50 dark:bg-amber-500/10"
                        : sc.bgLight;
                      const headerText = paymentPending
                        ? "text-amber-800 dark:text-amber-300"
                        : sc.text;
                      const borderClass = paymentPending
                        ? "border-amber-200 dark:border-amber-500/30"
                        : sc.border;
                      return (
                        <div
                          key={orderId}
                          className={`bg-white dark:bg-neutral-950 rounded-2xl overflow-hidden shadow-sm border ${borderClass}`}
                        >
                          <div className={`px-4 py-2 flex items-center justify-between ${headerBg}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <StatusIcon className={`w-4 h-4 shrink-0 ${headerText}`} />
                              <span className={`text-xs font-bold ${headerText} truncate`}>
                                {paymentPending
                                  ? "Delivered · payment not submitted"
                                  : sc.label}
                              </span>
                            </div>
                            <div className={`flex items-center gap-1.5 text-[11px] ${headerText} opacity-80 shrink-0`}>
                              <Clock className="w-3 h-3" />
                              {getTimeAgo(order.createdAt)}
                            </div>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-base font-black text-gray-900 dark:text-white">
                                #{order.tokenNumber || getOrderId(order).toString().slice(-4)}
                              </span>
                              <span
                                className={`text-sm font-black ${
                                  paymentPending
                                    ? "text-amber-800 dark:text-amber-200"
                                    : "text-gray-900 dark:text-white"
                                }`}
                              >
                                Rs. {orderGrandTotal(order).toLocaleString()}
                              </span>
                            </div>
                            {paymentPending && (
                              <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-2">
                                Hand in cash at the shop — still marked &quot;To be paid&quot; in POS
                              </p>
                            )}
                            {order.customerName && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400">
                                <User className="w-3 h-3" />
                                {order.customerName}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════ NEW ORDER TAB ══════ */}
          {tab === TABS.NEW_ORDER && sessionGateChecked && noActiveSession && (
            <div className="flex flex-col h-full items-center justify-center p-8 text-center gap-5">
              <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center">
                <Sun className="w-8 h-8 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  Business Day Not Started
                </h2>
                <p className="text-sm text-gray-500 dark:text-neutral-400 leading-relaxed">
                  The business day hasn't been opened yet. You can't place new orders until a manager starts it.
                </p>
              </div>
            </div>
          )}

          {tab === TABS.NEW_ORDER && (!sessionGateChecked || !noActiveSession) && (
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
                      {dealMenuItems.length > 0 && (
                        <CategoryPill
                          active={selectedCategory === "deals"}
                          onClick={() => setSelectedCategory("deals")}
                          label={`Deals (${dealMenuItems.length})`}
                        />
                      )}
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
                          const price = item.isDeal
                            ? item.price ?? 0
                            : item.finalPrice ?? item.price ?? 0;
                          const outOfStock =
                            !item.isDeal &&
                            (item.inventorySufficient === false || item.inventorySufficient === "false");
                          return (
                            <div
                              key={item.id || item._id}
                              className={`group relative flex flex-col rounded-2xl overflow-hidden border shadow-sm transition-all ${
                                outOfStock
                                  ? "border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950"
                                  : "border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 active:scale-[0.97]"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => !outOfStock && addToCart(item)}
                                disabled={outOfStock}
                                className="w-full text-left disabled:cursor-not-allowed"
                                aria-disabled={outOfStock}
                              >
                                {/* Image: match POS — grayscale photo, dim layer, centered red badge (badge stays full-opacity) */}
                                <div
                                  className="relative w-full aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-50 dark:from-neutral-900 dark:to-neutral-800 overflow-hidden"
                                >
                                  <div
                                    className={`absolute inset-0 ${outOfStock ? "opacity-60" : ""}`}
                                    aria-hidden
                                  >
                                    {item.isDeal && !outOfStock && (
                                      <div className="absolute top-1.5 left-1.5 z-[2] flex items-center gap-0.5 rounded-md bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
                                        <Tag className="w-2.5 h-2.5" />
                                        Deal
                                      </div>
                                    )}
                                    {item.imageUrl ? (
                                      <img
                                        src={item.imageUrl}
                                        alt={item.name}
                                        className={`w-full h-full object-cover ${outOfStock ? "grayscale" : ""}`}
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-3xl">
                                        <Utensils
                                          className={`w-8 h-8 text-gray-300 dark:text-neutral-700 ${outOfStock ? "grayscale opacity-70" : ""}`}
                                        />
                                      </div>
                                    )}
                                  </div>
                                  {outOfStock && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 pointer-events-none">
                                      <span className="px-2.5 py-1 rounded-md bg-red-600 text-white text-[10px] sm:text-[11px] font-bold shadow-md">
                                        Out of Stock
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className={`p-2 flex flex-col ${outOfStock ? "opacity-60" : ""}`}>
                                  <h3
                                    className={`text-xs font-bold mb-1 line-clamp-2 ${
                                      outOfStock ? "text-gray-400 dark:text-neutral-500" : "text-gray-900 dark:text-white"
                                    }`}
                                  >
                                    {item.name}
                                  </h3>
                                  <div className="flex items-center justify-between">
                                    <span
                                      className={`text-sm font-bold ${outOfStock ? "text-gray-400" : "text-primary"}`}
                                    >
                                      Rs {price.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </button>

                              {qty > 0 && !outOfStock && (
                                <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 dark:border-neutral-700/50 px-1 py-0.5">
                                  <button type="button" onClick={(e) => { e.stopPropagation(); updateQty(item.id, -1); }} className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800">
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="w-5 text-center text-xs font-black text-primary">{qty}</span>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); addToCart(item); }} className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform text-primary hover:bg-primary/10">
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                              {qty === 0 && !outOfStock && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); addToCart(item); }} className="absolute top-2 right-2 w-8 h-8 rounded-xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm shadow-md flex items-center justify-center active:scale-90 transition-transform border border-gray-200/50 dark:border-neutral-700/50">
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
                <div className="p-3 pb-32">
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
                      {/* Compact cart items */}
                      <div className="space-y-1.5 mb-3">
                        {cart.map((item) => (
                          <div key={item.id} className="flex items-center gap-2.5 bg-white dark:bg-neutral-950 rounded-xl p-1.5">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-neutral-900 flex items-center justify-center flex-shrink-0">
                                <Utensils className="w-4 h-4 text-gray-300 dark:text-neutral-700" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold truncate leading-tight">{item.name}</p>
                              <p className="text-xs font-bold text-primary">{sym} {(item.price * item.quantity).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center bg-gray-100 dark:bg-neutral-900 rounded-lg">
                              <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center active:scale-90 transition-transform">
                                {item.quantity === 1 ? <Trash2 className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-gray-500" />}
                              </button>
                              <span className="w-6 text-center text-sm font-black">{item.quantity}</span>
                              <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center active:scale-90 transition-transform">
                                <Plus className="w-3 h-3 text-primary" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Customer section */}
                      <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-sm">
                        {/* Section header */}
                        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2 rounded-t-2xl">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black transition-colors ${customerPhone ? "bg-emerald-500 text-white" : "bg-gray-200 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400"}`}>
                            {customerPhone ? <Check className="w-3 h-3" /> : "2"}
                          </div>
                          <p className="text-xs font-bold dark:text-neutral-300">Customer Details</p>
                          {customerPhone && (
                            <span className="ml-auto text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Selected</span>
                          )}
                        </div>

                        <div className="p-3 space-y-3">
                          {/* Delivery area combobox */}
                          {deliveryZones.length > 0 && (() => {
                            const selectedZone = deliveryZones.find((z) => z.id === deliveryLocationId);
                            const filteredZones = deliveryZones.filter((z) =>
                              !zoneQuery.trim() || z.name.toLowerCase().includes(zoneQuery.trim().toLowerCase())
                            );
                            return (
                              <div ref={zoneRef} className="relative">
                                <button
                                  type="button"
                                  onClick={() => { setZoneOpen((v) => !v); setZoneQuery(""); }}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors text-left ${deliveryLocationId ? "bg-primary/5 dark:bg-primary/10 border-primary/25 dark:border-primary/20" : "bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800"}`}
                                >
                                  <MapPin className={`w-4 h-4 flex-shrink-0 ${deliveryLocationId ? "text-primary" : "text-gray-400"}`} />
                                  <span className={`flex-1 text-sm font-medium truncate ${selectedZone ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-neutral-500"}`}>
                                    {selectedZone ? `${selectedZone.name} — ${sym} ${selectedZone.fee.toFixed(2)}` : "Select delivery area *"}
                                  </span>
                                  <ChevronDown className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ${zoneOpen ? "rotate-180" : ""}`} />
                                </button>

                                {zoneOpen && (
                                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white dark:bg-neutral-950 rounded-xl shadow-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
                                    <div className="p-2 border-b border-gray-100 dark:border-neutral-800">
                                      <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                        <input
                                          autoFocus
                                          type="text"
                                          value={zoneQuery}
                                          onChange={(e) => setZoneQuery(e.target.value)}
                                          placeholder="Search area…"
                                          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-100 dark:bg-neutral-900 text-sm font-medium placeholder:text-gray-400 outline-none border-0"
                                        />
                                      </div>
                                    </div>
                                    <ul className="max-h-44 overflow-y-auto rider-no-scrollbar py-1">
                                      {filteredZones.length === 0 ? (
                                        <li className="px-3 py-3 text-xs text-gray-400 dark:text-neutral-500 text-center">No areas match</li>
                                      ) : filteredZones.map((z) => (
                                        <li key={z.id}>
                                          <button
                                            type="button"
                                            onClick={() => { setDeliveryLocationId(z.id); setZoneOpen(false); setZoneQuery(""); }}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors text-left ${z.id === deliveryLocationId ? "bg-primary/10 dark:bg-primary/20 text-primary font-bold" : "text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900 font-medium"}`}
                                          >
                                            <span>{z.name}</span>
                                            <span className={`text-xs tabular-nums ${z.id === deliveryLocationId ? "text-primary" : "text-gray-400 dark:text-neutral-500"}`}>{sym} {z.fee.toFixed(2)}</span>
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* ── Customer selected state ── */}
                          {customerPhone && !customerSearch ? (
                            <div className="space-y-2">
                              {/* Selected customer card */}
                              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                  <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{customerName || "—"}</p>
                                  <p className="text-xs text-gray-500 dark:text-neutral-400">{customerPhone}{deliveryAddress ? ` · ${deliveryAddress}` : ""}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => { setCustomerName(""); setCustomerPhone(""); setDeliveryAddress(""); setCustomersLoaded(false); setShowCustomerEdit(false); }}
                                  className="text-[11px] font-bold text-gray-400 hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0"
                                >
                                  Change
                                </button>
                              </div>

                              {/* Edit toggle */}
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setShowCustomerEdit((v) => !v)}
                                  className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 dark:text-neutral-500 hover:text-primary dark:hover:text-primary transition-colors py-0.5 px-1 rounded"
                                >
                                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showCustomerEdit ? "rotate-180" : ""}`} />
                                  {showCustomerEdit ? "Hide details" : "Edit customer details"}
                                </button>
                              </div>

                              {/* Collapsible editable fields */}
                              {showCustomerEdit && (
                                <div className="space-y-2 pt-1">
                                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name *" className="w-full px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-900 text-sm font-medium placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary/20 border-0" />
                                  <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone *" className="w-full px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-900 text-sm font-medium placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary/20 border-0" />
                                  <textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder={deliveryZonesActive ? "Address / notes (optional)" : "Delivery address *"} rows={2} className="w-full px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-900 text-sm font-medium placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary/20 border-0 resize-none" />
                                </div>
                              )}
                            </div>
                          ) : (
                            /* ── Search / Add flow ── */
                            <div>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="tel"
                                  value={customerSearch}
                                  placeholder="Search by phone number…"
                                  onChange={(e) => { setCustomerSearch(e.target.value); setCustomersError(""); }}
                                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-900 text-sm font-medium placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary/20 border-0"
                                />
                              </div>

                              {customersLoading ? (
                                <div className="flex items-center justify-center py-5">
                                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                </div>
                              ) : (() => {
                                const term = customerSearch.trim();
                                const filtered = customersList.filter((c) => term ? (c.phone || "").includes(term) : false);

                                if (!term) {
                                  return (
                                    <p className="text-xs text-gray-400 dark:text-neutral-500 text-center py-3">
                                      Type a phone number to find or add a customer
                                    </p>
                                  );
                                }

                                if (filtered.length > 0) {
                                  return (
                                    <ul className="mt-2 space-y-1 max-h-36 overflow-y-auto rider-no-scrollbar">
                                      {filtered.map((c) => (
                                        <li key={c.id}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (!deliveryZonesActive && !c.address?.trim()) {
                                                selectCustomerForOrder(c);
                                                toast("No address on file — please enter one below", { icon: "📍" });
                                              } else {
                                                selectCustomerForOrder(c);
                                              }
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-neutral-900 hover:bg-primary/5 dark:hover:bg-primary/10 text-left transition-colors border border-transparent hover:border-primary/20"
                                          >
                                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                              <User className="w-3.5 h-3.5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{c.name}</p>
                                              <p className="text-xs text-gray-400 dark:text-neutral-500 truncate">{c.phone}{c.address ? ` · ${c.address}` : ""}</p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-neutral-600 flex-shrink-0" />
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  );
                                }

                                /* No match — inline add form */
                                return (
                                  <div className="mt-2 p-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-dashed border-gray-300 dark:border-neutral-700 space-y-2">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 flex items-center gap-1.5">
                                      <Plus className="w-3.5 h-3.5" />
                                      New customer · <span className="text-gray-700 dark:text-neutral-200 font-bold">{term}</span>
                                    </p>
                                    <input
                                      type="text"
                                      value={quickCustomerName}
                                      onChange={(e) => setQuickCustomerName(e.target.value)}
                                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm placeholder:text-gray-400 outline-none"
                                      placeholder="Full name *"
                                    />
                                    <input
                                      type="text"
                                      value={quickCustomerAddress}
                                      onChange={(e) => setQuickCustomerAddress(e.target.value)}
                                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm placeholder:text-gray-400 outline-none"
                                      placeholder={deliveryZonesActive ? "Address notes (optional)" : "Delivery address *"}
                                    />
                                    <button
                                      type="button"
                                      onClick={handleQuickAddCustomer}
                                      disabled={addingQuickCustomer}
                                      className="w-full py-2 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                                    >
                                      {addingQuickCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                      {addingQuickCustomer ? "Adding…" : "Add & Select"}
                                    </button>
                                  </div>
                                );
                              })()}

                              {customersError && <p className="text-xs text-red-500 mt-1.5">{customersError}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Floating Action Bars ───────────────────────────────────── */}
        {tab === TABS.NEW_ORDER && !noActiveSession && step === STEPS.MENU && cartBadge > 0 && (
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
                <span className="font-extrabold">Rs. {cartTotalDue.toLocaleString()}</span>
              </button>
            </div>
          </div>
        )}

        {tab === TABS.NEW_ORDER && !noActiveSession && step === STEPS.CART && cart.length > 0 && (
          <div className="fixed bottom-16 inset-x-0 z-20">
            <div className="bg-white dark:bg-neutral-950 border-t border-gray-100 dark:border-neutral-900 px-3 pt-2.5 pb-2.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Total</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight">{sym} {cartTotalDue.toLocaleString()}</p>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="text-[10px] text-gray-400 dark:text-neutral-500 leading-tight">
                      <p>Subtotal {sym} {subtotal.toLocaleString()}</p>
                      <p>Delivery {sym} {deliveryFee.toLocaleString()}</p>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Items</p>
                  <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight">{cartBadge}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(STEPS.MENU)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-neutral-900 font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5 text-gray-700 dark:text-neutral-300"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={placing}
                  className="flex-[2.5] py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-600/25"
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
            onClick={() => setTab(TABS.HOME)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
              tab === TABS.HOME ? "text-primary" : "text-gray-400 dark:text-neutral-500"
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] font-bold">Overview</span>
          </button>
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
            className={`relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${tab === TABS.HISTORY ? "text-primary" : "text-gray-400 dark:text-neutral-500"}`}
          >
            <span className="relative inline-flex">
              <ClipboardList className="w-5 h-5" />
              {riderPendingPaymentOrders.length > 0 && (
                <span className="absolute -right-1 -top-0.5 min-w-[14px] h-[14px] px-[3px] rounded-full bg-amber-500 text-[8px] font-black text-white flex items-center justify-center border border-white dark:border-black">
                  {riderPendingPaymentOrders.length > 9 ? "9+" : riderPendingPaymentOrders.length}
                </span>
              )}
            </span>
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
