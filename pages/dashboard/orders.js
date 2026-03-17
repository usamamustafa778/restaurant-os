import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/layout/AdminLayout";
import StatusBadge from "../../components/ui/StatusBadge";
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
  getDeliveryRiders,
  assignRiderToOrder,
  collectDeliveryPayment,
  getDaySessions,
  getCurrentDaySession,
  endDaySession,
  updateBranch,
} from "../../lib/apiClient";
import { printBillReceipt } from "../../lib/printBillReceipt";
import {
  getBusinessDate,
  getBusinessDayRange,
  formatBusinessDate,
} from "../../lib/businessDay";
import { useSocket } from "../../contexts/SocketContext";
import { useBranch } from "../../contexts/BranchContext";
import toast from "react-hot-toast";
import {
  Loader2,
  Printer,
  Clock,
  User,
  CircleDot,
  MapPin,
  Phone,
  ExternalLink,
  Banknote,
  CreditCard,
  Pencil,
  XCircle,
  ShoppingBag,
  UtensilsCrossed,
  Headset,
  Smartphone,
  X,
  CircleCheckBig,
  Receipt,
  Bike,
  UserCheck,
  Truck,
  RefreshCw,
  ChevronDown,
  Power,
} from "lucide-react";

// ─── Board configuration ────────────────────────────────────────────────────

