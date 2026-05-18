# pgAdmin 4 — пошаговая настройка для Judo-Arena

Жанетта, ты установила pgAdmin 4 — это лучший визуальный клиент для PostgreSQL. Сейчас мы подключим его к локальной БД и я покажу что и где смотреть.

> **Важно:** мы будем поднимать PostgreSQL **через Docker**, а pgAdmin использовать как окошко для просмотра данных. То есть pgAdmin сам БД не запускает — он просто подключается к ней.

## Шаг 0. Что должно быть установлено

- [ ] **Docker Desktop** — если нет, скачай с docker.com и установи (Windows/Mac). После установки запусти его, в трее должен висеть кит.
- [ ] **pgAdmin 4** — у тебя уже есть.
- [ ] **Node.js 20+** — проверь командой `node -v` в терминале. Если нет — nodejs.org → LTS.
- [ ] **Git** — проверь `git --version`. Если нет — git-scm.com.
- [ ] **VS Code** — куда мы будем смотреть на проект.

## Шаг 1. Запустить PostgreSQL через Docker

Я создам файл `docker-compose.yml` в корне проекта (это будет день 2). Запуск будет одной командой:

```bash
docker-compose up -d
```

После этого Postgres будет крутиться на твоём ноутбуке по адресу `localhost:5432`, а Redis на `localhost:6379`.

## Шаг 2. Подключить pgAdmin к этой базе

1. Открой pgAdmin 4.
2. Левая панель → правый клик на **Servers** → **Register** → **Server...**
3. Вкладка **General**:
   - **Name:** `Judo-Arena Local` (любое название)
4. Вкладка **Connection**:
   - **Host name/address:** `localhost`
   - **Port:** `5432`
   - **Maintenance database:** `judo_arena`
   - **Username:** `judo`
   - **Password:** `judo_dev_password` (это пароль из docker-compose, для разработки норм)
   - **Save password?** ✔️ (галочку поставь)
5. Кнопка **Save**.

Если всё ок — слева раскроется дерево: `Judo-Arena Local → Databases → judo_arena → Schemas → public → Tables` (после первой миграции Prisma там появятся все 13 таблиц).

## Шаг 3. Как смотреть данные в pgAdmin

- **Дерево слева:** Servers → Judo-Arena Local → Databases → judo_arena → Schemas → public → Tables.
- **Правый клик на таблице** → **View/Edit Data → All Rows** — открывает строки таблицы.
- **Tools → Query Tool** — можно писать SQL-запросы напрямую (мы их будем использовать редко, потому что есть Prisma).

## Шаг 4. Альтернатива — Prisma Studio (часто удобнее)

Prisma даёт собственный GUI для просмотра данных:

```bash
cd server
npx prisma studio
```

Откроется http://localhost:5555 — красивый интерфейс с фильтрами, связями, удобным редактированием. Лично я бы пользовалась Prisma Studio для повседневной работы, а pgAdmin — когда нужно посмотреть план запроса или сделать что-то нестандартное.

## Шаг 5. Что делать, если не подключается

- **"Could not connect to server"** → проверь, что Docker запущен (в трее виден кит) и контейнер postgres работает: `docker ps` должен показать строку с `postgres:16`.
- **"password authentication failed"** → пароль из docker-compose не совпал. Открой `docker-compose.yml`, найди `POSTGRES_PASSWORD`, скопируй точное значение.
- **"timeout"** → возможно занят порт 5432 другим Postgres (если он у тебя локально установлен и работает). Останови локальный сервис Postgres через services.msc (Windows) или `brew services stop postgresql` (Mac).

## Команды Docker, которые тебе пригодятся

```bash
docker-compose up -d          # запустить БД в фоне
docker-compose down           # остановить БД
docker-compose down -v        # остановить и удалить данные (для чистого старта)
docker ps                     # посмотреть какие контейнеры работают
docker logs judo-postgres     # логи постгреса
```

> Эти команды я положу в README, тебе их учить не нужно — будут под рукой.
