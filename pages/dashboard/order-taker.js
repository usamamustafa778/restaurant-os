import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  getMenu,
  getDeals,
  createPosOrder,
  getTables,
  getOrders,
  getStoredAuth,
  clearStoredAuth,
  SubscriptionInactiveError,
  updateOrder,
  updateOrderStatus,
} from "../../lib/apiClient";
import { useBranch } from "../../contexts/BranchContext";
import { useSocket } from "../../contexts/SocketContext";
import { useTheme } from "../../contexts/ThemeContext";
import { usePermissions } from "../../contexts/PermissionContext";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Loader2,
  Utensils,
  X,
  Search,
  Send,
  Check,
  User,
  Phone,
  ArrowRight,
  Coffee,
  Hash,
  ClipboardList,
  ChefHat,
  Clock,
  Bell,
  PackageCheck,
  MapPin,
  Home,
  Package,
  RefreshCw,
  Wallet,
  Sun,
  Moon,
  Tag,
  CheckCircle,
  Lock,
} from "lucide-react";
import toast from "react-hot-toast";
import SEO from "../../components/SEO";
import PosDealCustomizeModal from "../../components/pos/PosDealCustomizeModal";
import {
  buildDealSelectionsFingerprint,
  isDealConfigurable,
} from "../../lib/dealComboItems";
import { mapPosCartLineToOrderUpdatePayload } from "../../lib/modifier-pricing";

const STEPS = { TABLE: "table", MENU: "menu", CART: "cart" };
const TABS = {
  HOME: "home",
  NEW_ORDER: "new_order",
  ACTIVE: "active",
  HISTORY: "history",
};

function isBranchRequiredError(msg) {
  return (
    typeof msg === "string" &&
    msg.toLowerCase().includes("branchid") &&
    msg.toLowerCase().includes("required")
  );
}

function getOrderTotal(order) {
  return Number(order.grandTotal ?? order.total) || 0;
}

function getPaymentStatus(order) {
  if (order.status === "CANCELLED") return "cancelled";
  if (order.source === "FOODPANDA") return "paid";
  if (order.paymentAmountReceived != null) {
    const gross = Number(order.paymentAmountReceived) || 0;
    const returned = Number(order.paymentAmountReturned) || 0;
    if (gross - returned >= getOrderTotal(order)) return "paid";
  }
  const paymentMethod = String(order.paymentMethod || "").toUpperCase();
  if (
    paymentMethod === "CASH" ||
    paymentMethod === "CARD" ||
    paymentMethod === "ONLINE" ||
    paymentMethod === "SPLIT" ||
    paymentMethod === "FOODPANDA"
  ) {
    return "paid";
  }
  return "unpaid";
}

function isOrderLocked(order) {
  const status = String(order?.status || "").toUpperCase();
  if (status === "CANCELLED") return true;
  const paid = getPaymentStatus(order) === "paid";
  const delivered = status === "DELIVERED";
  return paid && delivered;
}

function isServedUnpaidOrder(order) {
  if (!order) return false;
  const status = String(order?.status || "").toUpperCase();
  if (!["READY", "DELIVERED", "COMPLETED"].includes(status)) return false;
  return getPaymentStatus(order) === "unpaid";
}

function canEditOrderNotes(order) {
  if (isOrderLocked(order)) return false;
  const status = String(order?.status || "").toUpperCase();
  if (status === "CANCELLED" || status === "OUT_FOR_DELIVERY") return false;
  return true;
}

function mapOrderItemsForUpdate(items = []) {
  return items.map((item) => ({
    menuItemId: item.menuItemId || item.menuItem || null,
    name: item.name || "Item",
    quantity: Math.max(1, Number(item.quantity ?? item.qty) || 1),
    unitPrice: Number(item.unitPrice) || 0,
    note: item.note || "",
    variantLabel: item.variantLabel || item.size || "",
    modifierSelections: item.modifierSelections || [],
    lineSource: item.lineSource || undefined,
    isAddition: item.isAddition || false,
    addedAt: item.addedAt || null,
    itemStatus: item.itemStatus ?? null,
  }));
}

