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
const DAILY_DOCUMENT_LIMIT = 30; // profile documents per user per day

/**
 * Returns a Redis key scoped to the current UTC calendar date.
 * TTL is set to 26 hours so it survives any clock skew without leaking across 2 full days.
 */
function dailyUploadKey(
  userId: string,
  type: "image" | "avatar" | "document",
): string {
  const date = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  return `upload:daily:${type}:${userId}:${date}`;
}

async function checkAndIncrementDailyLimit(
  userId: string,
  type: "image" | "avatar" | "document",
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

const allowedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const allowedDocumentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
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

function hasValidDocumentMagicBytes(buf: Buffer, mime: string): boolean {
  if (mime === "application/pdf") {
    return buf.length >= 5 && buf.slice(0, 5).toString() === "%PDF-";
  }
  return hasValidMagicBytes(buf, mime);
}

// Max dimensions for uploaded images (prevent storing huge files)
const MAX_WIDTH = 2048;
const AVATAR_WIDTH = 384;
const AVATAR_HEIGHT = 512;

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

class AvatarValidationError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AvatarValidationError";
  }
}

async function convertAvatarToPortraitWebP(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const image = sharp(buffer, { animated: false }).rotate();
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width < 300 || height < 400) {
    throw new AvatarValidationError(
      "AVATAR_TOO_SMALL",
      "Фото тым кішкентай. Кемінде 300×400 px, 3:4 форматта жүктеңіз.",
    );
  }

  const ratio = width / height;
  if (ratio < 0.68 || ratio > 0.82) {
    throw new AvatarValidationError(
      "AVATAR_BAD_RATIO",
      "Профиль фотосы 3:4 форматта болуы керек.",
    );
  }

  const sample = await sharp(buffer, { animated: false })
    .rotate()
    .resize(60, 80, { fit: "fill" })
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer();

  let checked = 0;
  let light = 0;
  const sampleWidth = 60;
  const sampleHeight = 80;
  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const upperHalf = y < sampleHeight * 0.55;
      const inTopBand = y < sampleHeight * 0.16;
      const inSideBand =
        upperHalf && (x < sampleWidth * 0.12 || x >= sampleWidth * 0.88);
      if (!inTopBand && !inSideBand) continue;

      const i = (y * sampleWidth + x) * 3;
      const r = sample[i] ?? 0;
      const g = sample[i + 1] ?? 0;
      const b = sample[i + 2] ?? 0;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      checked += 1;
      if (luma >= 215 && spread <= 55) light += 1;
    }
  }

  if (checked === 0 || light / checked < 0.68) {
    throw new AvatarValidationError(
      "AVATAR_BAD_BACKGROUND",
      "Фото ақ немесе өте ашық фонда болуы керек.",
    );
  }

  return sharp(buffer, { animated: false })
    .rotate()
    .resize(AVATAR_WIDTH, AVATAR_HEIGHT, {
      fit: "cover",
      position: "attention",
      background: "#ffffff",
    })
    .flatten({ background: "#ffffff" })
    .webp({ quality: 88, effort: 4 })
    .toBuffer();
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
        return reply.code(400).send({
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

      if (!allowedAvatarTypes.has(file.mimetype)) {
        return reply.code(400).send({
          error: "INVALID_FILE_TYPE",
          message: "Тек JPG, PNG немесе WEBP жүктеуге болады",
        });
      }

      const raw = await file.toBuffer();

      if (!hasValidMagicBytes(raw, file.mimetype)) {
        return reply.code(400).send({
          error: "INVALID_FILE_CONTENT",
          message: "Файл мазмұны деklarацияланған типке сәйкес келмейді",
        });
      }

      let converted: Buffer;
      try {
        converted = await convertAvatarToPortraitWebP(raw);
      } catch (error) {
        if (error instanceof AvatarValidationError) {
          return reply.code(400).send({
            error: error.code,
            message: error.message,
          });
        }
        request.log.warn({ err: error }, "avatar validation failed");
        return reply.code(400).send({
          error: "INVALID_AVATAR",
          message:
            "Фотоны өңдеу мүмкін болмады. Басқа JPG, PNG немесе WEBP файл жүктеңіз.",
        });
      }

      const filename = `avatars/${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webp`;
      const url = await storeFile(filename, converted, "image/webp");

      return reply.code(201).send({ url });
    },
  );

  /**
   * POST /api/upload/document
   * Accepts PDF/JPG/PNG/WEBP profile documents.
   * Returns { url, fileName, mimeType, size }
   */
  app.post(
    "/document",
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const userId = request.user?.sub;
      if (userId) {
        const { allowed, current } = await checkAndIncrementDailyLimit(
          userId,
          "document",
          DAILY_DOCUMENT_LIMIT,
        );
        if (!allowed) {
          return reply.code(429).send({
            error: "DAILY_UPLOAD_LIMIT",
            message: `Құжат жүктеу лимиті (${DAILY_DOCUMENT_LIMIT}/күн) асты. Ертең қайталаңыз.`,
            current,
            limit: DAILY_DOCUMENT_LIMIT,
          });
        }
      }

      const file = await request.file({
        limits: { fileSize: 15 * 1024 * 1024 },
      });
      if (!file)
        return reply
          .code(400)
          .send({ error: "NO_FILE", message: "Файл жіберілмеді" });

      if (!allowedDocumentTypes.has(file.mimetype)) {
        return reply.code(400).send({
          error: "INVALID_FILE_TYPE",
          message: "Тек PDF, JPG, PNG немесе WEBP жүктеуге болады",
        });
      }

      const raw = await file.toBuffer();
      if (!hasValidDocumentMagicBytes(raw, file.mimetype)) {
        return reply.code(400).send({
          error: "INVALID_FILE_CONTENT",
          message: "Файл мазмұны декларацияланған типке сәйкес келмейді",
        });
      }

      let content = raw;
      let mimeOut = file.mimetype;
      let ext = ".pdf";
      if (file.mimetype !== "application/pdf") {
        content = await convertToWebP(raw, MAX_WIDTH);
        mimeOut = "image/webp";
        ext = ".webp";
      }

      const safeName = (file.filename || "document")
        .replace(/[^\w.-]+/g, "_")
        .slice(0, 120);
      const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
      const url = await storeFile(`documents/${filename}`, content, mimeOut);

      return reply.code(201).send({
        url,
        fileName: safeName,
        mimeType: mimeOut,
        size: content.length,
      });
    },
  );
}