const BOARD_COLUMNS = [
  { status: "NEW_ORDER", label: "New Orders" },
  { status: "PROCESSING", label: "Preparing" },
  { status: "READY", label: "Ready" },
  { status: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { status: "AWAITING_PAYMENT", label: "Awaiting Payment" },
];

const STATUS_THEME = {
  NEW_ORDER: {
    dot: "bg-orange-500",
    headerBg: "bg-orange-500",
    colBg: "bg-orange-50/60 dark:bg-orange-950/20",
    colBorder: "border-orange-200/60 dark:border-orange-500/15",
    countBg:
      "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
    ctaBg: "bg-orange-500 hover:bg-orange-600 text-white",
  },
  PROCESSING: {
    dot: "bg-blue-500",
    headerBg: "bg-blue-500",
    colBg: "bg-blue-50/60 dark:bg-blue-950/20",
    colBorder: "border-blue-200/60 dark:border-blue-500/15",
    countBg: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
    ctaBg: "bg-blue-500 hover:bg-blue-600 text-white",
  },
  READY: {
    dot: "bg-emerald-500",
    headerBg: "bg-emerald-500",
    colBg: "bg-emerald-50/60 dark:bg-emerald-950/20",
    colBorder: "border-emerald-200/60 dark:border-emerald-500/15",
    countBg:
      "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
    ctaBg: "bg-emerald-500 hover:bg-emerald-600 text-white",
  },
  OUT_FOR_DELIVERY: {
    dot: "bg-violet-500",
    headerBg: "bg-violet-500",
    colBg: "bg-violet-50/60 dark:bg-violet-950/20",
    colBorder: "border-violet-200/60 dark:border-violet-500/15",
    countBg:
      "bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400",
    ctaBg: "bg-violet-500 hover:bg-violet-600 text-white",
  },
  DELIVERED: {
    dot: "bg-gray-400 dark:bg-neutral-500",
    headerBg: "bg-gray-400 dark:bg-neutral-600",
    colBg: "bg-gray-50/60 dark:bg-neutral-900/40",
    colBorder: "border-gray-200/60 dark:border-neutral-800",
    countBg:
      "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400",
    ctaBg: "bg-gray-500 hover:bg-gray-600 text-white",
  },
  AWAITING_PAYMENT: {
    dot: "bg-amber-500",
    headerBg: "bg-amber-500",
    colBg: "bg-amber-50/60 dark:bg-amber-950/20",
    colBorder: "border-amber-200/60 dark:border-amber-500/15",
    countBg:
      "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400",
    ctaBg: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  CANCELLED: {
    dot: "bg-red-500",
    headerBg: "bg-red-500",
    colBg: "bg-red-50/60 dark:bg-red-950/20",
    colBorder: "border-red-200/60 dark:border-red-500/15",
    countBg: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
    ctaBg: "bg-red-500 hover:bg-red-600 text-white",
  },
};

const ORDER_TYPE_FILTERS = ["All", "Delivery", "Dine In", "Takeaway"];

// ─── Utility functions ──────────────────────────────────────────────────────

function orderStatusForTab(status) {
  if (!status) return "NEW_ORDER";
  if (status === "UNPROCESSED") return "NEW_ORDER";
  if (status === "PENDING") return "PROCESSING";
  if (status === "COMPLETED") return "DELIVERED";
  return status;
}

function getOrderId(order) {
  return order.id || order._id;
}

function getDisplayOrderId(order) {
  const id = order.id || order.orderNumber || order._id || "";
  if (typeof id === "string" && id.startsWith("ORD-"))
    return id.replace(/^ORD-/, "");
  return id;
}

function getShortOrderId(order) {
  const full = String(getDisplayOrderId(order));
  const lastDash = full.lastIndexOf("-");
  if (lastDash !== -1 && full.length - lastDash <= 6)
    return full.slice(lastDash + 1);
  return full.length > 8 ? full.slice(-6) : full;
}

function isOrderPaidOrNonEditable(order) {
  if (order.status === "CANCELLED") return true;
  if (order.status === "DELIVERED" || order.status === "COMPLETED") return true;
  if (order.status === "OUT_FOR_DELIVERY") return true;
  if (order.paymentAmountReceived != null && order.paymentAmountReceived > 0)
    return true;
  if (order.source === "FOODPANDA") return true;
  const pm = (order.paymentMethod || "").toUpperCase();
  return (
    pm === "CASH" || pm === "CARD" || pm === "ONLINE" || pm === "FOODPANDA"
  );
}

function isDeliveryOrder(order) {
  const type = (order.type || order.orderType || "").toUpperCase();
  return type === "DELIVERY";
}

function isDeliveryPaymentPending(order) {
  if (!isDeliveryOrder(order)) return false;
  if (order.status !== "DELIVERED" && order.status !== "COMPLETED")
    return false;
  if (order.deliveryPaymentCollected === false) return true;
  const pm = (order.paymentMethod || "").toUpperCase();
  return pm === "PENDING" || pm === "TO BE PAID" || !pm;
}

function isPaymentPending(order) {
  if (order.status === "CANCELLED") return false;
  if (order.source === "FOODPANDA") return false;
  if (order.paymentAmountReceived != null && order.paymentAmountReceived > 0)
    return false;
  const pm = (order.paymentMethod || "").toUpperCase();
  return !pm || pm === "PENDING" || pm === "TO BE PAID";
}

function getOrderTotal(order) {
  return Number(order.grandTotal ?? order.total) || 0;
}

function getPaymentStatus(order) {
  if (order.status === "CANCELLED") return "cancelled";
  if (order.source === "FOODPANDA") return "paid";
  if (order.paymentAmountReceived != null && order.paymentAmountReceived > 0)
    return "paid";
  const pm = (order.paymentMethod || "").toUpperCase();
  if (pm === "CASH" || pm === "CARD" || pm === "ONLINE" || pm === "FOODPANDA")
    return "paid";
  if (isDeliveryOrder(order) && order.deliveryPaymentCollected === true)
    return "paid";
  return "unpaid";
}

function isOrderFullyClosed(order) {
  const status = orderStatusForTab(order.status);
  if (status !== "DELIVERED") return false;
  return getPaymentStatus(order) === "paid";
}

function getOrderTypeLabel(order) {
  const type = (order.type || order.orderType || "").toUpperCase();
  if (type.includes("DELIVERY")) return "Delivery";
  if (type.includes("DINE") || type.includes("DINE_IN")) return "Dine In";
  if (type.includes("TAKE") || type.includes("PICKUP")) return "Takeaway";
  if (order.deliveryAddress) return "Delivery";
  if (order.tableName) return "Dine In";
  return "Walk-in";
}

const ORDER_TYPE_ICON = {
  Delivery: Truck,
  "Dine In": UtensilsCrossed,
  Takeaway: ShoppingBag,
  "Walk-in": User,
};

function getWaitingMinutes(createdAt, now) {
  return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
}

function getUrgency(minutes) {
  if (minutes >= 10) return "urgent";
  if (minutes >= 5) return "warning";
  return "normal";
}

const URGENCY_STYLE = {
  normal: "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400",
  warning:
    "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400",
  urgent: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
};

function getActionLabel(primaryNext, order) {
  if (!primaryNext) return null;
  if (primaryNext === "PROCESSING") return "Start Cooking";
  if (primaryNext === "READY") return "Mark Ready";
  if (primaryNext === "DELIVERED") {
    const s = orderStatusForTab(order.status);
    if (s === "OUT_FOR_DELIVERY") return "Mark Delivered";
    const type = getOrderTypeLabel(order);
    if (type === "Dine In") return "Mark Served";
    if (type === "Takeaway") return "Hand to Customer";
    return "Hand Over";
  }
  return primaryNext;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const router = useRouter();
  const { socket } = useSocket() || {};
  const { currentBranch, setCurrentBranch } = useBranch() || {};
  const [orders, setOrders] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All Sources");
  const [orderTypeFilter, setOrderTypeFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("Newest First");
  const [datePreset, setDatePreset] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [showCancelled, setShowCancelled] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [paymentPendingOnly, setPaymentPendingOnly] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [onlineProvider, setOnlineProvider] = useState(null);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [paymentAccountsLoading, setPaymentAccountsLoading] = useState(true);
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTargetOrder, setCancelTargetOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  const [showRiderModal, setShowRiderModal] = useState(false);
  const [riderTargetOrder, setRiderTargetOrder] = useState(null);
  const [riders, setRiders] = useState([]);
  const [ridersLoading, setRidersLoading] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [deliveryCharges, setDeliveryCharges] = useState("0");
  const [riderAssigning, setRiderAssigning] = useState(false);

  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectTargetOrder, setCollectTargetOrder] = useState(null);
  const [collectLoading, setCollectLoading] = useState(false);

  const [showEndDayModal, setShowEndDayModal] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [endingDay, setEndingDay] = useState(false);
  const [savingCutoff, setSavingCutoff] = useState(false);
  const [showSessionHistoryModal, setShowSessionHistoryModal] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [loadingSessionHistory, setLoadingSessionHistory] = useState(false);

  const [role] = useState(() => getStoredAuth()?.user?.role);
  const isOrderTaker = role === "order_taker";
  const isCashier = role === "cashier";

  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState("");
  const [restaurantLogoHeight, setRestaurantLogoHeight] = useState(100);
  const [restaurantBillFooter, setRestaurantBillFooter] = useState(
    "Thank you for your order!",
  );

  // ── Data loading ────────────────────────────────────────────────────────

  async function loadOrders() {
    try {
      const data = await getOrders();
      setOrders(Array.isArray(data) ? data : (data?.orders ?? []));
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

  function updateOrderInList(orderId, patch) {
    setOrders((prev) =>
      prev.map((o) => (getOrderId(o) === orderId ? { ...o, ...patch } : o)),
    );
  }

  function removeOrderFromList(orderId) {
    setOrders((prev) => prev.filter((o) => getOrderId(o) !== orderId));
  }

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getRestaurantSettings()
      .then((data) => {
        if (cancelled) return;
        setRestaurantLogoUrl(data?.restaurantLogoUrl || "");
        setRestaurantLogoHeight(
          typeof data?.restaurantLogoHeightPx === "number"
            ? data.restaurantLogoHeightPx
            : 100,
        );
        setRestaurantBillFooter(
          data?.billFooterMessage || "Thank you for your order!",
        );
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

  // ── Handlers (preserved exactly) ───────────────────────────────────────

  async function handleUpdateStatus(orderId, newStatus, extra = {}) {
    setUpdatingId(orderId);
    const toastId = toast.loading(`Updating order to ${newStatus}...`);
    try {
      const updated = await updateOrderStatus(orderId, newStatus, extra);
      updateOrderInList(orderId, updated);
      toast.success(`Order updated to ${newStatus}!`, { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to update status", { id: toastId });
    } finally {
      setUpdatingId(null);
    }
  }

  function openCancelModal(order) {
    setCancelTargetOrder(order);
    setCancelReason("");
    setShowCancelModal(true);
  }

  function closeCancelModal() {
    setShowCancelModal(false);
    setCancelTargetOrder(null);
    setCancelReason("");
  }

  async function handleDeleteOrder(order) {
    const orderId = getOrderId(order);
    const displayId = getDisplayOrderId(order);
    if (!window.confirm(`Delete order #${displayId}? This cannot be undone.`))
      return;
    setDeletingId(orderId);
    const toastId = toast.loading("Deleting order...");
    try {
      await deleteOrder(orderId);
      removeOrderFromList(orderId);
      toast.success(`Order #${displayId} deleted successfully!`, {
        id: toastId,
      });
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

  async function openRiderModal(order) {
    setRiderTargetOrder(order);
    setSelectedRiderId("");
    setShowRiderModal(true);
    setRidersLoading(true);
    try {
      const data = await getDeliveryRiders();
      setRiders(data);
    } catch {
      toast.error("Failed to load delivery riders");
      setRiders([]);
    } finally {
      setRidersLoading(false);
    }
  }

  function closeRiderModal() {
    setShowRiderModal(false);
    setRiderTargetOrder(null);
    setSelectedRiderId("");
    setDeliveryCharges("0");
  }

  async function handleAssignRider() {
    if (!riderTargetOrder || !selectedRiderId) return;
    const orderId = getOrderId(riderTargetOrder);
    setRiderAssigning(true);
    const toastId = toast.loading("Assigning rider...");
    try {
      const extra = { deliveryCharges: Number(deliveryCharges) || 0 };
      const updated = await assignRiderToOrder(orderId, selectedRiderId, extra);
      updateOrderInList(orderId, updated);
      toast.success("Rider assigned! Order is out for delivery.", {
        id: toastId,
      });
      const dcAmount = Number(deliveryCharges) || 0;
      const orderToPrint = { ...riderTargetOrder, ...updated, deliveryCharges: dcAmount };
      closeRiderModal();
      openPrintBill(orderToPrint, "bill");
    } catch (err) {
      toast.error(err.message || "Failed to assign rider", { id: toastId });
    } finally {
      setRiderAssigning(false);
    }
  }

  function openCollectPaymentModal(order) {
    setCollectTargetOrder(order);
    setShowCollectModal(true);
  }

  function closeCollectPaymentModal() {
    setShowCollectModal(false);
    setCollectTargetOrder(null);
  }

  async function handleCollectPayment() {
    if (!collectTargetOrder) return;
    const orderId = getOrderId(collectTargetOrder);
    setCollectLoading(true);
    const toastId = toast.loading("Collecting payment...");
    try {
      const updated = await collectDeliveryPayment(orderId, {
        paymentMethod: "CASH",
      });
      updateOrderInList(orderId, updated);
      toast.success("Payment collected from rider!", { id: toastId });
      closeCollectPaymentModal();
    } catch (err) {
      toast.error(err.message || "Failed to collect payment", { id: toastId });
    } finally {
      setCollectLoading(false);
    }
  }

  async function loadSessionHistory() {
    setLoadingSessionHistory(true);
    try {
      const res = await getDaySessions(currentBranch?.id);
      setSessionHistory(Array.isArray(res?.sessions) ? res.sessions : []);
    } catch {
      setSessionHistory([]);
    } finally {
      setLoadingSessionHistory(false);
    }
  }

  async function openEndDayModal() {
    setCurrentSession(null);
    setShowEndDayModal(true);
    setLoadingSession(true);
    try {
      const session = await getCurrentDaySession(currentBranch?.id);
      setCurrentSession(session);
    } catch {
      setCurrentSession(null);
    } finally {
      setLoadingSession(false);
    }
  }

  async function handleEndDay() {
    setEndingDay(true);
    try {
      await endDaySession(currentBranch?.id);
      toast.success("Business day ended");
      setShowEndDayModal(false);
    } catch (err) {
      toast.error(err.message || "Failed to end business day");
    } finally {
      setEndingDay(false);
    }
  }

  async function handleCutoffChange(e) {
    const newHour = Number(e.target.value);
    if (!currentBranch?.id) return;
    setSavingCutoff(true);
    try {
      await updateBranch(currentBranch.id, {
        ...currentBranch,
        businessDayCutoffHour: newHour,
      });
      setCurrentBranch({ ...currentBranch, businessDayCutoffHour: newHour });
      toast.success("Day reset time updated");
    } catch (err) {
      toast.error(err.message || "Failed to update");
    } finally {
      setSavingCutoff(false);
    }
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
    const orderId = getOrderId(paymentOrder);
    const billTotal = getOrderTotal(paymentOrder);
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
      updateOrderInList(orderId, updated);
      toast.success("Payment recorded successfully!", { id: toastId });
      closePaymentModal();
    } catch (err) {
      setPaymentError(err.message || "Failed to record payment");
      toast.error(err.message || "Failed to record payment", { id: toastId });
    } finally {
      setPaymentLoading(false);
    }
  }

  // ── Computed values ────────────────────────────────────────────────────

  const cashierBaseOrders = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    if (!isCashier) return list;
    const todayStr = new Date().toISOString().slice(0, 10);
    return list.filter((o) => {
      const isToday = (o.createdAt || "").slice(0, 10) === todayStr;
      const st = (o.status || "").toUpperCase();
      const isActive = !["DELIVERED", "COMPLETED", "CANCELLED"].includes(st);
      const isAwaitingPayment =
        (st === "DELIVERED" || st === "COMPLETED") &&
        getPaymentStatus(o) === "unpaid";
      return isToday || isActive || isAwaitingPayment;
    });
  }, [orders, isCashier]);

  const cutoffHour = currentBranch?.businessDayCutoffHour ?? 4;
  const businessDateStr = getBusinessDate(new Date(), cutoffHour);

  const dateRange = useMemo(() => {
    const nowDate = new Date();
    if (datePreset === "today") {
      return getBusinessDayRange(businessDateStr, cutoffHour);
    }
    if (datePreset === "yesterday") {
      const bd = new Date(businessDateStr);
      bd.setDate(bd.getDate() - 1);
      const yStr = `${bd.getFullYear()}-${String(bd.getMonth() + 1).padStart(2, "0")}-${String(bd.getDate()).padStart(2, "0")}`;
      return getBusinessDayRange(yStr, cutoffHour);
    }
    if (datePreset === "7days") {
      const from = new Date(nowDate);
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      return {
        from,
        to: new Date(
          nowDate.getFullYear(),
          nowDate.getMonth(),
          nowDate.getDate() + 1,
        ),
      };
    }
    if (datePreset === "30days") {
      const from = new Date(nowDate);
      from.setDate(from.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      return {
        from,
        to: new Date(
          nowDate.getFullYear(),
          nowDate.getMonth(),
          nowDate.getDate() + 1,
        ),
      };
    }
    if (datePreset === "custom") {
      const from = customFrom ? new Date(customFrom + "T00:00:00") : null;
      const to = customTo ? new Date(customTo + "T23:59:59") : null;
      return { from, to };
    }
    return null;
  }, [datePreset, businessDateStr, cutoffHour, customFrom, customTo]);

  const baseFiltered = useMemo(() => {
    const base = Array.isArray(cashierBaseOrders) ? cashierBaseOrders : [];
    const term = search.trim().toLowerCase();
    const hasDateRange = dateRange && (dateRange.from || dateRange.to);
    const fromMs = hasDateRange && dateRange.from ? dateRange.from.getTime() : 0;
    const toMs = hasDateRange && dateRange.to ? dateRange.to.getTime() : Infinity;
    const filterSource = sourceFilter !== "All Sources";
    const filterType = orderTypeFilter !== "All";

    const filtered = base.filter((o) => {
      if (hasDateRange) {
        const t = new Date(o.createdAt).getTime();
        if (t < fromMs || t > toMs) return false;
      }
      if (term && !(
        (o.id || "").toLowerCase().includes(term) ||
        (o.customerName || "").toLowerCase().includes(term) ||
        (o.orderTakerName || "").toLowerCase().includes(term) ||
        (o.externalOrderId || "").toLowerCase().includes(term) ||
        (o.customerPhone || "").toLowerCase().includes(term)
      )) return false;
      if (filterSource && o.source !== sourceFilter) return false;
      if (filterType && getOrderTypeLabel(o) !== orderTypeFilter) return false;
      if (paymentPendingOnly && !isPaymentPending(o)) return false;
      return true;
    });

    const dir = sortOrder === "Newest First" ? -1 : 1;
    filtered.sort((a, b) => dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    return filtered;
  }, [
    cashierBaseOrders,
    search,
    sourceFilter,
    orderTypeFilter,
    paymentPendingOnly,
    sortOrder,
    dateRange,
  ]);

  const groupedOrders = useMemo(() => {
    const groups = {
      NEW_ORDER: [],
      PROCESSING: [],
      READY: [],
      OUT_FOR_DELIVERY: [],
      AWAITING_PAYMENT: [],
      DELIVERED: [],
      CANCELLED: [],
    };
    baseFiltered.forEach((order) => {
      const status = orderStatusForTab(order.status);
      if (status === "DELIVERED") {
        if (isOrderFullyClosed(order)) {
          groups.DELIVERED.push(order);
        } else {
          groups.AWAITING_PAYMENT.push(order);
        }
      } else if (groups[status]) {
        groups[status].push(order);
      } else {
        groups.NEW_ORDER.push(order);
      }
    });
    return groups;
  }, [baseFiltered]);

  const displayColumns = BOARD_COLUMNS;
  const totalActive = BOARD_COLUMNS.reduce(
    (sum, col) => sum + (groupedOrders[col.status]?.length || 0),
    0,
  );
  const closedCount = groupedOrders.DELIVERED?.length || 0;
  const cancelledCount = groupedOrders.CANCELLED?.length || 0;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <AdminLayout title="Orders" suspended={suspended}>
      {pageLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-3">
            <ShoppingBag className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <p className="text-sm font-semibold text-gray-700 dark:text-neutral-300">
              Loading orders...
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-[calc(100vh-120px)]">
          {/* ── Filter bar ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-3 mb-4 flex-shrink-0">
            {/* Row 1: Search + session info + refresh */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order #, customer, phone..."
                className="flex-1 h-9 px-3 rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-1.5 px-2.5 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatBusinessDate(businessDateStr)}
                  </span>
                </div>
                <div className="relative flex items-center gap-1.5 px-2.5 h-9 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                  <Clock className="w-3 h-3 text-gray-400 dark:text-neutral-500 flex-shrink-0" />
                  <span className="text-[11px] text-gray-500 dark:text-neutral-400 whitespace-nowrap">
                    Resets at
                  </span>
                  <div className="relative flex items-center">
                    <select
                      value={cutoffHour}
                      onChange={handleCutoffChange}
                      disabled={savingCutoff || !currentBranch?.id}
                      className="appearance-none pr-4 text-xs font-semibold text-gray-700 dark:text-neutral-200 bg-transparent border-none outline-none cursor-pointer disabled:opacity-50"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i === 0
                            ? "12 AM"
                            : i < 12
                              ? `${i} AM`
                              : i === 12
                                ? "12 PM"
                                : `${i - 12} PM`}
                        </option>
                      ))}
                    </select>
                    {savingCutoff ? (
                      <Loader2 className="absolute right-0 w-2.5 h-2.5 animate-spin text-primary pointer-events-none" />
                    ) : (
                      <ChevronDown className="absolute right-0 w-2.5 h-2.5 text-gray-400 pointer-events-none" />
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openEndDayModal}
                  className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                >
                  <Power className="w-3.5 h-3.5" />
                  End Day
                </button>
                <button
                  type="button"
                  onClick={() => {
                    loadSessionHistory();
                    setShowSessionHistoryModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 text-xs font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Past Sessions
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const toastId = toast.loading("Refreshing...");
                  loadOrders()
                    .then(() => toast.success("Refreshed!", { id: toastId }))
                    .catch(() => toast.dismiss(toastId));
                }}
                className="h-9 px-3 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors flex-shrink-0 inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {/* Row 2: Order type pills (left) + Payment Pending, source, sort, date (right) */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {ORDER_TYPE_FILTERS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOrderTypeFilter(t)}
                    className={`h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                      orderTypeFilter === t
                        ? "bg-gray-900 dark:bg-white text-white dark:text-black"
                        : "bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-gray-400 dark:hover:border-neutral-500"
                    }`}
                  >
                    {t === "All" ? `All (${totalActive})` : t}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setPaymentPendingOnly(!paymentPendingOnly)}
                  className={`h-7 px-3 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all flex-shrink-0 inline-flex items-center gap-1 ${
                    paymentPendingOnly
                      ? "bg-amber-500 text-white"
                      : "bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-amber-400 dark:hover:border-amber-500/50"
                  }`}
                >
                  <Banknote className="w-3 h-3" />
                  Payment Pending
                </button>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="h-7 px-2.5 rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-[11px] font-semibold text-gray-700 dark:text-white outline-none focus:border-primary transition-all flex-shrink-0"
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
                    className="h-7 px-2.5 rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-[11px] font-semibold text-gray-700 dark:text-white outline-none focus:border-primary transition-all flex-shrink-0"
                  >
                    <option>Newest First</option>
                    <option>Oldest First</option>
                  </select>
                )}
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowDateDropdown(!showDateDropdown)}
                    className="h-7 px-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px] font-semibold text-gray-700 dark:text-neutral-300 hover:border-gray-400 dark:hover:border-neutral-500 transition-all inline-flex items-center gap-1.5"
                  >
                    <Clock className="w-3 h-3 text-gray-400 dark:text-neutral-500" />
                    {
                      {
                        today: "Today",
                        yesterday: "Yesterday",
                        "7days": "Last 7 Days",
                        "30days": "Last Month",
                        custom: "Custom",
                      }[datePreset]
                    }
                    <ChevronDown
                      className={`w-3 h-3 text-gray-400 transition-transform ${showDateDropdown ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showDateDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowDateDropdown(false)}
                      />
                      <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden">
                        {[
                          { id: "today", label: "Today's Session" },
                          { id: "yesterday", label: "Yesterday" },
                          { id: "7days", label: "Last 7 Days" },
                          { id: "30days", label: "Last Month" },
                          { id: "custom", label: "Custom Range" },
                        ].map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setDatePreset(p.id);
                              if (p.id !== "custom") setShowDateDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors flex items-center justify-between ${
                              datePreset === p.id
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900"
                            }`}
                          >
                            {p.label}
                            {datePreset === p.id && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            )}
                          </button>
                        ))}

                        {datePreset === "custom" && (
                          <div className="px-4 py-3 border-t border-gray-100 dark:border-neutral-800 space-y-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 dark:text-neutral-500 uppercase mb-1">
                                From
                              </label>
                              <input
                                type="date"
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                className="w-full h-8 px-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-xs text-gray-700 dark:text-neutral-300 outline-none focus:border-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 dark:text-neutral-500 uppercase mb-1">
                                To
                              </label>
                              <input
                                type="date"
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                className="w-full h-8 px-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-xs text-gray-700 dark:text-neutral-300 outline-none focus:border-primary"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowDateDropdown(false)}
                              disabled={!customFrom && !customTo}
                              className="w-full h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors disabled:opacity-40"
                            >
                              Apply
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Kanban board ───────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex gap-2.5 overflow-x-auto pb-2 min-h-0">
              {displayColumns.map((col) => {
                const theme = STATUS_THEME[col.status];
                const allColOrders = groupedOrders[col.status] || [];
                return (
                  <div
                    key={col.status}
                    className={`flex flex-col min-w-[290px] w-[290px] lg:min-w-0 lg:flex-1 rounded-xl border ${theme.colBorder} ${theme.colBg} overflow-hidden`}
                  >
                    <div
                      className={`flex items-center gap-2 px-3 py-2 flex-shrink-0 border-b ${theme.colBorder}`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${theme.dot} flex-shrink-0`}
                      />
                      <span className="text-[13px] font-bold text-gray-800 dark:text-neutral-200 truncate">
                        {col.label}
                      </span>
                      <span
                        className={`ml-auto text-[11px] font-bold min-w-[24px] text-center px-1.5 py-0.5 rounded-full ${theme.countBg}`}
                      >
                        {allColOrders.length}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-1.5 pb-1.5 pt-1.5 space-y-1.5 min-h-0">
                      {allColOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 opacity-30">
                          <CircleDot className="w-7 h-7 mb-1.5" />
                          <p className="text-[11px] font-medium">No orders</p>
                        </div>
                      ) : (
                        allColOrders.map((order) => (
                          <OrderCard
                            key={order.id || order._id}
                            order={order}
                            now={now}
                            theme={theme}
                            isOrderTaker={isOrderTaker}
                            isCashier={isCashier}
                            updatingId={updatingId}
                            onUpdateStatus={handleUpdateStatus}
                            onOpenCancel={openCancelModal}
                            onOpenPayment={openPaymentModal}
                            onOpenRider={openRiderModal}
                            onOpenCollect={openCollectPaymentModal}
                            onPrint={openPrintBill}
                            onEdit={(order) =>
                              router.push(`/pos?edit=${order.id || order._id}`)
                            }
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Floating popups — bottom right (LinkedIn-style) ──────── */}
      {!pageLoading && (
        <div className="fixed bottom-0 right-4 z-40 flex items-end gap-2">
          {/* Closed popup */}
          {closedCount > 0 && (
            <div className="w-[300px] flex flex-col rounded-t-xl shadow-2xl overflow-hidden border border-b-0 border-gray-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => setShowClosed(!showClosed)}
                className="flex items-center justify-between px-4 py-2.5 bg-gray-700 dark:bg-neutral-800 text-white hover:bg-gray-600 dark:hover:bg-neutral-700 transition-colors flex-shrink-0"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-sm font-semibold">Closed</span>
                  <span className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded-full">
                    {closedCount}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showClosed ? "" : "rotate-180"}`}
                />
              </button>
              {showClosed && (
                <div
                  className="bg-white dark:bg-neutral-950 overflow-y-auto px-2 py-2 space-y-1.5"
                  style={{ maxHeight: "calc(100vh - 100px)" }}
                >
                  {groupedOrders.DELIVERED.map((order) => (
                    <OrderCard
                      key={order.id || order._id}
                      order={order}
                      now={now}
                      theme={STATUS_THEME.DELIVERED}
                      isOrderTaker={isOrderTaker}
                      isCashier={isCashier}
                      updatingId={updatingId}
                      onUpdateStatus={handleUpdateStatus}
                      onOpenCancel={openCancelModal}
                      onOpenPayment={openPaymentModal}
                      onOpenRider={openRiderModal}
                      onOpenCollect={openCollectPaymentModal}
                      onPrint={openPrintBill}
                      onEdit={(order) =>
                        router.push(`/pos?edit=${order.id || order._id}`)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cancelled popup */}
          {cancelledCount > 0 && (
            <div className="w-[300px] flex flex-col rounded-t-xl shadow-2xl overflow-hidden border border-b-0 border-red-200 dark:border-red-500/30">
              <button
                type="button"
                onClick={() => setShowCancelled(!showCancelled)}
                className="flex items-center justify-between px-4 py-2.5 bg-red-600 dark:bg-red-700 text-white hover:bg-red-500 dark:hover:bg-red-600 transition-colors flex-shrink-0"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-200" />
                  <span className="text-sm font-semibold">Cancelled</span>
                  <span className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded-full">
                    {cancelledCount}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showCancelled ? "" : "rotate-180"}`}
                />
              </button>
              {showCancelled && (
                <div
                  className="bg-white dark:bg-neutral-950 overflow-y-auto px-2 py-2 space-y-1.5"
                  style={{ maxHeight: "calc(100vh - 160px)" }}
                >
                  {groupedOrders.CANCELLED.map((order) => (
                    <OrderCard
                      key={order.id || order._id}
                      order={order}
                      now={now}
                      theme={STATUS_THEME.CANCELLED}
                      isOrderTaker={isOrderTaker}
                      isCashier={isCashier}
                      updatingId={updatingId}
                      onUpdateStatus={handleUpdateStatus}
                      onOpenCancel={openCancelModal}
                      onOpenPayment={openPaymentModal}
                      onOpenRider={openRiderModal}
                      onOpenCollect={openCollectPaymentModal}
                      onPrint={openPrintBill}
                      onEdit={(order) =>
                        router.push(`/pos?edit=${order.id || order._id}`)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Take payment modal (unchanged) ──────────────────────────── */}
      {showPaymentModal && paymentOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                    Take Payment
                  </h2>
                  <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                    Order #{getDisplayOrderId(paymentOrder)}
                  </p>
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
            <div className="px-5 pt-5">
              <div className="text-center py-4 px-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                  Bill Total
                </p>
                <p className="text-4xl font-black text-gray-900 dark:text-white tabular-nums leading-none">
                  Rs {Math.round(getOrderTotal(paymentOrder)).toLocaleString()}
                </p>
                {getOrderTotal(paymentOrder) % 1 !== 0 && (
                  <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">
                    {getOrderTotal(paymentOrder).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
            <form
              onSubmit={handleRecordPayment}
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
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
                  Payment method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      m: "CASH",
                      Icon: Banknote,
                      label: "Cash",
                      active:
                        "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                    },
                    {
                      m: "CARD",
                      Icon: CreditCard,
                      label: "Card",
                      active:
                        "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
                    },
                    {
                      m: "ONLINE",
                      Icon: Smartphone,
                      label: "Online",
                      active:
                        "border-violet-500 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400",
                    },
                  ].map(({ m, Icon, label, active }) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m);
                        if (m !== "ONLINE") setOnlineProvider(null);
                      }}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${paymentMethod === m ? active : "border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600"}`}
                    >
                      <Icon className="w-5 h-5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
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
                          className={`px-3 py-2.5 rounded-xl border-2 text-left transition-all ${onlineProvider === acc.name ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10" : "border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600"}`}
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
              {paymentMethod === "CASH" &&
                (() => {
                  const orderTotal = getOrderTotal(paymentOrder);
                  const exactAmt = Math.ceil(orderTotal);
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
                    receivedNum < orderTotal;
                  const isOverpaid =
                    amountReceived !== "" &&
                    !isNaN(receivedNum) &&
                    receivedNum >= orderTotal;
                  return (
                    <>
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
                              className={`py-2 rounded-lg text-xs font-bold transition-all border ${receivedNum === amt ? "border-primary bg-primary/10 text-primary" : "border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"}`}
                            >
                              {amt.toLocaleString()}
                            </button>
                          ))}
                        </div>
                      </div>
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
                      {isOverpaid && (
                        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              Change
                            </span>
                          </div>
                          <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                            Rs {(receivedNum - orderTotal).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {isUnderpaid && (
                        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                              Short by
                            </span>
                          </div>
                          <span className="text-xl font-black text-red-700 dark:text-red-400 tabular-nums">
                            Rs {(orderTotal - receivedNum).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
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
                    (paymentMethod === "CASH" &&
                      (amountReceived === "" ||
                        Number(amountReceived) < getOrderTotal(paymentOrder))) ||
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

      {/* ── Cancel modal (unchanged) ────────────────────────────────── */}
      {showCancelModal && cancelTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Cancel order
              </h2>
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
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1.5">
                  Reason for cancellation
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Customer changed mind, out of stock..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/10 transition-all"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeCancelModal}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-neutral-300"
                >
                  Keep order
                </button>
                <button
                  type="button"
                  disabled={
                    updatingId === getOrderId(cancelTargetOrder) ||
                    !cancelReason.trim()
                  }
                  onClick={() => {
                    handleUpdateStatus(
                      getOrderId(cancelTargetOrder),
                      "CANCELLED",
                      { cancelReason: cancelReason.trim() },
                    );
                    closeCancelModal();
                  }}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {updatingId === getOrderId(cancelTargetOrder)
                    ? "Cancelling..."
                    : "Yes, cancel order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Rider modal (unchanged) ──────────────────────────── */}
      {showRiderModal && riderTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <Bike className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                    Assign Delivery Rider
                  </h2>
                  <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                    Order #{getDisplayOrderId(riderTargetOrder)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeRiderModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              {riderTargetOrder.customerName && (
                <div className="flex items-center gap-2 text-sm mb-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {riderTargetOrder.customerName}
                  </span>
                </div>
              )}
              {riderTargetOrder.deliveryAddress && (
                <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-neutral-400 mb-2">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{riderTargetOrder.deliveryAddress}</span>
                </div>
              )}
              <div className="px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-neutral-500">Order Total</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">Rs {Math.round(Number(riderTargetOrder.total)).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-500 dark:text-neutral-500 flex-shrink-0">Delivery Charges</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={deliveryCharges}
                    onChange={(e) => setDeliveryCharges(e.target.value)}
                    placeholder="0"
                    className="w-24 px-2 py-1 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm font-bold text-gray-900 dark:text-white text-right tabular-nums placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/10 transition-all"
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200/60 dark:border-neutral-700">
                  <span className="text-xs font-semibold text-gray-700 dark:text-neutral-300">Total to Collect</span>
                  <span className="text-lg font-black text-primary tabular-nums">Rs {(Number(riderTargetOrder.total) + (Number(deliveryCharges) || 0)).toLocaleString()}</span>
                </div>
              </div>
              <label className="block text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
                Select Rider
              </label>
              {ridersLoading ? (
                <div className="flex items-center justify-center gap-2 py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  <span className="text-xs text-gray-400">
                    Loading riders...
                  </span>
                </div>
              ) : riders.length === 0 ? (
                <div className="px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400">
                  No delivery riders found. Add riders in{" "}
                  <span className="font-semibold">Staff Management</span>.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {riders.map((rider) => (
                    <button
                      key={rider.id}
                      type="button"
                      onClick={() => setSelectedRiderId(rider.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${selectedRiderId === rider.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600"}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-semibold truncate ${selectedRiderId === rider.id ? "text-indigo-700 dark:text-indigo-400" : "text-gray-900 dark:text-white"}`}
                        >
                          {rider.name}
                        </p>
                        {rider.phone && (
                          <p className="text-[10px] text-gray-400 dark:text-neutral-500">
                            {rider.phone}
                          </p>
                        )}
                      </div>
                      {rider.vehicleType && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 font-medium capitalize">
                          {rider.vehicleType}
                        </span>
                      )}
                      {selectedRiderId === rider.id && (
                        <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={closeRiderModal}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedRiderId || riderAssigning}
                onClick={handleAssignRider}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50 transition-colors"
              >
                {riderAssigning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Assigning...
                  </>
                ) : (
                  <>
                    <Bike className="w-4 h-4" /> Assign &amp; Print
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Collect Payment modal (unchanged) ───────────────────────── */}
      {showCollectModal && collectTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Banknote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                    Collect Payment
                  </h2>
                  <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                    Order #{getDisplayOrderId(collectTargetOrder)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCollectPaymentModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="text-center py-4 px-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                  Amount to Collect
                </p>
                <p className="text-4xl font-black text-gray-900 dark:text-white tabular-nums leading-none">
                  Rs{" "}
                  {Math.round(
                    getOrderTotal(collectTargetOrder),
                  ).toLocaleString()}
                </p>
              </div>
              {collectTargetOrder.assignedRiderName && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30">
                  <Bike className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                      {collectTargetOrder.assignedRiderName}
                    </p>
                    {collectTargetOrder.assignedRiderPhone && (
                      <p className="text-[10px] text-indigo-500 dark:text-indigo-500">
                        {collectTargetOrder.assignedRiderPhone}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-neutral-400">
                Confirm that the rider has submitted{" "}
                <span className="font-semibold">
                  Rs {Math.round(getOrderTotal(collectTargetOrder)).toLocaleString()}
                </span>{" "}
                for this delivery order.
              </p>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={closeCollectPaymentModal}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={collectLoading}
                onClick={handleCollectPayment}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-50 transition-colors"
              >
                {collectLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <CircleCheckBig className="w-4 h-4" /> Payment Collected
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Past Sessions modal ──────────────────────────────────── */}
      {showSessionHistoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSessionHistoryModal(false);
          }}
        >
          <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Past Sessions
                </h2>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                  {currentBranch
                    ? `History for ${currentBranch.name}`
                    : "All branches"}
                </p>
              </div>
              <button
                onClick={() => setShowSessionHistoryModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingSessionHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : sessionHistory.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-400 dark:text-neutral-600">
                  No past sessions found
                </div>
              ) : (
                sessionHistory.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50 hover:bg-white dark:hover:bg-neutral-900 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.status === "OPEN" ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400"}`}
                        >
                          {s.status === "OPEN" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                          {s.status}
                        </span>
                        {!currentBranch && s.branchName && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                            {s.branchName}
                          </span>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                          Rs {(s.totalSales || 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-neutral-400">
                          {s.totalOrders || 0} orders
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 text-xs text-gray-500 dark:text-neutral-500">
                      <div>
                        <span className="font-medium">Started: </span>
                        {new Date(s.startAt).toLocaleString("en-PK", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </div>
                      {s.endAt && (
                        <div>
                          <span className="font-medium">Ended: </span>
                          {new Date(s.endAt).toLocaleString("en-PK", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
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

      {/* ── End Day modal ──────────────────────────────────────────── */}
      {showEndDayModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
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
              {loadingSession ? (
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
                  Are you sure you want to end the current business day?
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
    </AdminLayout>
  );
}

// ─── OrderCard component ────────────────────────────────────────────────────

function OrderCard({
  order,
  now,
  theme,
  isOrderTaker,
  isCashier,
  updatingId,
  onUpdateStatus,
  onOpenCancel,
  onOpenPayment,
  onOpenRider,
  onOpenCollect,
  onPrint,
  onEdit,
}) {
  const [expanded, setExpanded] = useState(false);
  const orderId = order.id || order._id;
  const isUpdating = updatingId === orderId;
  const orderType = order.type || order.orderType || "";
  const typeLabel = getOrderTypeLabel(order);
  const TypeIcon = ORDER_TYPE_ICON[typeLabel] || ShoppingBag;
  const status = orderStatusForTab(order.status);
  const waitMin = getWaitingMinutes(order.createdAt, now);
  const urgency = getUrgency(waitMin);
  const isActive = !["DELIVERED", "COMPLETED", "CANCELLED"].includes(status);
  const paymentStatus = getPaymentStatus(order);

  const nextStatuses = getNextStatuses(order.status, orderType);
  const primaryNext = nextStatuses[0];
  const actionLabel = getActionLabel(primaryNext, order);
  const canAdvanceStatus =
    primaryNext &&
    actionLabel &&
    !(isCashier && primaryNext === "DELIVERED" && isDeliveryOrder(order));

  const showAssignRider =
    isDeliveryOrder(order) && status === "READY" && !isOrderTaker;
  const isAwaitingPayment =
    (status === "DELIVERED" || status === "COMPLETED") &&
    paymentStatus === "unpaid";
  const showCollectFromRider =
    isDeliveryOrder(order) && isAwaitingPayment && !isOrderTaker;
  const showTakePayment =
    isAwaitingPayment && !isOrderTaker && !isDeliveryOrder(order);
  const showEarlyPayment =
    !["DELIVERED", "COMPLETED", "CANCELLED"].includes(status) &&
    paymentStatus === "unpaid" &&
    !isOrderTaker &&
    !isDeliveryOrder(order) &&
    order.source !== "FOODPANDA";

  const items = order.items || [];
  const visibleItems = items.slice(0, 3);
  const hiddenCount = items.length - 3;

  const hasCTA =
    !isOrderTaker &&
    (showCollectFromRider ||
      showTakePayment ||
      showAssignRider ||
      canAdvanceStatus);

  return (
    <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header: order # + type + timer */}
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-base font-black text-gray-900 dark:text-white leading-none"
              title={`#${getDisplayOrderId(order)}`}
            >
              #{getShortOrderId(order)}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 flex-shrink-0">
              <TypeIcon className="w-3 h-3" />
              {typeLabel}
            </span>
          </div>
          {isActive && (
            <span
              className={`flex-shrink-0 inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${URGENCY_STYLE[urgency]} ${urgency === "urgent" ? "animate-pulse" : ""}`}
            >
              <Clock className="w-3 h-3" />
              {waitMin}m
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {typeLabel === "Dine In" && order.tableName && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/20">
              <MapPin className="w-3 h-3" />
              {order.tableName}
            </span>
          )}
          {typeLabel !== "Dine In" && order.tableName && (
            <span className="text-[10px] font-medium text-gray-500 dark:text-neutral-500 bg-gray-50 dark:bg-neutral-900 px-1.5 py-0.5 rounded">
              {order.tableName}
            </span>
          )}
          {order.customerName && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-600 dark:text-neutral-400">
              <User className="w-3 h-3" />
              Customer: {order.customerName}
            </span>
          )}
          {order.source === "FOODPANDA" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-100 dark:bg-pink-500/15 text-pink-700 dark:text-pink-400 font-bold">
              Foodpanda
            </span>
          )}
          {order.source === "WEBSITE" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 font-bold">
              Website
            </span>
          )}
          {isDeliveryOrder(order) && order.assignedRiderName && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 rounded">
              <Bike className="w-3 h-3" />
              Rider: {order.assignedRiderName}
            </span>
          )}
          {order.orderTakerName && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${order.createdByRole === "delivery_rider" ? "text-sky-600 dark:text-sky-400" : "text-gray-400 dark:text-neutral-500"}`}>
              {order.createdByRole === "delivery_rider" ? (
                <>
                  <Bike className="w-3 h-3" />
                  Placed by: {order.orderTakerName}
                </>
              ) : (
                <>
                  <Headset className="w-3 h-3" />
                  Waiter: {order.orderTakerName}
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Time slots for closed / cancelled orders */}
      {!isActive && (
        <div className="mx-3 mb-2 flex items-center gap-3 text-[10px] text-gray-400 dark:text-neutral-500">
          {order.createdAt && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Created {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {status === "CANCELLED" && order.cancelledAt && (
            <span className="flex items-center gap-1 text-red-400 dark:text-red-500">
              <Clock className="w-3 h-3" />
              Cancelled {new Date(order.cancelledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {status !== "CANCELLED" && order.updatedAt && (
            <span className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400">
              <Clock className="w-3 h-3" />
              Closed {new Date(order.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}

      {/* Items list */}
      {items.length > 0 && !isActive && (
        <div className="mx-3 mb-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-neutral-900/80 text-[11px] font-bold text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <span>{items.reduce((s, i) => s + (i.qty || 1), 0)} items</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          {expanded && (
            <div className="px-2.5 py-2 mt-1 rounded-lg bg-gray-50 dark:bg-neutral-900/80 space-y-1">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-800 dark:text-neutral-200 truncate pr-2 font-medium">{it.name}</span>
                  <span className="text-gray-500 dark:text-neutral-500 font-bold flex-shrink-0 tabular-nums">×{it.qty}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {items.length > 0 && isActive && (
        <div className="mx-3 mb-2 px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900/80">
          <div className="space-y-1">
            {visibleItems.map((it, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="text-gray-800 dark:text-neutral-200 truncate pr-2 font-medium">
                  {it.name}
                </span>
                <span className="text-gray-500 dark:text-neutral-500 font-bold flex-shrink-0 tabular-nums">
                  ×{it.qty}
                </span>
              </div>
            ))}
          </div>
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] font-bold text-primary mt-1 hover:underline"
            >
              {expanded ? "show less" : `+${hiddenCount} more`}
            </button>
          )}
          {expanded && hiddenCount > 0 && (
            <div className="space-y-1 mt-1 pt-1 border-t border-gray-200/60 dark:border-neutral-800">
              {items.slice(3).map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span className="text-gray-800 dark:text-neutral-200 truncate pr-2 font-medium">
                    {it.name}
                  </span>
                  <span className="text-gray-500 dark:text-neutral-500 font-bold flex-shrink-0 tabular-nums">
                    ×{it.qty}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Total + payment status */}
      <div className="px-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black text-gray-900 dark:text-white tabular-nums">
            Rs {Math.round(getOrderTotal(order)).toLocaleString()}
          </span>
          {status !== "CANCELLED" && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                paymentStatus === "paid"
                  ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400"
              }`}
            >
              {paymentStatus === "paid" ? (
                <CircleCheckBig className="w-3 h-3" />
              ) : (
                <Clock className="w-3 h-3" />
              )}
              {paymentStatus === "paid" ? "Paid" : "Unpaid"}
            </span>
          )}
        </div>
        {!isOrderTaker && (
          <div className="flex items-center gap-0.5">
            {status !== "CANCELLED" && (
              <button
                type="button"
                onClick={() =>
                  onPrint(order, paymentStatus === "paid" ? "receipt" : "bill")
                }
                className="p-1 rounded text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                title="Print"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            )}
            {paymentStatus === "unpaid" &&
              !isDeliveryOrder(order) &&
              !["CANCELLED", "DELIVERED", "COMPLETED"].includes(status) && (
                <button
                  type="button"
                  onClick={() => onEdit(order)}
                  className="p-1 rounded text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            {![
              "CANCELLED",
              "DELIVERED",
              "COMPLETED",
              "OUT_FOR_DELIVERY",
            ].includes(status) && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onOpenCancel(order)}
                className="p-1 rounded text-gray-400 dark:text-neutral-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-50"
                title="Cancel"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
            {showEarlyPayment && (
              <button
                type="button"
                onClick={() => onOpenPayment(order)}
                className="p-1 rounded text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                title="Take payment"
              >
                <Banknote className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Primary CTA — full width */}
      {hasCTA && (
        <div className="px-2.5 pb-2.5">
          {showCollectFromRider ? (
            <button
              type="button"
              onClick={() => onOpenCollect(order)}
              className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <Banknote className="w-3.5 h-3.5" /> Collect from Rider
            </button>
          ) : showTakePayment ? (
            <button
              type="button"
              onClick={() => onOpenPayment(order)}
              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <Banknote className="w-3.5 h-3.5" /> Collect Payment
            </button>
          ) : showAssignRider ? (
            <button
              type="button"
              onClick={() => onOpenRider(order)}
              className={`w-full py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${order.assignedRiderName ? "bg-violet-600 hover:bg-violet-700 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}
            >
              <Bike className="w-3.5 h-3.5" />
              {order.assignedRiderName ? `${order.assignedRiderName} · Change Rider` : "Assign Rider"}
            </button>
          ) : canAdvanceStatus ? (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onUpdateStatus(orderId, primaryNext)}
              className={`w-full py-2 rounded-lg ${theme.ctaBg} text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5`}
            >
              {isUpdating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                actionLabel
              )}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
