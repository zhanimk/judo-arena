# Техническое задание Judo-Arena

**Проект:** Judo-Arena
**Тип:** fullstack web-платформа для автоматизации соревнований по дзюдо
**Автор:** Жанетта
**Учебное заведение:** Astana IT University College
**Актуальная редакция:** июнь 2026
**Статус документа:** обновлен по фактически реализованному проекту

## 1. Назначение проекта

Judo-Arena - это цифровая платформа полного цикла для организации и проведения соревнований по дзюдо. Система закрывает путь от создания турнира, регистрации клубов и спортсменов, подачи заявок и взвешивания до жеребьевки, судейства на татами, live-табло, автоматического продвижения по сетке, финализации результатов, рейтингов, PDF-протоколов и уведомлений.

Документ полностью заменяет старое ТЗ. Ниже описано текущее состояние проекта, реализованные модули и функции каждого модуля.

## 2. Текущая архитектура

Проект реализован как monorepo.

```text
judo-arena/
  api/                    Backend: Fastify, Prisma, сервисы, тесты
  web/                    Frontend: React, Vite, TanStack Router
  packages/types/         Общие типы проекта
  e2e/                    Playwright E2E и accessibility-тесты
  docs/                   Документация, скриншоты, production/readiness материалы
  scripts/                Backup, restore, smoke/load scripts, OpenAPI generator
  docker-compose.yml      PostgreSQL, Redis, Mailpit
  start.sh                Единый локальный запуск проекта
```

### 2.1 Backend stack

- Fastify 5 + TypeScript.
- Prisma ORM + PostgreSQL.
- Redis для refresh-токенов, временных токенов и инфраструктурных задач.
- Socket.IO для realtime-обновлений.
- Zod для валидации.
- JWT access token + httpOnly refresh cookie.
- bcryptjs для паролей.
- TOTP 2FA.
- Nodemailer / Resend для email.
- web-push для push-уведомлений.
- PDFKit для PDF-документов.
- Sharp для обработки изображений.
- Sentry, Pino, request context и structured logging.
- Swagger/OpenAPI в non-production.

### 2.2 Frontend stack

- React 19.
- Vite.
- TanStack Router.
- TanStack Query.
- TypeScript.
- Tailwind CSS 4.
- shadcn/ui + Radix UI.
- Socket.IO client.
- react-i18next.
- React Hook Form + Zod.
- Recharts.
- PWA manifest + service worker.
- Sentry и Web Vitals.

### 2.3 Инфраструктура

- Локально: `npm start` или `npm run start:seed`.
- Docker Compose: PostgreSQL, Redis, Mailpit.
- Production frontend: Cloudflare Pages / Vercel-compatible build.
- Production backend: Render.
- Backup/restore scripts.
- Production smoke и load scripts.

## 3. Роли и доступы

### 3.1 ATHLETE

Спортсмен может:

- зарегистрироваться самостоятельно;
- входить в личный кабинет;
- редактировать профиль;
- загружать документы и аватар;
- просматривать турниры;
- видеть свои заявки, матчи и результаты;
- просматривать рейтинг;
- подавать заявку на вступление в клуб;
- получать уведомления.

### 3.2 COACH

Тренер может:

- зарегистрироваться самостоятельно;
- создать клуб или вступить тренером в существующий клуб;
- управлять своим клубом;
- создавать группы клуба;
- добавлять спортсменов вручную;
- импортировать спортсменов массово;
- принимать или отклонять заявки спортсменов в клуб;
- подавать клубные заявки на турниры;
- распределять спортсменов по категориям;
- отправлять заявки на рассмотрение;
- отслеживать оплату заявок;
- смотреть турниры, заявки, спортсменов и уведомления.

### 3.3 ADMIN

Администратор может:

- управлять турнирами и категориями;
- управлять клубами, пользователями и заявками;
- проводить взвешивание;
- модерировать заявки;
- генерировать сетки;
- назначать матчи на татами;
- создавать ссылки судей;
- управлять судейскими и татами-сессиями;
- переопределять результаты матчей;
- выполнять rollback downstream-матчей;
- финализировать турнир;
- управлять рейтингами, настройками, аудитом, PDF, рассылками и отчетами.

Внутри турнира ADMIN также может:

- подтвердить оплату командной заявки;
- изменить статус оплаты заявки;
- назначить или выполнить проверку взвешивания;
- подтвердить персональный допуск спортсмена;
- видеть неоплаченные заявки и недопущенных спортсменов перед генерацией сетки.

### 3.4 JUDGE

Судья не обязан иметь аккаунт. Доступ выдается через временный токен:

- токен на один матч;
- токен на весь татами;
- доступ только к разрешенному матчу или татами;
- управление матчем: старт, пауза, оценки, удержание, golden score, завершение, подтверждение результата, undo доступных действий.

### 3.5 Weigh-in responsible

Отдельная постоянная роль в БД не требуется. Ответственный за взвешивание работает как ADMIN или как назначенный сотрудник турнира с ограниченным доступом к странице взвешивания.

