/* Coiffer service worker: push notifications + app install support */

const ICON = "/assets/icons/icon-192.png";
const BADGE = "/assets/icons/badge-96.png";

// Take over as soon as a new version is installed.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Pass-through fetch handler: nothing is cached, every request goes straight
// to the network. Several PWA install guides list a fetch handler as a
// requirement for the install prompt, and this one changes no behaviour.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "Coiffer", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Coiffer";
  const options = {
    body: data.body || "",
    icon: ICON,
    badge: BADGE,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // client.url is always absolute, so the target has to be absolute too.
  const target = new URL(event.notification.data?.url || "/", self.location.origin);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      // Reuse an open Coiffer tab or the installed app window if there is one.
      for (const client of windowClients) {
        if (new URL(client.url).origin === target.origin && "focus" in client) {
          await client.focus();
          if (client.url !== target.href) {
            try {
              await client.navigate(target.href);
            } catch (e) {
              if (clients.openWindow) await clients.openWindow(target.href);
            }
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(target.href);
      }
    })
  );
});