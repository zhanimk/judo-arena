# Техническое задание Judo-Arena (версия 2.1, утверждённое)

**Проект:** Веб-платформа автоматизации соревнований по дзюдо "Judo-Arena"
**Автор:** Жанетта
**Учебное заведение:** Astana IT University College
**Дата утверждения:** 14 мая 2026 (v2.1)
**Дедлайн:** 31 мая 2026

> Этот документ — обновлённая редакция ТЗ v1 (40 стр.).
>
> **Изменения в v2.1 относительно ТЗ v1:**
> - Финальный стек: **Vite + React** (вместо Next.js) — на базе Lovable-прототипа.
> - Добавлена **многоязычность RU / KZ / EN** через react-i18next.
> - Добавлен **второй формат турнира — Round-Robin (круговая система)** в дополнение к Single Elimination + IJF Repechage.
> - Расширена система начисления очков: бонусы за способ победы (Ippon / Waza-ari / решение судей).

---

## 1. Цели и задачи

Создать профессиональную fullstack-веб-платформу для полного цикла организации соревнований по дзюдо: от регистрации клубов и спортсменов до проведения матчей в реальном времени с генерацией сеток по правилам IJF, судейским модулем, поддержкой двух форматов турниров (Single Elimination + Round-Robin) и автоматическим формированием рейтингов и протоколов на трёх языках (русский, казахский, английский).

---

## 2. Роли пользователей (RBAC)

| Роль | Возможности |
|---|---|
| **ATHLETE** | Просмотр своего профиля, истории матчей, рейтинга, расписания категорий. |
| **COACH** | Управление клубом, прокси-регистрация спортсменов, подача заявок на турнир. |
| **JUDGE** | **Без аккаунта.** Получает одноразовую ссылку с временным токеном (TTL ~12 ч), ведёт матч с панели IJF. |
| **ADMIN** | Полный контроль: турниры, категории, заявки, override результатов, rollback, очередь татами, аудит, экспорт PDF. |

---

## 3. Финальный стек

### Frontend (Vite + React)
- Vite 5 + React 18 + TypeScript 5 (на базе Lovable-прототипа).
- Tailwind CSS 3 + shadcn/ui.
- React Router v6.
- TanStack Query v5.
- Zustand 4.
- React Hook Form + Zod.
- Socket.IO Client v4.
- **react-i18next** — многоязычность RU / KZ / EN.
- lucide-react, date-fns.

### Backend (Fastify + Prisma)
- Fastify 4 + TypeScript 5.
- Prisma 5 (ORM, миграции, Studio).
- Socket.IO 4.
- JWT + bcrypt.
- Zod (общие схемы с фронтом).
- PDFKit + Puppeteer.
- Nodemailer.

### Инфраструктура
- PostgreSQL 16, Redis 7 — Docker.
- Деплой: Vercel (фронт) + Render (бэк + БД).
- Локальный fallback: docker-compose.

---

## 4. Многоязычность (i18n) — **новое в v2.1**

### Поддерживаемые языки
- **Русский (ru)** — язык по умолчанию.
- **Казахский (kk)** — обязательно (диплом в Казахстане).
- **Английский (en)** — для международного использования.

### Реализация
- Библиотека: **react-i18next** + i18next-browser-languagedetector.
- Файлы переводов: `client/src/shared/locales/{ru,kk,en}/{common,auth,tournament,judge,admin}.json`.
- Переключатель языков в шапке (флаги или сокращения 🇷🇺 RU / 🇰🇿 KZ / 🇬🇧 EN).
- Выбор сохраняется в localStorage.
- Все UI-тексты — через `t('ключ')`, никаких хардкод-строк.
- Email-уведомления — на языке получателя (поле `User.preferredLocale`).
- PDF-документы (дипломы, протоколы) — на языке турнира (поле `Tournament.locale`).

### База данных
- Поля `name`, `description` в **Tournament**, **Category**, **Club** — мультиязычные через JSON-структуру:
  ```json
  { "ru": "Кубок Алматы 2026", "kk": "Алматы кубогі 2026", "en": "Almaty Cup 2026" }
  ```
- При создании сущности заполняются на одном языке, потом админ может перевести.
- Имена и фамилии спортсменов — отдельные поля для кириллицы и латиницы (`name`, `surname`, `nameLatin`, `surnameLatin`).