Он может:

- открыть список заявок внутри конкретного турнира;
- видеть оплату команды;
- проверить документы спортсмена;
- внести фактический вес;
- поставить статус допуска каждому спортсмену;
- оставить заметку по взвешиванию;
- не имеет доступа к изменению сеток, результатов и системных настроек, если работает как ограниченный сотрудник.

## 4. Backend-модули и функции

### 4.1 Auth

**Файлы:** `api/src/services/auth.service.ts`, `api/src/routes/auth.routes.ts`

Функции:

- регистрация ATHLETE и COACH;
- login по email/password;
- access JWT;
- refresh token в httpOnly cookie;
- ротация refresh-токенов;
- logout текущей сессии;
- logout со всех устройств;
- получение текущего пользователя;
- смена языка пользователя;
- редактирование профиля;
- восстановление пароля через email;
- email verification;
- TOTP 2FA;
- проверка активности пользователя;
- rate limit на чувствительные операции.

### 4.2 Security middleware

**Файлы:** `api/src/middlewares/*`, `api/src/lib/*`

Функции:

- JWT authentication;
- RBAC authorization;
- CSRF token flow;
- per-user rate limit;
- CORS whitelist;
- Helmet security headers;
- secure cookies в production;
- request id;
- request context с IP, user agent и request id;
- централизованный error handler;
- Sentry integration;
- Prisma client singleton;
- Redis client singleton;
- JWT helpers.

### 4.3 Clubs

**Файлы:** `club.service.ts`, `club.routes.ts`

Функции:

- публичный список клубов;
- фильтры по городу и поиску;
- публичная карточка клуба;
- создание клуба тренером или админом;
- редактирование клуба владельцем или админом;
- soft delete / удаление клуба админом;
- блокировка клуба админом;
- мультиязычное название и описание клуба;
- логотип клуба;
- список участников клуба;
- группы клуба по возрасту;
- создание, редактирование и удаление групп;
- прокси-регистрация спортсмена тренером;
- массовый импорт спортсменов;
- редактирование профиля спортсмена;
- отвязка спортсмена от клуба.

### 4.4 Club join requests

**Файлы:** `club-join.service.ts`, `coach-club-join.service.ts`

Функции:

- спортсмен подает заявку на вступление в клуб;
- спортсмен видит свои заявки;
- спортсмен может отменить активную заявку;
- тренер видит входящие заявки спортсменов;
- тренер принимает или отклоняет заявку спортсмена;
- тренер может подать заявку на вступление в клуб как coach;
- owner клуба принимает или отклоняет тренера;
- owner может удалить тренера из клуба;
- owner может передать владение клубом другому тренеру;
- защита от повторной активной заявки в тот же клуб.

### 4.5 Tournaments

**Файлы:** `tournament.service.ts`, `tournament.routes.ts`

Функции:

- публичный список турниров;
- фильтры по статусу, городу, поиску, upcoming, archive;
- публичная карточка турнира;
- создание турнира админом;
- редактирование турнира админом;
- удаление допустимых турниров;
- смена статуса по lifecycle;
- featured tournaments;
- archive flag;
- постер турнира;
- галерея турнира;
- регламент турнира;
- карта и место взвешивания;
- дедлайн заявок;
- количество татами;
- YouTube URL по татами;
- entry fee и Kaspi payment URL;
- основной язык турнира.

Lifecycle турнира:

```text
DRAFT -> REGISTRATION_OPEN -> REGISTRATION_CLOSED -> IN_PROGRESS -> COMPLETED
    \              \                    \                 \
     \---------------> CANCELLED <-------\-----------------\
```

### 4.6 Categories

**Файлы:** `tournament.service.ts`, `tournament.routes.ts`

Функции:

- создание категорий внутри турнира;
- редактирование категорий;
- удаление категорий до появления зависимых данных;
- пол: MALE / FEMALE;
- возрастной диапазон;
- весовой диапазон;
- длительность матча;
- длительность Golden Score;
- формат сетки: `SE_IJF`, `ROUND_ROBIN`, `MIXED`;
- флаг `allowYuko`;
- мультиязычное название категории;
- публичный список участников категории после approve.

### 4.7 Applications

**Файлы:** `application.service.ts`, `application-entry.service.ts`, `application-shared.ts`

Функции:

- тренер создает draft-заявку клуба на турнир;
- получение существующей draft-заявки;
- добавление спортсмена в категорию;
- удаление entry;
- отправка заявки на рассмотрение;
- approve заявки админом;
- reject заявки админом;
- withdraw заявки тренером;
- bulk approve submitted-заявок турнира;
- просмотр заявки с entries;
- история заявки через AuditLog;
- принудительное удаление entry админом;
- перенос entry в другую категорию админом;
- просмотр entries спортсмена.

Проверки:

