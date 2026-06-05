/**
 * Judo-Arena API — entry point
 */

// Sentry must be initialised before all other imports
import { initSentry, Sentry } from "./lib/sentry.js";
initSentry();

import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import path from "node:path";
import { env } from "./lib/env.js";
import { requestContextStorage } from "./lib/request-context.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { authRoutes } from "./routes/auth.routes.js";
import { clubRoutes, clubAdjacentRoutes } from "./routes/club.routes.js";
import {
  tournamentRoutes,
  tournamentAdjacentRoutes,
} from "./routes/tournament.routes.js";
import {
  bracketTournamentRoutes,
  bracketDirectRoutes,
} from "./routes/bracket.routes.js";
import { matchRoutes, judgeAdjacentRoutes } from "./routes/match.routes.js";
import {
  adminRoutes,
  ratingRoutes,
  pdfRoutes,
  adminApplicationRoutes,
} from "./routes/admin.routes.js";
import { notificationRoutes } from "./routes/notification.routes.js";
import { uploadRoutes } from "./routes/upload.routes.js";
import { attachSocketIO } from "./sockets/io.js";
import { restoreActiveTimers } from "./services/osaekomi-timer.service.js";
import { verifySmtpConnection } from "./services/email.service.js";

async function buildServer() {
  const app = Fastify({
    // Attach unique request ID to every log line
    genReqId: () => randomUUID(),
    bodyLimit: 1024 * 1024, // 1 MB JSON limit; multipart has its own limit
    // Trust X-Forwarded-For from Cloudflare (1) + Render (1) = 2 hops
    // Without this, req.ip returns internal proxy IP — breaks rate limiting & audit logs
    trustProxy: env.NODE_ENV === "production" ? 2 : false,
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        env.NODE_ENV === "production"
          ? undefined
          : {
              target: "pino-pretty",
              options: { colorize: true, translateTime: "HH:MM:ss" },
            },
      // Serialise request with id + method + url for structured logging
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.socket?.remoteAddress,
          };
        },
      },
    },
  });

  // Populate AsyncLocalStorage with IP/UA/requestId for every request
  app.addHook("onRequest", (req, _reply, done) => {
    requestContextStorage.run(
      {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] ?? undefined,
        requestId: req.id as string,
      },
      done,
    );
  });

  // Log request-ID on every response for tracing
  app.addHook("onResponse", (req, reply, done) => {
    app.log.info(
      {
        reqId: req.id,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "request completed",
    );
    done();
  });

  // Report unhandled errors to Sentry with full request context
  app.addHook("onError", (req, _reply, error, done) => {
    if (env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setTag("requestId", req.id as string);
        scope.setExtra("url", req.url);
        scope.setExtra("method", req.method);
        scope.setExtra("ip", req.ip);
        // Attach authenticated user if available
        const user = (req as any).user;
        if (user?.sub) {
          scope.setUser({ id: user.sub, email: user.email, role: user.role });
        }
        Sentry.captureException(error);
      });
    }
    done();
  });

  // Attach Fastify instrumentation for automatic transaction/performance tracking
  if (env.SENTRY_DSN) {
    Sentry.setupFastifyErrorHandler(app as any);
  }

  // Безопасность
  await app.register(helmet, {
    contentSecurityPolicy: false, // API-only — no HTML served
    crossOriginEmbedderPolicy: false, // allow embedding from trusted origins
    referrerPolicy: { policy: "no-referrer" },
  });
  await app.register(cookie, { secret: env.JWT_ACCESS_SECRET });
  // CORS: dev — любой localhost; prod — белый список из CORS_ORIGIN
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (env.NODE_ENV === "development") {
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return cb(null, true);
        }
      }
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
  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE,
    },
  });
  if (!env.S3_BUCKET) {
    await app.register(fastifyStatic, {
      root: path.resolve(env.UPLOADS_DIR),
      prefix: "/uploads/",
      decorateReply: false,
    });
  }

  // OpenAPI docs — only in non-production
  if (env.NODE_ENV !== "production") {
    await app.register(swagger, {
      openapi: {
        info: {
          title: "Judo-Arena API",
          description:
            "REST API для управления дзюдо-турнирами, матчами и судейством",
          version: "0.1.0",
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
      },
    });
    await app.register(swaggerUI, {
      routePrefix: "/docs",
      uiConfig: { docExpansion: "list", deepLinking: true },
    });
  }

  // Health-check — используется E2E тестами, мониторингом и Render health checks
  const START_TIME = Date.now();
  app.get("/health", async (_req, reply) => {
    const [dbOk, redisOk] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      redis
        .ping()
        .then((r) => r === "PONG")
        .catch(() => false),
    ]);
    const status = dbOk && redisOk ? "ok" : "degraded";
    if (status === "degraded") reply.code(503);
    return {
      status,
      service: "judo-arena-api",
      version: env.APP_VERSION ?? "0.1.0",
      timestamp: new Date().toISOString(),
      uptimeSec: Math.floor((Date.now() - START_TIME) / 1000),
      db: dbOk ? "connected" : "disconnected",
      redis: redisOk ? "connected" : "disconnected",
    };
  });

  app.get("/", async () => ({
    service: "Judo-Arena API",
    version: env.APP_VERSION ?? "0.1.0",
    docs: env.NODE_ENV !== "production" ? "/docs" : undefined,
    health: "/health",
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
  await app.register(adminApplicationRoutes, {
    prefix: "/api/admin/applications",
  });
  await app.register(ratingRoutes, { prefix: "/api/ratings" });
  await app.register(pdfRoutes, { prefix: "/api/pdf" });
  await app.register(notificationRoutes, { prefix: "/api/notifications" });
  await app.register(uploadRoutes, { prefix: "/api/upload" });

  // ---- Socket.IO ----
  await app.ready();
  await attachSocketIO(app);

  // Восстановить серверные osaekomi-таймеры после рестарта
  restoreActiveTimers().catch((err) =>
    app.log.error(err, "Failed to restore osaekomi timers"),
  );

  // Проверить SMTP доступность (не блокирует старт)
  verifySmtpConnection().catch(() => {});

  // Graceful shutdown
  const close = async () => {
    app.log.info("Shutting down gracefully...");
    if (env.SENTRY_DSN) await Sentry.close(2000);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  return app;
}

// Catch any synchronous throw or unhandled promise rejection that escapes
// Fastify's error boundary — log it and exit so the process manager restarts cleanly.
process.on("uncaughtException", (err) => {
  process.stderr.write(`[uncaughtException] ${err.stack ?? err.message}\n`);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  process.stderr.write(`[unhandledRejection] ${reason}\n`);
  process.exit(1);
});

async function start() {
  try {
    const app = await buildServer();
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
    app.log.info(
      `🥋 Judo-Arena API listening on http://${env.API_HOST}:${env.API_PORT}`,
    );
  } catch (err) {
    process.stderr.write(
      `❌ Failed to start server: ${(err as Error).stack ?? err}\n`,
    );
    process.exit(1);
  }
}

start();
