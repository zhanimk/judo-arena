/**
 * Абстракция хранилища файлов.
 * Если заданы S3_BUCKET + S3_ENDPOINT (или AWS_DEFAULT_REGION) — использует S3.
 * Иначе — сохраняет локально в UPLOADS_DIR.
 *
 * Env:
 *   S3_BUCKET       — публичные изображения и аватары
 *   S3_PRIVATE_BUCKET — документы и резервные копии
 *   S3_ENDPOINT     — для S3-совместимых (Cloudflare R2, MinIO): https://...
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
 *   AWS_DEFAULT_REGION (default: us-east-1)
 *   S3_PUBLIC_URL   — публичный базовый URL файлов (напр. https://cdn.example.com)
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env.js";

// Lazy-import S3 client to avoid overhead when not configured
let s3Client: import("@aws-sdk/client-s3").S3Client | null = null;

async function getS3(): Promise<import("@aws-sdk/client-s3").S3Client | null> {
  if (!env.S3_BUCKET && !env.S3_PRIVATE_BUCKET) return null;
  if (s3Client) return s3Client;

  const { S3Client } = await import("@aws-sdk/client-s3");
  s3Client = new S3Client({
    region: env.AWS_DEFAULT_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: Boolean(env.S3_ENDPOINT), // needed for MinIO / R2
    credentials: env.AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? "",
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
  if (env.S3_BUCKET) {
    const client = await getS3();
    if (client) {
      return storeS3(client, subPath, buffer, mimeType);
    }
  }
  return storeLocal(subPath, buffer);
}

/**
 * Save a private file and return an opaque storage reference.
 * Private references must only be resolved by an authenticated API route.
 */
export async function storePrivateFile(
  subPath: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const safePath = normalizeStoragePath(subPath);
  const bucket = privateBucket();
  if (bucket) {
    const client = await getS3();
    if (!client) throw new Error("Private S3 storage is not configured");
    await storeS3Object(client, bucket, safePath, buffer, mimeType);
  } else {
    await writeLocal(safePath, buffer);
  }
  return `private:${safePath}`;
}

export async function readPrivateFile(reference: string): Promise<Buffer> {
  const subPath = storagePathFromReference(reference);
  if (!subPath.startsWith("documents/")) {
    throw new Error("Invalid private storage reference");
  }

  const bucket = privateBucket();
  if (bucket) {
    const client = await getS3();
    if (!client) throw new Error("Private S3 storage is not configured");
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: subPath }),
    );
    if (!response.Body) throw new Error("Stored file is empty");
    return Buffer.from(await response.Body.transformToByteArray());
  }

  return readFile(resolveLocalPath(subPath));
}

async function storeLocal(subPath: string, buffer: Buffer): Promise<string> {
  const safePath = normalizeStoragePath(subPath);
  await writeLocal(safePath, buffer);
  return `/uploads/${safePath}`;
}

async function storeS3(
  client: import("@aws-sdk/client-s3").S3Client,
  subPath: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  await storeS3Object(client, env.S3_BUCKET!, subPath, buffer, mimeType);

  const publicBase = env.S3_PUBLIC_URL?.replace(/\/$/, "");
  if (publicBase) return `${publicBase}/${subPath}`;

  return `https://${env.S3_BUCKET}.s3.${env.AWS_DEFAULT_REGION}.amazonaws.com/${subPath}`;
}

async function storeS3Object(
  client: import("@aws-sdk/client-s3").S3Client,
  bucket: string,
  subPath: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: subPath,
      Body: buffer,
      ContentType: mimeType,
      // ACL omitted: bucket policy controls access (private by default).
      // Public access is provided via S3_PUBLIC_URL (CDN/R2 public domain).
    }),
  );
}

function privateBucket(): string | undefined {
  return env.S3_PRIVATE_BUCKET ?? env.S3_BUCKET;
}

async function writeLocal(subPath: string, buffer: Buffer): Promise<void> {
  const fullPath = resolveLocalPath(subPath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
}

function resolveLocalPath(subPath: string): string {
  const root = path.resolve(env.UPLOADS_DIR);
  const fullPath = path.resolve(root, normalizeStoragePath(subPath));
  if (fullPath !== root && !fullPath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Storage path escapes uploads directory");
  }
  return fullPath;
}

function normalizeStoragePath(subPath: string): string {
  const normalized = subPath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").includes("..")) {
    throw new Error("Invalid storage path");
  }
  return normalized;
}

function storagePathFromReference(reference: string): string {
  if (reference.startsWith("private:")) {
    return normalizeStoragePath(reference.slice("private:".length));
  }
  if (reference.startsWith("/uploads/")) {
    return normalizeStoragePath(reference.slice("/uploads/".length));
  }

  const publicBase = env.S3_PUBLIC_URL?.replace(/\/$/, "");
  if (publicBase && reference.startsWith(`${publicBase}/`)) {
    return normalizeStoragePath(reference.slice(publicBase.length + 1));
  }

  if (reference.startsWith("http://") || reference.startsWith("https://")) {
    return normalizeStoragePath(new URL(reference).pathname);
  }

  throw new Error("Unsupported storage reference");
}