- турнир должен быть открыт для регистрации;
- спортсмен должен принадлежать клубу тренера;
- категория должна относиться к выбранному турниру;
- пол, возраст и вес должны соответствовать категории;
- один спортсмен не может быть продублирован в той же категории;
- заявка уникальна для пары tournament + club.

### 4.8 Application payments

**Файлы:** `application-payment.service.ts`, `payment.service.ts`, `payment.routes.ts`

Функции:

- хранение статуса оплаты заявки;
- сумма оплаты в KZT;
- payment provider;
- payment reference;
- payment URL;
- paidAt;
- поддержка статусов `NOT_REQUIRED`, `PENDING`, `PAID`, `FAILED`;
- интеграция с турнирным entry fee и Kaspi URL;
- учет оплаты в admin/coach workflows;
- отметка оплаты на уровне всей командной заявки;
- ручное подтверждение оплаты админом или ответственным сотрудником турнира;
- отображение статуса оплаты в списке заявок внутри турнира;
- выдача условного пропуска команде только после `PAID` или `NOT_REQUIRED`;
- блокировка допуска к жеребьевке для неоплаченных заявок, если у турнира задан обязательный взнос;
- запись платежного действия в AuditLog.

Правило допуска по оплате:

- если `Tournament.entryFeeKzt = 0`, заявка получает статус `NOT_REQUIRED` и не требует оплаты;
- если взнос указан, после отправки заявки создается платежный статус `PENDING`;
- тренер прикрепляет или указывает подтверждение оплаты через доступный payment workflow;
- админ/ответственный внутри турнира проверяет оплату и ставит `PAID`;
- заявка со статусом `FAILED` или `PENDING` не дает команде полный пропуск на соревнование;
- оплата относится к заявке клуба целиком, а не к каждому спортсмену отдельно.

### 4.9 Weigh-in

**Файлы:** `weigh-in.service.ts`

Функции:

- список взвешивания по турниру;
- обновление статуса entry;
- фиксация фактического веса;
- заметки по взвешиванию;
- reviewer;
- weighedAt;
- статусы `PENDING`, `PASSED`, `FAILED_WEIGHT`, `FAILED_DOCUMENTS`, `ABSENT`, `WITHDRAWN`;
- использование статуса допуска в турнирном процессе;
- отдельное подтверждение каждого спортсмена ответственным на взвешивании;
- проверка документов спортсмена;
- проверка веса по категории;
- отметка отсутствующих спортсменов;
- запрет допуска спортсмена к сетке без статуса `PASSED`, если турнир использует обязательное взвешивание;
- отображение оплаты командной заявки рядом со списком спортсменов на взвешивании.

Правило допуска на взвешивании:

- оплата команды не заменяет взвешивание;
- ответственный на взвешивании работает внутри страницы турнира;
- он видит заявку клуба, статус оплаты и список спортсменов;
- если команда оплачена, ответственный проверяет каждого спортсмена отдельно;
- спортсмен получает допуск только после статуса `PASSED`;
- если вес не подходит, ставится `FAILED_WEIGHT`;
- если документы не подходят, ставится `FAILED_DOCUMENTS`;
- если спортсмен не пришел, ставится `ABSENT`;
- в сетку попадают только спортсмены из одобренных заявок, у которых командная оплата разрешена и персональный допуск подтвержден.

### 4.10 Brackets

**Файлы:** `bracket.service.ts`, `bracket.routes.ts`, `bracket-engine/*`

Функции:

- генерация сетки по категории;
- получение сетки категории;
- получение всех сеток турнира;
- получение сетки по id;
- подготовка всех сеток турнира;
- удаление сетки, если матчи не начались;
- защита от повторной генерации;
- deterministic seeding;
- Fisher-Yates shuffle;
- разнесение спортсменов одного клуба;
- BYE-слоты;
- расчет размера сетки;
- metadata для сложных форматов.

Поддерживаемые форматы:

- `SE_IJF`: single elimination с IJF repechage и двумя бронзами;
- `ROUND_ROBIN`: круговая система;
- `MIXED`: групповой этап + плей-офф.

### 4.11 Bracket engine

**Файлы:** `bracket-engine/seeding.ts`, `single-elimination.ts`, `round-robin.ts`, `mixed.ts`, `tatami-plan.ts`

Функции:

- подготовка seed-списка участников;
- shuffle с seed;
- club separation;
- построение single elimination;
- построение repechage;
- построение финала и двух бронзовых матчей;
- построение round-robin расписания;
- расчет round-robin таблицы и тай-брейкеров;
- построение mixed-групп и плей-офф;
- распределение матчей по татами;
- расчет queuePosition.

### 4.12 Matches

**Файлы:** `match.service.ts`, `match-score.service.ts`, `match-lifecycle.service.ts`, `match-propagation.ts`, `match-tatami.service.ts`

Функции:

