# Judo-Arena: анализ проекта и техническое задание

Дата анализа: 2026-05-30  
Проект: Judo-Arena  
Тип: web-платформа полного цикла для проведения соревнований по дзюдо

## 1. Краткое резюме

Judo-Arena - это monorepo-приложение для автоматизации дзюдо-турниров: от регистрации спортсменов и клубных заявок до жеребьевки, судейства, live-сеток, PDF-протоколов и рейтингов.

Проект уже содержит:

- backend API на Fastify + TypeScript;
- PostgreSQL-схему через Prisma;
- Redis для refresh-сессий и инфраструктурных задач;
- realtime-слой на Socket.IO;
- frontend на React 19 + Vite/TanStack Router/TanStack Query;
- роли ATHLETE, COACH, ADMIN и отдельный stateless-доступ судей по токенам;
- турнирные сетки: single elimination с IJF repechage, round-robin, mixed;
- серверную логику счета, osaekomi, auto-finish, confirmation, undo/reset;
- PDF-генерацию сеток и итоговых протоколов;
- мультиязычность ru/kk/en;
- e2e, integration, acceptance, system и unit-тесты.

Проект по уровню доменной логики ближе к production MVP, чем к демо: есть жизненный цикл турнира, аудит, RBAC, подтверждение результатов, откаты, заявки, взвешивание, рейтинги, уведомления, деплойный runbook и backup/restore.

## 2. Архитектура

### 2.1 Структура репозитория

```text
judo-arena/
  api/                    Backend, Prisma, тесты API и доменной логики
  web/                    Frontend-приложение
  e2e/                    Playwright smoke/e2e
  docs/screenshots/       Скриншоты продукта
  scripts/                Backup/restore
  docker-compose.yml      PostgreSQL, Redis, Mailpit
  start.sh                Локальный запуск полного окружения
```

### 2.2 Backend

Стек:

- Fastify;
- TypeScript;
- Prisma ORM;
- PostgreSQL;
- Redis;
- Socket.IO;
- Zod;
- PDFKit;
- Sentry;
- Nodemailer;
- Sharp;
- JWT access + httpOnly refresh cookie.

Ключевые backend-модули:

- `auth.service.ts` - регистрация, login, refresh, logout, профиль, locale.
- `club.service.ts` - клубы, группы, спортсмены, массовый импорт.
- `club-join.service.ts` - заявки спортсменов на вступление в клуб.
- `coach-club-join.service.ts` - заявки тренеров на вступление в клуб, передача ownership.
- `tournament.service.ts` - турниры, статусы, категории.
- `application.service.ts` - клубные заявки на турнир, entries, approve/reject/withdraw.
- `weigh-in.service.ts` - статусы взвешивания.
- `bracket.service.ts` - генерация сеток, подготовка турнира, удаление сетки.
- `bracket-engine/*` - seeding, single elimination, round-robin, mixed, tatami plan.
- `match.service.ts` - матч, счет, удержание, golden score, undo, reset, queue, tatami.
- `judge-session.service.ts` - токен доступа судьи к одному матчу.
- `tatami-session.service.ts` - токен доступа судьи ко всему татами.
- `admin-override.service.ts` - admin override результата и откат downstream-цепочки.
- `rating.service.ts` - финализация турнира и начисление рейтинга.
- `notification.service.ts` - пользовательские и массовые уведомления.
- `pdf.service.ts` - PDF сеток, всех сеток турнира, итогового протокола.
- `audit.service.ts` - журнал действий.

### 2.3 Frontend

Стек:

- React 19;
- Vite;
- TanStack Router;
- TanStack Query;
- Tailwind CSS v4;
- shadcn/ui/Radix UI;
- Socket.IO client;
- react-i18next;
- PWA manifest/hooks;
- Sentry.

Ключевые frontend-зоны:

- публичные страницы: главная, турниры, рейтинг, протокол, about;
- auth: login, forgot-password, reset-password;
- спортсмен: dashboard, профиль, турниры, матчи, результаты, уведомления, onboarding;
- тренер: dashboard, клуб, спортсмены, заявки, турниры, уведомления, профиль, onboarding;
- админ: dashboard, турниры, клубы, заявки, пользователи, рейтинги, матчи, уведомления, аудит, настройки, отчеты, протоколы;
- судья: `/judge/$token`, `/tatami/$token`;
- live wall: `/live-wall/$tournamentId`.

