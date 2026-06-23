import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/PermissionGate";
import POSView from "../../components/pos/POSView";
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
  getDaySessionOrders,
  getCurrentDaySession,
  startDaySession,
  endDaySession,
  updateBranch,
  getCurrencySymbol,
  getDailyCurrency,
} from "../../lib/apiClient";
import {
  buildTodayReportBreakdown,
  auditSessionReportPayments,
} from "../../lib/sessionReportBreakdown";
import { printBillReceipt } from "../../lib/printBillReceipt";
import { mergeReceiptItems } from "../../lib/orderDisplay.js";
import {
  getBusinessDate,
  getBusinessDayRange,
  formatBusinessDate,
} from "../../lib/businessDay";
import { getDefaultReportPreset } from "../../lib/reportPresetDefault";
import { useSocket } from "../../contexts/SocketContext";
import { useBranch } from "../../contexts/BranchContext";
import { usePermissions } from "../../contexts/PermissionContext";
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
  Download,
  Power,
  Plus,
  Wallet,
  PlayCircle,
  Coffee,
  Globe,
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
    dot: "bg-[#25343F]",
    headerBg: "bg-[#25343F]",
    colBg: "bg-[#25343F]/10 dark:bg-[#25343F]/20",
    colBorder: "border-[#25343F]/20 dark:border-[#25343F]/30",
    countBg: "bg-[#25343F]/15 dark:bg-[#25343F]/25 text-[#25343F]",
    ctaBg: "bg-[#25343F] hover:bg-[#25343F]/90 text-white",
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

const SOURCE_FILTERS = [
  { value: "All", label: "All sources" },
  { value: "POS", label: "POS" },
  { value: "WEBSITE", label: "Website" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "FOODPANDA", label: "Foodpanda" },
];

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
  if (typeof id !== "string") return id;
  // Strip the source prefix; the numeric sequence is shared across all sources
  // (POS/website/WhatsApp), so the plain number is already globally unique.
  return id.replace(/^(ORD|WEB|WAP)-/, "");
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
  if (order.paymentAmountReceived != null) {
    const gross = Number(order.paymentAmountReceived) || 0;
    const returned = Number(order.paymentAmountReturned) || 0;
    const net = gross - returned;
    if (net >= getOrderTotal(order)) return true;
  }
  if (order.source === "FOODPANDA") return true;
  const pm = (order.paymentMethod || "").toUpperCase();
  return (
    pm === "CASH" ||
    pm === "CARD" ||
    pm === "ONLINE" ||
    pm === "SPLIT" ||
    pm === "FOODPANDA"
  );
}

function isDeliveryOrder(order) {
  const type = (order.type || order.orderType || "").toUpperCase();
  return type === "DELIVERY";
}

/** Online/card/third-party — no cash to hand in from rider. */
function isDeliveryPrepaid(order) {
  const pm = String(order.paymentMethod || "").toUpperCase();
  return pm === "ONLINE" || pm === "CARD" || pm === "FOODPANDA";
}

/**
 * Delivered delivery where the shop still needs to record cash handed in by the rider.
 * Matches rider portal: deliveryPaymentCollected !== true (undefined/false = pending).
 */
function isDeliveryPaymentPending(order) {
  if (!isDeliveryOrder(order)) return false;
  if (order.status !== "DELIVERED" && order.status !== "COMPLETED")
    return false;
  if (isDeliveryPrepaid(order)) return false;
  return order.deliveryPaymentCollected !== true;
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
    const net = gross - returned;
    if (net >= getOrderTotal(order)) return "paid";
  }
  const pm = (order.paymentMethod || "").toUpperCase();
  if (
    pm === "CASH" ||
    pm === "CARD" ||
    pm === "ONLINE" ||
    pm === "SPLIT" ||
    pm === "FOODPANDA"
  )
    return "paid";
  if (isDeliveryOrder(order) && order.deliveryPaymentCollected === true)
    return "paid";
  return "unpaid";
}

function isOrderFullyClosed(order) {
  const status = orderStatusForTab(order.status);
  if (status !== "DELIVERED") return false;
  // Customer may have paid the rider, but shop must still record hand-in — not "closed" on the board.
  if (isDeliveryPaymentPending(order)) return false;
  return getPaymentStatus(order) === "paid";
}

function getOrderTypeLabel(order) {
  const rawType = order?.orderType ?? order?.type ?? "";
  const type = String(rawType).toUpperCase();

  if (type.includes("DELIVERY")) return "Delivery";
  if (type.includes("DINE")) return "Dine In";
  if (type.includes("TAKE") || type.includes("PICKUP")) return "Takeaway";

  // Fallbacks for inconsistent backend payloads
  if (order?.deliveryAddress) return "Delivery";
  const table = order?.tableName || order?.tableNumber;
  if (table) return "Dine In";

  return "Walk-in";
}

function getOrderSourceKey(order) {
  const source = String(order?.source || "POS").toUpperCase();
  if (source === "WEBSITE" || source === "WHATSAPP" || source === "FOODPANDA") {
    return source;
  }
  return "POS";
}

function toCSVRow(cells) {
  return cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",");
}

