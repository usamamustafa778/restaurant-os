import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import {
  Bell,
  BellOff,
  BellRing,
  MessageCircle,
  AlertTriangle,
  ChefHat,
  X,
} from "lucide-react";
import { useWhatsAppNotifications } from "../../contexts/WhatsAppNotificationContext";
import { useOrderNotifications } from "../../contexts/OrderNotificationContext";
import { getStoredAuth } from "../../lib/apiClient";

const HEADER_TOOLBAR_BTN =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold leading-none shadow-sm transition-all";

const POPUP_WIDTH = 320; // w-80

function formatAlertTime(timestamp) {
  if (!timestamp) return "";
  try {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

function orderReadyHref(role) {
  if (role === "order_taker") return "/order-taker";
  if (role === "delivery_rider") return "/rider";
  if (role === "kitchen_staff") return "/kitchen";
  return "/pos";
}

function PopupToast({ popup, source, onOpen, onDismiss }) {
  const isUrgent = popup.type === "urgent";
  const isOrder = source === "order";

  return (
    <div
      className={`wa-popup pointer-events-auto w-72 overflow-hidden rounded-xl border bg-white shadow-lg dark:bg-neutral-900 ${
        isOrder
          ? "border-orange-200 dark:border-orange-500/30"
          : isUrgent
            ? "border-amber-200 dark:border-amber-500/30"
            : "border-emerald-200 dark:border-emerald-500/25"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(popup)}
        className="flex w-full items-start gap-3 p-3 pr-8 text-left transition hover:bg-gray-50 dark:hover:bg-neutral-800/60"
      >
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            isOrder
              ? "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400"
              : isUrgent
                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
          }`}
        >
          {isOrder ? (
            <ChefHat className="h-4 w-4" />
          ) : isUrgent ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <MessageCircle className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {popup.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-neutral-400">
            {popup.body}
          </p>
          <p
            className={`mt-1 text-[10px] font-medium ${
              isOrder
                ? "text-orange-600 dark:text-orange-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {isOrder ? "Order ready · tap to open" : "WhatsApp · tap to open"}
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(popup.popupId);
        }}
        className="pointer-events-auto absolute right-2 top-2 rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div
        className={`wa-popup-progress h-0.5 ${
          isOrder ? "bg-orange-500" : isUrgent ? "bg-amber-500" : "bg-emerald-500"
        }`}
      />
    </div>
  );
}

/**
 * Unified notification bell: Orders (ready) + optional WhatsApp tab.
 * @param {'mobile'|'desktop'|'always'} [popupHost] - only the visible header instance should host popups
 */
export default function WhatsAppNotificationBell({
  className = "",
  showWhatsApp = true,
  showOrders = true,
  popupHost = "always",
}) {
  const router = useRouter();
  const wa = useWhatsAppNotifications();
  const orders = useOrderNotifications();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(showOrders ? "orders" : "whatsapp");
  const [popupPos, setPopupPos] = useState(null);
  const [hostPopups, setHostPopups] = useState(popupHost === "always");
  const ref = useRef(null);

  useEffect(() => {
    if (popupHost === "always") {
      setHostPopups(true);
      return;
    }
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      setHostPopups(popupHost === "desktop" ? mq.matches : !mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [popupHost]);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!showOrders && showWhatsApp) setTab("whatsapp");
    if (showOrders && !showWhatsApp) setTab("orders");
  }, [showOrders, showWhatsApp]);

  const totalUnread =
    (showOrders ? orders.unreadCount : 0) +
    (showWhatsApp ? wa.unreadCount : 0);

  const mergedPopups = [
    ...(showOrders
      ? orders.popups.map((p) => ({ ...p, _source: "order" }))
      : []),
    ...(showWhatsApp
      ? wa.popups.map((p) => ({ ...p, _source: "whatsapp" }))
      : []),
  ].slice(0, 4);

  useEffect(() => {
    if (!hostPopups || mergedPopups.length === 0) {
      setPopupPos(null);
      return;
    }

    function updatePos() {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const left = Math.min(
        Math.max(8, rect.right - POPUP_WIDTH),
        window.innerWidth - POPUP_WIDTH - 8,
      );
      setPopupPos({
        top: rect.bottom + 8,
        left,
      });
    }

    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [hostPopups, mergedPopups.length]);

  const Icon =
    wa.permission === "denied"
      ? BellOff
      : wa.permission === "granted"
        ? Bell
        : BellRing;

  const handleWhatsAppClick = (alert) => {
    wa.markAlertRead(alert.conversationId);
    if (alert.popupId) wa.dismissPopup(alert.popupId);
    setOpen(false);
    const onWhatsAppPage =
      router.pathname === "/dashboard/whatsapp" ||
      router.asPath?.startsWith("/whatsapp");
    if (!onWhatsAppPage) {
      router.push("/whatsapp");
    }
    wa.openConversation(alert.conversationId);
  };

  const handleOrderClick = (alert) => {
    orders.markAlertRead(alert.orderId);
    if (alert.popupId) orders.dismissPopup(alert.popupId);
    setOpen(false);
    const role = getStoredAuth()?.user?.role;
    const href = orderReadyHref(role);
    if (!router.asPath?.startsWith(href) && router.pathname !== `/dashboard${href}`) {
      router.push(href);
    }
    orders.openOrder(alert.orderId);
  };

  const activeAlerts = tab === "orders" ? orders.alerts : wa.alerts;
  const clearActive =
    tab === "orders" ? orders.clearAlerts : wa.clearAlerts;

  return (
    <div className={`relative shrink-0 ${className}`} ref={ref}>
      <style jsx global>{`
        @keyframes waPopupIn {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes waPopupProgress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .wa-popup {
          position: relative;
          animation: waPopupIn 0.28s ease-out;
        }
        .wa-popup-progress {
          animation: waPopupProgress 4.5s linear forwards;
        }
      `}</style>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${HEADER_TOOLBAR_BTN} relative border-gray-200 bg-white px-2.5 text-gray-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-orange-500/40 dark:hover:bg-orange-950/30 dark:hover:text-orange-400`}
        title="Notifications"
        aria-label="Notifications"
      >
        <Icon className="h-4 w-4 shrink-0" />
        {totalUnread > 0 ? (
          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        ) : showWhatsApp && wa.permission === "default" ? (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white dark:ring-neutral-950" />
        ) : null}
      </button>

      {hostPopups &&
        mergedPopups.length > 0 &&
        popupPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[100] flex w-80 flex-col gap-2"
            style={{ top: popupPos.top, left: popupPos.left }}
            aria-live="polite"
          >
            {mergedPopups.map((popup) => (
              <PopupToast
                key={`${popup._source}-${popup.popupId}`}
                popup={popup}
                source={popup._source}
                onOpen={
                  popup._source === "order"
                    ? handleOrderClick
                    : handleWhatsAppClick
                }
                onDismiss={
                  popup._source === "order"
                    ? orders.dismissPopup
                    : wa.dismissPopup
                }
              />
            ))}
          </div>,
          document.body,
        )}

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                Notifications
              </p>
              {activeAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={clearActive}
                  className="text-[11px] font-semibold text-gray-400 transition hover:text-gray-600 dark:hover:text-neutral-300"
                >
                  Clear
                </button>
              )}
            </div>
            {showOrders && showWhatsApp && (
              <div className="mt-2.5 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-neutral-800">
                <button
                  type="button"
                  onClick={() => setTab("orders")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-bold transition ${
                    tab === "orders"
                      ? "bg-white text-orange-600 shadow-sm dark:bg-neutral-900 dark:text-orange-400"
                      : "text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                >
                  Orders
                  {orders.unreadCount > 0 && (
                    <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                      {orders.unreadCount > 9 ? "9+" : orders.unreadCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTab("whatsapp")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-bold transition ${
                    tab === "whatsapp"
                      ? "bg-white text-emerald-600 shadow-sm dark:bg-neutral-900 dark:text-emerald-400"
                      : "text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                >
                  WhatsApp
                  {wa.unreadCount > 0 && (
                    <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                      {wa.unreadCount > 9 ? "9+" : wa.unreadCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {tab === "orders" ? (
              orders.alerts.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <ChefHat className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-neutral-600" />
                  <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                    No ready orders yet
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-neutral-500">
                    You&apos;ll hear a sound and see alerts here when kitchen
                    marks an order ready.
                  </p>
                </div>
              ) : (
                orders.alerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => handleOrderClick(alert)}
                    className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition hover:bg-gray-50 dark:border-neutral-800/80 dark:hover:bg-neutral-800/50 ${
                      !alert.read
                        ? "bg-orange-50/50 dark:bg-orange-950/20"
                        : ""
                    }`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400">
                      <ChefHat className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {alert.title}
                        </p>
                        <span className="shrink-0 text-[10px] text-gray-400 dark:text-neutral-500">
                          {formatAlertTime(alert.timestamp)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-neutral-400">
                        {alert.body}
                      </p>
                    </div>
                    {!alert.read && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                    )}
                  </button>
                ))
              )
            ) : wa.alerts.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <MessageCircle className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-neutral-600" />
                <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                  No messages yet
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-neutral-500">
                  Customer WhatsApp messages will appear here in real time.
                </p>
              </div>
            ) : (
              wa.alerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => handleWhatsAppClick(alert)}
                  className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition hover:bg-gray-50 dark:border-neutral-800/80 dark:hover:bg-neutral-800/50 ${
                    !alert.read
                      ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                      : ""
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      alert.type === "urgent"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                    }`}
                  >
                    {alert.type === "urgent" ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <MessageCircle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {alert.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-gray-400 dark:text-neutral-500">
                        {formatAlertTime(alert.timestamp)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-neutral-400">
                      {alert.body}
                    </p>
                  </div>
                  {!alert.read && (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  )}
                </button>
              ))
            )}
          </div>

          {showWhatsApp &&
            tab === "whatsapp" &&
            (wa.permission === "default" || wa.permission === "denied") && (
              <div className="border-t border-gray-100 px-4 py-3 dark:border-neutral-800">
                {wa.permission === "default" && (
                  <p className="text-[11px] leading-relaxed text-gray-500 dark:text-neutral-400">
                    Enable browser notifications for alerts when this tab is in
                    the background.
                  </p>
                )}
                {wa.permission === "denied" && (
                  <p className="text-[11px] leading-relaxed text-gray-500 dark:text-neutral-400">
                    Browser notifications are blocked in your browser settings.
                  </p>
                )}
                {wa.permission === "default" && (
                  <button
                    type="button"
                    onClick={async () => {
                      await wa.requestPermission();
                    }}
                    className="mt-2 w-full rounded-xl bg-orange-500 py-2 text-xs font-bold text-white transition hover:bg-orange-600"
                  >
                    Enable browser notifications
                  </button>
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