## 3. Доменная модель

### 3.1 Роли

`ATHLETE`

- регистрируется самостоятельно;
- редактирует профиль;
- просматривает свои заявки, турниры, матчи и результаты;
- подает заявку на вступление в клуб;
- получает уведомления.

`COACH`

- создает или ведет клуб;
- управляет группами клуба;
- регистрирует спортсменов вручную;
- импортирует спортсменов пачкой;
- принимает или отклоняет заявки спортсменов в клуб;
- подает заявки клуба на турниры;
- добавляет спортсменов в категории;
- отправляет заявки на рассмотрение;
- просматривает турниры, заявки, спортсменов, уведомления;
- может просить вступление в существующий клуб как тренер.

`ADMIN`

- управляет турнирами, категориями, пользователями, клубами;
- модерирует заявки;
- проводит взвешивание;
- генерирует сетки;
- назначает татами и очередь;
- создает судейские ссылки;
- управляет матчами;
- делает override результатов;
- финализирует турнир;
- управляет рейтингами, настройками, аудитом, PDF и рассылками.

`JUDGE`

- не хранится как постоянная роль пользователя;
- получает доступ через одноразовую ссылку на матч или через ссылку на татами;
- может стартовать/пауза/score/osaekomi/toketa/finish/confirm/undo/cancel pending result в рамках разрешенного матча или татами.

### 3.2 Основные сущности БД

Схема содержит 18 бизнес-моделей:

- `User`
- `Club`
- `ClubGroup`
- `ClubJoinRequest`
- `CoachClubJoinRequest`
- `Tournament`
- `Category`
- `Application`
- `ApplicationEntry`
- `Bracket`
- `Match`
- `MatchEvent`
- `JudgeSession`
- `TatamiSession`
- `RatingEntry`
- `Notification`
- `AuditLog`
- `SystemConfig`

### 3.3 Статусы

Турнир:

```text
DRAFT -> REGISTRATION_OPEN -> REGISTRATION_CLOSED -> IN_PROGRESS -> COMPLETED
                                                \-> CANCELLED
```

Заявка:

```text
DRAFT -> SUBMITTED -> APPROVED
                  \-> REJECTED
DRAFT/SUBMITTED -> WITHDRAWN
```

Взвешивание:

```text
PENDING | PASSED | FAILED_WEIGHT | FAILED_DOCUMENTS | ABSENT | WITHDRAWN
```

Матч:

```text
PENDING -> IN_PROGRESS -> COMPLETED
       \-> CANCELLED
```

## 4. Функциональный анализ

### 4.1 Аутентификация и безопасность

Реализовано:

- регистрация ATHLETE/COACH;
- login по email/password;
- bcrypt-хеширование;
- access JWT;
- refresh token в httpOnly cookie;
- ротация refresh token через Redis;
- logout текущей сессии;
- logout all devices;
- текущий пользователь `/me`;
- смена языка профиля;
- редактирование профиля;
- forgot/reset password через email и Redis token;
- rate limit на чувствительные endpoints;
- CORS whitelist;
- Helmet;
- request id и structured logging;
- Sentry error tracking.

Требования:

- JWT secrets в production должны быть не короче 32 символов.
- Refresh cookie должен быть `httpOnly`, `sameSite=lax`, `secure=true` в production.
- При 401 frontend должен пробовать refresh один раз и затем выводить пользователя на login.
- Заблокированный пользователь не должен иметь доступ к защищенным действиям.

### 4.2 Клубы

Реализовано:

- публичный список клубов с фильтрами;
- публичные детали клуба;
- создание клуба тренером или админом;
- редактирование клуба владельцем/админом;
- удаление клуба админом;
- группы клуба по возрасту;
- список участников клуба;
- создание спортсмена тренером;
- массовый импорт до 200 спортсменов;
- редактирование профиля спортсмена;
- отвязка спортсмена от клуба;
- блокировка клуба админом;
- полный admin CRUD клубов и групп.

Требования:

- один клуб имеет owner-тренера;
- тренер может управлять только своим клубом, админ - всеми;
- клуб может быть заблокирован, причина блокировки должна сохраняться;
- удаление клуба должно учитывать связанные заявки, пользователей и историю.

### 4.3 Заявки в клуб

Реализовано:

