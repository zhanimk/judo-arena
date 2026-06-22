// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

const isVercel = process.env.VERCEL === "1";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
export default defineConfig({
  nitro: isVercel
    ? false
    : {
        preset: "cloudflare-module",
        output: {
          dir: "dist",
          serverDir: "dist/server",
          publicDir: "dist/client",
        },
        cloudflare: {
          nodeCompat: true,
          deployConfig: true,
        },
      },
  tanstackStart: {
    server: { entry: "server" },
  },
  plugins: isVercel
    ? [
        nitro({
          vercel: {
            functions: {
              runtime: "nodejs22.x",
            },
          },
        }),
      ]
    : [],
  vite: {
    server: {
      proxy: {
        // Forward /api/* and /socket.io/* to the Fastify API in dev.
        // This makes refresh-token cookies work (same origin, no SameSite issues).
        "/api": {
          target: process.env.VITE_API_URL || "http://127.0.0.1:4000",
          changeOrigin: true,
          secure: false,
        },
        "/socket.io": {
          target: process.env.VITE_WS_URL || "http://127.0.0.1:4000",
          changeOrigin: true,
          ws: true,
          secure: false,
        },
        "/uploads": {
          target: process.env.VITE_API_URL || "http://127.0.0.1:4000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    // Disable source maps for production client to fix browser loading errors
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("@tanstack")) return "vendor-tanstack";
            if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
            if (id.includes("@radix-ui") || id.includes("lucide-react")) return "vendor-ui";
            if (id.includes("i18next") || id.includes("react-i18next")) return "vendor-i18n";
            if (id.includes("socket.io-client")) return "vendor-realtime";
            if (id.includes("recharts")) return "vendor-charts";
            return "vendor";
          },
        },
      },
    },
    plugins: [
      // PWA: offline support + installable app.
      // Critical for tatami judges with poor Wi-Fi at competitions.
      VitePWA({
        registerType: "autoUpdate",
        // Don't inject service worker in dev (causes caching confusion)
        devOptions: { enabled: false },
        manifest: false, // We have our own public/manifest.webmanifest
        workbox: {
          // Cache the app shell and all static assets
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
          // Navigation fallback: serve the SPA shell for unknown routes
          // (lets the client-side router handle them after offline load)
          navigateFallback: null, // SSR app — don't intercept navigations
          // Runtime caching strategies
          runtimeCaching: [
            // API GET requests: network first, fall back to cache (30s timeout)
            {
              urlPattern: /^https?:\/\/.*\/api\/(matches|tournaments|brackets|ratings)/,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 2 }, // 2h
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Static assets: cache first (long-lived)
            {
              urlPattern: /\.(?:js|css|woff2?)$/,
              handler: "CacheFirst",
              options: {
                cacheName: "static-assets",
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30d
              },
            },
            // Google Fonts: stale while revalidate
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "google-fonts",
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }, // 1y
              },
            },
          ],
        },
      }),
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
