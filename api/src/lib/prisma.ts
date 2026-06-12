/**
 * Глобальный Prisma-клиент (синглтон).
 * В dev-режиме переиспользуем экземпляр между перезагрузками tsx watch.
 */

import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

declare global {
  var __prisma: PrismaClient | undefined;
}

const SLOW_QUERY_MS = 1000;

function buildDatabaseUrl(): string {
  try {
    const url = new URL(env.DATABASE_URL);
    url.searchParams.set("connection_limit", String(env.DB_CONNECTION_LIMIT));
    url.searchParams.set("pool_timeout", String(env.DB_POOL_TIMEOUT));
    return url.toString();
  } catch {
    // Если URL не парсится — вернём как есть, Prisma сам выдаст ошибку
    return env.DATABASE_URL;
  }
}

// Per-minute query stats for N+1 detection (resets each interval)
let _qStats = { total: 0, slow: 0, totalMs: 0 };
const _statsTimer = setInterval(() => {
  if (_qStats.total > 0) {
    process.stderr.write(
      JSON.stringify({ level: "info", msg: "prisma_stats_1min", ..._qStats }) +
        "\n",
    );
    _qStats = { total: 0, slow: 0, totalMs: 0 };
  }
}, 60_000);
// Don't keep the process alive just for stats
_statsTimer.unref();

function createPrismaClient() {
  const client = new PrismaClient({
    datasources: { db: { url: buildDatabaseUrl() } },
    log:
      env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

  // Логирует медленные запросы и аккумулирует минутную статистику для N+1 detection
  client.$use(async (params, next) => {
    const t0 = Date.now();
    const result = await next(params);
    const ms = Date.now() - t0;

    _qStats.total++;
    _qStats.totalMs += ms;

    if (ms > SLOW_QUERY_MS) {
      _qStats.slow++;
      process.stderr.write(
        JSON.stringify({
          level: "warn",
          msg: "slow_query",
          model: params.model,
          action: params.action,
          ms,
        }) + "\n",
      );
    }

    return result;
  });

  return client;
}

export const prisma = global.__prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
