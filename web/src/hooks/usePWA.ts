/**
 * PWA hooks for service worker registration and update notifications.
 *
 * Usage in layout component:
 *   const { needRefresh, updateServiceWorker } = usePWA();
 *   if (needRefresh) <button onClick={updateServiceWorker}>Жаңарту</button>
 */

import { useEffect, useState } from "react";

interface PWAState {
  /** True when a new service worker is waiting to activate */
  needRefresh: boolean;
  /** Call to reload the page with the new service worker */
  updateServiceWorker: () => void;
  /** True when the app is installed as a PWA (standalone mode) */
  isInstalled: boolean;
}

export function usePWA(): PWAState {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const isInstalled =
    typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // sw.js is only generated in production build — skip in dev
    if (import.meta.env.DEV) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        setRegistration(reg);

        // Check for waiting SW (already installed, update available)
        if (reg.waiting) {
          setNeedRefresh(true);
        }

        // Listen for future updates
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setNeedRefresh(true);
            }
          });
        });
      })
      .catch(() => {
        // Service worker registration failed (dev, non-HTTPS, etc.) — ignore
      });
  }, []);

  const updateServiceWorker = () => {
    if (registration?.waiting) {
      // Tell the waiting SW to take over
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  };

  return { needRefresh, updateServiceWorker, isInstalled };
}
