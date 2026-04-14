import { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  getMenu,
  getBranchMenu,
  getOrders,
  createPosOrder,
  getOrder,
  updateOrder,
  recordOrderPayment,
  SubscriptionInactiveError,
  getDeals,
  getActiveDealsByBranch,
  findApplicableDeals,
  getStoredAuth,
  getPosDrafts,
  createPosDraft,
  updatePosDraft,
  deletePosDraft,
  getPosDraft,
  getPosTransactions,
  getPosTransaction,
  deletePosTransaction,
  getTables,
  getCustomers,
  createCustomer,
  updateCustomer,
  getBranch,
  updateBranch,
  getWebsiteSettings,
  getRestaurantSettings,
  getDiscountSettings,
  verifyDiscountPin,
  getUsers,
  getDaySessions,
  getCurrentDaySession,
  endDaySession,
  getPaymentAccounts,
} from "../../lib/apiClient";
import { printBillReceipt } from "../../lib/printBillReceipt";
import { getBusinessDate, formatBusinessDate } from "../../lib/businessDay";
import { useBranch } from "../../contexts/BranchContext";
import { useSocket } from "../../contexts/SocketContext";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Receipt,
  ClipboardList,
  CreditCard,
  Banknote,
  ChevronUp,
  ChevronDown,
  User,
  UserPlus,
  Loader2,
  CircleCheckBig,
  ChevronLeft,
  ChevronRight,
  Clock,
  Utensils,
  FileText,
  Printer,
  Flame,
  Star,
  Users,
  Percent,
  Tag,
  Sparkles,
  Settings,
  HelpCircle,
  Edit3,
  Power,
  X,
  Lock,
  Smartphone,
  MapPin,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";

function isBranchRequiredError(msg) {
  return (
    typeof msg === "string" &&
    msg.toLowerCase().includes("branchid") &&
    msg.toLowerCase().includes("required")
  );
}

const FALLBACK_POS_DISCOUNT_REASON_OPTIONS = [
  { value: "Customer complaint", label: "Customer complaint" },
  { value: "Staff meal", label: "Staff meal" },
  { value: "Loyalty reward", label: "Loyalty reward" },
  { value: "Manager approval", label: "Manager approval" },
  { value: "Other", label: "Other" },
];

const FALLBACK_POS_DISCOUNT_PRESETS = [
  { id: "10", label: "10% Off", percent: 10, cashierAllowed: true },
  { id: "20", label: "20% Off", percent: 20, cashierAllowed: true },
  { id: "staff50", label: "Staff Meal (50%)", percent: 50, cashierAllowed: false },
  { id: "comp100", label: "Complimentary (100%)", percent: 100, cashierAllowed: false },
];

/**
 * Same shape as GET /api/admin/orders/:id (mapOrder) for printBillReceipt when a follow-up fetch fails.
 * `total` must be food total after discount (excluding delivery); grandTotal includes delivery.
 */
function buildFallbackPrintOrderFromPosResult(result, ctx) {
  const {
    orderId,
    orderType,
    tableName,
    items,
    customerName,
    customerPhone,
    deliveryAddress,
    subtotal,
    discountAmount,
    deliveryCharges,
  } = ctx;
  const auth = getStoredAuth();
  const foodTotal =
    result.total != null && !Number.isNaN(Number(result.total))
      ? Number(result.total)
      : Math.max(0, (Number(subtotal) || 0) - (Number(discountAmount) || 0));
  const del =
    orderType === "DELIVERY" ? Math.max(0, Number(deliveryCharges) || 0) : 0;
  const type =
    orderType === "DINE_IN"
      ? "dine-in"
      : orderType === "TAKEAWAY"
        ? "takeaway"
        : "delivery";
  const due =
    result.amountDue != null && !Number.isNaN(Number(result.amountDue))
      ? Number(result.amountDue)
      : foodTotal + del;
  return {
    id: result.orderNumber || String(orderId || ""),
    _id: String(result.id || result._id || orderId || ""),
    customerName: customerName || "",
    customerPhone: customerPhone || "",
    deliveryAddress: deliveryAddress || "",
    tableName: orderType === "DINE_IN" && tableName ? tableName : "",
    items,
    subtotal,
    discountAmount: discountAmount || 0,
    deliveryCharges: del,
    total: foodTotal,
    grandTotal: due,
    type,
    paymentMethod: "To be paid",
    createdAt: result.createdAt || new Date().toISOString(),
    orderTakerName: auth?.user?.name || "",
  };
}

