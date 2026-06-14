#!/usr/bin/env bash
# Диагностика — проверяет что backend работает и что демо-аккаунты в БД
# Запуск: ./diagnose.sh

API="http://localhost:4000"
G='\033[0;32m'; R='\033[0;31m'; Y='\033[1;33m'; B='\033[1;34m'; N='\033[0m'

echo ""
echo -e "${B}══════════════════════════════════════════════════${N}"
echo -e "${B}  Judo-Arena — Диагностика логина${N}"
echo -e "${B}══════════════════════════════════════════════════${N}"
echo ""

# 1. Backend жив?
echo -e "${B}1.${N} Бэкенд запущен и БД подключена?"
HEALTH=$(curl -s -m 3 "$API/health" 2>&1)
if [[ "$HEALTH" == *"connected"* ]]; then
  echo -e "${G}   ✓ Бэк жив, БД подключена${N}"
else
  echo -e "${R}   ✗ Бэк не отвечает или БД не работает${N}"
  echo "   Ответ: $HEALTH"
  echo ""
  echo -e "${Y}   ▶ Запусти бэк: cd api && npm run dev${N}"
  echo -e "${Y}   ▶ И Docker: docker compose up -d${N}"
  exit 1
fi

# 2. Пробуем демо-логин ADMIN
echo ""
echo -e "${B}2.${N} Демо-логин ADMIN (admin@judo-arena.kz / password123)..."
ADMIN_RESP=$(curl -s -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@judo-arena.kz","password":"password123"}')
if echo "$ADMIN_RESP" | grep -q "accessToken"; then
  echo -e "${G}   ✓ Админ логинится${N}"
else
  echo -e "${R}   ✗ НЕ логинится${N}"
  echo "   Ответ: $ADMIN_RESP"
  echo ""
  echo -e "${Y}   Похоже что seed не отработал. Запусти:${N}"
  echo -e "${Y}   cd api && npx prisma db seed${N}"
  echo ""
fi

# 3. Демо-логин COACH
echo -e "${B}3.${N} Демо-логин COACH (coach.almaty@judo-arena.kz / password123)..."
COACH_RESP=$(curl -s -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"coach.almaty@judo-arena.kz","password":"password123"}')
if echo "$COACH_RESP" | grep -q "accessToken"; then
  echo -e "${G}   ✓ Тренер логинится${N}"
else
  echo -e "${R}   ✗ Тренер НЕ логинится${N}"
  echo "   Ответ: $COACH_RESP"
fi

# 4. Демо-логин ATHLETE
echo -e "${B}4.${N} Демо-логин ATHLETE (m0-0@almaty-judo.judo-arena.kz / password123)..."
ATH_RESP=$(curl -s -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"m0-0@almaty-judo.judo-arena.kz","password":"password123"}')
if echo "$ATH_RESP" | grep -q "accessToken"; then
  echo -e "${G}   ✓ Спортсмен логинится${N}"
else
  echo -e "${R}   ✗ Спортсмен НЕ логинится${N}"
  echo "   Ответ: $ATH_RESP"
fi

# 5. CORS — проверка
echo ""
echo -e "${B}5.${N} Проверка CORS (любой localhost разрешён)..."
CORS=$(curl -s -I -X OPTIONS "$API/api/auth/login" \
  -H "Origin: http://localhost:8080" \
  -H "Access-Control-Request-Method: POST" 2>&1)
if echo "$CORS" | grep -qi "access-control-allow-origin"; then
  echo -e "${G}   ✓ CORS работает${N}"
else
  echo -e "${Y}   ⚠ Не видно CORS-заголовков (возможно бэк не пересобрался)${N}"
  echo -e "${Y}   ▶ Перезапусти бэк: Ctrl+C, потом npm run dev в папке api${N}"
fi

echo ""
echo -e "${B}══════════════════════════════════════════════════${N}"