- спортсмен подает заявку в клуб;
- спортсмен видит и отменяет свои заявки;
- тренер видит входящие заявки;
- тренер одобряет или отклоняет заявку;
- тренер может подать заявку на вступление в существующий клуб как coach;
- owner клуба может принять/отклонить тренера;
- owner может удалить тренера из клуба;
- owner может передать владение клубом другому тренеру.

Требования:

- повторная активная заявка в тот же клуб запрещена;
- после approve пользователь должен получить `clubId` и корректную `clubRole`;
- transfer ownership должен быть атомарным.

### 4.4 Турниры и категории

Реализовано:

- публичный список турниров;
- фильтры status/city/search/upcoming/includeArchived/limit/offset;
- публичная карточка турнира;
- создание турнира админом;
- редактирование турнира админом;
- удаление турнира админом;
- смена статуса;
- featured/archive;
- категории по полу, возрасту, весу;
- формат категории: `SE_IJF`, `ROUND_ROBIN`, `MIXED`;
- настройки длительности матча, golden score, yuko;
- публичный список участников категории после approve.

Требования:

- категории редактируются только админом;
- удаление категории допустимо только когда это не ломает заявки/сетки/матчи;
- status transition должен соответствовать жизненному циклу;
- генерация сеток должна быть недоступна до закрытия регистрации и approve заявок.

### 4.5 Турнирные заявки

Реализовано:

- тренер создает или получает draft-заявку клуба на турнир;
- добавляет спортсменов клуба в категории;
- удаляет entries;
- отправляет заявку;
- админ approve/reject;
- bulk approve всех submitted-заявок турнира;
- тренер withdraw;
- просмотр истории заявки через AuditLog;
- админ может принудительно удалить entry или перенести в другую категорию;
- спортсмен видит свои application entries.

Валидации:

- спортсмен должен принадлежать клубу тренера;
- категория должна соответствовать полу;
- возраст должен попадать в диапазон категории;
- вес должен попадать в диапазон категории;
- duplicate entry запрещен;
- заявка уникальна на пару tournamentId + clubId.

### 4.6 Взвешивание

Реализовано:

- админ получает weigh-in лист турнира;
- админ обновляет статус entry;
- сохраняются фактический вес, заметки, reviewer, timestamp;
- статусы поддерживают passed, failed weight, failed documents, absent, withdrawn.

Требования:

- генерация сетки должна учитывать только подтвержденных/допущенных участников согласно выбранному регламенту;
- изменения после жеребьевки должны быть ограничены или вести к регенерации/аудиту.

### 4.7 Сетки и жеребьевка

Реализовано:

- генерация сетки по категории;
- получение сетки по category/tournament;
- получение всех сеток турнира;
- подготовка всех сеток турнира;
- удаление сетки, если матчи не начаты;
- deterministic seeding;
- Fisher-Yates shuffle;
- эвристика разнесения спортсменов одного клуба по разным четвертям;
- размер сетки как next power of two;
- byes;
- single elimination с IJF repechage;
- две бронзы;
- round-robin;
- mixed: группы + плей-офф;
- планирование татами.

Требования:

- генерация должна быть идемпотентно защищена от повторного создания сетки;
- после начала матчей сетку нельзя удалять без admin override workflow;
- seeding должен быть воспроизводимым по seed;
- результат матча должен автоматически продвигать победителя дальше по сетке.

### 4.8 Матчи и судейство

Реализовано:

- публичный список матчей;
- фильтры tournamentId/bracketId/athleteId/status/tatamiNumber/limit/offset;
- публичные детали матча с event log;
- start/HAJIME;
- pause/MATE;
- golden score;
- score event: IPPON, WAZA_ARI, YUKO, SHIDO, HANSOKU_MAKE и др.;
- auto-finish:
  - Ippon завершает схватку;
  - 2 Waza-ari приводят к Ippon;
  - 3 Shido приводят к Hansoku-make;
- pending result;
- confirm result;
- cancel pending result;
- undo last score event;
- reset match админом;
- ручное завершение;
- optimistic locking через `version`;
- автоматическое обновление сетки после confirm;
- audit на confirm/undo/reset/override.

Требования:

- scoring action должен проверять текущий статус матча;
- completed match нельзя менять без override/reset;
- судейский token должен работать только для своего матча;
- tatami token должен работать только для матчей своего турнира и номера татами;
- конфликт версии должен возвращать понятную ошибку для frontend.