---

## 5. Форматы турниров — **расширено в v2.1**

В системе поддерживается **два формата** проведения турнира в одной категории. Формат выбирается админом при создании категории.

### 5.1 Single Elimination + IJF Repechage (основной)

Классический олимпийский формат дзюдо:
1. Размер сетки — степень двойки (4/8/16/32/64), BYE-слоты при недоборе.
2. Fisher-Yates seeding с эвристикой разделения клубов в первый раунд.
3. Раунды: 1/32 → 1/16 → 1/8 → 1/4 → 1/2 → Финал.
4. **Repechage:** проигравшие 1/4 финала идут в зону Repechage.
5. **Две бронзы:** победитель Repechage A vs проигравший полуфинала 1; победитель Repechage B vs проигравший полуфинала 2.
6. Места: 1, 2, 3, 3, 5, 5, 7, 7, остальные — участие.

### 5.2 Round-Robin (круговая система) — **новое**

Каждый с каждым в одной группе:
1. Применимо к категориям с ≤ 8 участниками (иначе слишком много матчей).
2. Все участники играют со всеми — N×(N−1)/2 матчей.
3. Подсчёт очков по таблице (см. раздел 6).
4. Места распределяются по сумме очков.
5. **Тай-брейкеры** при равенстве очков (по порядку):
   - Личная встреча.
   - Сумма Ippon-побед.
   - Сумма Waza-ari.
   - Разница чистых очков (заработанных − полученных).
   - Жребий.
6. Места: 1, 2, 3, 4, 5, 6, 7, 8.

### 5.3 Mixed (групповой этап + плей-офф) — опционально, если останется время

- Группы по 4 → top-2 выходят в плей-офф single elimination.
- Реализуется только если основные форматы готовы досрочно.

---

## 6. Система начисления очков — **уточнено в v2.1**

### Внутри одного матча (по правилам IJF 2018+)

| Действие | Эффект |
|---|---|
| **Ippon** | Мгновенная победа. Засчитывается 10 очков для рейтинга. |
| **Waza-ari** | 1 очко в матче. Два Waza-ari = Ippon = победа. |
| **Юко** | **Отменено в правилах IJF 2017**, по умолчанию выключено в системе (можно включить флагом для региональных правил). |
| **Shido (предупреждение)** | 1-й и 2-й — предупреждение. 3-й Shido = Hansoku-make = поражение. |
| **Hansoku-make (дисквалификация)** | Поражение, в серьёзных случаях — снятие с турнира. |
| **Golden Score** | После основного времени при ничьей. Без лимита, до первого Waza-ari/Ippon/Shido. |

### Итоговые очки для турнирного рейтинга

| Место | Очки в рейтинг |
|---|---|
| 1 (золото) | 10 |
| 2 (серебро) | 7 |
| 3 (бронза, оба призёра) | 5 |
| 5 (после полуфинала проигравшие) | 3 |
| 7 (после Repechage проигравшие) | 1 |
| Участие | 0 |

> Эти значения вынесены в админскую настройку (`SystemConfig.ratingPoints`) — можно скорректировать для региональных правил.

### Бонусы за способ победы (опционально)

В админ-настройках можно включить бонусы:
- +1 очко за Ippon-победу.
- +0.5 очка за досрочную победу.

Эти бонусы суммируются с базовыми очками за место.

---

## 7. Структура БД (Prisma schema) — **обновлено в v2.1**

15 таблиц (было 13 + добавлено SystemConfig и MatchEvent):

