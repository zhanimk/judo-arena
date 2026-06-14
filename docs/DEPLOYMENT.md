# Deployment Runbook — Judo-Arena

## Architecture

```
Browser → Cloudflare Worker (web) → Render (API) → PostgreSQL + Key Value
                                             ↓
                                        Resend (email)
                                        Sentry (errors)
                                        S3/R2 (files and backups)
```

---

## First Deploy

Required runtime: Node.js 22.22.1 or newer (see `.nvmrc`).

### Step 1 — Backend on Render

1. Open [render.com](https://render.com) → Sign in with GitHub
2. **New +** → **Blueprint** → select repo `judo-arena`
3. Render reads `render.yaml` and creates API, backup cron, PostgreSQL and Key Value
4. Fill every variable marked `sync: false`, then apply the Blueprint

> `DATABASE_URL` and `REDIS_URL` are auto-injected — do NOT set manually.
> JWT secrets are generated automatically. `CORS_ORIGIN` and `APP_URL` must
> match the final Cloudflare Worker/custom-domain URL.

API URL after deploy: `https://judo-arena-api.onrender.com`

---

### Step 2 — Frontend on Cloudflare Workers

1. Create a Cloudflare API token with Workers Scripts edit permission
2. Add GitHub Actions secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `VITE_API_URL` = `https://judo-arena-api.onrender.com`
   - `VITE_WS_URL` = `https://judo-arena-api.onrender.com`
3. Push to `main`; successful CI triggers `wrangler deploy`

The Worker name is configured as `judo-arena` in `web/wrangler.jsonc`.

---

### Step 3 — Update CORS on Render

Render → API service → Environment:

- `CORS_ORIGIN` = exact Worker or custom-domain origin
- `APP_URL` = the same public frontend origin

→ **Save Changes** (auto-restart)

---

## Subsequent Deploys (automatic)

```
git push origin main
  → CI (lint + typecheck + test + build)
  → If ALL pass → deploy.yml triggers
  → Render redeployed via webhook
  → Cloudflare Worker redeployed
```

Broken code cannot reach production — deploy is blocked if CI fails.

---

## Environment Variables

### Backend (Render)

| Variable                             | Required | Default                              | Description                                 |
| ------------------------------------ | -------- | ------------------------------------ | ------------------------------------------- |
| `NODE_ENV`                           | ✅       | —                                    | `production`                                |
| `DATABASE_URL`                       | ✅       | auto                                 | PostgreSQL (auto from render.yaml)          |
| `REDIS_URL`                          | ✅       | auto                                 | Redis (auto from render.yaml)               |
| `JWT_ACCESS_SECRET`                  | ✅       | —                                    | ≥32 chars                                   |
| `JWT_REFRESH_SECRET`                 | ✅       | —                                    | Different ≥32 chars                         |
| `JWT_ACCESS_TTL`                     | —        | `15m`                                | Access token lifetime                       |
| `JWT_REFRESH_TTL`                    | —        | `7d`                                 | Refresh token lifetime                      |
| `CORS_ORIGIN`                        | ✅       | —                                    | Frontend URL                                |
| `APP_URL`                            | ✅       | —                                    | Same as CORS_ORIGIN (used in email links)   |
| `RESEND_API_KEY`                     | ✅       | —                                    | Email sending via Resend                    |
| `EMAIL_FROM`                         | —        | `Judo-Arena <onboarding@resend.dev>` | Sender                                      |
| `BCRYPT_ROUNDS`                      | —        | `12`                                 | Password hashing rounds                     |
| `RATE_LIMIT_MAX`                     | —        | `100`                                | Requests per window per IP                  |
| `SOCKET_CONNECTION_LIMIT_MAX`        | —        | `120`                                | New Socket.IO connections per window per IP |
| `SOCKET_CONNECTION_LIMIT_WINDOW_SEC` | —        | `60`                                 | Socket.IO connection limit window           |
| `SENTRY_DSN`                         | —        | —                                    | Error tracking (optional)                   |
| `S3_BUCKET`                          | —        | —                                    | File storage (optional, local if blank)     |
| `S3_PRIVATE_BUCKET`                  | ✅ prod  | —                                    | Private documents and database backups      |
| `S3_ENDPOINT`                        | —        | —                                    | R2/MinIO endpoint                           |
| `S3_PUBLIC_URL`                      | —        | —                                    | CDN base URL                                |
| `AWS_ACCESS_KEY_ID`                  | —        | —                                    | S3 credentials                              |
| `AWS_SECRET_ACCESS_KEY`              | —        | —                                    | S3 credentials                              |
| `BACKUP_TRIGGER_SECRET`              | ✅ prod  | —                                    | Manual fallback trigger, at least 32 chars  |
| `BACKUP_SCHEDULER_ENABLED`           | —        | `true`                               | `false` on Render; cron job is primary      |

### Frontend (Cloudflare Workers)

| Variable          | Required | Description                 |
| ----------------- | -------- | --------------------------- |
| `VITE_API_URL`    | ✅       | Backend URL                 |
| `VITE_WS_URL`     | ✅       | WebSocket URL (same as API) |
| `VITE_SENTRY_DSN` | —        | Frontend Sentry DSN         |

---

## Health Check

```
GET /health
→ { "status": "ok", "db": "connected", "redis": "connected" }
```

If DB or Redis is down: `"status": "degraded"`.

## Production Rehearsal

Before a real event, follow [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md):

```bash
npm run prod:smoke
npm run load:api
npm run load:socket
```

---

## Backups

### Manual

```bash
docker compose --profile backup run --rm backup
# → ./backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

### Restore

```bash
./scripts/restore.sh ./backups/backup_20260531_100000.sql.gz
```

### Automated (S3)

The Render cron uses `api/Dockerfile.backup`, which includes `pg_dump`, and
stores backups in `S3_PRIVATE_BUCKET`. The GitHub workflow is a manual fallback
and uses `BACKUP_TRIGGER_SECRET`, never a short-lived user JWT.

---

## Rollback

**Frontend:** Cloudflare Workers & Pages → `judo-arena` → Deployments → Rollback

**Backend:**

```bash
git revert HEAD && git push origin main
# CI runs → auto-deploys
```

Or Render dashboard → Deploys → previous deploy → **Redeploy**

---

## Production plans

Render cron jobs do not support the free plan. The Blueprint uses `starter` for
the backup job. Before a real tournament, use paid API/database/Key Value plans
with enough capacity and retention for the expected load.
