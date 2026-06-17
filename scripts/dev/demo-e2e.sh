#!/usr/bin/env bash
# ============================================================
# Judo-Arena — E2E demo скрипт (v2 — мульти-клубная версия)
#
# Прогоняет полный сценарий:
#   1. Логин админа и всех 4 тренеров
#   2. Каждый тренер создаёт заявку для своего клуба
#   3. В каждую заявку добавляются ВСЕ подходящие спортсмены клуба
#   4. Submit заявок тренерами
#   5. Approve заявок админом
#   6. Закрытие регистрации турнира
#   7. Генерация турнирной сетки (соберёт участников из всех клубов!)
#   8. Красивый вывод сетки
#
# Запуск:
#   chmod +x scripts/dev/demo-e2e.sh  (один раз)
#   ./scripts/dev/demo-e2e.sh
# ============================================================

set -e

API="http://localhost:4000"
TOURNAMENT="tournament-almaty-cup-2026"
# Категория: 0=M -73, 1=M -81, 2=F -57 (Round-Robin), 3=F -63
CATEGORY_INDEX=${CATEGORY_INDEX:-1}
CATEGORY="cat-${TOURNAMENT}-${CATEGORY_INDEX}"

CLUBS=("almaty-judo" "astana-pro" "tigers-karaganda" "shymkent-warriors")
COACHES=(
  "coach.almaty@judo-arena.kz"
  "coach.astana@judo-arena.kz"
  "coach.karaganda@judo-arena.kz"
  "coach.shymkent@judo-arena.kz"
)

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
print "Шаг 1. Логин админа и 4 тренеров"

