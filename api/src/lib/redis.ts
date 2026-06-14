/**
 * Redis-клиент для кэша и Pub/Sub адаптера Socket.IO.
 */

import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  // Unit tests mock Redis behavior and must not open background sockets merely
  // because a service module imports this singleton.
  lazyConnect: env.NODE_ENV === "test",
  retryStrategy: (times) => {
    // Exponential backoff: 100ms, 200ms, 400ms … up to 30s
    const delay = Math.min(100 * Math.pow(2, times - 1), 30_000);
    return delay;
  },
});

redis.on("connect", () => process.stdout.write("✅ Redis connected\n"));
redis.on("error", (err) => process.stderr.write(`❌ Redis error: ${err.message}\n`));

// Отдельные клиенты для pub/sub (Socket.IO требует разделения)
export const pubClient = redis.duplicate();
export const subClient = redis.duplicate();
