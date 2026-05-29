/**
 * Абстракция хранилища файлов.
 * Если заданы S3_BUCKET + S3_ENDPOINT (или AWS_DEFAULT_REGION) — использует S3.
 * Иначе — сохраняет локально в UPLOADS_DIR.
 *
 * Env:
 *   S3_BUCKET       — имя бакета
 *   S3_ENDPOINT     — для S3-совместимых (Cloudflare R2, MinIO): https://...
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
 *   AWS_DEFAULT_REGION (default: us-east-1)
 *   S3_PUBLIC_URL   — публичный базовый URL файлов (напр. https://cdn.example.com)
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env.js";

// Lazy-import S3 client to avoid overhead when not configured
let s3Client: import("@aws-sdk/client-s3").S3Client | null = null;

function getS3(): import("@aws-sdk/client-s3").S3Client | null {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) return null;
  if (s3Client) return s3Client;

  const { S3Client } = require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");
  s3Client = new S3Client({
    region: process.env.AWS_DEFAULT_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT), // needed for MinIO / R2
    credentials: process.env.AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
        }
      : undefined,
  });
  return s3Client;
}

/**
 * Сохранить файл. Возвращает публичный URL.
 * @param subPath  путь внутри хранилища, напр. "images/abc123.jpg"
 * @param buffer   содержимое файла
 * @param mimeType MIME-тип
 */
export async function storeFile(
  subPath: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const client = getS3();
  if (client) {
    return storeS3(client, subPath, buffer, mimeType);
  }
  return storeLocal(subPath, buffer);
}

async function storeLocal(subPath: string, buffer: Buffer): Promise<string> {
  const fullPath = path.resolve(env.UPLOADS_DIR, subPath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  return `/uploads/${subPath}`;
}

async function storeS3(
  client: import("@aws-sdk/client-s3").S3Client,
  subPath: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const bucket = process.env.S3_BUCKET!;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: subPath,
      Body: buffer,
      ContentType: mimeType,
      ACL: "public-read",
    }),
  );

  const publicBase = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
  if (publicBase) return `${publicBase}/${subPath}`;

  // Default AWS S3 URL
  const region = process.env.AWS_DEFAULT_REGION ?? "us-east-1";
  return `https://${bucket}.s3.${region}.amazonaws.com/${subPath}`;
}
