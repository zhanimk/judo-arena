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
- **Seeding** — Fisher-Yates shuffle with deterministic seed + club-separation heuristic (splits same-club athletes into different quarters)
- **Osaekomi (hold-down)** — server-side timer: 5s = Yuko, 10s = Waza-ari, 20s = Ippon; client just presses buttons
- **Auto-finish** — Ippon → instant win, 2×Waza-ari → Ippon, 3×Shido → Hansoku-make
- **Bracket propagation** — winner automatically advances; losers routed to Repechage or Bronze
- **Admin Override + Rollback** — recursively reverts downstream match chain with full AuditLog
- **Real-time** — Socket.IO rooms (`tournament:{id}`, `bracket:{id}`, `tatami:{n}`, `user:{id}`)
- **Stateless judge sessions** — one-time URL `/judge/<token>` (12h TTL), no account needed
- **PDF** — bracket schedule (after generation) + results protocol (after finalization)
- **Rating** — automatic points allocation on finalization: 100/80/50/30/15/0 per place
- **i18n** — KZ / RU / EN, stored in localStorage + user profile via API
- **RBAC** — ATHLETE / COACH / ADMIN / JUDGE (stateless)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React 19 + TypeScript |
| Routing | TanStack Router (file-based) |
| Server state | TanStack Query v5 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| i18n | react-i18next |
| Backend | Fastify + TypeScript |
| ORM | Prisma 5 (PostgreSQL 16) |
| Cache / sessions | Redis 7 |
| Real-time | Socket.IO |
| Auth | JWT (15m access) + httpOnly refresh cookie (7d, Redis-backed rotation) |
| Validation | Zod |
| PDF | PDFKit |
| Tests | Vitest (bracket engine) |
| Infrastructure | Docker Compose (Postgres + Redis + Mailpit) |

---

## Quick start

```bash
git clone <repo>
cd judo-arena
./start.sh
```

The script: checks environment → starts Docker (Postgres + Redis + Mailpit) → installs dependencies → runs migrations → seeds test data → starts backend (`:4000`) + frontend simultaneously.

Frontend opens at `http://localhost:8080` or `5173` (Vite will print the exact port).

**Demo accounts** (also available as one-click buttons on `/login`):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@judo-arena.kz` | `password123` |
| Coach | `coach.almaty@judo-arena.kz` | `password123` |
| Athlete | `m0-0@almaty-judo.judo-arena.kz` | `password123` |

---

## Environment variables

Copy `api/.env.example` → `api/.env` and fill in:

```env
DATABASE_URL="postgresql://judo:judo_dev_password@localhost:5433/judo_arena"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="change-me-in-production"
JWT_REFRESH_SECRET="change-me-in-production"
FRONTEND_URL="http://localhost:5173"
PORT=4000
```

Frontend env (`web/.env`):

```env
VITE_API_URL=http://localhost:4000
VITE_WS_URL=http://localhost:4000
```

---

## Project structure

```
judo-arena/
├── api/                          Fastify backend
│   ├── prisma/
│   │   ├── schema.prisma         15 tables
│   │   └── seed.ts               4 clubs, 37 users, 1 tournament
│   └── src/
│       ├── server.ts
│       ├── lib/                  env, prisma, redis, jwt, refresh-store
│       ├── middlewares/          authenticate, authorize (RBAC)
│       ├── validators/           Zod schemas
│       ├── services/
│       │   ├── auth.service.ts
│       │   ├── club.service.ts
│       │   ├── tournament.service.ts
│       │   ├── application.service.ts
│       │   ├── bracket.service.ts
│       │   ├── bracket-engine/   seeding, single-elim, round-robin + Vitest tests
│       │   ├── match.service.ts  + Osaekomi timer
│       │   ├── judge-session.service.ts
│       │   ├── admin-override.service.ts
│       │   ├── audit.service.ts
│       │   ├── rating.service.ts
│       │   └── pdf.service.ts
│       ├── sockets/io.ts         Socket.IO
│       └── routes/               ~65 endpoints
├── web/                          TanStack Start frontend
│   └── src/
│       ├── lib/
│       │   ├── api.ts            Typed API client with auto-refresh
│       │   ├── auth-store.ts
│       │   ├── protected-route.tsx
│       │   ├── socket.ts         Socket.IO client hook
│       │   └── i18n.ts
│       ├── shared/locales/       kk.json + ru.json + en.json
│       ├── components/
│       │   ├── dashboard/        DashboardShell, StatCard, Panel, …
│       │   └── judo/             OlympicBracket, LiveBracket, …
│       └── routes/               File-based routing
│           ├── index, login, tournaments, rankings, protocol, about
│           ├── judge, judge.$token
│           ├── live-wall.$tournamentId
│           ├── athlete.*         (overview, profile, tournaments, matches, results, notifications)
│           ├── coach.*           (overview, club, athletes, applications, tournaments, notifications)
│           └── admin.*           (overview, tournaments, clubs, applications, users, ratings,
│                                   notifications, audit, settings, reports, brackets, matches)
└── docker-compose.yml            Postgres 16 + Redis 7 + Mailpit
```

---

## API reference

> All protected endpoints require `Authorization: Bearer <token>`.  
> Judge endpoints accept `X-Judge-Token: <token>` instead.

### Auth

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | public | Register ATHLETE or COACH |
| POST | `/api/auth/login` | public | Returns `accessToken` + refresh cookie |
| POST | `/api/auth/refresh` | public (cookie) | Rotate tokens |
| POST | `/api/auth/logout` | auth | Revoke current session |
| POST | `/api/auth/logout-all` | auth | Revoke all sessions |
| GET | `/api/auth/me` | auth | Current user |
| PATCH | `/api/auth/me/locale` | auth | Change language (`kk`/`ru`/`en`) |

### Clubs & Athletes

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/clubs` | public | List (filter: city, search) |
| POST | `/api/clubs` | COACH/ADMIN | Create club |
| PATCH | `/api/clubs/:id` | COACH-owner/ADMIN | Update |
| GET | `/api/clubs/:id/members` | public | Athlete list |
| POST | `/api/clubs/:id/athletes` | COACH/ADMIN | Proxy-register athlete |
| PATCH | `/api/athletes/:id` | self/COACH/ADMIN | Update athlete profile |
| DELETE | `/api/athletes/:id/club` | COACH/ADMIN | Detach from club |

