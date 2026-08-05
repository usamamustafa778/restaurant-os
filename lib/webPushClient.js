/**
 * Client helpers for Web Push (Order Taker PWA background alerts).
 */

import {
  getPushVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
} from "./apiClient";

const SW_URL = "/sw.js";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isWebPushSupported() {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerPushServiceWorker() {
  if (!isWebPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn("[web-push] SW register failed", err);
    return null;
  }
}

export async function getExistingPushSubscription() {
  if (!isWebPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/**
 * Request permission, subscribe, and persist endpoint on the API.
 * Must be called from a user gesture on iOS.
 */
export async function enableWebPush({ client = "order_taker" } = {}) {
  if (!isWebPushSupported()) {
    throw new Error("Push notifications are not supported on this device.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const reg = await registerPushServiceWorker();
  if (!reg) throw new Error("Could not register notification service.");

  const { publicKey } = await getPushVapidPublicKey();
  if (!publicKey) throw new Error("Push is not configured on the server.");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = sub.toJSON();
  await savePushSubscription({
    endpoint: json.endpoint,
    keys: json.keys,
    client,
  });

  return sub;
}

export async function disableWebPush() {
  if (!isWebPushSupported()) return;
  try {
    const sub = await getExistingPushSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      try {
        await sub.unsubscribe();
      } catch {
        /* ignore */
      }
      await deletePushSubscription(endpoint).catch(() =>
        deletePushSubscription(),
      );
    } else {
      await deletePushSubscription().catch(() => {});
    }
  } catch (err) {
    console.warn("[web-push] disable failed", err);
  }
}

/**
 * If permission already granted, quietly re-sync the subscription with the API.
 */
export async function syncWebPushIfGranted({ client = "order_taker" } = {}) {
  if (!isWebPushSupported()) return false;
  if (Notification.permission !== "granted") return false;
  try {
    await registerPushServiceWorker();
    const sub = await getExistingPushSubscription();
    if (!sub) {
      // Permission granted but no sub — try create without a second prompt
      const { publicKey } = await getPushVapidPublicKey();
      if (!publicKey) return false;
      const reg = await navigator.serviceWorker.ready;
      const created = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = created.toJSON();
      await savePushSubscription({
        endpoint: json.endpoint,
        keys: json.keys,
        client,
      });
      return true;
    }
    const json = sub.toJSON();
    await savePushSubscription({
      endpoint: json.endpoint,
      keys: json.keys,
      client,
    });
    return true;
  } catch (err) {
    console.warn("[web-push] sync failed", err);
    return false;
  }
}
