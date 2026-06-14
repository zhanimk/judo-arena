import { afterAll, describe, expect, it, vi } from "vitest";
import { rm } from "node:fs/promises";

const state = vi.hoisted(() => ({
  uploadsDir: `/tmp/judo-arena-storage-${process.pid}`,
}));

vi.mock("../../src/lib/env.js", () => ({
  env: {
    UPLOADS_DIR: state.uploadsDir,
    S3_BUCKET: undefined,
    S3_PRIVATE_BUCKET: undefined,
    S3_ENDPOINT: undefined,
    S3_PUBLIC_URL: undefined,
    AWS_ACCESS_KEY_ID: undefined,
    AWS_SECRET_ACCESS_KEY: undefined,
    AWS_DEFAULT_REGION: "us-east-1",
  },
}));

import {
  readPrivateFile,
  storeFile,
  storePrivateFile,
} from "../../src/lib/storage.js";

afterAll(async () => {
  await rm(state.uploadsDir, { force: true, recursive: true });
});

describe("private file storage", () => {
  it("stores documents behind an opaque private reference", async () => {
    const content = Buffer.from("private document");
    const reference = await storePrivateFile(
      "documents/user-1/document.pdf",
      content,
      "application/pdf",
    );

    expect(reference).toBe("private:documents/user-1/document.pdf");
    await expect(readPrivateFile(reference)).resolves.toEqual(content);
  });

  it("keeps public images on the public uploads path", async () => {
    const url = await storeFile(
      "images/logo.png",
      Buffer.from("image"),
      "image/png",
    );

    expect(url).toBe("/uploads/images/logo.png");
  });

  it("rejects traversal and non-document private reads", async () => {
    await expect(
      storePrivateFile("../secrets.txt", Buffer.from("x"), "text/plain"),
    ).rejects.toThrow("Invalid storage path");
    await expect(readPrivateFile("private:images/logo.png")).rejects.toThrow(
      "Invalid private storage reference",
    );
  });
});
