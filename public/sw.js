/* EatsDesk service worker — Web Push for Order Taker (and future clients). */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function parsePushData(event) {
  try {
    if (!event.data) return null;
    const text = event.data.text();
    try {
      return JSON.parse(text);
    } catch {
      return { title: "EatsDesk", body: text };
    }
  } catch {
    return null;
  }
}

self.addEventListener("push", (event) => {
  const data = parsePushData(event) || {};
  const title = data.title || "EatsDesk";
  const options = {
    body: data.body || "You have a new update",
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: data.tag || data.type || "eatsdesk",
    renotify: true,
    data: {
      url: data.url || "/order-taker",
      orderId: data.orderId || null,
      type: data.type || null,
    },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/order-taker";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        const url = new URL(client.url);
        if (
          url.pathname.includes("order-taker") ||
          url.pathname === "/" ||
          url.pathname.startsWith("/dashboard")
        ) {
          if ("focus" in client) {
            await client.focus();
            if ("navigate" in client) {
              try {
                await client.navigate(targetUrl);
              } catch {
                /* ignore navigate failures */
              }
            }
            client.postMessage({
              type: "PUSH_NOTIFICATION_CLICK",
              url: targetUrl,
              orderId: event.notification.data?.orderId || null,
            });
            return;
          }
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
