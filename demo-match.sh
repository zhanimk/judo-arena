#!/usr/bin/env bash
# ============================================================
# Judo-Arena — Demo полного судейского сценария
#
# Что делает:
#   1. Логин админа
#   2. Находит готовый матч (PENDING с двумя участниками)
#   3. Создаёт судейскую сессию для этого матча
#   4. От лица судьи — HAJIME (старт)
#   5. OSAEKOMI (RED начинает удержание)
#   6. Ждёт 11 секунд
#   7. TOKETA → сервер сам начислит Waza-ari (за удержание 10+ сек)
#   8. Показывает итог
#
# Запуск:
#   chmod +x demo-match.sh
#   ./demo-match.sh
# ============================================================

set -e

API="http://localhost:4000"
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[1;34m'; N='\033[0m'
print() { printf "${B}▶ %s${N}\n" "$1"; }
ok()    { printf "${G}  ✓ %s${N}\n" "$1"; }
warn()  { printf "${Y}  ⚠ %s${N}\n" "$1"; }
fail()  { printf "${R}  ✗ %s${N}\n" "$1"; exit 1; }

extract() {
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$1', ''))" 2>/dev/null
}

# ============================================================
# 1. Логин админа
# ============================================================
print "Шаг 1. Логин админа"
ADMIN_TOKEN=$(curl -s -X POST $API/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@judo-arena.kz","password":"password123"}' | extract accessToken)
[[ -n "$ADMIN_TOKEN" ]] && ok "Админ залогинен" || fail "Не удалось войти"

# ============================================================
# 2. Поиск готового матча (PENDING с двумя участниками)
# ============================================================
print "Шаг 2. Поиск PENDING матча с двумя участниками"

MATCH_INFO=$(curl -s "$API/api/matches?status=PENDING&limit=20" \
  | python3 -c "
import sys, json
matches = json.load(sys.stdin)
for m in matches:
    if m.get('redAthlete') and m.get('blueAthlete'):
        print(f\"{m['id']}|{m['redAthlete']['name']} {m['redAthlete']['surname']}|{m['blueAthlete']['name']} {m['blueAthlete']['surname']}\")
        break
")
[[ -n "$MATCH_INFO" ]] || fail "Нет матчей с двумя участниками. Сгенерируй сетку через ./demo-e2e.sh"

IFS='|' read -r MATCH_ID RED_NAME BLUE_NAME <<< "$MATCH_INFO"
ok "Матч: $MATCH_ID"
ok "  RED:  $RED_NAME"
ok "  BLUE: $BLUE_NAME"

# ============================================================
# 3. Создание судейской сессии
# ============================================================
print "Шаг 3. Создание судейской сессии"

JUDGE=$(curl -s -X POST $API/api/matches/$MATCH_ID/judge-session \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"judgeName":"Берик Сериков","ttlHours":12}')
JUDGE_TOKEN=$(echo "$JUDGE" | extract token)
[[ -n "$JUDGE_TOKEN" ]] && ok "Токен судьи: ${JUDGE_TOKEN:0:24}..." || fail "Не создалась сессия: $JUDGE"
ok "Судейский URL: /judge/$JUDGE_TOKEN"

# ============================================================
# 4. HAJIME — старт матча
# ============================================================
print "Шаг 4. ХАДЖИМЕ — старт матча"

START=$(curl -s -X POST $API/api/matches/$MATCH_ID/start \
  -H "X-Judge-Token: $JUDGE_TOKEN")
STATUS=$(echo "$START" | extract status)
[[ "$STATUS" == "IN_PROGRESS" ]] && ok "Матч идёт (IN_PROGRESS)" || fail "Не запустился: $START"

# ============================================================
# 5. OSAEKOMI — RED начинает удержание
# ============================================================
print "Шаг 5. OSAEKOMI — RED начинает удержание ($RED_NAME)"

OSAE=$(curl -s -X POST $API/api/matches/$MATCH_ID/osaekomi \
  -H "X-Judge-Token: $JUDGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"side":"RED"}')
OK_MATCH=$(echo "$OSAE" | python3 -c "import sys,json; d=json.load(sys.stdin); m=d.get('match',{}); s=m.get('scoreSnapshot',{}); os=s.get('osaekomi') if isinstance(s,dict) else None; print('1' if os else '')")
[[ "$OK_MATCH" == "1" ]] && ok "Удержание зафиксировано на сервере" || warn "Не вижу osaekomi: $OSAE"

# ============================================================
# 6. Ждём 11 секунд
# ============================================================
print "Шаг 6. ⏳ Считаем 11 секунд (на UI был бы реальный таймер)"

for i in 11 10 9 8 7 6 5 4 3 2 1; do
  printf "${Y}  ⏱  %2d сек${N}\r" "$i"
  sleep 1
done
echo ""
ok "11 секунд истекли"

# ============================================================
# 7. TOKETA — конец удержания, сервер начисляет балл
# ============================================================
print "Шаг 7. TOKETA — выход из удержания (ожидаем Waza-ari)"

TOKETA=$(curl -s -X POST $API/api/matches/$MATCH_ID/toketa \
  -H "X-Judge-Token: $JUDGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"TOKETA"}')

DURATION=$(echo "$TOKETA" | extract durationSec)
SCORED=$(echo "$TOKETA" | extract scoredType)
AUTO=$(echo "$TOKETA" | extract autoFinished)
WINNER_ID=$(echo "$TOKETA" | extract winnerId)

ok "Длительность удержания: $DURATION сек"
ok "Сервер начислил: $SCORED"
[[ "$AUTO" == "True" ]] && ok "Матч авто-завершён, победитель: $WINNER_ID" || ok "Матч продолжается"

# ============================================================
# 8. Текущее состояние матча
# ============================================================
print "Шаг 8. 🥋 Финальное состояние матча"

FINAL=$(curl -s $API/api/matches/$MATCH_ID)
echo "$FINAL" | python3 -c "
import sys, json
m = json.load(sys.stdin)
print()
print('  ┌─────────────────────────────────────────────────────────┐')
print(f'  │  Матч {m[\"id\"]:<46} │')
print(f'  │  Статус: {m[\"status\"]:<48} │')
print('  ├─────────────────────────────────────────────────────────┤')
red = m.get('redAthlete', {}) or {}
blue = m.get('blueAthlete', {}) or {}
score = m.get('scoreSnapshot', {}) or {}
red_s = score.get('red', {})
blue_s = score.get('blue', {})

red_name = f\"{red.get('name','?')} {red.get('surname','?')}\"
blue_name = f\"{blue.get('name','?')} {blue.get('surname','?')}\"

def line(s):
    return f\"I:{s.get('ippon',0)} W:{s.get('wazaari',0)} Y:{s.get('yuko',0)} S:{s.get('shido',0)}\"

print(f'  │  🔴 RED  {red_name:<25}  {line(red_s):<18} │')
print(f'  │  🔵 BLUE {blue_name:<25}  {line(blue_s):<18} │')

if m.get('winnerId'):
    winner_name = red_name if m['winnerId']==red.get('id') else blue_name
    print('  ├─────────────────────────────────────────────────────────┤')
    print(f'  │  🏆 ПОБЕДИТЕЛЬ: {winner_name:<41} │')
print('  └─────────────────────────────────────────────────────────┘')

events = m.get('events', [])
if events:
    print(f'\n  📋 Лог событий ({len(events)}):')
    for e in events:
        meta = e.get('meta') or {}
        extra = ''
        if meta.get('toketa'):
            extra = f\" (Toketa, {meta.get('durationSec')}s → {meta.get('scored')})\"
        side = e.get('side','-')
        print(f\"    • {e.get('type'):<14} {side:<6}{extra}\")
"

echo ""
print "🎉 СЦЕНАРИЙ ЗАВЕРШЁН"
echo ""
echo "  Экспортируй переменные на будущее (если захочешь делать запросы вручную):"
echo "    export MATCH_ID=$MATCH_ID"
echo "    export JUDGE_TOKEN=$JUDGE_TOKEN"
echo "    export ADMIN_TOKEN=$ADMIN_TOKEN"
