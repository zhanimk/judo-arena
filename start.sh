#!/usr/bin/env bash
# ============================================================
# Judo-Arena — единый старт всего стека
#
# Поднимает:
#   1. Docker контейнеры (Postgres + Redis + Mailpit)
#   2. Backend (Fastify) на http://localhost:4000
#   3. Frontend (TanStack Start) на адрес который сам подскажет
#
# Запуск:
#   chmod +x start.sh   (один раз)
#   ./start.sh
#   ./start.sh --seed   применить seed после миграций
# ============================================================

set -euo pipefail

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[1;34m'; N='\033[0m'
print() { printf "${B}▶ %s${N}\n" "$1"; }
ok()    { printf "${G}  ✓ %s${N}\n" "$1"; }
warn()  { printf "${Y}  ⚠ %s${N}\n" "$1"; }
fail()  { printf "${R}  ✗ %s${N}\n" "$1"; exit 1; }

cd "$(dirname "$0")"

RUN_SEED=false
for arg in "$@"; do
  case "$arg" in
    --seed)
      RUN_SEED=true
      ;;
    *)
      fail "Неизвестный аргумент: $arg. Доступно: --seed"
      ;;
  esac
done

# ============================================================
# 0. Проверки
# ============================================================
print "Проверки окружения"

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js не установлен. Установи Node 22 согласно .nvmrc."
fi
if [ "$(node -p 'process.versions.node.split(".")[0]')" != "22" ]; then
  fail "Нужен Node.js 22 (см. .nvmrc). Выполни nvm use перед запуском."
fi
ok "Node.js $(node -v)"

if [ ! -f .env ]; then
  fail "Нет .env. Скопируй .env.example в .env и заполни настройки."
fi
if ! command -v docker >/dev/null 2>&1; then
  fail "Docker не установлен. Установи Docker Desktop."
fi
if ! docker info >/dev/null 2>&1; then
  fail "Docker daemon не запущен. Открой Docker Desktop и дождись запуска."
fi
if ! docker compose version >/dev/null 2>&1; then
  fail "Нужен Docker Compose v2 (docker compose)."
fi
ok "Docker готов"

# Установка выполняется из корня workspace строго по lock-файлу.
# Проверяем модули, а не наличие папок: прерванная установка оставляет папки.
if ! node --input-type=module -e '
  await import("concurrently");
  await import("tsx");
  await import("vite");
  await import("@prisma/client");
  await import("vitest/node");
' >/dev/null 2>&1; then
  print "Установка зависимостей workspace"
  npm ci
fi
ok "Зависимости готовы"

print "Запуск PostgreSQL, Redis и Mailpit"
docker compose up -d --wait --wait-timeout 90 postgres redis mailpit
ok "Контейнеры готовы"

# ============================================================
# 3. Prisma migrate + optional seed
# ============================================================
print "Синхронизируем локальную БД Prisma"
npm run prisma:generate -w api
npm run prisma:migrate:deploy -w api

if [ "$RUN_SEED" = true ]; then
  print "Засеваем тестовые данные"
  (cd api && npx prisma db seed)
else
  warn "Seed пропущен. Для демо-данных запусти: ./start.sh --seed"
fi
ok "БД готова"

# ============================================================
# 4. Запуск backend и frontend параллельно
# ============================================================
print "Запуск backend (http://localhost:4000) и frontend"
echo ""
echo -e "${Y}    Логи бэка и фронта пойдут вперемешку. Чтобы остановить — Ctrl+C${N}"
echo -e "${Y}    Открой в браузере адрес который покажет фронт (обычно http://localhost:8080 или 5173)${N}"
echo ""

# concurrently завершает оба дерева процессов при падении сервера или Ctrl+C.
exec ./node_modules/.bin/concurrently --kill-others --success all \
  -n api,web -c green,blue \
  "npm run dev -w api" "npm run dev -w web"
