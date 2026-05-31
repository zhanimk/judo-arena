# Judo-Arena

**Tournament management platform for judo competitions.**

Full-cycle automation: athlete registration → club applications → bracket generation (IJF rules) → real-time judging from mobile → automatic rating → PDF protocols.

---

## Screenshots

| Landing | Admin dashboard | Live bracket |
|---|---|---|
| ![](docs/screenshots/01-homepage.png) | ![](docs/screenshots/03-admin-dashboard.png) | ![](docs/screenshots/05-tournament-detail-overview.png) |

| Coach panel | Athlete dashboard | Public rankings |
|---|---|---|
| ![](docs/screenshots/10-coach-dashboard.png) | ![](docs/screenshots/12-athlete-dashboard.png) | ![](docs/screenshots/14-public-rankings.png) |

---

## Features

- **Bracket Engine** — Single Elimination + IJF Repechage (two bronzes) + Round-Robin with tiebreakers
- **Seeding** — Fisher-Yates shuffle with deterministic seed + club-separation heuristic (splits same-club athletes into different halves of the draw)
- **Osaekomi (hold-down)** — server-side timer: 10s = Waza-ari, 20s = Ippon; client just presses start/stop
- **Auto-finish** — Ippon → instant win, 2×Waza-ari → Ippon, 3×Shido → Hansoku-make (opponent wins)
- **Bracket propagation** — winner automatically advances; losers routed to Repechage or Bronze
- **Admin Override + Rollback** — recursively reverts downstream match chain with full AuditLog entry
- **Real-time** — Socket.IO rooms (`tournament:{id}`, `bracket:{id}`, `tatami:{n}`, `user:{id}`)
- **Stateless judge sessions** — one-time URL `/judge/<token>` per match, or `/tatami/<token>` for full tatami queue all day
- **Tatami keyboard shortcuts** — `Q/A`=IPPON, `W/S`=WAZA, `E/D`=YUKO, `R/F`=SHIDO, `T/G`=OSAEKOMI, `Space`=Start/Pause
- **Offline indicator** — tatami page shows red banner when network is lost
- **PDF** — bracket schedule (after generation) + results protocol (after finalization)
- **Rating** — automatic points allocation on finalization: 100/80/50/30/15/0 per place
- **i18n** — KZ (default) / RU / EN — stored in localStorage + user profile
- **RBAC** — ATHLETE / COACH / ADMIN; judge access is stateless via signed session tokens
- **Password strength** — frontend indicator + backend regex (uppercase + lowercase + digit required)
- **Email** — Resend SDK (production) / Mailpit (development)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React 19 + TypeScript |
| Routing | TanStack Router (file-based) |
| Server state | TanStack Query v5 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| i18n | react-i18next (kk / ru / en) |
| Backend | Fastify 4 + TypeScript |
| ORM | Prisma 5 (PostgreSQL 16) |
| Cache / sessions | Redis 7 |
| Real-time | Socket.IO |
| Auth | JWT (15m access) + httpOnly refresh cookie (7d, Redis-backed rotation) |
| Validation | Zod |
| Email | Resend SDK (prod) / Nodemailer → Mailpit (dev) |
| PDF | PDFKit |
| Error tracking | Sentry (backend + frontend) |
| Tests | Vitest — 188 tests (unit + integration + acceptance) |
| Infrastructure | Docker Compose (Postgres + Redis + Mailpit) |
| Deploy | Render (API) + Cloudflare Pages (frontend) |

---

## Quick start

```bash
git clone <repo>
cd judo-arena
./start.sh
```

The script: checks environment → starts Docker (Postgres + Redis + Mailpit) → installs dependencies → applies pending migrations → starts backend (`:4000`) + frontend simultaneously.

To load demo data after migrations:

```bash
./start.sh --seed
```

Frontend opens at `http://localhost:5173` (Vite will print the exact port).

**Demo accounts** (visible as one-click buttons on `/login` in development only):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@judo-arena.kz` | `password123` |
| Coach | `coach.almaty@judo-arena.kz` | `password123` |
| Athlete | `m0-0@almaty-judo.judo-arena.kz` | `password123` |

> Demo buttons are hidden in production builds (`import.meta.env.DEV === false`).

---

## Environment variables

Copy `.env.example` → `.env` in the repository root.

### Minimum for local development

```env
DATABASE_URL="postgresql://judo:judo_dev_password@localhost:5433/judo_arena"
REDIS_URL="redis://localhost:6379"
JWT_ACCESS_SECRET="generate-with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
JWT_REFRESH_SECRET="different-secret-same-length"
CORS_ORIGIN="http://localhost:5173"
APP_URL="http://localhost:5173"
```

Frontend (`web/.env.local`):

```env
VITE_API_URL=http://localhost:4000
VITE_WS_URL=http://localhost:4000
```

### Email

By default in dev, emails go to **Mailpit** (`localhost:1025`) — visible at `http://localhost:8025`.

