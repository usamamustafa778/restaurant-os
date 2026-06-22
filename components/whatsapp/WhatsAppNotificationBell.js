import { useState, useRef, useEffect } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { useWhatsAppNotifications } from "../../contexts/WhatsAppNotificationContext";

export default function WhatsAppNotificationBell({ className = "" }) {
  const { permission, requestPermission } = useWhatsAppNotifications();
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

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
          permission === "granted"
            ? "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-400"
            : permission === "denied"
              ? "border-gray-200 bg-gray-50 text-gray-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500"
              : "border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-950/40 dark:text-orange-400"
        }`}
        title="WhatsApp notifications"
        aria-label="WhatsApp notifications"
      >
        <Icon className="h-4 w-4" />
        {permission === "default" && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-white dark:ring-neutral-950" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
          <p className="text-sm font-bold text-gray-900 dark:text-white">WhatsApp alerts</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-neutral-400">
            {permission === "granted" &&
              "Notifications are on. You'll be alerted when customers message while this tab is in the background."}
            {permission === "default" &&
              "Enable browser notifications to get alerted when customers message on WhatsApp."}
            {permission === "denied" &&
              "Notifications are blocked. Allow them in your browser settings for this site."}
          </p>
          {permission === "default" && (
            <button
              type="button"
              onClick={async () => {
                await requestPermission();
                setOpen(false);
              }}
              className="mt-3 w-full rounded-xl bg-orange-500 py-2 text-xs font-bold text-white transition hover:bg-orange-600"
            >
              Enable notifications
            </button>
          )}
          {permission === "granted" && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </p>
          )}
        </div>
      )}
    </div>
  );
}