### Tournaments & Categories

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/tournaments` | public | List (filter: status, city, upcoming) |
| POST | `/api/tournaments` | ADMIN | Create (status: DRAFT) |
| PATCH | `/api/tournaments/:id` | ADMIN | Update |
| POST | `/api/tournaments/:id/status` | ADMIN | Change lifecycle status |
| POST | `/api/tournaments/:id/categories` | ADMIN | Add category |
| PATCH | `/api/categories/:id` | ADMIN | Update category |
| DELETE | `/api/categories/:id` | ADMIN | Delete category (DRAFT only) |

**Tournament lifecycle:**
```
DRAFT → REGISTRATION_OPEN ↔ REGISTRATION_CLOSED → IN_PROGRESS → COMPLETED
                                                             ↘ CANCELLED
```

### Applications

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/tournaments/:id/applications` | COACH | Create draft application |
| POST | `/api/applications/:id/entries` | COACH/ADMIN | Add athlete to category |
| DELETE | `/api/applications/:id/entries/:entryId` | COACH/ADMIN | Remove entry |
| POST | `/api/applications/:id/submit` | COACH | Submit (DRAFT → SUBMITTED) |
| POST | `/api/applications/:id/approve` | ADMIN | Approve |
| POST | `/api/applications/:id/reject` | ADMIN | Reject |
| GET | `/api/athlete/applications` | ATHLETE | My application entries |

Entry validation: gender, age, weight match category; athlete belongs to coach's club; no duplicate entries.

### Brackets

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/tournaments/:id/categories/:cid/bracket` | ADMIN | Generate bracket |
| GET | `/api/tournaments/:id/categories/:cid/bracket` | public | Get bracket |
| GET | `/api/tournaments/:id/brackets` | public | All brackets |
| DELETE | `/api/brackets/:id` | ADMIN | Delete (no started matches) |

### Matches & Judge Sessions

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/matches` | public | List (filter: tournamentId, tatamiNumber, status) |
| GET | `/api/matches/:id` | public | Match details + event log |
| POST | `/api/matches/:id/start` | ADMIN/JUDGE | HAJIME |
| POST | `/api/matches/:id/pause` | ADMIN/JUDGE | MATE |
| POST | `/api/matches/:id/score` | ADMIN/JUDGE | Add score event |
| POST | `/api/matches/:id/osaekomi` | ADMIN/JUDGE | Start hold-down timer |
| POST | `/api/matches/:id/toketa` | ADMIN/JUDGE | End hold-down → auto-score |
| POST | `/api/matches/:id/finish` | ADMIN/JUDGE | Manual finish |
| POST | `/api/matches/:id/judge-session` | ADMIN | Create judge session → returns URL |
| PATCH | `/api/matches/:id/tatami` | ADMIN | Assign tatami |
| GET | `/api/tatami/:tournamentId/:n/queue` | public | Tatami match queue |
| GET | `/api/judge/:token` | public (token) | Get match by judge token |