- публичный список матчей;
- фильтры по tournamentId, bracketId, athleteId, status, tatamiNumber;
- карточка матча с event log;
- старт матча;
- пауза матча;
- переход в Golden Score;
- начисление IPPON;
- начисление WAZA_ARI;
- начисление YUKO при включенном allowYuko;
- начисление SHIDO;
- HANSOKU_MAKE;
- auto-finish по правилам IJF;
- pending result;
- confirm result;
- cancel pending result;
- undo last score event;
- reset match админом;
- ручное завершение;
- optimistic locking через `version`;
- запись MatchEvent;
- scoreSnapshot;
- автоматическое продвижение победителя в следующий матч;
- обработка проигравших для repechage и bronze;
- realtime events.

Правила auto-finish:

- IPPON завершает матч;
- 2 Waza-ari дают Ippon;
- 3 Shido дают Hansoku-make;
- Hansoku-make завершает матч поражением нарушившей стороны.

### 4.13 Osaekomi timer

**Файлы:** `osaekomi-timer.service.ts`

Функции:

- старт удержания;
- TOKETA;
- серверный расчет длительности удержания;
- восстановление активных таймеров после рестарта backend;
- 5+ секунд: Yuko, если включен allowYuko;
- 10+ секунд: Waza-ari;
- 20+ секунд: Ippon;
- защита от параллельных удержаний;
- realtime events `match:osaekomiStart` и `match:osaekomiEnd`.

### 4.14 Golden Score timer

**Файлы:** `golden-score-timer.service.ts`

Функции:

- фиксация времени входа в Golden Score;
- хранение `goldenScoreStartedAt`;
- восстановление таймера после рестарта backend;
- realtime event `match:goldenScore`;
- поддержка unlimited Golden Score через `goldenScoreSec = 0`.

### 4.15 Judge sessions

**Файлы:** `judge-session.service.ts`, `match.routes.ts`

Функции:

- создание временной ссылки на один матч;
- token-based доступ без аккаунта;
- TTL токена;
- judgeName;
- отметка usedAt;
- отзыв токена админом;
- проверка доступа судьи только к своему матчу;
- endpoint получения матча по токену.

### 4.16 Tatami sessions

**Файлы:** `tatami-session.service.ts`

Функции:

- создание временной ссылки на татами;
- доступ ко всем матчам заданного tournamentId + tatamiNumber;
- TTL сессии;
- judgeName;
- список активных сессий;
- отзыв сессии;
- защита от управления чужим татами;
- экран `/tatami/$token` на frontend.

### 4.17 Tatami queue

**Файлы:** `match-tatami.service.ts`, `bracket-engine/tatami-plan.ts`

Функции:

- назначение матча на татами;
- queuePosition;
- перемещение матча в очереди;
- публичная очередь татами;
- realtime update очереди;
- поддержка live wall и судейского экрана;
- сохранение порядка матчей в БД.

### 4.18 Admin override and rollback

**Файлы:** `admin-override.service.ts`, `audit.service.ts`

Функции:

- переопределение результата завершенного матча;
- указание причины override;
- recursive downstream rollback;
- отмена зависимых матчей;
- очистка слотов старого победителя;
- установка нового победителя;
- повторное продвижение нового победителя;
- отметка `isReplay`;
- сохранение `replayReason`;
- AuditLog на каждый шаг.

### 4.19 Rating

**Файлы:** `rating.service.ts`

Функции:

- финализация турнира;
- расчет мест по сеткам;
- расчет мест round-robin по таблице;
- создание RatingEntry;
- защита от повторного начисления;
- публичный рейтинг спортсмена;
- публичный leaderboard;
- рейтинг клубов;
- настройка баллов через SystemConfig.

Базовая шкала:

```text
1 место: 100
2 место: 80
3 место: 50
4-5 место: 30
7-8 место: 15
участие: 0
```

### 4.20 Notifications

**Файлы:** `notification.service.ts`, `notification.routes.ts`

Функции:

- список уведомлений пользователя;
- unread count;
- mark read;
- mark all read;
- payload;
- i18n title/body keys;
- admin broadcast конкретному пользователю;
- broadcast по роли;
- broadcast по турниру;
- broadcast по клубу;
- broadcast всем пользователям;
- realtime доставка через user rooms.

### 4.21 Push notifications

**Файлы:** `push.service.ts`, `web/public/push-sw.js`

Функции:

- сохранение Web Push subscription;
- удаление subscription;
- VAPID workflow;
- push service worker;
- привязка подписки к пользователю;
- хранение endpoint, p256dh, auth, userAgent.

### 4.22 Email

**Файлы:** `email.service.ts`, `email-verification.service.ts`

Функции:

- SMTP/Resend отправка;
- проверка SMTP соединения;
- email verification token;
- expiry и повторная отправка;
- forgot password email;
- reset password token;
- локализация писем по preferredLocale.

### 4.23 PDF

**Файлы:** `pdf.service.ts`, `pdf-bracket.service.ts`, `pdf-protocol.service.ts`, `pdf-certificate.service.ts`, `pdf-bracket/*`

Функции:

- PDF одной сетки;
- PDF всех сеток турнира;
- итоговый PDF-протокол турнира;
- PDF-сертификаты;
- кириллица и казахские символы через embedded font;
- группировка матчей по секциям;
- вывод участников, клубов, татами и результатов;
- доступность протокола после завершения турнира;
- отдельные rate limits для PDF endpoints.

### 4.24 Excel export

**Файлы:** `excel-export.service.ts`

Функции:

- экспорт данных в Excel-совместимый формат;
- использование в отчетах и админских выгрузках;
- тестовое покрытие unit-тестами.

### 4.25 Upload and storage

**Файлы:** `upload.routes.ts`, `storage.ts`

Функции:

- загрузка изображений;
- загрузка аватаров;
- загрузка пользовательских документов;
- допустимые форматы JPG, PNG, WEBP, GIF;
- resize изображений;
- avatar resize до 512px;
- конвертация в WebP;
- локальное хранение uploads в dev;
- S3-compatible storage в production при наличии env;
- публичные media URL.

### 4.26 Backup and archival

**Файлы:** `backup.service.ts`, `audit-archival.service.ts`, `scripts/backup.sh`, `scripts/restore.sh`

Функции:

- ручной запуск backup script;
- планировщик backup;
- безопасный запуск backup;
- restore script;
- архивирование audit logs;
- production runbook.

### 4.27 Pending result cleanup

**Файлы:** `pending-result-cleanup.service.ts`

Функции:

- фоновые проверки pending result;
- очистка зависших состояний;
- поддержание консистентности матчей.

### 4.28 Admin management

**Файлы:** `admin-management.service.ts`, `admin.routes.ts`

Функции:

- статистика админ-панели;
- список пользователей;
- карточка пользователя;
- создание пользователя;
- обновление пользователя;
- soft delete / удаление пользователя;
- активация и деактивация пользователя;
- reset password;
- смена клуба пользователя;
- управление клубами;
- блокировка клуба;
- управление группами;
- featured/archive для турниров;
- SystemConfig;
- AuditLog;
- все заявки одним endpoint;
- отчеты и аналитика.

### 4.29 Audit

**Файлы:** `audit.service.ts`

Функции:

- запись действия;
- actorUserId;
- targetEntity и targetId;
- before/after JSON;
- metadata;
- ipAddress;
- userAgent;
- фильтрация audit logs;
- аудит override, rollback, finalize, admin operations.

### 4.30 OpenAPI and developer tooling

**Файлы:** `scripts/generate-openapi.mjs`, `server.ts`

Функции:

- Swagger/OpenAPI в non-production;
- генерация OpenAPI spec;
- dev scripts;
- smoke scripts;
- load scripts;
- bundle size check.

## 5. Frontend-модули и страницы

### 5.1 Общая оболочка

**Файлы:** `web/src/routes/__root.tsx`, `web/src/router.tsx`, `DashboardShell.tsx`

Функции:

- TanStack Router;
- глобальный QueryClient;
- retry policy для запросов;
- scroll restoration;
- error boundary;
- Sentry breadcrumbs по навигации;
- общий dashboard layout;
- role-based navigation;
- mobile responsive layout.

### 5.2 Публичная зона

Страницы:

- `/`;
- `/about`;
- `/tournaments`;
- `/tournaments/$id`;
- `/rankings`;
- `/protocol`;
- `/live-wall/$tournamentId`;
- `/display/$tournamentId`.

Функции:

- главная страница проекта;
- просмотр турниров;
- карточка турнира;
- категории турнира;
- участники категории;
- публичные рейтинги;
- просмотр протокола;
- live wall для зала;
- display screen для соревнований;
- адаптивный UI.

### 5.3 Auth UI

Страницы:

- `/login`;
- `/forgot-password`;
- `/reset-password`.

Функции:

- вход;
- обработка auth state;
- восстановление пароля;
- reset password;
- локальное хранение auth state;
- защищенные маршруты;
- redirect по роли.

### 5.4 Athlete dashboard

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

- личный кабинет спортсмена;
- профиль и фото;
- onboarding;
- турниры спортсмена;
- матчи спортсмена;
- карточка матча;
- результаты;
- уведомления;
- клубная принадлежность.

### 5.5 Coach dashboard

Страницы:

- `/coach`;
- `/coach/`;
- `/coach/profile`;
- `/coach/club`;
- `/coach/athletes`;
- `/coach/athletes/$id`;
- `/coach/tournaments`;
- `/coach/tournaments/$id`;
- `/coach/applications`;
- `/coach/applications/$id`;
- `/coach/notifications`;
- `/coach/onboarding`.

Функции:

- кабинет тренера;
- профиль тренера;
- управление клубом;
- группы клуба;
- список спортсменов;
- карточка спортсмена;
- создание спортсменов;
- заявки в клуб;
- турниры для подачи заявки;
- создание и редактирование турнирной заявки;
- добавление athletes в categories;
- submit заявки;
- отслеживание статусов;
- уведомления.