### 4.9 Osaekomi

Реализовано:

- старт удержания;
- завершение удержания TOKETA;
- серверный расчет длительности;
- восстановление активных таймеров после рестарта backend;
- автоскоринг:
  - 5 секунд = Yuko, если yuko разрешен;
  - 10 секунд = Waza-ari;
  - 20 секунд = Ippon;
- события `OSAEKOMI` и `TOKETA`;
- realtime events `match:osaekomiStart`, `match:osaekomiEnd`.

Требования:

- frontend только отправляет команды, не должен быть источником истины по времени;
- concurrent osaekomi должен быть запрещен;
- timer state должен переживать кратковременный restart.

### 4.10 Татами и очередь

Реализовано:

- назначение матча на татами;
- queuePosition;
- move up/down;
- публичная очередь татами;
- татами-сессия на весь день/татами;
- список активных татами-сессий;
- revoke сессии;
- judge screen по `/tatami/$token`;
- live updates через Socket.IO.

Требования:

- очередь должна оставаться консистентной при перестановках;
- матч не должен управляться судьей другого татами;
- завершенный матч должен освобождать следующий матч в UI.

### 4.11 Realtime

Реализовано:

- Socket.IO;
- комнаты:
  - `tournament:{id}`;
  - `bracket:{id}`;
  - `tatami:{n}`;
  - `user:{id}`;
- события:
  - `match:started`;
  - `match:scoreUpdate`;
  - `match:event`;
  - `match:osaekomiStart`;
  - `match:osaekomiEnd`;
  - `match:goldenScore`;
  - `match:pendingResult`;
  - `match:finished`;
  - `tatami:queueUpdate`;
  - `bracket:update`.

Требования:

- frontend должен подписываться на минимально нужные комнаты;
- при disconnect/reconnect состояние должно догружаться через REST;
- realtime не заменяет авторитетную БД, а только ускоряет обновление UI.

### 4.12 Рейтинг

Реализовано:

- финализация турнира админом;
- расчет мест;
- создание `RatingEntry`;
- публичный рейтинг спортсмена;
- публичный leaderboard;
- рейтинг клубов;
- настройка rating points через `SystemConfig`.

Базовая схема баллов:

```text
1 место: 100
2 место: 80
3 место: 50
4-5 место: 30
7-8 место: 15
участие: 0
```

Требования:

- финализация возможна только когда все обязательные матчи завершены;
- повторная финализация не должна дублировать rating entries;
- изменение результата после финализации требует отдельного регламента: reopen или recalculation.

### 4.13 PDF и протоколы

Реализовано:

- PDF одной сетки;
- PDF всех сеток турнира;
- итоговый протокол турнира;
- PDF endpoints имеют отдельный rate limit;
- поддержка шрифта с кириллицей/казахским.

Требования:

- PDF сетки доступен после генерации сетки;
- итоговый протокол доступен после завершения турнира;
- PDF должен содержать турнир, категории, участников, сетку/результаты, подписи/служебные поля по регламенту.

### 4.14 Уведомления

Реализовано:

- список уведомлений пользователя;
- unread count;
- mark one read;
- mark all read;
- admin broadcast:
  - конкретному пользователю;
  - по роли;
  - по турниру;
  - по клубу;
  - всем.

Требования:

- уведомления должны быть локализуемыми;
- массовая рассылка должна быть аудируемой;
- критичные события: approve/reject заявки, назначение матча, изменение турнира, результаты.

### 4.15 Admin management

Реализовано:

- статистика админ-панели;
- пользователи: list/get/create/update/delete/active/reset password/change club;
- клубы: create/get/update/delete/block;
- группы: create/update/delete;
- турниры: feature/archive;
- system config;
- audit logs;
- все заявки одним endpoint.

Требования:

- все destructive/admin операции должны попадать в AuditLog;
- удаление пользователя должно учитывать участие в матчах, рейтингах и истории;
- блокировка предпочтительнее физического удаления для production.

### 4.16 Файлы и изображения

Реализовано:

- upload image;
- upload avatar;
- допустимые типы JPG/PNG/WEBP/GIF;
- конвертация в WebP через Sharp;
- resize изображений до 2048px;
- avatar до 512px;
- ограничение размера 10 MB для image и 5 MB для avatar.

