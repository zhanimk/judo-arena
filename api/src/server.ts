/**
 * Judo-Arena API — entry point
 */

// Sentry must be initialised before all other imports
import { initSentry, Sentry } from "./lib/sentry.js";
initSentry();

import { randomUUID, timingSafeEqual } from "node:crypto";
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
import { paymentRoutes } from "./routes/payment.routes.js";
import { attachSocketIO } from "./sockets/io.js";
import { restoreActiveTimers } from "./services/osaekomi-timer.service.js";
import { restoreGoldenScoreTimers } from "./services/golden-score-timer.service.js";
import { verifySmtpConnection } from "./services/email.service.js";
import {
  runBackupSafe,
  startBackupScheduler,
} from "./services/backup.service.js";
import { startPendingResultCleanup } from "./services/pending-result-cleanup.service.js";
import { startAuditArchival } from "./services/audit-archival.service.js";
import { env as appEnv } from "./lib/env.js";
import {
  savePushSubscription,
  removePushSubscription,
} from "./services/push.service.js";
import { authenticate } from "./middlewares/authenticate.js";
import { issueCsrfToken } from "./middlewares/csrf.js";

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
        if (req.user?.sub) {
          scope.setUser({
            id: req.user.sub,
            email: req.user.email,
            role: req.user.role,
          });
        }
        Sentry.captureException(error);
      });
    }
    done();
  });

  // Attach Fastify instrumentation for automatic transaction/performance tracking
  if (env.SENTRY_DSN) {
    // FastifyInstance совместим с типом Sentry ожидает — приведение необходимо из-за upstream типов
    Sentry.setupFastifyErrorHandler(
      app as Parameters<typeof Sentry.setupFastifyErrorHandler>[0],
    );
  }

  // Безопасность — HTTP Security Headers
  await app.register(helmet, {
    // CSP отключён для API-роутов (/api/*): они отдают JSON, не HTML.
    // Swagger UI имеет собственный CSP через @fastify/swagger-ui.
    // Если добавить SSR в будущем — включить CSP здесь с nonce.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false, // разрешает embedding с доверенных origins
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // HSTS: принудительный HTTPS на 1 год (includeSubDomains + preload)
    strictTransportSecurity:
      env.NODE_ENV === "production"
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    // X-Content-Type-Options: nosniff — предотвращает MIME-sniffing
    // X-Frame-Options: DENY — предотвращает clickjacking
    // X-XSS-Protection: 0 — современные браузеры не используют (может создавать уязвимости)
    // Все эти заголовки включены helmet по умолчанию.
  });

  // Дополнительный заголовок: Permissions-Policy (ограничивает API браузера)
  app.addHook("onSend", async (_req, reply) => {
    reply.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
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

      // Allow Vercel preview URLs, Lovable preview URLs, and Render URLs automatically
      if (
        /^https:\/\/.*\.vercel\.app$/.test(origin) ||
        /^https:\/\/.*\.onrender\.com$/.test(origin) ||
        /^https:\/\/.*\.lovable\.app$/.test(origin)
      ) {
        return cb(null, true);
      }

      const allowed = env.CORS_ORIGIN.split(",").map((o) => o.trim());
      if (allowed.includes(origin)) return cb(null, true);

      // Return false safely without throwing an error to prevent Fastify 500 crashes
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    allowList: (req) =>
      env.NODE_ENV !== "production" && req.headers["x-e2e-test"] === "1",
    // Authenticated requests are keyed by userId — prevents compromised accounts
    // from bypassing IP-based limits by rotating proxies.
    keyGenerator: (req) =>
      (req as typeof req & { user?: { sub: string } }).user?.sub ?? req.ip,
  });
  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE,
    },
  });
  if (!env.S3_BUCKET) {
    await app.register(fastifyStatic, {
      root: path.resolve(env.UPLOADS_DIR, "images"),
      prefix: "/uploads/images/",
      decorateReply: false,
    });
    await app.register(fastifyStatic, {
      root: path.resolve(env.UPLOADS_DIR, "avatars"),
      prefix: "/uploads/avatars/",
      decorateReply: false,
    });
    // Only public tournament regulations are exposed as static files.
    // User documents are stored under documents/{userId}/ and must be served
    // exclusively through authenticated download routes.
    await app.register(fastifyStatic, {
      root: path.resolve(env.UPLOADS_DIR, "documents", "regulations"),
      prefix: "/uploads/documents/regulations/",
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
    const TIMEOUT = 3000; // 3 сек на каждую проверку

    const withTimeout = <T>(p: Promise<T>, fallback: T): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((res) => setTimeout(() => res(fallback), TIMEOUT)),
      ]);

    // Проверяем S3 наличием bucket (только если настроен)
    const checkS3 = async (): Promise<"ok" | "not_configured" | "error"> => {
      const buckets = [
        ...new Set([env.S3_BUCKET, env.S3_PRIVATE_BUCKET].filter(Boolean)),
      ] as string[];
      if (buckets.length === 0) return "not_configured";
      try {
        const { S3Client, HeadBucketCommand } =
          await import("@aws-sdk/client-s3");
        const s3 = new S3Client({
          region: env.AWS_DEFAULT_REGION,
          endpoint: env.S3_ENDPOINT,
          forcePathStyle: Boolean(env.S3_ENDPOINT),
          credentials: env.AWS_ACCESS_KEY_ID
            ? {
                accessKeyId: env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? "",
              }
            : undefined,
        });
        await Promise.all(
          buckets.map((bucket) =>
            s3.send(new HeadBucketCommand({ Bucket: bucket })),
          ),
        );
        return "ok";
      } catch {
        return "error";
      }
    };

    // Проверяем email (только валидность конфигурации, не отправляем)
    const checkEmail = (): "resend" | "smtp" | "not_configured" => {
      if (env.RESEND_API_KEY) return "resend";
      if (env.SMTP_HOST && env.SMTP_HOST !== "localhost") return "smtp";
      return "not_configured";
    };

    const [dbOk, redisOk, s3Status] = await Promise.all([
      withTimeout(
        prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
        false,
      ),
      withTimeout(
        redis
          .ping()
          .then((r) => r === "PONG")
          .catch(() => false),
        false,
      ),
      withTimeout(checkS3(), "error" as const),
    ]);

    const emailStatus = checkEmail();
    const coreOk = dbOk && redisOk;
    const status = coreOk ? "ok" : "degraded";
    if (!coreOk) reply.code(503);

    return {
      status,
      service: "judo-arena-api",
      version: env.APP_VERSION ?? "0.1.0",
      timestamp: new Date().toISOString(),
      uptimeSec: Math.floor((Date.now() - START_TIME) / 1000),
      checks: {
        db: dbOk ? "ok" : "error",
        redis: redisOk ? "ok" : "error",
        s3: s3Status,
        email: emailStatus,
      },
    };
  });

  app.get("/", async () => ({
    service: "Judo-Arena API",
    version: env.APP_VERSION ?? "0.1.0",
    docs: env.NODE_ENV !== "production" ? "/docs" : undefined,
    health: "/health",
  }));

  // ВРЕМЕННЫЙ ЭНДПОИНТ ДЛЯ СБРОСА БАЗЫ ДАННЫХ НА RENDER
  app.get("/api/force-sync-db", async (_req, reply) => {
    try {
      const { execSync } = await import("node:child_process");
      // Используем db push --force-reset, чтобы удалить все данные и 100% подогнать схему
      const output = execSync("npx prisma db push --force-reset", {
        encoding: "utf-8",
      });
      return reply.send({ success: true, output });
    } catch (e: any) {
      return reply.code(500).send({
        success: false,
        error: e.message,
        stdout: e.stdout,
        stderr: e.stderr,
      });
    }
  });

  app.post(
    "/api/system/backup",
    {
      config: { rateLimit: { max: 3, timeWindow: "1 hour" } },
    },
    async (request, reply) => {
      if (!env.BACKUP_TRIGGER_SECRET) {
        return reply.code(503).send({ error: "BACKUP_TRIGGER_NOT_CONFIGURED" });
      }

      const supplied = request.headers["x-backup-secret"];
      if (
        typeof supplied !== "string" ||
        !secretsEqual(supplied, env.BACKUP_TRIGGER_SECRET)
      ) {
        return reply.code(401).send({ error: "UNAUTHORIZED" });
      }

      const result = await runBackupSafe((message) =>
        request.log.error(message),
      );
      if (!result) {
        return reply.code(500).send({ error: "BACKUP_FAILED" });
      }
      return reply.send(result);
    },
  );

  // CSRF token endpoint — клиент вызывает при загрузке приложения
  // и сохраняет токен для отправки в заголовке x-csrf-token
  app.get(
    "/api/auth/csrf-token",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (_req, reply) => {
      const token = issueCsrfToken(reply);
      return { csrfToken: token };
    },
  );

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
  await app.register(paymentRoutes, { prefix: "/api/payments" });

  // ─── Web Push endpoints (must be registered before app.ready()) ──────────
  app.get("/push/vapid-public-key", async (_req, reply) => {
    if (!appEnv.VAPID_PUBLIC_KEY) {
      return reply.code(503).send({ error: "PUSH_NOT_CONFIGURED" });
    }
    return reply.send({ publicKey: appEnv.VAPID_PUBLIC_KEY });
  });

  app.post(
    "/push/subscribe",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { z } = await import("zod");
      const schema = z.object({
        endpoint: z.string().url(),
        keys: z.object({ p256dh: z.string(), auth: z.string() }),
      });
      const sub = schema.parse(request.body);
      const ua = request.headers["user-agent"] ?? undefined;
      await savePushSubscription(
        request.user!.sub,
        sub,
        typeof ua === "string" ? ua : undefined,
      );
      return reply.code(201).send({ ok: true });
    },
  );

  app.delete(
    "/push/subscribe",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { z } = await import("zod");
      const { endpoint } = z
        .object({ endpoint: z.string() })
        .parse(request.body);
      await removePushSubscription(request.user!.sub, endpoint);
      return reply.code(204).send();
    },
  );

  // ---- Socket.IO (app.ready() finalises route registration) ----
  await app.ready();
  await attachSocketIO(app);

  // Восстановить серверные osaekomi-таймеры после рестарта
  restoreActiveTimers().catch((err) =>
    app.log.error(err, "Failed to restore osaekomi timers"),
  );

  // Восстановить golden score таймеры после рестарта
  restoreGoldenScoreTimers().catch((err) =>
    app.log.error(err, "Failed to restore golden score timers"),
  );

  // Проверить SMTP доступность (не блокирует старт)
  verifySmtpConnection().catch(() => {});

  // Запустить планировщик резервного копирования (только если S3 настроен)
  startBackupScheduler((msg) => app.log.info(msg));

  // Автоматически отменять "зависшие" pending results старше 72 часов
  startPendingResultCleanup((msg) => app.log.info(msg));

  // Ежесуточная очистка старых audit logs (по умолчанию старше 90 дней)
  startAuditArchival((msg) => app.log.info(msg));

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

function secretsEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
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
