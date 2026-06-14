# 📋 Daily Commands — Judo-Arena

Шпаргалка команд на каждый день работы. Печатай или держи открытым в VS Code.

---

## 🌅 УТРО — запуск всего

**Шаг 1.** Открой **Docker Desktop** двойным кликом (значок кита 🐳).
Подожди 30-60 секунд пока кит станет статичным в строке меню.

**Шаг 2.** Открой Terminal (или встроенный в VS Code: `Ctrl + ``).

**Шаг 3.** Запусти всё одной командой:

```bash
cd ~/Desktop/judo-arena && docker compose up -d && docker ps
```

Должна увидеть 3 контейнера со статусом `Up`:
- `judo-postgres` (порт 5433)
- `judo-redis` (порт 6379)
- `judo-mailpit` (порты 1025, 8025)

**Шаг 4.** Запусти бэкенд (открой **новую вкладку** терминала `Cmd + T`):

```bash
cd ~/Desktop/judo-arena/api && npm run dev
```

Дождись сообщения:
```
🥋 Judo-Arena API listening on http://0.0.0.0:4000
```

**Шаг 5.** Запусти Prisma Studio (опционально, если хочешь видеть БД, ещё одна вкладка):

```bash
cd ~/Desktop/judo-arena/api && npx prisma studio
```

Откроет http://localhost:5555 в браузере.

**Готово!** Теперь ты можешь делать curl-запросы или работать с фронтом.

---

## 🧪 ТЕСТ — быстрая проверка что всё работает

```bash
# Проверить что API живой и БД подключена
curl http://localhost:4000/health
```

Ожидаемый ответ: `{"status":"ok","db":"connected"}`

```bash
# Залогиниться как админ — получишь JWT-токен
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@judo-arena.kz","password":"password123"}'
```

Если возвращает `accessToken` — всё работает. ✓

---

## 🌙 ВЕЧЕР — корректное завершение

**Шаг 1.** Останови бэкенд: в его терминале нажми `Ctrl + C`.

**Шаг 2.** Останови Prisma Studio: тоже `Ctrl + C` в её терминале.

**Шаг 3.** Останови Docker контейнеры:

```bash
cd ~/Desktop/judo-arena && docker compose stop
```

> `stop` не удаляет данные. Утром поднимешь через `up -d` или `start`, и БД будет на том же месте со всеми твоими записями.

**Шаг 4.** Можешь закрыть Docker Desktop (правый клик на кита → Quit Docker Desktop).

---

## 🆘 ЕСЛИ ЧТО-ТО СЛОМАЛОСЬ

### "Cannot connect to the Docker daemon"
Docker Desktop не запущен. Открой приложение, дождись кита, повтори команду.

### "port 5432 already in use"
Локальный Postgres съел порт. У нас используется 5433 (см. docker-compose.yml). Если опять упирается — рестарт Mac обычно решает.

### "DATABASE_URL not found"
Проверь что файл `api/.env` существует. Если нет:

```bash
cp ~/Desktop/judo-arena/.env ~/Desktop/judo-arena/api/.env
```

### "EADDRINUSE: port 4000 already in use"
Бэкенд уже запущен где-то в фоне. Найди и убей:

```bash
lsof -ti:4000 | xargs kill -9
```

Потом снова `npm run dev`.

### Контейнер postgres не запускается
Посмотри логи:

```bash
docker logs judo-postgres
```

Если данные повреждены — полный сброс (⚠️ удалит все данные БД!):

```bash
cd ~/Desktop/judo-arena
docker compose down -v
docker compose up -d
cd api
npx prisma migrate dev
npx prisma db seed
```

---

## 📂 ВАЖНЫЕ ССЫЛКИ (когда сервер запущен)

| Что | Где |
|---|---|
| API | http://localhost:4000 |
| API health | http://localhost:4000/health |
| Prisma Studio (GUI базы) | http://localhost:5555 |
| Mailpit (тестовая почта) | http://localhost:8025 |
| Postgres (для pgAdmin) | `localhost:5433`, user `judo`, pass `judo_dev_password`, db `judo_arena` |

---

## 🎯 ОДНОСТРОЧНИКИ (для быстроты)

```bash
# Перезапустить только бэкенд
cd ~/Desktop/judo-arena/api && npm run dev

# Перезапустить только БД (без потери данных)
cd ~/Desktop/judo-arena && docker compose restart

# Применить новую миграцию (если я поменяю schema.prisma)
cd ~/Desktop/judo-arena/api && npx prisma migrate dev

# Сгенерировать клиент после правки schema.prisma
cd ~/Desktop/judo-arena/api && npx prisma generate

# Засеять заново тестовые данные
cd ~/Desktop/judo-arena/api && npx prisma db seed

# Войти в БД через psql (если нужно SQL)
docker exec -it judo-postgres psql -U judo -d judo_arena
```

---

## 💡 СОВЕТ

Сохрани этот файл в Закладки браузера (открой его в VS Code, потом в браузере открой `file:///Users/zhanetta/Desktop/judo-arena/DAILY_COMMANDS.md` или просто открой в VS Code preview через `Cmd + Shift + V`).

Или **распечатай** — реально удобно держать рядом с компьютером первые дни.