Требования:

- в production хранение должно быть вынесено в S3-compatible storage или устойчивый volume;
- URL загруженных файлов должен быть совместим с frontend `mediaUrl`.

### 4.17 Интернационализация

Реализовано:

- ru/kk/en locale files;
- `preferredLocale` у пользователя;
- localStorage + API сохранение языка;
- мультиязычные JSON-поля у турниров и клубов.

Требования:

- все пользовательские тексты должны проходить через i18n;
- fallback: kk -> ru -> en или заданный проектом порядок;
- PDF должен корректно отображать кириллицу и казахские символы.

## 5. Frontend-функционал по зонам

### 5.1 Публичная зона

Страницы:

- `/` - landing/home;
- `/about`;
- `/tournaments`;
- `/tournaments/$id`;
- `/rankings`;
- `/protocol`;
- `/live-wall/$tournamentId`;
- `/login`;
- `/forgot-password`;
- `/reset-password`.

Функции:

- просмотр турниров;
- карточка турнира;
- список категорий;
- участники категории;
- публичные рейтинги;
- live wall для экрана в зале;
- авторизация и восстановление пароля.

### 5.2 Кабинет спортсмена

Страницы:

- `/athlete`;
- `/athlete/`;
- `/athlete/profile`;
- `/athlete/tournaments`;
- `/athlete/matches`;
- `/athlete/matches/$id`;
- `/athlete/results`;
- `/athlete/notifications`;
- `/athlete/onboarding`.

Функции:

- dashboard;
- профиль;
- клубная принадлежность;
- заявки на вступление в клуб;
- просмотр турниров;
- свои матчи;
- детализация матча;
- результаты;
- уведомления.

### 5.3 Кабинет тренера

Страницы:

- `/coach`;
- `/coach/`;
- `/coach/profile`;
- `/coach/club`;
- `/coach/athletes`;
- `/coach/athletes/$id`;
- `/coach/applications`;
- `/coach/applications/$id`;
- `/coach/tournaments`;
- `/coach/tournaments/$id`;
- `/coach/notifications`;
- `/coach/onboarding`.

Функции:

- dashboard тренера;
- управление клубом;
- группы клуба;
- спортсмены;
- создание спортсмена;
- bulk import;
- заявки спортсменов в клуб;
- заявки тренера в клуб;
- заявки клуба на турнир;
- добавление спортсменов в категории;
- отправка/отзыв заявки;
- просмотр турниров;
- уведомления.

### 5.4 Кабинет администратора

Страницы:

- `/admin`;
- `/admin/`;
- `/admin/tournaments`;
- `/admin/tournaments/$id`;
- `/admin/clubs`;
- `/admin/clubs/$id`;
- `/admin/applications`;
- `/admin/users`;
- `/admin/users/$id`;
- `/admin/matches`;
- `/admin/ratings`;
- `/admin/notifications`;
- `/admin/audit`;
- `/admin/settings`;
- `/admin/reports`;
- `/admin/protocols`.

Функции:

- общая статистика;
- CRUD турниров;
- категории;
- заявки;
- взвешивание;
- генерация сеток;
- управление матчами;
- татами/очередь;
- судейские ссылки;
- PDF;
- пользователи;
- клубы;
- рейтинги;
- уведомления;
- аудит;
- настройки системы.

### 5.5 Судейская зона

Страницы:

- `/judge/$token`;
- `/tatami/$token`;
- `/judge` redirect/empty state.

Функции:

- управление одним матчем по judge token;
- управление очередью татами по tatami token;
- счет;
- osaekomi;
- toketa;
- golden score;
- pending result;
- confirmation;
- undo/cancel;
- realtime-синхронизация.

## 6. API-спецификация верхнего уровня

### 6.1 Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `GET /api/auth/me`
- `PATCH /api/auth/me/locale`
- `PATCH /api/auth/me/profile`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### 6.2 Uploads

- `POST /api/upload/image`
- `POST /api/upload/avatar`

Важно: frontend-клиент сейчас вызывает `/api/uploads/image`, а backend регистрирует `/api/upload/image`. Это расхождение нужно исправить: привести frontend к `/api/upload/*` или добавить alias на backend.

### 6.3 Clubs