ADMIN_TOKEN=$(curl -s -X POST $API/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@judo-arena.kz","password":"password123"}' | extract accessToken)
[[ -n "$ADMIN_TOKEN" ]] && ok "Админ" || fail "Не удалось войти как админ"

# Логин всех тренеров
COACH_TOKENS=()
for COACH in "${COACHES[@]}"; do
  T=$(curl -s -X POST $API/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$COACH\",\"password\":\"password123\"}" | extract accessToken)
  [[ -n "$T" ]] && ok "Тренер $COACH" || fail "Не удалось войти как $COACH"
  COACH_TOKENS+=("$T")
done

# ============================================================
# 2. Подготовка: гарантировать что турнир в REGISTRATION_OPEN
# ============================================================
print "Шаг 2. Подготовка турнира — открываем регистрацию"

T_INFO=$(curl -s $API/api/tournaments/$TOURNAMENT)
T_STATUS=$(echo "$T_INFO" | extract status)
ok "Текущий статус: $T_STATUS"

# Если уже COMPLETED — это конец, ничего сделать нельзя
if [[ "$T_STATUS" == "COMPLETED" ]]; then
  fail "Турнир уже COMPLETED — для нового demo нужно ресетить через Prisma Studio"
fi

# Если CANCELLED — нужно сначала вернуть в DRAFT, потом открыть
if [[ "$T_STATUS" == "CANCELLED" ]]; then
  curl -s -X POST $API/api/tournaments/$TOURNAMENT/status \
    -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
    -d '{"status":"DRAFT"}' > /dev/null
  T_STATUS="DRAFT"
fi

# Если IN_PROGRESS — невозможно вернуться к регистрации, бросаем
if [[ "$T_STATUS" == "IN_PROGRESS" ]]; then
  warn "Турнир IN_PROGRESS — пропускаем создание заявок, сразу к сетке"
fi

# Если DRAFT или REGISTRATION_CLOSED — переводим в REGISTRATION_OPEN
if [[ "$T_STATUS" == "DRAFT" || "$T_STATUS" == "REGISTRATION_CLOSED" ]]; then
  OPEN=$(curl -s -X POST $API/api/tournaments/$TOURNAMENT/status \
    -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
    -d '{"status":"REGISTRATION_OPEN"}')
  NEW_STATUS=$(echo "$OPEN" | extract status)
  [[ "$NEW_STATUS" == "REGISTRATION_OPEN" ]] && ok "Регистрация открыта" \
    || warn "Не удалось открыть: $(echo "$OPEN" | extract message)"
fi

# Получить информацию о выбранной категории
CAT_INFO=$(curl -s $API/api/tournaments/$TOURNAMENT/categories \
  | python3 -c "import sys,json; c=json.load(sys.stdin)[$CATEGORY_INDEX]; print(f\"{c['gender']}|{c['weightMin']}|{c['weightMax']}|{c['format']}\")")
IFS='|' read -r CAT_GENDER CAT_WMIN CAT_WMAX CAT_FORMAT <<< "$CAT_INFO"
ok "Категория #$CATEGORY_INDEX: $CAT_GENDER, $CAT_WMIN-$CAT_WMAX кг, формат $CAT_FORMAT"

# ============================================================
# 3. По каждому клубу: создать заявку + добавить спортсменов
# ============================================================
print "Шаг 3. Создание заявок и набор спортсменов"

APP_IDS=()
TOTAL_ATHLETES=0
for i in "${!CLUBS[@]}"; do
  CLUB="club-${CLUBS[$i]}"
  TOKEN="${COACH_TOKENS[$i]}"

  # Создать заявку (или получить существующую DRAFT)
  APP=$(curl -s -X POST $API/api/tournaments/$TOURNAMENT/applications \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"notes\":\"Заявка ${CLUBS[$i]}\"}")
  APP_ID=$(echo "$APP" | extract id)
  APP_STATUS=$(echo "$APP" | extract status)
  [[ -n "$APP_ID" ]] || { warn "Клуб ${CLUBS[$i]}: не удалось создать заявку"; continue; }

  # Найти подходящих спортсменов клуба
  ATHLETES=$(curl -s $API/api/clubs/$CLUB/members \
    | python3 -c "
import sys, json
members = json.load(sys.stdin)
gender = '$CAT_GENDER'
wmin = float('$CAT_WMIN')
wmax = float('$CAT_WMAX')
fitting = [m for m in members if m['gender']==gender and m['weightKg'] is not None and wmin < m['weightKg'] <= wmax]
for m in fitting:
    print(m['id'])
")
  ATHLETE_IDS=($ATHLETES)
  COUNT=${#ATHLETE_IDS[@]}

  # Если заявка ещё DRAFT — добавляем спортсменов
  if [[ "$APP_STATUS" == "DRAFT" ]]; then
    ADDED=0
    for ATH in "${ATHLETE_IDS[@]}"; do
      RESP=$(curl -s -X POST $API/api/applications/$APP_ID/entries \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"athleteId\":\"$ATH\",\"categoryId\":\"$CATEGORY\"}")
      ERR=$(echo "$RESP" | extract error)
      [[ -z "$ERR" ]] && ADDED=$((ADDED+1))
    done
    ok "Клуб ${CLUBS[$i]}: подходящих $COUNT, добавлено $ADDED"
    TOTAL_ATHLETES=$((TOTAL_ATHLETES + ADDED))
    APP_IDS+=("$APP_ID:$ADDED")
  else
    # Уже отправлена — считаем что entries есть
    ENTRIES_COUNT=$(curl -s $API/api/applications/$APP_ID \
      -H "Authorization: Bearer $TOKEN" \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(len([e for e in d.get('entries',[]) if e.get('categoryId')=='$CATEGORY']))")
    ok "Клуб ${CLUBS[$i]}: заявка уже $APP_STATUS ($ENTRIES_COUNT в этой категории)"
    TOTAL_ATHLETES=$((TOTAL_ATHLETES + ENTRIES_COUNT))
    APP_IDS+=("$APP_ID:0")
  fi
done

ok "Всего участников в категории: $TOTAL_ATHLETES"
[[ $TOTAL_ATHLETES -ge 2 ]] || fail "Минимум 2 участника для сетки"

# ============================================================
# 4. Submit заявок
# ============================================================
print "Шаг 4. Submit заявок тренерами"

for i in "${!APP_IDS[@]}"; do
  APP_ID="${APP_IDS[$i]%%:*}"
  ADDED="${APP_IDS[$i]##*:}"
  TOKEN="${COACH_TOKENS[$i]}"
  if [[ "$ADDED" -gt 0 ]]; then
    SUBMIT=$(curl -s -X POST $API/api/applications/$APP_ID/submit \
      -H "Authorization: Bearer $TOKEN")
    STATUS=$(echo "$SUBMIT" | extract status)
    if [[ "$STATUS" == "SUBMITTED" ]]; then
      ok "Клуб #$i: SUBMITTED"
    else
      warn "Клуб #$i: $STATUS / $(echo "$SUBMIT" | extract message)"
    fi
  fi
done

# ============================================================
# 5. Approve заявок админом
# ============================================================
print "Шаг 5. Approve заявок админом"

for APP_PAIR in "${APP_IDS[@]}"; do
  APP_ID="${APP_PAIR%%:*}"
  APPROVE=$(curl -s -X POST $API/api/applications/$APP_ID/approve \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"reviewerNotes":"Demo approve"}')
  STATUS=$(echo "$APPROVE" | extract status)
  if [[ "$STATUS" == "APPROVED" ]]; then
    ok "Заявка $APP_ID: APPROVED"
  else
    warn "Заявка $APP_ID: $STATUS"
  fi
done

# ============================================================
# 6. Закрытие регистрации
# ============================================================
print "Шаг 6. Закрытие регистрации турнира"

CLOSE=$(curl -s -X POST $API/api/tournaments/$TOURNAMENT/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"REGISTRATION_CLOSED"}')
CLOSE_STATUS=$(echo "$CLOSE" | extract status)
if [[ "$CLOSE_STATUS" == "REGISTRATION_CLOSED" ]]; then
  ok "Регистрация закрыта"
else
  warn "Уже закрыта или ошибка: $(echo "$CLOSE" | extract message)"
fi

# ============================================================
# 7. ГЕНЕРАЦИЯ СЕТКИ
# ============================================================
print "Шаг 7. 🥋 ГЕНЕРАЦИЯ ТУРНИРНОЙ СЕТКИ"

BRACKET=$(curl -s -X POST $API/api/tournaments/$TOURNAMENT/categories/$CATEGORY/bracket \
  -H "Authorization: Bearer $ADMIN_TOKEN")
BRACKET_ID=$(echo "$BRACKET" | extract id)

if [[ -z "$BRACKET_ID" ]]; then
  ERR=$(echo "$BRACKET" | extract error)
  MSG=$(echo "$BRACKET" | extract message)
  if [[ "$ERR" == "ALREADY_EXISTS" ]]; then
    warn "Сетка уже была создана с предыдущего запуска. Получаем существующую..."
    BRACKET=$(curl -s $API/api/tournaments/$TOURNAMENT/categories/$CATEGORY/bracket)
    BRACKET_ID=$(echo "$BRACKET" | extract id)
    [[ -n "$BRACKET_ID" ]] && ok "Получена существующая сетка" || fail "Не получилось: $MSG"
  else
    fail "Не создалась: $MSG"
  fi
fi

BRACKET_SIZE=$(echo "$BRACKET" | extract size)
BRACKET_FORMAT=$(echo "$BRACKET" | extract format)

ok "Сетка готова!"
echo ""
printf "${G}┌────────────────────────────────────────────────┐${N}\n"
printf "${G}│  🥋 BRACKET                                    │${N}\n"
printf "${G}├────────────────────────────────────────────────┤${N}\n"
printf "${G}│  ID:       %-36s│${N}\n" "$BRACKET_ID"
printf "${G}│  Size:     %-36s│${N}\n" "$BRACKET_SIZE"
printf "${G}│  Format:   %-36s│${N}\n" "$BRACKET_FORMAT"
printf "${G}│  Athletes: %-36s│${N}\n" "$TOTAL_ATHLETES"
printf "${G}└────────────────────────────────────────────────┘${N}\n"
echo ""

# Детальный вывод матчей
echo "$BRACKET" | python3 -c "
import sys, json
b = json.load(sys.stdin)
matches = b.get('matches', [])
print(f'📋 Всего матчей: {len(matches)}\n')

sections = {}
for m in matches:
    sec = m.get('bracketSection') or 'main'
    sections.setdefault(sec, []).append(m)

order = ['main', 'repechage', 'bronze1', 'bronze2', 'final']
names = {
    'main': '═══ Основная сетка ═══',
    'repechage': '═══ Repechage (зона переигровок) ═══',
    'bronze1': '═══ Бронза #1 ═══',
    'bronze2': '═══ Бронза #2 ═══',
    'final': '═══ Финал ═══',
}

for sec in order:
    if sec not in sections: continue
    print(names[sec])
    for m in sorted(sections[sec], key=lambda x: (x['round'], x['position'])):
        red = m.get('redAthlete')
        blue = m.get('blueAthlete')
        rn = f\"{red['name']} {red['surname']}\" if red else '— TBD —'
        bn = f\"{blue['name']} {blue['surname']}\" if blue else '— TBD —'
        print(f\"  Round {m['round']}.{m['position']}:  {rn:<28}  vs  {bn}\")
    print()
"

print "🎉 E2E-СЦЕНАРИЙ УСПЕШНО ЗАВЕРШЁН"
echo ""
echo "  📊 Prisma Studio:  http://localhost:5555 (таблица Match)"
echo "  🔌 API сетки:      GET http://localhost:4000/api/brackets/$BRACKET_ID"
echo ""
