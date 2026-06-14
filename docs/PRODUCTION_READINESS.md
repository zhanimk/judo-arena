# Production Readiness

Use this before every real tournament.

## 1. Secrets

Backend must have:

| Variable                | Rule                            |
| ----------------------- | ------------------------------- |
| `NODE_ENV`              | `production`                    |
| `DATABASE_URL`          | production PostgreSQL only      |
| `REDIS_URL`             | production Redis only           |
| `JWT_ACCESS_SECRET`     | random, 48+ bytes, never shared |
| `JWT_REFRESH_SECRET`    | different random value          |
| `CORS_ORIGIN`           | exact frontend domain           |
| `APP_URL`               | exact frontend domain           |
| `RESEND_API_KEY`        | production email key            |
| `EMAIL_FROM`            | verified sender domain          |
| `SENTRY_DSN`            | API Sentry project              |
| `VITE_SENTRY_DSN`       | Web Sentry project              |
| `S3_BUCKET`             | public images/avatars only      |
| `S3_PRIVATE_BUCKET`     | private documents and backups   |
| `AWS_*`                 | credentials for both buckets    |
| `BACKUP_TRIGGER_SECRET` | random 32+ chars                |

Do not use demo passwords or local `.env` values in production.

## 2. Database

Run migrations before launch:

```bash
npm run prisma:migrate:deploy -w api
```

Hot-path indexes are included for tournaments, matches, applications, sessions and ratings.

## 3. Backup / Restore

Before a live event:

```bash
./scripts/backup.sh
```

Restore rehearsal on a non-production database:

```bash
./scripts/restore.sh ./backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

Production rule: backup before seeding, before manual DB changes, before tournament day, and immediately after final protocols are generated.

## 4. Smoke Test

After deploy:

```bash
API_URL=https://api.example.kz \
WEB_URL=https://app.example.kz \
SMOKE_ADMIN_EMAIL=admin@judo-arena.kz \
SMOKE_ADMIN_PASSWORD='...' \
npm run prod:smoke
```

Expected: every line is `PASS`.

## 5. Load Test

API:

```bash
API_URL=https://api.example.kz LOAD_CONCURRENCY=50 LOAD_DURATION_SEC=120 npm run load:api
```

Socket.IO:

```bash
WS_URL=https://api.example.kz SOCKET_CLIENTS=100 SOCKET_DURATION_SEC=120 npm run load:socket
```

For the first real event, test at least 2x expected live traffic.

## 6. Full Tournament Rehearsal

Use seeded/demo data or a copy of production data:

1. Admin creates tournament.
2. Admin adds categories.
3. Admin opens registration.
4. Coach submits application with athletes.
5. Admin approves applications.
6. Admin generates brackets.
7. Admin creates judge/tatami sessions.
8. Judge starts match, scores ippon/waza-ari/shido, confirms result.
9. Bracket propagates winner.
10. Tournament is completed.
11. Ratings are generated.
12. PDF bracket and final protocol download successfully.

Do this once on desktop and once on mobile.

## 7. Bad Network Judge/Tatami Check

Rehearse with browser throttling or unstable Wi-Fi:

1. Open judge/tatami page.
2. Start a match.
3. Disconnect network for 10-20 seconds.
4. Reconnect.
5. Confirm the page shows connection recovery.
6. Score after reconnect.
7. Confirm live bracket and tournament room update.

Socket.IO recovery is enabled for short disconnects.

## 8. Monitoring

During event day, keep open:

- Render API logs
- Render PostgreSQL metrics
- Redis metrics
- Cloudflare Pages deployment status
- Sentry API and Web issues
- `/health` endpoint

Stop the event flow if `/health` reports `degraded` for DB or Redis.

## 9. Capacity Notes

Render free tier is not suitable for serious production tournaments.

Minimum recommended launch setup:

- paid API instance
- paid PostgreSQL with backups
- persistent Redis
- durable uploads via S3/R2
- separate private bucket for documents and backups
- verified email domain
- tested restore procedure
