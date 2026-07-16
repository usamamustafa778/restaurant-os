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
import { playOrderReadySound } from "../lib/playNotificationSound";
import { getStoredAuth } from "../lib/apiClient";

const OrderNotificationContext = createContext(null);

const MAX_ALERTS = 40;
const MAX_POPUPS = 3;
const POPUP_DURATION_MS = 5500;

/** Roles that should hear/see order-ready alerts (front-of-house). */
const ORDER_READY_SKIP_ROLES = new Set([
  "kitchen_staff",
  "delivery_rider",
  "super_admin",
]);

function shouldNotifyCurrentUser() {
  const role = getStoredAuth()?.user?.role;
  if (!role) return false;
  return !ORDER_READY_SKIP_ROLES.has(role);
}

function formatTokenLabel(data) {
  if (data?.tokenNumber != null && data.tokenNumber !== "") {
    return `#${String(data.tokenNumber).padStart(4, "0")}`;
  }
  if (data?.orderNumber) return `#${data.orderNumber}`;
  return "Order";
}

function orderTypeLabel(orderType) {
  const t = String(orderType || "").toUpperCase();
  if (t === "DELIVERY") return "Delivery";
  if (t === "TAKEAWAY" || t === "PICKUP") return "Pickup";
  if (t === "DINE_IN" || t === "DINEIN") return "Dine-in";
  return t ? t.replace(/_/g, " ") : "Order";
}

export function OrderNotificationProvider({ children }) {
  const { socket } = useSocket() || {};
  const [alerts, setAlerts] = useState([]);
  const [popups, setPopups] = useState([]);
  const notifiedReadyRef = useRef(new Set());
  const popupTimersRef = useRef(new Map());
  const orderClickRef = useRef(null);

  const setOrderClickHandler = useCallback((fn) => {
    orderClickRef.current = fn;
  }, []);

  const upsertAlert = useCallback((alert) => {
    setAlerts((prev) => {
      const oid = String(alert.orderId);
      const without = prev.filter((a) => String(a.orderId) !== oid);
      return [{ ...alert, read: false }, ...without].slice(0, MAX_ALERTS);
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

  const showBrowserNotification = useCallback(({ title, body, orderId }) => {
    if (typeof document !== "undefined" && !document.hidden) return;
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    ) {
      return;
    }
    const notif = new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: `order-ready-${orderId}`,
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
      orderClickRef.current?.(orderId);
    };
  }, []);

  const openOrder = useCallback(
    (orderId) => {
      markAlertRead(orderId);
      orderClickRef.current?.(orderId);
    },
    [markAlertRead],
  );

  useEffect(() => {
    if (!socket) return;

    const onOrderUpdated = (data) => {
      if (!data || !shouldNotifyCurrentUser()) return;
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
      playOrderReadySound();
      showBrowserNotification({
        title: `Order ${token} ready`,
        body: alert.body,
        orderId,
      });
    };

    socket.on("order:updated", onOrderUpdated);
    return () => {
      socket.off("order:updated", onOrderUpdated);
    };
  }, [socket, upsertAlert, pushPopup, showBrowserNotification]);

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
    };
  }
  return ctx;
}