export default function OrderTakerPage() {
  const {
    currentBranch,
    branches,
    setCurrentBranch,
    loading: branchLoading,
  } = useBranch() || {};
  const { socket } = useSocket() || {};
  const { theme, toggleTheme } = useTheme() || {
    theme: "light",
    toggleTheme: () => {},
  };
  const { hasPermission } = usePermissions();
  const canEditAfterServed = hasPermission("orders.edit_after_served");
  const canAddItemsAfterServed = hasPermission("orders.add_items_after_served");

  const [activeTab, setActiveTab] = useState(TABS.HOME);
  const [step, setStep] = useState(STEPS.TABLE);
  const [menu, setMenu] = useState({ categories: [], items: [] });
  const [availableDeals, setAvailableDeals] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [cart, setCart] = useState([]);
  const [modifierPickerItem, setModifierPickerItem] = useState(null);
  const [modifierSelections, setModifierSelections] = useState({});
  const [dealCustomizeTarget, setDealCustomizeTarget] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null);
  const [userName, setUserName] = useState("");
  const searchRef = useRef(null);
  const categoryScrollRef = useRef(null);
  const menuLoadSeqRef = useRef(0);
  const dealsLoadSeqRef = useRef(0);
  const cartBadge = cart.reduce((sum, i) => sum + i.quantity, 0);

  const canAppendItemsToOrder = useCallback(
    (order) => {
      if (!isServedUnpaidOrder(order)) return true;
      return canEditAfterServed || canAddItemsAfterServed;
    },
    [canEditAfterServed, canAddItemsAfterServed],
  );

  // Active orders state
  const [activeOrders, setActiveOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("new");
  const [historyFilter, setHistoryFilter] = useState("pending_payment");
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [expandedOrderIds, setExpandedOrderIds] = useState([]);
  const [appendTargetOrder, setAppendTargetOrder] = useState(null);
  const [appendEditDetailsOnly, setAppendEditDetailsOnly] = useState(false);
  const [appendingOrderId, setAppendingOrderId] = useState(null);
  const [existingItemsOpen, setExistingItemsOpen] = useState(false);
  const [markingServedId, setMarkingServedId] = useState(null);
  const [savingItemNoteKey, setSavingItemNoteKey] = useState(null);
  const [otCustomerName, setOtCustomerName] = useState("");
  const [otCustomerPhone, setOtCustomerPhone] = useState("");
  const [otTableName, setOtTableName] = useState("");

  const appendCanModifyItems =
    !appendTargetOrder || canAppendItemsToOrder(appendTargetOrder);
  const appendAddOnlyMode =
    !!appendTargetOrder &&
    isServedUnpaidOrder(appendTargetOrder) &&
    canAddItemsAfterServed &&
    !canEditAfterServed;

  useEffect(() => {
    const auth = getStoredAuth();
    setUserName(auth?.user?.name || auth?.user?.email || "");
  }, []);

  useEffect(() => {
    if (branchLoading) return;
    if (branches.length > 0 && !currentBranch) return;

    let cancelled = false;
    const menuSeq = ++menuLoadSeqRef.current;
    const dealsSeq = ++dealsLoadSeqRef.current;

    async function load() {
      setLoading(true);
      try {
        const branchId = currentBranch?.id;
        const menuData = await getMenu(
          branchId && branchId !== "all" ? branchId : undefined,
        );
        if (cancelled || menuSeq !== menuLoadSeqRef.current) return;
        setMenu(menuData || { categories: [], items: [] });

        try {
          const allDeals = await getDeals(false);
          if (cancelled || dealsSeq !== dealsLoadSeqRef.current) return;
          const deals = Array.isArray(allDeals)
            ? allDeals.filter((d) => {
                if (!d.isActive) return false;
                if (d.endDate && new Date(d.endDate) < new Date()) return false;
                if (branchId && d.branches?.length > 0) {
                  return d.branches.some(
                    (b) => String(b._id || b) === String(branchId),
                  );
                }
                return true;
              })
            : [];
          setAvailableDeals(deals);
        } catch {
          if (!cancelled && dealsSeq === dealsLoadSeqRef.current)
            setAvailableDeals([]);
        }

        const tbl = await getTables();
        if (cancelled || menuSeq !== menuLoadSeqRef.current) return;
        setTables(Array.isArray(tbl) ? tbl : []);
      } catch (err) {
        if (cancelled || menuSeq !== menuLoadSeqRef.current) return;
        if (err instanceof SubscriptionInactiveError) {
          toast.error("Subscription inactive");
        } else {
          toast.error(err.message || "Failed to load data");
        }
      } finally {
        if (!cancelled && menuSeq === menuLoadSeqRef.current) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentBranch?.id, branchLoading, branches.length]);

  // Fetch orders created by this user (active + history)
  const fetchActiveOrders = useCallback(async () => {
    try {
      const data = await getOrders({ mine: true, openSession: true });
      const list = Array.isArray(data) ? data : (data?.orders ?? []);
      setActiveOrders(list);
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

  const dealMenuItems = useMemo(
    () =>
      (availableDeals || [])
        .filter((d) => d.dealType === "COMBO")
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

  const visibleCategories = useMemo(() => {
    const catIds = new Set(
      allMenuItems
        .filter((i) => i.categoryId && !i.isDeal)
        .map((i) => String(i.categoryId)),
    );
    return (menu.categories || []).filter((c) =>
      catIds.has(String(c.id || c._id)),
    );
  }, [menu.categories, allMenuItems]);

  const filteredItems = useMemo(() => {
    return allMenuItems.filter((item) => {
      if (item.available === false || item.finalAvailable === false)
        return false;
      const matchCat =
        selectedCategory === "all" ||
        (selectedCategory === "deals"
          ? item.isDeal
          : item.categoryId === selectedCategory);
      const matchSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const isAvailable = item.finalAvailable ?? item.available;
      return matchCat && matchSearch && isAvailable !== false;
    });
  }, [allMenuItems, selectedCategory, searchQuery]);

  useEffect(() => {
    if (selectedCategory === "deals" && dealMenuItems.length === 0) {
      setSelectedCategory("all");
    }
  }, [selectedCategory, dealMenuItems.length]);

  const getCartQty = useCallback(
    (itemId) => cart.find((c) => c.id === itemId)?.quantity || 0,
    [cart],
  );

  function addDealToCart(deal, qty = 1, selectionsBySlot = {}) {
    if (appendTargetOrder && !appendCanModifyItems) {
      toast.error("You don't have permission to edit this order.");
      return;
    }
    const dealId = deal._id || deal.id;
    const fingerprint = buildDealSelectionsFingerprint(deal, selectionsBySlot);
    const cartKey = `deal-${dealId}${fingerprint ? `|${fingerprint}` : ""}`;
    const quantity = Math.max(1, Math.floor(Number(qty)) || 1);
    setCart((prev) => {
      const existing = prev.find((c) => (c._cartKey || c.id) === cartKey);
      if (existing) {
        return prev.map((c) =>
          (c._cartKey || c.id) === cartKey
            ? { ...c, quantity: c.quantity + quantity }
            : c,
        );
      }
      return [
        ...prev,
        {
          id: `deal-${dealId}`,
          _cartKey: cartKey,
          name: deal.name,
          price: deal.comboPrice || 0,
          quantity,
          imageUrl: deal.imageUrl || "",
          isDeal: true,
          _dealId: dealId,
          _dealSelections: selectionsBySlot,
        },
      ];
    });
    setDealCustomizeTarget(null);
  }

  function addToCart(item, qty = 1) {
    if (appendTargetOrder && !appendCanModifyItems) {
      toast.error("You don't have permission to edit this order.");
      return;
    }
    if (
      !item.isDeal &&
      (item.inventorySufficient === false ||
        item.inventorySufficient === "false")
    ) {
      toast.error(`${item.name} is out of stock`);
      return;
    }
    if (item.isDeal) {
      const deal = availableDeals.find(
        (d) => `deal-${d._id || d.id}` === item.id,
      );
      if (deal && isDealConfigurable(deal)) {
        setDealCustomizeTarget({ deal, qty });
        return;
      }
    }
    // If item has modifiers, open picker instead of adding directly
    if (item.hasModifiers && item.modifierGroups?.length > 0) {
      setModifierPickerItem({ ...item, _pendingQty: qty });
      setModifierSelections({});
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      const unit = item.isDeal
        ? (item.price ?? 0)
        : (item.effectivePrice ?? item.finalPrice ?? item.price ?? 0);
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: unit,
          quantity: qty,
          imageUrl: item.imageUrl || "",
          isDeal: !!item.isDeal,
        },
      ];
    });
  }

  function confirmModifierSelection() {
    const item = modifierPickerItem;
    if (!item) return;
    if (appendTargetOrder && !appendCanModifyItems) {
      toast.error("You don't have permission to edit this order.");
      return;
    }
    const qty = Math.max(1, Math.floor(Number(item._pendingQty)) || 1);

    const selectionFingerprint = Object.entries(modifierSelections)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([gId, opts]) =>
          gId +
          ":" +
          opts
            .map((o) => o.optionId)
            .sort()
            .join(","),
      )
      .join("|");
    const cartKey =
      item.id + (selectionFingerprint ? "|" + selectionFingerprint : "");

    const requiredGroups = (item.modifierGroups || []).filter(
      (g) => g.required,
    );
    const optionalGroups = (item.modifierGroups || []).filter(
      (g) => !g.required,
    );
    const requiredTotal = requiredGroups.reduce((sum, g) => {
      const sel = modifierSelections[g.id] || [];
      return sum + sel.reduce((s, o) => s + (o.price || 0), 0);
    }, 0);
    const optionalTotal = optionalGroups.reduce((sum, g) => {
      const sel = modifierSelections[g.id] || [];
      return sum + sel.reduce((s, o) => s + (o.price || 0), 0);
    }, 0);
    let unitPrice;
    if (requiredGroups.length > 0 && requiredTotal > 0) {
      unitPrice = requiredTotal + optionalTotal;
    } else {
      unitPrice = (item.finalPrice ?? item.price) + optionalTotal;
    }

    const allSelectedNames = Object.values(modifierSelections)
      .flat()
      .map((o) => o.name);
    const variantLabel = allSelectedNames.join(", ") || "Regular";

    const modifierSelectionsForOrder = (item.modifierGroups || [])
      .map((g) => {
        const selected = modifierSelections[g.id] || [];
        if (selected.length === 0) return null;
        return {
          groupId: g.id,
          groupName: g.groupName,
          options: selected.map((o) => ({
            optionId: o.optionId,
            name: o.name,
            price: o.price,
          })),
        };
      })
      .filter(Boolean);

    setCart((prev) => {
      const existing = prev.findIndex((c) => c._cartKey === cartKey);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = {
          ...next[existing],
          quantity: next[existing].quantity + qty,
        };
        return next;
      }
      return [
        ...prev,
        {
          id: item.id,
          _cartKey: cartKey,
          name: item.name,
          price: unitPrice,
          quantity: qty,
          imageUrl: item.imageUrl || "",
          isDeal: false,
          size: variantLabel,
          modifierGroups: item.modifierGroups,
          _modifierSelectionsForOrder: modifierSelectionsForOrder,
        },
      ];
    });
    setModifierPickerItem(null);
    setModifierSelections({});
  }

  function isModifierSelectionComplete() {
    if (!modifierPickerItem) return false;
    const requiredGroups = (modifierPickerItem.modifierGroups || []).filter(
      (g) => g.required,
    );
    return requiredGroups.every(
      (g) => (modifierSelections[g.id] || []).length > 0,
    );
  }

  function updateQty(cartKey, delta) {
    if (appendTargetOrder && !appendCanModifyItems) {
      toast.error("You don't have permission to edit this order.");
      return;
    }
    setCart((prev) =>
      prev
        .map((c) =>
          (c._cartKey || c.id) === cartKey
            ? { ...c, quantity: Math.max(0, c.quantity + delta) }
            : c,
        )
        .filter((c) => c.quantity > 0),
    );
  }

  function addNoteToItem(cartKey) {
    const item = cart.find((c) => (c._cartKey || c.id) === cartKey);
    const existing = item?.note || "";
    const note = window.prompt("Add special instructions for this item:", existing);
    if (note === null) return;
    setCart((prev) =>
      prev.map((c) =>
        (c._cartKey || c.id) === cartKey ? { ...c, note: note.trim() } : c,
      ),
    );
  }

  function addNoteToExistingOrderItem(itemIndex) {
    if (!appendTargetOrder) return;
    const items = appendTargetOrder.items || [];
    const item = items[itemIndex];
    if (!item) return;
    const existing = item.note || "";
    const note = window.prompt("Add special instructions for this item:", existing);
    if (note === null) return;
    const trimmed = note.trim();
    setAppendTargetOrder((prev) => {
      if (!prev) return prev;
      const nextItems = (prev.items || []).map((it, idx) =>
        idx === itemIndex ? { ...it, note: trimmed } : it,
      );
      return { ...prev, items: nextItems };
    });
  }

  async function saveOrderItemNote(order, itemIndex) {
    const orderId = order?._id || order?.id;
    if (!orderId || !canEditOrderNotes(order)) return;
    const items = order.items || [];
    const item = items[itemIndex];
    if (!item) return;
    const existing = item.note || "";
    const note = window.prompt("Add special instructions for this item:", existing);
    if (note === null) return;
    const trimmed = note.trim();
    const noteKey = `${orderId}-${itemIndex}`;
    setSavingItemNoteKey(noteKey);
    try {
      const payloadItems = mapOrderItemsForUpdate(items).map((it, idx) =>
        idx === itemIndex ? { ...it, note: trimmed } : it,
      );
      const updated = await updateOrder(orderId, { items: payloadItems });
      setActiveOrders((prev) =>
        prev.map((o) =>
          o.id === order.id || o._id === order._id ? { ...o, ...updated } : o,
        ),
      );
      setAppendTargetOrder((prev) => {
        if (!prev) return prev;
        if (prev.id !== order.id && prev._id !== order._id) return prev;
        return { ...prev, ...updated };
      });
      toast.success(trimmed ? "Note saved" : "Note removed");
    } catch (err) {
      toast.error(err.message || "Could not save note");
    } finally {
      setSavingItemNoteKey(null);
    }
  }

  function removeFromCart(cartKey) {
    setCart((prev) => prev.filter((c) => (c._cartKey || c.id) !== cartKey));
  }

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const existingOrderTotal = appendTargetOrder
    ? Math.round(
        Number(appendTargetOrder.grandTotal ?? appendTargetOrder.total) || 0,
      )
    : 0;
  const newItemsSubtotal = subtotal;
  const appendCombinedTotal = appendTargetOrder
    ? existingOrderTotal + newItemsSubtotal
    : subtotal;
  const existingItemCount = appendTargetOrder
    ? (appendTargetOrder.items || []).reduce(
        (sum, item) => sum + (Number(item.quantity || item.qty) || 0),
        0,
      )
    : 0;

  async function handlePlaceOrder() {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      const result = await createPosOrder({
        items: cart.map((c) => mapPosCartLineToOrderUpdatePayload(c)),
        orderType: "DINE_IN",
        paymentMethod: "PENDING",
        tableName: selectedTable?.name || selectedTable?.label || "",
        branchId: currentBranch?.id ?? undefined,
      });
      setOrderPlaced(result);
      setCart([]);
      fetchActiveOrders();
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

  function handleNewOrder() {
    setOrderPlaced(null);
    cancelAppendFlow();
    setSelectedTable(null);
    setSearchQuery("");
    setSelectedCategory("all");
    setStep(STEPS.TABLE);
    setActiveTab(TABS.NEW_ORDER);
  }

  // Active list — NEW_ORDER, PROCESSING, READY only.
  // DELIVERED/CANCELLED go to History.
  const nonCancelledOrders = activeOrders.filter(
    (o) => !["CANCELLED", "DELIVERED", "COMPLETED"].includes(o.status),
  );
  const newOrders = nonCancelledOrders.filter((o) => o.status === "NEW_ORDER");
  const preparingOrders = nonCancelledOrders.filter(
    (o) => o.status === "PROCESSING",
  );
  const readyOrders = nonCancelledOrders.filter((o) => o.status === "READY");
  const historyOrders = activeOrders
    .filter(
      (o) =>
        o.status === "COMPLETED" ||
        o.status === "CANCELLED" ||
        o.status === "DELIVERED",
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const historyRevenue = historyOrders
    .filter((o) => o.status === "DELIVERED" || o.status === "COMPLETED")
    .reduce((sum, o) => sum + getOrderTotal(o), 0);
  const paymentPendingOrders = historyOrders.filter(
    (o) =>
      (o.status === "DELIVERED" || o.status === "COMPLETED") &&
      getPaymentStatus(o) === "unpaid",
  );
  const paymentPendingTotal = paymentPendingOrders.reduce(
    (sum, o) => sum + getOrderTotal(o),
    0,
  );
  const clearedHistoryOrders = historyOrders.filter(
    (o) => o.status === "CANCELLED" || getPaymentStatus(o) !== "unpaid",
  );
  const filteredHistoryOrders =
    historyFilter === "pending_payment"
      ? paymentPendingOrders
      : historyFilter === "cleared"
        ? clearedHistoryOrders
        : historyOrders;
  const filteredActiveOrders =
    activeFilter === "ready"
      ? readyOrders
      : activeFilter === "preparing"
        ? preparingOrders
        : activeFilter === "all"
          ? nonCancelledOrders
          : newOrders;
  const activeFilterLabel =
    activeFilter === "all"
      ? "active"
      : activeFilter === "preparing"
        ? "preparing"
        : activeFilter === "ready"
          ? "ready"
          : "new";
  const activeRevenue = nonCancelledOrders.reduce(
    (sum, o) => sum + (Number(o.grandTotal ?? o.total) || 0),
    0,
  );
  const cancelledCount = activeOrders.filter(
    (o) => o.status === "CANCELLED",
  ).length;
  const clearedRevenue = Math.max(0, historyRevenue - paymentPendingTotal);
  const completedHistoryCount = historyOrders.filter(
    (o) => o.status === "DELIVERED" || o.status === "COMPLETED",
  ).length;
  const servedCount = historyOrders.filter(
    (o) => o.status === "DELIVERED",
  ).length;
  const completedClosedCount = historyOrders.filter(
    (o) => o.status === "COMPLETED" || o.status === "CANCELLED",
  ).length;

  function toggleOrderDetails(orderKey) {
    setExpandedOrderIds((prev) =>
      prev.includes(orderKey)
        ? prev.filter((id) => id !== orderKey)
        : prev.concat(orderKey),
    );
  }

  function canAppendOrder(order) {
    if (isOrderLocked(order)) return false;
    const status = String(order?.status || "").toUpperCase();
    if (status === "CANCELLED" || status === "OUT_FOR_DELIVERY") return false;
    return true;
  }

  function orderCanAppend(order) {
    if (isOrderLocked(order)) {
      const status = String(order?.status || "").toUpperCase();
      if (status === "CANCELLED") {
        toast.error("This order is cancelled.");
      } else {
        toast.error("Payment collected — order is locked.");
      }
      return false;
    }

    if (String(order?.status || "").toUpperCase() === "OUT_FOR_DELIVERY") {
      toast.error("Rider already picked up this order.");
      return false;
    }

    return true;
  }

  const appendableOrders = activeOrders.filter(
    (o) =>
      !isOrderLocked(o) &&
      o.status !== "OUT_FOR_DELIVERY" &&
      o.status !== "CANCELLED",
  );

  const servedAwaitingPayment = appendableOrders.filter(
    (o) => o.status === "DELIVERED" && getPaymentStatus(o) === "unpaid",
  );

  function renderActiveOrderCard(order) {
    const sc = getStatusConfig(order.status);
    const StatusIcon = sc.icon;
    const orderKey = String(order.id || order._id);
    const isExpanded = expandedOrderIds.includes(orderKey);
    const itemCount = (order.items || []).reduce(
      (sum, item) => sum + (Number(item.quantity || item.qty) || 0),
      0,
    );
    const canAppend = canAppendOrder(order);
    const canAddItems =
      canAppend &&
      (!isServedUnpaidOrder(order) ||
        canEditAfterServed ||
        canAddItemsAfterServed);
    const orderStatus = String(order.status || "").toUpperCase();
    const appendProminent =
      orderStatus === "READY" ||
      (orderStatus === "DELIVERED" && getPaymentStatus(order) === "unpaid");
    const appendSubtle =
      orderStatus === "NEW_ORDER" || orderStatus === "PROCESSING";
    const canMarkServed =
      orderStatus === "READY" &&
      order.orderType !== "DELIVERY" &&
      order.type !== "delivery";
    const isMarkingServed = markingServedId === (order.id || order._id);
    const tokenLabel = `#${order.tokenNumber || getDisplayOrderId(order).toString().slice(-4)}`;
    const totalAmt = (order.grandTotal ?? order.total)?.toLocaleString();
    const otLabel =
      order.orderType === "DINE_IN" || order.type === "dine-in"
        ? "Dine-in"
        : order.orderType === "TAKEAWAY" || order.type === "takeaway"
          ? "Takeaway"
          : "Delivery";
    const otBadgeClass =
      order.orderType === "DINE_IN" || order.type === "dine-in"
        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400";
    const summaryLine = [order.tableName, order.customerName]
      .filter(Boolean)
      .join(" · ");

    const statusLabel =
      orderStatus === "NEW_ORDER"
        ? "In Kitchen"
        : orderStatus === "PROCESSING"
          ? "Preparing"
          : sc.label;

    return (
      <div
        key={orderKey}
        className="bg-white dark:bg-neutral-950 rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800"
      >
        <div
          className={`px-3.5 py-2 flex items-center justify-between ${sc.bgLight}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <StatusIcon className={`w-3.5 h-3.5 shrink-0 ${sc.text}`} />
            <span className={`text-[11px] font-bold truncate ${sc.text}`}>
              {statusLabel}
            </span>
          </div>
          <div
            className={`flex items-center gap-1 text-[10px] shrink-0 ${sc.text} opacity-85`}
          >
            <Clock className="w-3 h-3" />
            {getTimeAgo(order.createdAt)}
          </div>
        </div>

        <div className="px-3.5 py-3">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">
                {tokenLabel}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${otBadgeClass}`}
              >
                {otLabel}
              </span>
            </div>
            <div className="shrink-0 text-right">
              <span className="block text-sm font-black text-gray-900 dark:text-white tabular-nums">
                Rs. {totalAmt}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mb-2.5">
            <p className="text-[10px] text-gray-500 dark:text-neutral-500 truncate min-w-0">
              <span className="font-semibold">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </span>
              {summaryLine ? ` · ${summaryLine}` : ""}
            </p>
            {canAppend && (
              <button
                type="button"
                onClick={() => startEditCustomerDetails(order)}
                className="text-[10px] font-semibold text-gray-500 dark:text-neutral-400 underline underline-offset-2 decoration-gray-300 dark:decoration-neutral-600 hover:text-orange-500 dark:hover:text-orange-400 transition-colors inline-flex items-center gap-1 shrink-0"
              >
                <User className="w-3 h-3" />
                Edit customer
              </button>
            )}
          </div>

          <div className="flex gap-2 mb-1">
            {canAddItems && (
              <button
                type="button"
                onClick={() => startAppendItems(order)}
                title={appendSubtle ? "Order still being prepared" : undefined}
                className="flex-1 py-2 rounded-xl border border-orange-500/30 bg-orange-500/5 dark:bg-orange-500/10 text-orange-500 text-[11px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
              >
                <Plus className="w-3.5 h-3.5" />
                Add items
              </button>
            )}
            <button
              type="button"
              onClick={() => toggleOrderDetails(orderKey)}
              className={`${canAddItems ? "flex-1" : "w-full"} py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 border transition-colors ${
                isExpanded
                  ? "bg-orange-500/10 border-orange-500/30 text-orange-500"
                  : "bg-gray-50 dark:bg-neutral-900 border-gray-200/80 dark:border-neutral-800 text-gray-600 dark:text-neutral-300 hover:bg-gray-100/80 dark:hover:bg-neutral-800"
              }`}
            >
              {isExpanded ? "Hide" : "Details"}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {isExpanded && (
            <>
              {order.customerName && (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-neutral-400 mb-0.5">
                  <User className="w-3 h-3 shrink-0" />
                  {order.customerName}
                </div>
              )}
              {(order.customerPhone || order.phone) && (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-neutral-400 mb-0.5">
                  <Phone className="w-3 h-3 shrink-0" />
                  {order.customerPhone || order.phone}
                </div>
              )}
              {order.tableName && (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-neutral-400 mb-2">
                  <Utensils className="w-3 h-3 shrink-0" />
                  {order.tableName}
                </div>
              )}

              <div className="space-y-1.5 mb-2">
                {order.items?.map((item, idx) => {
                  const noteKey = `${orderKey}-${idx}`;
                  const isSavingNote = savingItemNoteKey === noteKey;
                  return (
                    <div key={idx} className="text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700 dark:text-neutral-300 font-medium min-w-0 truncate">
                          <span className="font-bold text-gray-900 dark:text-white">
                            {item.quantity || item.qty}x
                          </span>{" "}
                          {item.name}
                        </span>
                        {canEditOrderNotes(order) && (
                          <button
                            type="button"
                            onClick={() => saveOrderItemNote(order, idx)}
                            disabled={isSavingNote}
                            className="flex-shrink-0 text-[10px] font-semibold text-orange-500 hover:underline disabled:opacity-50"
                          >
                            {isSavingNote ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : item.note ? (
                              "Edit note"
                            ) : (
                              "Add note"
                            )}
                          </button>
                        )}
                      </div>
                      {item.note ? (
                        <p className="mt-0.5 rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
                          📝 {item.note}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {canMarkServed && (
            <button
              type="button"
              onClick={() => markOrderServed(order)}
              disabled={!!markingServedId}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm shadow-emerald-600/20 active:scale-[0.98] transition-transform"
            >
              {isMarkingServed ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PackageCheck className="w-4 h-4" />
              )}
              Mark as Served
            </button>
          )}
        </div>
      </div>
    );
  }

  async function markOrderServed(order) {
    const orderId = order?._id || order?.id;
    if (!orderId) return;
    const status = String(order?.status || "").toUpperCase();
    if (status !== "READY") {
      toast.error("Order is not ready to serve yet.");
      return;
    }
    const isDelivery =
      order.orderType === "DELIVERY" || order.type === "delivery";
    if (isDelivery) {
      toast.error("Delivery orders must go through a rider.");
      return;
    }
    setMarkingServedId(orderId);
    try {
      await updateOrderStatus(orderId, "DELIVERED");
      toast.success("Order marked as served");
      await fetchActiveOrders();
    } catch (err) {
      toast.error(err.message || "Could not mark as served");
    } finally {
      setMarkingServedId(null);
    }
  }

  function startAppendItems(order) {
    if (!order || !orderCanAppend(order)) return;
    if (!canAppendItemsToOrder(order)) {
      toast.error("You don't have permission to add items to this order.");
      return;
    }
    setAppendEditDetailsOnly(false);
    setAppendTargetOrder(order);
    setCart([]);
    setExistingItemsOpen(true);
    setOtCustomerName(String(order.customerName || "").trim());
    setOtCustomerPhone(String(order.customerPhone || order.phone || "").trim());
    setOtTableName(String(order.tableName || "").trim());
    setSearchQuery("");
    setSelectedCategory("all");
    setStep(STEPS.MENU);
    setActiveTab(TABS.NEW_ORDER);
  }

  function startEditCustomerDetails(order) {
    if (!order || !orderCanAppend(order)) return;
    setAppendEditDetailsOnly(true);
    setAppendTargetOrder(order);
    setCart([]);
    setOtCustomerName(String(order.customerName || "").trim());
    setOtCustomerPhone(String(order.customerPhone || order.phone || "").trim());
    setOtTableName(String(order.tableName || "").trim());
    setStep(STEPS.CART);
    setActiveTab(TABS.NEW_ORDER);
  }

  function cancelAppendFlow() {
    setAppendTargetOrder(null);
    setAppendEditDetailsOnly(false);
    setAppendingOrderId(null);
    setExistingItemsOpen(false);
    setCart([]);
    setOtCustomerName("");
    setOtCustomerPhone("");
    setOtTableName("");
  }

  async function handleAppendOrUpdateOrder() {
    if (!appendTargetOrder) return;
    const hadNewItems = cart.length > 0;
    if (hadNewItems && !canAppendItemsToOrder(appendTargetOrder)) {
      toast.error("You don't have permission to add items to this order.");
      return;
    }
    const targetOrderId = appendTargetOrder._id || appendTargetOrder.id;
    setPlacing(true);
    setAppendingOrderId(targetOrderId);
    try {
      const payload = {};
      if (appendEditDetailsOnly) {
        payload.customerName = otCustomerName.trim();
        payload.customerPhone = otCustomerPhone.trim();
        payload.tableName = otTableName.trim();
      }
      if (cart.length > 0) {
        const existingItems = mapOrderItemsForUpdate(appendTargetOrder.items);
        const addedItems = cart.map((c) => ({
          ...mapPosCartLineToOrderUpdatePayload(c),
          isAddition: true,
        }));
        const lineIsNew = (item) =>
          item.isAddition === true &&
          (item.itemStatus === undefined || item.itemStatus === null) &&
          (item.addedAt === undefined || item.addedAt === null);
        const mergedMap = new Map();
        const pushItem = (item) => {
          const newSuffix = lineIsNew(item) ? "|NEW" : "|EXISTING";
          const key = item.menuItemId
            ? `menu:${item.menuItemId}${newSuffix}`
            : `name:${String(item.name || "")
                .trim()
                .toLowerCase()}|price:${Number(item.unitPrice) || 0}${newSuffix}`;
          const prev = mergedMap.get(key);
          if (prev) {
            prev.quantity += Math.max(1, Number(item.quantity) || 1);
            return;
          }
          mergedMap.set(key, {
            ...item,
            quantity: Math.max(1, Number(item.quantity) || 1),
          });
        };
        existingItems.forEach(pushItem);
        addedItems.forEach(pushItem);
        payload.items = Array.from(mergedMap.values());
      } else if (!appendEditDetailsOnly) {
        payload.items = mapOrderItemsForUpdate(appendTargetOrder.items);
      }
      const updated = await updateOrder(targetOrderId, payload);
      setActiveOrders((prev) =>
        prev.map((o) =>
          o.id === appendTargetOrder.id || o._id === appendTargetOrder._id
            ? { ...o, ...updated }
            : o,
        ),
      );
      cancelAppendFlow();
      setStep(STEPS.MENU);
      setActiveTab(TABS.HOME);
      fetchActiveOrders();
      toast.success(
        hadNewItems
          ? "Items added to order"
          : payload.items
            ? "Order updated"
            : "Order details updated",
      );
    } catch (err) {
      toast.error(
        err.message ||
          (hadNewItems ? "Failed to add items" : "Failed to update order"),
      );
    } finally {
      setPlacing(false);
      setAppendingOrderId(null);
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
      case "PROCESSING":
        return {
          label: "Processing",
          bg: "bg-amber-500",
          bgLight: "bg-amber-50 dark:bg-amber-500/10",
          text: "text-amber-600 dark:text-amber-400",
          border: "border-amber-200 dark:border-amber-500/20",
          icon: ChefHat,
          pulse: false,
        };
      case "NEW_ORDER":
        return {
          label: "In Kitchen",
          bg: "bg-blue-500",
          bgLight: "bg-blue-50 dark:bg-blue-500/10",
          text: "text-blue-600 dark:text-blue-400",
          border: "border-blue-200 dark:border-blue-500/20",
          icon: Send,
          pulse: false,
        };
      case "OUT_FOR_DELIVERY":
        return {
          label: "Out for Delivery",
          bg: "bg-violet-500",
          bgLight: "bg-violet-50 dark:bg-violet-500/10",
          text: "text-violet-600 dark:text-violet-400",
          border: "border-violet-200 dark:border-violet-500/20",
          icon: Send,
          pulse: false,
        };
      case "DELIVERED":
      case "COMPLETED":
        return {
          label: "Completed",
          bg: "bg-gray-400",
          bgLight: "bg-gray-50 dark:bg-neutral-900/50",
          text: "text-gray-500 dark:text-neutral-400",
          border: "border-gray-200 dark:border-neutral-800",
          icon: Check,
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
    if (typeof id !== "string") return id;
    // Numeric sequence is shared across all sources, so the plain number is unique.
    return id.replace(/^(ORD|WEB|WAP)-/, "");
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <SEO title="Order Taker - Eats Desk" noindex />
        <div className="h-[100dvh] flex flex-col items-center justify-center bg-white dark:bg-neutral-950 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center">
            <Coffee className="w-7 h-7 text-white animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              Setting up your station
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
              Loading menu & tables...
            </p>
          </div>
          <div className="w-32 h-1 rounded-full bg-gray-200 dark:bg-neutral-800 overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-orange-500 animate-[shimmer_1.2s_ease-in-out_infinite]" />
          </div>
        </div>
        <style jsx global>{`
          @keyframes shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(300%);
            }
          }
        `}</style>
      </>
    );
  }

  // ── Order Success ──────────────────────────────────────────────────────
  if (orderPlaced) {
    return (
      <>
        <SEO title="Order Placed - Eats Desk" noindex />
        <div className="h-[100dvh] flex flex-col items-center justify-center bg-white dark:bg-neutral-950 px-6">
          <div className="w-full max-w-xs text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="w-10 h-10 text-white" strokeWidth={3} />
              </div>
            </div>

            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-1 tracking-tight">
              Order Sent!
            </h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-xs font-bold text-gray-600 dark:text-neutral-300 mb-4">
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
                className="w-full min-h-[48px] py-4 rounded-2xl bg-orange-500 text-white font-bold text-base active:scale-[0.98] transition-transform"
              >
                Take Next Order
              </button>
              <button
                onClick={() => {
                  setOrderPlaced(null);
                  setActiveTab(TABS.HOME);
                }}
                className="w-full min-h-[48px] py-3.5 rounded-2xl bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-sm font-bold text-gray-700 dark:text-neutral-300 active:scale-[0.98] transition-transform"
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
      <div className="h-[100dvh] flex flex-col bg-[#f9fafb] dark:bg-neutral-950 text-gray-900 dark:text-white overflow-hidden">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="flex-shrink-0 bg-white dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800 ot-safe-top">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3 min-w-0">
              {activeTab === TABS.NEW_ORDER && step !== STEPS.TABLE ? (
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
                <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0">
                  <Utensils className="w-[18px] h-[18px] text-white" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-[15px] font-extrabold truncate leading-tight tracking-tight text-gray-900 dark:text-white">
                  {activeTab === TABS.HOME
                    ? userName
                      ? `Hi, ${userName.split(" ")[0]}`
                      : "Order taker"
                    : activeTab === TABS.HISTORY
                      ? "Order History"
                      : step === STEPS.TABLE
                        ? "Eats Desk"
                        : step === STEPS.MENU
                          ? selectedTable?.name || "Menu"
                          : "Review Order"}
                </h1>
                <p className="text-[11px] text-gray-500 dark:text-neutral-400 truncate leading-tight">
                  {activeTab === TABS.HOME
                    ? `${nonCancelledOrders.length} active · ${readyOrders.length} ready to serve`
                    : activeTab === TABS.HISTORY
                      ? "Today's summary"
                      : step === STEPS.TABLE
                        ? userName || "Order Taker"
                        : step === STEPS.MENU
                          ? `${filteredItems.length} item${filteredItems.length !== 1 ? "s" : ""} available`
                          : `${selectedTable?.name || "Walk-in"} · ${cartBadge} item${cartBadge !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === TABS.NEW_ORDER &&
                step === STEPS.MENU &&
                cartBadge > 0 && (
                  <button
                    onClick={() => setStep(STEPS.CART)}
                    className="relative h-9 pl-3 pr-3.5 rounded-full bg-orange-500 text-white flex items-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span className="text-xs font-extrabold">{cartBadge}</span>
                  </button>
                )}
              {activeTab === TABS.NEW_ORDER &&
                step === STEPS.MENU &&
                cartBadge === 0 && (
                  <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4 text-gray-400 dark:text-neutral-600" />
                  </div>
                )}
              {activeTab === TABS.NEW_ORDER && step === STEPS.TABLE && (
                <button
                  onClick={handleLogout}
                  className="h-9 pl-3 pr-3.5 rounded-full flex items-center gap-1.5 text-gray-500 dark:text-neutral-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors text-xs font-semibold"
                  title="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              )}
              {activeTab === TABS.NEW_ORDER &&
                step === STEPS.CART &&
                cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="h-9 px-3 rounded-full flex items-center gap-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-xs font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </button>
                )}
              {(activeTab === TABS.HOME || activeTab === TABS.HISTORY) && (
                <button
                  onClick={() => {
                    setOrdersLoading(true);
                    fetchActiveOrders().finally(() => setOrdersLoading(false));
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw
                    className={`w-4 h-4 text-gray-500 dark:text-neutral-400 ${ordersLoading ? "animate-spin" : ""}`}
                  />
                </button>
              )}
              <button
                onClick={toggleTheme}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
                title={
                  theme === "light"
                    ? "Switch to dark mode"
                    : "Switch to light mode"
                }
                aria-label={
                  theme === "light"
                    ? "Switch to dark mode"
                    : "Switch to light mode"
                }
              >
                {theme === "light" ? (
                  <Moon className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
                ) : (
                  <Sun className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
                )}
              </button>
              {(activeTab === TABS.HOME || activeTab === TABS.HISTORY) && (
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
          {activeTab === TABS.NEW_ORDER && (
            <div className="flex gap-1 px-4 pb-2.5">
              {[STEPS.TABLE, STEPS.MENU, STEPS.CART].map((s, i) => (
                <div
                  key={s}
                  className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${
                    i <= [STEPS.TABLE, STEPS.MENU, STEPS.CART].indexOf(step)
                      ? "bg-orange-500"
                      : "bg-gray-200 dark:bg-neutral-800"
                  }`}
                />
              ))}
            </div>
          )}
        </header>

        {/* ── Content ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* ════════════════ HOME TAB — aligned with rider overview ════════════════ */}
          {activeTab === TABS.HOME && (
            <div className="pb-24">
              <div className="px-4 pt-3 pb-2 space-y-3">
                {readyOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveFilter("ready")}
                    className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-orange-500 text-white font-bold text-sm text-left active:scale-[0.98] transition-transform animate-pulse"
                  >
                    ⚡ {readyOrders.length} order
                    {readyOrders.length !== 1 ? "s" : ""} ready to serve
                  </button>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: "READY",
                      value: readyOrders.length,
                      dot: readyOrders.length > 0,
                    },
                    {
                      label: "SERVED",
                      value: servedCount,
                      dot: servedCount > 0,
                    },
                    {
                      label: "COMPLETED",
                      value: completedClosedCount,
                      dot: false,
                    },
                  ].map((cell) => (
                    <div
                      key={cell.label}
                      className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-1.5 py-2 text-center"
                    >
                      <p className="text-[8px] font-bold uppercase tracking-wide text-gray-400 dark:text-neutral-500 leading-none">
                        {cell.label}
                      </p>
                      {cell.subLabel && (
                        <p className="text-[7px] font-bold uppercase tracking-wide text-gray-400 dark:text-neutral-500 leading-none mt-0.5">
                          {cell.subLabel}
                        </p>
                      )}
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        {cell.dot && (
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 animate-pulse"
                            aria-hidden
                          />
                        )}
                        <p className="text-base font-black text-gray-900 dark:text-white tabular-nums leading-none">
                          {cell.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {paymentPendingOrders.length > 0 && (
                  <div className="rounded-xl border border-dashed border-gray-400/60 dark:border-neutral-600 bg-neutral-100/40 dark:bg-neutral-900/50 p-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-neutral-400">
                      Collect at counter
                    </p>
                    <p className="text-xl font-black tabular-nums text-orange-600 dark:text-orange-400 mt-1 tracking-tight">
                      Rs. {Math.round(paymentPendingTotal).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-neutral-500 mt-1">
                      {paymentPendingOrders.length} order
                      {paymentPendingOrders.length !== 1 ? "s" : ""} awaiting
                      payment
                    </p>
                  </div>
                )}
              </div>

              <div className="px-4 pt-1">
                <div className="flex gap-2 mb-3 overflow-x-auto ot-no-scrollbar">
                  {[
                    {
                      key: "all",
                      label: "All",
                      count: nonCancelledOrders.length,
                    },
                    { key: "new", label: "New", count: newOrders.length },
                    {
                      key: "preparing",
                      label: "Preparing",
                      count: preparingOrders.length,
                    },
                    { key: "ready", label: "Ready", count: readyOrders.length },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setActiveFilter(f.key)}
                      className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                        activeFilter === f.key
                          ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                          : "bg-white dark:bg-neutral-950 text-gray-500 dark:text-neutral-400 border border-gray-200 dark:border-neutral-800"
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

                {filteredActiveOrders.length === 0 &&
                servedAwaitingPayment.length === 0 ? (
                  <div className="flex flex-col items-center justify-center pt-8 pb-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                      <ClipboardList className="w-7 h-7 text-gray-300 dark:text-neutral-700" />
                    </div>
                    <p className="text-sm font-bold text-gray-500 dark:text-neutral-400 mb-1">
                      No active orders right now.
                    </p>
                  </div>
                ) : (
                  <>
                    {filteredActiveOrders.length > 0 && (
                      <div className="space-y-2">
                        {filteredActiveOrders.map((order) =>
                          renderActiveOrderCard(order),
                        )}
                      </div>
                    )}

                    {servedAwaitingPayment.length > 0 && (
                      <div
                        className={
                          filteredActiveOrders.length > 0 ? "mt-8" : ""
                        }
                      >
                        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">
                          Served — Awaiting Payment
                        </h3>
                        <div className="space-y-2">
                          {servedAwaitingPayment.map((order) =>
                            renderActiveOrderCard(order),
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ════════════════ HISTORY TAB ════════════════ */}
          {activeTab === TABS.HISTORY && (
            <div className="p-4 pb-24">
              {historyOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center pt-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                    <ClipboardList className="w-7 h-7 text-gray-300 dark:text-neutral-700" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 dark:text-neutral-400 mb-1">
                    No past orders
                  </p>
                  <p className="text-xs text-gray-400 dark:text-neutral-600">
                    Completed and cancelled orders will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
                    <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-neutral-800">
                      <div className="p-3.5 sm:p-4">
                        <p className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest">
                          Cleared
                        </p>
                        <p className="text-base sm:text-lg font-black text-gray-900 dark:text-white tabular-nums leading-tight mt-1">
                          Rs. {Math.round(clearedRevenue).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-neutral-400 mt-1 leading-snug">
                          Prepaid + submitted
                        </p>
                      </div>
                      <div
                        className={`p-3.5 sm:p-4 ${
                          paymentPendingTotal > 0
                            ? "bg-orange-50 dark:bg-orange-500/10"
                            : ""
                        }`}
                      >
                        <p
                          className={`text-xs font-bold uppercase tracking-widest ${
                            paymentPendingTotal > 0
                              ? "text-orange-700 dark:text-orange-300"
                              : "text-gray-500 dark:text-neutral-400"
                          }`}
                        >
                          To submit
                        </p>
                        <p
                          className={`text-base sm:text-lg font-black tabular-nums leading-tight mt-1 ${
                            paymentPendingTotal > 0
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          Rs. {Math.round(paymentPendingTotal).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-neutral-400 mt-1">
                          {paymentPendingOrders.length} order
                          {paymentPendingOrders.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 overflow-x-auto ot-no-scrollbar">
                    {[
                      {
                        key: "pending_payment",
                        label: "Pending",
                        count: paymentPendingOrders.length,
                      },
                      {
                        key: "all",
                        label: "All",
                        count: historyOrders.length,
                      },
                      {
                        key: "cleared",
                        label: "Cleared",
                        count: clearedHistoryOrders.length,
                      },
                    ].map((f) => {
                      const active = historyFilter === f.key;
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setHistoryFilter(f.key)}
                          className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            active
                              ? "bg-orange-500 text-white"
                              : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400"
                          }`}
                        >
                          {f.label}
                          <span
                            className={`text-xs font-black tabular-nums ${active ? "text-white/90" : "opacity-70"}`}
                          >
                            {f.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[10px] text-gray-400 dark:text-neutral-500 px-0.5 -mt-1">
                    {historyFilter === "pending_payment"
                      ? "Completed orders still marked “To be paid” — collect cash and submit at the counter."
                      : historyFilter === "cleared"
                        ? "Paid at order, cancelled, or already submitted."
                        : "All orders in your session history."}
                  </p>

                  {filteredHistoryOrders.length === 0 ? (
                    historyFilter === "pending_payment" &&
                    paymentPendingOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center pt-10 pb-6 text-center px-3 rounded-2xl border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-3">
                          <Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="text-sm font-extrabold text-gray-900 dark:text-white mb-1">
                          All caught up
                        </p>
                        <p className="text-xs text-gray-500 dark:text-neutral-400 max-w-[260px] leading-relaxed">
                          No pending collections right now.
                        </p>
                        <button
                          type="button"
                          onClick={() => setHistoryFilter("all")}
                          className="mt-4 min-h-[48px] px-5 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-extrabold active:scale-[0.98] transition-transform"
                        >
                          View all orders
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-12 text-center px-2">
                        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-3">
                          <ClipboardList className="w-6 h-6 text-gray-300 dark:text-neutral-700" />
                        </div>
                        <p className="text-sm font-bold text-gray-500 dark:text-neutral-400 mb-1">
                          No orders here
                        </p>
                        <p className="text-xs text-gray-400 dark:text-neutral-600">
                          Try a different filter above
                        </p>
                      </div>
                    )
                  ) : (
                    filteredHistoryOrders.map((order) => {
                      const paymentPending =
                        (order.status === "DELIVERED" ||
                          order.status === "COMPLETED") &&
                        getPaymentStatus(order) === "unpaid";
                      const sc = getStatusConfig(order.status);
                      const StatusIcon = paymentPending ? Wallet : sc.icon;
                      const orderId = order.id || order._id;
                      const headerBg = paymentPending
                        ? "bg-orange-50 dark:bg-orange-500/10"
                        : sc.bgLight;
                      const headerText = paymentPending
                        ? "text-orange-700 dark:text-orange-300"
                        : sc.text;
                      const itemCount = (order.items || []).reduce(
                        (sum, item) =>
                          sum + (Number(item.quantity || item.qty) || 0),
                        0,
                      );
                      return (
                        <div
                          key={orderId}
                          className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800"
                        >
                          <div
                            className={`px-3.5 py-2 flex items-center justify-between ${headerBg}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <StatusIcon
                                className={`w-3.5 h-3.5 shrink-0 ${headerText}`}
                              />
                              <span
                                className={`text-[11px] font-bold ${headerText} truncate`}
                              >
                                {paymentPending
                                  ? "Delivered · payment not submitted"
                                  : order.status === "CANCELLED"
                                    ? "Cancelled"
                                    : sc.label}
                              </span>
                            </div>
                            <div
                              className={`flex items-center gap-1.5 text-[10px] ${headerText} opacity-80 shrink-0`}
                            >
                              <Clock className="w-3 h-3" />
                              {getTimeAgo(order.createdAt)}
                            </div>
                          </div>
                          <div className="px-3.5 py-3">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">
                                #
                                {order.tokenNumber ||
                                  getDisplayOrderId(order).toString().slice(-4)}
                              </span>
                              <span
                                className={`text-sm font-black tabular-nums ${
                                  paymentPending
                                    ? "text-orange-600 dark:text-orange-400"
                                    : "text-gray-900 dark:text-white"
                                }`}
                              >
                                Rs. {getOrderTotal(order).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-neutral-400">
                              <span className="font-semibold">
                                {itemCount} item{itemCount !== 1 ? "s" : ""}
                              </span>
                              {order.tableName ? ` · ${order.tableName}` : ""}
                            </p>
                            {paymentPending && (
                              <p className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 mt-1.5">
                                Collect at counter — still marked &quot;To be
                                paid&quot; in POS
                              </p>
                            )}
                            {order.customerName && (
                              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-neutral-400 mt-1">
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

          {/* ════════════════ NEW ORDER TAB ════════════════ */}
          {activeTab === TABS.NEW_ORDER && (
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
                        className="px-6 py-3 rounded-2xl bg-orange-500 text-white text-sm font-bold active:scale-95 transition-transform flex items-center gap-2 min-h-[48px]"
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
                                  : "border-transparent bg-white dark:bg-neutral-900 hover:border-orange-500/30"
                              }`}
                            >
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-colors ${
                                  occupied
                                    ? "bg-amber-100 dark:bg-amber-500/10"
                                    : "bg-gray-100 dark:bg-neutral-800 group-active:bg-orange-500/10"
                                }`}
                              >
                                <Utensils
                                  className={`w-5 h-5 ${
                                    occupied
                                      ? "text-amber-500"
                                      : "text-gray-400 dark:text-neutral-500 group-active:text-orange-500"
                                  }`}
                                />
                              </div>
                              <span className="text-xs font-bold truncate w-full text-center leading-tight">
                                {table.name ||
                                  table.label ||
                                  `T-${table.number}`}
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
                        className="mt-4 w-full min-h-[48px] py-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-sm font-bold text-gray-600 dark:text-neutral-300 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
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
                  {appendTargetOrder && (
                    <div className="mx-3 mt-3 mb-1 rounded-xl border border-orange-500/20 bg-orange-500/5 dark:bg-orange-500/10 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
                            Appending to order #
                            {appendTargetOrder.tokenNumber ||
                              getDisplayOrderId(appendTargetOrder)
                                .toString()
                                .slice(-4)}
                          </p>
                          <p className="text-[10px] text-orange-600/80 dark:text-orange-400/80">
                            {appendAddOnlyMode
                              ? "Add-only — pick new items below. Existing lines cannot be changed."
                              : "Existing lines stay on the ticket. New picks merge in when you confirm."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => cancelAppendFlow()}
                          className="text-[10px] font-bold text-orange-600/80 dark:text-orange-400/80 hover:text-orange-600 dark:hover:text-orange-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="sticky top-0 z-10 bg-white dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800">
                    <div className="px-4 pt-3 pb-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
                        <input
                          ref={searchRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search menu items..."
                          className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder-neutral-500 outline-none focus:ring-2 focus:ring-orange-500/20 transition-all border-0"
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
                      {dealMenuItems.length > 0 && (
                        <CategoryPill
                          active={selectedCategory === "deals"}
                          onClick={() => setSelectedCategory("deals")}
                          label={`Deals (${dealMenuItems.length})`}
                        />
                      )}
                      {visibleCategories.map((cat) => (
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-2.5">
                        {filteredItems.map((item) => {
                          const qty = getCartQty(item.id);
                          const price = item.isDeal
                            ? (item.price ?? 0)
                            : (item.effectivePrice ??
                              item.finalPrice ??
                              item.price ??
                              0);
                          const outOfStock =
                            !item.isDeal &&
                            (item.inventorySufficient === false ||
                              item.inventorySufficient === "false");
                          return (
                            <div
                              key={item.id || item._id}
                              className={`relative rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800 transition-transform ${
                                outOfStock
                                  ? "bg-white dark:bg-neutral-900"
                                  : "bg-white dark:bg-neutral-900 active:scale-[0.97]"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  !outOfStock &&
                                  appendCanModifyItems &&
                                  addToCart(item)
                                }
                                disabled={
                                  outOfStock ||
                                  (appendTargetOrder && !appendCanModifyItems)
                                }
                                className="w-full text-left disabled:cursor-not-allowed"
                                aria-disabled={
                                  outOfStock ||
                                  (appendTargetOrder && !appendCanModifyItems)
                                }
                              >
                                <div className="relative w-full aspect-[4/3] md:aspect-square bg-gray-100 dark:bg-neutral-900 overflow-hidden">
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
                                      <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-950 flex items-center justify-center">
                                        <Utensils className="w-8 h-8 md:w-7 md:h-7 text-gray-200 dark:text-neutral-800" />
                                      </div>
                                    )}
                                  </div>
                                  {outOfStock && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 pointer-events-none">
                                      <span className="px-2.5 py-1 rounded-md bg-red-600 text-white text-[10px] md:text-[11px] font-bold shadow-md">
                                        Out of Stock
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div
                                  className={`px-2.5 md:px-2 pt-1.5 md:pt-1 pb-2 md:pb-1.5 ${outOfStock ? "opacity-60" : ""}`}
                                >
                                  <p
                                    className={`text-[13px] md:text-[12px] font-bold leading-snug line-clamp-2 pb-0.5 ${
                                      outOfStock
                                        ? "text-gray-400 dark:text-neutral-500"
                                        : ""
                                    }`}
                                  >
                                    {item.name}
                                  </p>
                                  <p
                                    className={`text-xs md:text-[11px] font-extrabold ${
                                      outOfStock
                                        ? "text-gray-400"
                                        : "text-orange-500"
                                    }`}
                                  >
                                    Rs. {price.toLocaleString()}
                                  </p>
                                </div>
                              </button>

                              {qty > 0 &&
                                !outOfStock &&
                                appendCanModifyItems && (
                                  <div className="absolute top-2 md:top-1.5 right-2 md:right-1.5 flex items-center gap-0.5 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-neutral-700/50 px-1 py-0.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateQty(item.id, -1);
                                      }}
                                      className="w-7 h-7 md:w-6 md:h-6 rounded-lg flex items-center justify-center active:scale-90 transition-transform text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
                                    >
                                      <Minus className="w-3.5 h-3.5 md:w-3 md:h-3" />
                                    </button>
                                    <span className="w-5 md:w-4.5 text-center text-xs md:text-[11px] font-black text-orange-500">
                                      {qty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addToCart(item);
                                      }}
                                      className="w-7 h-7 md:w-6 md:h-6 rounded-lg flex items-center justify-center active:scale-90 transition-transform text-orange-500 hover:bg-orange-500/10"
                                    >
                                      <Plus className="w-3.5 h-3.5 md:w-3 md:h-3" />
                                    </button>
                                  </div>
                                )}

                              {qty === 0 &&
                                !outOfStock &&
                                appendCanModifyItems && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addToCart(item);
                                    }}
                                    className="absolute top-2 md:top-1.5 right-2 md:right-1.5 w-8 h-8 md:w-7 md:h-7 rounded-full bg-orange-500 flex items-center justify-center active:scale-90 transition-transform"
                                  >
                                    <Plus className="w-4 h-4 md:w-3.5 md:h-3.5 text-white" />
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
                  {appendTargetOrder && (
                    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 dark:bg-orange-500/10 px-3 py-2.5 mb-4">
                      <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
                        Update order #
                        {appendTargetOrder.tokenNumber ||
                          getDisplayOrderId(appendTargetOrder)
                            .toString()
                            .slice(-4)}
                      </p>
                      <p className="text-[10px] text-orange-600/80 dark:text-orange-400/80 mt-0.5">
                        {appendEditDetailsOnly
                          ? "Update guest or table below, then save."
                          : "Add items from the menu or edit notes on existing items, then save."}
                      </p>
                      <button
                        type="button"
                        onClick={() => cancelAppendFlow()}
                        className="mt-2 text-[10px] font-bold text-orange-600/80 dark:text-orange-400/80 hover:text-orange-600 dark:hover:text-orange-400"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {!appendTargetOrder && selectedTable && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 mb-4">
                      <Utensils className="w-3 h-3 text-orange-500" />
                      <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                        {selectedTable.name || selectedTable.label}
                      </span>
                    </div>
                  )}

                  {cart.length === 0 && !appendTargetOrder ? (
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
                        className="px-6 py-3 rounded-2xl bg-orange-500 text-white text-sm font-bold active:scale-95 transition-transform min-h-[48px]"
                      >
                        Browse Menu
                      </button>
                    </div>
                  ) : (
                    <>
                      {appendTargetOrder && (
                        <div className="mb-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExistingItemsOpen((open) => !open)
                            }
                            className="w-full flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-100 px-3 py-2.5 text-left dark:border-neutral-800 dark:bg-neutral-900 active:scale-[0.99] transition-transform"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Lock className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                                  Already in order
                                </p>
                                {!existingItemsOpen && (
                                  <p className="text-[11px] text-gray-500 dark:text-neutral-500 truncate">
                                    {existingItemCount} item
                                    {existingItemCount !== 1 ? "s" : ""} · Rs.{" "}
                                    {existingOrderTotal.toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-2">
                              <span className="text-xs text-gray-500 dark:text-neutral-400">
                                #
                                {String(
                                  appendTargetOrder.orderNumber ||
                                    getDisplayOrderId(appendTargetOrder) ||
                                    "",
                                ).slice(-4)}
                              </span>
                              <ChevronDown
                                className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                                  existingItemsOpen ? "rotate-180" : ""
                                }`}
                              />
                            </div>
                          </button>

                          {existingItemsOpen && (
                            <div className="mt-1.5 space-y-1.5">
                              {(appendTargetOrder.items || []).map(
                                (item, idx) => (
                                  <div
                                    key={idx}
                                    className="rounded-xl border border-gray-200 bg-gray-100 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <Lock className="h-3 w-3 flex-shrink-0 text-gray-400" />
                                        <span className="truncate text-sm text-gray-600 dark:text-neutral-400">
                                          {item.name}
                                          {(item.variantLabel || item.size) && (
                                            <span className="ml-1 text-xs text-gray-400">
                                              ({item.variantLabel || item.size})
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                      <span className="flex-shrink-0 text-sm font-medium tabular-nums text-gray-500 dark:text-neutral-500">
                                        ×{item.qty ?? item.quantity ?? 1}
                                      </span>
                                    </div>
                                    {!appendEditDetailsOnly &&
                                      canEditOrderNotes(appendTargetOrder) && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              addNoteToExistingOrderItem(idx)
                                            }
                                            className="mt-1.5 text-xs font-medium text-orange-500 hover:underline"
                                          >
                                            {item.note ? "Edit note" : "Add note"}
                                          </button>
                                          {item.note ? (
                                            <div className="mt-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 dark:border-blue-500/20 dark:bg-blue-500/10">
                                              <p className="text-xs text-blue-700 dark:text-blue-400">
                                                📝 {item.note}
                                              </p>
                                            </div>
                                          ) : null}
                                        </>
                                      )}
                                  </div>
                                ),
                              )}
                            </div>
                          )}

                          {cart.length > 0 && (
                            <>
                              <div className="my-3 border-t border-dashed border-gray-300 dark:border-neutral-700" />
                              <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-orange-500">
                                Adding now
                              </p>
                            </>
                          )}
                        </div>
                      )}

                      {cart.length > 0 ? (
                        <div className="space-y-2.5 mb-4">
                          {cart.map((item) => (
                            <div
                              key={item._cartKey || item.id}
                              className="bg-white dark:bg-neutral-900 rounded-2xl p-3 border border-gray-200 dark:border-neutral-800"
                            >
                              <div className="flex items-center gap-3">
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
                                    {item.size && (
                                      <span className="text-xs font-normal text-gray-500 ml-1">
                                        ({item.size})
                                      </span>
                                    )}
                                  </p>
                                  {item.isDeal && item._dealSelections ? (
                                    <div className="mt-0.5 space-y-0.5">
                                      {Object.values(item._dealSelections)
                                        .flat()
                                        .map((pick, pickIndex) => (
                                          <p
                                            key={`${pick.menuItemId}-${pickIndex}`}
                                            className="text-[11px] text-gray-400 dark:text-neutral-500 leading-tight"
                                          >
                                            · {pick.name}
                                            {(pick.qty || 1) > 1
                                              ? ` ×${pick.qty}`
                                              : ""}
                                          </p>
                                        ))}
                                    </div>
                                  ) : null}
                                  {item._modifierSelectionsForOrder
                                    ?.filter((s) => {
                                      const g = item.modifierGroups?.find(
                                        (g) => g.id === s.groupId,
                                      );
                                      return g && !g.required;
                                    })
                                    .flatMap((s) => s.options)
                                    .map((o, i) => (
                                      <p
                                        key={i}
                                        className="text-[11px] text-gray-400 dark:text-neutral-500 leading-tight"
                                      >
                                        + {o.name}
                                        {o.price > 0 && ` (Rs ${o.price})`}
                                      </p>
                                    ))}
                                  <p className="text-xs font-bold text-orange-500 mt-0.5">
                                    Rs.{" "}
                                    {(item.price * item.quantity).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-0 bg-gray-100 dark:bg-neutral-900 rounded-xl">
                                  {(!appendTargetOrder || appendCanModifyItems) && (
                                    <>
                                      <button
                                        onClick={() =>
                                          updateQty(item._cartKey || item.id, -1)
                                        }
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
                                        onClick={() =>
                                          updateQty(item._cartKey || item.id, 1)
                                        }
                                        className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
                                      >
                                        <Plus className="w-3.5 h-3.5 text-orange-500" />
                                      </button>
                                    </>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => addNoteToItem(item._cartKey || item.id)}
                                  className="text-xs font-medium text-orange-500 hover:underline"
                                >
                                  {item.note ? "Edit note" : "Add note"}
                                </button>
                              </div>
                              {item.note ? (
                                <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 dark:border-blue-500/20 dark:bg-blue-500/10">
                                  <p className="text-xs text-blue-700 dark:text-blue-400">
                                    📝 {item.note}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        appendTargetOrder &&
                        appendEditDetailsOnly && (
                          <div className="mb-4 px-3 py-2 rounded-xl border border-dashed border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-[11px] text-gray-500 dark:text-neutral-400">
                            Update guest or table below, then save.
                          </div>
                        )
                      )}
                      {appendTargetOrder && appendEditDetailsOnly && (
                        <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 space-y-3">
                          <p className="text-xs font-bold text-gray-900 dark:text-white">
                            Guest & table
                          </p>
                          <input
                            type="text"
                            value={otCustomerName}
                            onChange={(e) => setOtCustomerName(e.target.value)}
                            placeholder="Guest name (optional)"
                            className="w-full px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder-neutral-500 outline-none focus:ring-2 focus:ring-orange-500/20 border-0"
                          />
                          <input
                            type="tel"
                            value={otCustomerPhone}
                            onChange={(e) => setOtCustomerPhone(e.target.value)}
                            placeholder="Phone (optional)"
                            className="w-full px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder-neutral-500 outline-none focus:ring-2 focus:ring-orange-500/20 border-0"
                          />
                          <input
                            type="text"
                            value={otTableName}
                            onChange={(e) => setOtTableName(e.target.value)}
                            placeholder="Table or label (e.g. Table 2)"
                            className="w-full px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder-neutral-500 outline-none focus:ring-2 focus:ring-orange-500/20 border-0"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Floating Action Bars ───────────────────────────────────── */}

        {activeTab === TABS.NEW_ORDER &&
          step === STEPS.MENU &&
          cartBadge > 0 && (
            <div className="fixed bottom-16 inset-x-0 z-20">
              <div className="px-4 pb-3 pt-2">
                <button
                  onClick={() => setStep(STEPS.CART)}
                  className="w-full min-h-[48px] flex items-center justify-between py-3.5 px-5 rounded-2xl bg-orange-500 text-white font-bold text-sm active:scale-[0.98] transition-transform"
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

        {activeTab === TABS.NEW_ORDER &&
          step === STEPS.CART &&
          (cart.length > 0 || !!appendTargetOrder) && (
            <div className="fixed bottom-16 inset-x-0 z-20">
              <div className="bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 px-4 pt-3 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">
                      {appendTargetOrder && cart.length > 0
                        ? "Total (after adding)"
                        : "Total"}
                    </p>
                    <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                      Rs.{" "}
                      {appendTargetOrder
                        ? (cart.length > 0
                            ? appendCombinedTotal
                            : existingOrderTotal
                          ).toLocaleString()
                        : subtotal.toLocaleString()}
                    </p>
                    {appendTargetOrder && cart.length > 0 && (
                      <p className="text-[10px] leading-tight text-gray-500 dark:text-neutral-400">
                        Existing Rs. {existingOrderTotal.toLocaleString()}
                        {" + New Rs. "}
                        {newItemsSubtotal.toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">
                      Items
                    </p>
                    <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                      {appendTargetOrder
                        ? existingItemCount + cartBadge
                        : cartBadge}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  {(!appendTargetOrder || appendCanModifyItems) && (
                    <button
                      onClick={() => setStep(STEPS.MENU)}
                      className="flex-1 py-3.5 rounded-2xl bg-gray-100 dark:bg-neutral-900 font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5 text-gray-700 dark:text-neutral-300"
                    >
                      <Plus className="w-4 h-4" />
                      {appendTargetOrder ? "Menu" : "Add"}
                    </button>
                  )}
                  <button
                    onClick={
                      appendTargetOrder
                        ? handleAppendOrUpdateOrder
                        : handlePlaceOrder
                    }
                    disabled={placing || !!appendingOrderId}
                    className="flex-[2.5] min-h-[48px] py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {placing || appendingOrderId ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {appendTargetOrder ? "Updating..." : "Sending..."}
                      </>
                    ) : appendTargetOrder ? (
                      <>
                        {appendEditDetailsOnly && cart.length === 0
                          ? "Save details"
                          : cart.length === 0
                            ? "Save notes"
                            : "Update order"}
                        <Check className="w-4 h-4" />
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
            onClick={() => {
              setActiveTab(TABS.HOME);
              fetchActiveOrders();
            }}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-h-[56px] ${
              activeTab === TABS.HOME
                ? "text-orange-500"
                : "text-gray-400 dark:text-neutral-600"
            }`}
          >
            <div className="relative">
              <Home className="w-5 h-5" />
              {readyOrders.length > 0 && (
                <span className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-white dark:ring-neutral-950" />
              )}
            </div>
            <span className="text-[10px] font-bold">Home</span>
          </button>
          <button
            onClick={() => setActiveTab(TABS.NEW_ORDER)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-h-[56px] ${
              activeTab === TABS.NEW_ORDER
                ? "text-orange-500"
                : "text-gray-400 dark:text-neutral-600"
            }`}
          >
            <Utensils className="w-5 h-5" />
            <span className="text-[10px] font-bold">New Order</span>
          </button>
          <button
            onClick={() => {
              setActiveTab(TABS.HISTORY);
              fetchActiveOrders();
            }}
            className={`relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-h-[56px] ${
              activeTab === TABS.HISTORY
                ? "text-orange-500"
                : "text-gray-400 dark:text-neutral-600"
            }`}
          >
            <span className="relative inline-flex">
              <ClipboardList className="w-5 h-5" />
              {paymentPendingOrders.length > 0 && (
                <span className="absolute -right-1 -top-0.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-white dark:ring-neutral-950" />
              )}
            </span>
            <span className="text-[10px] font-bold">History</span>
          </button>
        </nav>
      </div>

      {showBranchModal && branches?.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4.5 h-4.5 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                    Select Branch
                  </h2>
                  <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-0.5">
                    Choose a branch to continue placing orders
                  </p>
                </div>
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
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all border-2 border-transparent hover:border-orange-500/30 hover:bg-orange-500/5 dark:hover:bg-orange-500/10 active:scale-[0.98]"
                >
                  <div className="h-9 w-9 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
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

      <style jsx global>{`
        .ot-no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .ot-no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .ot-safe-top {
          padding-top: env(safe-area-inset-top, 0px);
        }
        .ot-safe-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(300%);
          }
        }
      `}</style>

      {/* ── Deal customize modal ────────────────────────────────────────────── */}
      {dealCustomizeTarget && (
        <PosDealCustomizeModal
          deal={dealCustomizeTarget.deal}
          menuItems={menu.items || []}
          pendingQty={dealCustomizeTarget.qty}
          onClose={() => setDealCustomizeTarget(null)}
          onConfirm={addDealToCart}
        />
      )}

      {/* ── Modifier Picker Modal ───────────────────────────────────────────── */}
      {modifierPickerItem && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => {
            setModifierPickerItem(null);
            setModifierSelections({});
          }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-neutral-800 w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 dark:border-neutral-800">
              <div className="flex items-start gap-4">
                {modifierPickerItem.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={modifierPickerItem.imageUrl}
                    alt={modifierPickerItem.name}
                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                    {modifierPickerItem.name}
                  </h3>
                  {modifierPickerItem.description && (
                    <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5 line-clamp-2">
                      {modifierPickerItem.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setModifierPickerItem(null);
                    setModifierSelections({});
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 flex-shrink-0 text-xl leading-none"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-5 space-y-6">
              {(modifierPickerItem.modifierGroups || [])
                .slice()
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                .map((group) => (
                  <div key={group.id}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {group.groupName}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${group.required ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400" : "bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400"}`}
                      >
                        {group.required ? "REQUIRED" : "OPTIONAL"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {(group.options || [])
                        .filter((o) => o.isAvailable !== false)
                        .slice()
                        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                        .map((option) => {
                          const groupSel = modifierSelections[group.id] || [];
                          const isSelected = groupSel.some(
                            (s) => s.optionId === option.id,
                          );
                          const toggleOption = () => {
                            setModifierSelections((prev) => {
                              const existing = prev[group.id] || [];
                              if (group.maxSelections === 1) {
                                return {
                                  ...prev,
                                  [group.id]: isSelected
                                    ? []
                                    : [
                                        {
                                          optionId: option.id,
                                          name: option.name,
                                          price: option.price,
                                        },
                                      ],
                                };
                              } else {
                                if (isSelected)
                                  return {
                                    ...prev,
                                    [group.id]: existing.filter(
                                      (s) => s.optionId !== option.id,
                                    ),
                                  };
                                else if (existing.length < group.maxSelections)
                                  return {
                                    ...prev,
                                    [group.id]: [
                                      ...existing,
                                      {
                                        optionId: option.id,
                                        name: option.name,
                                        price: option.price,
                                      },
                                    ],
                                  };
                                return prev;
                              }
                            });
                          };
                          return (
                            <button
                              key={option.id}
                              onClick={toggleOption}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${isSelected ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20" : "border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600"}`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "border-orange-500 bg-orange-500" : "border-gray-300 dark:border-neutral-600"}`}
                                >
                                  {isSelected && (
                                    <div className="w-2 h-2 rounded-full bg-white" />
                                  )}
                                </div>
                                <span
                                  className={`text-sm font-medium ${isSelected ? "text-orange-700 dark:text-orange-400" : "text-gray-700 dark:text-neutral-300"}`}
                                >
                                  {option.name}
                                </span>
                              </div>
                              <span
                                className={`text-sm font-semibold ${isSelected ? "text-orange-600 dark:text-orange-400" : "text-gray-500 dark:text-neutral-400"}`}
                              >
                                {option.price === 0
                                  ? "Free"
                                  : `Rs ${option.price.toLocaleString()}`}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-neutral-900 border-t border-gray-100 dark:border-neutral-800 p-5">
              {(() => {
                const reqTotal = (modifierPickerItem.modifierGroups || [])
                  .filter((g) => g.required)
                  .reduce(
                    (sum, g) =>
                      sum +
                      (modifierSelections[g.id] || []).reduce(
                        (s, o) => s + o.price,
                        0,
                      ),
                    0,
                  );
                const optTotal = (modifierPickerItem.modifierGroups || [])
                  .filter((g) => !g.required)
                  .reduce(
                    (sum, g) =>
                      sum +
                      (modifierSelections[g.id] || []).reduce(
                        (s, o) => s + o.price,
                        0,
                      ),
                    0,
                  );
                const display =
                  reqTotal > 0
                    ? reqTotal + optTotal
                    : (modifierPickerItem.finalPrice ??
                        modifierPickerItem.price) + optTotal;
                return (
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500 dark:text-neutral-400">
                      Total
                    </span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      Rs {display.toLocaleString()}
                    </span>
                  </div>
                );
              })()}
              <button
                onClick={confirmModifierSelection}
                disabled={!isModifierSelectionComplete()}
                className={`w-full py-3.5 rounded-xl text-base font-bold transition-all ${isModifierSelectionComplete() ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-600 cursor-not-allowed"}`}
              >
                {isModifierSelectionComplete()
                  ? "Add to Order"
                  : "Select required options"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CategoryPill({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all whitespace-nowrap ${
        active
          ? "bg-orange-500 text-white"
          : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400"
      }`}
    >
      {label}
    </button>
  );
}
