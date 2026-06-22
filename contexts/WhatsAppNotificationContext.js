import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const WhatsAppNotificationContext = createContext(null);

export function WhatsAppNotificationProvider({ children }) {
  const [permission, setPermission] = useState("default");
  const conversationClickRef = useRef(null);

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

  const showNotification = useCallback(({ title, body, conversationId, type }) => {
    if (!document.hidden) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

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
      conversationClickRef.current?.(conversationId);
    };
  }, []);

  return (
    <WhatsAppNotificationContext.Provider
      value={{
        permission,
        requestPermission,
        showNotification,
        setConversationClickHandler,
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
    };
  }
  return ctx;
}