**Socket.IO events:** `match:started`, `match:scoreUpdate`, `match:event`, `match:osaekomiStart`, `match:osaekomiEnd`, `match:goldenScore`, `match:finished`

**Subscribe:** `socket.emit("subscribe", ["tournament:abc", "tatami:1"])`

### Admin — Override, Rating, PDF

| Method | Path | Description |
|---|---|---|
| POST | `/api/admin/matches/:id/override` | Override result + recursive rollback |
| POST | `/api/admin/tournaments/:id/finalize` | Finalize → compute places → assign rating points → COMPLETED |
| GET | `/api/admin/audit-logs` | Audit log (filter: action, targetEntity, actor) |
| GET | `/api/ratings/athletes/:id` | Athlete rating history |
| GET | `/api/ratings/leaderboard` | Global leaderboard (filter: categoryId, clubId) |
| GET | `/api/pdf/bracket?bracketId=X` | Download bracket PDF |
| GET | `/api/pdf/protocol?tournamentId=Y` | Download results protocol PDF (COMPLETED only) |

**Rating points** (configurable via `/api/admin/system-config/ratingPoints`):

| Place | Points |
|---|---:|
| 1st | 100 |
| 2nd | 80 |
| 3rd (both) | 50 |
| 4–5th | 30 |
| 7–8th (repechage) | 15 |
| Participation | 0 |

---

## Tournament workflow

```
1. ADMIN creates tournament (DRAFT) → adds categories
2. ADMIN opens registration (→ REGISTRATION_OPEN)
3. COACH creates application → adds athletes → submits
4. ADMIN approves application
5. ADMIN closes registration (→ REGISTRATION_CLOSED)
6. ADMIN generates bracket  ──── PDF schedule available
7. ADMIN starts tournament (→ IN_PROGRESS)
8. ADMIN creates judge sessions → shares URLs
9. JUDGE: HAJIME → Osaekomi → Toketa → auto Waza-ari → IPPON
        → auto-finish → winner propagates to next match  ── real-time via Socket.IO
10. ADMIN overrides result if needed → rollback chain → AuditLog
11. ADMIN finalizes (→ COMPLETED)  ── rating entries created ── PDF protocol available
```

---

## Database schema (15 tables)

`User` · `Club` · `ClubGroup` · `Tournament` · `Category` · `Application` · `ApplicationEntry` · `Bracket` · `Match` · `MatchEvent` · `JudgeSession` · `RatingEntry` · `Notification` · `AuditLog` · `SystemConfig`

---

## Development

```bash
# Start everything (Docker + API + frontend)
./start.sh

# Backend only
cd api && npm run dev

# Frontend only
cd web && npm run dev

# Run tests (bracket engine)
cd api && npm test

# Apply schema migrations
cd api && npx prisma migrate dev

# Reseed database
cd api && npx prisma db seed

# Prisma Studio (DB GUI)
cd api && npx prisma studio   # → http://localhost:5555

# Mailpit (test emails)
# → http://localhost:8025

# Reset database completely
docker compose down -v && docker compose up -d
cd api && npx prisma migrate dev && npx prisma db seed
```

**Local services:**

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 (or 8080) |
| Backend API | http://localhost:4000 |
| Health check | http://localhost:4000/health |
| Prisma Studio | http://localhost:5555 |
| Mailpit | http://localhost:8025 |
| PostgreSQL | localhost:5433 · user `judo` · db `judo_arena` |

---

## Tests

```bash
cd api && npm test
```

Coverage: `nextPowerOfTwo`, `seedAthletes` (Fisher-Yates + club separation + determinism), `buildSingleElimination` (brackets 4/8 + Repechage), `propagateResult` (advance + bronze routing), `buildRoundRobin`, `computeStandings` (tiebreakers).

---

## Security

- bcrypt rounds=12
- JWT with long secrets from env
- Refresh tokens in Redis (revocable per-session or all-sessions)
- Rate limit: 100 req/min per IP
- httpOnly + SameSite=Lax cookies
- CORS restricted to frontend origin
- Zod validation on all inputs
- All admin actions written to AuditLog

---

## Deploy

### Frontend → Cloudflare Pages

```bash
cd web && npx wrangler pages deploy
```

### Backend → Render

1. New Web Service, root = `api/`
2. Build: `npm install && npx prisma generate && npm run build`
3. Start: `node dist/server.js`
4. Add Postgres + Redis add-ons
5. Set env vars from `.env.example`

---

## License

MIT
