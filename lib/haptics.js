/**
 * Light device vibration for tap feedback (Order Taker, Rider, etc.).
 * Uses the Vibration API — supported on most Android browsers.
 * iOS Safari / Chrome-on-iOS do not expose vibrate (WebKit limitation).
 */

const PATTERNS = {
  /** Short confirmation tick (add to cart) */
  light: [18],
  /** Slightly stronger (settings preview / confirm) */
  medium: [28],
  /** Soft double pulse */
  success: [12, 40, 18],
};

export function supportsHaptics() {
  if (typeof window === "undefined") return false;
  const vibrate = window.navigator?.vibrate;
  return typeof vibrate === "function";
}

/**
 * @param {'light'|'medium'|'success'|number|number[]} [pattern]
 * @returns {boolean} true if the browser accepted the call
 */
export function triggerHaptic(pattern = "light") {
  if (typeof window === "undefined") return false;
  const vibrate = window.navigator?.vibrate;
  if (typeof vibrate !== "function") return false;

  let seq = pattern;
  if (typeof pattern === "string") {
    seq = PATTERNS[pattern] || PATTERNS.light;
  } else if (typeof pattern === "number") {
    seq = [Math.max(1, Math.round(pattern))];
  }
  if (!Array.isArray(seq) || seq.length === 0) seq = PATTERNS.light;

  try {
    // Cancel any in-flight pulse so rapid taps still feel crisp
    try {
      vibrate.call(window.navigator, 0);
    } catch {
      /* ignore */
    }
    return Boolean(vibrate.call(window.navigator, seq));
  } catch {
    return false;
  }
}

/** Short copy for settings / empty states when vibrate is unavailable. */
export function hapticsUnsupportedHint() {
  if (typeof window === "undefined") return "";
  if (supportsHaptics()) return "";
  const ua = String(window.navigator?.userAgent || "");
  const isApple =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isApple) {
    return "Not available on iPhone/iPad browsers (Apple limitation).";
  }
  return "This browser doesn’t support vibration.";
}
