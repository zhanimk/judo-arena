import type { FastifyInstance } from "fastify";
import type {} from "@fastify/multipart";
import crypto from "node:crypto";
import { authenticate } from "../middlewares/authenticate.js";
import { storeFile } from "../lib/storage.js";

const allowedTypes: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.post("/image", { preHandler: [authenticate] }, async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "NO_FILE", message: "Файл жіберілмеді" });

    const ext = allowedTypes[file.mimetype];
    if (!ext) {
      return reply.code(400).send({ error: "INVALID_FILE_TYPE", message: "Тек JPG, PNG, WEBP немесе GIF жүктеуге болады" });
    }

    const buffer = await file.toBuffer();
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    const url = await storeFile(`images/${filename}`, buffer, file.mimetype);

    return reply.code(201).send({ url });
  });
}
