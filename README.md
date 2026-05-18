# 🥋 Judo-Arena

**Веб-платформа автоматизации соревнований по дзюдо**

Полный цикл организации турнира: регистрация спортсменов → подача заявок клубами → генерация турнирных сеток по правилам IJF → real-time судейство с мобильной панели → автоматическое начисление рейтинга → PDF-протоколы.

**Автор:** Жанетта · **Учебное заведение:** Astana IT University College · **Год:** 2026

---

## ⚡ Быстрый старт

```bash
cd ~/Desktop/judo-arena
./start.sh
```

Скрипт автоматически: проверит окружение, поднимет Docker (Postgres + Redis + Mailpit), установит зависимости api и web, применит миграции, засеет тестовые данные, и запустит **backend** (порт 4000) + **frontend** одновременно.

В браузере фронтенд обычно открывается на `http://localhost:8080` или `5173` (Vite сам подскажет в логах).

**Демо-логины** (на странице `/login` есть 3 кнопки):
- `admin@judo-arena.kz` · `password123` — администратор
- `coach.almaty@judo-arena.kz` · `password123` — тренер
- `m0-0@almaty-judo.judo-arena.kz` · `password123` — спортсмен

---

## 🏗 Архитектура

```
┌────────────────────────────────────────────────────────────────┐
│  Frontend (web/)                  Backend (api/)               │
│  ────────────────                 ────────────────             │
│  • Vite + React 19 + TS           • Fastify + TypeScript       │
│  • TanStack Router (file-based)   • Prisma 5 (ORM)             │
│  • TanStack Query                 • Socket.IO (real-time)      │
│  • Tailwind CSS v4                • JWT + bcrypt + RBAC        │
│  • shadcn/ui                      • Zod (validation)           │
│  • react-i18next (RU/KZ/EN)       • PDFKit                     │
│  • Cloudflare Pages (deploy)      • Render (deploy)            │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  PostgreSQL 16  +  Redis 7  +  Mailpit  (Docker Compose)       │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Возможности

### По ролям

- **👤 ATHLETE** — спортсмен: профиль, история матчей, рейтинг, расписание.
- **🥋 COACH** — тренер: управление клубом, прокси-регистрация спортсменов, подача заявок на турниры.
- **⚖️ JUDGE** — судья без аккаунта. Одноразовый URL `/judge/<token>` (TTL 12 ч) → мобильная панель IJF.
- **👑 ADMIN** — турниры, категории, генерация сеток, override результатов с rollback, AuditLog, финализация → автоматический рейтинг + PDF.

### Технические фичи

- **Многоязычность RU / KZ / EN** через `react-i18next`. Хранится в localStorage + профиле через API.
- **Bracket Engine:** Single Elimination + IJF Repechage (с 2 бронзовыми) + Round-Robin (с тай-брейкерами).
- **Seeding:** Fisher-Yates с детерминированным seed + разделение одноклубников по четвертям.
- **Osaekomi (удержание):** серверный таймер — 5 сек = Yuko, 10 сек = Waza-ari, 20 сек = Ippon. Защита от читерства.
- **Auto-finish IJF:** Ippon → мгновенная победа, 2×Waza-ari → Ippon, 3×Shido → Hansoku-make.
- **Propagate:** победитель автоматически продвигается в следующий матч сетки.
- **Admin Override + Rollback:** рекурсивно откатывает downstream-цепочку с AuditLog.
- **Real-time через Socket.IO:** комнаты `tournament:{id}`, `tatami:{n}`, `bracket:{id}`.
- **PDF:** сетка (после генерации) и итоговый протокол (после COMPLETED).
- **Rating:** автоматическое начисление 100/80/50/30/15/0 за места.

---

## 📂 Структура проекта

```
judo-arena/
├── api/                          Backend (Fastify + Prisma)
│   ├── prisma/schema.prisma      15 таблиц
│   ├── prisma/seed.ts            4 клуба + 37 пользователей + 1 турнир
│   └── src/
│       ├── server.ts
│       ├── lib/                  env, prisma, redis, jwt, refresh-store
│       ├── middlewares/          authenticate, authorize (RBAC)
│       ├── validators/           Zod
│       ├── services/             Бизнес-логика
│       │   ├── auth, club, tournament, application
│       │   ├── bracket.service.ts
│       │   ├── bracket-engine/   seeding, single-elimination, round-robin + Vitest тесты
│       │   ├── match.service.ts  + Osaekomi таймер
│       │   ├── judge-session.service.ts
│       │   ├── admin-override.service.ts (Override + Rollback)
│       │   ├── audit.service.ts
│       │   ├── rating.service.ts
│       │   └── pdf.service.ts
│       ├── sockets/io.ts         Socket.IO
│       └── routes/               65+ эндпоинтов
├── web/                          Frontend (TanStack Start)
│   └── src/
│       ├── lib/
│       │   ├── api.ts            Типизированный API клиент + auto-refresh
│       │   ├── auth-store.ts
│       │   ├── protected-route.tsx
│       │   └── i18n.ts
│       ├── shared/locales/       kk.json + ru.json + en.json
│       ├── components/dashboard/DashboardShell.tsx
│       └── routes/               File-based роутинг
│           ├── index, login, tournaments, tournaments.$id
│           ├── rankings, protocol, about
│           ├── judge.tsx, judge.$token.tsx
│           ├── athlete.{tsx,index,profile,tournaments,results,notifications}
│           ├── coach.{tsx,index,athletes,applications,tournaments,notifications}
│           └── admin.{tsx,index,tournaments,clubs,applications,matches,users,audit,settings}
├── docker-compose.yml            Postgres + Redis + Mailpit
├── start.sh                      ⚡ Одна команда — запуск всего
├── diagnose.sh                   Диагностика логина
├── demo-e2e.sh                   E2E: заявки → одобрение → сетка
├── demo-match.sh                 Прогон матча (Hajime → Osaekomi → Ippon)
├── BACKEND_MODULES.md            Обзор 9 backend-модулей
├── ROLES_ACTIONS.md              Действия по ролям
└── DAILY_COMMANDS.md             Шпаргалка команд
```

---

## 🛠 База данных (15 таблиц)

`User` · `Club` · `ClubGroup` · `Tournament` · `Category` · `Application` · `ApplicationEntry` · `Bracket` · `Match` · `MatchEvent` · `JudgeSession` · `RatingEntry` · `Notification` · `AuditLog` · `SystemConfig`

---

## 🌐 Многоязычность

3 языка с переключателем в шапке dashboard:
- 🇰🇿 **Қазақша** (default)
- 🇷🇺 **Русский**
- 🇬🇧 **English**

Сохраняется в `localStorage` + в профиле через `PATCH /api/auth/me/locale`.

---

## 🧪 Тесты

```bash
cd api
npm test
```

Покрывают: `nextPowerOfTwo`, `seedAthletes` (Fisher-Yates + разделение клубов + детерминизм), `buildSingleElimination` (сетки 4/8 + Repechage), `propagateResult` (продвижение + bronze routing), `buildRoundRobin`, `computeStandings` (тай-брейкеры).

---

## 📜 Документация

| Файл | О чём |
|---|---|
| `BACKEND_MODULES.md` | Полный обзор 9 backend-модулей + 65+ эндпоинтов |
| `ROLES_ACTIONS.md` | Действия по каждой роли |
| `DAILY_COMMANDS.md` | Утренний/вечерний цикл + аварийные команды |
| `PLAN.md` | План разработки на 17 дней |
| `TZ_v2.md` | Финальное техническое задание |
| `SETUP_DOCKER.md` | Установка Docker |
| `SETUP_PGADMIN.md` | Подключение pgAdmin |

---

## 🎬 Сценарий для защиты (5 минут)

1. **Открыть** `localhost:8080` → главная → переключить язык KZ → RU → EN
2. **Логин ADMIN** → дашборд с метриками, live матчи (auto-refresh 5 сек)
3. **Создать новый турнир** через форму → добавить категорию (мужчины −73 кг, SE+Repechage)
4. **Логин COACH** → подать заявку → добавить спортсменов
5. **Логин ADMIN** → одобрить заявку → закрыть регистрацию → **сгенерировать сетку**
6. **Скачать PDF сетки** (расписание для участников)
7. **Открыть `/judge/<token>`** на телефоне → провести матч:
   HAJIME → Osaekomi (10+ сек) → авто-Waza-ari → IPPON → авто-победа + propagate
8. **ADMIN → Финализировать турнир** → автоматическое начисление рейтинга
9. **Скачать PDF протокола** → официальный документ с медалистами
10. **`/rankings`** → топ-спортсменов с очками
11. **Override результата** → показать каскадный rollback в AuditLog

---

## 🚀 Деплой (production)

### Frontend → Cloudflare Pages
```bash
cd web
npx wrangler pages deploy
```

### Backend → Render
1. Web Service на render.com, root = `api/`
2. Build: `npm install && npx prisma generate && npm run build`
3. Start: `node dist/server.js`
4. Postgres + Redis add-ons
5. Прописать env из `.env.example`

### Локально на флешке (для защиты без интернета)
```bash
./start.sh
```

---

## ⚖️ Лицензия

MIT — учебный дипломный проект Astana IT University College.

---

🥋 **Made with care for Kazakh judo community.**
