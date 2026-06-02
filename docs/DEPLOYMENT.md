# Deployment Runbook — Judo-Arena

## Architecture

```
Browser → Cloudflare Pages (web) → Render (API) → Render PostgreSQL + Redis
                                         ↓
                                    Resend (email)
                                    Sentry (errors)
                                    S3/R2 (file storage, optional)
```

---

## First Deploy

### Step 1 — Backend on Render

1. Open [render.com](https://render.com) → Sign in with GitHub
2. **New +** → **Blueprint** → select repo `judo-arena`
3. Render reads `render.yaml` → creates: API + PostgreSQL + Redis automatically
4. Fill in secrets (see table below) → **Apply**

**Secrets to fill manually:**

| Variable             | How to get                                                                 |
| -------------------- | -------------------------------------------------------------------------- |
| `JWT_ACCESS_SECRET`  | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | Same command, different output                                             |
| `RESEND_API_KEY`     | [resend.com](https://resend.com) → API Keys                                |
| `CORS_ORIGIN`        | Fill after step 2                                                          |
| `APP_URL`            | Same as CORS_ORIGIN                                                        |

> `DATABASE_URL` and `REDIS_URL` are auto-injected — do NOT set manually.

API URL after deploy: `https://judo-arena-api.onrender.com`

---

### Step 2 — Frontend on Cloudflare Pages

1. [pages.cloudflare.com](https://pages.cloudflare.com) → **Create project** → **Connect to Git**
2. Build settings:
   - Build command: `cd web && npm ci && npm run build`
   - Output directory: `web/dist`
3. Environment variables:
   - `VITE_API_URL` = `https://judo-arena-api.onrender.com`
   - `VITE_WS_URL` = `https://judo-arena-api.onrender.com`
4. **Save and Deploy**

Frontend URL: `https://judo-arena.pages.dev`

---

### Step 3 — Update CORS on Render

Render → API service → Environment:

- `CORS_ORIGIN` = `https://judo-arena.pages.dev`
- `APP_URL` = `https://judo-arena.pages.dev`

→ **Save Changes** (auto-restart)

---

## Subsequent Deploys (automatic)

```
git push origin main
  → CI (lint + typecheck + test + build)
  → If ALL pass → deploy.yml triggers
  → Render redeployed via webhook
  → Cloudflare Pages redeployed
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
| `S3_ENDPOINT`                        | —        | —                                    | R2/MinIO endpoint                           |
| `S3_PUBLIC_URL`                      | —        | —                                    | CDN base URL                                |
| `AWS_ACCESS_KEY_ID`                  | —        | —                                    | S3 credentials                              |
| `AWS_SECRET_ACCESS_KEY`              | —        | —                                    | S3 credentials                              |

### Frontend (Cloudflare Pages)

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

Set `BACKUP_S3_BUCKET` + AWS credentials → backup.sh uploads to S3 after each run.

---

## Rollback

**Frontend:** Cloudflare Pages → Deployments → find previous → Rollback

**Backend:**

```bash
git revert HEAD && git push origin main
# CI runs → auto-deploys
```

Or Render dashboard → Deploys → previous deploy → **Redeploy**

---

## Free Tier Limits (Render)

| Resource    | Limit                                           |
| ----------- | ----------------------------------------------- |
| Web service | Spins down after 15 min idle; 30-60s cold start |
| PostgreSQL  | 1 GB storage, 90-day auto-expiry                |
| Redis       | 25 MB, no persistence                           |

For production: upgrade to Render Starter (~$7/month/service).
