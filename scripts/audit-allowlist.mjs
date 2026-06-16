import { spawnSync } from "node:child_process";

const severityRank = new Map([
  ["info", 0],
  ["low", 1],
  ["moderate", 2],
  ["high", 3],
  ["critical", 4],
]);

const threshold = process.argv[2] ?? "high";
const minimumRank = severityRank.get(threshold);

if (minimumRank === undefined) {
  console.error(`Unknown audit threshold: ${threshold}`);
  process.exit(2);
}

// Temporary allowlist for upstream advisories that currently have no
// non-breaking fix in Socket.IO/Cloudflare packages.
const allowedAdvisories = new Set([
  "https://github.com/advisories/GHSA-96hv-2xvq-fx4p", // ws < 8.21.0
  "https://github.com/advisories/GHSA-gv7w-rqvm-qjhr", // esbuild < 0.28.1
]);

const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: false,
});

if (!result.stdout) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch (error) {
  console.error("Failed to parse npm audit JSON output.");
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  console.error(error);
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const memo = new Map();

function isAllowed(name, seen = new Set()) {
  if (memo.has(name)) return memo.get(name);
  if (seen.has(name)) return false;

  const vulnerability = vulnerabilities[name];
  if (!vulnerability) return false;

  const nextSeen = new Set(seen);
  nextSeen.add(name);

  const via = vulnerability.via ?? [];
  const allowed =
    via.length > 0 &&
    via.every((entry) => {
      if (typeof entry === "string") return isAllowed(entry, nextSeen);
      const rank = severityRank.get(entry.severity) ?? 0;
      return rank < minimumRank || allowedAdvisories.has(entry.url);
    });

  memo.set(name, allowed);
  return allowed;
}

const blocked = Object.values(vulnerabilities).filter((vulnerability) => {
  const rank = severityRank.get(vulnerability.severity) ?? 0;
  return rank >= minimumRank && !isAllowed(vulnerability.name);
});

if (blocked.length > 0) {
  console.error("npm audit found non-allowlisted vulnerabilities:");
  for (const vulnerability of blocked) {
    console.error(`- ${vulnerability.name} (${vulnerability.severity}): ${vulnerability.range}`);
  }
  process.exit(1);
}

const allowed = Object.values(vulnerabilities).filter((vulnerability) => {
  const rank = severityRank.get(vulnerability.severity) ?? 0;
  return rank >= minimumRank && isAllowed(vulnerability.name);
});

if (allowed.length > 0) {
  console.log(
    `npm audit: ${allowed.length} ${threshold}+ vulnerabilities are temporarily allowlisted pending upstream fixes.`,
  );
  for (const vulnerability of allowed) {
    console.log(`- ${vulnerability.name}: ${vulnerability.range}`);
  }
} else {
  console.log(`npm audit: no ${threshold}+ vulnerabilities found.`);
}