- `GET /api/clubs`
- `GET /api/clubs/:id`
- `POST /api/clubs`
- `PATCH /api/clubs/:id`
- `DELETE /api/clubs/:id`
- `GET /api/clubs/:id/groups`
- `POST /api/clubs/:id/groups`
- `PATCH /api/club-groups/:id`
- `DELETE /api/club-groups/:id`
- `GET /api/clubs/:id/members`
- `POST /api/clubs/:id/athletes`
- `POST /api/clubs/:id/athletes/bulk-import`
- `PATCH /api/athletes/:id`
- `DELETE /api/athletes/:id/club`
- `POST /api/clubs/:id/join-request`
- `GET /api/athlete/join-requests`
- `DELETE /api/athlete/join-requests/:id`
- `GET /api/coach/join-requests`
- `POST /api/coach/join-requests/:id/review`
- `POST /api/clubs/:id/coach-join-request`
- `GET /api/coach/club-join-requests`
- `DELETE /api/coach/club-join-requests/:id`
- `GET /api/coach/club-join-requests/incoming`
- `POST /api/coach/club-join-requests/:id/review`
- `DELETE /api/clubs/:clubId/coaches/:coachId`
- `POST /api/clubs/:clubId/coaches/:coachId/transfer-owner`

### 6.4 Tournaments, categories, applications

- `GET /api/tournaments`
- `GET /api/tournaments/:id`
- `POST /api/tournaments`
- `PATCH /api/tournaments/:id`
- `DELETE /api/tournaments/:id`
- `POST /api/tournaments/:id/status`
- `GET /api/tournaments/:id/categories`
- `POST /api/tournaments/:id/categories`
- `GET /api/tournaments/:id/categories/:categoryId/participants`
- `PATCH /api/categories/:id`
- `DELETE /api/categories/:id`
- `GET /api/tournaments/:id/applications`
- `POST /api/tournaments/:id/applications`
- `POST /api/tournaments/:id/applications/bulk-approve`
- `GET /api/coach/applications`
- `GET /api/athlete/applications`
- `GET /api/applications/:id`
- `GET /api/applications/:id/history`
- `POST /api/applications/:id/entries`
- `DELETE /api/applications/:id/entries/:entryId`
- `POST /api/applications/:id/submit`
- `POST /api/applications/:id/approve`
- `POST /api/applications/:id/reject`
- `POST /api/applications/:id/withdraw`
- `GET /api/admin/applications`
- `DELETE /api/admin/applications/:appId/entries/:entryId`
- `PATCH /api/admin/applications/:appId/entries/:entryId/category`

### 6.5 Brackets

- `POST /api/tournaments/:tournamentId/categories/:categoryId/bracket`
- `GET /api/tournaments/:tournamentId/categories/:categoryId/bracket`
- `GET /api/tournaments/:tournamentId/brackets`
- `POST /api/tournaments/:tournamentId/brackets/prepare`
- `GET /api/brackets/:id`
- `DELETE /api/brackets/:id`

### 6.6 Matches and judge

- `GET /api/matches`
- `GET /api/matches/:id`
- `POST /api/matches/:id/start`
- `POST /api/matches/:id/pause`
- `POST /api/matches/:id/golden-score`
- `POST /api/matches/:id/score`
- `POST /api/matches/:id/finish`
- `POST /api/matches/:id/confirm`
- `POST /api/matches/:id/undo`
- `POST /api/matches/:id/cancel-result`
- `POST /api/matches/:id/reset`
- `POST /api/matches/:id/osaekomi`
- `POST /api/matches/:id/toketa`
- `PATCH /api/matches/:id/tatami`
- `PATCH /api/matches/:id/queue`
- `POST /api/matches/:id/judge-session`
- `GET /api/judge/:token`
- `POST /api/judge-sessions/:id/revoke`
- `GET /api/tatami/:tournamentId/:n/queue`
- `POST /api/tournaments/:id/tatami-sessions`
- `GET /api/tournaments/:id/tatami-sessions`
- `GET /api/tatami-session/:token`
- `POST /api/tatami-sessions/:id/revoke`

### 6.7 Admin, rating, PDF, notifications

