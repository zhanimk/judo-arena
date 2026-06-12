/**
 * Backup Service — автоматическое резервное копирование PostgreSQL.
 *
 * Запускает pg_dump, сжимает gzip, загружает в S3 (если настроен).
 * Ротация: удаляет S3-объекты старше BACKUP_RETAIN_DAYS.
 *
 * Расписание: каждую ночь в 02:00 UTC (настраивается через BACKUP_CRON).
 * Ручной запуск: POST /api/admin/backup (ADMIN only) или системный trigger.
 */

import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import { env } from "../lib/env.js";

export interface BackupResult {
  filename: string;
  sizeBytes: number;
  s3Key: string | null;
  durationMs: number;
}

/**
 * Выполнить один бэкап. Возвращает метаданные или бросает ошибку.
 */
export async function runBackup(): Promise<BackupResult> {
  const started = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup_${timestamp}.sql.gz`;

  process.stdout.write(`[backup] Starting: ${filename}\n`);

  // --- 1. Получить дамп через pg_dump ---
  const url = new URL(env.DATABASE_URL);
  const pgArgs = [
    "-h",
    url.hostname,
    "-p",
    url.port || "5432",
    "-U",
    url.username,
    "-d",
    url.pathname.slice(1),
    "--no-password",
    "--format=plain",
    "--no-owner",
    "--no-acl",
  ];

  // Устанавливаем PGPASSWORD через env
  const pgEnv = { ...process.env, PGPASSWORD: url.password };

  // Запускаем pg_dump в потоковом режиме через spawn
  const { spawn } = await import("node:child_process");
  const pgDump = spawn("pg_dump", pgArgs, { env: pgEnv });
  let stderr = "";
  pgDump.stderr.on("data", (data: Buffer) => {
    stderr += data.toString();
  });
  const exitCodePromise = new Promise<number>((resolve) => {
    pgDump.on("close", resolve);
    pgDump.on("error", () => resolve(1));
  });

  const chunks: Buffer[] = [];
  let totalSize = 0;

  // Pipe: pg_dump stdout → gzip → buffer
  const gzip = createGzip({ level: 6 });
  const collector = new Writable({
    write(chunk: Buffer, _enc, cb) {
      chunks.push(chunk);
      totalSize += chunk.length;
      cb();
    },
  });

  await pipeline(pgDump.stdout, gzip, collector);

  // Проверяем код выхода
  const exitCode = await exitCodePromise;

  if (exitCode !== 0) {
    throw new Error(`pg_dump failed (exit ${exitCode}): ${stderr}`);
  }

  if (totalSize === 0) {
    throw new Error("pg_dump produced empty output");
  }

  const buf = Buffer.concat(chunks);
  process.stdout.write(
    `[backup] Dump complete: ${(buf.length / 1024 / 1024).toFixed(2)} MB\n`,
  );

  // --- 2. Загрузить в S3 (если настроен) ---
  let s3Key: string | null = null;

  const backupBucket = env.S3_PRIVATE_BUCKET ?? env.S3_BUCKET;
  if (backupBucket && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    const {
      S3Client,
      PutObjectCommand,
      ListObjectsV2Command,
      DeleteObjectsCommand,
    } = await import("@aws-sdk/client-s3");

    const client = new S3Client({
      region: env.AWS_DEFAULT_REGION,
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
      forcePathStyle: Boolean(env.S3_ENDPOINT),
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });

    s3Key = `backups/${filename}`;

    await client.send(
      new PutObjectCommand({
        Bucket: backupBucket,
        Key: s3Key,
        Body: buf,
        ContentType: "application/gzip",
        ContentEncoding: "gzip",
        Metadata: {
          "backup-timestamp": timestamp,
          "db-size-bytes": String(totalSize),
        },
      }),
    );

    process.stdout.write(
      `[backup] Uploaded to s3://${backupBucket}/${s3Key}\n`,
    );

    // --- 3. Ротация S3 — удалить объекты старше BACKUP_RETAIN_DAYS ---
    const retainDays = env.BACKUP_RETAIN_DAYS;
    const cutoff = new Date(Date.now() - retainDays * 24 * 60 * 60 * 1000);

    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: backupBucket,
        Prefix: "backups/backup_",
      }),
    );

    const toDelete = (list.Contents ?? [])
      .filter((obj) => obj.Key && obj.LastModified && obj.LastModified < cutoff)
      .map((obj) => ({ Key: obj.Key! }));

    if (toDelete.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: backupBucket,
          Delete: { Objects: toDelete },
        }),
      );
      process.stdout.write(
        `[backup] Rotated ${toDelete.length} old backup(s) from S3\n`,
      );
    }
  } else {
    process.stdout.write("[backup] S3 not configured — skipping upload\n");
  }

  const durationMs = Date.now() - started;
  process.stdout.write(`[backup] Done in ${(durationMs / 1000).toFixed(1)}s\n`);

  return { filename, sizeBytes: buf.length, s3Key, durationMs };
}

/**
 * Запустить резервное копирование без выброса исключений.
 * Используется в scheduler и в route handler.
 */
export async function runBackupSafe(
  log: (msg: string) => void = console.error,
): Promise<BackupResult | null> {
  try {
    return await runBackup();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`[backup] ERROR: ${msg}`);
    return null;
  }
}

/**
 * Запустить планировщик резервного копирования.
 * Выполняется сразу при старте и затем каждый день в 02:00 UTC.
 * Безопасен: ошибки не ломают сервер.
 */
export function startBackupScheduler(log: (msg: string) => void): void {
  if (!env.BACKUP_SCHEDULER_ENABLED) {
    log("[backup] In-process scheduler disabled");
    return;
  }
  if (!env.S3_PRIVATE_BUCKET && !env.S3_BUCKET) {
    log("[backup] S3 bucket not set — backup scheduler disabled");
    return;
  }

  const CRON_SCHEDULE = env.BACKUP_CRON;

  // Динамический импорт node-cron
  import("node-cron")
    .then(({ default: cron }) => {
      cron.schedule(
        CRON_SCHEDULE,
        async () => {
          log(`[backup] Scheduled backup started (cron: ${CRON_SCHEDULE})`);
          await runBackupSafe(log);
        },
        { timezone: "UTC" },
      );
      log(`[backup] Scheduler registered: ${CRON_SCHEDULE} UTC`);
    })
    .catch((err: unknown) => {
      log(
        `[backup] Failed to load node-cron: ${err instanceof Error ? err.message : err}`,
      );
    });
}