### 5.6 Admin dashboard

Страницы:

- `/admin`;
- `/admin/`;
- `/admin/analytics`;
- `/admin/tournaments`;
- `/admin/tournaments/$id`;
- `/admin/applications`;
- `/admin/clubs`;
- `/admin/clubs/$id`;
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

- сводная админ-панель;
- аналитика;
- CRUD турниров;
- управление категориями;
- заявки турниров;
- взвешивание;
- генерация сеток;
- просмотр и управление матчами;
- создание судейских ссылок;
- управление татами;
- управление клубами;
- управление пользователями;
- рейтинги;
- уведомления и broadcast;
- audit log;
- настройки системы;
- отчеты;
- протоколы.

### 5.7 Judge UI

Страницы:

- `/judge`;
- `/judge/$token`;
- `/tatami/$token`.

Функции:

- доступ судьи по токену;
- экран одного матча;
- экран всего татами;
- старт и пауза матча;
- начисление оценок;
- osaekomi/toketa;
- golden score;
- pending/confirm result;
- отображение текущего счета;
- очередь татами;
- realtime-обновления.

### 5.8 Judo components

**Файлы:** `web/src/components/judo/*`

Функции:

- визуализация сетки;
- Olympic bracket;
- live bracket;
- hold button для удержания;
- компоненты для турнирных сценариев.

### 5.9 Tournament components

**Файлы:** `web/src/components/tournament/*`

Функции:

- overview tab;
- categories tab;
- applications tab;
- weigh-in tab;
- protocol tab;
- audit tab;
- notify tab;
- map location picker;
- общие helpers для турниров;
- возрастные группы.

### 5.10 Shared UI

**Файлы:** `web/src/components/ui/*`

Функции:

- кнопки, input, textarea, select;
- dialog, alert-dialog, sheet, drawer;
- tabs, accordion, table, pagination;
- avatar, avatar crop, profile photo;
- calendar, slider, switch, checkbox, radio;
- tooltip, popover, dropdown, context menu;
- sidebar, navigation menu, breadcrumb;
- chart components;
- error boundary и fallback;
- skeleton, progress, badge;
- password strength;
- email verification banner;
- confetti.

### 5.11 API hooks

**Файлы:** `web/src/hooks/api/*`

Функции:

- `useAuth`;
- `useTournaments`;
- `useApplications`;
- `useClub`;
- `useMatches`;
- `useNotifications`;
- `useRatings`;
- единые TanStack Query wrappers;
- cache invalidation;
- mutations для основных workflow.

### 5.12 Frontend libraries

**Файлы:** `web/src/lib/*`

Функции:

- API client;
- auth store;
- local auth;
- protected route;
- socket client;
- i18n;
- theme;
- tatami state;
- tatami offline queue;
- error capture;
- Sentry;
- web vitals;
- PWA helpers;
- utility functions.

### 5.13 Internationalization

**Файлы:** `web/src/shared/locales/*`, `web/src/locales/*`

Функции:

- ru;
- kk;
- en;
- переключатель языка;
- localStorage;
- сохранение preferredLocale на backend;
- fallback-переводы;
- мультиязычный UI;
- поддержка мультиязычных полей турниров и клубов.

### 5.14 PWA

**Файлы:** `web/public/manifest.webmanifest`, `web/public/push-sw.js`, `usePWA.ts`, `usePushNotifications.ts`

Функции:

- web manifest;
- icons 192/512;
- service worker для push;
- PWA install flow;
- push subscription flow.

## 6. База данных

### 6.1 Основные enum

- `UserRole`: ATHLETE, COACH, ADMIN.
- `UserDocumentType`: BIRTH_CERTIFICATE, STUDY_CERTIFICATE, COACH_ID.
- `ClubRole`: OWNER, COACH.
- `Gender`: MALE, FEMALE.
- `Locale`: ru, kk, en.
- `TournamentStatus`: DRAFT, REGISTRATION_OPEN, REGISTRATION_CLOSED, IN_PROGRESS, COMPLETED, CANCELLED.
- `BracketFormat`: SE_IJF, ROUND_ROBIN, MIXED.
- `ApplicationStatus`: DRAFT, SUBMITTED, APPROVED, REJECTED, WITHDRAWN.
- `PaymentStatus`: NOT_REQUIRED, PENDING, PAID, FAILED.
- `WeighInStatus`: PENDING, PASSED, FAILED_WEIGHT, FAILED_DOCUMENTS, ABSENT, WITHDRAWN.
- `MatchStatus`: PENDING, IN_PROGRESS, COMPLETED, CANCELLED.
- `MatchEventType`: HAJIME, MATE, SORE_MADE, IPPON, WAZA_ARI, YUKO, SHIDO, HANSOKU_MAKE, GOLDEN_SCORE, REPLAY, END, OSAEKOMI, TOKETA.
- `MatchSide`: RED, BLUE, WHITE, SYSTEM.
- `JoinRequestStatus`: PENDING, APPROVED, REJECTED.

