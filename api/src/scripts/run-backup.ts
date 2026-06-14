import { runBackup } from "../services/backup.service.js";

const maxRetries = 3;
const retryDelayMs = 30_000;
const timeoutMs = 60 * 60 * 1000;

const timeout = setTimeout(() => {
  process.stderr.write("[backup] Timeout: exceeded one hour\n");
  process.exit(2);
}, timeoutMs);
timeout.unref();

for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
  try {
    const result = await runBackup();
    clearTimeout(timeout);
    process.stdout.write(
      `[backup] OK on attempt ${attempt}: ${result.filename}, ${result.sizeBytes} bytes\n`,
    );
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `[backup] Attempt ${attempt}/${maxRetries} failed: ${message}\n`,
    );
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

clearTimeout(timeout);
process.stderr.write("[backup] All attempts exhausted\n");
process.exit(1);
