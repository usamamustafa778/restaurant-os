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

const WhatsAppNotificationContext = createContext(null);

const MAX_ALERTS = 40;
const MAX_POPUPS = 3;
const POPUP_DURATION_MS = 4500;

function buildAlertId(conversationId, timestamp) {
  return `${conversationId}-${timestamp || Date.now()}`;
}

export function WhatsAppNotificationProvider({ children }) {
  const { socket } = useSocket() || {};
  const [permission, setPermission] = useState("default");
  const [alerts, setAlerts] = useState([]);
  const [popups, setPopups] = useState([]);
  const conversationClickRef = useRef(null);
  const activeConversationIdRef = useRef(null);
  const pendingOpenConversationIdRef = useRef(null);
  const popupTimersRef = useRef(new Map());

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const setConversationClickHandler = useCallback((fn) => {
    conversationClickRef.current = fn;
  }, []);

  const setActiveConversationId = useCallback((conversationId) => {
    activeConversationIdRef.current = conversationId
      ? String(conversationId)
      : null;
  }, []);

  const consumePendingOpenConversationId = useCallback(() => {
    const id = pendingOpenConversationIdRef.current;
    pendingOpenConversationIdRef.current = null;
    return id;
  }, []);

  const showBrowserNotification = useCallback(
    ({ title, body, conversationId, type }) => {
      if (!document.hidden) return;
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
        tag: String(conversationId),
        requireInteraction: type === "urgent",
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
        pendingOpenConversationIdRef.current = String(conversationId);
        conversationClickRef.current?.(conversationId);
      };
    },
    [],
  );

  const upsertAlert = useCallback((alert) => {
    setAlerts((prev) => {
      const cid = String(alert.conversationId);
      const withoutConv = prev.filter((a) => String(a.conversationId) !== cid);
      const next = [{ ...alert, read: false }, ...withoutConv];
      return next.slice(0, MAX_ALERTS);
    });
  }, []);

  const markAlertRead = useCallback((conversationId) => {
    const cid = String(conversationId);
    setAlerts((prev) =>
      prev.map((a) =>
        String(a.conversationId) === cid ? { ...a, read: true } : a,
      ),
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

  const pushPopup = useCallback(
    (alert) => {
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
    },
    [],
  );

  useEffect(() => {
    const timers = popupTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const openConversation = useCallback((conversationId) => {
    const cid = String(conversationId);
    pendingOpenConversationIdRef.current = cid;
    markAlertRead(cid);
    conversationClickRef.current?.(cid);
  }, [markAlertRead]);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (data) => {
      const {
        conversationId,
        role,
        content,
        timestamp,
        customerPhone,
        customerName,
      } = data;
      if (role !== "user") return;

      const cid = String(conversationId);
      const msgTimestamp = timestamp || new Date().toISOString();
      const isViewing = activeConversationIdRef.current === cid;

      upsertAlert({
        id: buildAlertId(cid, msgTimestamp),
        conversationId: cid,
        customerPhone: customerPhone || "",
        customerName: customerName || "",
        type: "message",
        title: customerName || customerPhone || "WhatsApp customer",
        body: content?.slice(0, 120) || "New message received",
        timestamp: msgTimestamp,
        read: isViewing,
      });

      if (!isViewing) {
        pushPopup({
          id: buildAlertId(cid, msgTimestamp),
          conversationId: cid,
          customerPhone: customerPhone || "",
          customerName: customerName || "",
          type: "message",
          title: customerName || customerPhone || "WhatsApp customer",
          body: content?.slice(0, 120) || "New message received",
          timestamp: msgTimestamp,
        });
        showBrowserNotification({
          title: "New WhatsApp Message",
          body: content?.slice(0, 80) || "New message received",
          conversationId: cid,
          type: "message",
        });
      }
    };

    const onNeedsHuman = (data) => {
      const { conversationId, customerPhone, lastMessage, customerName } =
        data;
      const cid = String(conversationId);
      const msgTimestamp = new Date().toISOString();
      const isViewing = activeConversationIdRef.current === cid;

      upsertAlert({
        id: buildAlertId(cid, msgTimestamp),
        conversationId: cid,
        customerPhone: customerPhone || "",
        customerName: customerName || "",
        type: "urgent",
        title: customerName || customerPhone || "WhatsApp customer",
        body: lastMessage?.slice(0, 120) || "Customer needs assistance",
        timestamp: msgTimestamp,
        read: isViewing,
      });

      if (!isViewing) {
        pushPopup({
          id: buildAlertId(cid, msgTimestamp),
          conversationId: cid,
          customerPhone: customerPhone || "",
          customerName: customerName || "",
          type: "urgent",
          title: customerName || customerPhone || "WhatsApp customer",
          body: lastMessage?.slice(0, 120) || "Customer needs assistance",
          timestamp: msgTimestamp,
        });
        showBrowserNotification({
          title: "Customer Needs Help",
          body: lastMessage?.slice(0, 80) || "Customer needs assistance",
          conversationId: cid,
          type: "urgent",
        });
      }
    };

    socket.on("whatsapp:message", onMessage);
    socket.on("whatsapp:needs_human", onNeedsHuman);

    return () => {
      socket.off("whatsapp:message", onMessage);
      socket.off("whatsapp:needs_human", onNeedsHuman);
    };
  }, [socket, showBrowserNotification, upsertAlert, pushPopup]);

  const unreadCount = useMemo(
    () => alerts.filter((a) => !a.read).length,
    [alerts],
  );

  return (
    <WhatsAppNotificationContext.Provider
      value={{
        permission,
        requestPermission,
        showNotification: showBrowserNotification,
        setConversationClickHandler,
        setActiveConversationId,
        consumePendingOpenConversationId,
        alerts,
        unreadCount,
        popups,
        markAlertRead,
        clearAlerts,
        dismissPopup,
        openConversation,
      }}
    >
      {children}
    </WhatsAppNotificationContext.Provider>
  );
}

export function useWhatsAppNotifications() {
  const ctx = useContext(WhatsAppNotificationContext);
  if (!ctx) {
    return {
      permission: "denied",
      requestPermission: async () => "denied",
      showNotification: () => {},
      setConversationClickHandler: () => {},
      setActiveConversationId: () => {},
      consumePendingOpenConversationId: () => null,
      alerts: [],
      unreadCount: 0,
      popups: [],
      markAlertRead: () => {},
      clearAlerts: () => {},
      dismissPopup: () => {},
      openConversation: () => {},
    };
  }
  return ctx;
}