### 6.2 Модели Prisma

- `User`: пользователи, роли, профиль, email verification, TOTP, клуб, документы, уведомления.
- `UserDocument`: документы пользователя.
- `Club`: клубы, мультиязычное имя, город, блокировка, owner.
- `ClubGroup`: группы клуба.
- `Tournament`: турниры, даты, статус, татами, постер, галерея, регламент, взнос, YouTube.
- `Category`: категории турнира.
- `Application`: клубная заявка на турнир и оплата.
- `ApplicationEntry`: спортсмен в конкретной категории заявки и взвешивание.
- `Bracket`: сетка категории.
- `Match`: матч, участники, татами, статус, счет, winner, timers, version.
- `MatchEvent`: event log матча.
- `JudgeSession`: токен судьи на матч.
- `TatamiSession`: токен судьи на татами.
- `RatingEntry`: начисленные рейтинговые очки.
- `Notification`: уведомления пользователя.
- `AuditLog`: журнал действий.
- `SystemConfig`: настройки системы.
- `PushSubscription`: Web Push подписки.
- `ClubJoinRequest`: заявка спортсмена в клуб.
- `CoachClubJoinRequest`: заявка тренера в клуб.

## 7. Realtime

Используется Socket.IO.

Комнаты:

- `tournament:{id}`;
- `bracket:{id}`;
- `tatami:{n}`;
- `user:{id}`.

События:

- `match:started`;
- `match:scoreUpdate`;
- `match:event`;
- `match:osaekomiStart`;
- `match:osaekomiEnd`;
- `match:goldenScore`;
- `match:pendingResult`;
- `match:finished`;
- `tatami:queueUpdate`;
- `bracket:update`;
- `notification:created`.

Принцип: realtime ускоряет UI, но источником истины остается БД. После reconnect frontend должен догружать состояние через REST.

## 8. Основные пользовательские сценарии

### 8.1 Создание и проведение турнира

1. ADMIN создает турнир.
2. ADMIN добавляет категории.
3. ADMIN открывает регистрацию.
4. COACH создает заявку клуба.
5. COACH добавляет спортсменов в категории.
6. COACH отправляет заявку.
7. ADMIN проверяет и одобряет заявку.
8. COACH оплачивает заявку команды, если у турнира есть взнос.
9. ADMIN или ответственный сотрудник турнира подтверждает оплату заявки.
10. Ответственный на взвешивании открывает турнир и проверяет спортсменов.
11. Ответственный ставит каждому спортсмену статус допуска: `PASSED`, `FAILED_WEIGHT`, `FAILED_DOCUMENTS`, `ABSENT` или `WITHDRAWN`.
12. ADMIN закрывает регистрацию.
13. ADMIN генерирует сетки только по допущенным спортсменам.
14. ADMIN назначает матчи на татами.
15. ADMIN создает судейские ссылки.
16. JUDGE ведет матч с панели.
17. Система автоматически обновляет счет и сетку.
18. ADMIN финализирует турнир.
19. Система начисляет рейтинг.
20. PDF-протокол становится доступен.

### 8.2 Оплата и допуск команды

1. Заявка клуба создается как `DRAFT`.
2. После отправки заявка становится `SUBMITTED`.
3. Если участие платное, у заявки стоит payment status `PENDING`.
4. Тренер оплачивает участие команды.
5. ADMIN или ответственный внутри турнира проверяет оплату.
6. После проверки заявка получает `PAID`.
7. `PAID` означает, что команда получила финансовый пропуск.
8. Финансовый пропуск не означает автоматический допуск всех спортсменов.
9. Каждый спортсмен отдельно подтверждается на взвешивании.

### 8.3 Судейство матча

1. Судья открывает ссылку `/judge/$token` или `/tatami/$token`.
2. Система проверяет токен.
3. Судья нажимает HAJIME.
4. Судья фиксирует оценки и нарушения.
5. При удержании судья нажимает OSAEKOMI, затем TOKETA.
6. Backend рассчитывает длительность удержания.
7. При Ippon, 2 Waza-ari или 3 Shido система формирует pending result.
8. Результат подтверждается.
9. Победитель автоматически продвигается в сетке.
10. Live wall и сетка обновляются через Socket.IO.

### 8.4 Override результата

1. ADMIN выбирает завершенный матч.
2. ADMIN указывает нового победителя и причину.
3. Система ищет downstream-матчи.
4. Система откатывает зависимые результаты.
5. Система очищает слоты старого победителя.
6. Система продвигает нового победителя.
7. Все действия пишутся в AuditLog.

## 9. Тестирование

### 9.1 Backend tests

Реализованы:

- unit tests;
- integration tests;
- db tests;
- system tests;
- acceptance tests.

Файлы:

