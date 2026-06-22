// Dummy Service Worker to prevent 404 errors
// If VitePWA successfully generates a service worker, it will overwrite this in the build output.
// Otherwise, this file satisfies the browser registration and prevents console errors.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
