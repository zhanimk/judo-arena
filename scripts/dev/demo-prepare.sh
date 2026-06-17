#!/usr/bin/env bash
# Полный локальный demo-прогон:
# seed -> проведение всех матчей -> финализация -> проверка рейтинга.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_URL="${API_URL:-http://localhost:4000}"
TOURNAMENT_ID="demo-complete-flow-2026"

G='\033[0;32m'
B='\033[1;34m'
R='\033[0;31m'
N='\033[0m'

step() { printf "${B}▶ %s${N}\n" "$1"; }
ok() { printf "${G}  ✓ %s${N}\n" "$1"; }
fail() { printf "${R}  ✗ %s${N}\n" "$1"; exit 1; }

step "Проверка API"
HTTP_CODE="$(curl -sS -o /dev/null -w "%{http_code}" "$API_URL/health")"
[[ "$HTTP_CODE" == "200" ]] || fail "API не отвечает на $API_URL"
ok "API отвечает"

step "Подготовка свежих demo-данных"
(
  cd "$ROOT_DIR/api"
  npx prisma db seed >/tmp/judo-arena-demo-seed.log
)
ok "Созданы клубы, спортсмены, заявки, сетки и татами"

step "Проведение всех матчей и начисление рейтинга"
(
  cd "$ROOT_DIR/api"
  npx tsx prisma/complete-demo.ts >/tmp/judo-arena-demo-complete.log
)
ok "Матчи завершены, рейтинг рассчитан"

step "Итоговая проверка"
SUMMARY="$(
  curl -sS "$API_URL/api/tournaments/$TOURNAMENT_ID"
  printf '\n'
  curl -sS "$API_URL/api/matches?tournamentId=$TOURNAMENT_ID&limit=200"
  printf '\n'
  curl -sS "$API_URL/api/ratings/leaderboard?limit=100"
)"

printf '%s' "$SUMMARY" | python3 -c '
import json
import sys

lines = sys.stdin.read().splitlines()
tournament = json.loads(lines[0])
matches = json.loads(lines[1])
ratings = json.loads(lines[2])

pending = [match for match in matches if match["status"] != "COMPLETED"]
if tournament["status"] != "COMPLETED":
    raise SystemExit("Турнир не завершён: {}".format(tournament["status"]))
if pending:
    raise SystemExit(f"Остались незавершённые матчи: {len(pending)}")
if not ratings:
    raise SystemExit("Рейтинг пуст")

print("  Турнир: {} ({})".format(tournament["id"], tournament["status"]))
print(f"  Матчи: {len(matches)} завершено")
print(f"  Спортсмены в рейтинге: {len(ratings)}")
print("  Лидер: {} {} — {} очков".format(
    ratings[0]["athlete"]["name"],
    ratings[0]["athlete"]["surname"],
    ratings[0]["totalPoints"],
))
'

ok "Demo-турнир полностью готов"
printf '\nFrontend: http://localhost:8080\n'
printf 'Турнир:  http://localhost:8080/tournaments/%s\n' "$TOURNAMENT_ID"
printf 'Рейтинг: http://localhost:8080/rankings\n'
