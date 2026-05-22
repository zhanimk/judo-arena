/**
 * Judo-Arena API — entry point
 *
 * Fastify сервер с минимальной обвязкой: CORS, JWT, rate limit, health-check.
 * Бизнес-логика будет добавлена по этапам (дни 3–11 по PLAN.md).
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { authRoutes } from "./routes/auth.routes.js";
import { clubRoutes, clubAdjacentRoutes } from "./routes/club.routes.js";
import { tournamentRoutes, tournamentAdjacentRoutes } from "./routes/tournament.routes.js";
import { bracketTournamentRoutes, bracketDirectRoutes } from "./routes/bracket.routes.js";
import { matchRoutes, judgeAdjacentRoutes } from "./routes/match.routes.js";
import { adminRoutes, ratingRoutes, pdfRoutes, adminApplicationRoutes } from "./routes/admin.routes.js";
import { notificationRoutes } from "./routes/notification.routes.js";
import { attachSocketIO } from "./sockets/io.js";

async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        env.NODE_ENV === "production"
          ? undefined
          : {
              target: "pino-pretty",
              options: { colorize: true, translateTime: "HH:MM:ss" },
            },
    },
  });

  // Безопасность
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie, { secret: env.JWT_ACCESS_SECRET });
  // CORS: в dev разрешаем любой localhost (любой порт)
  //       в prod — только из CORS_ORIGIN
  await app.register(cors, {
    origin: (origin, cb) => {
      // SSR / curl запросы без Origin — разрешаем
      if (!origin) return cb(null, true);

      if (env.NODE_ENV === "development") {
        // В dev: любой localhost:* и 127.0.0.1:* разрешён
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return cb(null, true);
        }
      }

      // Иначе — белый список из ENV
      const allowed = env.CORS_ORIGIN.split(",").map((o) => o.trim());
      if (allowed.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked: " + origin), false);
    },
    credentials: true,
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  });

  // Health-check
  app.get("/health", async () => {
    const dbOk = await prisma.$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);
    return {
      status: dbOk ? "ok" : "degraded",
      service: "judo-arena-api",
      timestamp: new Date().toISOString(),
      db: dbOk ? "connected" : "disconnected",
    };
  });

  app.get("/", async () => ({
    service: "Judo-Arena API",
    version: "0.1.0",
    docs: "/health",
    endpoints: {
      auth: "/api/auth/*",
      clubs: "/api/clubs/*",
      groups: "/api/club-groups/:id",
      athletes: "/api/athletes/:id",
    },
  }));

  // ---- API routes ----
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(clubRoutes, { prefix: "/api/clubs" });
  await app.register(clubAdjacentRoutes, { prefix: "/api" });
  await app.register(tournamentRoutes, { prefix: "/api/tournaments" });
  await app.register(tournamentAdjacentRoutes, { prefix: "/api" });
  await app.register(bracketTournamentRoutes, { prefix: "/api/tournaments" });
  await app.register(bracketDirectRoutes, { prefix: "/api/brackets" });
  await app.register(matchRoutes, { prefix: "/api/matches" });
  await app.register(judgeAdjacentRoutes, { prefix: "/api" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(adminApplicationRoutes, { prefix: "/api/admin/applications" });
  await app.register(ratingRoutes, { prefix: "/api/ratings" });
  await app.register(pdfRoutes, { prefix: "/api/pdf" });
  await app.register(notificationRoutes, { prefix: "/api/notifications" });

  // ---- Socket.IO ----
  // Прикрепляем после ready, чтобы HTTP-сервер уже был создан
  await app.ready();
  await attachSocketIO(app);

  // TODO (по плану дни 10-11):
  // await app.register(ratingRoutes, { prefix: "/api/ratings" });

  // Graceful shutdown
  const close = async () => {
    app.log.info("Shutting down gracefully...");
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  return app;
}

async function start() {
  try {
    const app = await buildServer();
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
    app.log.info(`🥋 Judo-Arena API listening on http://${env.API_HOST}:${env.API_PORT}`);
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

start();
