import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSocket } from "./SocketContext";
import {
  playOrderReadySound,
  playKitchenNewOrderSound,
  unlockNotificationAudio,
} from "../lib/playNotificationSound";
import { getStoredAuth, getActingAsSlug } from "../lib/apiClient";

const OrderNotificationContext = createContext(null);

const MAX_ALERTS = 40;
const MAX_POPUPS = 3;
const POPUP_DURATION_MS = 8000;

/** Roles that should not hear FOH order-ready alerts. */
const ORDER_READY_SKIP_ROLES = new Set(["kitchen_staff", "delivery_rider"]);

/** Staff who should only hear ready alerts for orders they created. */
const ORDER_READY_OWN_ONLY_ROLES = new Set([
  "order_taker",
  "cashier",
  "default_cashier",
]);

/** Managers/admins hear all ready alerts in their current branch scope. */
const ORDER_READY_ALL_ROLES = new Set([
  "admin",
  "restaurant_admin",
  "manager",
  "default_manager",
  "product_manager",
  "super_admin",
]);

function getAuthRole() {
  return getStoredAuth()?.user?.role || null;
}

function getAuthUserId() {
  const u = getStoredAuth()?.user;
  return u?.id != null ? String(u.id) : u?._id != null ? String(u._id) : "";
}

function shouldNotifyOrderReady(data) {
  const auth = getStoredAuth();
  const role = auth?.user?.role;
  if (!role) return false;

  if (ORDER_READY_SKIP_ROLES.has(role)) return false;

  if (role === "super_admin") {
    const slug =
      getActingAsSlug() || auth?.user?.tenantSlug || auth?.tenantSlug || null;
    if (!slug) return false;
  }

  const myId = getAuthUserId();
  const creatorId =
    data?.createdById != null && data.createdById !== ""
      ? String(data.createdById)
      : "";

  // Order-takers / cashiers: only their own tickets (or unassigned website
  // orders for cashiers so the counter still hears pickups).
  if (ORDER_READY_OWN_ONLY_ROLES.has(role)) {
    if (!creatorId) {
      return role === "cashier" || role === "default_cashier";
    }
    return Boolean(myId) && creatorId === myId;
  }

  // Known managers/admins: all ready in joined rooms (branch-scoped by socket).
  if (ORDER_READY_ALL_ROLES.has(role)) return true;

  // Custom / unknown roles: only own orders when creator is known.
  if (creatorId) return Boolean(myId) && creatorId === myId;
  return false;
}

function isDeliveryRider() {
  return getAuthRole() === "delivery_rider";
}

function formatTokenLabel(data) {
  if (data?.tokenNumber != null && data.tokenNumber !== "") {
    return `#${String(data.tokenNumber).padStart(4, "0")}`;
  }
  const raw = String(data?.orderNumber || "").trim();
  if (raw) {
    const tail = raw.split(/[-_/]/).filter(Boolean).pop();
    if (tail && /^\d+$/.test(tail)) {
      return `#${tail.padStart(4, "0")}`;
    }
    if (raw.length <= 10) return `#${raw.replace(/^#/, "")}`;
  }
  return "Order";
}

function orderTypeLabel(orderType) {
  const t = String(orderType || "").toUpperCase();
  if (t === "DELIVERY") return "Delivery";
  if (t === "TAKEAWAY" || t === "PICKUP") return "Pickup";
  if (t === "DINE_IN" || t === "DINEIN") return "Dine-in";
  return t ? t.replace(/_/g, " ") : "Order";
}

function resolveOrderId(data) {
  if (data?._id) return String(data._id);
  if (data?.id && /^[0-9a-fA-F]{24}$/.test(String(data.id))) return String(data.id);
  if (data?.orderNumber) return String(data.orderNumber);
  if (data?.id) return String(data.id);
  return "";
}

function orderIdentityKeys(data) {
  const keys = new Set();
  const add = (v) => {
    const s = v != null ? String(v).trim() : "";
    if (s) keys.add(s);
  };
  add(data?._id);
  add(data?.id);
  add(data?.orderNumber);
  return keys;
}

