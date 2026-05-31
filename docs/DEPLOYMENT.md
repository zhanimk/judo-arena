# Deployment Runbook — Judo-Arena

## Архитектура

```
Cloudflare Pages (web)  ←→  Render (api)  ←→  Render PostgreSQL + Redis
                                  ↓
                           Sentry (errors)
```

---

## Переменные окружения

### Backend (`api/`) — Render

| Переменная | Обязательно | Описание |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `JWT_ACCESS_SECRET` | ✅ | Минимум 32 символа. `openssl rand -hex 48` |
| `JWT_REFRESH_SECRET` | ✅ | Другой ключ, тоже ≥32 символов |
| `JWT_ACCESS_TTL` | — | Default: `15m` |
| `JWT_REFRESH_TTL` | — | Default: `7d` |
| `API_PORT` | — | Default: `4000` (Render управляет через `PORT`) |
| `API_HOST` | — | Default: `0.0.0.0` |
| `NODE_ENV` | ✅ | `production` |
| `CORS_ORIGIN` | ✅ | URL фронтенда: `https://judo-arena.pages.dev` |
| `APP_URL` | ✅ | То же, что `CORS_ORIGIN` |
| `SMTP_HOST` | ✅ | Например, `smtp.sendgrid.net` |
| `SMTP_PORT` | — | Default: `587` |
| `SMTP_USER` | ✅ | SMTP логин |
| `SMTP_PASS` | ✅ | SMTP пароль |
| `EMAIL_FROM` | — | Default: `Judo-Arena <noreply@judo-arena.kz>` |
| `UPLOADS_DIR` | — | Default: `./uploads` |
| `SENTRY_DSN` | — | Sentry DSN (sentry.io) |

### Frontend (`web/`) — Cloudflare Pages

| Переменная | Описание |
|---|---|
| `VITE_API_URL` | URL backend: `https://api.judo-arena.kz` |
| `VITE_WS_URL` | WebSocket: `wss://api.judo-arena.kz` |
| `VITE_SENTRY_DSN` | Sentry DSN для React-проекта |

---

## Первый деплой

### 1. Render (Backend)

```bash
# 1. Создай сервис на render.com → Web Service → Deploy from GitHub
# 2. Build Command:
cd api && npm ci && npm run build && npx prisma migrate deploy

# 3. Start Command:
node api/dist/server.js

# 4. Добавь все переменные из таблицы выше
```

### 2. Cloudflare Pages (Frontend)

```bash
# 1. Создай проект на pages.cloudflare.com → Connect to Git
# 2. Build settings:
#    Framework preset: None
#    Build command: cd web && npm ci && npm run build
#    Build output: web/dist
#    Root directory: / (корень репо)
# 3. Добавь переменные окружения VITE_* в настройках Pages
```

### 3. Seed начальных данных

```bash
# Создать первого администратора (запустить после первой миграции):
cd api && npx tsx prisma/seed.ts

# Или вручную через Prisma Studio:
cd api && npx prisma studio
```

---

## Обновление (zero-downtime)

```bash
# GitHub Actions автоматически запускает деплой при пуше в main.
# Ручной запуск:

# 1. Миграции (Render запустит в build command):
cd api && npx prisma migrate deploy

# 2. Если миграция не применилась автоматически:
curl -X POST "$RENDER_DEPLOY_HOOK_URL"
```

---

## Rollback

### Быстрый откат кода

```bash
# 1. Найти нужный коммит:
git log --oneline -10

# 2. Создать rollback ветку:
git checkout -b rollback/v1.2.3 <commit-sha>
git push origin rollback/v1.2.3

# 3. На Render — переключить деплой на rollback-ветку
# 4. На Cloudflare Pages — выбрать предыдущий деплой → Rollback
```

### Откат миграции БД

```bash
# ⚠️ Prisma не поддерживает автоматический rollback миграций!
# Нужно вручную написать reverse-SQL.

# 1. Найти SQL файл миграции в api/prisma/migrations/
# 2. Написать обратные изменения (например: DROP COLUMN вместо ADD COLUMN)
# 3. Применить через psql:
psql $DATABASE_URL -f rollback.sql

# 4. Удалить запись из таблицы _prisma_migrations:
psql $DATABASE_URL -c "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20260525_add_match_version';"
```

---

## Backup / Restore

### Ручной backup

```bash
./scripts/backup.sh
# Файл появится в ./backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

### Restore из backup

```bash
./scripts/restore.sh ./backups/backup_20260525_020000.sql.gz
```

### Автоматический backup (cron)

```bash
# Добавить в crontab (sudo crontab -e):
# Каждый день в 02:00:
0 2 * * * cd /opt/judo-arena && ./scripts/backup.sh >> /var/log/judo-backup.log 2>&1
```

---

## Мониторинг

### Логи

```bash
# Render: Dashboard → Logs (real-time streaming)
# Каждая строка содержит reqId для трассировки ошибок
```

### Sentry

```
https://sentry.io → Ваш проект → Issues
```

Настроить алерты: `Alerts → Create Alert Rule → When error count > 5 in 1 hour → Send email`

### Health check

```bash
curl https://api.judo-arena.kz/health
# → {"status":"ok","db":"connected","timestamp":"..."}
```

---

## Частые проблемы

| Проблема | Причина | Решение |
|---|---|---|
| `DATABASE_URL invalid` | Неверный connection string | Проверь `?schema=public` в конце |
| `JWT_ACCESS_SECRET too short` | Секрет < 32 символов | `openssl rand -hex 48` |
| Миграции не применились | Build command не включает migrate | Добавить `npx prisma migrate deploy` в build |
| CORS ошибка | `CORS_ORIGIN` не совпадает с URL фронта | Указать точный origin без trailing slash |
| Socket.IO не подключается | Разные origins у API и WS | `VITE_WS_URL` должен совпадать с `VITE_API_URL` (без `/api`) |
