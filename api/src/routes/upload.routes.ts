import type { FastifyInstance } from "fastify";
import type {} from "@fastify/multipart";
import crypto from "node:crypto";
import { authenticate } from "../middlewares/authenticate.js";
import { storeFile } from "../lib/storage.js";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Max dimensions for uploaded images (prevent storing huge files)
const MAX_WIDTH = 2048;
const MAX_HEIGHT = 2048;
// Max avatar size — smaller limit for profile pictures
const AVATAR_MAX = 512;

async function convertToWebP(buffer: Buffer, maxSize = MAX_WIDTH): Promise<Buffer> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(buffer)
      .resize(maxSize, maxSize, {
        fit: "inside",         // maintain aspect ratio, never upscale
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
  app.post("/image", { preHandler: [authenticate] }, async (request, reply) => {
    const file = await request.file({
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
    });
    if (!file) return reply.code(400).send({ error: "NO_FILE", message: "Файл жіберілмеді" });

    if (!allowedTypes.has(file.mimetype)) {
      return reply.code(400).send({
        error: "INVALID_FILE_TYPE",
        message: "Тек JPG, PNG, WEBP немесе GIF жүктеуге болады",
      });
    }

    const raw = await file.toBuffer();

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
      app.log.debug({ original: raw.length, converted: converted.length, ratio: `${ratio}%` }, "image converted to webp");
    }

    return reply.code(201).send({ url });
  });

  /**
   * POST /api/upload/avatar
   * Same as /image but resizes to ≤512px (avatars are small).
   */
  app.post("/avatar", { preHandler: [authenticate] }, async (request, reply) => {
    const file = await request.file({
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max for avatars
    });
    if (!file) return reply.code(400).send({ error: "NO_FILE", message: "Файл жіберілмеді" });

    if (!allowedTypes.has(file.mimetype)) {
      return reply.code(400).send({
        error: "INVALID_FILE_TYPE",
        message: "Тек JPG, PNG немесе WEBP жүктеуге болады",
      });
    }

    const raw = await file.toBuffer();
    const converted = await convertToWebP(raw, AVATAR_MAX);

    const filename = `avatars/${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webp`;
    const url = await storeFile(filename, converted, "image/webp");

    return reply.code(201).send({ url });
  });
}
