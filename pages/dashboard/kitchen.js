import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/PermissionGate";
import { getOrders, getNextStatuses, updateOrderStatus, recallKitchenOrder, getDaySessions, checkKitchenModuleAccess } from "../../lib/apiClient";
import { useSocket } from "../../contexts/SocketContext";
import { playKitchenNewOrderSound, unlockNotificationAudio } from "../../lib/playNotificationSound";
import KdsLockedPresentation from "../../components/kitchen/KdsLockedPresentation";
import KdsSettingsPanel from "../../components/kitchen/KdsSettingsPanel";
import {
  DEFAULT_KDS_SETTINGS,
  KDS_FILTER_PRESETS,
  getUrgencyLevel,
  loadKdsSettings,
  orderMatchesFilterPreset,
  saveKdsSettings,
  sortKitchenOrders,
} from "../../lib/kdsSettings";
import {
  formatReceiptItemsForBill,
  formatOrderItemDisplayName,
  getDealDisplayItems,
} from "../../lib/orderDisplay.js";
import {
  User, ChefHat, Loader2, CheckCircle2, RefreshCw,
  Package, UtensilsCrossed, Headset, ShoppingBag, Truck, MapPin,
  Trash2, EyeOff, Settings, VolumeX,
} from "lucide-react";
import toast from "react-hot-toast";

