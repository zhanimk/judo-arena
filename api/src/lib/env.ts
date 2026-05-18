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
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET слишком короткий (минимум 32 символа)"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET слишком короткий"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default("0.0.0.0"),

  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  EMAIL_FROM: z.string().default("Judo-Arena <noreply@judo-arena.kz>"),

  UPLOADS_DIR: z.string().default("./uploads"),
  BCRYPT_ROUNDS: z.coerce.number().int().positive().default(12),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Невалидные переменные окружения:");
  for (const issue of parsed.error.issues) {
    console.error(`  • ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("\n💡 Скопируй .env.example в .env и заполни значения.");
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
