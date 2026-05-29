// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      proxy: {
        // Forward /api/* and /socket.io/* to the Fastify API in dev.
        // This makes refresh-token cookies work (same origin, no SameSite issues).
        "/api": {
          target: "http://localhost:4000",
          changeOrigin: true,
          secure: false,
        },
        "/socket.io": {
          target: "http://localhost:4000",
          changeOrigin: true,
          ws: true,
          secure: false,
        },
      },
    },
    // Enable source maps for Sentry (only in production build)
    build: {
      sourcemap: true,
    },
    plugins: [
      // Upload source maps to Sentry on production build.
      // Requires SENTRY_AUTH_TOKEN env var (CI secret).
      // Only activates when VITE_SENTRY_DSN is set to avoid slowing local builds.
      ...(process.env.VITE_SENTRY_DSN && process.env.SENTRY_AUTH_TOKEN
        ? [
            sentryVitePlugin({
              org: process.env.SENTRY_ORG,
              project: process.env.SENTRY_PROJECT,
              authToken: process.env.SENTRY_AUTH_TOKEN,
              release: {
                name: process.env.VITE_RELEASE ?? process.env.npm_package_version,
                // Automatically set commits for better traceability
                setCommits: { auto: true },
              },
              sourcemaps: {
                // Upload and delete source maps after upload (keep bundle clean)
                filesToDeleteAfterUpload: ["dist/**/*.map"],
              },
              telemetry: false,
            }),
          ]
        : []),
    ],
  },
});