const NEW_ORDER_STATUSES = new Set(["NEW_ORDER", "UNPROCESSED"]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Deduplicate orders by their canonical ID.
 * Keeps the entry with the higher STATUS_PRIORITY so an order that has
 * already been promoted to READY never shows in "In Kitchen" due to a
 * stale socket payload arriving slightly late.
 */
function deduplicateOrders(list) {
  const seen = new Map();
  for (const o of list) {
    const key = String(o._id || o.id || "");
    if (!key) continue;
    const existing = seen.get(key);
    if (
      !existing ||
      (STATUS_PRIORITY[o.status] ?? 0) > (STATUS_PRIORITY[existing.status] ?? 0)
    ) {
      seen.set(key, o);
    }
  }
  return Array.from(seen.values());
}

/** Returns true when the order was created today (on or after midnight). */
function isTodayOrder(order, todayStart) {
  if (!order.createdAt) return true;
  return new Date(order.createdAt) >= todayStart;
}

/** Returns true when a READY order has been waiting longer than STALE_READY_MINUTES. */
function isStaleReady(order) {
  if (order.status !== "READY") return false;
  return getElapsedMinutes(order.createdAt) >= STALE_READY_MINUTES;
}

function getDisplayOrderId(order) {
  const id = order.id || order.orderNumber || order._id || "";
  if (typeof id === "string" && id.startsWith("ORD-")) return id.replace(/^ORD-/, "");
  return id;
}

function getTokenNumber(order) {
  if (order.tokenNumber) return String(order.tokenNumber).padStart(4, "0");
  const id = order.id || order._id || "";
  return String(id).slice(-4).toUpperCase();
}

function getElapsedMinutes(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function formatElapsed(minutes) {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getUrgency(minutes, thresholds) {
  return getUrgencyLevel(minutes, thresholds);
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

function getItemStatus(item, orderStatus) {
  if (item.itemStatus) return item.itemStatus;
  if (["READY", "DELIVERED", "OUT_FOR_DELIVERY"].includes(orderStatus)) return "COOKED";
  if (orderStatus === "PROCESSING") return "COOKING";
  return "NEW";
}

function timeAgoShort(dateVal) {
  if (!dateVal) return "";
  const ms = Date.now() - new Date(dateVal).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Ready orders older than this threshold get a Dismiss button. */
const STALE_READY_MINUTES = 120;

/** sessionStorage key for KDS-dismissed order IDs (cleared on tab close). */
const KDS_DISMISSED_KEY = "kds_dismissed_ids";

/**
 * Status priority used for deduplication: if the same order ID appears
 * twice (e.g. from a race between a local optimistic update and a socket
 * event), keep the entry with the higher status priority so the order
 * moves forward, never backward.
 */
const STATUS_PRIORITY = {
  READY: 4, PROCESSING: 3, PENDING: 2, NEW_ORDER: 1, UNPROCESSED: 1,
};

const URGENCY = {
  normal:   { border: "border-gray-200 dark:border-neutral-700", timerBg: "bg-gray-100 dark:bg-neutral-800",     timerText: "text-gray-500 dark:text-neutral-400",  dot: "bg-gray-400" },
  warning:  { border: "border-amber-300 dark:border-amber-500/50",  timerBg: "bg-amber-50 dark:bg-amber-500/10",   timerText: "text-amber-600 dark:text-amber-400",  dot: "bg-amber-400" },
  urgent:   { border: "border-orange-400 dark:border-orange-500/50", timerBg: "bg-orange-50 dark:bg-orange-500/10", timerText: "text-orange-600 dark:text-orange-400", dot: "bg-orange-400" },
  critical: { border: "border-red-400 dark:border-red-500/50",       timerBg: "bg-red-50 dark:bg-red-500/10",       timerText: "text-red-600 dark:text-red-400",       dot: "bg-red-500 animate-pulse" },
};

const TYPE_BADGE = "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400";

const TYPE_CONFIG = {
  "Dine In":  { Icon: UtensilsCrossed, badge: TYPE_BADGE },
  "Takeaway": { Icon: ShoppingBag,     badge: TYPE_BADGE },
  "Delivery": { Icon: Truck,           badge: TYPE_BADGE },
  "Walk-in":  { Icon: User,            badge: TYPE_BADGE },
};

const COLUMNS = [
  {
    key: "new",
    title: "New Orders",
    subtitle: "Awaiting kitchen",
    statuses: ["NEW_ORDER", "UNPROCESSED"],
    header: "bg-orange-500",
    colBg: "bg-orange-50/60 dark:bg-orange-950/20",
    colBorder: "border-orange-200/60 dark:border-orange-500/15",
    countBg: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
    advanceLabel: "Start Cooking",
    advanceCls: "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
    AdvIcon: ChefHat,
    EmptyIcon: Package,
    emptyLabel: "No new orders",
  },
  {
    key: "kitchen",
    title: "Preparing",
    subtitle: "Being prepared",
    statuses: ["PROCESSING", "PENDING"],
    header: "bg-blue-500",
    colBg: "bg-blue-50/60 dark:bg-blue-950/20",
    colBorder: "border-blue-200/60 dark:border-blue-500/15",
    countBg: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
    advanceLabel: "Mark Ready",
    advanceCls: "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700",
    AdvIcon: CheckCircle2,
    EmptyIcon: ChefHat,
    emptyLabel: "Kitchen is clear",
  },
  {
    key: "ready",
    title: "Ready",
    subtitle: "Awaiting pickup / service",
    statuses: ["READY"],
    header: "bg-emerald-500",
    colBg: "bg-emerald-50/60 dark:bg-emerald-950/20",
    colBorder: "border-emerald-200/60 dark:border-emerald-500/15",
    countBg: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
    advanceLabel: null,
    advanceCls: "",
    AdvIcon: null,
    EmptyIcon: CheckCircle2,
    emptyLabel: "No ready orders",
  },
];

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, column, isUpdating, onAdvance, onDismiss, onRecall, prefs }) {
  const typeLabel = getOrderTypeLabel(order);
  const typeConf = TYPE_CONFIG[typeLabel] || TYPE_CONFIG["Walk-in"];
  const minutes = getElapsedMinutes(order.createdAt);
  const thresholds = {
    urgencyWarning: prefs?.urgencyWarning,
    urgencyUrgent: prefs?.urgencyUrgent,
    urgencyCritical: prefs?.urgencyCritical,
  };
  const urgency = getUrgency(minutes, thresholds);
  const ug = URGENCY[urgency];
  const compact = prefs?.density === "compact";
  const { AdvIcon } = column;
  const hasAdditions = (order.items || []).some((i) => i.isAddition);
  const itemsToShow = order.items || [];
  // Same aggregation as POS / order-taker so deal qty + choices match.
  const displayItems = formatReceiptItemsForBill(order);
  const showAdditionBadge = hasAdditions;
  const statuses = itemsToShow.map((i) => getItemStatus(i, order.status));
  const hasNew = statuses.includes("NEW");
  const hasNonNew = statuses.some((s) => s !== "NEW");
  const hasMixed = hasNew && hasNonNew;
  const totalQty = displayItems.reduce((sum, i) => {
    if (i.isDealLine) {
      const choiceQty = (i.dealChoices || []).reduce(
        (s, c) => s + (Number(c.qty) || 1),
        0,
      );
      return sum + (choiceQty || Number(i.qty ?? i.quantity) || 1);
    }
    return sum + (Number(i.qty ?? i.quantity) || 1);
  }, 0);
  const stale = isStaleReady(order);

  const metaBits = [];
  if (prefs?.showTable !== false && typeLabel === "Dine In" && order.tableName) {
    metaBits.push({ key: "table", Icon: MapPin, text: order.tableName, cls: "text-indigo-600 dark:text-indigo-400 font-semibold" });
  }
  if (prefs?.showAddress !== false && typeLabel === "Delivery" && order.deliveryAddress) {
    metaBits.push({ key: "addr", Icon: Truck, text: order.deliveryAddress, cls: "text-emerald-600 dark:text-emerald-400 font-medium" });
  }
  if (prefs?.showCustomer !== false && order.customerName) {
    metaBits.push({ key: "cust", Icon: User, text: order.customerName, cls: "text-gray-600 dark:text-neutral-400" });
  }
  if (prefs?.showWaiter !== false && order.orderTakerName) {
    metaBits.push({ key: "waiter", Icon: Headset, text: order.orderTakerName, cls: "text-gray-500 dark:text-neutral-500" });
  }
  if (typeLabel === "Walk-in" && !order.tableName && !order.customerName) {
    metaBits.push({ key: "walkin", Icon: User, text: "Walk-in", cls: "text-gray-500 dark:text-neutral-500" });
  }

  function itemExtrasInline(item) {
    const parts = [];
    if (item.variantLabel || item.size) parts.push(item.variantLabel || item.size);
    (item.modifierSelections || []).forEach((sel) => {
      (sel.options || []).forEach((opt) => {
        if (opt.name) parts.push(opt.name);
      });
    });
    if (item.note) parts.push(item.note);
    if (parts.length === 0) return null;
    return (
      <span className="text-[10px] leading-tight text-orange-500/90 dark:text-orange-400/90 font-medium truncate">
        {parts.join(" · ")}
      </span>
    );
  }

  function renderKitchenItemLine(item, idx) {
    const st = getItemStatus(item, order.status);
    const qty = item.qty ?? item.quantity ?? 1;
    const extras = itemExtrasInline(item);
    const isCookedMixed = hasMixed && st === "COOKED";
    const isNewMixed = hasMixed && st === "NEW";

    return (
      <li
        key={idx}
        className={`flex gap-1.5 items-start rounded ${
          isNewMixed ? "bg-orange-500/10 px-1 py-0.5 -mx-1" : ""
        } ${isCookedMixed ? "opacity-45" : ""}`}
      >
        <span
          className={`text-[11px] font-black tabular-nums shrink-0 w-5 text-right leading-snug ${
            isNewMixed
              ? "text-orange-500"
              : isCookedMixed
                ? "text-gray-400"
                : "text-primary"
          }`}
        >
          {isCookedMixed ? "✓" : `${qty}×`}
        </span>
        <div className="min-w-0 flex-1 leading-snug">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span
              className={`text-[12px] font-semibold min-w-0 ${
                isNewMixed
                  ? "text-orange-400"
                  : isCookedMixed
                    ? "text-gray-500 line-through"
                    : "text-gray-900 dark:text-neutral-100"
              }`}
            >
              {formatOrderItemDisplayName(item)}
            </span>
            {isNewMixed && (
              <span className="text-[9px] font-black text-orange-500 shrink-0 uppercase">
                new{item.addedAt ? ` ${timeAgoShort(item.addedAt)}` : ""}
              </span>
            )}
          </div>
          {extras}
        </div>
      </li>
    );
  }

  function renderDealLine(item, idx) {
    const qty = item.qty ?? item.quantity ?? 1;
    const children = getDealDisplayItems(item);
    return (
      <li key={idx} className="text-[11px]">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="min-w-0 truncate font-semibold text-gray-900 dark:text-neutral-100">
            {item.name}
            <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-primary">
              Deal
            </span>
          </span>
          <span className="shrink-0 font-bold tabular-nums text-gray-500 dark:text-neutral-500">
            ×{qty}
          </span>
        </div>
        {children.length > 0 ? (
          <ul className="mt-0.5 space-y-0.5 border-l-2 border-primary/30 pl-2.5">
            {children.map((choice, ci) => (
              <li
                key={`${choice.name}-${ci}`}
                className="flex gap-1.5 items-start"
              >
                <span className="w-4 shrink-0 text-right text-[11px] font-black tabular-nums text-primary leading-snug">
                  {choice.qty || 1}×
                </span>
                <div className="min-w-0 flex flex-wrap items-center gap-1 leading-snug">
                  <span className="text-[11px] font-medium text-gray-700 dark:text-neutral-300">
                    {choice.name}
                  </span>
                  {choice.isChoice ? (
                    <span className="rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide bg-primary/15 text-primary">
                      Choice
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {item.note ? (
          <p className="mt-1 text-[10px] font-medium italic text-orange-500 dark:text-orange-400">
            📝 {item.note}
          </p>
        ) : null}
      </li>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-neutral-950 ${compact ? "rounded-lg" : "rounded-xl"} border-2 ${ug.border} flex flex-col overflow-hidden transition-shadow hover:shadow-md ${urgency === "critical" ? "shadow-red-100 dark:shadow-red-900/20" : ""}`}
    >
      {/* Header: token + badges + timer */}
      <div className={`${compact ? "px-2 pt-1.5 pb-1" : "px-2.5 pt-2 pb-1"}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`${compact ? "text-lg" : "text-xl"} font-black text-gray-900 dark:text-white leading-none tabular-nums shrink-0`}>
            #{getTokenNumber(order)}
          </span>
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${typeConf.badge}`}>
            <typeConf.Icon className="w-2.5 h-2.5" />
            {typeLabel}
          </span>
          {showAdditionBadge && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500 text-white shrink-0">
              +ADD
            </span>
          )}
          <div className={`ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-md shrink-0 ${ug.timerBg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ug.dot}`} />
            <span className={`text-[10px] font-bold tabular-nums ${ug.timerText}`}>{formatElapsed(minutes)}</span>
          </div>
        </div>

        {/* Meta row — single line, separators */}
        {(metaBits.length > 0 || prefs?.showOrderId !== false) && (
          <div className="mt-1 flex items-center gap-x-1.5 gap-y-0.5 flex-wrap min-w-0">
            {prefs?.showOrderId !== false && (
              <span className="text-[9px] font-mono text-gray-400 dark:text-neutral-600 truncate max-w-[40%]">
                #{getDisplayOrderId(order)}
              </span>
            )}
            {prefs?.showOrderId !== false && metaBits.length > 0 && (
              <span className="text-gray-300 dark:text-neutral-700 text-[9px]">·</span>
            )}
            {metaBits.map((bit, i) => (
              <span key={bit.key} className="inline-flex items-center gap-0.5 min-w-0 max-w-[48%]">
                {i > 0 && <span className="text-gray-300 dark:text-neutral-700 text-[9px] mr-0.5">·</span>}
                <bit.Icon className="w-2.5 h-2.5 shrink-0 opacity-70" />
                <span className={`text-[10px] truncate ${bit.cls}`}>{bit.text}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Items — dense list, no bulky section header */}
      <div className={`${compact ? "mx-2" : "mx-2.5"} border-t border-gray-100 dark:border-neutral-800/80`} />
      <div className={`${compact ? "px-2 py-1.5" : "px-2.5 py-2"} flex-1`}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500">
            {totalQty} item{totalQty !== 1 ? "s" : ""}
          </span>
        </div>
        <ul className={`${compact ? "space-y-1" : "space-y-1.5"}`}>
          {displayItems.map((item, idx) =>
            item.isDealLine
              ? renderDealLine(item, idx)
              : renderKitchenItemLine(item, idx),
          )}
        </ul>
      </div>

      {/* Actions — compact footer */}
      {(column.key === "ready" && onRecall) || column.advanceLabel || (stale && onDismiss) ? (
        <div className={`${compact ? "px-2 pb-1.5 pt-0" : "px-2.5 pb-2 pt-0"} space-y-1`}>
          {column.key === "ready" && onRecall && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onRecall(order)}
              className="w-full py-1 rounded-lg text-[11px] font-semibold text-gray-400 border border-gray-200 dark:border-neutral-700 hover:text-orange-400 hover:border-orange-500/50 transition-colors disabled:opacity-50"
            >
              ↩ Back to Preparing
            </button>
          )}
          {column.advanceLabel && AdvIcon && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onAdvance(order)}
              className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-white text-[11px] font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${column.advanceCls}`}
            >
              {isUpdating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <AdvIcon className="w-3.5 h-3.5" />
                  {column.advanceLabel}
                </>
              )}
            </button>
          )}
          {stale && onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(order.id || order._id)}
              className="w-full flex items-center justify-center gap-1 py-1 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 text-[11px] font-semibold hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors"
            >
              <EyeOff className="w-3 h-3" />
              Dismiss
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KitchenPage() {
  const { socket } = useSocket() || {};
  const [orders, setOrders] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [moduleLocked, setModuleLocked] = useState(null); // null = checking
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [tick, setTick] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [sessionStart, setSessionStart] = useState(null);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // KDS preferences (persisted to localStorage per user)
  const [kdsPrefs, setKdsPrefs] = useState(() => loadKdsSettings());
  const [kdsDraft, setKdsDraft] = useState(() => loadKdsSettings());

  const typeFilter = kdsPrefs.filterPreset || "all";
  const setTypeFilter = useCallback((f) => {
    setKdsPrefs((p) => {
      const next = { ...p, filterPreset: f };
      saveKdsSettings(next);
      return next;
    });
  }, []);

  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const stored =
        typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem(KDS_DISMISSED_KEY)
          : null;
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  /** null until first load seeds IDs — avoids ringing on initial fetch. */
  const knownNewOrderIdsRef = useRef(null);
  const repeatTimerRef = useRef(null);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  // Ring when a new ticket appears in the New Orders column.
  useEffect(() => {
    if (pageLoading || moduleLocked) return;

    const currentIds = new Set(
      orders
        .filter((o) => NEW_ORDER_STATUSES.has(o.status))
        .map((o) => String(o._id || o.id || ""))
        .filter(Boolean),
    );

    if (knownNewOrderIdsRef.current === null) {
      knownNewOrderIdsRef.current = currentIds;
      return;
    }

    let hasNew = false;
    for (const id of currentIds) {
      if (!knownNewOrderIdsRef.current.has(id)) {
        hasNew = true;
        break;
      }
    }

    knownNewOrderIdsRef.current = currentIds;
    if (hasNew && kdsPrefs.soundEnabled) {
      playKitchenNewOrderSound({
        soundType: kdsPrefs.soundType,
        volume: kdsPrefs.soundVolume,
      });
    }
  }, [orders, pageLoading, kdsPrefs.soundEnabled, kdsPrefs.soundType, kdsPrefs.soundVolume]);

  // Repeat-until-seen: re-alert while New Orders column is non-empty.
  useEffect(() => {
    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
    if (!kdsPrefs.soundEnabled || !kdsPrefs.soundRepeat) return;
    const intervalMs = (kdsPrefs.soundRepeatSeconds || 25) * 1000;

    repeatTimerRef.current = setInterval(() => {
      const hasNewOrders = orders.some((o) => NEW_ORDER_STATUSES.has(o.status));
      if (hasNewOrders) {
        playKitchenNewOrderSound({
          soundType: kdsPrefs.soundType,
          volume: kdsPrefs.soundVolume,
        });
      }
    }, intervalMs);

    return () => {
      if (repeatTimerRef.current) clearInterval(repeatTimerRef.current);
    };
  }, [orders, kdsPrefs.soundEnabled, kdsPrefs.soundRepeat, kdsPrefs.soundRepeatSeconds, kdsPrefs.soundType, kdsPrefs.soundVolume]);

  // Unlock Web Audio on first interaction (browsers block sound until then).
  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      try {
        await checkKitchenModuleAccess();
        if (!cancelled) setModuleLocked(false);
      } catch (e) {
        if (cancelled) return;
        const locked =
          e?.details?.code === "MODULE_NOT_ACTIVE" ||
          e?.details?.module === "kds" ||
          e?.code === 403;
        setModuleLocked(locked);
        if (locked) setPageLoading(false);
      }
    }
    checkAccess();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (moduleLocked !== false) return undefined;
    fetchOrders();
    const iv = setInterval(fetchOrders, 30000);
    return () => clearInterval(iv);
  }, [moduleLocked]);

  // Fetch the active business day session so KDS scope matches POS session scope.
  useEffect(() => {
    if (moduleLocked !== false) return undefined;
    async function loadSessionStart() {
      try {
        const data = await getDaySessions(null, { limit: 5 });
        const list = Array.isArray(data) ? data : (data?.sessions ?? []);
        const open = list.find((s) => s.status === "OPEN" && s.startAt);
        if (open?.startAt) {
          setSessionStart(new Date(open.startAt));
          return;
        }
        // No open session — use most recent closed session's endAt − 24 h so
        // evening orders before the session opened are still visible.
        const closed = list.find((s) => s.status === "CLOSED" && s.endAt);
        if (closed?.endAt) {
          setSessionStart(new Date(new Date(closed.endAt).getTime() - 24 * 60 * 60 * 1000));
          return;
        }
      } catch {}
      // Ultimate fallback: calendar midnight (same as before).
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      setSessionStart(d);
    }
    loadSessionStart();
  }, [moduleLocked]);

  useEffect(() => {
    if (moduleLocked !== false || !socket) return undefined;
    const handler = () => fetchOrders();
    socket.on("order:created", handler);
    socket.on("order:updated", handler);
    return () => {
      socket.off("order:created", handler);
      socket.off("order:updated", handler);
    };
  }, [socket, moduleLocked]);

  async function fetchOrders() {
    try {
      const data = await getOrders();
      const raw = Array.isArray(data) ? data : (data?.orders ?? []);
      // Deduplicate so the same order ID cannot appear in two columns simultaneously.
      setOrders(deduplicateOrders(raw));
      setLastRefreshed(Date.now());
    } catch (err) {
      toast.error(err.message || "Failed to load orders");
    } finally {
      setPageLoading(false);
      setRefreshing(false);
    }
  }

  function handleDismiss(orderId) {
    const id = String(orderId);
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try { sessionStorage.setItem(KDS_DISMISSED_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function handleClearStaleReady() {
    // Collect IDs from the READY column that are older than the stale threshold.
    const toRemove = orders.filter(
      (o) => o.status === "READY" && isStaleReady(o),
    );
    if (toRemove.length === 0) return;
    setDismissedIds((prev) => {
      const next = new Set(prev);
      toRemove.forEach((o) => next.add(String(o._id || o.id || "")));
      try { sessionStorage.setItem(KDS_DISMISSED_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
    toast.success(
      `Dismissed ${toRemove.length} stale order${toRemove.length !== 1 ? "s" : ""}`,
    );
  }

  async function handleManualRefresh() {
    setRefreshing(true);
    await fetchOrders();
  }

  async function handleStatusAdvance(order) {
    const orderId = order.id || order._id;
    const typeKey = (order.orderType || order.type || "DINE_IN").toUpperCase();
    const nextStatus = getNextStatuses(order.status, typeKey)[0];
    if (!nextStatus) return;
    setUpdatingOrderId(orderId);
    try {
      await updateOrderStatus(orderId, nextStatus);
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId || o.id === orderId ? { ...o, status: nextStatus } : o))
      );
      const label = { PROCESSING: "Started cooking", READY: "Marked ready" }[nextStatus] || nextStatus;
      toast.success(`#${getTokenNumber(order)} — ${label}`);
    } catch (err) {
      toast.error(err.message || "Failed to update");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function recallOrder(order) {
    const orderId = order._id || order.id;
    setUpdatingOrderId(orderId);
    try {
      await recallKitchenOrder(orderId);
      await fetchOrders();
      toast.success(`#${getTokenNumber(order)} — moved back to Preparing`);
    } catch (e) {
      toast.error(e?.message || "Could not move order back");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const activeOrders = orders.filter((o) => {
    if (dismissedIds.has(String(o._id || o.id || ""))) return false;
    if (["CANCELLED", "COMPLETED", "OUT_FOR_DELIVERY"].includes(o.status)) return false;
    if (o.status === "DELIVERED") {
      return false;
    }
    return true;
  });

  // Show orders from the current business session only (mirrors POS session scope).
  // Falls back to all active orders while sessionStart is still loading.
  const visibleOrders = sessionStart
    ? activeOrders.filter((o) => isTodayOrder(o, sessionStart))
    : activeOrders;

  const thresholds = {
    urgencyWarning: kdsPrefs.urgencyWarning,
    urgencyUrgent: kdsPrefs.urgencyUrgent,
    urgencyCritical: kdsPrefs.urgencyCritical,
  };

  const applyTypeFilter = (list) =>
    list.filter((o) => orderMatchesFilterPreset(o, typeFilter, thresholds));

  const applySorting = (list) => sortKitchenOrders(list, kdsPrefs);

  const activeColumns = kdsPrefs.hideReadyColumn
    ? COLUMNS.filter((c) => c.key !== "ready")
    : COLUMNS;

  const columnOrders = activeColumns.map((col) =>
    applySorting(
      applyTypeFilter(
        visibleOrders.filter((o) => col.statuses.includes(o.status)),
      ),
    ),
  );

  // Stale ready orders — drives the "Clear stale" button.
  const readyColIdx = activeColumns.findIndex((c) => c.key === "ready");
  const staleReadyCount = readyColIdx >= 0 ? columnOrders[readyColIdx].filter(isStaleReady).length : 0;

  const typeCounts = {
    DINE_IN:  visibleOrders.filter((o) => getOrderTypeLabel(o) === "Dine In").length,
    TAKEAWAY: visibleOrders.filter((o) => getOrderTypeLabel(o) === "Takeaway").length,
    DELIVERY: visibleOrders.filter((o) => getOrderTypeLabel(o) === "Delivery").length,
  };

  const totalActive = visibleOrders.length;
  const secondsSince = Math.round((Date.now() - lastRefreshed) / 1000);
  const refreshLabel = secondsSince < 5 ? "Just now" : secondsSince < 60 ? `${secondsSince}s ago` : `${Math.floor(secondsSince / 60)}m ago`;

  if (moduleLocked === true) {
    return (
      <AdminLayout title="Kitchen Display System" subtitle="">
        <PermissionGate permission="orders.start_cooking">
          <div className="-mx-4 -mt-4 mb-[-6rem] min-h-[calc(100vh-3.5rem)] md:-mx-6 md:mb-[-1.5rem] md:min-h-[calc(100vh-4rem)]">
            <KdsLockedPresentation />
          </div>
        </PermissionGate>
      </AdminLayout>
    );
  }

  if (pageLoading || moduleLocked === null) {
    return (
      <AdminLayout title="Kitchen Display System" subtitle="">
        <PermissionGate permission="orders.start_cooking">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mb-4">
            <ChefHat className="w-8 h-8 text-orange-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            <p className="text-sm text-gray-500">Loading kitchen orders…</p>
          </div>
        </div>
        </PermissionGate>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Kitchen Display System" subtitle="">
      <PermissionGate permission="orders.start_cooking">
      <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 110px)" }}>

        {/* ── Top bar ────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter presets */}
            <div className="flex rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1 gap-0.5 flex-wrap">
              {KDS_FILTER_PRESETS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTypeFilter(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    typeFilter === f.id
                      ? "bg-gradient-to-r from-primary to-secondary text-white shadow-sm"
                      : "text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Clear stale Ready orders */}
            {staleReadyCount > 0 && (
              <button
                type="button"
                onClick={handleClearStaleReady}
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                title="Dismiss all Ready orders older than 2 hours from KDS view (does not change order status)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear {staleReadyCount} stale
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-3 text-[10px] text-gray-400 dark:text-neutral-500">
              {[
                { cls: "bg-gray-400", label: `< ${kdsPrefs.urgencyWarning}m` },
                { cls: "bg-amber-400", label: `${kdsPrefs.urgencyWarning}-${kdsPrefs.urgencyUrgent}m` },
                { cls: "bg-orange-400", label: `${kdsPrefs.urgencyUrgent}-${kdsPrefs.urgencyCritical}m` },
                { cls: "bg-red-500 animate-pulse", label: `> ${kdsPrefs.urgencyCritical}m` },
              ].map((u) => (
                <div key={u.label} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${u.cls}`} />
                  {u.label}
                </div>
              ))}
            </div>

            {/* Sound muted indicator */}
            {!kdsPrefs.soundEnabled && (
              <span className="hidden sm:flex items-center gap-1 text-[10px] text-gray-400 dark:text-neutral-500" title="Sound is off">
                <VolumeX className="w-3 h-3" />
              </span>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-neutral-500">
              <span className="hidden sm:inline">Updated {refreshLabel}</span>
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="p-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-500 hover:text-primary transition-colors disabled:opacity-50"
                title="Refresh orders"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setKdsDraft({ ...kdsPrefs });
                  setShowSettingsPanel(true);
                }}
                className="p-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-500 hover:text-primary transition-colors"
                title="KDS settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Kanban columns ────────────────────────────────────────── */}
        <div className={`flex-1 grid grid-cols-1 ${activeColumns.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"} gap-3 min-h-0`}>
          {activeColumns.map((col, colIdx) => {
            const colOrs = columnOrders[colIdx];
            const { EmptyIcon } = col;
            const staleInCol = col.key === "ready" ? colOrs.filter(isStaleReady).length : 0;
            return (
              <div
                key={col.key}
                className={`flex flex-col rounded-2xl border ${col.colBorder} ${col.colBg} overflow-hidden min-h-0`}
              >
                <div className={`flex items-center gap-2 px-4 py-2.5 flex-shrink-0 border-b ${col.colBorder}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${col.header} flex-shrink-0`} />
                  <span className="text-[13px] font-bold text-gray-800 dark:text-neutral-200 truncate">{col.title}</span>
                  <span className={`ml-auto text-[11px] font-bold min-w-[24px] text-center px-1.5 py-0.5 rounded-full ${col.countBg}`}>
                    {colOrs.length}
                  </span>
                  {staleInCol > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
                      title={`${staleInCol} order${staleInCol !== 1 ? "s" : ""} waiting over 2 hours`}>
                      {staleInCol} stale
                    </span>
                  )}
                </div>

                <div className={`flex-1 overflow-y-auto min-h-0 ${kdsPrefs.density === "compact" ? "p-2 space-y-1.5" : "p-2.5 space-y-2"}`}>
                  {colOrs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[120px] opacity-40">
                      <EmptyIcon className="w-10 h-10 text-gray-400 dark:text-neutral-600 mb-2" />
                      <p className="text-xs text-gray-400 dark:text-neutral-600">{col.emptyLabel}</p>
                    </div>
                  ) : (
                    colOrs.map((order) => {
                      const orderId = order.id || order._id;
                      return (
                        <OrderCard
                          key={orderId}
                          order={order}
                          column={col}
                          isUpdating={updatingOrderId === orderId}
                          onAdvance={handleStatusAdvance}
                          onDismiss={handleDismiss}
                          onRecall={col.key === "ready" ? recallOrder : null}
                          prefs={kdsPrefs}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <KdsSettingsPanel
        open={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        settings={kdsDraft}
        onChange={setKdsDraft}
        onSave={() => {
          saveKdsSettings(kdsDraft);
          setKdsPrefs(kdsDraft);
          setShowSettingsPanel(false);
          toast.success("KDS settings saved");
        }}
        onReset={() => {
          const defaults = { ...DEFAULT_KDS_SETTINGS };
          setKdsDraft(defaults);
          saveKdsSettings(defaults);
          setKdsPrefs(defaults);
          toast.success("Settings reset to defaults");
        }}
      />
      </PermissionGate>
    </AdminLayout>
  );
}
