# 📘 Judo-Arena — Backend модули

Полный обзор того что у нас сейчас работает. Каждый модуль — отдельный раздел: что делает, какие эндпоинты, кто имеет доступ, workflow.

> Все защищённые эндпоинты требуют JWT в заголовке `Authorization: Bearer <token>`.
> Судья использует `X-Judge-Token: <token>` вместо JWT (только для своего матча).

---

## 1. 🔐 Auth (Аутентификация и роли)

**Файлы:** `services/auth.service.ts`, `routes/auth.routes.ts`, `middlewares/{authenticate,authorize}.ts`

### Что делает
JWT-аутентификация с Access (15 мин) + Refresh (7 дней, httpOnly cookie) с ротацией. RBAC по 4 ролям: **ATHLETE / COACH / JUDGE / ADMIN**. Refresh-токены хранятся в Redis — можно отзывать.

### Эндпоинты

| Метод | URL | Кто | Что |
|---|---|---|---|
| POST | `/api/auth/register` | public | Регистрация ATHLETE или COACH (ADMIN/JUDGE не регистрируются) |
| POST | `/api/auth/login` | public | Вход, выдаёт accessToken + refresh cookie |
| POST | `/api/auth/refresh` | public (cookie) | Ротация токенов |
| POST | `/api/auth/logout` | public | Выход с этой сессии |
| POST | `/api/auth/logout-all` | auth | Выход со всех устройств |
| GET | `/api/auth/me` | auth | Текущий пользователь |
| PATCH | `/api/auth/me/locale` | auth | Сменить язык (ru / kk / en) |

### Workflow
1. Спортсмен или тренер регистрируется → автоматически залогинен.
2. ADMIN создаётся только через seed (не самостоятельно).
3. JUDGE не имеет аккаунта — у него временный токен сессии (см. модуль Matches).

---

## 2. 🥋 Clubs (Клубы и спортсмены)

**Файлы:** `services/club.service.ts`, `routes/club.routes.ts`

### Что делает
CRUD клубов с мультиязычными названиями. Группы клуба по возрастам. Прокси-регистрация: тренер создаёт аккаунт спортсмена своего клуба.

### Эндпоинты

| Метод | URL | Кто | Что |
|---|---|---|---|
| GET | `/api/clubs` | public | Список клубов с фильтрами (city, search) |
| GET | `/api/clubs/:id` | public | Детали клуба со списком групп |
| POST | `/api/clubs` | COACH / ADMIN | Создать клуб (тренер автоматически становится участником) |
| PATCH | `/api/clubs/:id` | COACH-владелец / ADMIN | Изменить |
| DELETE | `/api/clubs/:id` | ADMIN | Удалить |
| GET | `/api/clubs/:id/groups` | public | Возрастные группы клуба |
| POST | `/api/clubs/:id/groups` | COACH-владелец / ADMIN | Создать группу (юниоры, взрослые и т.д.) |
| PATCH | `/api/club-groups/:id` | COACH-владелец / ADMIN | Изменить группу |
| DELETE | `/api/club-groups/:id` | COACH-владелец / ADMIN | Удалить группу |
| GET | `/api/clubs/:id/members` | public | Список спортсменов клуба |
| POST | `/api/clubs/:id/athletes` | COACH своего клуба / ADMIN | **Прокси-регистрация** нового спортсмена |
| PATCH | `/api/athletes/:id` | self / COACH клуба / ADMIN | Изменить профиль спортсмена |
| DELETE | `/api/athletes/:id/club` | COACH клуба / ADMIN | Отвязать спортсмена от клуба |

### Правила
- COACH может управлять **только своим** клубом.
- Спортсмен сам может редактировать только свой профиль (без поля `clubId` — это меняет только тренер).
- Удалить клуб может только ADMIN (отвязывает всех участников, но не удаляет их).

---

## 3. 🏆 Tournaments (Турниры)

**Файлы:** `services/tournament.service.ts`, `routes/tournament.routes.ts`

### Что делает
CRUD турниров с lifecycle. Категории под каждым турниром (полностью гибкие — админ сам задаёт пол, возраст, вес, формат, длительность матча).

### Эндпоинты турниров

