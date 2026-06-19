import type { FastifyInstance } from "fastify";
import type {} from "@fastify/multipart";
import crypto from "node:crypto";
import {
  withRateLimit,
  authenticated,
  adminOnly,
} from "../lib/route-guards.js";
import { storeFile, storePrivateFile } from "../lib/storage.js";
import { redis } from "../lib/redis.js";
import { attachErrorHandler } from "../lib/error-handler.js";

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
      buf.slice(0, 4).equals(Buffer.from("RIFF")) &&
      buf.slice(8, 12).equals(Buffer.from("WEBP"))
    );
  return false;
}

function hasValidDocumentMagicBytes(buf: Buffer, mime: string): boolean {
  if (mime === "application/pdf") {
    return buf.length >= 5 && buf.slice(0, 5).equals(Buffer.from("%PDF-"));
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

async function convertAvatarToPortraitWebP(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
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
  attachErrorHandler(app);

  /**
   * POST /api/upload/image
   * Accepts JPG/PNG/WEBP/GIF, converts to WebP, resizes to ≤2048px.
   * Returns { url: string }
   */
  app.post(
    "/image",
    withRateLimit(authenticated, { max: 20, timeWindow: "1 minute" }),
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
          message: "Файл мазмұны көрсетілген файл түріне сәйкес келмейді",
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
    withRateLimit(authenticated, { max: 10, timeWindow: "1 minute" }),
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
          message: "Файл мазмұны көрсетілген файл түріне сәйкес келмейді",
        });
      }

      let converted: Buffer;
      try {
        converted = await convertAvatarToPortraitWebP(raw);
      } catch (error) {
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
   * POST /api/upload/regulation
   * Public tournament regulation uploaded by an administrator.
   */
  app.post(
    "/regulation",
    withRateLimit(adminOnly, { max: 10, timeWindow: "1 minute" }),
    async (request, reply) => {
      const file = await request.file({
        limits: { fileSize: 20 * 1024 * 1024 },
      });
      if (!file)
        return reply
          .code(400)
          .send({ error: "NO_FILE", message: "Файл жіберілмеді" });

      // Some browsers/OS file pickers report valid PDFs as application/octet-stream.
      // Trust the extension only to select validation; the PDF signature is checked below.
      const declaredMime =
        file.mimetype === "application/octet-stream" &&
        file.filename?.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : file.mimetype;

      if (!allowedDocumentTypes.has(declaredMime)) {
        return reply.code(400).send({
          error: "INVALID_FILE_TYPE",
          message: "Тек PDF, JPG, PNG немесе WEBP жүктеуге болады",
        });
      }

      const raw = await file.toBuffer();
      if (!hasValidDocumentMagicBytes(raw, declaredMime)) {
        return reply.code(400).send({
          error: "INVALID_FILE_CONTENT",
          message: "Файл мазмұны декларацияланған типке сәйкес келмейді",
        });
      }

      let content = raw;
      let mimeOut = declaredMime;
      let ext = ".pdf";
      if (declaredMime !== "application/pdf") {
        content = await convertToWebP(raw, MAX_WIDTH);
        mimeOut = "image/webp";
        ext = ".webp";
      }

      const originalName = (file.filename || "regulation.pdf")
        .replace(/[^\p{L}\p{N}._ -]+/gu, "_")
        .slice(0, 180);
      const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
      const url = await storeFile(
        `documents/regulations/${filename}`,
        content,
        mimeOut,
      );

      return reply.code(201).send({
        url,
        fileName: originalName,
        mimeType: mimeOut,
        size: content.length,
      });
    },
  );

  /**
   * POST /api/upload/document
   * Accepts PDF/JPG/PNG/WEBP profile documents.
   * Returns { url, fileName, mimeType, size }
   */
  app.post(
    "/document",
    withRateLimit(authenticated, { max: 10, timeWindow: "1 minute" }),
    async (request, reply) => {
      const userId = request.user!.sub;
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
      const url = await storePrivateFile(
        `documents/${userId}/${filename}`,
        content,
        mimeOut,
      );

      return reply.code(201).send({
        url,
        fileName: safeName,
        mimeType: mimeOut,
        size: content.length,
      });
    },
  );
}
