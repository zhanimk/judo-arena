/**
 * Web Push сервис.
 *
 * VAPID ключи генерируются один раз и хранятся в env:
 *   node -e "const wp=require('web-push'); console.log(JSON.stringify(wp.generateVAPIDKeys()))"
 *
 * Флоу:
 *   1. Фронтенд запрашивает разрешение на уведомления
 *   2. Подписывается через navigator.serviceWorker → получает PushSubscription
 *   3. POST /api/push/subscribe — сохраняет в БД
 *   4. Сервер вызывает sendPushToUser() при событии (матч следующий, результат)
 *   5. Браузер получает push и SW показывает notification
 *
 * Если VAPID не настроен — все операции тихо игнорируются.
 */

import webpush from "web-push";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";

let vapidConfigured = false;

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  vapidConfigured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  url?: string;
}

/** Сохранить подписку пользователя (или обновить если endpoint уже существует). */
export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string,
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    },
  });
}

/** Удалить подписку (пользователь отказался от уведомлений). */
export async function removePushSubscription(
  userId: string,
  endpoint: string,
): Promise<void> {
  await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
}

/** Получить все активные подписки пользователя. */
export async function getUserSubscriptions(userId: string) {
  return prisma.pushSubscription.findMany({ where: { userId } });
}

/**
 * Отправить push-уведомление пользователю на все его устройства.
 * Если VAPID не настроен или нет подписок — тихо игнорируется.
 * Протухшие подписки (410 Gone) автоматически удаляются.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!vapidConfigured) return;

  const subscriptions = await getUserSubscriptions(userId);
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 }, // 1 час — если устройство оффлайн
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        // 410 Gone или 404 — подписка больше не действительна, удаляем
        if (status === 410 || status === 404) {
          await prisma.pushSubscription
            .deleteMany({ where: { endpoint: sub.endpoint } })
            .catch(() => {});
        }
      }
    }),
  );
}

/**
 * Отправить push когда матч спортсмена стал следующим в очереди татами.
 */
export async function notifyMatchNext(
  athleteId: string,
  matchInfo: {
    tatami: number;
    opponent: string;
    category: string;
  },
): Promise<void> {
  await sendPushToUser(athleteId, {
    title: "🥋 Сіздің матчыңыз!",
    body: `Татами ${matchInfo.tatami} · ${matchInfo.opponent} · ${matchInfo.category}`,
    tag: `match-next-${athleteId}`,
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    url: "/athlete/matches",
    data: { type: "match_next", tatami: matchInfo.tatami },
  });
}