| Метод | URL | Кто | Что |
|---|---|---|---|
| GET | `/api/tournaments` | public | Список (фильтры: status, city, upcoming) |
| GET | `/api/tournaments/:id` | public | Детали + категории |
| POST | `/api/tournaments` | ADMIN | Создать (статус DRAFT) |
| PATCH | `/api/tournaments/:id` | ADMIN | Изменить (даты нельзя менять у IN_PROGRESS/COMPLETED) |
| DELETE | `/api/tournaments/:id` | ADMIN | Только DRAFT/CANCELLED |
| POST | `/api/tournaments/:id/status` | ADMIN | Сменить статус |

### Lifecycle турнира

```
DRAFT  ──→  REGISTRATION_OPEN  ──→  REGISTRATION_CLOSED  ──→  IN_PROGRESS  ──→  COMPLETED
   ↘                    ↘                       ↘                  ↘
    └──────────────────── CANCELLED ─────────────────────────────────┘
                          ↓
                        DRAFT (можно начать заново)
```

**Правила переходов** (валидация на сервере):
- DRAFT → REGISTRATION_OPEN (нужны категории, нельзя открыть пустой турнир)
- REGISTRATION_OPEN ↔ REGISTRATION_CLOSED (можно открывать/закрывать)
- REGISTRATION_CLOSED → IN_PROGRESS
- IN_PROGRESS → COMPLETED (через `/api/admin/tournaments/:id/finalize` — см. модуль 8)
- Из любого → CANCELLED

### Категории — эндпоинты

| Метод | URL | Кто | Что |
|---|---|---|---|
| GET | `/api/tournaments/:id/categories` | public | Список категорий |
| POST | `/api/tournaments/:id/categories` | ADMIN | Создать категорию (только в DRAFT) |
| PATCH | `/api/categories/:id` | ADMIN | Изменить (только пока турнир DRAFT) |
| DELETE | `/api/categories/:id` | ADMIN | Удалить (только в DRAFT) |

**Поля категории**: пол, возраст от/до, вес от/до, длительность матча (сек), длительность Golden Score, **формат** (`SE_IJF` | `ROUND_ROBIN` | `MIXED`), allowYuko (флаг старого правила).

> Категории создаются **гибко** — каждый турнир имеет свой набор. Никаких фиксированных значений.

---

## 4. 📝 Applications (Заявки клубов на турнир)

**Файлы:** `services/application.service.ts`, `routes/tournament.routes.ts`

### Что делает
Workflow заявки клуба на турнир. Тренер собирает спортсменов в категории, отправляет — админ одобряет.

### Эндпоинты

| Метод | URL | Кто | Что |
|---|---|---|---|
| GET | `/api/tournaments/:id/applications` | COACH (своего клуба) / ADMIN | Список заявок |
| POST | `/api/tournaments/:id/applications` | COACH | Создать DRAFT (или вернуть существующую) |
| GET | `/api/applications/:id` | COACH-владелец / ADMIN | Детали заявки со списком спортсменов |
| POST | `/api/applications/:id/entries` | COACH-владелец / ADMIN | Добавить спортсмена в категорию |
| DELETE | `/api/applications/:id/entries/:entryId` | COACH-владелец / ADMIN | Убрать спортсмена |
| POST | `/api/applications/:id/submit` | COACH-владелец / ADMIN | Отправить (DRAFT → SUBMITTED) |
| POST | `/api/applications/:id/approve` | ADMIN | Одобрить (SUBMITTED → APPROVED) |
| POST | `/api/applications/:id/reject` | ADMIN | Отклонить (SUBMITTED → REJECTED) |
| POST | `/api/applications/:id/withdraw` | COACH-владелец / ADMIN | Отозвать (DRAFT/SUBMITTED → WITHDRAWN) |

### Lifecycle заявки

```
DRAFT  ──→  SUBMITTED  ──→  APPROVED
   ↘            ↘               ↘
    └────── WITHDRAWN ─────  REJECTED
```

### Проверки при добавлении спортсмена в заявку
1. Турнир в статусе REGISTRATION_OPEN
2. Заявка в статусе DRAFT (нельзя редактировать после submit)
3. Спортсмен из клуба тренера
4. Категория из этого турнира
5. **Соответствие пола, возраста, веса** категории
6. Спортсмен ещё не заявлен в эту категорию (никем — даже из другого клуба)

---

## 5. 🥇 Brackets (Турнирные сетки)

**Файлы:** `services/bracket.service.ts`, `services/bracket-engine/*`, `routes/bracket.routes.ts`

