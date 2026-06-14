#!/usr/bin/env node
/**
 * Bundle size check — fails CI if any chunk exceeds its limit.
 *
 * Limits are intentionally generous so routine dependency updates
 * don't break the build, but large accidental additions are caught.
 *
 * Run: node scripts/check-bundle-size.mjs
 * Requires the web app to be built first: npm run build -w web
 */

import { readdirSync, statSync } from "fs";
import { join, extname } from "path";

const DIST = new URL("../web/dist/client/", import.meta.url).pathname;

// Per-chunk limits in bytes
const LIMITS = [
  // Named vendor chunks (set in vite.config.ts manualChunks)
  { pattern: /vendor-react/,    maxKB: 320 },
  { pattern: /vendor-tanstack/, maxKB: 400 },
  { pattern: /vendor-ui/,       maxKB: 500 },
  { pattern: /vendor-i18n/,     maxKB: 150 },
  { pattern: /vendor-realtime/, maxKB: 100 },
  { pattern: /vendor-charts/,   maxKB: 600 },
  { pattern: /vendor/,          maxKB: 600 }, // catch-all vendor chunk
  // App entry — everything that isn't a vendor chunk
  { pattern: /index/,           maxKB: 550 },
];

// Total JS budget
const TOTAL_JS_LIMIT_KB = 3000;

function findJs(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...findJs(full));
    else if (extname(name) === ".js" && !name.endsWith(".map")) files.push(full);
  }
  return files;
}

let totalBytes = 0;
let failures = 0;
const rows = [];

for (const file of findJs(DIST)) {
  const bytes = statSync(file).size;
  totalBytes += bytes;
  const kb = Math.round(bytes / 1024);
  const name = file.replace(DIST, "");

  const limit = LIMITS.find((l) => l.pattern.test(name));
  if (limit && kb > limit.maxKB) {
    rows.push(`  FAIL  ${name}  ${kb} KB  (limit ${limit.maxKB} KB)`);
    failures++;
  } else {
    rows.push(`  OK    ${name}  ${kb} KB${limit ? `  (limit ${limit.maxKB} KB)` : ""}`);
  }
}

const totalKB = Math.round(totalBytes / 1024);
console.log("\nBundle size report:");
console.log(rows.join("\n"));
console.log(`\nTotal JS: ${totalKB} KB (limit ${TOTAL_JS_LIMIT_KB} KB)`);

if (totalKB > TOTAL_JS_LIMIT_KB) {
  console.error(`\nFAIL Total JS ${totalKB} KB exceeds limit ${TOTAL_JS_LIMIT_KB} KB`);
  failures++;
}

if (failures > 0) {
  console.error(`\n${failures} bundle size limit(s) exceeded. Review imports or raise the limit in scripts/check-bundle-size.mjs.`);
  process.exit(1);
}

console.log("\nAll bundle size checks passed.");