For production, use **[Resend](https://resend.com)** (free tier: 3 000 emails/month):

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM="Judo-Arena <noreply@your-domain.kz>"
```

If `RESEND_API_KEY` is set, Resend is used automatically. Otherwise falls back to SMTP.

---

## Project structure

```
judo-arena/
├── api/                          Fastify backend
│   ├── prisma/
│   │   ├── schema.prisma         16 models (User, Club, Tournament, ...)
│   │   └── seed.ts               4 clubs, 37 users, 1 tournament, brackets
│   ├── src/
│   │   ├── server.ts             Fastify app, middlewares, route registration
│   │   ├── lib/
│   │   │   ├── env.ts            Zod-validated env (crashes on startup if missing)
│   │   │   ├── error-handler.ts  Shared Fastify error handler (one source of truth)
│   │   │   ├── prisma.ts         Singleton Prisma client
│   │   │   ├── redis.ts          ioredis client + reconnect strategy
│   │   │   ├── jwt.ts            sign/verify access + refresh tokens
│   │   │   ├── refresh-store.ts  Redis-backed refresh token rotation
│   │   │   ├── storage.ts        S3/R2/local file abstraction
│   │   │   └── sentry.ts         Error tracking init
│   │   ├── middlewares/
│   │   │   ├── authenticate.ts   JWT + Redis user cache (60s TTL)
│   │   │   └── authorize.ts      Role-based access (ATHLETE/COACH/ADMIN)
│   │   ├── validators/           Zod schemas for all inputs
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── club.service.ts
│   │   │   ├── tournament.service.ts
│   │   │   ├── application.service.ts
│   │   │   ├── bracket.service.ts
│   │   │   ├── bracket-engine/   seeding, single-elim + repechage, round-robin
│   │   │   ├── match.service.ts  scoring, osaekomi, propagation, optimistic lock
│   │   │   ├── osaekomi-timer.service.ts  server-side hold-down timer
│   │   │   ├── judge-session.service.ts
│   │   │   ├── tatami-session.service.ts
│   │   │   ├── admin-override.service.ts  recursive rollback + AuditLog
│   │   │   ├── audit.service.ts
│   │   │   ├── rating.service.ts
│   │   │   ├── email.service.ts  Resend SDK + Mailpit fallback
│   │   │   └── pdf.service.ts
│   │   ├── sockets/io.ts         Socket.IO (JWT auth, room validation)
│   │   └── routes/               ~70 endpoints, all behind attachErrorHandler
│   └── tests/
│       ├── unit/                 validators, bracket-engine, match scoring
│       ├── integration/          auth-service, match-service (mocked Prisma)
│       ├── system/               HTTP API tests (mocked DB)
│       └── acceptance/           full lifecycle scenarios (188 tests total)
├── web/                          Vite + React 19 + TanStack Router
│   └── src/
│       ├── lib/
│       │   ├── api.ts            Typed client, auto-refresh, retry limit
│       │   ├── auth-store.ts     Zustand + Sentry user context
│       │   ├── socket.ts         useRealtime hook, stable deps, ref-based handlers
│       │   ├── protected-route.tsx  role guards + onboarding redirect
│       │   └── i18n.ts           react-i18next, localStorage persistence
│       ├── components/
│       │   ├── dashboard/        DashboardShell, StatCard(Skeleton), EmptyState(icon+CTA)
│       │   ├── judo/             OlympicBracket (SVG connectors, IJF pools)
│       │   ├── tournament/       tab components (overview, categories, applications, weighIn, …)
│       │   └── ui/               PasswordStrength, shadcn components
│       └── routes/
│           ├── index.tsx          Public homepage + leaderboard preview
│           ├── login.tsx          Auth page (register/login, PasswordStrength)
│           ├── rankings.tsx       Public leaderboard (athletes + clubs, filters)
│           ├── judge.$token.tsx   Per-match judge panel (keyboard shortcuts)
│           ├── tatami.$token.tsx  Full-tatami judge panel (offline banner, shortcuts)
│           ├── athlete.*          Dashboard, profile, tournaments, matches, results
│           ├── coach.*            Club management, athletes, applications, tournaments
│           └── admin.*            Full CRUD: tournaments, clubs, users, brackets, matches
├── render.yaml                   Infrastructure-as-Code for Render Blueprint
├── docker-compose.yml            Local: Postgres 16.9 + Redis 7.4 + Mailpit
├── .github/workflows/
│   ├── ci.yml                    Lint → typecheck → test → build (all jobs)
│   └── deploy.yml                Deploys ONLY when CI passes (workflow_run)
└── scripts/
    ├── backup.sh                 pg_dump + gzip + integrity check + S3 upload
    └── restore.sh                Restore from backup file
```

---

## API reference

> All protected endpoints require `Authorization: Bearer <accessToken>`.  
> Match judge endpoints accept `X-Judge-Token: <token>` or `X-Tatami-Token: <token>` instead.

### Auth `/api/auth`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/register` | public | Register ATHLETE or COACH. Password: ≥8 chars, uppercase, lowercase, digit |
| POST | `/login` | public | Returns `accessToken` + httpOnly `refreshToken` cookie |
| POST | `/refresh` | cookie | Rotate tokens (old refresh invalidated) |
| POST | `/logout` | auth | Revoke current session |
| POST | `/logout-all` | auth | Revoke all sessions |
| GET | `/me` | auth | Current user with club |
| PATCH | `/me/locale` | auth | Change language (`kk`/`ru`/`en`) |
| PATCH | `/me/profile` | auth | Update profile fields |
| POST | `/forgot-password` | public | Send reset email (3 req/hour) |
| POST | `/reset-password` | public | Set new password (invalidates all sessions) |

### Clubs `/api/clubs`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | public | List with search/city filter, paginated |
| GET | `/:id` | public | Club details with groups and coaches |
| POST | `/` | COACH/ADMIN | Create club (coach becomes owner) |
| PATCH | `/:id` | owner/ADMIN | Update |
| DELETE | `/:id` | ADMIN | Delete |
| GET | `/:id/groups` | public | Age groups |
| POST | `/:id/groups` | COACH/ADMIN | Create group |
| GET | `/:id/members` | public | Athlete list |
| POST | `/:id/athletes` | COACH/ADMIN | Proxy-register athlete |
| POST | `/:id/athletes/bulk-import` | COACH/ADMIN | CSV bulk import (max 200) |
| POST | `/:id/join-request` | ATHLETE | Request to join club |
| POST | `/:id/coach-join-request` | COACH | Request to join as coach |

### Tournaments `/api/tournaments`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | public | List (filter: status, city, upcoming, archived) |
| GET | `/:id` | public | Tournament with categories |
| POST | `/` | ADMIN | Create (starts as DRAFT) |
| PATCH | `/:id` | ADMIN | Update details |
| DELETE | `/:id` | ADMIN | Delete (DRAFT only) |
| POST | `/:id/status` | ADMIN | Lifecycle transition |
| POST | `/:id/categories` | ADMIN | Add category |
| GET | `/:id/categories/:cid/participants` | public | Draw list (IJF-style) |

**Lifecycle:**
```
DRAFT → REGISTRATION_OPEN ↔ REGISTRATION_CLOSED → IN_PROGRESS → COMPLETED
                          ↘──────────────── CANCELLED ──────────────────↙
```

### Applications `/api/applications`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/tournaments/:id/applications` | COACH | Create draft |
| POST | `/applications/:id/entries` | COACH/ADMIN | Add athlete to category |
| DELETE | `/applications/:id/entries/:eid` | COACH/ADMIN | Remove entry |
| POST | `/applications/:id/submit` | COACH | Submit (must have ≥1 entry) |
| POST | `/applications/:id/withdraw` | COACH | Withdraw submitted application |
| POST | `/applications/:id/approve` | ADMIN | Approve → notify coaches |
| POST | `/applications/:id/reject` | ADMIN | Reject with notes → notify coaches |
| POST | `/tournaments/:id/applications/bulk-approve` | ADMIN | Approve all submitted |

### Brackets `/api/brackets` + `/api/tournaments/:id`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/tournaments/:id/categories/:cid/bracket` | ADMIN | Generate bracket (rate limited: 10/min) |
| GET | `/tournaments/:id/categories/:cid/bracket` | public | Get bracket |
| GET | `/tournaments/:id/brackets` | public | All brackets for tournament |
| POST | `/tournaments/:id/brackets/prepare` | ADMIN | Generate all categories at once |
| DELETE | `/brackets/:id` | ADMIN | Delete (no started matches) |

### Matches `/api/matches`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | public | List (filter: tournamentId, bracketId, tatamiNumber, status) |
| GET | `/:id` | public | Match details + event log |
| POST | `/:id/start` | JUDGE | HAJIME — start/resume clock |
| POST | `/:id/pause` | JUDGE | MATE — pause clock |
| POST | `/:id/golden-score` | JUDGE | Enter Golden Score mode |
| POST | `/:id/score` | JUDGE | Add score event (send `version` for optimistic lock) |
| POST | `/:id/osaekomi` | JUDGE | Start hold-down (server starts timer) |
| POST | `/:id/toketa` | JUDGE | End hold-down → award score automatically |
| POST | `/:id/finish` | JUDGE | Manual finish with winner |
| POST | `/:id/confirm` | JUDGE | Confirm pending result → advance bracket |
| POST | `/:id/cancel-result` | JUDGE | Cancel pending result |
| POST | `/:id/undo` | JUDGE | Undo last score event |
| PATCH | `/:id/tatami` | ADMIN | Assign to tatami |
| PATCH | `/:id/queue` | ADMIN | Reorder in tatami queue |

**Socket.IO events emitted:** `match:started`, `match:scoreUpdate`, `match:pendingResult`, `match:finished`, `match:osaekomiStart`, `match:osaekomiEnd`, `match:goldenScore`

**Subscribe:**
```js
socket.emit("subscribe", ["tournament:abc123", "tatami:2"])
```

### Judge Sessions

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/matches/:id/judge-session` | ADMIN | Create per-match judge token |
| GET | `/judge/:token` | token | Get match by judge token |
| POST | `/judge-sessions/:id/revoke` | ADMIN | Revoke session |
| POST | `/tournaments/:id/tatami-sessions` | ADMIN | Create tatami-level session |
| GET | `/tatami-session/:token` | token | Get current match + queue |
| POST | `/tatami-sessions/:id/revoke` | ADMIN | Revoke tatami session |

### Admin `/api/admin`

| Method | Path | Description |
|---|---|---|
| POST | `/matches/:id/override` | Override result + recursive rollback of downstream chain |
| POST | `/tournaments/:id/finalize` | Compute places → assign rating points → status COMPLETED |
| GET | `/audit-logs` | Paginated audit log (filter: action, entity, actor) |
| GET | `/stats` | Dashboard statistics |
| GET/POST/PATCH/DELETE | `/clubs/*` | Full CRUD for clubs and groups |
| GET/POST/PATCH/DELETE | `/users/*` | Full CRUD for users |
| GET | `/tournaments/:id/weigh-in` | Weigh-in sheet |
| PATCH | `/application-entries/:id/weigh-in` | Update weigh-in status |

### Ratings `/api/ratings` (public)

| Method | Path | Description |
|---|---|---|
| GET | `/athletes/:id` | Athlete rating history by tournament |
| GET | `/leaderboard` | Top athletes (filter: categoryId, clubId) |
| GET | `/clubs` | Club leaderboard |

**Rating points** (configurable via `/api/admin/system-config/ratingPoints`):

| Place | Points |
|---|---:|
| 1st | 100 |
| 2nd | 80 |
| 3rd | 50 |
| 5th (semi-final loser) | 30 |
| 7th (repechage loser) | 15 |
| Participation | 0 |

### PDFs `/api/pdf` (ADMIN only)

| Method | Path | Description |
|---|---|---|
| GET | `/bracket?bracketId=X` | Bracket schedule PDF |
| GET | `/tournament-brackets?tournamentId=Y` | All brackets in one PDF |
| GET | `/protocol?tournamentId=Y` | Results protocol (COMPLETED only) |

---

## Security

| Feature | Implementation |
|---|---|
| Password hashing | bcrypt, rounds=12 |
| JWT secrets | ≥32 chars from env, separate access/refresh keys |
| Refresh token rotation | Redis-backed, single-use, revocable per-session or all |
| JWT invalidation | On password reset, all sessions are revoked |
| Rate limiting | Global 100 req/min; auth routes tighter (register 5/15min, forgot-password 3/h) |
| CORS | Restricted to `CORS_ORIGIN` env var |
| Input validation | Zod on all routes (backend) + HTML5 + PasswordStrength (frontend) |
| File uploads | MIME type + magic bytes validation; 10MB limit; converted to WebP |
| Admin actions | Every state change recorded in AuditLog with IP, user agent, before/after |
| Trust proxy | `trustProxy: 2` for Cloudflare → Render (real IP in rate limits) |
| HTTP headers | Helmet (referrer-policy: no-referrer) |
| Sentry | Scrubs passwords, tokens, Authorization header from events |

---

## Tests

```bash
cd api && npm test
```

**188 tests, 0 failing:**

| Suite | Tests | Covers |
|---|---|---|
| `unit/validators` | 21 | Zod schema edge cases |
| `unit/match-scoring` | 38 | IPPON, WAZA, SHIDO, HANSOKU, Golden Score |
| `unit/bracket-engine` | 55 | SE + repechage, Round-Robin, seeding, tiebreakers |
| `integration/auth-service` | 12 | Register, login, refresh, logout flows |
| `integration/match-service` | 22 | Osaekomi, concurrent modifications, version lock |
| `integration/application-service` | 8 | Entry validation, submit, approve |
| `system/api` | 22 | HTTP endpoints, CORS, JWT, rate limit |
| `acceptance/tournament-lifecycle` | 10 | Full scenarios: lifecycle, scoring, osaekomi, rating |

---

## Development

```bash
# Start everything (Docker + API + frontend)
./start.sh

# Start with demo data
./start.sh --seed

# Backend only
cd api && npm run dev

# Frontend only
cd web && npm run dev

# Run all tests
cd api && npm test

# Apply schema migrations
cd api && npx prisma migrate dev

# Reseed database
cd api && npx prisma db seed

# Prisma Studio (DB GUI)
cd api && npx prisma studio   # → http://localhost:5555

# Backup database
docker compose --profile backup run --rm backup

# Reset database
docker compose down -v && docker compose up -d
cd api && npx prisma migrate dev && npx prisma db seed
```

**Local services:**

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:4000 |
| Health check | http://localhost:4000/health |
| API docs (dev) | http://localhost:4000/docs |
| Prisma Studio | http://localhost:5555 |
| Mailpit (emails) | http://localhost:8025 |
| PostgreSQL | localhost:5433 · user `judo` · db `judo_arena` |

---

## Deploy

### Automated (recommended)

The repo includes `render.yaml` (Infrastructure-as-Code). On Render:

1. **New** → **Blueprint** → connect this repository
2. Render reads `render.yaml` and creates: API (Node.js) + PostgreSQL + Redis
3. Fill in the secret environment variables when prompted (see table below)
4. **Apply** — Render deploys everything

After the API is live, deploy the frontend to **Cloudflare Pages**:

1. **Create project** → **Connect to Git** → select this repo
2. Build settings:
   - Build command: `cd web && npm ci && npm run build`
   - Output directory: `web/dist`
3. Environment variables:
   - `VITE_API_URL` = `https://your-api.onrender.com`
   - `VITE_WS_URL` = `https://your-api.onrender.com`
4. Deploy

Then go back to Render and fill in the two remaining env vars:
- `CORS_ORIGIN` = your Cloudflare Pages URL
- `APP_URL` = same

### Required Render environment variables

| Variable | How to get |
|---|---|
| `JWT_ACCESS_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | Same command (use a different value) |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys |
| `CORS_ORIGIN` | Your Cloudflare Pages URL |
| `APP_URL` | Same as CORS_ORIGIN |

> `DATABASE_URL` and `REDIS_URL` are injected automatically from `render.yaml` — you don't need to set them.

### CI/CD

- **CI** (`ci.yml`): runs on every push/PR — lint → typecheck → test → build
- **Deploy** (`deploy.yml`): triggers only when CI passes on `main` branch (via `workflow_run`)
- No broken code can reach production — deploy is blocked if any CI job fails

---

## Database schema (16 models)

`User` · `Club` · `ClubGroup` · `Tournament` · `Category` · `Application` · `ApplicationEntry` · `Bracket` · `Match` · `MatchEvent` · `JudgeSession` · `TatamiSession` · `RatingEntry` · `Notification` · `AuditLog` · `SystemConfig`

Key design decisions:
- `Match.scoreSnapshot` — JSON blob (entire scoring state: points, clock, osaekomi, pendingResult)
- `Match.version` — optimistic locking for concurrent judge access
- `Application.status` — DRAFT → SUBMITTED → APPROVED/REJECTED/WITHDRAWN
- `RatingEntry` — immutable record per athlete per tournament (created on finalization)
- `AuditLog` — append-only, stores before/after JSON for every admin action

---

## License

MIT