### Что делает
Генерация турнирных сеток из утверждённых заявок. Поддерживает 2 формата:
- **Single Elimination + IJF Repechage** — олимпийский формат с двумя бронзами
- **Round-Robin** — круговая система с тай-брейкерами

### Эндпоинты

| Метод | URL | Кто | Что |
|---|---|---|---|
| POST | `/api/tournaments/:tournamentId/categories/:categoryId/bracket` | ADMIN | **Сгенерировать сетку** |
| GET | `/api/tournaments/:tournamentId/categories/:categoryId/bracket` | public | Получить сетку категории |
| GET | `/api/tournaments/:tournamentId/brackets` | public | Все сетки турнира |
| GET | `/api/brackets/:id` | public | Детали по ID |
| DELETE | `/api/brackets/:id` | ADMIN | Удалить (только если нет начатых матчей) |

### Алгоритм Single Elimination + IJF Repechage
1. Собираются спортсмены из APPROVED-заявок этой категории.
2. Размер сетки = ближайшая степень 2 (4, 8, 16, 32, 64) с BYE-слотами.
3. **Fisher-Yates shuffle** с детерминированным seed.
4. **Эвристика разделения клубов**: одноклубники разводятся в разные четверти сетки.
5. Создаются все Match-записи (round 1..N для main + repechage + bronze1/2 + final).
6. В Round 1 заполняются пары; дальше matches пустые и заполняются автоматически при propagate.

### Алгоритм Round-Robin
1. До 8 участников (иначе слишком много матчей).
2. Circle method — расписание по N-1 турам (или N если N нечётно с BYE).
3. Каждый играет с каждым один раз.

### Тай-брейкеры Round-Robin (порядок)
1. Личная встреча
2. Сумма Ippon-побед
3. Сумма Waza-ari
4. Разница чистых очков
5. Жребий (стабильный по ID)

### Когда генерировать
Только в статусе турнира `REGISTRATION_CLOSED` или `IN_PROGRESS`. Один раз на пару (turnir, category). Перегенерация = DELETE + POST.

---

## 6. ⚔️ Matches + Judge Sessions (Матчи и судейство)

**Файлы:** `services/match.service.ts`, `services/judge-session.service.ts`, `routes/match.routes.ts`, `sockets/io.ts`

### Что делает
Управление матчами в реальном времени. Судейские сессии без аккаунта — одноразовые ссылки. Автоматическое определение победителя по правилам IJF. Авто-продвижение по сетке.

### Эндпоинты — чтение (public)

| Метод | URL | Что |
|---|---|---|
| GET | `/api/matches` | Список с фильтрами (tournamentId, bracketId, tatamiNumber, status) |
| GET | `/api/matches/:id` | Детали матча + лог событий |
| GET | `/api/tatami/:tournamentId/:n/queue` | Очередь матчей на татами N |
| GET | `/api/judge/:token` | Получить матч по токену судьи (без auth) |

### Эндпоинты — управление матчем (ADMIN или X-Judge-Token)

| Метод | URL | Что |
|---|---|---|
| POST | `/api/matches/:id/start` | **HAJIME** — старт матча |
| POST | `/api/matches/:id/pause` | **MATE** — пауза |
| POST | `/api/matches/:id/golden-score` | Переход в Golden Score |
| POST | `/api/matches/:id/score` | Добавить очко (IPPON / WAZA_ARI / YUKO / SHIDO / HANSOKU_MAKE) |
| POST | `/api/matches/:id/osaekomi` | **Старт удержания** (red/blue) → таймер на сервере |
| POST | `/api/matches/:id/toketa` | **Конец удержания** → авто-начисление балла по duration |
| POST | `/api/matches/:id/finish` | Ручное завершение (например, решение судей) |
| PATCH | `/api/matches/:id/tatami` | ADMIN: назначить на татами |
| POST | `/api/matches/:id/judge-session` | ADMIN: создать судейскую сессию |

### Эндпоинты — судейские сессии

| Метод | URL | Кто | Что |
|---|---|---|---|
| POST | `/api/judge-sessions/:id/revoke` | ADMIN | Отозвать сессию досрочно |

### Auto-finish правила (IJF rules)
- **Ippon** → мгновенная победа
- **2 × Waza-ari** → Ippon → победа
- **3 × Shido** → Hansoku-make → проигрыш
- **Hansoku-make** → проигрыш