export default function POSView({
  editOrderId: propEditOrderId,
  onClose,
  onOrderChanged,
  isActive = true,
  initialTableName = "",
}) {
  const { currentBranch, branches, setCurrentBranch } = useBranch() || {};
  const { socket } = useSocket() || {};
  const [menu, setMenu] = useState({ categories: [], items: [] });
  const [cart, setCart] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  /** Ref avoids React treating the callback as a functional setState updater. */
  const pendingNavigationRef = useRef(null);
  const [editSessionDeliveryCharges, setEditSessionDeliveryCharges] =
    useState(0);
  const [printingMenu, setPrintingMenu] = useState(false);
  const [loadingEditOrder, setLoadingEditOrder] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [focusedItemIndex, setFocusedItemIndex] = useState(0);
  const focusedCardRef = useRef(null);
  const orderStripRef = useRef(null);
  const orderStripOffsetRef = useRef(0);
  const orderStripRafRef = useRef(null);
  const orderStripLastTimeRef = useRef(null);
  const orderStripPausedRef = useRef(false);
  const menuSearchInputRef = useRef(null);
  const orderSearchInputRef = useRef(null);
  const amountReceivedInputRef = useRef(null);
  const [gridCols, setGridCols] = useState(4);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  /** { id, name, fee } from getWebsiteSettings → deliveryLocations (branch-scoped) */
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [deliveryLocationId, setDeliveryLocationId] = useState("");
  const [deliveryZoneQuery, setDeliveryZoneQuery] = useState("");
  const [deliveryZoneOpen, setDeliveryZoneOpen] = useState(false);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [onlineProvider, setOnlineProvider] = useState(null);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [paymentAccountsLoading, setPaymentAccountsLoading] = useState(true);
  const [orderType, setOrderType] = useState("DINE_IN");
  const [manualDiscountPercent, setManualDiscountPercent] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [discountPresetLabel, setDiscountPresetLabel] = useState("");
  const [managerDiscountPin, setManagerDiscountPin] = useState("");
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [posDiscountPresetsCfg, setPosDiscountPresetsCfg] = useState(null);
  const [posDiscountReasonOptions, setPosDiscountReasonOptions] = useState(
    FALLBACK_POS_DISCOUNT_REASON_OPTIONS,
  );
  const [posDiscountPinConfigured, setPosDiscountPinConfigured] = useState(false);
  const [dmPct, setDmPct] = useState(0);
  const [dmLabel, setDmLabel] = useState("");
  const [dmReason, setDmReason] = useState("");
  const [dmPin, setDmPin] = useState("");
  const [dmPinError, setDmPinError] = useState("");
  const [dmCustomOpen, setDmCustomOpen] = useState(false);
  const [dmCustomStr, setDmCustomStr] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [suspended, setSuspended] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarHydrated, setSidebarHydrated] = useState(false);

  // New features from Dream POS
  const [dietaryFilter, setDietaryFilter] = useState("all"); // all, veg, non-veg, egg
  const [orderFilter, setOrderFilter] = useState("all"); // all, dine-in, takeaway, delivery
  const [recentOrderSearch, setRecentOrderSearch] = useState(""); // search by order ID
  const [selectedWaiter, setSelectedWaiter] = useState("");
  const [orderTakers, setOrderTakers] = useState([]);
  const [tableNumber, setTableNumber] = useState("");
  const [tableName, setTableName] = useState("");
  const [tables, setTables] = useState([]);
  const [itemNotes, setItemNotes] = useState({}); // { itemId: "note text" }
  const [recentOrders, setRecentOrders] = useState([]);
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
  const [focusedOrderIndex, setFocusedOrderIndex] = useState(0);
  const [orderGridHovered, setOrderGridHovered] = useState(false);
  const [orderColsCount, setOrderColsCount] = useState(4);

  // Deals integration
  const [availableDeals, setAvailableDeals] = useState([]);
  const [selectedDeals, setSelectedDeals] = useState([]);
  const [showDealsSection, setShowDealsSection] = useState(false);
  const [applicableDeals, setApplicableDeals] = useState([]);
  const [dealDiscount, setDealDiscount] = useState(0);

  // Expanded cart items (for showing price details)
  const [expandedCartItems, setExpandedCartItems] = useState([]);

  // Print receipt modal
  const [showPrintModal, setShowPrintModal] = useState(false);

  // POS optional fields visibility (per branch); not shown until loaded to avoid flash on reload
  const [showTablePos, setShowTablePos] = useState(true);
  const [showWaiterPos, setShowWaiterPos] = useState(true);
  const [showCustomerPos, setShowCustomerPos] = useState(true);
  const [posOptionsLoaded, setPosOptionsLoaded] = useState(false);
  const [showPosTableSettingsModal, setShowPosTableSettingsModal] =
    useState(false);
  const [posTableSettingsDraft, setPosTableSettingsDraft] = useState(true);
  const [posWaiterSettingsDraft, setPosWaiterSettingsDraft] = useState(true);
  const [posCustomerSettingsDraft, setPosCustomerSettingsDraft] =
    useState(true);
  const [posTableSettingsSaving, setPosTableSettingsSaving] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Invoice modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Branch selection modal (shown when branchId is required)
  const [showBranchModal, setShowBranchModal] = useState(false);

  // Business day (computed from branch day-reset hour)
  const cutoffHour = currentBranch?.businessDayCutoffHour ?? 4;
  const businessDate = getBusinessDate(new Date(), cutoffHour);

  // Legacy session history (read-only, for browsing past sessions)
  const [showDayHistoryModal, setShowDayHistoryModal] = useState(false);
  const [daySessionHistory, setDaySessionHistory] = useState([]);
  const [loadingDayHistory, setLoadingDayHistory] = useState(false);

  // End Day
  const [showEndDayModal, setShowEndDayModal] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [loadingCurrentSession, setLoadingCurrentSession] = useState(false);
  const [endingDay, setEndingDay] = useState(false);

  // Draft management
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [transactionTab, setTransactionTab] = useState("sale"); // 'sale' or 'draft'
  const [drafts, setDrafts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  // Take payment modal (Cash/Card)
  const [showTakePaymentModal, setShowTakePaymentModal] = useState(false);
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Customer modal (select or add)
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const pendingDeliveryCheckoutRef = useRef(false);
  const [customerModalMode, setCustomerModalMode] = useState("select"); // 'select' | 'add'
  const [customersList, setCustomersList] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerModalLoading, setCustomerModalLoading] = useState(false);
  const [customerModalError, setCustomerModalError] = useState("");
  const [customerAddForm, setCustomerAddForm] = useState({
    name: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [addingQuickCustomer, setAddingQuickCustomer] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [editCustomerForm, setEditCustomerForm] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Restaurant logo (shared across branches, used in printed bills)
  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState("");
  const [restaurantLogoHeight, setRestaurantLogoHeight] = useState(100);
  const [restaurantBillFooter, setRestaurantBillFooter] = useState(
    "Thank you for your order!",
  );

  // Client-only clock — avoids SSR/hydration mismatch for any date rendered in JSX
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Check sidebar state from sessionStorage before showing grid (so reload with closed sidebar → 5 cols)
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const collapsed = sessionStorage.getItem("sidebar_collapsed") === "true";
    setSidebarOpen(!collapsed);
    setSidebarHydrated(true);
  }, []);

  // Load payment accounts (for online payment provider selection)
  useEffect(() => {
    let cancelled = false;
    setPaymentAccountsLoading(true);
    getPaymentAccounts()
      .then((d) => {
        if (!cancelled)
          setPaymentAccounts(Array.isArray(d) ? d : (d?.accounts ?? []));
      })
      .catch(() => {
        if (!cancelled) setPaymentAccounts([]);
      })
      .finally(() => {
        if (!cancelled) setPaymentAccountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load shared restaurant logo (for printed bills)
  useEffect(() => {
    let cancelled = false;
    getRestaurantSettings()
      .then((data) => {
        if (cancelled) return;
        const url = data?.restaurantLogoUrl || "";
        setRestaurantLogoUrl(url);
        const height =
          typeof data?.restaurantLogoHeightPx === "number"
            ? data.restaurantLogoHeightPx
            : 100;
        setRestaurantLogoHeight(height);
        setRestaurantBillFooter(
          data?.billFooterMessage || "Thank you for your order!",
        );
        setPosDiscountPresetsCfg(
          Array.isArray(data?.posDiscountPresets) && data.posDiscountPresets.length
            ? data.posDiscountPresets
            : null,
        );
        setPosDiscountPinConfigured(Boolean(data?.posDiscountPinConfigured));
      })
      .catch(() => {
        // Ignore logo load errors; printing will just fall back to text
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDiscountSettings()
      .then((data) => {
        if (cancelled) return;
        console.log(
          "Discount presets loaded:",
          JSON.stringify(data?.presets || [], null, 2),
        );
        if (Array.isArray(data?.presets) && data.presets.length > 0) {
          setPosDiscountPresetsCfg(
            data.presets.map((p) => {
              const requiresPin =
                p?.requiresPin !== undefined
                  ? Boolean(p.requiresPin)
                  : !Boolean(p?.cashierAllowed);
              return {
                ...p,
                requiresPin,
                cashierAllowed: !requiresPin,
              };
            }),
          );
        }
        if (Array.isArray(data?.reasons) && data.reasons.length > 0) {
          setPosDiscountReasonOptions(
            data.reasons.map((label) => ({
              value: String(label).trim(),
              label: String(label).trim(),
            })),
          );
        }
        setPosDiscountPinConfigured(Boolean(data?.pinIsSet));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadMenu();
    loadActiveDeals();
    loadDrafts();
    loadTransactions();
    loadTables();
    loadRecentOrders();

    // Listen for sidebar toggle events from AdminLayout
    function handleSidebarToggle(e) {
      setSidebarOpen(!e.detail.collapsed);
    }
    window.addEventListener("sidebar-toggle", handleSidebarToggle);
    return () =>
      window.removeEventListener("sidebar-toggle", handleSidebarToggle);
  }, [currentBranch]);

  useEffect(() => {
    if (!socket) return;
    const onOrderEvent = () => loadRecentOrders();
    socket.on("order:created", onOrderEvent);
    socket.on("order:updated", onOrderEvent);
    return () => {
      socket.off("order:created", onOrderEvent);
      socket.off("order:updated", onOrderEvent);
    };
  }, [socket]);

  // Load POS options (table/waiter/customer visibility) for current branch; don't show until loaded to avoid flash
  useEffect(() => {
    if (!currentBranch?.id) {
      setShowTablePos(true);
      setShowWaiterPos(true);
      setShowCustomerPos(true);
      setPosOptionsLoaded(true);
      return;
    }
    setPosOptionsLoaded(false);
    let cancelled = false;
    getBranch(currentBranch.id)
      .then((b) => {
        if (!cancelled) {
          setShowTablePos(b?.showTablePos !== false);
          setShowWaiterPos(b?.showWaiterPos !== false);
          setShowCustomerPos(b?.showCustomerPos !== false);
          setPosOptionsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShowTablePos(true);
          setShowWaiterPos(true);
          setShowCustomerPos(true);
          setPosOptionsLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentBranch?.id]);

  // Derive delivery zones directly from the current branch (already loaded by BranchContext)
  useEffect(() => {
    if (!isActive) {
      setDeliveryZones([]);
      setDeliveryLocationId("");
      return;
    }
    const raw = Array.isArray(currentBranch?.deliveryLocations)
      ? currentBranch.deliveryLocations
      : [];
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
    setDeliveryLocationId((prev) => {
      if (prev && mapped.some((m) => m.id === prev)) return prev;
      return "";
    });
  }, [currentBranch?.id, currentBranch?.deliveryLocations, isActive]);

  useEffect(() => {
    let cancelled = false;
    getUsers()
      .then((users) => {
        if (cancelled) return;
        const branchId = currentBranch?.id;
        const takers = users.filter((u) => {
          if (u.role !== "order_taker") return false;
          if (!branchId) return true;
          return (u.branches || []).some(
            (b) => String(b.branchId || b.branch) === String(branchId),
          );
        });
        setOrderTakers(takers);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentBranch?.id]);

  useEffect(() => {
    setCurrentOrderIndex(0);
  }, [orderFilter]);

  useEffect(() => {
    setCurrentOrderIndex(0);
  }, [recentOrderSearch]);

  useEffect(() => {
    focusedCardRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [focusedItemIndex]);

  // Until we've read sessionStorage, assume sidebar closed (5 cols). Then use sidebarOpen.
  const effectiveSidebarOpen = sidebarHydrated ? sidebarOpen : false;

  // Match grid columns to Tailwind: sidebarOpen ? grid-cols-3 xl:grid-cols-4 : grid-cols-4 xl:grid-cols-5
  useEffect(() => {
    const updateCols = () => {
      if (typeof window === "undefined") return;
      const xl = window.innerWidth >= 1280;
      setGridCols(effectiveSidebarOpen ? (xl ? 4 : 3) : xl ? 5 : 4);
    };
    updateCols();
    window.addEventListener("resize", updateCols);
    return () => window.removeEventListener("resize", updateCols);
  }, [effectiveSidebarOpen]);

  const resetEditOrderState = () => {
    setEditingOrderId(null);
    setEditingOrder(null);
    setEditSessionDeliveryCharges(0);
    setCart([]);
    setExpandedCartItems([]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setDeliveryLocationId("");
    setManualDiscountPercent(0);
    setDiscountReason("");
    setDiscountPresetLabel("");
    setManagerDiscountPin("");
    setSelectedDeals([]);
    setDealDiscount(0);
    setShowCustomerDetails(false);
    setTableName("");
    setShowCheckout(false);
  };

  /** Called from the "Clear all" button in the cart sidebar. Shows a toast; wraps clearCart(). */
  function clearAllCartItems() {
    if (cart.length === 0) return;
    clearCart();
    setExpandedCartItems([]);
    toast.success("Cart cleared");
  }

  const handleNavigateAwayFromEdit = (callback) => {
    if (editingOrderId) {
      pendingNavigationRef.current = callback;
      setShowDiscardDialog(true);
      return;
    }
    callback();
  };

  // Pre-fill table name when opened from Tables page via initialTableName prop
  useEffect(() => {
    if (isActive && initialTableName && !propEditOrderId) {
      setTableName(initialTableName);
      setOrderType("DINE_IN");
    }
  }, [isActive, initialTableName, propEditOrderId]);

  // Load order for edit when editOrderId prop is provided
  useEffect(() => {
    const editId = propEditOrderId;
    if (!editId || !menu?.items?.length) return;

    let cancelled = false;
    setLoadingEditOrder(true);

    getOrder(editId)
      .then((order) => {
        if (cancelled) return;
        const items = order.items || [];
        const menuItems = menu.items || [];
        const cartItems = items.map((it) => {
          const menuItemId = it.menuItemId || null;
          let id = menuItemId;
          let price = it.unitPrice ?? 0;
          let imageUrl = "";
          if (!id) {
            const byName = menuItems.find(
              (m) =>
                (m.name || "").toLowerCase() === (it.name || "").toLowerCase(),
            );
            if (byName) {
              id = byName.id;
              price = byName.finalPrice ?? byName.price ?? price;
              imageUrl = byName.imageUrl || "";
            } else {
              id = `edit-${it.name}-${Math.random().toString(36).slice(2)}`;
            }
          } else {
            const mi = menuItems.find((m) => (m.id || m._id) === id);
            if (mi) {
              imageUrl = mi.imageUrl || "";
              price = mi.finalPrice ?? mi.price ?? price;
            }
          }
          return {
            id,
            name: it.name,
            price,
            quantity: it.qty ?? 1,
            imageUrl,
          };
        });
        setCart(cartItems);
        setCustomerName(order.customerName || "");
        setCustomerPhone(order.customerPhone || "");
        setCustomerAddress(order.deliveryAddress || "");
        setOrderType(
          order.orderType === "TAKEAWAY" || order.type === "takeaway"
            ? "TAKEAWAY"
            : order.orderType === "DELIVERY" || order.type === "delivery"
              ? "DELIVERY"
              : "DINE_IN",
        );
        setDeliveryLocationId(order.deliveryLocationId || "");
        setEditSessionDeliveryCharges(
          Math.max(0, Number(order.deliveryCharges) || 0),
        );
        setTableName(order.tableName || "");
        const mp = Number(order.posManualDiscountPercent);
        if (Number.isFinite(mp) && mp > 0) {
          setManualDiscountPercent(Math.min(100, Math.max(0, mp)));
          setDiscountReason(String(order.posDiscountReason || "").trim());
          setDiscountPresetLabel(String(order.posDiscountPresetLabel || "").trim());
        } else {
          setManualDiscountPercent(0);
          setDiscountReason("");
          setDiscountPresetLabel("");
        }
        setManagerDiscountPin("");
        setEditingOrderId(order.id || order._id);
        setEditingOrder(order);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err.message || "Failed to load order");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingEditOrder(false);
      });

    return () => {
      cancelled = true;
    };
  }, [propEditOrderId, menu?.items?.length]);

  async function loadTables() {
    try {
      const data = await getTables();
      setTables(Array.isArray(data) ? data : []);
    } catch (err) {
      setTables([]);
    }
  }

  async function loadCustomersForModal() {
    setCustomerModalLoading(true);
    setCustomerModalError("");
    try {
      const list = await getCustomers({ forPos: true, allBranches: false });
      setCustomersList(Array.isArray(list) ? list : []);
    } catch (err) {
      setCustomerModalError(err.message || "Failed to load customers");
      setCustomersList([]);
    } finally {
      setCustomerModalLoading(false);
    }
  }

  function openCustomerModal() {
    setShowCustomerModal(true);
    setCustomerModalMode("select");
    setCustomerSearch("");
    setCustomerModalError("");
    setCustomerAddForm({ name: "", phone: "", address: "", notes: "" });
    setQuickCustomerName("");
    setAddingQuickCustomer(false);
    loadCustomersForModal();
  }

  function closeCustomerModal() {
    setShowCustomerModal(false);
    setCustomerModalError("");
    setEditingCustomerId(null);
    pendingDeliveryCheckoutRef.current = false;
  }

  function selectCustomerForOrder(customer) {
    setCustomerName(customer.name || "");
    setCustomerPhone(customer.phone || "");
    setCustomerAddress(customer.address || "");
    const shouldCheckout = pendingDeliveryCheckoutRef.current;
    closeCustomerModal();
    const canAutoCheckout =
      customer.phone &&
      (deliveryZonesActive ? deliveryLocationId : customer.address);
    if (shouldCheckout && canAutoCheckout) {
      handleCheckout({
        customerName: customer.name || "",
        customerPhone: customer.phone || "",
        customerAddress: customer.address || "",
      });
    }
  }

  async function handleAddCustomerSubmit(e) {
    e.preventDefault();
    const { name, phone, address, notes } = customerAddForm;
    if (!name?.trim() || !phone?.trim()) {
      setCustomerModalError("Name and phone are required");
      return;
    }
    setCustomerModalLoading(true);
    setCustomerModalError("");
    try {
      const created = await createCustomer({
        name: name.trim(),
        phone: phone.trim(),
        address: (address || "").trim() || undefined,
        notes: (notes || "").trim() || undefined,
      });
      selectCustomerForOrder(created);
      toast.success("Customer added");
    } catch (err) {
      setCustomerModalError(err.message || "Failed to add customer");
    } finally {
      setCustomerModalLoading(false);
    }
  }

  async function handleQuickAddCustomer() {
    const phone = customerSearch.trim();
    const name = quickCustomerName.trim();
    if (!phone || !name) {
      setCustomerModalError("Enter customer name and phone to add");
      return;
    }
    if (
      orderType === "DELIVERY" &&
      deliveryZones.length > 0 &&
      !deliveryLocationId
    ) {
      setCustomerModalError("Select a delivery area");
      return;
    }
    // Resolve zone name as the customer address for tracking area stats
    const selectedZone = deliveryZones.find((z) => z.id === deliveryLocationId);
    const address = selectedZone ? selectedZone.name : undefined;
    setAddingQuickCustomer(true);
    setCustomerModalError("");
    try {
      const created = await createCustomer({
        name,
        phone,
        address,
      });
      // Optimistically add to list and select
      setCustomersList((prev) => [created, ...prev]);
      selectCustomerForOrder(created);
      toast.success("Customer added");
    } catch (err) {
      setCustomerModalError(err.message || "Failed to add customer");
    } finally {
      setAddingQuickCustomer(false);
    }
  }

  function openTakePaymentModal(method) {
    setPaymentMethod(method);
    setOnlineProvider(null);
    setAmountReceived("");
    setPaymentError("");
    setShowTakePaymentModal(true);
  }

  function closeTakePaymentModal() {
    setShowTakePaymentModal(false);
    setOnlineProvider(null);
    setPaymentError("");
  }

  // Focus "Amount received" input when Take payment modal opens (e.g. via Ctrl+Shift+C)
  useEffect(() => {
    if (!showTakePaymentModal || paymentMethod !== "CASH") return;
    const t = setTimeout(() => amountReceivedInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [showTakePaymentModal, paymentMethod]);

  async function handleTakePaymentSubmit(e) {
    e.preventDefault();
    if (cart.length === 0) {
      setPaymentError("Cart is empty");
      return;
    }
    if (!validatePosDiscountForSubmit()) return;
    if (orderType === "DELIVERY" && !customerPhone.trim()) {
      setPaymentError("Customer phone is required for delivery orders");
      return;
    }
    if (
      orderType === "DELIVERY" &&
      deliveryZonesActive &&
      !deliveryLocationId.trim()
    ) {
      setPaymentError("Select a delivery area");
      return;
    }
    if (
      orderType === "DELIVERY" &&
      !deliveryZonesActive &&
      !customerAddress.trim()
    ) {
      setPaymentError("Delivery address is required for delivery orders");
      return;
    }
    const billTotal = amountDue;
    if (paymentMethod === "CASH") {
      const received = Number(amountReceived);
      if (isNaN(received) || received < billTotal) {
        setPaymentError(
          `Amount received must be at least Rs ${billTotal.toFixed(2)}`,
        );
        return;
      }
    }
    setPaymentLoading(true);
    setPaymentError("");
    const toastId = toast.loading("Processing...");
    try {
      let orderNum = "";

      if (editingOrderId) {
        // Edit mode: update the existing order's items first, then record payment on it
        await updateOrder(editingOrderId, {
          items: cart.map((item) => ({
            menuItemId: String(item.id).startsWith("edit-") ? null : item.id,
            quantity: item.quantity,
            unitPrice: item.price,
            name: item.name,
          })),
          discountAmount: totalDiscount,
          ...buildPosDiscountApiFields(),
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          deliveryAddress: customerAddress.trim(),
          orderType,
          tableName:
            orderType === "DINE_IN" && tableName ? tableName : undefined,
          ...(orderType === "DELIVERY" ? { deliveryCharges: deliveryFee } : {}),
        });
        const receivedAmt =
          paymentMethod === "CASH" ? Number(amountReceived) : undefined;
        const returnedAmt =
          paymentMethod === "CASH"
            ? Math.max(0, Number(amountReceived) - amountDue)
            : undefined;
        await recordOrderPayment(editingOrderId, {
          paymentMethod,
          ...(receivedAmt != null ? { amountReceived: receivedAmt } : {}),
          ...(returnedAmt != null ? { amountReturned: returnedAmt } : {}),
          ...(paymentMethod === "ONLINE" && onlineProvider
            ? { paymentProvider: onlineProvider }
            : {}),
        });
        orderNum =
          editingOrder?.orderNumber ?? editingOrder?.id ?? editingOrderId;
        toast.success("Order updated and payment recorded", { id: toastId });
      } else {
        // New order: create and pay in one shot
        const result = await createPosOrder({
          items: cart.map((item) => ({
            menuItemId: item.id,
            quantity: item.quantity,
          })),
          orderType,
          paymentMethod,
          discountAmount: totalDiscount,
          ...buildPosDiscountApiFields(),
          appliedDeals:
            selectedDeals.length > 0
              ? selectedDeals.map((dealId) => {
                  const deal = applicableDeals.find((d) => d.id === dealId);
                  return {
                    dealId,
                    dealName: deal?.name || "",
                    dealType: deal?.dealType || "",
                  };
                })
              : undefined,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          deliveryAddress: customerAddress.trim(),
          ...(orderType === "DELIVERY" && deliveryLocationId
            ? { deliveryLocationId }
            : {}),
          branchId: currentBranch?.id ?? undefined,
          tableName:
            orderType === "DINE_IN" && tableName ? tableName : undefined,
          ...(paymentMethod === "CASH" && amountReceived !== ""
            ? { amountReceived: Number(amountReceived) }
            : {}),
          ...(paymentMethod === "ONLINE" && onlineProvider
            ? { paymentProvider: onlineProvider }
            : {}),
          ...(orderType === "DELIVERY" ? { deliveryCharges: deliveryFee } : {}),
        });
        orderNum = result?.orderNumber ?? result?.id ?? "";
        toast.success("Order placed and payment recorded", { id: toastId });
      }

      const received =
        paymentMethod === "CASH" ? Number(amountReceived) : billTotal;
      const returned =
        paymentMethod === "CASH" ? Math.max(0, received - billTotal) : 0;
      printPaymentBill({
        orderNumber: orderNum,
        id: orderNum,
        paymentMethod,
        paymentAmountReceived: received,
        paymentAmountReturned: returned,
        createdAt: new Date().toISOString(),
      });
      closeTakePaymentModal();
      setEditingOrderId(null);
      setEditingOrder(null);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDeliveryLocationId("");
      setManualDiscountPercent(0);
      setDiscountReason("");
      setDiscountPresetLabel("");
      setManagerDiscountPin("");
      setSelectedDeals([]);
      setDealDiscount(0);
      setShowCustomerDetails(false);
      setTableName("");
      loadRecentOrders();
      if (onOrderChanged) onOrderChanged();
    } catch (err) {
      if (isBranchRequiredError(err.message) && branches?.length > 0) {
        toast.dismiss(toastId);
        setShowBranchModal(true);
      } else {
        setPaymentError(err.message || "Failed to process payment");
        toast.error(err.message || "Failed to process payment", {
          id: toastId,
        });
      }
    } finally {
      setPaymentLoading(false);
    }
  }

  // Check for applicable deals when cart changes
  useEffect(() => {
    if (cart.length > 0) {
      checkApplicableDeals();
    } else {
      setApplicableDeals([]);
      setSelectedDeals([]);
      setDealDiscount(0);
    }
  }, [cart, availableDeals]);

  async function loadMenu() {
    try {
      const auth = getStoredAuth();
      const restaurantId = auth?.user?.restaurantId;

      // Use branch-aware menu if branch is selected
      let data;
      if (currentBranch?.id && restaurantId) {
        data = await getBranchMenu(currentBranch.id, restaurantId);
      } else {
        data = await getMenu();
      }

      setMenu(data);
      setPageLoading(false);
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) {
        setSuspended(true);
      } else {
        console.error("Failed to load menu:", err);
        toast.error(err.message || "Failed to load menu");
      }
      setPageLoading(false);
    }
  }

  async function loadActiveDeals() {
    try {
      const branchId = currentBranch?.id;
      const allDeals = await getDeals(false);
      const deals = Array.isArray(allDeals)
        ? allDeals.filter((d) => {
            if (!d.isActive) return false;
            if (d.endDate && new Date(d.endDate) < new Date()) return false;
            // If deal has branch restrictions, only show for matching branch
            if (branchId && d.branches?.length > 0) {
              return d.branches.some(
                (b) => String(b._id || b) === String(branchId),
              );
            }
            return true;
          })
        : [];
      setAvailableDeals(deals);
    } catch (err) {
      console.error("Failed to load deals:", err);
      setAvailableDeals([]);
    }
  }

  async function checkApplicableDeals() {
    if (cart.length === 0) return;

    try {
      const orderItems = cart.map((item) => ({
        menuItemId: item.id,
        quantity: item.quantity,
        price: item.price,
      }));

      const deals = await findApplicableDeals(
        orderItems,
        subtotal,
        null, // customerId - can be added if tracking customer deals
        currentBranch?.id,
      );

      setApplicableDeals(Array.isArray(deals) ? deals : []);

      // Auto-select best deal if available and none manually selected
      if (deals && deals.length > 0 && selectedDeals.length === 0) {
        const bestDeal = deals[0]; // Assumes backend returns sorted by best discount
        if (bestDeal) {
          setSelectedDeals([bestDeal.id]);
          calculateDealDiscount([bestDeal]);
        }
      }
    } catch (err) {
      console.error("Failed to check applicable deals:", err);
      setApplicableDeals([]);
    }
  }

  function calculateDealDiscount(deals) {
    if (!deals || deals.length === 0) {
      setDealDiscount(0);
      return;
    }

    let totalDiscount = 0;

    deals.forEach((deal) => {
      switch (deal.dealType) {
        case "PERCENTAGE_DISCOUNT":
          totalDiscount += subtotal * (deal.discountPercentage / 100);
          break;
        case "FIXED_DISCOUNT":
          totalDiscount += deal.discountAmount;
          break;
        case "MINIMUM_PURCHASE":
          if (subtotal >= deal.minimumPurchase) {
            if (deal.discountPercentage) {
              totalDiscount += subtotal * (deal.discountPercentage / 100);
            } else if (deal.discountAmount) {
              totalDiscount += deal.discountAmount;
            }
          }
          break;
        // Add other deal type calculations as needed
        default:
          break;
      }
    });

    setDealDiscount(Math.min(totalDiscount, subtotal)); // Don't discount more than subtotal
  }

  function toggleDealSelection(dealId) {
    const deal = applicableDeals.find((d) => d.id === dealId);
    if (!deal) return;

    if (selectedDeals.includes(dealId)) {
      // Deselect
      const newSelected = selectedDeals.filter((id) => id !== dealId);
      setSelectedDeals(newSelected);
      const selectedDealObjects = applicableDeals.filter((d) =>
        newSelected.includes(d.id),
      );
      calculateDealDiscount(selectedDealObjects);
    } else {
      // Select (if stacking allowed, add to list; otherwise replace)
      const newSelected = deal.allowStacking
        ? [...selectedDeals, dealId]
        : [dealId];
      setSelectedDeals(newSelected);
      const selectedDealObjects = applicableDeals.filter((d) =>
        newSelected.includes(d.id),
      );
      calculateDealDiscount(selectedDealObjects);
    }
  }

  // Build virtual menu items for active combo deals so they appear at the end of the menu grid
  const dealMenuItems = (availableDeals || [])
    .filter((d) => d.dealType === "COMBO" && d.showOnPOS !== false)
    .map((d) => ({
      id: `deal-${d._id || d.id}`,
      name: d.name,
      price: d.comboPrice || 0,
      imageUrl: d.imageUrl || "",
      isDeal: true,
    }));

  const allItemsForGrid = [...menu.items, ...dealMenuItems];

  const filteredItems = allItemsForGrid.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" ||
      (selectedCategory === "deals"
        ? item.isDeal
        : item.categoryId === selectedCategory);
    const q = menuSearchQuery.trim().toLowerCase();
    const categoryName = (
      menu.categories.find((c) => c.id === item.categoryId)?.name || ""
    ).toLowerCase();
    const matchesSearch =
      !q || item.name.toLowerCase().includes(q) || categoryName.includes(q);

    // Dietary filter (mock - in production, items should have a dietaryType field)
    const matchesDietary =
      dietaryFilter === "all" ||
      (dietaryFilter === "veg" && item.name.toLowerCase().includes("veg")) ||
      (dietaryFilter === "non-veg" &&
        !item.name.toLowerCase().includes("veg")) ||
      (dietaryFilter === "egg" && item.name.toLowerCase().includes("egg"));

    // Use finalAvailable if available (branch-aware), otherwise fall back to available
    const isAvailable = item.isDeal
      ? true
      : (item.finalAvailable ?? item.available);
    return matchesCategory && matchesSearch && matchesDietary && isAvailable;
  });

  const filteredRecentOrders = recentOrders
    .filter((o) => orderFilter === "all" || o.type === orderFilter)
    .filter(
      (o) =>
        !recentOrderSearch.trim() ||
        (o.id &&
          String(o.id)
            .toLowerCase()
            .includes(recentOrderSearch.trim().toLowerCase())),
    );

  // Focus first order when search or filter changes
  useEffect(() => {
    setFocusedOrderIndex(0);
    setCurrentOrderIndex(0);
  }, [recentOrderSearch, orderFilter]);

  // Clamp focused order index when filtered list shrinks
  useEffect(() => {
    if (
      filteredRecentOrders.length > 0 &&
      focusedOrderIndex >= filteredRecentOrders.length
    ) {
      setFocusedOrderIndex(Math.max(0, filteredRecentOrders.length - 1));
    }
  }, [filteredRecentOrders.length, focusedOrderIndex]);

  // Keep pause state in ref so animation loop doesn't need to re-run when hover/search changes
  orderStripPausedRef.current =
    orderGridHovered || recentOrderSearch.trim() !== "";

  // Recent Orders visible columns: mobile ≈ 1.5 cards, desktop 4–5 cards
  useEffect(() => {
    const updateOrderCols = () => {
      if (typeof window === "undefined") return;
      const width = window.innerWidth;
      if (width < 768) {
        setOrderColsCount(1.5);
      } else {
        setOrderColsCount(effectiveSidebarOpen ? 4 : 5);
      }
    };
    updateOrderCols();
    window.addEventListener("resize", updateOrderCols);
    return () => window.removeEventListener("resize", updateOrderCols);
  }, [effectiveSidebarOpen]);

  // Scroll to focused order card when search is active
  useEffect(() => {
    const hasSearch = recentOrderSearch.trim() !== "";
    if (
      !hasSearch ||
      filteredRecentOrders.length === 0 ||
      !orderStripRef.current
    )
      return;
    const idx = Math.max(
      0,
      Math.min(focusedOrderIndex, filteredRecentOrders.length - 1),
    );
    const cardWidth = 164; // approx card width + gap
    orderStripRef.current.scrollLeft = idx * cardWidth;
  }, [recentOrderSearch, focusedOrderIndex, filteredRecentOrders.length]);

  // Clamp focused item index when filtered list shrinks
  useEffect(() => {
    if (filteredItems.length > 0 && focusedItemIndex >= filteredItems.length) {
      setFocusedItemIndex(Math.max(0, filteredItems.length - 1));
    }
  }, [filteredItems.length, focusedItemIndex]);

  const addToCart = (item, qty = 1) => {
    const quantity = Math.max(1, Math.floor(Number(qty)) || 1);
    const existingItem = cart.find((i) => i.id === item.id);
    const isDeal = item.isDeal;
    if (existingItem) {
      setCart(
        cart.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i,
        ),
      );
    } else {
      const itemPrice = isDeal ? item.price : (item.finalPrice ?? item.price);
      setCart([
        ...cart,
        {
          ...item,
          price: itemPrice,
          quantity,
        },
      ]);
    }
  };

  const updateQuantity = (itemId, change) => {
    setCart(
      cart
        .map((item) => {
          if (item.id === itemId) {
            const newQty = item.quantity + change;
            return { ...item, quantity: Math.max(0, newQty) };
          }
          return item;
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter((item) => item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setShowCheckout(false);
    setItemNotes({});
    setTableNumber("");
    setTableName("");
    setSelectedWaiter("");
    setSelectedDeals([]);
    setDealDiscount(0);
    setManualDiscountPercent(0);
    setDiscountReason("");
    setDiscountPresetLabel("");
    setManagerDiscountPin("");
  };

  const addNoteToItem = (itemId) => {
    const note = prompt("Add special instructions for this item:");
    if (note !== null) {
      setItemNotes((prev) => ({ ...prev, [itemId]: note.trim() }));
    }
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const maxManualDiscountAllowed = Math.max(0, subtotal - dealDiscount);
  const manualDiscountPercentClamped = Math.min(
    100,
    Math.max(
      0,
      Number.isFinite(Number(manualDiscountPercent))
        ? Number(manualDiscountPercent)
        : 0,
    ),
  );
  // Apply the percentage to the FULL subtotal so that "50% off" always means
  // 50% of the order value, regardless of any auto-applied deal discounts.
  // Math.min caps the result so the combined discount never exceeds subtotal.
  const manualDiscount = Math.min(
    maxManualDiscountAllowed,
    (subtotal * manualDiscountPercentClamped) / 100,
  );
  const totalDiscount = dealDiscount + manualDiscount;
  const total = Math.max(0, subtotal - totalDiscount);
  const selectedDeliveryZone = deliveryZones.find(
    (z) => z.id === deliveryLocationId,
  );
  const filteredDeliveryZones = deliveryZones.filter((z) => {
    const q = deliveryZoneQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(z.name || "")
        .toLowerCase()
        .includes(q) || String(Number(z.fee || 0)).includes(q)
    );
  });
  const selectedDeliveryZoneLabel = selectedDeliveryZone
    ? `${selectedDeliveryZone.name} — Rs ${Number(selectedDeliveryZone.fee || 0).toFixed(2)}`
    : "";
  const deliveryFee =
    orderType !== "DELIVERY"
      ? 0
      : selectedDeliveryZone
        ? Math.round(selectedDeliveryZone.fee * 100) / 100
        : Math.max(0, Number(editSessionDeliveryCharges) || 0);
  const amountDue = Math.round((total + deliveryFee) * 100) / 100;
  const deliveryZonesActive =
    orderType === "DELIVERY" && deliveryZones.length > 0;

  const mergedDiscountPresets =
    posDiscountPresetsCfg && posDiscountPresetsCfg.length > 0
      ? posDiscountPresetsCfg
      : FALLBACK_POS_DISCOUNT_PRESETS;

  function getDiscountPinRequirement({ pct, label, customOpen }) {
    if (customOpen) {
      // Custom discounts always require manager PIN when one is configured.
      return pct > 0;
    }
    const selectedPreset = mergedDiscountPresets.find(
      (p) =>
        Math.round(Number(p.percent) || 0) === Math.round(Number(pct) || 0) &&
        String(p.label || "") === String(label || ""),
    );
    // No matching preset → treat as requiring PIN (safe default).
    if (!selectedPreset) return pct > 0;
    // Prefer the explicit requiresPin flag; fall back to !cashierAllowed for
    // legacy presets that only have the cashierAllowed field.
    if (selectedPreset.requiresPin !== undefined)
      return Boolean(selectedPreset.requiresPin);
    return !Boolean(selectedPreset.cashierAllowed);
  }

  function buildPosDiscountApiFields() {
    const pct =
      manualDiscountPercentClamped > 0 ? manualDiscountPercentClamped : null;
    const pin = managerDiscountPin.trim();
    return {
      posDiscountReason: pct ? discountReason : "",
      posDiscountPresetLabel: pct ? discountPresetLabel : "",
      posManualDiscountPercent: pct,
      ...(pin ? { managerDiscountPin: pin } : {}),
    };
  }

  function validatePosDiscountForSubmit() {
    if (manualDiscountPercentClamped <= 0) return true;
    if (
      !discountReason ||
      !posDiscountReasonOptions.some((o) => o.value === discountReason)
    ) {
      toast.error("Select a discount reason (open Discount and apply)");
      return false;
    }
    const requiresPin = getDiscountPinRequirement({
      pct: manualDiscountPercentClamped,
      label: discountPresetLabel,
      customOpen: discountPresetLabel.startsWith("Custom ("),
    });
    if (
      requiresPin &&
      posDiscountPinConfigured &&
      !managerDiscountPin.trim()
    ) {
      toast.error(
        "Manager PIN is required for this discount. Open Discount to apply with PIN.",
      );
      return false;
    }
    return true;
  }

  function openDiscountModal() {
    setDmPct(manualDiscountPercentClamped);
    setDmLabel(discountPresetLabel);
    setDmReason(discountReason);
    setDmPin("");
    setDmPinError("");
    setDmCustomOpen(false);
    setDmCustomStr("");
    setShowDiscountModal(true);
  }

  async function commitDiscountModal() {
    const pct = dmCustomOpen
      ? Math.min(100, Math.max(0, Number(dmCustomStr) || 0))
      : Math.min(100, Math.max(0, Number(dmPct) || 0));
    const label = dmCustomOpen ? (pct ? `Custom (${pct}%)` : "") : dmLabel;
    const requiresPin = getDiscountPinRequirement({
      pct,
      label,
      customOpen: dmCustomOpen,
    });

    if (pct > 0) {
      if (
        !dmReason ||
        !posDiscountReasonOptions.some((o) => o.value === dmReason)
      ) {
        toast.error("Select a discount reason");
        return;
      }
      if (requiresPin && posDiscountPinConfigured) {
        const pin = dmPin.trim();
        if (!pin) {
          toast.error("Enter manager PIN for this discount");
          return;
        }
        try {
          const out = await verifyDiscountPin(pin);
          if (!out?.valid) {
            setDmPinError("Incorrect PIN");
            setDmPin("");
            return;
          }
          setDmPinError("");
        } catch (e) {
          setDmPinError("Incorrect PIN");
          return;
        }
        setManagerDiscountPin(pin);
      } else {
        setManagerDiscountPin("");
      }
    } else {
      setManagerDiscountPin("");
    }

    setManualDiscountPercent(pct);
    setDiscountPresetLabel(label);
    setDiscountReason(pct > 0 ? dmReason : "");
    setShowDiscountModal(false);
    setDmPin("");
    setDmPinError("");
  }

  const handleCheckout = async (overrides) => {
    if (cart.length === 0) {
      toast.error("Cart is empty!");
      return;
    }
    if (!validatePosDiscountForSubmit()) return;
    const cName = overrides?.customerName ?? customerName.trim();
    const cPhone = overrides?.customerPhone ?? customerPhone.trim();
    const cAddress = overrides?.customerAddress ?? customerAddress.trim();

    if (orderType === "DELIVERY") {
      if (!cPhone) {
        pendingDeliveryCheckoutRef.current = true;
        openCustomerModal();
        return;
      }
      if (deliveryZonesActive && !deliveryLocationId) {
        toast.error("Select a delivery area");
        return;
      }
      if (!deliveryZonesActive && !cAddress) {
        pendingDeliveryCheckoutRef.current = true;
        openCustomerModal();
        return;
      }
    }

    setLoading(true);
    const toastId = toast.loading("Processing order...");

    try {
      const result = await createPosOrder({
        items: cart.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
          note: itemNotes[item.id] || undefined,
        })),
        orderType,
        paymentMethod: "PENDING",
        discountAmount: totalDiscount,
        ...buildPosDiscountApiFields(),
        appliedDeals:
          selectedDeals.length > 0
            ? selectedDeals.map((dealId) => {
                const deal = applicableDeals.find((d) => d.id === dealId);
                return {
                  dealId: dealId,
                  dealName: deal?.name || "",
                  dealType: deal?.dealType || "",
                };
              })
            : undefined,
        customerName: cName,
        customerPhone: cPhone,
        deliveryAddress: cAddress,
        ...(orderType === "DELIVERY" && deliveryLocationId
          ? { deliveryLocationId }
          : {}),
        branchId: currentBranch?.id ?? undefined,
        tableName: orderType === "DINE_IN" && tableName ? tableName : undefined,
        ...(orderType === "DELIVERY" ? { deliveryCharges: deliveryFee } : {}),
      });

      toast.success("Order placed!", { id: toastId });

      // Snapshot lines + financials for the confirmation UI (cart is cleared next).
      const confirmationTypeLabel =
        orderType === "DINE_IN"
          ? tableName
            ? `Dine In (${tableName})`
            : "dine-in"
          : orderType === "TAKEAWAY"
            ? "takeaway"
            : "delivery";
      const confirmationItems = cart.map((it) => {
        const qty = it.quantity ?? it.qty ?? 1;
        const unit = it.price ?? it.unitPrice ?? 0;
        return {
          name: it.name || "",
          qty,
          unitPrice: unit,
          lineTotal: unit * qty,
          note: itemNotes[it.id] || undefined,
        };
      });

      const newOrderId = result.id || result._id || "";
      let printOrder = null;
      if (newOrderId) {
        try {
          printOrder = await getOrder(newOrderId);
        } catch (_) {
          /* fallback below */
        }
      }
      if (!printOrder && newOrderId) {
        printOrder = buildFallbackPrintOrderFromPosResult(result, {
          orderId: newOrderId,
          orderType,
          tableName,
          items: confirmationItems,
          customerName: cName,
          customerPhone: cPhone,
          deliveryAddress: cAddress,
          subtotal,
          discountAmount: totalDiscount,
          deliveryCharges: deliveryFee,
        });
      }

      setOrderConfirmation({
        orderId: newOrderId,
        orderNumber: result.orderNumber || newOrderId,
        total: printOrder?.grandTotal ?? result.amountDue ?? result.total,
        orderType,
        customerName: cName,
        customerPhone: cPhone,
        deliveryAddress: cAddress,
        type: confirmationTypeLabel,
        items: confirmationItems,
        tableName: orderType === "DINE_IN" && tableName ? tableName : "",
        printOrder,
      });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDeliveryLocationId("");
      setManualDiscountPercent(0);
      setDiscountReason("");
      setDiscountPresetLabel("");
      setManagerDiscountPin("");
      setSelectedDeals([]);
      setDealDiscount(0);
      setShowCustomerDetails(false);
      setShowCheckout(false);
      setTableName("");
      loadRecentOrders();
      if (onOrderChanged) onOrderChanged();
    } catch (err) {
      if (isBranchRequiredError(err.message) && branches?.length > 0) {
        toast.dismiss(toastId);
        setShowBranchModal(true);
      } else {
        toast.error(err.message || "Failed to place order", { id: toastId });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrder = async () => {
    if (!editingOrderId || cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (!validatePosDiscountForSubmit()) return;
    setLoading(true);
    const toastId = toast.loading("Updating order...");
    try {
      await updateOrder(editingOrderId, {
        items: cart.map((item) => ({
          menuItemId: String(item.id).startsWith("edit-") ? null : item.id,
          quantity: item.quantity,
          unitPrice: item.price,
          name: item.name,
          note: itemNotes[item.id] || undefined,
        })),
        discountAmount: totalDiscount,
        ...buildPosDiscountApiFields(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: customerAddress.trim(),
        orderType,
        tableName: orderType === "DINE_IN" && tableName ? tableName : undefined,
        ...(orderType === "DELIVERY" ? { deliveryCharges: deliveryFee } : {}),
      });
      toast.success("Order updated successfully!", { id: toastId });
      setEditingOrderId(null);
      setEditingOrder(null);
      setEditSessionDeliveryCharges(0);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setManualDiscountPercent(0);
      setDiscountReason("");
      setDiscountPresetLabel("");
      setManagerDiscountPin("");
      setTableName("");
      setShowCheckout(false);
      loadRecentOrders();
      if (onOrderChanged) onOrderChanged();
    } catch (err) {
      toast.error(err.message || "Failed to update order", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Build order-like object from current cart for printing (optionally with payment details)
  function buildOrderLikeFromCart(overrides = {}) {
    const typeLabel =
      orderType === "DINE_IN"
        ? tableName
          ? `Dine In (${tableName})`
          : "dine-in"
        : orderType === "TAKEAWAY"
          ? "takeaway"
          : "delivery";
    return {
      id: overrides.orderNumber ?? overrides.id ?? `POS-${Date.now()}`,
      orderNumber: overrides.orderNumber ?? `POS-${Date.now()}`,
      createdAt: overrides.createdAt ?? new Date().toISOString(),
      customerName: customerName.trim() || "Walk-in",
      customerPhone: customerPhone.trim(),
      deliveryAddress: customerAddress.trim(),
      type: typeLabel,
      paymentMethod: overrides.paymentMethod ?? "To be paid",
      paymentAmountReceived: overrides.paymentAmountReceived ?? null,
      paymentAmountReturned: overrides.paymentAmountReturned ?? null,
      discountAmount: totalDiscount,
      subtotal,
      total,
      items: cart.map((it) => ({
        name: it.name,
        qty: it.quantity,
        unitPrice: it.price,
        note: itemNotes[it.id] || undefined,
      })),
      ...overrides,
    };
  }

  function openPrintBill(orderLike, mode) {
    const auth = getStoredAuth();
    const waiterFromOrder =
      orderLike.orderTakerName ||
      (orderLike.createdBy && typeof orderLike.createdBy === "object"
        ? orderLike.createdBy.name
        : "") ||
      "";
    printBillReceipt(orderLike, {
      mode,
      logoUrl: restaurantLogoUrl,
      branchAddress: currentBranch?.address || "",
      orderTakerName: waiterFromOrder || auth?.user?.name || "",
      logoHeightPx: restaurantLogoHeight,
      footerMessage: restaurantBillFooter,
    });
  }

  async function printMenuBill() {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (!validatePosDiscountForSubmit()) return;

    // If we're editing an existing order, just print the current cart as a bill
    // without creating a brand new order in the backend.
    if (editingOrderId) {
      const existingId = editingOrder?.id || editingOrderId;
      openPrintBill(
        buildOrderLikeFromCart({
          orderNumber: existingId,
          id: existingId,
          createdAt: editingOrder?.createdAt ?? new Date().toISOString(),
          paymentMethod: "To be paid",
        }),
        "bill",
      );
      return;
    }

    try {
      setPrintingMenu(true);
      const result = await createPosOrder({
        items: cart.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
        })),
        orderType,
        paymentMethod: "PENDING",
        discountAmount: totalDiscount,
        ...buildPosDiscountApiFields(),
        appliedDeals:
          selectedDeals.length > 0
            ? selectedDeals.map((dealId) => {
                const deal = applicableDeals.find((d) => d.id === dealId);
                return {
                  dealId,
                  dealName: deal?.name || "",
                  dealType: deal?.dealType || "",
                };
              })
            : undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: customerAddress.trim(),
        ...(orderType === "DELIVERY" && deliveryLocationId
          ? { deliveryLocationId }
          : {}),
        branchId: currentBranch?.id ?? undefined,
        tableName: orderType === "DINE_IN" && tableName ? tableName : undefined,
      });

      const orderNum = result?.orderNumber ?? result?.id ?? "";

      // Match GET /api/admin/orders/:id totals so the bill matches Orders page print.
      openPrintBill(
        buildOrderLikeFromCart({
          orderNumber: orderNum,
          id: orderNum,
          createdAt: result?.createdAt ?? new Date().toISOString(),
          subtotal: result?.subtotal ?? subtotal,
          discountAmount: result?.discountAmount ?? totalDiscount,
          deliveryCharges:
            result?.deliveryCharges ??
            (orderType === "DELIVERY" ? deliveryFee : 0),
          total: result?.total ?? Math.max(0, subtotal - totalDiscount),
        }),
        "bill",
      );

      // Open the created order in edit mode
      if (orderNum) {
        setEditingOrderId(orderNum);
        getOrder(orderNum)
          .then((order) => {
            setEditingOrder(order);
          })
          .catch(() => {});
      }

      // Clear local cart and reset POS state
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setManualDiscountPercent(0);
      setDiscountReason("");
      setDiscountPresetLabel("");
      setManagerDiscountPin("");
      setSelectedDeals([]);
      setDealDiscount(0);
      setShowCustomerDetails(false);
      setTableName("");
      loadRecentOrders();
      if (onOrderChanged) onOrderChanged();
    } catch (err) {
      if (isBranchRequiredError(err.message) && branches?.length > 0) {
        setShowBranchModal(true);
      } else {
        toast.error(err.message || "Failed to place order for printing");
      }
    } finally {
      setPrintingMenu(false);
    }
  }

  function printPaymentBill(overrides = {}) {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    openPrintBill(buildOrderLikeFromCart(overrides), "receipt");
  }

  // Keyboard shortcuts: Esc (close payment modal or clear cart), Ctrl/Cmd + Shift + ...
  useEffect(() => {
    if (!isActive) return;
    const mod = (e) => e.ctrlKey || e.metaKey;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (showShortcutsModal) setShowShortcutsModal(false);
        else if (showTakePaymentModal) closeTakePaymentModal();
        else clearCart();
        return;
      }

      // Pressing any digit key (0-9) while NOT already typing in an input focuses
      // the menu search bar and types that digit (e.g. "7up", quick codes).
      if (
        /^[0-9]$/.test(e.key) &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName,
        )
      ) {
        const input = menuSearchInputRef.current;
        if (input) {
          e.preventDefault();
          input.focus();
          setMenuSearchQuery((prev) => prev + e.key);
        }
        return;
      }

      if (!mod(e)) return;
      if (e.shiftKey && (e.key === "M" || e.key === "m")) {
        e.preventDefault();
        menuSearchInputRef.current?.focus();
        return;
      }
      if (e.shiftKey && (e.key === "O" || e.key === "o")) {
        e.preventDefault();
        orderSearchInputRef.current?.focus();
        return;
      }
      if (e.shiftKey && (e.key === "C" || e.key === "c")) {
        e.preventDefault();
        if (cart.length > 0) openTakePaymentModal("CASH");
        else toast.error("Cart is empty");
        return;
      }
      if (e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        if (cart.length > 0) openTakePaymentModal("CARD");
        else toast.error("Cart is empty");
        return;
      }
      if (e.shiftKey && (e.key === "N" || e.key === "n")) {
        e.preventDefault();
        if (cart.length > 0) openTakePaymentModal("ONLINE");
        else toast.error("Cart is empty");
        return;
      }
      if (e.shiftKey && (e.key === "B" || e.key === "b")) {
        e.preventDefault();
        printMenuBill();
        return;
      }
      if (e.shiftKey && (e.key === "R" || e.key === "r")) {
        e.preventDefault();
        printPaymentBill();
        return;
      }
      if (e.shiftKey && (e.key === "E" || e.key === "e")) {
        e.preventDefault();
        setOrderType("DINE_IN");
        return;
      }
      if (e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        setOrderType("TAKEAWAY");
        setTableName("");
        return;
      }
      if (e.shiftKey && (e.key === "L" || e.key === "l")) {
        e.preventDefault();
        setOrderType("DELIVERY");
        setTableName("");
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        if (editingOrderId) handleUpdateOrder();
        else handleCheckout();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isActive,
    editingOrderId,
    cart,
    showTakePaymentModal,
    showShortcutsModal,
  ]);

  async function loadDrafts() {
    setLoadingDrafts(true);
    try {
      const data = await getPosDrafts();
      setDrafts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load drafts:", err);
      setDrafts([]);
    } finally {
      setLoadingDrafts(false);
    }
  }

  async function loadTransactions() {
    setLoadingTransactions(true);
    try {
      const data = await getPosTransactions();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load transactions:", err);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  }

  async function loadDayHistory() {
    setLoadingDayHistory(true);
    try {
      const data = await getDaySessions(currentBranch?.id);
      setDaySessionHistory(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch {
      setDaySessionHistory([]);
    } finally {
      setLoadingDayHistory(false);
    }
  }

  async function openEndDayModal() {
    setCurrentSession(null);
    setShowEndDayModal(true);
    setLoadingCurrentSession(true);
    try {
      const session = await getCurrentDaySession(currentBranch?.id);
      setCurrentSession(session);
    } catch {
      setCurrentSession(null);
    } finally {
      setLoadingCurrentSession(false);
    }
  }

  async function handleEndDay() {
    setEndingDay(true);
    try {
      await endDaySession(currentBranch?.id);
      toast.success("Business day ended");
      setShowEndDayModal(false);
    } catch (err) {
      toast.error(err?.message || "Failed to end business day");
    } finally {
      setEndingDay(false);
    }
  }

  // Recent orders in POS header: unpaid only (paid orders are hidden)
  function formatTimeAgo(createdAt) {
    const date = createdAt ? new Date(createdAt) : new Date();
    const now = new Date();
    const diffMs = now - date;
    const diffM = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);
    if (diffM < 1) return "now";
    if (diffM < 60) return `${diffM}m ago`;
    if (diffH < 24) return `${diffH}h ago`;
    if (diffD < 7) return `${diffD}d ago`;
    return date.toLocaleDateString();
  }

  function formatOrderTime(createdAt) {
    const date = createdAt ? new Date(createdAt) : new Date();
    return date.toLocaleString("en-PK", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  const statusProgress = {
    NEW_ORDER: 25,
    PROCESSING: 50,
    READY: 75,
    DELIVERED: 100,
    CANCELLED: 0,
  };

  async function loadRecentOrders() {
    try {
      const data = await getOrders();
      const list = Array.isArray(data) ? data : (data?.orders ?? []);
      const unpaid = list
        .filter((o) => o.isPaid !== true && o.status !== "CANCELLED")
        .map((o) => ({
          id: o.id,
          type: o.type || "dine-in",
          customer: o.customerName || "Walk-in",
          time: formatOrderTime(o.createdAt),
          timeAgo: formatTimeAgo(o.createdAt),
          progress: statusProgress[o.status] ?? 25,
          status: o.status || "NEW_ORDER",
        }));
      setRecentOrders(unpaid);
      if (currentOrderIndex >= Math.max(0, unpaid.length - 1)) {
        setCurrentOrderIndex(0);
      }
    } catch (err) {
      console.error("Failed to load recent orders:", err);
      setRecentOrders([]);
    }
  }

  async function saveDraft() {
    if (cart.length === 0) {
      toast.error("Cannot save empty cart as draft!");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Saving draft...");

    try {
      await createPosDraft({
        items: cart.map((item) => ({
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          imageUrl: item.imageUrl,
        })),
        orderType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: customerAddress.trim(),
        discountAmount: totalDiscount,
        subtotal,
        total,
        itemNotes,
        tableNumber,
        tableName: orderType === "DINE_IN" && tableName ? tableName : undefined,
        selectedWaiter,
        branchId: currentBranch?.id ?? undefined,
      });

      toast.success("Order saved as draft successfully!", { id: toastId });
      await loadDrafts();

      // Clear cart after saving draft
      clearCart();
    } catch (err) {
      if (isBranchRequiredError(err.message) && branches?.length > 0) {
        toast.dismiss(toastId);
        setShowBranchModal(true);
      } else {
        toast.error(err.message || "Failed to save draft", { id: toastId });
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadDraft(draft) {
    const toastId = toast.loading("Loading draft...");
    try {
      // Load draft items into cart
      const loadedItems = draft.items.map((item) => ({
        id: item.menuItemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.imageUrl,
      }));

      setCart(loadedItems);
      setOrderType(draft.orderType || "DINE_IN");
      setCustomerName(draft.customerName || "");
      setCustomerPhone(draft.customerPhone || "");
      setCustomerAddress(draft.deliveryAddress || "");
      setTableNumber(draft.tableNumber || "");
      setTableName(draft.tableName || "");
      setSelectedWaiter(draft.selectedWaiter || "");

      if (draft.itemNotes) {
        setItemNotes(draft.itemNotes);
      }

      setShowTransactionsModal(false);
      toast.success("Draft loaded successfully!", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to load draft", { id: toastId });
    }
  }

  async function removeDraft(id) {
    if (!confirm("Are you sure you want to delete this draft?")) return;

    const toastId = toast.loading("Deleting draft...");
    try {
      await deletePosDraft(id);
      toast.success("Draft deleted successfully!", { id: toastId });
      await loadDrafts();
    } catch (err) {
      toast.error(err.message || "Failed to delete draft", { id: toastId });
    }
  }

  async function removeTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    const toastId = toast.loading("Deleting transaction...");
    try {
      await deletePosTransaction(id);
      toast.success("Transaction deleted successfully!", { id: toastId });
      await loadTransactions();
    } catch (err) {
      toast.error(err.message || "Failed to delete transaction", {
        id: toastId,
      });
    }
  }

  // Filter and sort drafts
  const filteredDrafts = drafts
    .filter((draft) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        draft.customerName?.toLowerCase().includes(searchLower) ||
        draft.orderNumber?.toLowerCase().includes(searchLower) ||
        draft.ref?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else if (sortBy === "oldest") {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      return 0;
    });

  // Filter and sort transactions
  const filteredTransactions = transactions
    .filter((transaction) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        transaction.customerName?.toLowerCase().includes(searchLower) ||
        transaction.orderNumber?.toLowerCase().includes(searchLower) ||
        transaction.ref?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else if (sortBy === "oldest") {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      return 0;
    });

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1fr_400px] lg:h-[calc(100vh-110px)]">
        <div className="flex flex-col gap-5 min-w-0 overflow-x-hidden">
          {/* Menu Items Section */}
          <div className="flex flex-col bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden flex-1">
            {/* Header: title + search (one row) + dietary chips */}
            <div className="border-b border-gray-200 dark:border-neutral-800 bg-gradient-to-b from-gray-50/90 to-white dark:from-neutral-900 dark:to-neutral-950">
              <div className="flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center sm:gap-3 min-w-0">
                <h2 className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">
                  Menu
                </h2>

                {/* Search — same row as heading on sm+ */}
                <div className="relative flex-1 min-w-0">
                  <label htmlFor="pos-menu-search" className="sr-only">
                    Search menu items
                  </label>
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    aria-hidden
                  />
                  <input
                    id="pos-menu-search"
                    ref={menuSearchInputRef}
                    type="search"
                    inputMode="search"
                    autoComplete="off"
                    placeholder="Search items…"
                    value={menuSearchQuery}
                    onChange={(e) => {
                      setMenuSearchQuery(e.target.value);
                      setFocusedItemIndex(0);
                    }}
                    onKeyDown={(e) => {
                      if (filteredItems.length > 0) {
                        if (e.key === "ArrowRight") {
                          e.preventDefault();
                          setFocusedItemIndex((i) =>
                            Math.min(filteredItems.length - 1, i + 1),
                          );
                          return;
                        }
                        if (e.key === "ArrowLeft") {
                          e.preventDefault();
                          setFocusedItemIndex((i) => Math.max(0, i - 1));
                          return;
                        }
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setFocusedItemIndex((i) =>
                            Math.min(filteredItems.length - 1, i + gridCols),
                          );
                          return;
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setFocusedItemIndex((i) => Math.max(0, i - gridCols));
                          return;
                        }
                      }
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      if (!menuSearchQuery.trim()) {
                        toast.error(
                          "Type to search, then press Enter to add the highlighted item",
                        );
                        return;
                      }
                      if (filteredItems.length === 0) {
                        toast.error("No matching items");
                        return;
                      }
                      const idx = Math.min(
                        Math.max(0, focusedItemIndex),
                        filteredItems.length - 1,
                      );
                      const selectedItem = filteredItems[idx];
                      if (!selectedItem) {
                        toast.error("No matching item found");
                        return;
                      }
                      if (selectedItem.inventorySufficient === false) {
                        toast.error(`${selectedItem.name} is out of stock`);
                        return;
                      }
                      addToCart(selectedItem, 1);
                      toast.success(`1 × ${selectedItem.name} added to cart`);
                      setMenuSearchQuery("");
                      setFocusedItemIndex(0);
                    }}
                    className="h-7 w-full border-b border-gray-200 pl-9 pr-3 text-sm text-gray-900 bg-transparent outline-none transition-all placeholder:text-gray-400  focus:ring-primary/15 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500"
                  />
                </div>

                {/* Dietary — compact chips, same row on wide screens */}
                <div
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 shrink-0 sm:justify-end"
                  role="group"
                  aria-label="Dietary filter"
                >
                  {[
                    { value: "veg", label: "Veg" },
                    { value: "non-veg", label: "Non-veg" },
                    { value: "egg", label: "Egg" },
                  ].map((filter) => {
                    const active = dietaryFilter === filter.value;
                    return (
                      <label
                        key={filter.value}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all ${
                          active
                            ? "border-primary bg-primary/10 text-primary dark:bg-primary/15"
                            : "border-gray-200 bg-white text-gray-600 hover:border-primary/40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() =>
                            setDietaryFilter(active ? "all" : filter.value)
                          }
                          className="sr-only"
                        />
                        <span
                          className={`flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px] font-bold leading-none ${
                            active
                              ? "border-primary bg-primary text-white"
                              : "border-gray-300 dark:border-neutral-600"
                          }`}
                          aria-hidden
                        >
                          {active ? "✓" : ""}
                        </span>
                        {filter.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Category tabs */}
              <div className="flex gap-2 overflow-x-auto border-t border-gray-100/80 bg-white/60 px-3 pb-2 pt-2 scrollbar-hide dark:border-neutral-800/80 dark:bg-neutral-950/40">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg border text-xs font-semibold transition-all text-left capitalize ${
                    selectedCategory === "all"
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-gray-200 dark:border-neutral-700 hover:border-primary/50 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300"
                  }`}
                >
                  All{" "}
                  <span className="font-normal opacity-60">
                    {
                      allItemsForGrid.filter(
                        (item) =>
                          item.isDeal ||
                          (item.finalAvailable ?? item.available),
                      ).length
                    }
                  </span>
                </button>

                <button
                  onClick={() => setSelectedCategory("deals")}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg border text-xs font-semibold transition-all text-left capitalize ${
                    selectedCategory === "deals"
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-gray-200 dark:border-neutral-700 hover:border-primary/50 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300"
                  }`}
                >
                  Deals{" "}
                  <span className="font-normal opacity-60">
                    {allItemsForGrid.filter((i) => i.isDeal).length}
                  </span>
                </button>

                {menu.categories.map((cat) => {
                  const catItemCount = menu.items.filter(
                    (item) => item.categoryId === cat.id,
                  ).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex-shrink-0 px-3 py-2 rounded-lg border text-xs font-semibold transition-all text-left capitalize ${
                        selectedCategory === cat.id
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-gray-200 dark:border-neutral-700 hover:border-primary/50 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300"
                      }`}
                    >
                      <span className="whitespace-nowrap">{cat.name}</span>{" "}
                      <span className="font-normal opacity-60">
                        {catItemCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Menu Grid - Compact */}
            <div className="flex-1 overflow-y-auto p-2 bg-gray-50 dark:bg-neutral-900/50">
              {pageLoading ? (
                <div className="flex flex-col items-center justify-center min-h-[280px] py-12">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-3">
                    <ShoppingCart className="w-8 h-8 text-primary animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <p className="text-sm font-semibold text-gray-700 dark:text-neutral-300">
                      Loading POS...
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={`grid gap-2 ${effectiveSidebarOpen ? "grid-cols-3 xl:grid-cols-4" : "grid-cols-4 xl:grid-cols-5"}`}
                  >
                    {filteredItems.map((item, idx) => {
                      const inCart = cart.find((c) => c.id === item.id);
                      const outOfStock = item.inventorySufficient === false;
                      const category = menu.categories.find(
                        (c) => c.id === item.categoryId,
                      );
                      const isTrending = item.isTrending === true;
                      const isMustTry = item.isMustTry === true;

                      return (
                        <div
                          key={item.id}
                          ref={idx === focusedItemIndex ? focusedCardRef : null}
                          onClick={() => setFocusedItemIndex(idx)}
                          className={`group relative flex flex-col rounded-lg overflow-hidden transition-all ${
                            outOfStock
                              ? "border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 opacity-60"
                              : "border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:shadow-md cursor-pointer"
                          } ${menuSearchQuery.trim() && idx === focusedItemIndex ? "ring-2 ring-primary ring-offset-2 shadow-lg" : ""}`}
                        >
                          {/* Image - Compact */}
                          <div
                            className="relative h-32 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-neutral-900 dark:to-neutral-800"
                            onClick={() =>
                              !outOfStock && !inCart && addToCart(item)
                            }
                          >
                            {/* Badges */}
                            {!outOfStock && (
                              <div className="absolute top-1 left-1 flex flex-col gap-0.5 z-10">
                                {isTrending && (
                                  <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-bold flex items-center gap-0.5">
                                    <Flame className="w-2.5 h-2.5" />
                                    Trending
                                  </span>
                                )}
                                {isMustTry && (
                                  <span className="px-1.5 py-0.5 rounded bg-blue-500 text-white text-[9px] font-bold flex items-center gap-0.5">
                                    <Star className="w-2.5 h-2.5" />
                                    Must Try
                                  </span>
                                )}
                              </div>
                            )}

                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className={`w-full h-full object-cover ${outOfStock ? "grayscale" : ""}`}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-3xl">
                                🍽️
                              </div>
                            )}

                            {outOfStock && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                                  Out of Stock
                                </span>
                              </div>
                            )}

                            {inCart && !outOfStock && (
                              <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">
                                {inCart.quantity}
                              </div>
                            )}
                          </div>

                          {/* Content - Compact */}
                          <div className="p-2 flex flex-col">
                            {/* Category and Dietary Info */}
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-gray-500 dark:text-neutral-500 truncate">
                                {category?.name || "Uncategorized"}
                              </span>
                              <span className="text-[10px]">
                                {item.name.toLowerCase().includes("veg")
                                  ? "🥗"
                                  : "🍗"}
                              </span>
                            </div>

                            {/* Item Name */}
                            <h3
                              className={`text-xs font-bold mb-1 line-clamp-1 ${outOfStock ? "text-gray-400 dark:text-neutral-500" : "text-gray-900 dark:text-white"}`}
                            >
                              {item.name}
                            </h3>

                            {/* Price and Add to Cart */}
                            <div className="flex items-center justify-between">
                              <div>
                                <span
                                  className={`text-sm font-bold ${outOfStock ? "text-gray-400" : "text-primary"}`}
                                >
                                  Rs {item.finalPrice ?? item.price}
                                </span>
                              </div>

                              {!outOfStock &&
                                (inCart ? (
                                  <div
                                    className="flex items-center gap-0.5 bg-gray-100 dark:bg-neutral-800 rounded p-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() =>
                                        updateQuantity(item.id, -1)
                                      }
                                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-white dark:hover:bg-neutral-700 transition-colors"
                                    >
                                      <Minus className="w-3 h-3 text-gray-700 dark:text-neutral-300" />
                                    </button>
                                    <span className="w-6 text-center text-xs font-bold text-gray-900 dark:text-white">
                                      {inCart.quantity}
                                    </span>
                                    <button
                                      onClick={() => updateQuantity(item.id, 1)}
                                      className="w-5 h-5 flex items-center justify-center rounded bg-primary text-white hover:bg-primary/90 transition-colors"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => addToCart(item)}
                                    className="w-5 h-5 flex items-center justify-center rounded bg-primary text-white hover:bg-primary/90 transition-colors"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {filteredItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full py-20">
                      <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                        <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-neutral-700" />
                      </div>
                      <p className="text-sm font-medium text-gray-600 dark:text-neutral-400">
                        No items found
                      </p>
                      <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
                        Try a different search or category
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Cart Section - Compact Style */}
        <div className="flex flex-col bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          {editingOrderId && (
            <div className="px-3 py-2 bg-amber-500/15 dark:bg-amber-500/20 border-b border-amber-500/30 flex items-center justify-between">
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Editing order #{editingOrder?.id || editingOrderId}
              </span>
              <button
                type="button"
                onClick={() => {
                  handleNavigateAwayFromEdit(() => {
                    resetEditOrderState();
                    onClose?.();
                  });
                }}
                className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
              >
                Cancel edit
              </button>
            </div>
          )}
          {loadingEditOrder && (
            <div className="px-3 py-4 flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-neutral-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading order...
            </div>
          )}
          {/* Order Header */}
          <div className="px-3 py-2.5 border-b border-gray-200 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => handleNavigateAwayFromEdit(() => onClose?.())}
                className="flex items-center gap-1.5 text-base font-bold text-gray-900 dark:text-white hover:text-primary dark:hover:text-primary transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                View Orders
              </button>
              {editingOrderId && (
                <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
                  #{editingOrder?.orderNumber || editingOrderId}
                </span>
              )}
            </div>

            {/* Order Type Buttons + Settings (beside Delivery) */}
            <div className="flex gap-2 mb-2">
              {[
                { type: "DINE_IN", icon: "🍽️", label: "Dine In" },
                { type: "TAKEAWAY", icon: "📦", label: "Take" },
                { type: "DELIVERY", icon: "🚚", label: "Delivery" },
              ].map((option) => (
                <button
                  key={option.type}
                  onClick={() => {
                    setOrderType(option.type);
                    if (option.type !== "DINE_IN") setTableName("");
                    if (option.type === "DELIVERY") {
                      setShowCustomerDetails(true);
                      setSelectedWaiter("");
                    }
                  }}
                  className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    orderType === option.type
                      ? "bg-primary text-white"
                      : "bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400"
                  }`}
                >
                  <span className="text-sm">{option.icon}</span>
                  {option.label}
                </button>
              ))}
              {currentBranch?.id && (
                <button
                  type="button"
                  onClick={() => {
                    setPosTableSettingsDraft(showTablePos);
                    setPosWaiterSettingsDraft(showWaiterPos);
                    setPosCustomerSettingsDraft(showCustomerPos);
                    setShowPosTableSettingsModal(true);
                  }}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:text-neutral-300 dark:hover:bg-neutral-800 transition-colors flex-shrink-0"
                  title="POS options (table, waiter, customer)"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Table + Order Taker in one row */}
            {posOptionsLoaded &&
              orderType === "DINE_IN" &&
              (showTablePos || showWaiterPos) && (
                <div className="flex gap-2 mb-2">
                  {orderType === "DINE_IN" && showTablePos && (
                    <select
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-gray-900 dark:text-white"
                    >
                      <option value="">No table</option>
                      {tables
                        .filter((t) => t.isAvailable)
                        .map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      {tables
                        .filter((t) => !t.isAvailable)
                        .map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name} (occupied)
                          </option>
                        ))}
                    </select>
                  )}
                  {showWaiterPos && orderType === "DINE_IN" && (
                    <select
                      value={selectedWaiter}
                      onChange={(e) => setSelectedWaiter(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-gray-900 dark:text-white"
                    >
                      <option value="">Order Taker</option>
                      {orderTakers.map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
          </div>

          {/* Ordered Items Header */}
          <div className="px-3 py-2.5 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/50">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Ordered Menus
              </h3>
              <div className="flex items-center gap-3 flex-shrink-0">
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllCartItems}
                    className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                  >
                    Clear all
                  </button>
                )}
                <span className="text-xs text-gray-500 dark:text-neutral-400 whitespace-nowrap">
                  Total:{" "}
                  <span className="font-bold text-gray-900 dark:text-white">
                    {cart.length}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-2">
                  <ShoppingCart className="w-8 h-8 text-gray-300 dark:text-neutral-700" />
                </div>
                <p className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
                  Cart is empty
                </p>
              </div>
            ) : (
              cart.map((item) => {
                const isExpanded = expandedCartItems.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setExpandedCartItems((prev) =>
                        prev.includes(item.id)
                          ? prev.filter((id) => id !== item.id)
                          : [...prev, item.id],
                      );
                    }}
                    className="p-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 cursor-pointer hover:border-gray-300 dark:hover:border-neutral-700 hover:shadow-md transition-all"
                  >
                    {/* Item Row */}
                    <div className="flex items-start gap-3">
                      {/* Item Image */}
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-neutral-900 flex-shrink-0 overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            🍽️
                          </div>
                        )}
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 min-w-0">
                        {/* Title Row with Remove Button */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-base font-bold text-gray-900 dark:text-white line-clamp-1">
                              {item.name}{" "}
                              <span className="text-xs font-normal text-gray-500 dark:text-neutral-500">
                                ({item.size || "Regular"})
                              </span>
                            </h4>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromCart(item.id);
                            }}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                          >
                            <span className="text-lg">✕</span>
                          </button>
                        </div>

                        {/* Quantity and Add Note Row */}
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-900 rounded-md p-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(item.id, -1);
                              }}
                              className="w-4 h-4 flex items-center justify-center hover:bg-neutral-700 text-white dark:hover:bg-neutral-800 rounded transition-colors"
                            >
                              <Minus className="w-3 h-3 text-gray-700 dark:text-neutral-400" />
                            </button>
                            <span className="w-8 scale-105 text-center text-xs font-semibold text-gray-900 dark:text-white">
                              {item.quantity}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(item.id, 1);
                              }}
                              className="w-4 h-4 flex items-center justify-center bg-primary hover:bg-neutral-700 text-white dark:hover:bg-neutral-800 rounded transition-colors"
                            >
                              <Plus className="w-3 h-3 dark:text-neutral-400" />
                            </button>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addNoteToItem(item.id);
                            }}
                            className="text-sm text-primary hover:underline font-medium"
                          >
                            Add Note
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Note Display */}
                    {itemNotes[item.id] && (
                      <div className="mt-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
                        <p className="text-xs text-blue-700 dark:text-blue-400">
                          📝 {itemNotes[item.id]}
                        </p>
                      </div>
                    )}

                    {/* Price Grid - Only shown when expanded */}
                    {isExpanded && (
                      <div className="pt-3 mt-3 border-t border-gray-200 dark:border-neutral-800">
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-gray-500 dark:text-neutral-500 mb-1.5">
                              Item Rate
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              Rs {item.price}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500 dark:text-neutral-500 mb-1.5">
                              Amount
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              Rs {(item.price * item.quantity).toFixed(2)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-gray-500 dark:text-neutral-500 mb-1.5">
                              Total
                            </div>
                            <div className="font-bold text-primary text-base">
                              Rs {(item.price * item.quantity).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Summary */}
          {cart.length > 0 && (
            <div className="p-3 border-t border-gray-200 dark:border-neutral-800 space-y-3 bg-white dark:bg-neutral-950">
              {/* Available Deals Section */}
              {applicableDeals.length > 0 && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/30 overflow-hidden bg-white dark:bg-neutral-950">
                  <button
                    type="button"
                    onClick={() => setShowDealsSection(!showDealsSection)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold text-gray-700 dark:text-neutral-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 flex items-center justify-center">
                        <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="flex items-center gap-2">
                        Deals
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                          {applicableDeals.length}
                        </span>
                      </span>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-300 ${showDealsSection ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div
                    className="transition-all duration-300 ease-in-out overflow-hidden"
                    style={{
                      maxHeight: showDealsSection
                        ? `${applicableDeals.length * 75 + 30}px`
                        : "0px",
                      opacity: showDealsSection ? 1 : 0,
                    }}
                  >
                    <div className="p-3 space-y-2 border-t border-emerald-100 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-500/5 dark:to-neutral-950">
                      {applicableDeals.map((deal) => {
                        const isSelected = selectedDeals.includes(deal.id);
                        return (
                          <button
                            key={deal.id}
                            onClick={() => toggleDealSelection(deal.id)}
                            className={`w-full text-left p-2.5 rounded-lg transition-all ${
                              isSelected
                                ? "bg-emerald-100 dark:bg-emerald-500/10 border-2 border-emerald-500 dark:border-emerald-500/50"
                                : "bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                                    {deal.name}
                                  </h4>
                                  {deal.badgeText && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/10 text-secondary text-[10px] font-bold">
                                      <Sparkles className="w-3 h-3" />
                                      {deal.badgeText}
                                    </span>
                                  )}
                                </div>
                                {deal.description && (
                                  <p className="text-xs text-gray-600 dark:text-neutral-400 line-clamp-1">
                                    {deal.description}
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                {isSelected && (
                                  <CircleCheckBig className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-1" />
                                )}
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  {deal.dealType === "PERCENTAGE_DISCOUNT" &&
                                    `${deal.discountPercentage}% OFF`}
                                  {deal.dealType === "FIXED_DISCOUNT" &&
                                    `Rs ${deal.discountAmount} OFF`}
                                  {deal.dealType === "MINIMUM_PURCHASE" &&
                                    `Spend Rs ${deal.minimumPurchase}`}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Summary */}
              <div className="space-y-0.5 bill-font leading-tight">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-1">
                  Payment Summary
                </h4>
                <div className="flex justify-between items-baseline gap-2 text-xs py-0.5">
                  <span className="text-gray-600 dark:text-neutral-400">
                    Sub Total
                  </span>
                  <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                    Rs {subtotal.toFixed(2)}
                  </span>
                </div>
                {dealDiscount > 0 && (
                  <div className="flex justify-between items-baseline gap-2 text-xs py-0.5">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Deal Discount
                    </span>
                    <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      -Rs {dealDiscount.toFixed(2)}
                    </span>
                  </div>
                )}
                {manualDiscountPercentClamped > 0 && (
                  <div className="flex flex-col gap-0.5 text-xs py-0.5">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-gray-600 dark:text-neutral-400 flex items-center gap-1">
                        <Percent className="w-3 h-3 opacity-80" />
                        {discountPresetLabel || "Discount"}
                      </span>
                      <span className="font-semibold tabular-nums text-gray-700 dark:text-neutral-300">
                        -Rs {manualDiscount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-baseline gap-2 text-xs py-0.5">
                  <span className="text-gray-600 dark:text-neutral-400">
                    Tax (0%)
                  </span>
                  <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                    Rs 0
                  </span>
                </div>
                {orderType === "DELIVERY" && deliveryFee > 0 && (
                  <div className="flex justify-between items-baseline gap-2 text-xs py-0.5">
                    <span className="text-gray-600 dark:text-neutral-400">
                      Delivery
                    </span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                      Rs {deliveryFee.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Amount to be Paid */}
              <div className="pt-1.5 mt-1 border-t border-gray-200 dark:border-neutral-800 bill-font">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    Total due
                  </span>
                  <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
                    Rs {amountDue.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Delivery area selector */}
              {orderType === "DELIVERY" && (
                <div className="mb-2">
                  {deliveryZones.length > 0 ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={
                          deliveryZoneOpen
                            ? deliveryZoneQuery
                            : selectedDeliveryZoneLabel
                        }
                        onFocus={() => {
                          setDeliveryZoneOpen(true);
                          setDeliveryZoneQuery("");
                        }}
                        onBlur={() =>
                          setTimeout(() => setDeliveryZoneOpen(false), 120)
                        }
                        onChange={(e) => {
                          setDeliveryZoneQuery(e.target.value);
                          setDeliveryZoneOpen(true);
                        }}
                        placeholder="Search delivery area..."
                        className="w-full px-3 pr-8 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-gray-900 dark:text-white"
                      />
                      <ChevronDown
                        className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 transition-transform ${deliveryZoneOpen ? "rotate-180" : ""}`}
                      />
                      {deliveryZoneOpen && (
                        <div className="absolute z-30 bottom-full mb-1 w-full max-h-72 overflow-auto rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setDeliveryLocationId("");
                              setDeliveryZoneQuery("");
                              setDeliveryZoneOpen(false);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800"
                          >
                            — Select delivery area —
                          </button>
                          {filteredDeliveryZones.map((z) => (
                            <button
                              key={z.id}
                              type="button"
                              onClick={() => {
                                setDeliveryLocationId(z.id);
                                setDeliveryZoneQuery("");
                                setDeliveryZoneOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-neutral-800"
                            >
                              {z.name} — Rs {Number(z.fee || 0).toFixed(2)}
                            </button>
                          ))}
                          {filteredDeliveryZones.length === 0 && (
                            <div className="px-3 py-2 text-xs text-gray-500 dark:text-neutral-400">
                              No matching area
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <textarea
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      rows={2}
                      placeholder="Full delivery address"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-gray-900 dark:text-white resize-none"
                    />
                  )}
                </div>
              )}

              {/* Place Order / Update Order Button */}
              {editingOrderId ? (
                <button
                  onClick={handleUpdateOrder}
                  disabled={loading || cart.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      Update order
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      Place an Order
                    </>
                  )}
                </button>
              )}

              {/* Add Customer + Print + Discount + Take Payment */}
              <div className="flex gap-1.5 mt-2 items-center">
                {showCustomerPos && (
                  <button
                    type="button"
                    onClick={openCustomerModal}
                    title={
                      customerName
                        ? `Customer: ${customerName}`
                        : "Add customer"
                    }
                    aria-label={
                      customerName
                        ? `Customer: ${customerName}`
                        : "Add customer"
                    }
                    className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-gray-300 dark:hover:border-neutral-600 transition-colors flex-shrink-0"
                  >
                    <UserPlus className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={printMenuBill}
                  disabled={printingMenu || cart.length === 0}
                  title={printingMenu ? "Printing…" : "Print bill"}
                  aria-label={printingMenu ? "Printing" : "Print bill"}
                  className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Printer className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
                </button>
                <button
                  type="button"
                  onClick={openDiscountModal}
                  disabled={cart.length === 0 || maxManualDiscountAllowed <= 0}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ${
                    manualDiscountPercentClamped > 0
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-300"
                  }`}
                >
                  <Percent className="w-4 h-4" />
                  <span className="text-xs font-medium">Discount</span>
                </button>
                <button
                  type="button"
                  onClick={() => openTakePaymentModal("CASH")}
                  disabled={cart.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-xs font-medium text-gray-700 dark:text-neutral-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Receipt className="w-4 h-4" />
                  Take Payment
                </button>
              </div>

              {/* Save as Draft Button (only when not editing) */}
              {/* {!editingOrderId && (
                <button
                onClick={saveDraft}
                disabled={loading || cart.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-4 h-4" />
                Save as Draft
              </button>
              )} */}

              {/* Action Buttons Grid */}
              {/* <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => setShowPrintModal(true)}
                  className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="text-lg">🖨️</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    Print
                      </span>
                    </button>
                <button 
                  onClick={() => setShowInvoiceModal(true)}
                  className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="text-lg">📄</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    Invoice
                  </span>
                </button>
                <button 
                  onClick={() => {
                    setTransactionTab("draft");
                    setShowTransactionsModal(true);
                  }}
                  className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="text-lg">📝</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    Draft
                  </span>
                </button>
                <button
                  onClick={clearCart}
                  className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="text-lg">❌</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    Cancel
                  </span>
                </button>
                <button className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors flex items-center justify-center gap-1.5">
                  <span className="text-lg">💵</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    Void
                  </span>
                </button>
                <button 
                  onClick={() => {
                    setTransactionTab("sale");
                    setShowTransactionsModal(true);
                  }}
                  className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="text-lg">📊</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    Trans.
                  </span>
                </button>
              </div> */}
            </div>
          )}
        </div>
      </div>

      {/* Transactions Modal with Tabs */}
      {showTransactionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Transactions
              </h2>
              <button
                onClick={() => setShowTransactionsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
              >
                <span className="text-3xl">×</span>
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-4 border-b border-gray-200 dark:border-neutral-800">
              <div className="flex gap-2">
                <button
                  onClick={() => setTransactionTab("sale")}
                  className={`px-6 py-2.5 rounded-t-lg font-semibold text-sm transition-all ${
                    transactionTab === "sale"
                      ? "bg-primary text-white"
                      : "bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-800"
                  }`}
                >
                  <Receipt className="w-4 h-4 inline mr-2" />
                  Sale
                </button>
                <button
                  onClick={() => setTransactionTab("draft")}
                  className={`px-6 py-2.5 rounded-t-lg font-semibold text-sm transition-all ${
                    transactionTab === "draft"
                      ? "bg-primary text-white"
                      : "bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-800"
                  }`}
                >
                  <FileText className="w-4 h-4 inline mr-2" />
                  Draft
                </button>
              </div>
            </div>

            {/* Search and Sort Bar */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/50">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 pl-10 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    🔍
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-neutral-400">
                    Sort by :
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto max-h-[calc(90vh-260px)]">
              {/* Sale Tab Content */}
              {transactionTab === "sale" && (
                <>
                  {loadingTransactions ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                  ) : filteredTransactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                        <Receipt className="w-10 h-10 text-gray-300 dark:text-neutral-700" />
                      </div>
                      <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
                        {searchQuery
                          ? "No transactions found"
                          : "No transactions yet"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">
                        {searchQuery
                          ? "Try a different search"
                          : "Complete your first sale to see it here"}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
                          <tr>
                            <th className="px-6 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                              Date
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                              Ref
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                              Customer
                            </th>
                            <th className="px-6 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                              Grand Total
                            </th>
                            <th className="px-6 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                          {filteredTransactions.map((transaction) => (
                            <tr
                              key={transaction.id || transaction._id}
                              className="hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors"
                            >
                              <td className="px-6 py-4 text-sm text-gray-600 dark:text-neutral-400">
                                {new Date(
                                  transaction.createdAt,
                                ).toLocaleDateString("en-US", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                #
                                {transaction.ref ||
                                  transaction.orderNumber ||
                                  transaction.id?.slice(-6) ||
                                  transaction._id?.slice(-6)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                {transaction.customerName || "Walk-in Customer"}
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-right text-gray-900 dark:text-white">
                                $
                                {(
                                  transaction.total ||
                                  transaction.subtotal ||
                                  0
                                ).toFixed(2)}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => setShowPrintModal(true)}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                                    title="Print"
                                  >
                                    <Receipt className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      removeTransaction(
                                        transaction.id || transaction._id,
                                      )
                                    }
                                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                    title="Delete Transaction"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* Draft Tab Content */}
              {transactionTab === "draft" && (
                <>
                  {loadingDrafts ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                  ) : filteredDrafts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                        <FileText className="w-10 h-10 text-gray-300 dark:text-neutral-700" />
                      </div>
                      <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
                        {searchQuery ? "No drafts found" : "No drafts yet"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">
                        {searchQuery
                          ? "Try a different search"
                          : "Save your current order as draft to see it here"}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
                          <tr>
                            <th className="px-6 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                              Date
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                              Ref
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                              Customer
                            </th>
                            <th className="px-6 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                              Grand Total
                            </th>
                            <th className="px-6 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                          {filteredDrafts.map((draft) => (
                            <tr
                              key={draft.id || draft._id}
                              className="hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors"
                            >
                              <td className="px-6 py-4 text-sm text-gray-600 dark:text-neutral-400">
                                {new Date(draft.createdAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                #
                                {draft.ref ||
                                  draft.orderNumber ||
                                  draft.id?.slice(-6) ||
                                  draft._id?.slice(-6)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                {draft.customerName || "Walk-in Customer"}
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-right text-gray-900 dark:text-white">
                                $
                                {(draft.total || draft.subtotal || 0).toFixed(
                                  2,
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      loadDraft(draft);
                                      setShowTransactionsModal(false);
                                    }}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                                    title="Load Draft"
                                  >
                                    <FileText className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
                                  </button>
                                  <button
                                    onClick={() => setShowPrintModal(true)}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                                    title="Print"
                                  >
                                    <Receipt className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      removeDraft(draft.id || draft._id)
                                    }
                                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                    title="Delete Draft"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Invoice
              </h2>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
              >
                <span className="text-3xl">×</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Invoice Header */}
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    #INV5465
                  </h3>
                  <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
                    DreamsPOS
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {/* PAID Stamp */}
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-green-500 flex items-center justify-center bg-green-50 dark:bg-green-500/10">
                      <span className="text-green-600 dark:text-green-400 font-bold text-lg">
                        PAID
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoice From & Bill To */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                {/* Invoice From */}
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white mb-3">
                    Invoice From
                  </h4>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-neutral-400">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      DreamsPOS
                    </p>
                    <p>15 Hodges Mews, High Wycombe</p>
                    <p>HP12 3JL, United Kingdom</p>
                    <p>Phone: +1 45659 96566</p>
                  </div>
                </div>

                {/* Bill To */}
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white mb-3">
                    Bill To
                  </h4>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-neutral-400">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {customerName || "Andrew Fletcher"}
                    </p>
                    <p>1147 Rohan Drive Suite, Burlington,</p>
                    <p>VT / 8202115 United Kingdom</p>
                    <p>Phone: {customerPhone || "+1 45659 96566"}</p>
                  </div>
                </div>
              </div>

              {/* Items Details Table */}
              <div className="mb-8">
                <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4">
                  Items Details
                </h4>
                <div className="border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-neutral-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                          Item Details
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                          Rate
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                      {cart.map((item, index) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-neutral-400">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                            {item.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            ${item.price.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white font-semibold">
                            ${(item.price * item.quantity).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Terms and Summary */}
              <div className="grid grid-cols-2 gap-8">
                {/* Terms and Conditions */}
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white mb-3">
                    Terms and Conditions
                  </h4>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-neutral-400">
                    <p>1. Goods once sold cannot be taken back or exchanged.</p>
                    <p>
                      2. We are not the manufacturers the company provides
                      warranty
                    </p>
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      <span className="font-semibold">Note:</span> Please ensure
                      payment is made within 7 days of invoice date.
                    </p>
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        Amount
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        ${subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-neutral-400">
                        Tax (0%)
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        $0
                      </span>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-neutral-400">
                          Discount (
                          {Math.round((totalDiscount / subtotal) * 100)}%)
                        </span>
                        <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                          -${totalDiscount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="pt-3 border-t border-gray-200 dark:border-neutral-800">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-bold text-gray-900 dark:text-white">
                          Total ($)
                        </span>
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          ${(subtotal - totalDiscount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800 flex gap-3 bg-gray-50 dark:bg-neutral-900/50">
              <button
                onClick={() => {
                  // Download PDF logic here
                  alert("Download PDF functionality to be implemented");
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 font-semibold text-sm hover:bg-white dark:hover:bg-neutral-900 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Download PDF
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                <Receipt className="w-4 h-4" />
                Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Receipt Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-neutral-950 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Print Reciept
              </h2>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Order Info Section */}
              <div className="mb-6">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">
                  Order Info
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-neutral-400">
                      Date & Time
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {now
                        ? now.toLocaleDateString("en-US", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : ""}{" "}
                      {now
                        ? `- ${now.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}`
                        : ""}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-neutral-400">
                      Order No
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      #54654
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-neutral-400">
                      Token No
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      20
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-neutral-400">
                      No of Items
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {cart.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-neutral-400">
                      Order Type
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {orderType === "DINE_IN"
                        ? tableName
                          ? `Dine In (${tableName})`
                          : "Dine In"
                        : orderType === "TAKEAWAY"
                          ? "Take Away"
                          : "Delivery"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ordered Menus Section */}
              <div className="mb-6">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">
                  Ordered Menus
                </h3>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-start"
                    >
                      <div className="flex-1">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {item.name} ×{item.quantity}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-neutral-800">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-neutral-400">
                    Sub Total
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-neutral-400">
                    Tax (0%)
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    $0
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-neutral-400">
                    Service Charge
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    $15
                  </span>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-200 dark:border-neutral-800">
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  Total
                </span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${(subtotal + 15).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800 flex gap-3">
              <button
                onClick={() => setShowPrintModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Take payment modal */}
      {showTakePaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Take Payment
                </h2>
              </div>
              <button
                type="button"
                onClick={closeTakePaymentModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bill total hero */}
            <div className="px-5 pt-5">
              <div className="text-center py-4 px-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                  Bill Total
                </p>
                <p className="text-4xl font-black text-gray-900 dark:text-white tabular-nums leading-none">
                  Rs {Math.round(total).toLocaleString()}
                </p>
                {total % 1 !== 0 && (
                  <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">
                    {total.toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            <form
              onSubmit={handleTakePaymentSubmit}
              className="px-5 pt-4 pb-5 space-y-4"
            >
              {paymentError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">
                    {paymentError}
                  </p>
                </div>
              )}

              {/* Payment method tiles */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
                  Payment method
                </label>
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
                    onClick={() => {
                      setPaymentMethod("ONLINE");
                      setOnlineProvider(null);
                    }}
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
                  <label className="block text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
                    Paid to
                  </label>
                  {paymentAccountsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                      <span className="text-xs text-gray-400 dark:text-neutral-500">
                        Loading accounts…
                      </span>
                    </div>
                  ) : paymentAccounts.length === 0 ? (
                    <div className="px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400">
                      No payment accounts configured. Go to{" "}
                      <span className="font-semibold">
                        Business Settings → Payment Accounts
                      </span>{" "}
                      to add them.
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
                          <p
                            className={`text-xs font-semibold truncate ${onlineProvider === acc.name ? "text-violet-700 dark:text-violet-400" : "text-gray-700 dark:text-neutral-300"}`}
                          >
                            {acc.name}
                          </p>
                          {acc.description && (
                            <p className="text-[10px] text-gray-400 dark:text-neutral-500 truncate mt-0.5">
                              {acc.description}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {paymentAccounts.length > 0 && !onlineProvider && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                      Please select an account to continue.
                    </p>
                  )}
                </div>
              )}

              {/* Cash-specific fields */}
              {paymentMethod === "CASH" &&
                (() => {
                  const exactAmt = Math.ceil(total);
                  const roundDenominations = [
                    100, 200, 500, 1000, 2000, 5000, 10000,
                  ];
                  const quickAmounts = [
                    exactAmt,
                    ...roundDenominations.filter((v) => v > exactAmt),
                  ].slice(0, 4);
                  const receivedNum = Number(amountReceived);
                  const isUnderpaid =
                    amountReceived !== "" &&
                    !isNaN(receivedNum) &&
                    receivedNum < total;
                  const isOverpaid =
                    amountReceived !== "" &&
                    !isNaN(receivedNum) &&
                    receivedNum >= total;
                  return (
                    <>
                      {/* Quick-amount presets */}
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
                          Quick amount
                        </label>
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
                          ref={amountReceivedInputRef}
                          type="number"
                          min="0"
                          step="1"
                          required={paymentMethod === "CASH"}
                          value={amountReceived}
                          onChange={(e) => setAmountReceived(e.target.value)}
                          placeholder={`Min. ${Math.ceil(total).toLocaleString()}`}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-base font-bold text-gray-900 dark:text-white placeholder:font-normal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                        />
                      </div>

                      {/* Change */}
                      {isOverpaid && (
                        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              Change
                            </span>
                          </div>
                          <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                            Rs {(receivedNum - total).toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Short-by warning */}
                      {isUnderpaid && (
                        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                              Short by
                            </span>
                          </div>
                          <span className="text-xl font-black text-red-700 dark:text-red-400 tabular-nums">
                            Rs {(total - receivedNum).toFixed(2)}
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
                  onClick={closeTakePaymentModal}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    paymentLoading ||
                    (paymentMethod === "CASH" &&
                      (amountReceived === "" ||
                        Number(amountReceived) < total)) ||
                    (paymentMethod === "ONLINE" && !onlineProvider)
                  }
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {paymentLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                    </>
                  ) : (
                    <>
                      <CircleCheckBig className="w-4 h-4" /> Record Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POS options modal (table, waiter, customer visibility per branch) */}
      {showPosTableSettingsModal && currentBranch?.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                POS options
              </h2>
              <button
                type="button"
                onClick={() => setShowPosTableSettingsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-neutral-400">
                Show or hide these fields for this branch in POS.
              </p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={posTableSettingsDraft}
                  onChange={(e) => setPosTableSettingsDraft(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Show table (optional) section
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={posWaiterSettingsDraft}
                  onChange={(e) => setPosWaiterSettingsDraft(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Show Waiter field
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={posCustomerSettingsDraft}
                  onChange={(e) =>
                    setPosCustomerSettingsDraft(e.target.checked)
                  }
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Show Select Customer field
                </span>
              </label>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-neutral-800 flex gap-2">
              <button
                type="button"
                onClick={() => setShowPosTableSettingsModal(false)}
                className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={posTableSettingsSaving}
                onClick={() => {
                  setPosTableSettingsSaving(true);
                  updateBranch(currentBranch.id, {
                    showTablePos: posTableSettingsDraft,
                    showWaiterPos: posWaiterSettingsDraft,
                    showCustomerPos: posCustomerSettingsDraft,
                  })
                    .then(() => {
                      setShowTablePos(posTableSettingsDraft);
                      setShowWaiterPos(posWaiterSettingsDraft);
                      setShowCustomerPos(posCustomerSettingsDraft);
                      toast.success("POS options saved");
                      setShowPosTableSettingsModal(false);
                    })
                    .catch((err) =>
                      toast.error(err?.message || "Failed to update"),
                    )
                    .finally(() => setPosTableSettingsSaving(false));
                }}
                className="flex-1 px-3 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
              >
                {posTableSettingsSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select / Add Customer Modal (search by phone, quick add if not found) */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-neutral-900/80 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Select Customer
              </h2>
              <button
                type="button"
                onClick={closeCustomerModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {customerModalError && (
                <p className="mb-3 text-sm text-red-600 dark:text-red-400">
                  {customerModalError}
                </p>
              )}

              <>
                <input
                  type="text"
                  placeholder="Search customer by phone..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setCustomerModalError("");
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white mb-3"
                />
                {customerModalLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {(() => {
                      const term = customerSearch.trim();
                      const filtered = customersList.filter((c) =>
                        !term ? true : (c.phone || "").includes(term),
                      );
                      if (filtered.length > 0) {
                        return (
                          <ul className="space-y-1">
                            {filtered.map((c) => (
                              <li key={c.id}>
                                {editingCustomerId === c.id ? (
                                  <div className="px-3 py-2.5 rounded-lg border border-primary/50 bg-primary/5 dark:bg-primary/10 space-y-2">
                                    <input
                                      type="text"
                                      value={editCustomerForm.name}
                                      onChange={(e) =>
                                        setEditCustomerForm((prev) => ({
                                          ...prev,
                                          name: e.target.value,
                                        }))
                                      }
                                      placeholder="Name"
                                      className="w-full px-2 py-1.5 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white"
                                    />
                                    <input
                                      type="text"
                                      value={editCustomerForm.phone}
                                      onChange={(e) =>
                                        setEditCustomerForm((prev) => ({
                                          ...prev,
                                          phone: e.target.value,
                                        }))
                                      }
                                      placeholder="Phone"
                                      className="w-full px-2 py-1.5 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white"
                                    />
                                    <input
                                      type="text"
                                      value={editCustomerForm.address}
                                      onChange={(e) =>
                                        setEditCustomerForm((prev) => ({
                                          ...prev,
                                          address: e.target.value,
                                        }))
                                      }
                                      placeholder={
                                        orderType === "DELIVERY" &&
                                        !deliveryZonesActive
                                          ? "Address *"
                                          : "Address"
                                      }
                                      className="w-full px-2 py-1.5 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        disabled={savingCustomer}
                                        onClick={async () => {
                                          if (!editCustomerForm.name.trim())
                                            return;
                                          if (
                                            orderType === "DELIVERY" &&
                                            !deliveryZonesActive &&
                                            !editCustomerForm.address.trim()
                                          ) {
                                            toast.error(
                                              "Address is required for delivery orders",
                                            );
                                            return;
                                          }
                                          setSavingCustomer(true);
                                          try {
                                            const updated =
                                              await updateCustomer(c.id, {
                                                name: editCustomerForm.name,
                                                phone: editCustomerForm.phone,
                                                address:
                                                  editCustomerForm.address,
                                              });
                                            setCustomersList((prev) =>
                                              prev.map((x) =>
                                                x.id === c.id
                                                  ? { ...x, ...updated }
                                                  : x,
                                              ),
                                            );
                                            setEditingCustomerId(null);
                                            toast.success("Customer updated");
                                          } catch (err) {
                                            toast.error(
                                              err.message ||
                                                "Failed to update customer",
                                            );
                                          } finally {
                                            setSavingCustomer(false);
                                          }
                                        }}
                                        className="flex-1 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-semibold disabled:opacity-50"
                                      >
                                        {savingCustomer ? "Saving…" : "Save"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditingCustomerId(null)
                                        }
                                        className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-neutral-700 text-xs text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="group relative flex items-center px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (
                                          orderType === "DELIVERY" &&
                                          deliveryZonesActive &&
                                          !deliveryLocationId
                                        ) {
                                          toast.error(
                                            "Select a delivery area first",
                                          );
                                          return;
                                        }
                                        if (
                                          orderType === "DELIVERY" &&
                                          !deliveryZonesActive &&
                                          !c.address?.trim()
                                        ) {
                                          setEditingCustomerId(c.id);
                                          setEditCustomerForm({
                                            name: c.name || "",
                                            phone: c.phone || "",
                                            address: c.address || "",
                                          });
                                          toast.error(
                                            "Please add an address for delivery",
                                          );
                                          return;
                                        }
                                        selectCustomerForOrder(c);
                                      }}
                                      className="flex-1 text-left text-sm"
                                    >
                                      <div>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                          {c.name}
                                        </span>
                                        {c.phone && (
                                          <span className="text-gray-500 dark:text-neutral-400 ml-2">
                                            {c.phone}
                                          </span>
                                        )}
                                      </div>
                                      {c.address && (
                                        <p className="text-xs text-gray-400 dark:text-neutral-500 truncate mt-0.5">
                                          {c.address}
                                        </p>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCustomerId(c.id);
                                        setEditCustomerForm({
                                          name: c.name || "",
                                          phone: c.phone || "",
                                          address: c.address || "",
                                        });
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-400 hover:text-primary transition-all flex-shrink-0"
                                      title="Edit customer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        );
                      }

                      if (!term) {
                        return customersList.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-neutral-400 py-4">
                            No customers yet. Start by adding a new customer.
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-neutral-400 py-4">
                            Type a phone number to search or add.
                          </p>
                        );
                      }

                      // No match for this phone – quick add
                      return (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-500 dark:text-neutral-400">
                            No customer found for this phone. Add a new
                            customer.
                          </p>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">
                              Phone
                            </label>
                            <div className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-sm text-gray-900 dark:text-white">
                              {term}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">
                              Name *
                            </label>
                            <input
                              type="text"
                              value={quickCustomerName}
                              onChange={(e) =>
                                setQuickCustomerName(e.target.value)
                              }
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white"
                              placeholder="Customer name"
                            />
                          </div>
                          {orderType === "DELIVERY" &&
                            deliveryZones.length > 0 && (
                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">
                                  Delivery area *
                                </label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={
                                      deliveryZoneOpen
                                        ? deliveryZoneQuery
                                        : selectedDeliveryZoneLabel
                                    }
                                    onFocus={() => {
                                      setDeliveryZoneOpen(true);
                                      setDeliveryZoneQuery("");
                                    }}
                                    onBlur={() =>
                                      setTimeout(
                                        () => setDeliveryZoneOpen(false),
                                        120,
                                      )
                                    }
                                    onChange={(e) => {
                                      setDeliveryZoneQuery(e.target.value);
                                      setDeliveryZoneOpen(true);
                                    }}
                                    placeholder="Search delivery area..."
                                    className="w-full px-3 pr-8 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white"
                                  />
                                  <ChevronDown
                                    className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform ${deliveryZoneOpen ? "rotate-180" : ""}`}
                                  />
                                  {deliveryZoneOpen && (
                                    <div className="absolute z-40 bottom-full mb-1 w-full max-h-52 overflow-auto rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDeliveryLocationId("");
                                          setDeliveryZoneQuery("");
                                          setDeliveryZoneOpen(false);
                                        }}
                                        className="w-full px-3 py-2 text-left text-sm text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800"
                                      >
                                        — Select delivery area —
                                      </button>
                                      {filteredDeliveryZones.map((z) => (
                                        <button
                                          key={z.id}
                                          type="button"
                                          onClick={() => {
                                            setDeliveryLocationId(z.id);
                                            setDeliveryZoneQuery("");
                                            setDeliveryZoneOpen(false);
                                          }}
                                          className="w-full px-3 py-2 text-left text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-neutral-800"
                                        >
                                          {z.name} — Rs{" "}
                                          {Number(z.fee || 0).toFixed(2)}
                                        </button>
                                      ))}
                                      {filteredDeliveryZones.length === 0 && (
                                        <div className="px-3 py-2 text-sm text-gray-500 dark:text-neutral-400">
                                          No matching area
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          <button
                            type="button"
                            onClick={handleQuickAddCustomer}
                            disabled={addingQuickCustomer}
                            className="w-full px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
                          >
                            {addingQuickCustomer ? "Adding…" : "Add Customer"}
                          </button>
                        </div>
                      );
                    })()}
                  </>
                )}
              </>
            </div>
          </div>
        </div>
      )}

      {/* Floating help button - bottom right */}
      <button
        type="button"
        onClick={() => setShowShortcutsModal(true)}
        className="fixed bottom-3 right-3 z-40 p-0.5 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all flex items-center justify-center"
        title="Keyboard shortcuts"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {/* Keyboard shortcuts info modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Keyboard shortcuts
              </h2>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3 text-sm">
              <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3">
                Use Ctrl (Windows/Linux) or Cmd (Mac) + Shift + key.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">
                    Focus menu search &amp; filter items
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">
                      0–9
                    </kbd>
                    <span className="text-gray-400 text-xs">or</span>
                    <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">
                      Ctrl+Shift+M
                    </kbd>
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">
                    Add highlighted search result
                  </span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">
                    Enter
                  </kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">
                    Focus order search
                  </span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">
                    Ctrl+Shift+O
                  </kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">
                    Save / Place order
                  </span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">
                    Ctrl+S
                  </kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">
                    Payment by Cash
                  </span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">
                    Ctrl+Shift+C
                  </kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">
                    Payment by Card
                  </span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">
                    Ctrl+Shift+D
                  </kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">
                    Payment by Online
                  </span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">
                    Ctrl+Shift+N
                  </kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">
                    Print menu bill
                  </span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">
                    Ctrl+Shift+B
                  </kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">
                    Print payment bill
                  </span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">
                    Ctrl+Shift+R
                  </kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">
                    Order type: Dine In
                  </span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">
                    Ctrl+Shift+E
                  </kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">
                    Order type: Take
                  </span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">
                    Ctrl+Shift+A
                  </kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">
                    Order type: Delivery
                  </span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">
                    Ctrl+Shift+L
                  </kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">
                    Close modal or clear cart
                  </span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">
                    Esc
                  </kbd>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="w-full px-3 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Past Session History Modal (read-only legacy view) */}
      {showDayHistoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Past Sessions
                </h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                  {currentBranch
                    ? `History for ${currentBranch.name}`
                    : "All branches"}{" "}
                  — sessions before the day reset time
                </p>
              </div>
              <button
                onClick={() => setShowDayHistoryModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors text-3xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingDayHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : daySessionHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-neutral-400 text-sm">
                  No past sessions found
                </div>
              ) : (
                daySessionHistory.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s.status === "OPEN" ? "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400"}`}
                        >
                          {s.status === "OPEN" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                          )}
                          {s.status}
                        </span>
                        {!currentBranch && s.branchName && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                            {s.branchName}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                          Rs {(s.totalSales || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-neutral-400">
                          {s.totalOrders || 0} orders
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-neutral-400 space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium">Started:</span>
                        <span>
                          {new Date(s.startAt).toLocaleString("en-PK", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                      </div>
                      {s.endAt && (
                        <div className="flex justify-between">
                          <span className="font-medium">Ended:</span>
                          <span>
                            {new Date(s.endAt).toLocaleString("en-PK", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* End Day Modal */}
      {showEndDayModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !endingDay)
              setShowEndDayModal(false);
          }}
        >
          <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <Power className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                    End Business Day
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!endingDay) setShowEndDayModal(false);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              {loadingCurrentSession ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : currentSession ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-neutral-400">
                    Are you sure you want to end today&apos;s session?
                    Here&apos;s the current summary:
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800">
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase tracking-wide font-semibold mb-0.5">
                        Revenue
                      </p>
                      <p className="text-base font-bold text-gray-900 dark:text-white">
                        Rs {(currentSession.totalSales || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800">
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase tracking-wide font-semibold mb-0.5">
                        Orders
                      </p>
                      <p className="text-base font-bold text-gray-900 dark:text-white">
                        {currentSession.totalOrders || 0}
                      </p>
                    </div>
                  </div>
                  {currentSession.startAt && (
                    <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                      Session started{" "}
                      {new Date(currentSession.startAt).toLocaleString(
                        "en-PK",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        },
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-neutral-400 py-2">
                  Are you sure you want to end the current business day? New
                  orders will start a fresh session.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2.5 px-5 pb-5">
              <button
                type="button"
                onClick={() => {
                  if (!endingDay) setShowEndDayModal(false);
                }}
                disabled={endingDay}
                className="flex-1 h-9 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndDay}
                disabled={endingDay}
                className="flex-1 h-9 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {endingDay ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Power className="w-3.5 h-3.5" />
                )}
                {endingDay ? "Ending…" : "End Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDiscountModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowDiscountModal(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowDiscountModal(false);
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-discount-modal-title"
          >
            <div className="px-4 py-3 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2
                  id="pos-discount-modal-title"
                  className="text-sm font-bold text-gray-900 dark:text-white"
                >
                  Order discount
                </h2>
                <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-0.5">
                  Presets from Business settings. Reason is required when a
                  discount applies.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDiscountModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[min(80vh,520px)] overflow-y-auto">
              <div>
                <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide mb-1.5">
                  Preset
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {mergedDiscountPresets.map((p) => {
                    const pct = Number(p.percent) || 0;
                    const pinRequired = !Boolean(p.cashierAllowed);
                    const sel =
                      !dmCustomOpen &&
                      Math.round(dmPct) === Math.round(Number(p.percent) || 0) &&
                      dmLabel === p.label;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setDmCustomOpen(false);
                          setDmCustomStr("");
                          setDmPct(Number(p.percent) || 0);
                          setDmLabel(String(p.label || ""));
                        }}
                        className={`px-2.5 py-2 rounded-lg border text-left text-xs font-semibold transition-colors ${
                          sel
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-gray-200 dark:border-neutral-700 text-gray-800 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {p.label}
                          {pinRequired ? (
                            <Lock className="w-3 h-3 text-amber-500" />
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setDmCustomOpen(true);
                      setDmLabel("");
                      setDmPct(0);
                    }}
                    className={`px-2.5 py-2 rounded-lg border text-left text-xs font-semibold transition-colors ${
                      dmCustomOpen
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-gray-200 dark:border-neutral-700 text-gray-800 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      Custom %
                      <Lock className="w-3 h-3 text-amber-500" />
                    </span>
                  </button>
                </div>
              </div>
              {dmCustomOpen && (
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400">
                    Custom percent (0–100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={dmCustomStr}
                    onChange={(e) => setDmCustomStr(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white"
                    placeholder="e.g. 15"
                  />
                </div>
              )}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400">
                  Reason
                </label>
                <select
                  value={dmReason}
                  onChange={(e) => setDmReason(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">Select reason…</option>
                  {posDiscountReasonOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {(() => {
                const previewPct = dmCustomOpen
                  ? Math.min(100, Math.max(0, Number(dmCustomStr) || 0))
                  : Math.min(100, Math.max(0, Number(dmPct) || 0));
                const previewLabel = dmCustomOpen
                  ? (previewPct ? `Custom (${previewPct}%)` : "")
                  : dmLabel;
                const requiresPin = getDiscountPinRequirement({
                  pct: previewPct,
                  label: previewLabel,
                  customOpen: dmCustomOpen,
                });
                const showPin = requiresPin && posDiscountPinConfigured;
                if (!showPin) return null;
                return (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-900/20 p-3">
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      <Lock className="w-3 h-3" />
                      Manager PIN Required
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={dmPin}
                      onChange={(e) => {
                        setDmPin(e.target.value.replace(/[^\d]/g, "").slice(0, 6));
                        if (dmPinError) setDmPinError("");
                      }}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white"
                      placeholder="Enter PIN"
                    />
                    {dmPinError ? (
                      <p className="mt-1 text-xs text-red-500">{dmPinError}</p>
                    ) : null}
                  </div>
                );
              })()}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDmPct(0);
                    setDmLabel("");
                    setDmReason("");
                    setDmPin("");
                    setDmPinError("");
                    setDmCustomOpen(false);
                    setDmCustomStr("");
                  }}
                  className="flex-1 h-10 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => void commitDiscountModal()}
                  disabled={(() => {
                    const previewPct = dmCustomOpen
                      ? Math.min(100, Math.max(0, Number(dmCustomStr) || 0))
                      : Math.min(100, Math.max(0, Number(dmPct) || 0));
                    const previewLabel = dmCustomOpen
                      ? (previewPct ? `Custom (${previewPct}%)` : "")
                      : dmLabel;
                    const requiresPin = getDiscountPinRequirement({
                      pct: previewPct,
                      label: previewLabel,
                      customOpen: dmCustomOpen,
                    });
                    const mustPin = requiresPin && posDiscountPinConfigured;
                    return mustPin && !dmPin.trim();
                  })()}
                  className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBranchModal && branches?.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      Select Branch
                    </h2>
                    <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-0.5">
                      Choose a branch to continue
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-3 max-h-[320px] overflow-y-auto space-y-1.5">
              {branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setCurrentBranch(b);
                    setShowBranchModal(false);
                    toast.success(`Switched to ${b.name}`);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all border-2 border-transparent hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 active:scale-[0.98]"
                >
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {b.name}
                    </p>
                    {b.address && (
                      <p className="text-[11px] text-gray-400 dark:text-neutral-500 truncate">
                        {b.address}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Order Confirmation Popup ─────────────────────────────── */}
      {orderConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200/70 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-2xl shadow-black/20">
            <div className="px-6 pt-6 pb-5 border-b border-gray-100 dark:border-neutral-800 bg-gradient-to-b from-white to-gray-50/60 dark:from-neutral-950 dark:to-neutral-900/30">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center shadow-inner">
                  <CircleCheckBig className="w-7 h-7 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight">
                    Order Sent to Kitchen
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-neutral-400">
                    {orderConfirmation.orderNumber
                      ? `#${orderConfirmation.orderNumber}`
                      : "Order created"}
                  </p>
                </div>
              </div>
              {orderConfirmation.total && (
                <div className="mt-4 rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 px-4 py-3 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-gray-500 dark:text-neutral-400 text-center">
                    Bill Total
                  </p>
                  <p className="text-4xl font-black text-gray-900 dark:text-white mt-1 tabular-nums leading-none text-center">
                    Rs{" "}
                    {Math.round(
                      Number(orderConfirmation.total),
                    ).toLocaleString()}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                {orderConfirmation.orderType && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400">
                    {orderConfirmation.orderType === "DINE_IN"
                      ? "Dine In"
                      : orderConfirmation.orderType === "DELIVERY"
                        ? "Delivery"
                        : "Takeaway"}
                  </span>
                )}
                {orderConfirmation.tableName && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">
                    {orderConfirmation.tableName}
                  </span>
                )}
                {orderConfirmation.customerName && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-50 dark:bg-neutral-900 text-gray-500 dark:text-neutral-400">
                    {orderConfirmation.customerName}
                  </span>
                )}
              </div>
            </div>
            <div className="px-6 pb-6 pt-4 space-y-3 bg-white dark:bg-neutral-950">
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const id = orderConfirmation.orderId;
                    const openEditOrder = () => {
                      setOrderConfirmation(null);
                      if (!id) return;
                      setEditingOrderId(id);
                      getOrder(id)
                        .then((order) => {
                          setEditingOrder(order);
                          const items = order.items || [];
                          const menuItems = menu.items || [];
                          const cartItems = items.map((it) => {
                            const menuItemId = it.menuItemId || null;
                            let itemId = menuItemId;
                            let price = it.unitPrice ?? 0;
                            let imageUrl = "";
                            if (!itemId) {
                              const byName = menuItems.find(
                                (m) =>
                                  (m.name || "").toLowerCase() ===
                                  (it.name || "").toLowerCase(),
                              );
                              if (byName) {
                                itemId = byName.id;
                                price =
                                  byName.finalPrice ?? byName.price ?? price;
                                imageUrl = byName.imageUrl || "";
                              } else {
                                itemId = `edit-${it.name}-${Math.random().toString(36).slice(2)}`;
                              }
                            } else {
                              const mi = menuItems.find(
                                (m) => (m.id || m._id) === itemId,
                              );
                              if (mi) {
                                imageUrl = mi.imageUrl || "";
                                price = mi.finalPrice ?? mi.price ?? price;
                              }
                            }
                            return {
                              id: itemId,
                              name: it.name,
                              price,
                              quantity: it.qty ?? 1,
                              imageUrl,
                            };
                          });
                          setCart(cartItems);
                          setCustomerName(order.customerName || "");
                          setCustomerPhone(order.customerPhone || "");
                          setCustomerAddress(order.deliveryAddress || "");
                          setOrderType(
                            order.orderType === "TAKEAWAY" ||
                              order.type === "takeaway"
                              ? "TAKEAWAY"
                              : order.orderType === "DELIVERY" ||
                                  order.type === "delivery"
                                ? "DELIVERY"
                                : "DINE_IN",
                          );
                          setDeliveryLocationId(order.deliveryLocationId || "");
                          setEditSessionDeliveryCharges(
                            Math.max(0, Number(order.deliveryCharges) || 0),
                          );
                          setTableName(order.tableName || "");
                          const mp2 = Number(order.posManualDiscountPercent);
                          if (Number.isFinite(mp2) && mp2 > 0) {
                            setManualDiscountPercent(Math.min(100, Math.max(0, mp2)));
                            setDiscountReason(
                              String(order.posDiscountReason || "").trim(),
                            );
                            setDiscountPresetLabel(
                              String(order.posDiscountPresetLabel || "").trim(),
                            );
                          } else {
                            setManualDiscountPercent(0);
                            setDiscountReason("");
                            setDiscountPresetLabel("");
                          }
                          setManagerDiscountPin("");
                        })
                        .catch(() => {});
                    };
                    handleNavigateAwayFromEdit(openEditOrder);
                  }}
                  className="h-10 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const o = orderConfirmation.printOrder;
                    if (!o) {
                      toast.error("Order details not available for printing");
                      return;
                    }
                    openPrintBill(o, "bill");
                  }}
                  className="h-10 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderConfirmation(null);
                    handleNavigateAwayFromEdit(() => onClose?.());
                  }}
                  className="h-10 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-neutral-950 text-blue-700 dark:text-blue-400 text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  View Orders
                </button>
              </div>
              <button
                type="button"
                onClick={() => setOrderConfirmation(null)}
                className="h-11 w-full rounded-xl bg-primary text-white text-base font-bold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showDiscardDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                You have unsaved changes
              </h3>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
                You are editing order #
                {editingOrder?.orderNumber || editingOrderId}. Leave and discard
                current edits?
              </p>
            </div>
            <div className="px-5 py-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDiscardDialog(false);
                  pendingNavigationRef.current = null;
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-neutral-300"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  const runAfter = pendingNavigationRef.current;
                  pendingNavigationRef.current = null;
                  setShowDiscardDialog(false);
                  resetEditOrderState();
                  if (typeof runAfter === "function") runAfter();
                }}
                className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
              >
                Discard & Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
