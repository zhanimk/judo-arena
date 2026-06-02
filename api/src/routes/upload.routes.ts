import type { FastifyInstance } from "fastify";
import type {} from "@fastify/multipart";
import crypto from "node:crypto";
import { authenticate } from "../middlewares/authenticate.js";
import { storeFile } from "../lib/storage.js";
import { redis } from "../lib/redis.js";

// ── Per-user daily upload limits ──────────────────────────────────────────────
// Limits how many files a single authenticated user can upload per calendar day.
// Prevents a compromised account from filling storage with gigabytes of files.
const DAILY_IMAGE_LIMIT = 100; // images per user per day
const DAILY_AVATAR_LIMIT = 20; // avatars per user per day

/**
 * Returns a Redis key scoped to the current UTC calendar date.
 * TTL is set to 26 hours so it survives any clock skew without leaking across 2 full days.
 */
function dailyUploadKey(userId: string, type: "image" | "avatar"): string {
  const date = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  return `upload:daily:${type}:${userId}:${date}`;
}

async function checkAndIncrementDailyLimit(
  userId: string,
  type: "image" | "avatar",
  limit: number,
): Promise<{ allowed: boolean; current: number }> {
  const key = dailyUploadKey(userId, type);
  const current = await redis.incr(key);
  if (current === 1) {
    // First upload today — set TTL so the key auto-expires after 26 hours
    await redis.expire(key, 60 * 60 * 26);
  }
  return { allowed: current <= limit, current };
}

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// Magic bytes for image formats — prevents executable-disguised-as-image attacks
function hasValidMagicBytes(buf: Buffer, mime: string): boolean {
  if (buf.length < 4) return false;
  if (mime === "image/jpeg")
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === "image/png")
    return (
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    );
  if (mime === "image/gif")
    return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
  if (mime === "image/webp")
    return (
      buf.length >= 12 &&
      buf.slice(0, 4).toString() === "RIFF" &&
      buf.slice(8, 12).toString() === "WEBP"
    );
  return false;
}

// Max dimensions for uploaded images (prevent storing huge files)
const MAX_WIDTH = 2048;
// Max avatar size — smaller limit for profile pictures
const AVATAR_MAX = 512;

async function convertToWebP(
  buffer: Buffer,
  maxSize = MAX_WIDTH,
): Promise<Buffer> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(buffer)
      .resize(maxSize, maxSize, {
        fit: "inside", // maintain aspect ratio, never upscale
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 }) // quality 82 = good balance size/quality
      .toBuffer();
  } catch {
    // If sharp fails (unsupported format, etc.) — return original buffer
    return buffer;
  }
}

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/upload/image
   * Accepts JPG/PNG/WEBP/GIF, converts to WebP, resizes to ≤2048px.
   * Returns { url: string }
   */
  app.post(
    "/image",
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      // Per-user daily upload limit (protects storage from compromised accounts)
      const userId = request.user?.sub;
      if (userId) {
        const { allowed, current } = await checkAndIncrementDailyLimit(
          userId,
          "image",
          DAILY_IMAGE_LIMIT,
        );
        if (!allowed) {
          return reply.code(429).send({
            error: "DAILY_UPLOAD_LIMIT",
            message: `Күнделікті жүктеу лимиті (${DAILY_IMAGE_LIMIT}) асты. Ертең қайталаңыз.`,
            current,
            limit: DAILY_IMAGE_LIMIT,
          });
        }
      }

      const file = await request.file({
        limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
      });
      if (!file)
        return reply
          .code(400)
          .send({ error: "NO_FILE", message: "Файл жіберілмеді" });

      if (!allowedTypes.has(file.mimetype)) {
        return reply.code(400).send({
          error: "INVALID_FILE_TYPE",
          message: "Тек JPG, PNG, WEBP немесе GIF жүктеуге болады",
        });
      }

      const raw = await file.toBuffer();

      if (!hasValidMagicBytes(raw, file.mimetype)) {
        return reply
          .code(400)
          .send({
            error: "INVALID_FILE_CONTENT",
            message: "Файл мазмұны деklarацияланған типке сәйкес келмейді",
          });
      }

      // Convert to WebP (falls back to original if sharp unavailable / GIF)
      const isGif = file.mimetype === "image/gif";
      const converted = isGif ? raw : await convertToWebP(raw, MAX_WIDTH);
      const mimeOut = isGif ? "image/gif" : "image/webp";
      const ext = isGif ? ".gif" : ".webp";

      const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
      const url = await storeFile(`images/${filename}`, converted, mimeOut);

      // Log compression ratio for monitoring
      if (!isGif) {
        const ratio = ((1 - converted.length / raw.length) * 100).toFixed(1);
        app.log.debug(
          {
            original: raw.length,
            converted: converted.length,
            ratio: `${ratio}%`,
          },
          "image converted to webp",
        );
      }

      return reply.code(201).send({ url });
    },
  );

  /**
   * POST /api/upload/avatar
   * Same as /image but resizes to ≤512px (avatars are small).
   */
  app.post(
    "/avatar",
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      // Per-user daily avatar upload limit
      const userId = request.user?.sub;
      if (userId) {
        const { allowed, current } = await checkAndIncrementDailyLimit(
          userId,
          "avatar",
          DAILY_AVATAR_LIMIT,
        );
        if (!allowed) {
          return reply.code(429).send({
            error: "DAILY_UPLOAD_LIMIT",
            message: `Аватар жүктеу лимиті (${DAILY_AVATAR_LIMIT}/күн) асты. Ертең қайталаңыз.`,
            current,
            limit: DAILY_AVATAR_LIMIT,
          });
        }
      }

      const file = await request.file({
        limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max for avatars
      });
      if (!file)
        return reply
          .code(400)
          .send({ error: "NO_FILE", message: "Файл жіберілмеді" });

      if (!allowedTypes.has(file.mimetype)) {
        return reply.code(400).send({
          error: "INVALID_FILE_TYPE",
          message: "Тек JPG, PNG немесе WEBP жүктеуге болады",
        });
      }

      const raw = await file.toBuffer();

      if (!hasValidMagicBytes(raw, file.mimetype)) {
        return reply
          .code(400)
          .send({
            error: "INVALID_FILE_CONTENT",
            message: "Файл мазмұны деklarацияланған типке сәйкес келмейді",
          });
      }

      const converted = await convertToWebP(raw, AVATAR_MAX);

      const filename = `avatars/${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webp`;
      const url = await storeFile(filename, converted, "image/webp");

      return reply.code(201).send({ url });
    },
  );
}
