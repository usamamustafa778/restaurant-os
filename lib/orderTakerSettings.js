import { getStoredAuth } from "./apiClient";

export const OT_SETTINGS_KEY = "ot_terminal_settings";

export const DEFAULT_OT_SETTINGS = {
  showMenuImages: true,
  /** Short beep when an item is added / qty increased */
  soundOnAdd: true,
  /** Device vibration on add (supported phones only) */
  hapticsOnAdd: true,
  /** Background Web Push when an order becomes ready (installed PWA) */
  pushOnReady: true,
};

function settingsStorageKey() {
  if (typeof window === "undefined") return OT_SETTINGS_KEY;
  const auth = getStoredAuth();
  const userId = auth?.user?.id || auth?.user?._id || "anon";
  return `${OT_SETTINGS_KEY}_${userId}`;
}

export function loadOrderTakerSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_OT_SETTINGS };
  try {
    const raw = localStorage.getItem(settingsStorageKey());
    if (!raw) return { ...DEFAULT_OT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_OT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_OT_SETTINGS };
  }
}

export function saveOrderTakerSettings(settings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(settingsStorageKey(), JSON.stringify(settings));
  } catch {
    /* ignore quota errors */
  }
}
