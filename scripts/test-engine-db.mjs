#!/usr/bin/env node
// Disposable database test harness: never reads DATABASE_URL from the user's .env.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const suffix = `${process.pid}-${randomBytes(3).toString("hex")}`;
const pg = `judo-engine-pg-${suffix}`;
const redis = `judo-engine-redis-${suffix}`;
const password = randomBytes(24).toString("hex");
const owned = [];
let active;
let stopping = false;
function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, ...options });
    active = child;
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (active === child) active = undefined;
      if (code === 0) resolve(output.trim());
      else reject(new Error(`${command} failed (${signal ?? code})`));
    });
  });
}
async function cleanup() {
  for (const name of owned.reverse()) {
    try {
      await run("docker", ["rm", "-f", name], { stdio: "ignore" });
    } catch {}
  }
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
    active?.kill(signal);
  });
try {
  if (process.versions.node.split(".")[0] !== "22")
    throw new Error("Use Node 22: nvm use");
  await run("docker", ["info"], { stdio: "ignore" });
  for (const [name, port, image, extra] of [
    [
      pg,
      "5432",
      "postgres:16.9-alpine",
      [
        "-e",
        "POSTGRES_USER=judo",
        "-e",
        `POSTGRES_PASSWORD=${password}`,
        "-e",
        "POSTGRES_DB=judo_engine_test",
      ],
    ],
    [redis, "6379", "redis:7.4-alpine", []],
  ]) {
    if (stopping) throw new Error("Interrupted");
    owned.push(name);
    await run(
      "docker",
      [
        "run",
        "-d",
        "--rm",
        "--name",
        name,
        "-p",
        `127.0.0.1::${port}`,
        ...extra,
        image,
      ],
      { stdio: ["ignore", "pipe", "inherit"] },
    );
  }
  const mappedPort = (name, port) =>
    run("docker", [
      "inspect",
      "-f",
      `{{(index (index .NetworkSettings.Ports "${port}/tcp") 0).HostPort}}`,
      name,
    ]);
  const pgPort = await mappedPort(pg, 5432);
  const redisPort = await mappedPort(redis, 6379);
  for (let attempt = 0; ; attempt++) {
    if (stopping) throw new Error("Interrupted");
    try {
      await run(
        "docker",
        ["exec", pg, "pg_isready", "-U", "judo", "-d", "judo_engine_test"],
        { stdio: "ignore" },
      );
      await run("docker", ["exec", redis, "redis-cli", "ping"], {
        stdio: "ignore",
      });
      break;
    } catch (error) {
      if (attempt >= 60) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  const env = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: `postgresql://judo:${password}@127.0.0.1:${pgPort}/judo_engine_test`,
    REDIS_URL: `redis://127.0.0.1:${redisPort}`,
    JWT_ACCESS_SECRET: randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    BACKUP_SCHEDULER_ENABLED: "false",
    RESEND_API_KEY: "",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "9",
    S3_BUCKET: "",
    S3_PRIVATE_BUCKET: "",
    AWS_ACCESS_KEY_ID: "",
    AWS_SECRET_ACCESS_KEY: "",
  };
  console.log("Running engine tests against disposable PostgreSQL and Redis.");
  await run("npm", ["run", "prisma:migrate:deploy", "-w", "api"], {
    env,
    stdio: "inherit",
  });
  if (stopping) throw new Error("Interrupted");
  await run("npm", ["run", "test:engine:db", "-w", "api"], {
    env,
    stdio: "inherit",
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = stopping ? 130 : 1;
} finally {
  await cleanup();
}
