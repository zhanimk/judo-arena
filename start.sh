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

set -e

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

if ! command -v docker >/dev/null 2>&1; then
  fail "Docker не установлен. Скачай Docker Desktop."
fi
if ! docker ps >/dev/null 2>&1; then
  fail "Docker daemon не запущен. Открой Docker Desktop и подожди пока кит станет статичным."
fi
ok "Docker готов"

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js не установлен. Скачай с https://nodejs.org"
fi
ok "Node.js $(node -v)"

# ============================================================
# 1. Docker контейнеры
# ============================================================
print "Запуск Docker контейнеров (Postgres + Redis + Mailpit)"
docker compose up -d
sleep 2
ok "Контейнеры подняты"

# ============================================================
# 2. Установка зависимостей если их нет
# ============================================================
if [ ! -d "api/node_modules" ]; then
  print "Установка зависимостей backend (1-2 мин)"
  (cd api && npm install)
fi
ok "Backend deps OK"

if [ ! -d "web/node_modules" ]; then
  print "Установка зависимостей frontend (2-3 мин)"
  (cd web && npm install)
fi
ok "Frontend deps OK"

# ============================================================
# 3. Prisma migrate + optional seed
# ============================================================
print "Применяем миграции Prisma"
(cd api && npx prisma migrate dev)

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

# Trap чтобы при Ctrl+C убить оба процесса
trap "echo ''; echo '🛑 Остановка...'; kill 0; exit" SIGINT SIGTERM

# Запускаем оба процесса в фоне и ждём
(cd api && npm run dev) &
API_PID=$!

(cd web && npm run dev) &
WEB_PID=$!

# Ждём пока любой из них упадёт
wait