При auto-finish:
1. Match.status → COMPLETED
2. Match.winnerId установлен
3. **propagateResult** — победитель ставится в следующий матч (по позиции в сетке)
4. Для размера ≥8: проигравший 1/4 идёт в Repechage, проигравший полуфинала идёт в Bronze1/2

### Osaekomi (удержание) — серверная защита
1. POST `/osaekomi {side}` — сервер фиксирует `startedAt = now` в scoreSnapshot
2. POST `/toketa` — сервер считает `duration = now - startedAt`
3. По duration: **5+ сек = Yuko** (если allowYuko), **10+ сек = Waza-ari**, **20+ сек = Ippon** (мгновенная победа)
4. Время считается на сервере — клиент только нажимает кнопки

### Socket.IO события (real-time)
Комнаты: `tournament:{id}`, `bracket:{id}`, `tatami:{n}`, `user:{id}`.

События:
- `match:started`
- `match:scoreUpdate` (с полным scoreSnapshot)
- `match:event` (атомарное действие судьи)
- `match:osaekomiStart` / `match:osaekomiEnd`
- `match:goldenScore`
- `match:finished` (с winnerId)

Клиент подписывается командой `socket.emit("subscribe", ["tournament:abc"])`.

---

## 7. 🔁 Admin Override + Rollback + AuditLog

**Файлы:** `services/admin-override.service.ts`, `services/audit.service.ts`, `routes/admin.routes.ts`

### Что делает
Админ может изменить результат завершённого матча. Если победитель уже играл дальше — система **рекурсивно откатывает** всю downstream-цепочку матчей. Каждое действие — в AuditLog.

### Эндпоинты

| Метод | URL | Кто | Что |
|---|---|---|---|
| POST | `/api/admin/matches/:id/override` | ADMIN | Переопределить результат завершённого матча |
| POST | `/api/admin/tournaments/:id/finalize` | ADMIN | Завершить турнир + начислить рейтинг |
| GET | `/api/admin/audit-logs` | ADMIN | Журнал действий (фильтры: targetEntity, action, actorUserId) |

### Алгоритм Override + Rollback
1. Принимаем `{ winnerSide: "BLUE", reason: "видеоповтор" }`.
2. Берём текущего winner матча.
3. Ищем все downstream-матчи где он играет.
4. **Рекурсивно** откатываем их (если COMPLETED → каскад вниз → PENDING; если IN_PROGRESS → CANCELLED).
5. Очищаем слоты от старого winner.
6. Устанавливаем нового winner в текущем матче, ставим `isReplay = true` + reason.
7. Propagate нового winner в downstream.
8. Каждый шаг — запись в AuditLog с before/after JSON.

### AuditLog — что пишется
- `match.override` — переопределение
- `match.rollback` — каскадный откат
- `tournament.finalize` — финализация

В каждой записи: `actorUserId`, `action`, `targetEntity`, `targetId`, `before`, `after`, `metadata`, `ipAddress`, `userAgent`.

---

## 8. 🏅 Rating + Leaderboard

**Файлы:** `services/rating.service.ts`, `routes/admin.routes.ts`

### Что делает
При финализации турнира — автоматически вычисляет места и начисляет очки в рейтинг.

### Эндпоинты

| Метод | URL | Кто | Что |
|---|---|---|---|
| POST | `/api/admin/tournaments/:id/finalize` | ADMIN | **Финализация: места + очки + COMPLETED** |
| GET | `/api/ratings/athletes/:id` | public | Профиль рейтинга спортсмена (история + сумма) |
| GET | `/api/ratings/leaderboard` | public | Топ (фильтры: categoryId, clubId, limit) |

### Алгоритм определения мест

**Для SE_IJF** (по результатам матчей):
- 1 место = winner финала
- 2 место = проигравший финала
- 3 место = winners обоих бронзовых
- 5 место = проигравшие бронзовых
- Остальные = участие

**Для ROUND_ROBIN** (по таблице):
- Места 1..N по сумме побед + тай-брейкеры

### Шкала очков (из SystemConfig.ratingPoints)

| Место | Очки |
|---|---:|
| 1 (золото) | 100 |
| 2 (серебро) | 80 |
| 3 (бронза, оба) | 50 |
| 4-5 (проигрыш за бронзу) | 30 |
| 7-8 (Repechage) | 15 |
| Участие | 0 |

