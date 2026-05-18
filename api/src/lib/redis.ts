/**
 * Redis-клиент для кэша и Pub/Sub адаптера Socket.IO.
 */

import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err.message));

// Отдельные клиенты для pub/sub (Socket.IO требует разделения)
export const pubClient = redis.duplicate();
export const subClient = redis.duplicate();