- `POST /api/admin/matches/:id/override`
- `POST /api/admin/tournaments/:id/finalize`
- `GET /api/admin/tournaments/:id/weigh-in`
- `PATCH /api/admin/application-entries/:entryId/weigh-in`
- `GET /api/admin/audit-logs`
- `POST /api/admin/clubs`
- `GET /api/admin/clubs/:id`
- `PATCH /api/admin/clubs/:id/details`
- `DELETE /api/admin/clubs/:id`
- `PATCH /api/admin/clubs/:id/block`
- `POST /api/admin/clubs/:id/groups`
- `PATCH /api/admin/club-groups/:id`
- `DELETE /api/admin/club-groups/:id`
- `POST /api/admin/users`
- `GET /api/admin/users`
- `GET /api/admin/users/:id`
- `PATCH /api/admin/users/:id/profile`
- `PATCH /api/admin/users/:id/club`
- `PATCH /api/admin/users/:id/active`
- `POST /api/admin/users/:id/reset-password`
- `DELETE /api/admin/users/:id`
- `PATCH /api/admin/tournaments/:id/feature`
- `PATCH /api/admin/tournaments/:id/archive`
- `GET /api/admin/system-config/:key`
- `PATCH /api/admin/system-config/:key`
- `GET /api/admin/stats`
- `GET /api/ratings/athletes/:id`
- `GET /api/ratings/leaderboard`
- `GET /api/ratings/clubs`
- `GET /api/pdf/bracket`
- `GET /api/pdf/tournament-brackets`
- `GET /api/pdf/protocol`
- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `POST /api/notifications/mark-read`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/broadcast`

## 7. Нефункциональные требования

### 7.1 Производительность

- API должен отвечать на обычные JSON-запросы до 300 ms при нормальной нагрузке.
- PDF может выполняться дольше, но должен иметь rate limit.
- Списки должны поддерживать пагинацию.
- Live score должен доставляться через Socket.IO без полного refetch страницы.

### 7.2 Надежность

- Все критичные операции должны быть транзакционными:
  - approve/reject заявок;
  - генерация сеток;
  - завершение матча и продвижение по сетке;
  - override и rollback;
  - финализация турнира;
  - передача ownership клуба.
- При падении backend активные osaekomi-таймеры должны восстанавливаться.
- Backup/restore должен быть описан и проверен.

### 7.3 Безопасность

- RBAC на всех закрытых endpoints.
- Judge/tatami tokens должны быть случайными, короткоживущими и отзываемыми.
- Password reset token должен жить ограниченное время и удаляться после использования.
- Uploads должны проверять MIME, размер и расширение.
- В production CORS только на домены frontend.
- Все admin destructive действия должны логироваться.

### 7.4 UX

- Интерфейс должен быть mobile-first для судьи и тренера.
- Админ-панель должна быть плотной, табличной, пригодной для работы на соревновании.
- Судейский экран должен иметь большие кнопки, минимальный текст и видимый статус матча.
- Live wall должен быть читаемым с дистанции.
- Ошибки должны быть понятными на текущем языке пользователя.

### 7.5 Локализация

- Поддерживаемые языки: қазақша, русский, English.
- Данные турниров/клубов должны храниться мультиязычно.
- Все системные статусы должны иметь человекочитаемые переводы.

## 8. Acceptance criteria

### 8.1 Полный сценарий турнира

1. Админ создает турнир в DRAFT.
2. Админ добавляет категории.
3. Админ открывает регистрацию.
4. Тренер создает заявку клуба.
5. Тренер добавляет спортсменов в категории.
6. Система валидирует пол, возраст, вес, клуб.
7. Тренер отправляет заявку.
8. Админ одобряет заявку.
9. Админ проводит взвешивание.
10. Админ закрывает регистрацию.
11. Админ генерирует сетки.
12. Админ назначает матчи на татами.
13. Админ создает tatami session.
14. Судья открывает `/tatami/$token`.
15. Судья проводит матч: HAJIME, score/osaekomi, TOKETA, finish.
16. Результат становится pending.
17. Судья подтверждает результат.
18. Победитель автоматически проходит дальше.
19. Live wall и сетка обновляются realtime.
20. После всех матчей админ финализирует турнир.
21. Система начисляет рейтинг.
22. Админ скачивает итоговый протокол PDF.

### 8.2 Матч

- Нельзя добавить очко в PENDING матч до start.
- Ippon переводит матч в pending result.
- 2 Waza-ari переводят матч в pending result с победителем.
- 3 Shido у одной стороны дают победу другой стороне.
- Undo отменяет последнее score-событие до финального подтверждения.
- Confirm завершает матч и обновляет сетку.
- Reset доступен только админу.

### 8.3 Сетка

- Сетка не создается без участников.
- Спортсмены одного клуба по возможности разводятся.
- Bye не требует ручного матча.
- Победитель автоматически попадает в следующий матч.
- Для IJF repechage формируются бронзовые ветки.
- Round-robin считает таблицу и tie-breakers.

## 9. Тестовая стратегия

Уже есть:

- unit: bracket engine, scoring, validators;
- integration: auth, application, match;
- acceptance: tournament lifecycle;
- system API tests;
- Playwright smoke e2e.

Обязательные тесты для усиления:

- RBAC matrix по всем ролям;
- upload endpoint regression из-за `/upload` vs `/uploads`;
- full tournament lifecycle с weigh-in;
- override после нескольких downstream матчей;
- tatami token access к чужому татами;
- concurrent score с optimistic locking;
- password reset flow;
- PDF smoke generation для ru/kk/en;
- frontend route smoke для admin/coach/athlete/judge.

## 10. Риски и замечания по текущему состоянию

1. В README указано "16 tables", в `schema.prisma` фактически 18 моделей с учетом `ClubJoinRequest` и `CoachClubJoinRequest`. Документацию стоит синхронизировать.
2. В frontend API-клиенте upload image вызывает `/api/uploads/image`, а backend регистрирует `/api/upload/image`. Это реальная несовместимость.
3. В README блок reset database содержит поврежденную строку с `&docker compose`. Нужно исправить.
4. В рабочем дереве на момент анализа много измененных frontend-файлов и каталог `backups/`. Перед релизом нужно проверить, какие изменения должны попасть в commit.
5. Некоторые админские удаления физически удаляют записи. Для production безопаснее soft-delete/block там, где есть исторические связи.
6. Необходимо четко закрепить регламент: участвуют ли в сетке только `PASSED` после weigh-in или все `APPROVED`.
7. После финализации нужен формальный workflow для исправления результата: reopen/recalculate или запрет override.
8. Нужно проверить защиту от повторной генерации/подготовки сеток при race condition.

## 11. Приоритетный roadmap

### P0 - перед production

- Исправить upload route mismatch.
- Синхронизировать README с актуальной схемой.
- Проверить full lifecycle тест с реальной БД.
- Добавить RBAC tests для admin/coach/athlete/judge/tatami.
- Проверить финализацию и недублирование рейтинга.
- Зафиксировать правило допуска к жеребьевке после weigh-in.
- Прогнать e2e smoke по ключевым маршрутам.

### P1 - качество турнира

- Улучшить экран судьи для стрессового использования.
- Добавить печатные листы weigh-in и tatami schedule.
- Добавить экспорт CSV/XLSX заявок и результатов.
- Добавить replay/appeal workflow.
- Добавить понятный UI для override chain rollback.

### P2 - масштабирование

- Redis adapter для Socket.IO в multi-instance production.
- Object storage для uploads.
- Background job queue для PDF и массовых рассылок.
- Расширенные роли: organizer, referee supervisor, club owner.
- Public API/webhooks для федераций.

## 12. Definition of Done

Фича считается готовой, если:

- endpoint покрыт Zod-валидацией;
- права доступа описаны и протестированы;
- изменения БД оформлены миграцией;
- frontend имеет loading/error/empty states;
- события, влияющие на турнир, пишутся в AuditLog;
- realtime state обновляет UI или UI делает refetch после действия;
- добавлены unit/integration/e2e тесты согласно риску;
- ru/kk/en тексты добавлены;
- документация API/README обновлена;
- production env и деплой не требуют ручных скрытых действий.

## 13. Итоговая оценка

Judo-Arena уже имеет сильное ядро: доменная модель, турнирный lifecycle, судейство, realtime, PDF, рейтинг, аудит, роли и деплойная инфраструктура. Главные задачи перед полноценным production - синхронизация документации с кодом, закрытие пары API-расхождений, усиление тестов на права/гонки/финализацию и формализация правил weigh-in/finalization/override.

С точки зрения продукта это не просто "сайт турниров", а полноценная операционная система соревнования: админ готовит турнир, тренер ведет клуб и заявки, спортсмен видит свой путь, судья работает с мобильного, зал видит live-результаты, а после завершения система выпускает рейтинг и протоколы.