Эти значения **редактируются** через SystemConfig — админ может менять под региональные правила.

---

## 9. 📄 PDF (Сетка + Протокол)

**Файлы:** `services/pdf.service.ts`, `routes/admin.routes.ts`

### Что делает
Два PDF-документа в правильных точках workflow:
1. **Сетка** — расписание матчей после генерации, перед турниром
2. **Протокол** — итоговые результаты после финализации

### Эндпоинты

| Метод | URL | Кто | Когда |
|---|---|---|---|
| GET | `/api/admin/bracket?bracketId=X` | public | После генерации сетки |
| GET | `/api/admin/protocol?tournamentId=Y` | public | После COMPLETED турнира |

### PDF сетки (`bracket.pdf`)
Содержит:
- Шапка с названием турнира, местом и датами
- Название категории, формат, число матчей
- Все матчи сгруппированы по секциям (Main → Repechage → Bronze1/2 → Final)
- В каждом матче: имя спортсмена + клуб, татами

Язык — `tournament.primaryLocale` (kk / ru / en).

### PDF протокола (`protocol-{id}.pdf`)
Содержит:
- Шапка с названием турнира
- По каждой категории: 🥇 1 место, 🥈 2 место, 🥉 3 место (двое), 5 место (двое)
- Имя + клуб + очки

Доступен **только после** статуса `COMPLETED` (иначе 409).

---

## 📊 Сводка всех ~70 эндпоинтов

| Модуль | Эндпоинтов |
|---|---:|
| 1. Auth | 7 |
| 2. Clubs / Groups / Athletes | 13 |
| 3. Tournaments / Categories | 10 |
| 4. Applications | 8 |
| 5. Brackets | 5 |
| 6. Matches + Judge Sessions | 14 |
| 7. Admin + Audit | 3 |
| 8. Rating | 3 |
| 9. PDF | 2 |
| **Итого** | **~65** |

---

## 🎬 Полный workflow турнира на примере

```
1. ADMIN регистрируется (через seed) ──────────────────┐
                                                       ▼
2. COACH регистрируется → создаёт клуб → добавляет 8 спортсменов
                                                       ▼
3. ADMIN создаёт Tournament (DRAFT) → добавляет Category
                                                       ▼
4. ADMIN: status → REGISTRATION_OPEN
                                                       ▼
5. COACH создаёт Application → добавляет 4 спортсменов → submit
                                                       ▼
6. ADMIN: approve Application
                                                       ▼
7. ADMIN: status → REGISTRATION_CLOSED
                                                       ▼
8. ADMIN: POST /brackets/generate → сетка готова ──── 📄 PDF сетки доступен
                                                       ▼
9. ADMIN: status → IN_PROGRESS
                                                       ▼
10. ADMIN создаёт JudgeSession для каждого матча → раздаёт URL судьям
                                                       ▼
11. Судья по URL открывает панель → HAJIME → Osaekomi → Toketa (+ Waza-ari)
       → IPPON → auto-finish → победитель идёт в следующий матч ────── 🔌 Socket.IO live
                                                       ▼
12. ADMIN: override если нужно → rollback → AuditLog запись
                                                       ▼
13. Все матчи COMPLETED
                                                       ▼
14. ADMIN: POST /admin/tournaments/:id/finalize
       → автоматически: места → RatingEntry → status COMPLETED ── 📄 PDF протокола доступен
                                                       ▼
15. Любой видит leaderboard: GET /ratings/leaderboard
```

---

## 🧪 Как тестировать

В корне проекта:
- `./demo-e2e.sh` — полный сценарий от создания заявок до сетки
- `./demo-match.sh` — судейский сценарий: HAJIME → Osaekomi → Toketa → авто-Waza-ari

Все промежуточные данные видно в Prisma Studio: http://localhost:5555

---

## 🔒 Безопасность

- bcrypt rounds=12
- JWT с длинными секретами в .env
- Refresh-токены в Redis с возможностью отзыва
- Rate-limit 100 req/min на IP
- httpOnly + SameSite=Lax cookies
- CORS только под фронтенд-домен
- Zod-валидация всех входов
- Все действия админа в AuditLog

---

**Backend готов на 100%.** Дальше — фронтенд, тесты, деплой.