- `api/tests/unit/bracket-engine.test.ts`;
- `api/tests/unit/match-scoring.test.ts`;
- `api/tests/unit/new-features.test.ts`;
- `api/tests/unit/socket-acl.test.ts`;
- `api/tests/unit/storage.test.ts`;
- `api/tests/unit/validators.test.ts`;
- `api/tests/unit/excel-export.test.ts`;
- `api/tests/integration/application-service.test.ts`;
- `api/tests/integration/auth-service.test.ts`;
- `api/tests/integration/match-service.test.ts`;
- `api/tests/db/auth.test.ts`;
- `api/tests/db/tournament-lifecycle.test.ts`;
- `api/tests/system/api.test.ts`;
- `api/tests/system/smoke.test.ts`;
- `api/tests/acceptance/tournament-lifecycle.test.ts`.

Команды:

```bash
npm run test -w api
npm run test:db -w api
npm run test:smoke -w api
```

### 9.2 E2E tests

Файлы:

- `e2e/smoke.test.ts`;
- `e2e/judging-flow.test.ts`;
- `e2e/a11y.test.ts`.

Команды:

```bash
npm run test:e2e
npm run test:e2e:a11y
npm run test:e2e:headed
```

### 9.3 Demo scripts

- `demo-e2e.sh`;
- `demo-match.sh`;
- `demo-prepare.sh`;
- `demo-watch-flow.mjs`;
- `test-bracket.py`.

## 10. Документация и вспомогательные файлы

В проекте есть:

- `README.md`: обзор проекта, запуск, скриншоты.
- `BACKEND_MODULES.md`: обзор backend-модулей.
- `ROLES_ACTIONS.md`: действия ролей.
- `DAILY_COMMANDS.md`: ежедневные команды.
- `SETUP_DOCKER.md`: настройка Docker.
- `SETUP_PGADMIN.md`: настройка pgAdmin.
- `docs/DEPLOYMENT.md`: деплой.
- `docs/PRODUCTION_READINESS.md`: production readiness.
- `docs/TECHNICAL_SPECIFICATION_RU.md`: техническая спецификация.
- `docs/screenshots/*`: скриншоты интерфейса.

## 11. Команды запуска

Локальный полный запуск:

```bash
npm start
```

Запуск с demo seed:

```bash
npm run start:seed
```

Раздельный dev:

```bash
npm run dev:web
npm run dev:api
```

Сборка:

```bash
npm run build
```

База данных:

```bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:studio
```

Production checks:

```bash
npm run prod:smoke
npm run load:api
npm run load:socket
npm run check:bundle
```

## 12. Нефункциональные требования

Система должна:

- корректно работать на desktop и mobile;
- поддерживать несколько татами одновременно;
- обеспечивать realtime-обновления судейской панели, live wall и сеток;
- хранить критичные изменения в AuditLog;
- использовать HTTPS и secure cookies в production;
- хранить секреты только в env;
- валидировать входные данные через Zod;
- не доверять клиентскому времени для судейских таймеров;
- восстанавливать активные osaekomi и golden score timers после рестарта;
- защищать admin и judge actions авторизацией;
- корректно отображать русский, казахский и английский языки;
- иметь backup/restore workflow;
- иметь smoke, unit, integration и e2e-проверки.

## 13. Критерии готовности проекта

Проект считается готовым, если:

- локальный запуск работает через `npm start`;
- миграции Prisma применяются успешно;
- seed создает demo-аккаунты и demo-данные;
- публичные страницы открываются;
- авторизация работает для ATHLETE, COACH, ADMIN;
- тренер может создать клуб и заявку;
- админ может создать турнир, категории и одобрить заявку;
- оплата заявки команды отображается и подтверждается внутри турнира;
- оплаченная заявка дает команде финансовый пропуск;
- взвешивание работает по каждому спортсмену отдельно;
- ответственный на взвешивании может подтвердить допуск спортсмена внутри турнира;
- неоплаченные заявки и неподтвержденные спортсмены не попадают в сетку при обязательной оплате и взвешивании;
- сетки генерируются для `SE_IJF`, `ROUND_ROBIN`, `MIXED`;
- судейская ссылка открывает матч;
- судья может провести матч;
- счет считается по правилам дзюдо;
- победитель продвигается по сетке;
- live wall и bracket обновляются realtime;
- admin override работает с rollback;
- финализация турнира начисляет рейтинг;
- PDF сетки и протокола генерируются;
- уведомления и push subscriptions работают;
- i18n ru/kk/en подключен;
- тесты проходят на ключевых сценариях.

## 14. Итог

Judo-Arena реализована как production-oriented MVP для соревнований по дзюдо. В проект добавлены не только базовые функции старого ТЗ, но и расширенные модули: заявки в клуб, coach ownership, взвешивание, платежные статусы, татами-сессии, pending result, undo/reset, server-side timers, Web Push, email verification, TOTP, галерея турнира, регламент, YouTube streams, PDF-сертификаты, Excel export, backup/restore, audit archival, Sentry и расширенное тестирование.

Старое ТЗ больше не используется. Актуальное описание проекта находится в этом документе.
