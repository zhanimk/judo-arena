# Размещение Judo-Arena на VPS

Подготовленная схема: Caddy (HTTPS) → Node SSR frontend + Fastify API → PostgreSQL 16 / Redis 7. Один экземпляр API. БД и Redis не публикуют порты наружу. Все браузерные запросы и WebSocket используют один домен.

## Подготовка

Нужны Linux VPS с Docker Engine и Compose v2, домен с A/AAAA на сервер, открытые TCP 80/443 и UDP 443. Если AAAA существует, он должен указывать на этот сервер. Внешняя почта и приватное S3-совместимое хранилище обязательны для production API.

Из корня проекта:

```bash
cp deploy/vps.env.example .env.vps
chmod 600 .env.vps
```

Заполнить `.env.vps`: домен без протокола, пароль БД, четыре независимых секрета, почту, приватный bucket и ключи хранилища. Для каждого секрета отдельно выполнить `openssl rand -hex 32`. Пароль PostgreSQL использовать в hex, поскольку он входит в URL. Файл с секретами не коммитить.

Проверить, что подсеть `172.30.80.0/24` свободна. Если меняете её, синхронно изменить `TRUST_PROXY` и адрес Caddy в `compose.vps.yml`.

## Первый запуск

```bash
docker compose --env-file .env.vps -f compose.vps.yml config --quiet
docker compose --env-file .env.vps -f compose.vps.yml up -d --build
docker compose --env-file .env.vps -f compose.vps.yml ps
docker compose --env-file .env.vps -f compose.vps.yml logs --tail=100 api web caddy
```

Сервис `migrate` применяет миграции перед API. Caddy получает сертификат автоматически после правильной настройки DNS. Данные БД, Redis, загрузки и сертификаты хранятся в Docker volumes. Не выполнять `down -v`: это удаляет данные.

Создать настоящего администратора без demo seed (Bash):

```bash
read -r -p 'Admin email: ' ADMIN_EMAIL
read -r -s -p 'Admin password (12–72 characters): ' ADMIN_PASSWORD
printf '\n'
export ADMIN_EMAIL ADMIN_PASSWORD
docker compose --env-file .env.vps -f compose.vps.yml exec -T \
  -e ADMIN_EMAIL -e ADMIN_PASSWORD api node dist/scripts/create-admin.js
unset ADMIN_EMAIL ADMIN_PASSWORD
```

Команда отказывается менять существующий аккаунт. После входа включить 2FA. Demo seed в production не использовать: он содержит общедоступные пароли.

## Проверка после установки

Проверить `https://DOMAIN/`, `/login`, `/tournaments` и `/health`. Затем пройти вход администратора, создание турнира, заявку тренера и спортсмена, загрузку приватного документа, взвешивание, жеребьёвку, судейский результат с табло, PDF и рейтинг. Проверить secure cookies, доставку писем и переподключение WebSocket.

Платёжные ключи FreedomPay и callbacks проверять отдельно в sandbox; образец окружения не включает рабочий платёжный шлюз. Без его настройки production-инициация онлайн-платежа вернёт 503. Ручное подтверждение оплаты доступно администратору.

## Backup и обновления

В образ API включён `pg_dump` версии 16. Автоматический backup по `BACKUP_CRON` пишет в приватное S3. Проверить наличие свежих объектов и восстановление на отдельной базе. Ручная проверка:

```bash
docker compose --env-file .env.vps -f compose.vps.yml exec -T api node dist/scripts/run-backup.js
```

Перед обновлением выполнить backup и проверить его успешность. Затем обновить исходники и повторить `up -d --build`. Миграции вперёд не равны откату: при несовместимой миграции потребуется проверенный план восстановления.

Для сборки вне Docker: Node из `.nvmrc`, `npm ci`, `npm run build:vps`. Frontend: `HOST=0.0.0.0 PORT=3000 node web/.output/server/index.mjs`. API запускается из папки `api`: `npm start -w api`; для backup нужен `pg_dump` 16.

Подготовка файлов и локальная сборка не подтверждают работу конкретного VPS, DNS, сертификатов, почты, S3 или платежей. Результаты проверок см. в [аудите](AUDIT-2026-10-26.md).
