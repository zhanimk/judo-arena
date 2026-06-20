/**
 * Загрузка и валидация переменных окружения через Zod.
 * Если переменной нет или она невалидна — приложение упадёт с понятной ошибкой при старте.
 */

import { z } from "zod";
import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, "../../../.env") });

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET слишком короткий (минимум 32 символа)"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET слишком короткий"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default("0.0.0.0"),

  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  // Email — либо Resend API (рекомендуется для prod), либо SMTP (Mailpit в dev)
  RESEND_API_KEY: z.string().optional(), // если задан — использует Resend API
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  EMAIL_FROM: z.string().default("Judo-Arena <noreply@judo-arena.kz>"),

  UPLOADS_DIR: z.string().default("./uploads"),
  MAX_FILE_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 1024 * 1024),
  BCRYPT_ROUNDS: z.coerce.number().int().positive().default(12),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  AUTH_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  SOCKET_CONNECTION_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  SOCKET_CONNECTION_LIMIT_WINDOW_SEC: z.coerce
    .number()
    .int()
    .positive()
    .default(60),

  APP_URL: z.string().default("http://localhost:3000"),

  // Prisma connection pool (tune for your hosting tier)
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),
  DB_POOL_TIMEOUT: z.coerce.number().int().positive().default(20),

  // FreedomPay (freedompay.kz) — платёжный шлюз для KZ
  FREEDOMPAY_MERCHANT_ID: z.string().optional(),
  FREEDOMPAY_SECRET_KEY: z.string().optional(),
  FREEDOMPAY_API_URL: z.string().url().default("https://api.freedompay.kz"),

  KASPI_CALLBACK_SECRET: z
    .string()
    .optional()
    .refine(
      (v) => process.env["NODE_ENV"] !== "production" || (v && v.length >= 32),
      {
        message:
          "KASPI_CALLBACK_SECRET обязателен в production (минимум 32 символа)",
      },
    ),

  SENTRY_DSN: z.string().url().optional(),

  // Резервное копирование (опционально)
  BACKUP_CRON: z.string().default("0 2 * * *"), // расписание cron (UTC)
  BACKUP_RETAIN_DAYS: z.coerce.number().int().positive().default(30),
  BACKUP_SCHEDULER_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  BACKUP_TRIGGER_SECRET: z.string().min(32).optional(),

  // Архивирование аудит-логов
  AUDIT_RETAIN_DAYS: z.coerce.number().int().min(30).default(90),

  // Web Push (VAPID) — опционально
  // Генерация: node -e "const wp = require('web-push'); const k = wp.generateVAPIDKeys(); console.log(JSON.stringify(k))"
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:admin@judo-arena.kz"),

  // SMS
  MOBIZON_API_KEY: z.string().optional(),

  // Версия приложения (задаётся при деплое через CI/CD)
  // Render: задай в Environment Variables: APP_VERSION=${{ github.sha }}
  APP_VERSION: z.string().default("0.1.0"),

  // S3-совместимое хранилище (опционально, иначе — локальная папка)
  S3_BUCKET: z.string().optional(),
  S3_PRIVATE_BUCKET: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_PUBLIC_URL: z.string().url().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_DEFAULT_REGION: z.string().default("us-east-1"),
});

const parsedRaw = schema.safeParse(process.env);

// Cross-field validation после базовой схемы
const parsed = parsedRaw.success
  ? (() => {
      const d = parsedRaw.data;
      const issues: { path: string[]; message: string }[] = [];

      if (d.VAPID_PUBLIC_KEY && !d.VAPID_PRIVATE_KEY) {
        issues.push({
          path: ["VAPID_PRIVATE_KEY"],
          message: "VAPID_PRIVATE_KEY обязателен если задан VAPID_PUBLIC_KEY",
        });
      }
      if (d.VAPID_PRIVATE_KEY && !d.VAPID_PUBLIC_KEY) {
        issues.push({
          path: ["VAPID_PUBLIC_KEY"],
          message: "VAPID_PUBLIC_KEY обязателен если задан VAPID_PRIVATE_KEY",
        });
      }
      if (d.JWT_ACCESS_SECRET === d.JWT_REFRESH_SECRET) {
        issues.push({
          path: ["JWT_REFRESH_SECRET"],
          message: "JWT_REFRESH_SECRET должен отличаться от JWT_ACCESS_SECRET",
        });
      }
      const hasS3Bucket = Boolean(d.S3_BUCKET || d.S3_PRIVATE_BUCKET);
      if (hasS3Bucket && !d.AWS_ACCESS_KEY_ID) {
        issues.push({
          path: ["AWS_ACCESS_KEY_ID"],
          message: "AWS_ACCESS_KEY_ID обязателен если задан S3 bucket",
        });
      }
      if (hasS3Bucket && !d.AWS_SECRET_ACCESS_KEY) {
        issues.push({
          path: ["AWS_SECRET_ACCESS_KEY"],
          message: "AWS_SECRET_ACCESS_KEY обязателен если задан S3 bucket",
        });
      }
      if (
        d.NODE_ENV === "production" &&
        d.S3_PUBLIC_URL &&
        !d.S3_PRIVATE_BUCKET
      ) {
        issues.push({
          path: ["S3_PRIVATE_BUCKET"],
          message:
            "S3_PRIVATE_BUCKET обязателен в production при публичном S3_PUBLIC_URL",
        });
      }
      if (d.NODE_ENV === "production") {
        const isLocalUrl = (value: string) =>
          /(^|\/\/)(localhost|127\.0\.0\.1)(:\d+)?($|[/?#])/.test(value);

        if (isLocalUrl(d.CORS_ORIGIN)) {
          issues.push({
            path: ["CORS_ORIGIN"],
            message: "CORS_ORIGIN в production должен быть публичным origin",
          });
        }
        if (isLocalUrl(d.APP_URL)) {
          issues.push({
            path: ["APP_URL"],
            message: "APP_URL в production должен быть публичным URL",
          });
        }
        if (!d.RESEND_API_KEY && d.SMTP_HOST === "localhost") {
          issues.push({
            path: ["RESEND_API_KEY"],
            message:
              "В production настройте RESEND_API_KEY или внешний SMTP_HOST",
          });
        }
        if (!d.S3_PRIVATE_BUCKET) {
          issues.push({
            path: ["S3_PRIVATE_BUCKET"],
            message:
              "S3_PRIVATE_BUCKET обязателен в production для документов и бэкапов",
          });
        }
        if (!d.BACKUP_TRIGGER_SECRET) {
          issues.push({
            path: ["BACKUP_TRIGGER_SECRET"],
            message:
              "BACKUP_TRIGGER_SECRET обязателен в production (минимум 32 символа)",
          });
        }
      }

      if (issues.length > 0) {
        return {
          success: false as const,
          error: { issues },
        };
      }
      return parsedRaw;
    })()
  : parsedRaw;
if (!parsed.success) {
  console.error("❌ Невалидные переменные окружения:");
  for (const issue of parsed.error.issues) {
    console.error(
      `  • ${(issue.path as string[]).join(".")}: ${issue.message}`,
    );
  }
  console.error("\n💡 Скопируй .env.example в .env и заполни значения.");
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
