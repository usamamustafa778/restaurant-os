import { getStoredAuth } from "./apiClient";

export const KDS_SETTINGS_KEY = "kds_terminal_settings";

export const KDS_SOUND_TYPES = [
  {
    id: "service_bell",
    label: "Service bell",
    description: "Loud ding-dong — best for busy kitchens",
  },
  {
    id: "kitchen_alert",
    label: "Kitchen alert",
    description: "Triple ascending buzz — hard to miss",
  },
  {
    id: "classic_ding",
    label: "Classic ding",
    description: "Bright two-tone notification",
  },
];

export const KDS_DENSITY_OPTIONS = [
  { id: "comfortable", label: "Comfortable", description: "Larger cards, full details" },
  { id: "compact", label: "Compact", description: "More tickets on screen" },
];

export const KDS_SORT_OPTIONS = [
  { id: "oldest", label: "Oldest first", description: "Longest-waiting orders on top" },
  { id: "newest", label: "Newest first", description: "Latest orders on top" },
];

export const KDS_FILTER_PRESETS = [
  { id: "all", label: "All orders", description: "Every active ticket" },
  { id: "DINE_IN", label: "Dine in", description: "Table service only" },
  { id: "TAKEAWAY", label: "Takeaway", description: "Pickup orders only" },
  { id: "DELIVERY", label: "Delivery", description: "Delivery orders only" },
  {
    id: "additions",
    label: "Additions",
    description: "Orders with newly added items",
  },
  {
    id: "urgent",
    label: "Urgent",
    description: "Orders past the urgent time threshold",
  },
];

export const DEFAULT_KDS_SETTINGS = {
  soundEnabled: true,
  soundVolume: 85,
  soundType: "service_bell",
  soundRepeat: false,
  soundRepeatSeconds: 25,

  density: "comfortable",
  showCustomer: true,
  showWaiter: true,
  showOrderId: true,
  showTable: true,
  showAddress: true,

  sortBy: "oldest",
  pinUrgent: true,
  hideReadyColumn: false,

  filterPreset: "all",
  defaultFilterPreset: "all",

  urgencyWarning: 10,
  urgencyUrgent: 15,
  urgencyCritical: 20,
};

function settingsStorageKey() {
  if (typeof window === "undefined") return KDS_SETTINGS_KEY;
  const auth = getStoredAuth();
  const userId = auth?.user?.id || auth?.user?._id || "anon";
  return `${KDS_SETTINGS_KEY}_${userId}`;
}

export function loadKdsSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_KDS_SETTINGS };
  try {
    const raw = localStorage.getItem(settingsStorageKey());
    if (!raw) return { ...DEFAULT_KDS_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_KDS_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_KDS_SETTINGS };
  }
}

export function saveKdsSettings(settings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(settingsStorageKey(), JSON.stringify(settings));
  } catch {
    /* ignore quota errors */
  }
}

export function getUrgencyLevel(minutes, thresholds) {
  const critical = thresholds?.urgencyCritical ?? 20;
  const urgent = thresholds?.urgencyUrgent ?? 15;
  const warning = thresholds?.urgencyWarning ?? 10;
  if (minutes >= critical) return "critical";
  if (minutes >= urgent) return "urgent";
  if (minutes >= warning) return "warning";
  return "normal";
}

export function orderMatchesFilterPreset(order, presetId, thresholds) {
  if (!presetId || presetId === "all") return true;
  if (presetId === "DINE_IN") {
    const label = getOrderTypeLabel(order);
    return label === "Dine In";
  }
  if (presetId === "TAKEAWAY") {
    return getOrderTypeLabel(order) === "Takeaway";
  }
  if (presetId === "DELIVERY") {
    return getOrderTypeLabel(order) === "Delivery";
  }
  if (presetId === "additions") {
    return (order.items || []).some((i) => i.isAddition);
  }
  if (presetId === "urgent") {
    const mins = Math.floor(
      (Date.now() - new Date(order.createdAt).getTime()) / 60000,
    );
    const urgent = thresholds?.urgencyUrgent ?? 15;
    return mins >= urgent;
  }
  return true;
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

export function sortKitchenOrders(list, settings) {
  const sorted = [...list].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return settings.sortBy === "newest" ? tb - ta : ta - tb;
  });

  if (!settings.pinUrgent) return sorted;

  const thresholds = {
    urgencyWarning: settings.urgencyWarning,
    urgencyUrgent: settings.urgencyUrgent,
    urgencyCritical: settings.urgencyCritical,
  };

  const priority = (order) => {
    const mins = Math.floor(
      (Date.now() - new Date(order.createdAt).getTime()) / 60000,
    );
    const level = getUrgencyLevel(mins, thresholds);
    const map = { critical: 4, urgent: 3, warning: 2, normal: 1 };
    return map[level] || 0;
  };

  return sorted.sort((a, b) => {
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pb - pa;
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return settings.sortBy === "newest" ? tb - ta : ta - tb;
  });
}
