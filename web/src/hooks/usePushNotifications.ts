/**
 * usePushNotifications — хук для управления Web Push подписками.
 *
 * Использование:
 *   const { isSupported, isSubscribed, subscribe, unsubscribe } = usePushNotifications();
 *
 * Вызывать на странице профиля или в layout после аутентификации.
 * Подписка хранится в БД — работает на всех устройствах пользователя.
 *
 * Требует VAPID_PUBLIC_KEY на бэкенде + push-sw.js в public/.
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const PUSH_SW_URL = "/push-sw.js";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export function usePushNotifications(): PushState {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Проверяем поддержку и текущую подписку
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    setIsSupported(true);

    navigator.serviceWorker
      .register(PUSH_SW_URL, { scope: "/" })
      .then(async (reg) => {
        setRegistration(reg);
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(sub !== null);
      })
      .catch(() => {
        // push-sw.js не загружен или HTTPS не настроен — тихо игнорируем
      });
  }, []);

  const subscribe = useCallback(async () => {
    if (!registration) return;
    setIsLoading(true);
    try {
      // Получаем VAPID public key с бэкенда
      const { publicKey } = await api.push.vapidPublicKey();

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const applicationServerKey = urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

      await api.push.subscribe({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });

      setIsSubscribed(true);
    } catch {
      // Пользователь отказал или ошибка — тихо
    } finally {
      setIsLoading(false);
    }
  }, [registration]);

  const unsubscribe = useCallback(async () => {
    if (!registration) return;
    setIsLoading(true);
    try {
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await api.push.unsubscribe({ endpoint: sub.endpoint });
        await sub.unsubscribe();
        setIsSubscribed(false);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [registration]);

  return { isSupported, isSubscribed, isLoading, subscribe, unsubscribe };
}
