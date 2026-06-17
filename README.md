# Judo-Arena

Judo-Arena - production-ready платформа для проведения соревнований по дзюдо: регистрация, клубные заявки, взвешивание, сетки, судейство, live-результаты, рейтинги, уведомления и PDF-протоколы в одном рабочем процессе.

Документ является единой технической и операционной документацией проекта. Все команды, правила запуска, деплой, production-проверки и основные требования собраны здесь, чтобы в репозитории не было разрозненных ТЗ, планов и временных заметок.

## Содержание

- [Возможности](#возможности)
- [Скриншоты](#скриншоты)
- [Архитектура](#архитектура)
- [Технологический стек](#технологический-стек)
- [Структура проекта](#структура-проекта)
- [Роли и доступы](#роли-и-доступы)
- [Локальный запуск](#локальный-запуск)
- [Ежедневные команды](#ежедневные-команды)
- [Тестирование и качество](#тестирование-и-качество)
- [Переменные окружения](#переменные-окружения)
- [Деплой](#деплой)
- [Production checklist](#production-checklist)
- [Backup и restore](#backup-и-restore)
- [Rollback](#rollback)
- [Demo accounts](#demo-accounts)
- [Troubleshooting](#troubleshooting)

## Возможности

- Полный lifecycle турнира: черновик, регистрация, проведение, завершение и архив.
- Клубы, тренеры, спортсмены, заявки в клуб и заявки на турнир.
- Категории по полу, возрасту, весу и уровню.
- Взвешивание и допуск спортсменов.
- Генерация сеток: single elimination, IJF repechage и round-robin.
- Судейская зона без постоянного аккаунта через защищенный токен сессии.
- Реaltime-матчи: счет, shido, osaekomi, golden score, подтверждение результата.
- Tatami queue и live-обновления через Socket.IO.
- Рейтинги спортсменов и клубов.
- PDF-протоколы, сетки и итоговые документы.
- Загрузка файлов, документов и изображений.
- Email-уведомления, production-логирование, аудит и backup.
- Интерфейс на казахском, русском и английском языках.

## Скриншоты

| Home                              | Login                              | Tournaments                              |
| --------------------------------- | ---------------------------------- | ---------------------------------------- |
| ![](docs/screenshots/01-home.png) | ![](docs/screenshots/02-login.png) | ![](docs/screenshots/03-tournaments.png) |

| Rankings                              | Mobile home                              | Mobile login                              |
| ------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| ![](docs/screenshots/04-rankings.png) | ![](docs/screenshots/05-mobile-home.png) | ![](docs/screenshots/06-mobile-login.png) |

## Архитектура

```text
Browser
  -> Cloudflare Worker (React/TanStack Start web)
  -> Render API (Fastify)
  -> PostgreSQL + Redis
       -> Resend / SMTP
       -> S3 or Cloudflare R2
       -> Sentry
```

Основной production-путь:

1. Frontend деплоится как Cloudflare Worker из `web/wrangler.jsonc`.
2. Backend деплоится на Render из `render.yaml`.
3. PostgreSQL и Redis-compatible Key Value создаются Render Blueprint.
4. CI должен пройти полностью до production deploy.
5. Deploy workflow запускается только после успешного CI на `main`.

## Технологический стек

| Слой     | Технологии                                                    |
| -------- | ------------------------------------------------------------- |
| Web      | React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS |
| API      | Fastify, TypeScript, Prisma                                   |
| DB/cache | PostgreSQL 16, Redis-compatible Key Value                     |
| Realtime | Socket.IO                                                     |
| Файлы    | S3/R2 compatible storage                                      |
| Email    | Resend или внешний SMTP                                       |
| Тесты    | Vitest, Playwright                                            |
| CI/CD    | GitHub Actions                                                |
| Deploy   | Cloudflare Workers, Render                                    |

Требуемая версия Node.js зафиксирована в `.nvmrc`:

```bash
nvm use
```

Сейчас проект рассчитан на Node.js `22.22.1`.

## Структура проекта

```text
judo-arena/
├── api/                  Fastify API, Prisma schema, services, tests
├── web/                  React frontend and route-based dashboards
├── e2e/                  Playwright smoke/a11y tests
├── packages/             Shared packages
├── scripts/              Smoke, load, backup, OpenAPI and utility scripts
├── docs/screenshots/     README screenshots
├── .github/workflows/    CI and deploy pipelines
├── docker-compose.yml    Local PostgreSQL, Redis and Mailpit
├── render.yaml           Render Blueprint
└── README.md             Single source of project documentation
```

## Роли и доступы

| Роль    | Назначение                                                                        |
| ------- | --------------------------------------------------------------------------------- |
| Public  | Просмотр публичных турниров, рейтингов и информации без входа                     |
| Athlete | Профиль спортсмена, клуб, заявки, турниры, результаты, уведомления                |
| Coach   | Управление клубом, спортсменами, заявками и оплатами                              |
| Admin   | Полное управление турнирами, пользователями, сетками, матчами, отчетами и аудитом |
| Judge   | Судейство конкретной сессии по токену, без постоянного аккаунта                   |
| Tatami  | Экран татами, очередь матчей и live-состояние площадки                            |

Критичные правила безопасности:

- Admin-действия доступны только роли `ADMIN`.
- Judge и Tatami работают через ограниченные session tokens.
- Production JWT secrets должны быть разными и длиннее 32 символов.
- Production `CORS_ORIGIN` и `APP_URL` не должны указывать на localhost.
- Demo-пароли нельзя использовать в production.

## Локальный запуск

### Быстрый старт

```bash
nvm use
npm start
```

Команда `npm start` поднимает локальные сервисы, устанавливает зависимости при необходимости, применяет миграции и запускает API вместе с frontend.

Запуск с demo-данными:

```bash
npm run start:seed
```

### Ручной запуск по шагам

1. Запустить Docker Desktop.
2. Поднять PostgreSQL, Redis и Mailpit:

```bash
docker compose up -d
docker ps
```

Ожидаемые контейнеры:

| Контейнер       | Назначение      | Порт           |
| --------------- | --------------- | -------------- |
| `judo-postgres` | PostgreSQL      | `5433`         |
| `judo-redis`    | Redis           | `6379`         |
| `judo-mailpit`  | Локальная почта | `1025`, `8025` |

3. Запустить API:

```bash
npm run dev:api
```

4. Запустить frontend:

```bash
npm run dev:web
```

5. При необходимости открыть Prisma Studio:

```bash
npm run db:studio
```

Локальные адреса:

| Что           | URL                                                                          |
| ------------- | ---------------------------------------------------------------------------- |
| Web           | `http://localhost:5173`                                                      |
| API           | `http://localhost:4000`                                                      |
| API health    | `http://localhost:4000/health`                                               |
| Prisma Studio | `http://localhost:5555`                                                      |
| Mailpit       | `http://localhost:8025`                                                      |
| PostgreSQL    | `localhost:5433`, user `judo`, password `judo_dev_password`, db `judo_arena` |

## Ежедневные команды

Запустить проект:

```bash
nvm use
npm start
```

Запустить проект с demo seed:

```bash
npm run start:seed
```

Остановить локальные контейнеры без удаления данных:

```bash
docker compose stop
```

Полностью удалить локальную БД и Redis volume:

```bash
docker compose down -v
```

Применить новую миграцию в dev:

```bash
npm run db:migrate
```

Сгенерировать Prisma client:

```bash
npm run prisma:generate -w api
```

Засеять demo-данные:

```bash
npm run db:seed
```

Открыть PostgreSQL через `psql`:

```bash
docker exec -it judo-postgres psql -U judo -d judo_arena
```

Проверить API:

```bash
curl http://localhost:4000/health
```

Логин demo-admin:

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@judo-arena.kz","password":"password123"}'
```

## Тестирование и качество

Перед коммитом и перед деплоем:

```bash
nvm use
npm run verify:local
```

`verify:local` выполняет:

- API lint с `--max-warnings 0`
- Web lint
- API tests
- API build
- Web build
- Bundle size check

Отдельные проверки:

```bash
npm run lint -w @judo-arena/api -- --max-warnings 0
npm run lint -w tanstack_start_ts
npm run test -w @judo-arena/api
npm run build -w @judo-arena/api
npm run build -w tanstack_start_ts
npm run check:bundle
```

E2E:

```bash
npm run test:e2e
npm run test:e2e:a11y
npm run test:e2e:headed
```

Production smoke test требует уже поднятые production/staging URL:

```bash
API_URL=https://api.example.kz \
WEB_URL=https://app.example.kz \
SMOKE_ADMIN_EMAIL=admin@judo-arena.kz \
SMOKE_ADMIN_PASSWORD='...' \
npm run prod:smoke
```

Load tests:

```bash
API_URL=https://api.example.kz LOAD_CONCURRENCY=50 LOAD_DURATION_SEC=120 npm run load:api
WS_URL=https://api.example.kz SOCKET_CLIENTS=100 SOCKET_DURATION_SEC=120 npm run load:socket
```

OpenAPI:

```bash
npm run gen:openapi
```

## Переменные окружения

Локальные значения описаны в `.env.example`. Для локального API нужен `api/.env`; если файла нет:

```bash
cp .env.example api/.env
```

### Backend production

| Variable                   | Required         | Notes                                   |
| -------------------------- | ---------------- | --------------------------------------- |
| `NODE_ENV`                 | yes              | `production`                            |
| `DATABASE_URL`             | yes              | Auto from Render PostgreSQL             |
| `REDIS_URL`                | yes              | Auto from Render Key Value              |
| `JWT_ACCESS_SECRET`        | yes              | Random, 32+ chars                       |
| `JWT_REFRESH_SECRET`       | yes              | Different from access secret            |
| `JWT_ACCESS_TTL`           | no               | Default `15m`                           |
| `JWT_REFRESH_TTL`          | no               | Default `7d`                            |
| `CORS_ORIGIN`              | yes              | Exact frontend origin                   |
| `APP_URL`                  | yes              | Exact frontend origin                   |
| `RESEND_API_KEY`           | yes              | Or production SMTP config               |
| `EMAIL_FROM`               | yes              | Verified sender domain                  |
| `KASPI_CALLBACK_SECRET`    | yes              | Required for production callback safety |
| `SENTRY_DSN`               | recommended      | API error tracking                      |
| `S3_PRIVATE_BUCKET`        | yes              | Private docs and backups                |
| `S3_BUCKET`                | recommended      | Public images/avatars                   |
| `S3_ENDPOINT`              | if S3/R2         | R2/MinIO endpoint                       |
| `S3_PUBLIC_URL`            | if public bucket | CDN/base public URL                     |
| `AWS_ACCESS_KEY_ID`        | if S3/R2         | Storage credential                      |
| `AWS_SECRET_ACCESS_KEY`    | if S3/R2         | Storage credential                      |
| `BACKUP_TRIGGER_SECRET`    | yes              | Random, 32+ chars                       |
| `BACKUP_SCHEDULER_ENABLED` | no               | `false` on Render; cron job is primary  |

### Frontend production

| Variable          | Required    | Notes                              |
| ----------------- | ----------- | ---------------------------------- |
| `VITE_API_URL`    | yes         | Public API URL                     |
| `VITE_WS_URL`     | yes         | WebSocket URL, usually same as API |
| `VITE_SENTRY_DSN` | recommended | Web error tracking                 |

### GitHub Actions secrets

Required for real deploy:

| Secret                   | Used by                   |
| ------------------------ | ------------------------- |
| `RENDER_DEPLOY_HOOK_URL` | Trigger Render API deploy |
| `CLOUDFLARE_API_TOKEN`   | Deploy Cloudflare Worker  |
| `CLOUDFLARE_ACCOUNT_ID`  | Deploy Cloudflare Worker  |
| `VITE_API_URL`           | Build web                 |
| `VITE_WS_URL`            | Build web                 |
| `VITE_SENTRY_DSN`        | Optional web Sentry       |

Without these secrets CI can pass, but deploy workflow will fail at the guarded `test -n` checks.

## Деплой

### Первый deploy API на Render

1. Render -> New -> Blueprint.
2. Select repository `judo-arena`.
3. Render reads `render.yaml`.
4. Fill every `sync: false` variable.
5. Apply Blueprint.

Render creates:

- `judo-arena-api`
- `judo-backup` cron job
- `judo-arena-db`
- `judo-arena-redis`

`DATABASE_URL` and `REDIS_URL` are injected automatically by Render. Do not set them manually in Render unless intentionally replacing the managed services.

Expected API URL:

```text
https://judo-arena-api.onrender.com
```

### Первый deploy web на Cloudflare Workers

1. Create Cloudflare API token with Workers Scripts edit permission.
2. Add GitHub Actions secrets listed above.
3. Push to `main`.
4. Wait for CI.
5. Deploy workflow runs `wrangler deploy`.

Worker name is configured in `web/wrangler.jsonc`.

### После первого deploy

Update Render API environment:

```text
CORS_ORIGIN=https://your-worker-or-domain
APP_URL=https://your-worker-or-domain
```

Save changes and let Render restart the API.

### Автоматический deploy

```text
git push origin main
  -> CI
  -> deploy.yml after successful CI
  -> Render deploy hook
  -> Cloudflare Worker deploy
```

Production deploy blocked if CI fails.

## Production checklist

Перед реальным турниром:

1. `main` содержит только готовый код.
2. GitHub Actions CI проходит полностью.
3. GitHub Actions production secrets заполнены.
4. Render `sync: false` variables заполнены.
5. `CORS_ORIGIN` и `APP_URL` указывают на production frontend.
6. JWT secrets разные и длинные.
7. Email отправляется через Resend или production SMTP.
8. S3/R2 buckets доступны, private bucket не публичный.
9. Backup cron прошел успешно.
10. Restore проверен на non-production базе.
11. Sentry включен для API и web.
12. `/health` возвращает `status: ok`.
13. `npm run prod:smoke` проходит без ошибок.
14. API и Socket.IO load tests выдерживают минимум 2x ожидаемой нагрузки.
15. Проведен полный rehearsal турнира.

Full tournament rehearsal:

1. Admin creates tournament.
2. Admin creates categories.
3. Admin opens registration.
4. Coach submits application with athletes.
5. Admin approves applications.
6. Admin runs weigh-in and admits athletes.
7. Admin generates brackets.
8. Admin creates judge and tatami sessions.
9. Judge starts match and records score.
10. Match result propagates to bracket.
11. Tournament is completed.
12. Ratings are generated.
13. PDF bracket and final protocol download successfully.

Bad network rehearsal:

1. Open judge/tatami page.
2. Start a match.
3. Disconnect network for 10-20 seconds.
4. Reconnect.
5. Confirm the UI recovers.
6. Score after reconnect.
7. Confirm live bracket and tournament room update.

During event day keep open:

- Render API logs
- Render PostgreSQL metrics
- Redis metrics
- Cloudflare Workers deployment status
- Sentry API and Web issues
- `/health`

Stop the live event flow if DB or Redis is degraded.

## Backup и restore

Manual local backup:

```bash
docker compose --profile backup run --rm backup
```

Output:

```text
./backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

Restore:

```bash
./scripts/restore.sh ./backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

Production backup:

- Render cron uses `api/Dockerfile.backup`.
- Backups are stored in `S3_PRIVATE_BUCKET`.
- `BACKUP_TRIGGER_SECRET` is for manual fallback trigger.
- Backup before tournament day, before manual DB changes and after final protocols are generated.

## Rollback

Frontend:

```text
Cloudflare Workers -> judo-arena -> Deployments -> Rollback
```

Backend:

```bash
git revert HEAD
git push origin main
```

Or use Render dashboard:

```text
Render -> API service -> Deploys -> previous deploy -> Redeploy
```

## Demo accounts

| Role    | Email                            | Password      |
| ------- | -------------------------------- | ------------- |
| Admin   | `admin@judo-arena.kz`            | `password123` |
| Coach   | `coach.almaty@judo-arena.kz`     | `password123` |
| Athlete | `m0-0@almaty-judo.judo-arena.kz` | `password123` |

Demo accounts are for local and staging checks only.

## Troubleshooting

### Docker daemon is not running

Open Docker Desktop and wait until containers can start:

```bash
docker ps
```

### Port 5433 or 6379 is busy

Check the process:

```bash
lsof -i :5433
lsof -i :6379
```

Stop the conflicting local service or change local ports in `docker-compose.yml`.

### Port 4000 is busy

```bash
lsof -ti:4000 | xargs kill -9
```

Then restart API:

```bash
npm run dev:api
```

### API cannot find `DATABASE_URL`

Create `api/.env`:

```bash
cp .env.example api/.env
```

Then run:

```bash
npm run db:migrate
npm run db:seed
```

### PostgreSQL container does not start

Check logs:

```bash
docker logs judo-postgres
```

If local data can be deleted:

```bash
docker compose down -v
docker compose up -d
npm run db:migrate
npm run db:seed
```

### Production deploy failed after CI success

Check GitHub Actions -> Deploy. Common causes:

- Missing `RENDER_DEPLOY_HOOK_URL`.
- Missing `CLOUDFLARE_API_TOKEN`.
- Missing `CLOUDFLARE_ACCOUNT_ID`.
- Missing `VITE_API_URL` or `VITE_WS_URL`.
- Render `sync: false` variables are not filled.

### `/health` is degraded

Expected healthy response:

```json
{
  "status": "ok",
  "checks": {
    "db": "ok",
    "redis": "ok",
    "s3": "ok",
    "email": "resend"
  }
}
```

If status is `degraded`, check DB, Redis, S3 and email provider before continuing a live event.
