/**
 * Push Service Worker — Judo-Arena
 *
 * Этот SW обрабатывает входящие Web Push уведомления.
 * Регистрируется отдельно от VitePWA SW через usePushNotifications хук.
 *
 * Поддерживаемые события:
 *   push        — показать уведомление
 *   notificationclick — открыть нужную страницу при клике
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Judo-Arena", body: event.data.text() };
  }

  const title = payload.title ?? "Judo-Arena";
  const options = {
    body: payload.body ?? "",
    icon: payload.icon ?? "/icon-192.png",
    badge: payload.badge ?? "/icon-72.png",
    tag: payload.tag ?? "judo-arena",
    data: payload.data ?? {},
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Если вкладка уже открыта — фокусируем её
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Иначе открываем новую вкладку
        if (clients.openWindow) return clients.openWindow(url);
      }),
  );
});
