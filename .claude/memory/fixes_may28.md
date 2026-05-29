---
name: fixes-may28
description: Production hardening 28 мая — безопасность, S3, osaekomi timer, E2E тесты
metadata:
  type: project
---

Реализовано 28 мая (полный прод-добив):

**Backend:**
- AsyncLocalStorage для IP/UA в каждый AuditLog автоматически (`lib/request-context.ts`)
- Socket.IO JWT-верификация на handshake + блокировка `user:*` для чужих токенов
- Rate limits: `/register` 5/15min, `/forgot-password` 3/hour
- S3-абстракция файлов (`lib/storage.ts`) — local fallback + S3/R2/MinIO через env
- Health check расширен: Redis check + version поле
- Notification filters: `?type=` и `?unreadOnly=true` в `GET /api/notifications`
- Phone validation: regex `/^\+?[1-9]\d{6,14}$/` в auth + club validators
- MIXED bracket: явная 400-ошибка вместо тихого игнора
- Bulk CSV import: `POST /api/clubs/:id/athletes/bulk-import` до 200 строк, 207 Multi-Status
- **Osaekomi server-side timer** (`services/osaekomi-timer.service.ts`):
  - scheduleOsaekomiTimer / cancelOsaekomiTimer
  - Авто-endOsaekomi через 20 сек если судья не нажал TOKETA
  - restoreActiveTimers() при рестарте сервера

**Frontend:**
- Socket.IO передаёт accessToken на handshake; переподключается при смене токена
- Error Boundaries на layout-роутах `/admin`, `/athlete`, `/coach`
- Notification filter UI: pill-фильтры (Барлығы / Оқылмаған / типы) у спортсмена и тренера
- Bulk CSV import UI в coach/club с шаблоном и отчётом об ошибках

**E2E тесты (Playwright):**
- `e2e/smoke.test.ts` — 35 тестов: public pages, auth, admin/coach/athlete dashboards, route protection, API health

**Why:** систематическое production hardening перед деплоем.
**How to apply:** все изменения уже в коде, 164/164 unit-тестов зелёных.
