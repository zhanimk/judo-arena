#!/usr/bin/env bash
# ============================================================
# Judo-Arena — ПОЛНАЯ ПОДГОТОВКА ДЕМО-ДАННЫХ ДЛЯ ВИДЕО
#
# Что делает:
#   1. Пересеивает БД (чистые данные)
#   2. Прогоняет e2e: заявки → approve → генерация сетки (категория M -73)
#   3. Проводит ВСЕ матчи до конца (через Иппон)
#   4. Финализирует турнир → начисляет рейтинг
#
# После этого система готова к записи демо-видео.
#
# Запуск:
#   chmod +x demo-prepare.sh
#   ./demo-prepare.sh
# ============================================================

set -e

API="http://localhost:4000"
TOURNAMENT="tournament-almaty-cup-2026"
CATEGORY_INDEX=0        # 0 = Ер адамдар -73 кг (SE_IJF — самый зрелищный)
CATEGORY="cat-${TOURNAMENT}-${CATEGORY_INDEX}"

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[1;34m'; C='\033[0;36m'; N='\033[0m'
print() { printf "${B}▶ %s${N}\n" "$1"; }
ok()    { printf "${G}  ✓ %s${N}\n" "$1"; }
warn()  { printf "${Y}  ⚠ %s${N}\n" "$1"; }
fail()  { printf "${R}  ✗ ОШИБКА: %s${N}\n" "$1"; exit 1; }
info()  { printf "${C}    %s${N}\n" "$1"; }

extract() {
  python3 -c "import sys,json
d=json.load(sys.stdin)
if isinstance(d, list):
    print('')
else:
    print(d.get('$1', ''))" 2>/dev/null
}

extractArr() {
  python3 -c "import sys,json
d=json.load(sys.stdin)
if isinstance(d, list):
    print(len(d))
else:
    print('')" 2>/dev/null
}

echo ""
printf "${B}╔══════════════════════════════════════════════════════╗${N}\n"
printf "${B}║      🥋  JUDO-ARENA  —  DEMO PREPARE                ║${N}\n"
printf "${B}╚══════════════════════════════════════════════════════╝${N}\n\n"

# ============================================================
# Шаг 0. Проверить что API работает
# ============================================================
print "Шаг 0. Проверка API"
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/tournaments")
[[ "$STATUS_CODE" == "200" ]] && ok "API отвечает (http $STATUS_CODE)" \
  || fail "API не отвечает на $API — запусти ./start.sh"

# ============================================================
# Шаг 1. Ресеид БД
# ============================================================
print "Шаг 1. Пересев БД (npm run db:seed)"
(cd api && npx prisma db seed --silent 2>&1 | tail -5)
ok "БД пересеяна"

# ============================================================
# Шаг 2. Запустить e2e-сценарий для категории 0 (M -73)
# ============================================================
print "Шаг 2. E2E: заявки → approve → сетка"
CATEGORY_INDEX=0 ./demo-e2e.sh 2>&1 | grep -E "✓|✗|⚠|BRACKET|Сетка|Матчей" | head -30
ok "E2E завершён — сетка сгенерирована"

# ============================================================
# Шаг 3. Логин для дальнейших операций
# ============================================================
print "Шаг 3. Логин adminа"
ADMIN_TOKEN=$(curl -s -X POST $API/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@judo-arena.kz","password":"password123"}' | extract accessToken)
[[ -n "$ADMIN_TOKEN" ]] && ok "Токен получен" || fail "Логин не удался"

# ============================================================
# Шаг 4. Получить все матчи категории (PENDING с двумя участниками)
# ============================================================
print "Шаг 4. Получение списка матчей"

MATCH_DATA=$(curl -s "$API/api/matches?tournamentId=$TOURNAMENT&limit=200" \
  | python3 -c "
import sys, json
matches = json.load(sys.stdin)
# Только матчи с двумя участниками, не COMPLETED
ready = [m for m in matches if m.get('redAthlete') and m.get('blueAthlete') and m.get('status') != 'COMPLETED']
for m in ready:
    r = m['redAthlete']
    b = m['blueAthlete']
    print(f\"{m['id']}|{m.get('bracketSection','?')}|r{m['round']}p{m['position']}\")
")

MATCH_IDS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && MATCH_IDS+=("$line")
done <<< "$MATCH_DATA"

READY=${#MATCH_IDS[@]}
ok "Готовых матчей (с участниками): $READY"

if [[ $READY -eq 0 ]]; then
  warn "Нет готовых матчей — возможно сетка уже была сыграна"
  info "Попробуй: npm run db:reset && npm run db:seed && ./demo-prepare.sh"
fi

# ============================================================
# Шаг 5. Провести все матчи (Ippon для RED)
# ============================================================
if [[ $READY -gt 0 ]]; then
  print "Шаг 5. Проведение $READY матчей (Иппон для RED)"

  PLAYED=0
  MAX_ITER=60  # защита от бесконечного цикла
  ITER=0

  while [[ $ITER -lt $MAX_ITER ]]; do
    ITER=$((ITER+1))

    # Заново получаем готовые матчи (после каждого завершения могут открыться новые)
    PENDING_MATCHES=$(curl -s "$API/api/matches?tournamentId=$TOURNAMENT&limit=200" \
      | python3 -c "
import sys, json
matches = json.load(sys.stdin)
ready = [m for m in matches if m.get('redAthlete') and m.get('blueAthlete') and m.get('status') in ('PENDING','IN_PROGRESS')]
for m in ready:
    print(m['id'])
")

    [[ -z "$PENDING_MATCHES" ]] && break

    MATCH_ID=$(echo "$PENDING_MATCHES" | head -1)
    [[ -z "$MATCH_ID" ]] && break

    # Создаём судейскую сессию
    JUDGE_RESP=$(curl -s -X POST "$API/api/matches/$MATCH_ID/judge-session" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"judgeName":"Auto-Judge","ttlHours":1}')
    JUDGE_TOKEN=$(echo "$JUDGE_RESP" | extract token)
    [[ -z "$JUDGE_TOKEN" ]] && { warn "Не создалась сессия для $MATCH_ID"; continue; }

    # Запустить матч
    curl -s -X POST "$API/api/matches/$MATCH_ID/start" \
      -H "X-Judge-Token: $JUDGE_TOKEN" > /dev/null

    # Иппон для RED
    FINISH=$(curl -s -X POST "$API/api/matches/$MATCH_ID/score" \
      -H "X-Judge-Token: $JUDGE_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"type":"IPPON","side":"RED"}')

    NEW_STATUS=$(echo "$FINISH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
m = d.get('match') or d
print(m.get('status','?'))
" 2>/dev/null)

    PLAYED=$((PLAYED+1))
    printf "${G}  ✓ Матч %2d: %-44s → %s${N}\n" "$PLAYED" "$MATCH_ID" "$NEW_STATUS"
  done

  ok "Проведено матчей: $PLAYED"
fi

# ============================================================
# Шаг 6. Финализация турнира → рейтинг
# ============================================================
print "Шаг 6. Финализация турнира (начисление рейтинга)"

FINALIZE=$(curl -s -X POST "$API/api/admin/finalize/$TOURNAMENT" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
ENTRIES=$(echo "$FINALIZE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('entriesCount', d.get('error', 'error')))
" 2>/dev/null)

if [[ "$ENTRIES" =~ ^[0-9]+$ ]]; then
  ok "Рейтинг начислен: $ENTRIES записей"
else
  # Турнир может быть уже COMPLETED если запускали раньше
  MSG=$(echo "$FINALIZE" | extract message)
  warn "Финализация: $MSG (возможно уже COMPLETED)"
fi

# ============================================================
# Шаг 7. Итоговый статус
# ============================================================
print "Шаг 7. Финальная проверка"

TOURNAMENT_STATUS=$(curl -s "$API/api/tournaments/$TOURNAMENT" | extract status)
ok "Статус турнира: $TOURNAMENT_STATUS"

MATCH_STATS=$(curl -s "$API/api/matches?tournamentId=$TOURNAMENT&limit=200" \
  | python3 -c "
import sys, json
matches = json.load(sys.stdin)
from collections import Counter
c = Counter(m['status'] for m in matches)
for k, v in sorted(c.items()):
    print(f'{k}: {v}')
")
ok "Статистика матчей:"
while IFS= read -r line; do
  info "$line"
done <<< "$MATCH_STATS"

RATING_COUNT=$(curl -s "$API/api/ratings/leaderboard?limit=100" \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
ok "Спортсменов в рейтинге: ${RATING_COUNT:-0}"

echo ""
printf "${G}╔══════════════════════════════════════════════════════╗${N}\n"
printf "${G}║   🎬  СИСТЕМА ГОТОВА К ЗАПИСИ ДЕМО-ВИДЕО!           ║${N}\n"
printf "${G}╠══════════════════════════════════════════════════════╣${N}\n"
printf "${G}║  Фронт:   http://localhost:8080                      ║${N}\n"
printf "${G}║  API:     http://localhost:4000                      ║${N}\n"
printf "${G}║  Mailpit: http://localhost:8025                      ║${N}\n"
printf "${G}╠══════════════════════════════════════════════════════╣${N}\n"
printf "${G}║  Логины (пароль: password123)                        ║${N}\n"
printf "${G}║  • admin@judo-arena.kz          → ADMIN             ║${N}\n"
printf "${G}║  • coach.almaty@judo-arena.kz   → COACH             ║${N}\n"
printf "${G}║  • m0-0@almaty-judo.judo-arena.kz → ATHLETE         ║${N}\n"
printf "${G}╠══════════════════════════════════════════════════════╣${N}\n"
printf "${G}║  Сценарий: DEMO_VIDEO_SCRIPT.md                      ║${N}\n"
printf "${G}╚══════════════════════════════════════════════════════╝${N}\n\n"
