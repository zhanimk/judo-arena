#!/usr/bin/env node
/**
 * Generates openapi.json from the Fastify app (without starting the HTTP server).
 *
 * Usage:  node scripts/generate-openapi.mjs [output-path]
 * Output: api/openapi.json  (default)
 *
 * The file is uploaded as a CI artifact and can be used to:
 *   - Generate client SDKs (openapi-typescript, etc.)
 *   - Power Postman / Insomnia collections
 *   - Feed API documentation portals
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = process.argv[2] ?? resolve(__dirname, "../api/openapi.json");

// Force non-production so swagger registers its routes
process.env.NODE_ENV = "development";

// Minimal env required to boot the Fastify app without external connections
process.env.DATABASE_URL ??= "postgresql://noop:noop@localhost:5432/noop";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.JWT_ACCESS_SECRET ??= "openapi_gen_secret_at_least_32_chars_xx";
process.env.JWT_REFRESH_SECRET ??= "openapi_gen_secret_at_least_32_chars_yy";
process.env.JWT_ACCESS_TTL ??= "15m";
process.env.JWT_REFRESH_TTL ??= "7d";
process.env.CORS_ORIGIN ??= "http://localhost:5173";

// Dynamically import after env is set
const { default: Fastify } = await import("fastify");
const { authRoutes } = await import("../api/dist/routes/auth.routes.js");
const { clubRoutes, clubAdjacentRoutes } = await import("../api/dist/routes/club.routes.js");
const { tournamentRoutes, tournamentAdjacentRoutes } = await import("../api/dist/routes/tournament.routes.js");
const { bracketTournamentRoutes, bracketDirectRoutes } = await import("../api/dist/routes/bracket.routes.js");
const { matchRoutes, judgeAdjacentRoutes } = await import("../api/dist/routes/match.routes.js");
const { adminRoutes, ratingRoutes, pdfRoutes, adminApplicationRoutes } = await import("../api/dist/routes/admin.routes.js");
const { notificationRoutes } = await import("../api/dist/routes/notification.routes.js");
const { uploadRoutes } = await import("../api/dist/routes/upload.routes.js");
const swagger = (await import("@fastify/swagger")).default;

const app = Fastify({ logger: false });

await app.register(swagger, {
  openapi: {
    info: {
      title: "Judo-Arena API",
      description: "REST API для управления дзюдо-турнирами, матчами и судейством",
      version: "0.1.0",
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
});

await app.register(authRoutes,               { prefix: "/api/auth" });
await app.register(clubRoutes,               { prefix: "/api/clubs" });
await app.register(clubAdjacentRoutes,       { prefix: "/api" });
await app.register(tournamentRoutes,         { prefix: "/api/tournaments" });
await app.register(tournamentAdjacentRoutes, { prefix: "/api" });
await app.register(bracketTournamentRoutes,  { prefix: "/api/tournaments" });
await app.register(bracketDirectRoutes,      { prefix: "/api/brackets" });
await app.register(matchRoutes,              { prefix: "/api/matches" });
await app.register(judgeAdjacentRoutes,      { prefix: "/api" });
await app.register(adminRoutes,              { prefix: "/api/admin" });
await app.register(adminApplicationRoutes,   { prefix: "/api/admin/applications" });
await app.register(ratingRoutes,             { prefix: "/api/ratings" });
await app.register(pdfRoutes,               { prefix: "/api/pdf" });
await app.register(notificationRoutes,       { prefix: "/api/notifications" });
await app.register(uploadRoutes,             { prefix: "/api/upload" });

await app.ready();

const spec = app.swagger();
writeFileSync(outputPath, JSON.stringify(spec, null, 2));
console.log(`OpenAPI spec written to ${outputPath}`);
console.log(`  Paths: ${Object.keys(spec.paths ?? {}).length}`);

await app.close();
