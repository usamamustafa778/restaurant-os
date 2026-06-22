import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import {
  Bell,
  BellOff,
  BellRing,
  MessageCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import { useWhatsAppNotifications } from "../../contexts/WhatsAppNotificationContext";

const HEADER_TOOLBAR_BTN =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold leading-none shadow-sm transition-all";

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

function WhatsAppPopupToast({ popup, onOpen, onDismiss }) {
  const isUrgent = popup.type === "urgent";

  return (
    <div
      className={`wa-popup pointer-events-auto w-72 overflow-hidden rounded-xl border bg-white shadow-lg dark:bg-neutral-900 ${
        isUrgent
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
            isUrgent
              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
          }`}
        >
          {isUrgent ? (
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
          <p className="mt-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            WhatsApp · tap to open
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
          isUrgent ? "bg-amber-500" : "bg-emerald-500"
        }`}
      />
    </div>
  );
}

export default function WhatsAppNotificationBell({ className = "" }) {
  const router = useRouter();
  const {
    permission,
    requestPermission,
    alerts,
    unreadCount,
    popups,
    openConversation,
    markAlertRead,
    clearAlerts,
    dismissPopup,
  } = useWhatsAppNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const Icon =
    permission === "denied" ? BellOff : permission === "granted" ? Bell : BellRing;

  const handleAlertClick = (alert) => {
    markAlertRead(alert.conversationId);
    if (alert.popupId) dismissPopup(alert.popupId);
    setOpen(false);
    const onWhatsAppPage =
      router.pathname === "/dashboard/whatsapp" ||
      router.asPath?.startsWith("/whatsapp");
    if (!onWhatsAppPage) {
      router.push("/whatsapp");
    }
    openConversation(alert.conversationId);
  };

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
        className={`${HEADER_TOOLBAR_BTN} relative border-gray-200 bg-white px-2.5 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400`}
        title="WhatsApp notifications"
        aria-label="WhatsApp notifications"
      >
        <Icon className="h-4 w-4 shrink-0" />
        {unreadCount > 0 ? (
          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : permission === "default" ? (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white dark:ring-neutral-950" />
        ) : null}
      </button>

      {popups.length > 0 && (
        <div
          className="pointer-events-none absolute right-0 top-full z-50 mt-2 flex w-72 flex-col gap-2"
          aria-live="polite"
        >
          {popups.map((popup) => (
            <WhatsAppPopupToast
              key={popup.popupId}
              popup={popup}
              onOpen={handleAlertClick}
              onDismiss={dismissPopup}
            />
          ))}
        </div>
      )}

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                WhatsApp alerts
              </p>
              {alerts.length > 0 && (
                <button
                  type="button"
                  onClick={clearAlerts}
                  className="text-[11px] font-semibold text-gray-400 transition hover:text-gray-600 dark:hover:text-neutral-300"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {alerts.length === 0 ? (
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
              alerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => handleAlertClick(alert)}
                  className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition hover:bg-gray-50 dark:border-neutral-800/80 dark:hover:bg-neutral-800/50 ${
                    !alert.read ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
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

          {(permission === "default" || permission === "denied") && (
            <div className="border-t border-gray-100 px-4 py-3 dark:border-neutral-800">
              {permission === "default" && (
                <p className="text-[11px] leading-relaxed text-gray-500 dark:text-neutral-400">
                  Enable browser notifications for alerts when this tab is in the
                  background.
                </p>
              )}
              {permission === "denied" && (
                <p className="text-[11px] leading-relaxed text-gray-500 dark:text-neutral-400">
                  Browser notifications are blocked in your browser settings.
                </p>
              )}
              {permission === "default" && (
                <button
                  type="button"
                  onClick={async () => {
                    await requestPermission();
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