function downloadCSV(filename, rows) {
  const content = rows.map(toCSVRow).join("\n");
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildClosedOrdersCSVRows(orders) {
  const header = [
    "Order #",
    "Date/Time",
    "Type",
    "Customer",
    "Phone",
    "Rider",
    "Table",
    "Items",
    "Total",
    "Payment",
    "Source",
  ];
  const rows = (orders || []).map((o) => {
    const items = (o.items || [])
      .map((it) => `${it.name || ""} x${it.qty ?? it.quantity ?? 1}`)
      .join(" | ");
    const payment =
      getPaymentStatus(o) === "paid"
        ? String(o.paymentMethod || "Paid")
        : "Unpaid";
    return [
      getDisplayOrderId(o),
      o.createdAt ? new Date(o.createdAt).toLocaleString("en-PK") : "",
      getOrderTypeLabel(o),
      o.customerName || "",
      o.customerPhone || "",
      o.assignedRiderName || o.orderTakerName || "",
      o.tableName || o.tableNumber || "",
      items,
      Math.round(getOrderTotal(o)),
      payment,
      o.source || "POS",
    ];
  });
  return [header, ...rows];
}

function downloadClosedOrdersCSV(orders) {
  if (!orders?.length) return;
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCSV(`closed-orders-${stamp}.csv`, buildClosedOrdersCSVRows(orders));
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
  if (primaryNext === "OUT_FOR_DELIVERY") return "Send Delivery";
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

function getStatusAdvancePermission(primaryNext) {
  if (primaryNext === "PROCESSING") return "orders.start_cooking";
  if (primaryNext === "READY") return "orders.mark_ready";
  return "orders.edit";
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const sym = getCurrencySymbol();
  const router = useRouter();
  const { socket } = useSocket() || {};
  const { currentBranch, setCurrentBranch } = useBranch() || {};
  const { hasPermission } = usePermissions();
  const canViewClosedCount = hasPermission("orders.view_closed_count");
  const canViewClosedAmount = hasPermission("orders.view_closed_amount");
  const canDownloadClosedReport = hasPermission("orders.download_closed_report");
  const canViewAwaitingPaymentSummary = hasPermission(
    "orders.view_awaiting_payment",
  );
  const canViewSessionReport = hasPermission("orders.view_session_report");
  const showClosedOrdersBar =
    canViewClosedCount || canViewClosedAmount;
  const [orders, setOrders] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState("");
  const [orderTypeFilter, setOrderTypeFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [riderFilter, setRiderFilter] = useState("All");
  const [suspended, setSuspended] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [showCancelled, setShowCancelled] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [datePreset, setDatePreset] = useState(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  // paymentPendingOnly removed; payment-pending filter UI no longer exists.

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  // "record" = Take Payment (customer payment)
  // "riderCollect" = Collect from rider (deliveryPaymentCollected)
  const [paymentModalMode, setPaymentModalMode] = useState("record");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [onlineProvider, setOnlineProvider] = useState(null);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [paymentAccountsLoading, setPaymentAccountsLoading] = useState(true);
  const [amountReceived, setAmountReceived] = useState("");
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [splitCardAmount, setSplitCardAmount] = useState("");
  const [splitOnlineAmount, setSplitOnlineAmount] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTargetOrder, setCancelTargetOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  const [riders, setRiders] = useState([]);
  const [ridersLoading, setRidersLoading] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState(null);

  const [showEndDayModal, setShowEndDayModal] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [endingDay, setEndingDay] = useState(false);

  // ── Session gate ─────────────────────────────────────────────────────────
  const [sessionGateChecked, setSessionGateChecked] = useState(false);
  const [noActiveSession, setNoActiveSession] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [savingCutoff, setSavingCutoff] = useState(false);
  const [showTodayReportModal, setShowTodayReportModal] = useState(false);
  const [loadingTodayReport, setLoadingTodayReport] = useState(false);
  const [todayReportData, setTodayReportData] = useState(null);
  const [todayReportCurrency, setTodayReportCurrency] = useState({});
  const [todayReportCurrencyLoading, setTodayReportCurrencyLoading] =
    useState(false);
  const [showLegacySessionsModal, setShowLegacySessionsModal] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [loadingSessionHistory, setLoadingSessionHistory] = useState(false);

  const [role] = useState(() => getStoredAuth()?.user?.role);
  const isOrderTaker = role === "order_taker";
  const isCashier = role === "cashier";
  const isAdmin = ["restaurant_admin", "admin", "super_admin", "manager"].includes(role);
  /** Session report: cashiers see only headline totals; owners/managers see full breakdown. */
  const showFullSessionReport = !isCashier;

  // POS view state (merged into orders page for instant switching)
  const [activeView, setActiveView] = useState("orders");
  const [posEditOrderId, setPosEditOrderId] = useState(null);
  const [posInitialTableName, setPosInitialTableName] = useState("");

  const openPOS = useCallback(
    (editId = null, tableName = "") => {
      if (editId && !hasPermission("orders.edit")) {
        toast.error("You don't have permission to edit orders");
        return;
      }
      setPosEditOrderId(editId);
      setPosInitialTableName(tableName || "");
      setActiveView("pos");
    },
    [hasPermission],
  );

  const closePOS = useCallback(() => {
    setPosEditOrderId(null);
    setPosInitialTableName("");
    setActiveView("orders");
    // Strip deep-link query params only — avoid replace when already on bare /pos
    if (router.query.view || router.query.editOrder || router.query.table) {
      router.replace("/pos", undefined, { shallow: true });
    }
  }, [router]);

  // Handle ?view=pos&table=<name> or ?editOrder=<id> deep-links from Tables/Reservations pages
  useEffect(() => {
    if (!router.isReady) return;
    const { view, table, editOrder } = router.query;
    if (view === "pos") {
      openPOS(null, table || "");
    } else if (editOrder) {
      openPOS(editOrder, "");
    }
  }, [router.isReady, router.query.view, router.query.editOrder]);

  // Ctrl+N / Cmd+N → open POS for a new order
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "n" || e.key === "N") && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (activeView !== "pos") openPOS();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeView, openPOS]);

  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState("");
  const [restaurantLogoHeight, setRestaurantLogoHeight] = useState(100);
  const [restaurantBillFooter, setRestaurantBillFooter] = useState(
    "Thank you for your order!",
  );

  // ── Data loading ────────────────────────────────────────────────────────

  async function loadOrders(dates) {
    try {
      const params = { limit: 2000 };
      if (dates?.from) params.from = dates.from.toISOString();
      if (dates?.to) params.to = dates.to.toISOString();

      const data = await getOrders(params);
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

  // Load delivery riders once on mount so inline dropdowns are ready
  useEffect(() => {
    let cancelled = false;
    setRidersLoading(true);
    getDeliveryRiders()
      .then((data) => { if (!cancelled) setRiders(data); })
      .catch(() => { if (!cancelled) setRiders([]); })
      .finally(() => { if (!cancelled) setRidersLoading(false); });
    return () => { cancelled = true; };
  }, []);

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
    setPaymentModalMode("record");
    setPaymentOrder(order);
    setPaymentMethod("CASH");
    setOnlineProvider(null);
    setAmountReceived("");
    setSplitCashAmount("");
    setSplitCardAmount("");
    setSplitOnlineAmount("");
    setPaymentError("");
    setShowPaymentModal(true);
  }

  function closePaymentModal() {
    setShowPaymentModal(false);
    setPaymentOrder(null);
    setPaymentMethod("CASH");
    setOnlineProvider(null);
    setAmountReceived("");
    setSplitCashAmount("");
    setSplitCardAmount("");
    setSplitOnlineAmount("");
    setPaymentError("");
  }

  async function handleInlineAssignRider(order, riderId) {
    if (!riderId) return;
    const orderId = getOrderId(order);
    setAssigningOrderId(orderId);
    const toastId = toast.loading("Assigning rider...");
    try {
      const isDelivery =
        String(order.orderType || order.type || "")
          .toLowerCase()
          .replace(/-/g, "_") === "delivery";
      const rawFee = order.deliveryCharges ?? order.deliveryFee;
      const extra =
        isDelivery && rawFee != null && !Number.isNaN(Number(rawFee))
          ? { deliveryCharges: Math.max(0, Number(rawFee)) }
          : {};
      const updated = await assignRiderToOrder(orderId, riderId, extra);
      updateOrderInList(orderId, updated);
      toast.success(
        order.assignedRiderId &&
          String(order.status || "").toUpperCase() === "OUT_FOR_DELIVERY"
          ? "Rider updated!"
          : "Rider assigned!",
        { id: toastId },
      );
      const isReassignOnDelivery =
        order.assignedRiderId &&
        String(order.status || "").toUpperCase() === "OUT_FOR_DELIVERY";
      if (!isReassignOnDelivery) {
        openPrintBill({ ...order, ...updated }, "bill");
      }
    } catch (err) {
      toast.error(err.message || "Failed to assign rider", { id: toastId });
    } finally {
      setAssigningOrderId(null);
    }
  }

  function openCollectPaymentModal(order) {
    setPaymentModalMode("riderCollect");
    setPaymentOrder(order);
    setPaymentMethod("CASH");
    setOnlineProvider(null);
    setAmountReceived("");
    setSplitCashAmount("");
    setSplitCardAmount("");
    setSplitOnlineAmount("");
    setPaymentError("");
    setShowPaymentModal(true);
  }

  async function handleCollectPayment(e) {
    if (e?.preventDefault) e.preventDefault();
    if (!paymentOrder) return;
    const orderId = getOrderId(paymentOrder);
    if (paymentMethod === "CASH") {
      const received = Number(amountReceived);
      const billTotal = getOrderTotal(paymentOrder);
      if (isNaN(received) || received < billTotal) {
        setPaymentError(`Amount received must be at least ${sym} ${billTotal}`);
        return;
      }
    }
    if (paymentMethod === "SPLIT") {
      const cashPart = Number(splitCashAmount);
      const cardPart = Number(splitCardAmount);
      const onlinePart = Number(splitOnlineAmount);
      const parts = [cashPart, cardPart, onlinePart];
      const positiveParts = parts.filter((n) => !isNaN(n) && n > 0).length;
      const billTotal = getOrderTotal(paymentOrder);
      const splitTotal =
        (isNaN(cashPart) ? 0 : cashPart) +
        (isNaN(cardPart) ? 0 : cardPart) +
        (isNaN(onlinePart) ? 0 : onlinePart);
      if (positiveParts < 2) {
        setPaymentError("Split payment needs at least 2 non-zero parts.");
        return;
      }
      if (Math.abs(splitTotal - billTotal) > 0.01) {
        setPaymentError(
          `Split amounts must equal bill total (${sym} ${billTotal.toFixed(2)}).`,
        );
        return;
      }
      if (onlinePart > 0 && !onlineProvider) {
        setPaymentError("Select an online account for the online split part.");
        return;
      }
    }
    setPaymentLoading(true);
    setPaymentError("");
    const toastId = toast.loading("Collecting payment...");
    try {
      const payload = { paymentMethod };
      if (paymentMethod === "CASH") {
        const received = Number(amountReceived);
        const billTotal = getOrderTotal(paymentOrder);
        payload.amountReceived = received;
        payload.amountReturned = Math.max(0, received - billTotal);
      }
      if (paymentMethod === "ONLINE") payload.paymentProvider = onlineProvider;
      if (paymentMethod === "SPLIT") {
        payload.cashAmount = Number(splitCashAmount) || 0;
        payload.cardAmount = Number(splitCardAmount) || 0;
        payload.onlineAmount = Number(splitOnlineAmount) || 0;
        if ((Number(splitOnlineAmount) || 0) > 0 && onlineProvider) {
          payload.paymentProvider = onlineProvider;
        }
      }
      const updated = await collectDeliveryPayment(orderId, payload);
      updateOrderInList(orderId, updated);
      toast.success("Payment collected from rider!", { id: toastId });
      closePaymentModal();
    } catch (err) {
      toast.error(err.message || "Failed to collect payment", { id: toastId });
    } finally {
      setPaymentLoading(false);
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

  async function handleStartSession() {
    setStartingSession(true);
    try {
      await startDaySession(currentBranch?.id);
      setNoActiveSession(false);
      toast.success("Business day started!");
      loadOrders(dateRange);
    } catch (err) {
      toast.error(err.message || "Failed to start session");
    } finally {
      setStartingSession(false);
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
        setPaymentError(`Amount received must be at least ${sym} ${billTotal}`);
        return;
      }
    }
    if (paymentMethod === "SPLIT") {
      const cashPart = Number(splitCashAmount);
      const cardPart = Number(splitCardAmount);
      const onlinePart = Number(splitOnlineAmount);
      const parts = [cashPart, cardPart, onlinePart];
      const positiveParts = parts.filter((n) => !isNaN(n) && n > 0).length;
      if (positiveParts < 2) {
        setPaymentError(
          "Split payment requires at least 2 non-zero parts (cash/card/online).",
        );
        return;
      }
      const splitTotal =
        (isNaN(cashPart) ? 0 : cashPart) +
        (isNaN(cardPart) ? 0 : cardPart) +
        (isNaN(onlinePart) ? 0 : onlinePart);
      if (Math.abs(splitTotal - billTotal) > 0.01) {
        setPaymentError(
          `Split amounts must equal bill total (${sym} ${billTotal.toFixed(2)}).`,
        );
        return;
      }
      if (onlinePart > 0 && !onlineProvider) {
        setPaymentError("Select an online account for the online part.");
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
      if (paymentMethod === "SPLIT") {
        payload.cashAmount = Number(splitCashAmount);
        payload.cardAmount = Number(splitCardAmount) || 0;
        payload.onlineAmount = Number(splitOnlineAmount);
        if ((Number(splitOnlineAmount) || 0) > 0) {
          payload.paymentProvider = onlineProvider;
        }
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
    if (datePreset !== "today") return list;
    const todayStr = new Date().toISOString().slice(0, 10);
    return list.filter((o) => {
      const isToday = (o.createdAt || "").slice(0, 10) === todayStr;
      const st = (o.status || "").toUpperCase();
      const isActive = !["DELIVERED", "COMPLETED", "CANCELLED"].includes(st);
      const isAwaitingPayment =
        (st === "DELIVERED" || st === "COMPLETED") &&
        getPaymentStatus(o) === "unpaid";
      const needsRiderHandIn =
        (st === "DELIVERED" || st === "COMPLETED") && isDeliveryPaymentPending(o);
      return isToday || isActive || isAwaitingPayment || needsRiderHandIn;
    });
  }, [orders, isCashier, datePreset]);

  const cutoffHour = currentBranch?.businessDayCutoffHour ?? 4;
  const businessDateStr = getBusinessDate(new Date(), cutoffHour);

  function shiftBusinessDateStr(dateStr, deltaDays) {
    const [y, m, d] = String(dateStr).split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + deltaDays);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const dateRange = useMemo(() => {
    if (!datePreset) return null;
    if (datePreset === "today") return getBusinessDayRange(businessDateStr, cutoffHour);
    if (datePreset === "yesterday") return getBusinessDayRange(shiftBusinessDateStr(businessDateStr, -1), cutoffHour);

    if (datePreset === "7days") {
      const fromStr = shiftBusinessDateStr(businessDateStr, -6);
      return {
        from: getBusinessDayRange(fromStr, cutoffHour).from,
        to: getBusinessDayRange(businessDateStr, cutoffHour).to,
      };
    }
    if (datePreset === "30days") {
      const fromStr = shiftBusinessDateStr(businessDateStr, -29);
      return {
        from: getBusinessDayRange(fromStr, cutoffHour).from,
        to: getBusinessDayRange(businessDateStr, cutoffHour).to,
      };
    }

    // custom range: treat inputs as business-date strings.
    if (datePreset === "custom") {
      const fromRange = customFrom ? getBusinessDayRange(customFrom, cutoffHour) : null;
      const toRange = customTo ? getBusinessDayRange(customTo, cutoffHour) : null;

      if (fromRange && toRange) return { from: fromRange.from, to: toRange.to };
      if (fromRange) return { from: fromRange.from, to: fromRange.to };
      if (toRange) return { from: toRange.from, to: toRange.to };
    }

    return getBusinessDayRange(businessDateStr, cutoffHour);
  }, [datePreset, customFrom, customTo, businessDateStr, cutoffHour]);

  // Re-subscribe socket listeners whenever dateRange changes (must be after dateRange is declared)
  useEffect(() => {
    if (!socket || !dateRange) return;
    const onOrderEvent = () => loadOrders(dateRange);
    socket.on("order:created", onOrderEvent);
    socket.on("order:updated", onOrderEvent);
    return () => {
      socket.off("order:created", onOrderEvent);
      socket.off("order:updated", onOrderEvent);
    };
  }, [socket, dateRange]);

  const loadTodaySessionReport = useCallback(async () => {
    setLoadingTodayReport(true);
    try {
      const cur = await getCurrentDaySession(currentBranch?.id);
      let sessionId = cur?.id;
      let meta = cur
        ? {
            status: "OPEN",
            startAt: cur.startAt,
            endAt: cur.endAt,
          }
        : null;

      if (!sessionId) {
        const res = await getDaySessions(currentBranch?.id, { limit: 40 });
        const sessions = Array.isArray(res?.sessions) ? res.sessions : [];
        const match = sessions.find(
          (s) =>
            getBusinessDate(new Date(s.startAt), cutoffHour) === businessDateStr,
        );
        if (match) {
          sessionId = match.id;
          meta = {
            status: match.status,
            startAt: match.startAt,
            endAt: match.endAt,
          };
        }
      }

      if (!sessionId) {
        setTodayReportData(null);
        return;
      }

      const pack = await getDaySessionOrders(sessionId);

      setTodayReportData({
        meta,
        orders: pack?.orders || [],
        sessionId,
      });
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to load today's report");
      setTodayReportData(null);
    } finally {
      setLoadingTodayReport(false);
    }
  }, [currentBranch?.id, cutoffHour, businessDateStr]);

  const todayReportBreakdown = useMemo(() => {
    if (!todayReportData) return null;
    return buildTodayReportBreakdown(todayReportData.orders || []);
  }, [todayReportData]);

  useEffect(() => {
    if (typeof window === "undefined" || !todayReportData?.orders?.length)
      return;
    if (isCashier) return;
    try {
      if (window.localStorage.getItem("DEBUG_SESSION_PAYMENTS") !== "1")
        return;
      const audit = auditSessionReportPayments(todayReportData.orders);
      console.log("[Today's session report — payment audit]", {
        cashKpiShownInModal: todayReportBreakdown?.payment?.cash,
        ...audit,
      });
    } catch (e) {
      console.warn("[Today's session report — payment audit failed]", e);
    }
  }, [todayReportData, todayReportBreakdown, isCashier]);
  useEffect(() => {
    if (!todayReportData?.meta?.startAt) {
      setTodayReportCurrency({});
      return;
    }
    const d = new Date(todayReportData.meta.startAt);
    if (Number.isNaN(d.getTime())) return;
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let cancelled = false;
    setTodayReportCurrencyLoading(true);
    getDailyCurrency(date)
      .then((res) => {
        if (cancelled) return;
        setTodayReportCurrency(
          res?.quantities && typeof res.quantities === "object"
            ? res.quantities
            : {},
        );
      })
      .catch(() => {
        if (!cancelled) setTodayReportCurrency({});
      })
      .finally(() => {
        if (!cancelled) setTodayReportCurrencyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [todayReportData?.meta?.startAt]);

  const todayReportCashDenom = useMemo(() => {
    const currencyRows = Object.entries(todayReportCurrency || {})
      .map(([denom, qty]) => ({
        denom: Number(denom),
        qty: Number(qty) || 0,
      }))
      .filter((r) => Number.isFinite(r.denom) && r.denom > 0 && r.qty > 0)
      .sort((a, b) => b.denom - a.denom)
      .map((r) => ({ ...r, subtotal: r.denom * r.qty }));
    const notesRows = currencyRows.filter((r) => r.denom >= 1);
    const coinsRows = currencyRows.filter((r) => r.denom < 1);
    const countedCashTotal = currencyRows.reduce(
      (sum, r) => sum + Number(r.subtotal || 0),
      0,
    );
    const expectedCash = Number(todayReportBreakdown?.payment?.cash ?? 0);
    const cashDiff = countedCashTotal - expectedCash;
    return {
      currencyRows,
      notesRows,
      coinsRows,
      countedCashTotal,
      expectedCash,
      cashDiff,
    };
  }, [todayReportCurrency, todayReportBreakdown?.payment?.cash]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loadedSessions = [];
      try {
        const res = await getDaySessions(currentBranch?.id, { limit: 30 });
        loadedSessions = Array.isArray(res?.sessions) ? res.sessions : [];
      } catch {
        loadedSessions = [];
      }
      if (cancelled) return;
      setDatePreset(getDefaultReportPreset(loadedSessions));
    })();
    return () => {
      cancelled = true;
    };
  }, [currentBranch?.id]);

  const dateRangeKey = `${dateRange?.from?.getTime() ?? ""}-${dateRange?.to?.getTime() ?? ""}`;
  useEffect(() => {
    if (!datePreset || !dateRange) return;
    loadOrders(dateRange);
  }, [dateRangeKey, datePreset, dateRange]);

  // ── Session gate check ───────────────────────────────────────────────────
  // Runs on mount and whenever the branch changes.
  // Order takers and admins both need an active session; riders are handled in rider.js.
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
          setNoActiveSession(false); // fail-open so a network error doesn't block forever
          setSessionGateChecked(true);
        }
      });
    return () => { cancelled = true; };
  }, [currentBranch?.id]);

  const baseFiltered = useMemo(() => {
    const base = Array.isArray(cashierBaseOrders) ? cashierBaseOrders : [];
    const term = search.trim().toLowerCase();
    const hasDateRange = dateRange && (dateRange.from || dateRange.to);
    const fromMs = hasDateRange && dateRange.from ? dateRange.from.getTime() : 0;
    const toMs = hasDateRange && dateRange.to ? dateRange.to.getTime() : Infinity;
    const filterType = orderTypeFilter !== "All";
    const filterSource = sourceFilter !== "All";

    const filtered = base.filter((o) => {
      if (hasDateRange) {
        const t = new Date(o.createdAt).getTime();
        if (t < fromMs || t > toMs) return false;
      }
      if (term && !(
        (o.id || "").toLowerCase().includes(term) ||
        (o.customerName || "").toLowerCase().includes(term) ||
        (o.orderTakerName || "").toLowerCase().includes(term) ||
        (o.assignedRiderName || "").toLowerCase().includes(term) ||
        (o.externalOrderId || "").toLowerCase().includes(term) ||
        (o.customerPhone || "").toLowerCase().includes(term)
      )) return false;
      if (filterType && getOrderTypeLabel(o) !== orderTypeFilter) return false;
      if (filterSource && getOrderSourceKey(o) !== sourceFilter) return false;
      if (riderFilter !== "All") {
        const rider = riders.find((r) => r.id === riderFilter);
        const riderName = rider?.name?.trim().toLowerCase() || "";
        const orderRiderId = String(o.assignedRiderId || "");
        const orderRiderName = String(o.assignedRiderName || "")
          .trim()
          .toLowerCase();
        if (
          orderRiderId !== String(riderFilter) &&
          (!riderName || orderRiderName !== riderName)
        ) {
          return false;
        }
      }
      return true;
    });

    const dir = -1; // Newest First
    filtered.sort((a, b) => dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    return filtered;
  }, [
    cashierBaseOrders,
    search,
    orderTypeFilter,
    sourceFilter,
    riderFilter,
    riders,
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
  const closedTotalAmount = (groupedOrders.DELIVERED || []).reduce(
    (sum, order) => sum + getOrderTotal(order),
    0,
  );
  const cancelledCount = groupedOrders.CANCELLED?.length || 0;
  const cancelledTotalAmount = (groupedOrders.CANCELLED || []).reduce(
    (sum, order) => sum + getOrderTotal(order),
    0,
  );
  const awaitingTotalAmount = (groupedOrders.AWAITING_PAYMENT || []).reduce(
    (sum, order) => sum + getOrderTotal(order),
    0,
  );

  // ── Render ─────────────────────────────────────────────────────────────

  const handlePosOrderChanged = useCallback(() => {
    if (!dateRange) return;
    loadOrders(dateRange);
  }, [dateRange]);

  return (
    <AdminLayout
      title="Point of Sale"
      subtitle="Manage orders and payments"
      suspended={suspended}
    >
      <PermissionGate permission="orders.view">
      {/* ── POS View ──────────────────────────────────────────────── */}
      <div style={{ display: activeView === "pos" ? "block" : "none" }}>
        <POSView
          editOrderId={posEditOrderId}
          onClose={closePOS}
          onOrderChanged={handlePosOrderChanged}
          isActive={activeView === "pos"}
          initialTableName={posInitialTableName}
        />
      </div>

      {/* ── Orders View ───────────────────────────────────────────── */}
      <div style={{ display: activeView === "orders" ? "block" : "none" }}>
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
            {/* Row 1: Filters (left) + Search (middle) + New Order + Refresh (right) */}
            <div className="flex items-center gap-2">
              {/* Order type */}
              <select
                value={orderTypeFilter}
                onChange={(e) => setOrderTypeFilter(e.target.value)}
                className="h-9 pl-3 pr-8 rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all flex-shrink-0 cursor-pointer appearance-none min-w-[7.5rem]"
                aria-label="Filter by order type"
              >
                {ORDER_TYPE_FILTERS.map((t) => (
                  <option key={t} value={t}>
                    {t === "All" ? `All (${totalActive})` : t}
                  </option>
                ))}
              </select>

              {/* Rider */}
              <div className="relative flex-shrink-0">
                <select
                  value={riderFilter}
                  onChange={(e) => setRiderFilter(e.target.value)}
                  disabled={ridersLoading}
                  className="h-9 pl-8 pr-8 rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer appearance-none min-w-[8.5rem] disabled:opacity-60"
                  aria-label="Filter by rider"
                >
                  <option value="All">All riders</option>
                  {riders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <Bike className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-neutral-500" />
              </div>

              {/* Source */}
              <div className="relative flex-shrink-0">
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="h-9 pl-8 pr-8 rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer appearance-none min-w-[8.5rem]"
                  aria-label="Filter by order source"
                >
                  {SOURCE_FILTERS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <Globe className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-neutral-500" />
              </div>

              {/* Search */}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order #, customer, phone, rider..."
                className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* New Order */}
                {hasPermission("orders.create") && (
                <button
                  type="button"
                  onClick={() => openPOS()}
                  className="h-9 px-3.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-colors flex-shrink-0 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> New Order
                </button>
                )}

                {/* Date filter */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowDateDropdown((v) => !v)}
                    className="h-9 px-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-[11px] font-semibold text-gray-700 dark:text-neutral-300 hover:border-gray-400 dark:hover:border-neutral-500 transition-all inline-flex items-center gap-1.5"
                  >
                    <Clock className="w-3 h-3 text-gray-400 dark:text-neutral-500" />
                    {
                      {
                        today: "Today",
                        yesterday: "Yesterday",
                        "7days": "Last 7 Days",
                        "30days": "Last Month",
                        custom: "Custom",
                      }[datePreset] || "Today"
                    }
                    <ChevronDown
                      className={`w-3 h-3 text-gray-400 transition-transform ${
                        showDateDropdown ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {showDateDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowDateDropdown(false)}
                      />
                      <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden">
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

                {/* Refresh */}
                <button
                  type="button"
                  onClick={() => {
                    if (!dateRange) return;
                    const toastId = toast.loading("Refreshing...");
                    loadOrders(dateRange)
                      .then(() => toast.success("Refreshed!", { id: toastId }))
                      .catch(() => toast.dismiss(toastId));
                  }}
                  className="h-9 px-3 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors flex-shrink-0 inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>

                {/* Session indicator */}
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 text-[11px] font-semibold flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                  {formatBusinessDate(businessDateStr)}
                </span>
                {canViewSessionReport && (
                <button
                  type="button"
                  onClick={() => {
                    loadTodaySessionReport();
                    setShowTodayReportModal(true);
                  }}
                  className="h-9 w-9 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-500 dark:text-neutral-400 hover:border-gray-400 dark:hover:border-neutral-500 transition-all inline-flex items-center justify-center flex-shrink-0"
                  title="Today's session report"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
                )}
                <button
                  type="button"
                  onClick={openEndDayModal}
                  className="h-9 w-9 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all inline-flex items-center justify-center flex-shrink-0"
                  title="End business day"
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
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
                      <span className="ml-auto flex items-center gap-1 flex-shrink-0">
                      {(col.status !== "AWAITING_PAYMENT" ||
                        canViewAwaitingPaymentSummary) && (
                        <span
                          className={`text-[11px] font-bold min-w-[24px] text-center px-1.5 py-0.5 rounded-full ${theme.countBg}`}
                        >
                          {allColOrders.length}
                        </span>
                      )}
                        {col.status === "AWAITING_PAYMENT" &&
                          canViewAwaitingPaymentSummary &&
                          allColOrders.length > 0 && (
                            <span
                              className={`text-[11px] font-bold text-center px-1.5 py-0.5 rounded-full ${theme.countBg}`}
                            >
                              {sym}{" "}
                              {Math.round(awaitingTotalAmount).toLocaleString()}
                            </span>
                          )}
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
                            isAdmin={isAdmin}
                            updatingId={updatingId}
                            onUpdateStatus={handleUpdateStatus}
                            onOpenCancel={openCancelModal}
                            onOpenPayment={openPaymentModal}
                            riders={riders}
                            ridersLoading={ridersLoading}
                            assigningOrderId={assigningOrderId}
                            onAssignRider={handleInlineAssignRider}
                            onOpenCollect={openCollectPaymentModal}
                            onPrint={openPrintBill}
                            onEdit={(order) =>
                              openPOS(order.id || order._id)
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
          {closedCount > 0 && showClosedOrdersBar && (
            <div className="w-[300px] flex flex-col rounded-t-xl shadow-2xl overflow-hidden border border-b-0 border-gray-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => setShowClosed(!showClosed)}
                className="flex items-center justify-between px-4 py-2.5 bg-gray-700 dark:bg-neutral-800 text-white hover:bg-gray-600 dark:hover:bg-neutral-700 transition-colors flex-shrink-0"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-sm font-semibold">Closed</span>
                  {canViewClosedCount && (
                    <span className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded-full">
                      {closedCount}
                    </span>
                  )}
                  {canViewClosedAmount && (
                    <span className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded-full">
                      {sym} {Math.round(closedTotalAmount).toLocaleString()}
                    </span>
                  )}
                  {canDownloadClosedReport && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadClosedOrdersCSV(groupedOrders.DELIVERED);
                      }}
                      className="p-1 rounded-md hover:bg-white/20 transition-colors"
                      aria-label="Download closed orders"
                      title="Download closed orders (CSV)"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
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
                      riders={riders}
                      ridersLoading={ridersLoading}
                      assigningOrderId={assigningOrderId}
                      onAssignRider={handleInlineAssignRider}
                      onOpenCollect={openCollectPaymentModal}
                      onPrint={openPrintBill}
                      onEdit={(order) =>
                        openPOS(order.id || order._id)
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
                  <span className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded-full">
                    {sym} {Math.round(cancelledTotalAmount).toLocaleString()}
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
                      riders={riders}
                      ridersLoading={ridersLoading}
                      assigningOrderId={assigningOrderId}
                      onAssignRider={handleInlineAssignRider}
                      onOpenCollect={openCollectPaymentModal}
                      onPrint={openPrintBill}
                      onEdit={(order) =>
                        openPOS(order.id || order._id)
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
                    {paymentModalMode === "riderCollect"
                      ? "Collect Payment"
                      : "Take Payment"}
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
                  {paymentModalMode === "riderCollect"
                    ? "Amount to Collect"
                    : "Bill Total"}
                </p>
                <p className="text-4xl font-black text-gray-900 dark:text-white tabular-nums leading-none">
                  {sym} {Math.round(getOrderTotal(paymentOrder)).toLocaleString()}
                </p>
                {getOrderTotal(paymentOrder) % 1 !== 0 && (
                  <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">
                    {getOrderTotal(paymentOrder).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
            <form
              onSubmit={paymentModalMode === "riderCollect" ? handleCollectPayment : handleRecordPayment}
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
                <div className="grid grid-cols-4 gap-2">
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
                        "border-primary bg-primary/10 dark:bg-primary/20 text-primary",
                    },
                    {
                      m: "SPLIT",
                      Icon: Wallet,
                      label: "Split",
                      active:
                        "border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
                    },
                  ].map(({ m, Icon, label, active }) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m);
                        if (m !== "ONLINE" && m !== "SPLIT")
                          setOnlineProvider(null);
                      }}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${paymentMethod === m ? active : "border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600"}`}
                    >
                      <Icon className="w-5 h-5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {paymentMethod === "SPLIT" &&
                (() => {
                  const orderTotal = getOrderTotal(paymentOrder);
                  const cashPart = Number(splitCashAmount);
                  const cardPart = Number(splitCardAmount);
                  const onlinePart = Number(splitOnlineAmount);
                  const hasCash = splitCashAmount !== "" && !isNaN(cashPart);
                  const hasCard = splitCardAmount !== "" && !isNaN(cardPart);
                  const hasOnline =
                    splitOnlineAmount !== "" && !isNaN(onlinePart);
                  const splitSum =
                    (hasCash ? cashPart : 0) +
                    (hasCard ? cardPart : 0) +
                    (hasOnline ? onlinePart : 0);
                  const diff = orderTotal - splitSum;
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">
                            Cash amount (Rs)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={splitCashAmount}
                            onChange={(e) => setSplitCashAmount(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-semibold text-gray-900 dark:text-white placeholder:font-normal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">
                            Card amount (Rs)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={splitCardAmount}
                            onChange={(e) => setSplitCardAmount(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-semibold text-gray-900 dark:text-white placeholder:font-normal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">
                            Online amount (Rs)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={splitOnlineAmount}
                            onChange={(e) => setSplitOnlineAmount(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-semibold text-gray-900 dark:text-white placeholder:font-normal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800">
                        <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
                          Remaining
                        </span>
                        <span
                          className={`text-sm font-black tabular-nums ${
                            Math.abs(diff) < 0.01
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {sym} {diff.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              {(paymentMethod === "ONLINE" ||
                (paymentMethod === "SPLIT" &&
                  (Number(splitOnlineAmount) || 0) > 0)) && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
                    Paid to
                  </label>
                  {paymentAccountsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
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
                          className={`px-3 py-2.5 rounded-xl border-2 text-left transition-all ${onlineProvider === acc.name ? "border-primary bg-primary/10 dark:bg-primary/20" : "border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600"}`}
                        >
                          <p
                            className={`text-xs font-semibold truncate ${onlineProvider === acc.name ? "text-primary" : "text-gray-700 dark:text-neutral-300"}`}
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
                            {sym} {(receivedNum - orderTotal).toFixed(2)}
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
                            {sym} {(orderTotal - receivedNum).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
              {paymentModalMode === "riderCollect" && paymentOrder?.assignedRiderName && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30">
                  <Bike className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                      {paymentOrder.assignedRiderName}
                    </p>
                    {paymentOrder?.assignedRiderPhone && (
                      <p className="text-[10px] text-indigo-500 dark:text-indigo-500">
                        {paymentOrder.assignedRiderPhone}
                      </p>
                    )}
                  </div>
                </div>
              )}
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
                    (paymentModalMode === "record"
                      ? ((paymentMethod === "CASH" &&
                          (amountReceived === "" ||
                            Number(amountReceived) <
                              getOrderTotal(paymentOrder))) ||
                          (paymentMethod === "ONLINE" && !onlineProvider) ||
                          (paymentMethod === "SPLIT" &&
                            (() => {
                              const cash = Number(splitCashAmount) || 0;
                              const card = Number(splitCardAmount) || 0;
                              const online = Number(splitOnlineAmount) || 0;
                              const positiveParts = [cash, card, online].filter(
                                (n) => n > 0,
                              ).length;
                              const sumMatches =
                                Math.abs(
                                  cash + card + online - getOrderTotal(paymentOrder),
                                ) <= 0.01;
                              const providerNeeded =
                                online > 0 && !onlineProvider;
                              return positiveParts < 2 || !sumMatches || providerNeeded;
                            })()))
                      : paymentModalMode === "riderCollect"
                        ? (paymentMethod === "CASH" &&
                            (amountReceived === "" ||
                              Number(amountReceived) < getOrderTotal(paymentOrder))) ||
                          (paymentMethod === "ONLINE" && !onlineProvider) ||
                          (paymentMethod === "SPLIT" &&
                            (() => {
                              const cash = Number(splitCashAmount) || 0;
                              const card = Number(splitCardAmount) || 0;
                              const online = Number(splitOnlineAmount) || 0;
                              const positiveParts = [cash, card, online].filter(
                                (n) => n > 0,
                              ).length;
                              const sumMatches =
                                Math.abs(
                                  cash + card + online - getOrderTotal(paymentOrder),
                                ) <= 0.01;
                              const providerNeeded =
                                online > 0 && !onlineProvider;
                              return positiveParts < 2 || !sumMatches || providerNeeded;
                            })())
                        : false)
                  }
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-colors ${
                    paymentModalMode === "riderCollect"
                      ? "bg-amber-500 hover:bg-amber-600"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {paymentLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                    </>
                  ) : (
                    <>
                      <CircleCheckBig className="w-4 h-4" />
                      {paymentModalMode === "riderCollect" ? "Collect Payment" : "Record Payment"}
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


      {/* ── Today's session report ───────────────────────────────── */}
      {showTodayReportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTodayReportModal(false);
          }}
        >
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col text-[13px]">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-200 dark:border-neutral-800 bg-gradient-to-r from-gray-50/90 to-white dark:from-neutral-900/80 dark:to-neutral-950">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                    Today&apos;s session report
                  </h2>
                  {todayReportData?.meta?.status === "OPEN" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-500/25">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      OPEN
                    </span>
                  ) : todayReportData?.meta?.status ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 border border-gray-200 dark:border-neutral-700">
                      {todayReportData.meta.status}
                    </span>
                  ) : null}
                </div>
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 mt-0.5">
                  {currentBranch?.name || "All branches"} · Business day{" "}
                  {formatBusinessDate(businessDateStr)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {todayReportData?.meta?.startAt && (
                  <p className="text-[10px] text-gray-500 dark:text-neutral-400 text-right leading-tight max-w-[calc(100vw-8rem)] sm:max-w-[220px]">
                    {new Date(todayReportData.meta.startAt).toLocaleString(
                      "en-PK",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      },
                    )}
                    {todayReportData.meta.status === "OPEN"
                      ? " · Ongoing"
                      : todayReportData.meta.endAt
                        ? ` → ${new Date(todayReportData.meta.endAt).toLocaleString("en-PK", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}`
                        : ""}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setShowTodayReportModal(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {loadingTodayReport ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    Loading session numbers…
                  </p>
                </div>
              ) : !todayReportData?.sessionId ? (
                <div className="text-center py-8 px-3 rounded-xl border border-dashed border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/30">
                  <p className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    No business-day session found for today.
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-neutral-500 mt-0.5">
                    Start a session from the POS to see live totals here.
                  </p>
                </div>
              ) : (
                <>
                  {todayReportBreakdown && (
                    <>
                      {/* KPI row — cashiers: total sales only (no order count) */}
                      <div
                        className={`grid gap-2 ${showFullSessionReport ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}
                      >
                        <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 shadow-sm">
                          <p className="text-[9px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide">
                            {showFullSessionReport ? "Total revenue" : "Total sales"}
                          </p>
                          <p className="mt-1 text-[22px] leading-none font-black text-gray-900 dark:text-white tabular-nums">
                            {sym}{" "}
                            {Math.round(
                              todayReportBreakdown.totalRevenue || 0,
                            ).toLocaleString()}
                          </p>
                          {showFullSessionReport ? (
                            todayReportBreakdown.unpaid.totalCount > 0 ? (
                              <div className="mt-1.5 space-y-0.5 text-[9px] text-amber-600 dark:text-amber-400">
                                <p className="font-semibold leading-snug">
                                  Unpaid total: {sym}{" "}
                                  {Math.round(
                                    todayReportBreakdown.unpaid.totalAmt,
                                  ).toLocaleString()}{" "}
                                  · {todayReportBreakdown.unpaid.totalCount}{" "}
                                  orders
                                </p>
                                <p className="text-[8px] leading-snug opacity-95">
                                  In progress: {sym}{" "}
                                  {Math.round(
                                    todayReportBreakdown.unpaid.pipelineAmt,
                                  ).toLocaleString()}{" "}
                                  ({todayReportBreakdown.unpaid.pipelineCount}) ·
                                  Delivered, payment pending: {sym}{" "}
                                  {Math.round(
                                    todayReportBreakdown.unpaid.deliveredAmt,
                                  ).toLocaleString()}{" "}
                                  ({todayReportBreakdown.unpaid.deliveredCount})
                                  {todayReportBreakdown.unpaid.otherCount > 0
                                    ? ` · Other unpaid: ${sym} ${Math.round(todayReportBreakdown.unpaid.otherAmt).toLocaleString()} (${todayReportBreakdown.unpaid.otherCount})`
                                    : ""}
                                </p>
                              </div>
                            ) : (
                              <p className="mt-1.5 text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
                                All recorded orders paid
                              </p>
                            )
                          ) : null}
                        </div>
                        {showFullSessionReport && (
                        <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 shadow-sm">
                          <p className="text-[9px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide">
                            Orders
                          </p>
                          <p className="mt-1 text-[22px] leading-none font-black text-gray-900 dark:text-white tabular-nums">
                            {(todayReportBreakdown.totalOrders ?? 0).toLocaleString()}
                          </p>
                          <>
                              <p className="mt-1.5 text-[9px] text-gray-500 dark:text-neutral-400 leading-snug">
                                Paid orders in session (closed sales)
                              </p>
                              {(todayReportBreakdown.totalOrders ?? 0) > 0 && (
                                <p className="mt-1 text-[10px] font-semibold text-gray-700 dark:text-neutral-300">
                                  Avg {sym}{" "}
                                  {Math.round(
                                    todayReportBreakdown.totalRevenue /
                                      todayReportBreakdown.totalOrders,
                                  ).toLocaleString()}
                                </p>
                              )}
                            </>
                        </div>
                        )}
                      </div>

                      {showFullSessionReport ? (
                        <>
                      {/* Payment method KPIs */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2 py-2 text-center shadow-sm">
                          <p className="text-[9px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide">
                            Cash
                          </p>
                          <p className="mt-0.5 text-base font-black text-gray-900 dark:text-white tabular-nums leading-tight">
                            {sym}{" "}
                            {Math.round(
                              todayReportBreakdown.payment.cash,
                            ).toLocaleString()}
                          </p>
                          <p className="text-[9px] text-gray-400 mt-0.5">
                            {todayReportBreakdown.payment.cashOrders} orders
                          </p>
                        </div>
                        <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2 py-2 text-center shadow-sm">
                          <p className="text-[9px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide">
                            Card
                          </p>
                          <p className="mt-0.5 text-base font-black text-gray-900 dark:text-white tabular-nums leading-tight">
                            {sym}{" "}
                            {Math.round(
                              todayReportBreakdown.payment.card,
                            ).toLocaleString()}
                          </p>
                          <p className="text-[9px] text-gray-400 mt-0.5">
                            {todayReportBreakdown.payment.cardOrders} orders
                          </p>
                        </div>
                        <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2 py-2 text-center shadow-sm">
                          <p className="text-[9px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide">
                            Online
                          </p>
                          <p className="mt-0.5 text-base font-black text-gray-900 dark:text-white tabular-nums leading-tight">
                            {sym}{" "}
                            {Math.round(
                              todayReportBreakdown.payment.online,
                            ).toLocaleString()}
                          </p>
                          <p className="text-[9px] text-gray-400 mt-0.5">
                            {todayReportBreakdown.payment.onlineOrders} orders
                          </p>
                          {todayReportBreakdown.payment.onlineProviders.length >
                            0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-gray-100 dark:border-neutral-800 space-y-0.5 max-h-16 overflow-y-auto text-left">
                              {todayReportBreakdown.payment.onlineProviders.map(
                                ([name, amt]) => (
                                  <div
                                    key={name}
                                    className="flex justify-between gap-2 text-[9px] text-gray-500 dark:text-neutral-400"
                                  >
                                    <span className="truncate">{name}</span>
                                    <span className="tabular-nums shrink-0">
                                      {sym}{" "}
                                      {Math.round(amt).toLocaleString()}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Cash denomination (same calendar day as session start) */}
                      <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                          <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                            Cash breakdown
                          </h3>
                          <span className="text-[10px] text-gray-500 dark:text-neutral-400">
                            Saved denomination count
                          </span>
                        </div>
                        {todayReportCurrencyLoading ? (
                          <div className="py-4 flex justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          </div>
                        ) : todayReportCashDenom.currencyRows.length === 0 ? (
                          <p className="text-[11px] text-gray-500 dark:text-neutral-400 py-1">
                            No denomination count saved for this day.
                          </p>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="rounded-md border border-gray-100 dark:border-neutral-800 px-2 py-1.5">
                                <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500 mb-1">
                                  Notes
                                </p>
                                <div className="space-y-1">
                                  {todayReportCashDenom.notesRows.length === 0 ? (
                                    <p className="text-[10px] text-gray-400">
                                      None
                                    </p>
                                  ) : (
                                    todayReportCashDenom.notesRows.map((r) => (
                                      <div
                                        key={`n-${r.denom}`}
                                        className="flex justify-between text-[10px]"
                                      >
                                        <span className="text-gray-600 dark:text-neutral-400">
                                          {sym}{" "}
                                          {Math.round(r.denom).toLocaleString()}{" "}
                                          × {r.qty}
                                        </span>
                                        <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                                          {sym}{" "}
                                          {Math.round(r.subtotal).toLocaleString()}
                                        </span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                              <div className="rounded-md border border-gray-100 dark:border-neutral-800 px-2 py-1.5">
                                <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500 mb-0.5">
                                  Coins
                                </p>
                                <div className="space-y-1">
                                  {todayReportCashDenom.coinsRows.length === 0 ? (
                                    <p className="text-[10px] text-gray-400">
                                      None
                                    </p>
                                  ) : (
                                    todayReportCashDenom.coinsRows.map((r) => (
                                      <div
                                        key={`c-${r.denom}`}
                                        className="flex justify-between text-[10px]"
                                      >
                                        <span className="text-gray-600 dark:text-neutral-400">
                                          {sym}{" "}
                                          {r.denom.toLocaleString()} × {r.qty}
                                        </span>
                                        <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                                          {sym}{" "}
                                          {Math.round(r.subtotal).toLocaleString()}
                                        </span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="rounded-md bg-gray-50 dark:bg-neutral-800/60 px-2 py-1.5">
                                <p className="text-[9px] uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                                  Expected cash
                                </p>
                                <p className="text-[11px] font-bold text-gray-900 dark:text-white">
                                  {sym}{" "}
                                  {Math.round(
                                    todayReportCashDenom.expectedCash,
                                  ).toLocaleString()}
                                </p>
                              </div>
                              <div className="rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1.5">
                                <p className="text-[9px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                                  Counted cash
                                </p>
                                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                  {sym}{" "}
                                  {Math.round(
                                    todayReportCashDenom.countedCashTotal,
                                  ).toLocaleString()}
                                </p>
                              </div>
                              <div
                                className={`rounded-md px-2 py-1.5 ${
                                  todayReportCashDenom.cashDiff === 0
                                    ? "bg-gray-50 dark:bg-neutral-800/60"
                                    : todayReportCashDenom.cashDiff > 0
                                      ? "bg-amber-50 dark:bg-amber-500/10"
                                      : "bg-rose-50 dark:bg-rose-500/10"
                                }`}
                              >
                                <p className="text-[9px] uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                                  Difference
                                </p>
                                <p
                                  className={`text-[11px] font-bold ${
                                    todayReportCashDenom.cashDiff === 0
                                      ? "text-gray-900 dark:text-white"
                                      : todayReportCashDenom.cashDiff > 0
                                        ? "text-amber-700 dark:text-amber-400"
                                        : "text-rose-700 dark:text-rose-400"
                                  }`}
                                >
                                  {todayReportCashDenom.cashDiff > 0 ? "+" : ""}
                                  {sym}{" "}
                                  {Math.round(
                                    todayReportCashDenom.cashDiff,
                                  ).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Order type + website */}
                      <div>
                        <h3 className="text-xs font-bold text-gray-900 dark:text-white mb-1.5">
                          Order type breakdown
                        </h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          <div className="rounded-lg border border-orange-200/80 dark:border-orange-500/25 bg-orange-50/60 dark:bg-orange-500/10 px-2 py-2 flex flex-col justify-between gap-1">
                            <p className="text-[9px] font-semibold text-orange-800 dark:text-orange-400 flex items-center gap-1">
                              <UtensilsCrossed className="w-3 h-3 opacity-80 shrink-0" />
                              Dine in
                            </p>
                            <p className="text-lg font-black text-gray-900 dark:text-white tabular-nums leading-tight">
                              {sym}{" "}
                              {Math.round(
                                todayReportBreakdown.orderTypes.DINE_IN.amt,
                              ).toLocaleString()}
                            </p>
                            <p className="text-[9px] text-gray-500 dark:text-neutral-400">
                              {todayReportBreakdown.orderTypes.DINE_IN.n} paid ·{" "}
                              {todayReportBreakdown.orderTypes.DINE_IN.unpaidN}{" "}
                              unpaid
                            </p>
                          </div>
                          <div className="rounded-lg border border-emerald-200/80 dark:border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-500/10 px-2 py-2 flex flex-col justify-between gap-1">
                            <p className="text-[9px] font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-1">
                              <ShoppingBag className="w-3 h-3 opacity-80 shrink-0" />
                              Takeaway
                            </p>
                            <p className="text-lg font-black text-gray-900 dark:text-white tabular-nums leading-tight">
                              {sym}{" "}
                              {Math.round(
                                todayReportBreakdown.orderTypes.TAKEAWAY.amt,
                              ).toLocaleString()}
                            </p>
                            <p className="text-[9px] text-gray-500 dark:text-neutral-400">
                              {todayReportBreakdown.orderTypes.TAKEAWAY.n} paid ·{" "}
                              {
                                todayReportBreakdown.orderTypes.TAKEAWAY.unpaidN
                              }{" "}
                              unpaid
                            </p>
                          </div>
                          <div className="rounded-lg border border-sky-200/80 dark:border-sky-500/25 bg-sky-50/60 dark:bg-sky-500/10 px-2 py-2 flex flex-col gap-1">
                            <p className="text-[9px] font-semibold text-sky-800 dark:text-sky-400 flex items-center gap-1">
                              <Truck className="w-3 h-3 opacity-80 shrink-0" />
                              Delivery
                            </p>
                            <p className="text-lg font-black text-gray-900 dark:text-white tabular-nums leading-tight">
                              {sym}{" "}
                              {Math.round(
                                todayReportBreakdown.orderTypes.DELIVERY.amt,
                              ).toLocaleString()}
                            </p>
                            {(todayReportBreakdown.orderTypes.DELIVERY.items >
                              0 ||
                              todayReportBreakdown.orderTypes.DELIVERY.fees >
                                0) && (
                              <p className="text-[8px] text-gray-600 dark:text-neutral-400 leading-snug">
                                {sym}{" "}
                                {Math.round(
                                  todayReportBreakdown.orderTypes.DELIVERY.items,
                                ).toLocaleString()}{" "}
                                (items) + {sym}{" "}
                                {Math.round(
                                  todayReportBreakdown.orderTypes.DELIVERY.fees,
                                ).toLocaleString()}{" "}
                                (fees)
                              </p>
                            )}
                            <p className="mt-auto pt-1 text-[9px] text-gray-500 dark:text-neutral-400">
                              {todayReportBreakdown.orderTypes.DELIVERY.n} paid ·{" "}
                              {
                                todayReportBreakdown.orderTypes.DELIVERY
                                  .unpaidN
                              }{" "}
                              unpaid
                            </p>
                          </div>
                          <div className="rounded-lg border border-rose-200/80 dark:border-rose-500/25 bg-rose-50/60 dark:bg-rose-500/10 px-2 py-2 flex flex-col justify-between gap-1">
                            <p className="text-[9px] font-semibold text-rose-800 dark:text-rose-400 flex items-center gap-1">
                              <Globe className="w-3 h-3 opacity-80 shrink-0" />
                              Website
                            </p>
                            <p className="text-lg font-black text-gray-900 dark:text-white tabular-nums leading-tight">
                              {sym}{" "}
                              {Math.round(
                                todayReportBreakdown.sources.WEBSITE.amt,
                              ).toLocaleString()}
                            </p>
                            <p className="text-[9px] text-gray-500 dark:text-neutral-400">
                              {todayReportBreakdown.sources.WEBSITE.n} paid ·{" "}
                              {todayReportBreakdown.sources.WEBSITE.unpaidN}{" "}
                              unpaid
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Channel strip (POS / Website / Foodpanda / other) */}
                        <div className="rounded-lg border border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 px-3 py-2">
                          <p className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">
                            Sales by channel
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-1 text-[10px]">
                            <div>
                              <span className="text-gray-500 dark:text-neutral-400">
                                POS counter
                              </span>
                              <p className="font-bold text-gray-900 dark:text-white tabular-nums text-[11px]">
                                {sym}{" "}
                                {Math.round(
                                  todayReportBreakdown.sources.POS.amt,
                                ).toLocaleString()}
                              </p>
                              <p className="text-[9px] text-gray-400">
                                {todayReportBreakdown.sources.POS.n} paid ·{" "}
                                {todayReportBreakdown.sources.POS.unpaidN}{" "}
                                unpaid
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-neutral-400">
                                Website
                              </span>
                              <p className="font-bold text-gray-900 dark:text-white tabular-nums text-[11px]">
                                {sym}{" "}
                                {Math.round(
                                  todayReportBreakdown.sources.WEBSITE.amt,
                                ).toLocaleString()}
                              </p>
                              <p className="text-[9px] text-gray-400">
                                {todayReportBreakdown.sources.WEBSITE.n} paid ·{" "}
                                {todayReportBreakdown.sources.WEBSITE.unpaidN}{" "}
                                unpaid
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-neutral-400">
                                Foodpanda
                              </span>
                              <p className="font-bold text-gray-900 dark:text-white tabular-nums text-[11px]">
                                {sym}{" "}
                                {Math.round(
                                  todayReportBreakdown.sources.FOODPANDA.amt,
                                ).toLocaleString()}
                              </p>
                              <p className="text-[9px] text-gray-400">
                                {todayReportBreakdown.sources.FOODPANDA.n} paid ·{" "}
                                {
                                  todayReportBreakdown.sources.FOODPANDA.unpaidN
                                }{" "}
                                unpaid
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-neutral-400">
                                Other
                              </span>
                              <p className="font-bold text-gray-900 dark:text-white tabular-nums text-[11px]">
                                {sym}{" "}
                                {Math.round(
                                  todayReportBreakdown.sources.OTHER.amt,
                                ).toLocaleString()}
                              </p>
                              <p className="text-[9px] text-gray-400">
                                {todayReportBreakdown.sources.OTHER.n} paid ·{" "}
                                {todayReportBreakdown.sources.OTHER.unpaidN}{" "}
                                unpaid
                              </p>
                            </div>
                          </div>
                        </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 shadow-sm">
                          <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
                            Top items today
                          </p>
                          <div className="space-y-1.5 text-xs">
                            {todayReportBreakdown.topItems.length === 0 ? (
                              <p className="text-gray-400 text-[11px]">
                                No item data
                              </p>
                            ) : (
                              todayReportBreakdown.topItems.map((it) => (
                                <div
                                  key={it.name}
                                  className="flex justify-between gap-2 py-1 border-b border-gray-50 dark:border-neutral-800/80 last:border-0"
                                >
                                  <span className="text-gray-800 dark:text-neutral-200 truncate text-[12px]">
                                    {it.name}
                                  </span>
                                  <span className="text-[10px] text-gray-500 dark:text-neutral-400 shrink-0 tabular-nums">
                                    {Math.round(it.qty)} sold · {sym}{" "}
                                    {Math.round(it.rev).toLocaleString()}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 shadow-sm">
                          <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
                            Staff (order takers)
                          </p>
                          <div className="space-y-1.5 text-xs">
                            {todayReportBreakdown.staffList.length === 0 ? (
                              <p className="text-gray-400 text-[11px]">
                                No staff-attributed orders in closed sales
                              </p>
                            ) : (
                              todayReportBreakdown.staffList.map((st) => (
                                <div
                                  key={st.name}
                                  className="flex justify-between gap-2 py-1 border-b border-gray-50 dark:border-neutral-800/80 last:border-0"
                                >
                                  <span className="font-medium text-gray-800 dark:text-neutral-200 text-[12px]">
                                    {st.name}
                                  </span>
                                  <span className="text-[10px] tabular-nums text-gray-600 dark:text-neutral-400">
                                    {st.n} orders · {sym}{" "}
                                    {Math.round(st.rev).toLocaleString()}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                        </>
                      ) : null}
                    </>
                  )}
                </>
              )}
            </div>

            <div className="px-4 py-2 border-t border-gray-200 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              {showFullSessionReport ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowTodayReportModal(false);
                    loadSessionHistory();
                    setShowLegacySessionsModal(true);
                  }}
                  className="text-xs font-semibold text-primary hover:underline text-left"
                >
                  View session history →
                </button>
              ) : (
                <span className="text-[10px] text-gray-400 dark:text-neutral-500">
                  Detailed breakdown is available to restaurant owners and managers.
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowTodayReportModal(false)}
                className="h-8 px-3 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Past sessions (full history) ────────────────────────── */}
      {showLegacySessionsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLegacySessionsModal(false);
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
                onClick={() => setShowLegacySessionsModal(false)}
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
                          {sym} {(s.totalSales || 0).toLocaleString()}
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
                        {sym} {(currentSession.totalSales || 0).toLocaleString()}
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
      </div>

      {/* ── Start Session Gate ───────────────────────────────────────────────
          z-20 keeps the overlay below the sidebar (z-40) and header (z-30),
          so both remain visible and clickable while blocking the content area.
      ─────────────────────────────────────────────────────────────────────── */}
      {sessionGateChecked && noActiveSession && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center text-center gap-5 border border-gray-200 dark:border-neutral-700">
            <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center">
              <Coffee className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Business Day Not Started
              </h2>
              <p className="text-sm text-gray-500 dark:text-neutral-400 leading-relaxed">
                {isAdmin || isCashier
                  ? "Open the business day to start accepting orders. No orders can be placed until the day is started."
                  : "The business day hasn't been opened yet. Ask your manager or admin to start it."}
              </p>
            </div>
            {(isAdmin || isCashier) ? (
              <button
                type="button"
                onClick={handleStartSession}
                disabled={startingSession}
                className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {startingSession ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PlayCircle className="w-4 h-4" />
                )}
                {startingSession ? "Starting…" : "Start Business Day"}
              </button>
            ) : (
              <p className="text-xs text-gray-400 dark:text-neutral-500 font-medium">
                Contact your manager or admin to start the session.
              </p>
            )}
          </div>
        </div>
      )}

      </PermissionGate>
    </AdminLayout>
  );
}

// ─── RiderPickerDropdown — chevron rider list (assign / change) ─────────────

function RiderPickerDropdown({
  order,
  riders,
  ridersLoading,
  isAssigning,
  onAssign,
  label = "Assign rider",
  fullWidth = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const currentId = order.assignedRiderId ? String(order.assignedRiderId) : "";

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const triggerLabel = isAssigning
    ? "Assigning…"
    : ridersLoading
      ? "Loading…"
      : label;

  return (
    <div
      className={`relative ${fullWidth ? "w-full" : "flex-shrink-0"}`}
      ref={ref}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isAssigning || ridersLoading}
        className={
          fullWidth
            ? "w-full min-h-[2rem] py-2 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 text-xs font-bold transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-60 flex items-center justify-between gap-2"
            : "h-full min-h-[2rem] px-2.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-60"
        }
        title={
          order.assignedRiderName
            ? `Change rider (${order.assignedRiderName})`
            : "Assign rider"
        }
        aria-label={fullWidth ? triggerLabel : "Change rider"}
        aria-expanded={open}
      >
        {fullWidth ? (
          <>
            <span className="flex items-center gap-2 min-w-0">
              {isAssigning ? (
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />
              ) : (
                <Bike className="w-3.5 h-3.5 text-gray-500 dark:text-neutral-400 flex-shrink-0" />
              )}
              <span className="truncate">{triggerLabel}</span>
            </span>
            <ChevronDown
              className={`w-4 h-4 flex-shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </>
        ) : isAssigning ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Bike className="w-4 h-4" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-30 min-w-[11rem] max-h-48 overflow-auto rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg py-1">
          {ridersLoading ? (
            <p className="px-3 py-2 text-xs text-gray-500">Loading…</p>
          ) : riders.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500">No riders</p>
          ) : (
            riders.map((r) => {
              const selected = String(r.id) === currentId;
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={isAssigning || selected}
                  onClick={() => {
                    setOpen(false);
                    onAssign(order, r.id);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-60 ${
                    selected
                      ? "font-bold text-primary bg-primary/5"
                      : "text-gray-800 dark:text-neutral-200"
                  }`}
                >
                  {r.name}
                  {r.phone ? (
                    <span className="text-gray-400 dark:text-neutral-500 ml-1">
                      · {r.phone}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── OrderCard component ────────────────────────────────────────────────────

function OrderCard({
  order,
  now,
  theme,
  isOrderTaker,
  isCashier,
  isAdmin,
  updatingId,
  onUpdateStatus,
  onOpenCancel,
  onOpenPayment,
  riders,
  ridersLoading,
  assigningOrderId,
  onAssignRider,
  onOpenCollect,
  onPrint,
  onEdit,
}) {
  const { hasPermission } = usePermissions();
  const [expanded, setExpanded] = useState(false);
  const sym = getCurrencySymbol();
  const orderId = order.id || order._id;
  const isUpdating = updatingId === orderId;
  const orderType = order.type || order.orderType || "";
  const typeLabel = getOrderTypeLabel(order);
  const tableLabel = order.tableName || order.tableNumber;
  const normalizedTableLabel = String(tableLabel || "")
    .trim()
    .toLowerCase();
  const showDineInTableLabel =
    typeLabel === "Dine In" &&
    tableLabel &&
    normalizedTableLabel !== "walk-in" &&
    normalizedTableLabel !== "walk in";
  const TypeIcon = ORDER_TYPE_ICON[typeLabel] || ShoppingBag;
  const status = orderStatusForTab(order.status);
  const cancelReasonText = (order.cancelReason || order.cancelledReason || "").trim();
  const waitMin = getWaitingMinutes(order.createdAt, now);
  const urgency = getUrgency(waitMin);
  const isActive = !["DELIVERED", "COMPLETED", "CANCELLED"].includes(status);
  const paymentStatus = getPaymentStatus(order);
  const canCancel =
    // Always allow cancelling from active states.
    status !== "CANCELLED" &&
    (
      // Keep existing rule: hide cancel for delivered/completed/out_for_delivery.
      !["DELIVERED", "COMPLETED", "OUT_FOR_DELIVERY"].includes(status) ||
      // Admin override: allow cancelling unpaid delivered/completed orders
      // (these are shown in the "Awaiting Payment" column).
      (isAdmin && paymentStatus === "unpaid" && ["DELIVERED", "COMPLETED"].includes(status))
    );

  const nextStatuses = getNextStatuses(order.status, orderType);
  const primaryNext = nextStatuses[0];
  const actionLabel = getActionLabel(primaryNext, order);
  const canAdvanceStatus =
    primaryNext &&
    actionLabel &&
    !(isCashier && primaryNext === "DELIVERED" && isDeliveryOrder(order));

  const showAssignRider =
    isDeliveryOrder(order) && status === "READY" && !isOrderTaker && !order.assignedRiderName;
  const showChangeRider =
    isDeliveryOrder(order) && status === "READY" && !isOrderTaker && !!order.assignedRiderName;
  const showOutForDelivery =
    isDeliveryOrder(order) && status === "READY" && !isOrderTaker && !!order.assignedRiderName;
  const showOutForDeliveryMarkDelivered =
    isDeliveryOrder(order) &&
    status === "OUT_FOR_DELIVERY" &&
    canAdvanceStatus;
  const showRiderReassignOutForDelivery =
    isDeliveryOrder(order) && status === "OUT_FOR_DELIVERY" && !isOrderTaker;
  const isAwaitingPayment =
    (status === "DELIVERED" || status === "COMPLETED") &&
    paymentStatus === "unpaid";
  /** Cash/COD delivered: show even when customer payment already recorded (rider still needs to hand in). */
  const showCollectFromRider = isDeliveryPaymentPending(order) && !isOrderTaker;
  const riderHandInPending =
    showCollectFromRider && paymentStatus === "paid";
  const showTakePayment =
    isAwaitingPayment && !isOrderTaker && !isDeliveryOrder(order);
  const showEarlyPayment =
    !["DELIVERED", "COMPLETED", "CANCELLED"].includes(status) &&
    paymentStatus === "unpaid" &&
    !isOrderTaker &&
    !isDeliveryOrder(order) &&
    order.source !== "FOODPANDA";

  const displayItems = mergeReceiptItems(order.items || []);
  const visibleItems = displayItems.slice(0, 3);
  const hiddenCount = displayItems.length - 3;

  const statusAdvancePerm = primaryNext
    ? getStatusAdvancePermission(primaryNext)
    : null;
  const canAdvanceWithPermission =
    canAdvanceStatus && statusAdvancePerm && hasPermission(statusAdvancePerm);
  const showAssignRiderPerm =
    showAssignRider && hasPermission("orders.assign_rider");
  const showChangeRiderPerm =
    showChangeRider && hasPermission("orders.assign_rider");
  const showOutForDeliveryPerm =
    showOutForDelivery && hasPermission("orders.edit");
  const showOutForDeliveryMarkDeliveredPerm =
    showOutForDeliveryMarkDelivered &&
    statusAdvancePerm &&
    hasPermission(statusAdvancePerm);
  const showRiderReassignPerm =
    showRiderReassignOutForDelivery && hasPermission("orders.reassign_rider");
  const showCollectFromRiderPerm =
    showCollectFromRider && hasPermission("orders.collect_payment");
  const showTakePaymentPerm =
    showTakePayment && hasPermission("orders.collect_payment");
  const showEarlyPaymentPerm =
    showEarlyPayment && hasPermission("orders.collect_payment");
  const canCancelPerm = canCancel && hasPermission("orders.cancel");

  const hasCTA =
    !isOrderTaker &&
    (showCollectFromRiderPerm ||
      showTakePaymentPerm ||
      showOutForDeliveryPerm ||
      showAssignRiderPerm ||
      showOutForDeliveryMarkDeliveredPerm ||
      canAdvanceWithPermission);

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
            {order.source === "WEBSITE" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 font-bold flex-shrink-0">
                Website
              </span>
            )}
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
          {showDineInTableLabel && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/20">
              <MapPin className="w-3 h-3" />
              {tableLabel}
            </span>
          )}
          {typeLabel !== "Dine In" && tableLabel && (
            <span className="text-[10px] font-medium text-gray-500 dark:text-neutral-500 bg-gray-50 dark:bg-neutral-900 px-1.5 py-0.5 rounded">
              {tableLabel}
            </span>
          )}
          {(order.source === "WEBSITE" || isDeliveryOrder(order)) &&
          (order.customerName || order.customerPhone || order.phone) ? (
            <div className="inline-flex flex-col gap-0.5 text-[10px] font-medium text-gray-600 dark:text-neutral-400">
              {order.customerName && (
                <span className="inline-flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {order.customerName}
                </span>
              )}
              {(order.customerPhone || order.phone) && (
                <span className="inline-flex items-center gap-1 text-gray-500 dark:text-neutral-500">
                  <Phone className="w-3 h-3" />
                  {order.customerPhone || order.phone}
                </span>
              )}
            </div>
          ) : order.customerName ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-600 dark:text-neutral-400">
              <User className="w-3 h-3" />
              Customer: {order.customerName}
            </span>
          ) : null}
          {order.source === "FOODPANDA" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-100 dark:bg-pink-500/15 text-pink-700 dark:text-pink-400 font-bold">
              Foodpanda
            </span>
          )}
          {order.source === "WHATSAPP" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 font-bold">
              WhatsApp
            </span>
          )}
          {isDeliveryOrder(order) && order.assignedRiderName && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#25343F] bg-[#25343F]/10 dark:bg-[#25343F]/20 px-1.5 py-0.5 rounded">
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

      {/* Timeline for closed / cancelled orders */}
      {!isActive && (() => {
        const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const STATUS_LABELS = {
          NEW_ORDER: "Created",
          PROCESSING: "Preparing",
          READY: "Ready",
          OUT_FOR_DELIVERY: "Out for Delivery",
          DELIVERED: "Closed",
          CANCELLED: "Cancelled",
        };
        const STATUS_COLORS = {
          NEW_ORDER: "text-gray-400 dark:text-neutral-500",
          PROCESSING: "text-blue-500 dark:text-blue-400",
          READY: "text-emerald-500 dark:text-emerald-400",
          OUT_FOR_DELIVERY: "text-[#25343F] dark:text-[#25343F]",
          DELIVERED: "text-emerald-600 dark:text-emerald-400",
          CANCELLED: "text-red-400 dark:text-red-500",
        };
        const allHistory = order.statusHistory?.length > 0
          ? order.statusHistory
          : [
              { status: "NEW_ORDER", at: order.createdAt },
              ...(order.cancelledAt ? [{ status: "CANCELLED", at: order.cancelledAt }]
                : order.updatedAt ? [{ status: "DELIVERED", at: order.updatedAt }] : []),
            ].filter(Boolean);

        const createdEntry = allHistory.find((h) => h.status === "NEW_ORDER") || { status: "NEW_ORDER", at: order.createdAt };
        const closedEntry = allHistory.find((h) => h.status === "CANCELLED") || allHistory.find((h) => h.status === "DELIVERED") || null;
        const history = [createdEntry, closedEntry].filter(Boolean);

        return (
          <div className="mx-3 mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px]">
            {history.map((h, i) => (
              <span key={i} className="flex items-center gap-0.5">
                {i > 0 && <span className="text-gray-300 dark:text-neutral-700 mr-0.5">→</span>}
                <span className={`font-semibold ${STATUS_COLORS[h.status] || "text-gray-400"}`}>
                  {STATUS_LABELS[h.status] || h.status}
                </span>
                <span className="text-gray-400 dark:text-neutral-600">{fmtTime(h.at)}</span>
              </span>
            ))}
          </div>
        );
      })()}

      {/* Cancel reason (only for cancelled orders) */}
      {!isActive && status === "CANCELLED" && cancelReasonText && (
        <div className="mx-3 mb-2 text-[10px] text-red-700 dark:text-red-400">
          <span className="font-bold">Reason</span>: {cancelReasonText}
        </div>
      )}

      {/* Items list */}
      {displayItems.length > 0 && !isActive && (
        <div className="mx-3 mb-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-neutral-900/80 text-[11px] font-bold text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <span>{displayItems.length} items</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          {expanded && (
            <div className="px-2.5 py-2 mt-1 rounded-lg bg-gray-50 dark:bg-neutral-900/80 space-y-1">
              {displayItems.map((it, idx) => (
                <div key={idx} className="text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-800 dark:text-neutral-200 truncate pr-2 font-medium">
                      {it.name}
                      {it.variantLabel && (
                        <span className="text-xs font-normal text-orange-500 dark:text-orange-400 ml-1">({it.variantLabel})</span>
                      )}
                    </span>
                    <span className="text-gray-500 dark:text-neutral-500 font-bold flex-shrink-0 tabular-nums">×{it.qty ?? it.quantity ?? 1}</span>
                  </div>
                  {(it.modifierSelections || []).map((sel, si) => (
                    <div key={si} className="text-[10px] text-gray-400 dark:text-neutral-500 ml-2 leading-tight">
                      {sel.groupName}: {(sel.options || []).map((o) => o.name).join(", ")}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {displayItems.length > 0 && isActive && (
        <div className="mx-3 mb-2 px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900/80">
          <div className="space-y-1">
            {visibleItems.map((it, idx) => (
              <div key={idx} className="text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-gray-800 dark:text-neutral-200 truncate pr-2 font-medium">
                    {it.name}
                    {it.variantLabel && (
                      <span className="text-xs font-normal text-orange-500 dark:text-orange-400 ml-1">({it.variantLabel})</span>
                    )}
                  </span>
                  <span className="text-gray-500 dark:text-neutral-500 font-bold flex-shrink-0 tabular-nums">
                    ×{it.qty ?? it.quantity ?? 1}
                  </span>
                </div>
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
              {displayItems.slice(3).map((it, idx) => (
                <div key={idx} className="text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-800 dark:text-neutral-200 truncate pr-2 font-medium">
                      {it.name}
                      {it.variantLabel && (
                        <span className="text-xs font-normal text-orange-500 dark:text-orange-400 ml-1">({it.variantLabel})</span>
                      )}
                    </span>
                    <span className="text-gray-500 dark:text-neutral-500 font-bold flex-shrink-0 tabular-nums">
                      ×{it.qty ?? it.quantity ?? 1}
                    </span>
                  </div>
                  {(it.modifierSelections || []).map((sel, si) => (
                    <div key={si} className="text-[10px] text-gray-400 dark:text-neutral-500 ml-2 leading-tight">
                      {sel.groupName}: {(sel.options || []).map((o) => o.name).join(", ")}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payment status + actions, then total */}
      <div className="px-3 pb-2 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          {status !== "CANCELLED" ? (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                riderHandInPending
                  ? "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300"
                  : paymentStatus === "paid"
                    ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400"
              }`}
            >
              {riderHandInPending ? (
                <Wallet className="w-3 h-3" />
              ) : paymentStatus === "paid" ? (
                <CircleCheckBig className="w-3 h-3" />
              ) : (
                <Clock className="w-3 h-3" />
              )}
              {riderHandInPending
                ? "Hand-in pending"
                : paymentStatus === "paid"
                  ? "Paid"
                  : "Unpaid"}
            </span>
          ) : (
            <span />
          )}
          {!isOrderTaker && (
            <div className="flex items-center gap-0.5 ml-auto">
              {status !== "CANCELLED" && hasPermission("orders.print") && (
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
              {status !== "CANCELLED" &&
                hasPermission("orders.edit") &&
                (isAdmin ||
                  (paymentStatus === "unpaid" &&
                    !["DELIVERED", "COMPLETED"].includes(status))) && (
                  <button
                    type="button"
                    onClick={() => onEdit(order)}
                    className="p-1 rounded text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              {canCancelPerm && (
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
              {showEarlyPaymentPerm && (
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
        <span className="text-lg font-black text-gray-900 dark:text-white tabular-nums">
          {sym} {Math.round(getOrderTotal(order)).toLocaleString()}
        </span>
      </div>

      {/* Primary CTA — full width */}
      {hasCTA && (
        <div className="px-2.5 pb-2.5">
          {showCollectFromRiderPerm ? (
            <button
              type="button"
              onClick={() => onOpenCollect(order)}
              className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <Banknote className="w-3.5 h-3.5" /> Collect from Rider
            </button>
          ) : showTakePaymentPerm ? (
            <button
              type="button"
              onClick={() => onOpenPayment(order)}
              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <Banknote className="w-3.5 h-3.5" /> Collect Payment
            </button>
          ) : showAssignRiderPerm ? (
            <RiderPickerDropdown
              order={order}
              riders={riders}
              ridersLoading={ridersLoading}
              isAssigning={assigningOrderId === orderId}
              onAssign={onAssignRider}
              label="— Assign rider —"
              fullWidth
            />
          ) : showOutForDeliveryPerm ? (
            <div className="space-y-2">
              {showChangeRiderPerm && (
                <RiderPickerDropdown
                  order={order}
                  riders={riders}
                  ridersLoading={ridersLoading}
                  isAssigning={assigningOrderId === orderId}
                  onAssign={onAssignRider}
                  label={
                    order.assignedRiderName
                      ? `${order.assignedRiderName} · Change`
                      : "— Assign rider —"
                  }
                  fullWidth
                />
              )}
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(orderId, "OUT_FOR_DELIVERY")}
                className="w-full py-2 rounded-lg bg-[#25343F] hover:bg-[#25343F]/90 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Truck className="w-3.5 h-3.5" />
                Send Delivery
              </button>
            </div>
          ) : showOutForDeliveryMarkDeliveredPerm ? (
            <div className="flex gap-1.5 items-stretch">
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(orderId, primaryNext)}
                className={`flex-1 min-w-0 py-2 rounded-lg ${theme.ctaBg} text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5`}
              >
                {isUpdating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  actionLabel
                )}
              </button>
              {showRiderReassignPerm && (
                <RiderPickerDropdown
                  order={order}
                  riders={riders}
                  ridersLoading={ridersLoading}
                  isAssigning={assigningOrderId === orderId}
                  onAssign={onAssignRider}
                />
              )}
            </div>
          ) : canAdvanceWithPermission ? (
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