1. **User** — id, email, passwordHash, role, name, surname, nameLatin?, surnameLatin?, dateOfBirth, gender, clubId?, preferredLocale (ru|kk|en), createdAt
2. **Club** — id, name (JSON), city, country, logoUrl, createdById
3. **ClubGroup** — id, clubId, name, ageMin, ageMax
4. **Tournament** — id, name (JSON), description (JSON), location, startDate, endDate, status, tatamiCount, locale (default ru), createdById
5. **Category** — id, tournamentId, gender, ageMin, ageMax, weightMin, weightMax, matchDurationSec, goldenScoreSec, format (SE_IJF | ROUND_ROBIN | MIXED)
6. **Application** — id, tournamentId, clubId, status, submittedAt
7. **ApplicationEntry** — id, applicationId, athleteId, categoryId
8. **Bracket** — id, tournamentId, categoryId, size, format, generatedAt
9. **Match** — id, bracketId, round, position, redAthleteId?, blueAthleteId?, tatamiNumber?, status, winnerId?, winnerScore (JSON: { red:{ippon, wazaari, shido}, blue:{...}, time }), startedAt, finishedAt, isReplay, isGoldenScore
10. **MatchEvent** — id, matchId, type (HAJIME | MATE | IPPON | WAZAARI | SHIDO | HANSOKU | GOLDEN_SCORE | END), actor (red|blue|system), timestamp — **новое: полный лог событий для replay и аудита**
11. **JudgeSession** — id, matchId, token, expiresAt, isUsed
12. **RatingEntry** — id, athleteId, tournamentId, categoryId, place, points (decimal — поддерживает бонусы), awardedAt
13. **Notification** — id, userId, type, payload (JSON), read, createdAt, locale
14. **AuditLog** — id, actorUserId, action, targetEntity, targetId, before (JSON), after (JSON), createdAt
15. **SystemConfig** — key, value (JSON) — **новое: системные настройки (очки, бонусы, правила)**

---

## 8. Ключевые API-эндпоинты

```
/auth            register, login, refresh, logout, me, set-locale
/users           CRUD (admin), профиль (self)
/clubs           CRUD, members, addAthlete
/club-groups     CRUD
/tournaments     CRUD, lifecycle, publish, set-locale
/categories      CRUD (с выбором format: SE_IJF | ROUND_ROBIN)
/applications    submit, list, approve, reject
/brackets        generate (single-elim или round-robin), get
/matches         get, list by tatami, history, events
/judge-sessions  create, validate, useToken
/admin/matches   override (with rollback)
/ratings         athlete, leaderboard, leaderboard-by-club
/audit-logs      list, filter
/notifications   list, markRead
/system-config   get, update (admin only)
/i18n            list-locales (метаданные о доступных языках)
```

---

## 9. Socket.IO события

**Комнаты:** `tatami:{n}`, `tournament:{id}`, `user:{id}`, `bracket:{id}`.

**События:**
- `match:scoreUpdate` — изменения счёта (Waza-ari, Shido и т.д.)
- `match:event` — атомарное событие (для лога)
- `match:started`, `match:finished`
- `bracket:update` — продвижение по сетке или обновление таблицы Round-Robin
- `tatami:queueUpdate`
- `notification:created`

---

## 10. Нефункциональные требования

- REST p95 ≤ 300 мс, генерация сетки ≤ 1 сек для 512 участников, WebSocket ≤ 200 мс.
- До 20 татами одновременно.
- Адаптивный UI от 320 px.
- Полная клавиатурная доступность для судейской панели.
- HTTPS в проде, secure cookies.
- Все секреты — в .env.

---

## 11. Критерии приёмки

- [ ] Локальный запуск через `docker-compose up && npm run dev:all`.
- [ ] Сайт доступен по публичной ссылке.
- [ ] Переключатель языков RU / KZ / EN работает во всех ключевых местах (главная, регистрация, дашборды, судейская панель, табло).
- [ ] Дашборд для каждой из 4 ролей.
- [ ] E2E-сценарий **Single Elimination**: admin создаёт турнир → coach подаёт заявку → admin одобряет → генерируется сетка на 8 участников → 7 матчей с repechage → формируется протокол с 1/2/3/3 → PDF-диплом.
- [ ] E2E-сценарий **Round-Robin**: категория на 4 участников → 6 матчей → таблица с очками → разрешение тай-брейкеров → итоговые места.
- [ ] Admin Override + Rollback работают для обоих форматов.
- [ ] Real-time табло обновляется в обоих форматах.
- [ ] README с инструкцией + скриншотами + ссылками на демо.

---

## 12. Что НЕ входит в MVP

- Платежи и платная регистрация.
- Видеозаписи матчей.
- Нативное мобильное приложение.
- Интеграция с IJF/FIJ API.
- Антидопинг.
- Турниры в формате "ката" (только "кумитэ").