export function OrderNotificationProvider({ children }) {
  const { socket } = useSocket() || {};
  const [alerts, setAlerts] = useState([]);
  const [popups, setPopups] = useState([]);
  const notifiedReadyRef = useRef(new Set());
  const notifiedAssignedRef = useRef(new Set());
  const popupTimersRef = useRef(new Map());
  const orderClickRef = useRef(null);

  const setOrderClickHandler = useCallback((fn) => {
    orderClickRef.current = fn;
  }, []);

  const upsertAlert = useCallback((alert) => {
    setAlerts((prev) => {
      const oid = String(alert.orderId);
      const without = prev.filter((a) => String(a.orderId) !== oid);
      return [{ ...alert, read: alert.read === true }, ...without].slice(
        0,
        MAX_ALERTS,
      );
    });
  }, []);

  const markAlertRead = useCallback((orderId) => {
    const oid = String(orderId);
    setAlerts((prev) =>
      prev.map((a) => (String(a.orderId) === oid ? { ...a, read: true } : a)),
    );
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const dismissPopup = useCallback((popupId) => {
    const timer = popupTimersRef.current.get(popupId);
    if (timer) {
      clearTimeout(timer);
      popupTimersRef.current.delete(popupId);
    }
    setPopups((prev) => prev.filter((p) => p.popupId !== popupId));
  }, []);

  const pushPopup = useCallback((alert) => {
    const popupId = alert.id;
    setPopups((prev) =>
      [{ ...alert, popupId }, ...prev.filter((p) => p.popupId !== popupId)].slice(
        0,
        MAX_POPUPS,
      ),
    );

    const existing = popupTimersRef.current.get(popupId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      popupTimersRef.current.delete(popupId);
      setPopups((prev) => prev.filter((p) => p.popupId !== popupId));
    }, POPUP_DURATION_MS);

    popupTimersRef.current.set(popupId, timer);
  }, []);

  useEffect(() => {
    const timers = popupTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // Unlock audio for FOH ready alerts and rider assignment alerts.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldNotifyOrderReady() && !isDeliveryRider()) return;
    const unlock = () => unlockNotificationAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  const showBrowserNotification = useCallback(({ title, body, orderId, tagPrefix = "order-ready" }) => {
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    ) {
      return;
    }
    try {
      const notif = new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `${tagPrefix}-${orderId}`,
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
        orderClickRef.current?.(orderId);
      };
    } catch {
      /* ignore */
    }
  }, []);

  const openOrder = useCallback(
    (orderId) => {
      markAlertRead(orderId);
      orderClickRef.current?.(orderId);
    },
    [markAlertRead],
  );

  /**
   * Rider assignment alert — fills the notification bell + optional sound/popup.
   * Call from rider page when a new delivery is assigned (socket or poll).
   */
  const pushDeliveryAssignedAlert = useCallback(
    (data, opts = {}) => {
      const { playSound = true, showPopup = true, silent = false } = opts;
      const orderId = resolveOrderId(data);
      if (!orderId) return false;

      const keys = orderIdentityKeys(data);
      if (!silent) {
        for (const k of keys) {
          if (notifiedAssignedRef.current.has(k)) return false;
        }
        for (const k of keys) notifiedAssignedRef.current.add(k);
      }

      const token = formatTokenLabel(data);
      const status = String(data?.status || "").toUpperCase();
      const statusHint =
        status === "READY"
          ? "Ready — collect from kitchen"
          : status === "OUT_FOR_DELIVERY"
            ? "Out for delivery"
            : "Assigned to you";
      const timestamp = new Date().toISOString();
      const alert = {
        id: `assigned-${orderId}-${timestamp}`,
        orderId,
        type: "delivery_assigned",
        title: `${token} assigned to you`,
        body: `${orderTypeLabel(data?.orderType || "DELIVERY")} · ${statusHint}`,
        orderNumber: data?.orderNumber || null,
        tokenNumber: data?.tokenNumber || null,
        orderType: data?.orderType || "DELIVERY",
        tableName: "",
        timestamp,
        read: silent,
      };

      upsertAlert(alert);

      if (!silent) {
        if (showPopup) pushPopup(alert);
        if (playSound) {
          unlockNotificationAudio();
          playKitchenNewOrderSound({ soundType: "service_bell", volume: 100 });
        }
        showBrowserNotification({
          title: `Delivery ${token}`,
          body: alert.body,
          orderId,
          tagPrefix: "rider-assign",
        });
      }

      return true;
    },
    [upsertAlert, pushPopup, showBrowserNotification],
  );

  // FOH: order became READY
  useEffect(() => {
    if (!socket) return;

    const onOrderUpdated = (data) => {
      if (!data || !shouldNotifyOrderReady(data)) return;
      const orderId = String(data.id || data._id || "");
      if (!orderId) return;

      const status = String(data.status || "").toUpperCase();
      const previousStatus = data.previousStatus
        ? String(data.previousStatus).toUpperCase()
        : null;

      if (status !== "READY") {
        notifiedReadyRef.current.delete(orderId);
        return;
      }

      if (previousStatus === "READY") return;
      if (notifiedReadyRef.current.has(orderId)) return;
      notifiedReadyRef.current.add(orderId);

      const token = formatTokenLabel(data);
      const typeLabel = orderTypeLabel(data.orderType);
      const tablePart = data.tableName ? ` · ${data.tableName}` : "";
      const timestamp = new Date().toISOString();
      const alert = {
        id: `ready-${orderId}-${timestamp}`,
        orderId,
        type: "order_ready",
        title: `${token} is ready`,
        body: `${typeLabel}${tablePart} — ready to serve`,
        orderNumber: data.orderNumber || null,
        tokenNumber: data.tokenNumber || null,
        orderType: data.orderType || null,
        tableName: data.tableName || "",
        timestamp,
        read: false,
      };

      upsertAlert(alert);
      pushPopup(alert);
      unlockNotificationAudio();
      playOrderReadySound({ volume: 90 });
      showBrowserNotification({
        title: `Order ${token} ready`,
        body: alert.body,
        orderId,
      });
    };

    socket.on("order:updated", onOrderUpdated);
    socket.on("order:ready", onOrderUpdated);
    return () => {
      socket.off("order:updated", onOrderUpdated);
      socket.off("order:ready", onOrderUpdated);
    };
  }, [socket, upsertAlert, pushPopup, showBrowserNotification]);

  // Rider: direct assignment events (dedicated channel from assign-rider API)
  useEffect(() => {
    if (!socket) return;

    const onAssigned = (data) => {
      if (!data || !isDeliveryRider()) return;
      const myId = getAuthUserId();
      const assignedTo =
        data.assignedRiderId != null ? String(data.assignedRiderId) : "";
      if (!myId || !assignedTo || assignedTo !== myId) return;
      pushDeliveryAssignedAlert(data, { playSound: true, showPopup: true });
    };

    socket.on("order:assigned", onAssigned);
    return () => {
      socket.off("order:assigned", onAssigned);
    };
  }, [socket, pushDeliveryAssignedAlert]);

  const unreadCount = useMemo(
    () => alerts.filter((a) => !a.read).length,
    [alerts],
  );

  return (
    <OrderNotificationContext.Provider
      value={{
        alerts,
        unreadCount,
        popups,
        markAlertRead,
        clearAlerts,
        dismissPopup,
        openOrder,
        setOrderClickHandler,
        pushDeliveryAssignedAlert,
      }}
    >
      {children}
    </OrderNotificationContext.Provider>
  );
}

export function useOrderNotifications() {
  const ctx = useContext(OrderNotificationContext);
  if (!ctx) {
    return {
      alerts: [],
      unreadCount: 0,
      popups: [],
      markAlertRead: () => {},
      clearAlerts: () => {},
      dismissPopup: () => {},
      openOrder: () => {},
      setOrderClickHandler: () => {},
      pushDeliveryAssignedAlert: () => false,
    };
  }
  return ctx;
}
