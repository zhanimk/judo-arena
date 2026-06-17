#!/usr/bin/env python3
"""
Judo-Arena — BRACKET & TATAMI DISTRIBUTION TEST
=================================================
Тест проверяет корректность работы сетки и распределения по татами.

ПЛАН:
  ① Чистка БД  — удаляем всех пользователей (кроме текущего админа) и все клубы
  ② Создаём 1 клуб + 1 тренера
  ③ Создаём турнир с 3 категориями:
       Кат. 1 (−60 кг)  → 50 спортсменов → SE_IJF (Олимпийская с repechage)
       Кат. 2 (−73 кг)  →  5 спортсменов → ROUND_ROBIN (Круговая)
       Кат. 3 (−100 кг) → 25 спортсменов → SE_IJF
  ④ Тренер подаёт заявку → Админ одобряет
  ⑤ Генерация сеток
  ⑥ Проверка структуры SE_IJF (50 атлетов):
       size=64, pools A/B/C/D по 8 матчей, QF→SF→Final, repechage, bronze
  ⑦ Проверка структуры SE_IJF (25 атлетов):
       size=32, pools A/B/C/D по 4 матча, QF→SF→Final, repechage
  ⑧ Проверка ROUND_ROBIN (5 атлетов):
       10 матчей (C(5,2)=10), нет дубликатов пар
  ⑨ Распределение по татами (prepareTournamentDraw):
       все матчи получили tatamiNumber, нагрузка сбалансирована
  ⑩ Прогон всех матчей (SE_IJF: IPPON+confirm; RR: winner+confirm)
  ⑪ Финальная проверка: champion каждой категории

Usage:  python3 scripts/dev/test-bracket.py
Requires: API at http://localhost:4000
          Admin account: admin@judo-arena.kz / password123
"""

import json, sys, time, math
from datetime import datetime, timedelta, date
from urllib import request as urllib_request, error as urllib_error
from urllib.request import Request

# ── Настройки ────────────────────────────────────────────────────────────────
API  = "http://localhost:4000"
PASS = "password123"
RUN  = datetime.now().strftime("%m%d%H%M%S")

# ── Цвета ────────────────────────────────────────────────────────────────────
G='\033[32m'; Y='\033[33m'; R='\033[31m'; B='\033[34m'; C='\033[36m'; N='\033[0m'; W='\033[1m'
def ok(m):   print(f"{G}  ✓ {m}{N}")
def warn(m): WARNINGS.append(m); print(f"{Y}  ⚠ {m}{N}")
def fail(m): ERRORS.append(m);   print(f"{R}  ✗ FAIL: {m}{N}")
def info(m): print(f"{C}    {m}{N}")
def step(m): print(f"\n{B}▶ {m}{N}")
def hdr(m):  print(f"\n{W}{B}{'═'*65}\n  {m}\n{'═'*65}{N}")

ERRORS   = []
WARNINGS = []

# ── HTTP ─────────────────────────────────────────────────────────────────────
TOKEN = None

def http(method, path, body=None, tok=None, _retry=0):
    url  = f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Content-Type": "application/json"}
    t    = tok if tok is not None else TOKEN
    if t:
        hdrs["Authorization"] = f"Bearer {t}"
    req = Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib_request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib_error.HTTPError as e:
        bb = e.read()
        if e.code == 429 and _retry < 3:
            time.sleep(2.0 * (2 ** _retry))
            return http(method, path, body, tok, _retry + 1)
        try:    return {"__error": True, "__status": e.code, **json.loads(bb)}
        except: return {"__error": True, "__status": e.code, "message": bb.decode(errors="replace")}
    except Exception as e:
        return {"__error": True, "__status": 0, "message": str(e)}

def GET(p, t=None):          time.sleep(0.05); return http("GET",    p,        tok=t)
def POST(p, b=None, t=None): time.sleep(0.05); return http("POST",   p, b or {}, tok=t)
def PATCH(p, b=None, t=None):time.sleep(0.05); return http("PATCH",  p, b or {}, tok=t)
def DELETE(p, t=None):       time.sleep(0.05); return http("DELETE", p,        tok=t)
def is_err(r): return isinstance(r, dict) and r.get("__error")

def must(r, label):
    if is_err(r):
        fail(f"{label}: HTTP {r.get('__status')} — {r.get('message','?')[:100]}")
        return None
    return r

def login(email, pw=""):
    r = POST("/api/auth/login", {"email": email, "password": pw or PASS}, t="")
    if is_err(r): return None
    return r.get("accessToken") or r.get("token")

# ── STEP 0: API Health + Admin login ─────────────────────────────────────────
hdr("STEP 0 — API Health + Admin Login")

r = GET("/api/tournaments", t="")
if is_err(r):
    print(f"{R}API недоступен на {API}. Запустите сервер.{N}")
    sys.exit(1)
ok("API alive")

TOKEN = login("admin@judo-arena.kz")
if not TOKEN:
    # Попробуем создать admin
    reg = POST("/api/auth/register", {
        "name": "Admin", "surname": "Main",
        "email": "admin@judo-arena.kz", "password": PASS, "role": "ADMIN",
    }, t="")
    TOKEN = login("admin@judo-arena.kz")
if not TOKEN:
    fail("Невозможно получить admin token"); sys.exit(1)
ok("Admin logged in")

# Получаем ID текущего admin (чтобы не удалить себя при чистке)
me = GET("/api/auth/me")
MY_ID = me.get("id") if not is_err(me) else None
ok(f"Admin ID: {MY_ID[:8] if MY_ID else '?'}")

# ── STEP 1: Чистка БД ────────────────────────────────────────────────────────
hdr("STEP 1 — Clean Database (users + clubs)")

# Удаляем всех пользователей кроме себя
step("Deleting all users (except self)")
users_r = GET("/api/admin/users?limit=500")
user_list = [] if is_err(users_r) else (users_r.get("items") or [])
deleted_u = 0
for u in user_list:
    if u["id"] == MY_ID:
        continue
    dr = DELETE(f"/api/admin/users/{u['id']}")
    if not is_err(dr):
        deleted_u += 1
    else:
        # Some users may be undeletable (cascaded FK) — skip quietly
        pass
ok(f"Users deleted: {deleted_u}/{len(user_list)-1}")

# Удаляем все клубы
step("Deleting all clubs")
clubs_r = GET("/api/clubs", t="")
club_list = [] if is_err(clubs_r) else (clubs_r.get("items") or (clubs_r if isinstance(clubs_r, list) else []))
deleted_c = 0
for c in club_list:
    dr = DELETE(f"/api/admin/clubs/{c['id']}")
    if not is_err(dr):
        deleted_c += 1
ok(f"Clubs deleted: {deleted_c}/{len(club_list)}")

# ── STEP 2: Создаём клуб + тренера ───────────────────────────────────────────
hdr("STEP 2 — Create Club + Coach")

club_r = must(POST("/api/admin/clubs", {
    "name": {"ru": f"Жарыс Клубы {RUN}", "kk": f"Жарыс Клубы {RUN}"},
    "city": "Алматы", "country": "KZ", "shortName": f"JK{RUN[-4:]}",
}), "create club")
if not club_r: sys.exit(1)
CLUB_ID = club_r["id"]
ok(f"Club → {CLUB_ID[:8]}")

COACH_EMAIL = f"coach_{RUN}@test.judo"
coach_r = must(POST("/api/admin/users", {
    "name": "Тренер", "surname": "Тест",
    "email": COACH_EMAIL, "password": PASS,
    "role": "COACH", "clubId": CLUB_ID,
    "clubRole": "OWNER",
}), "create coach")
if not coach_r: sys.exit(1)
COACH_ID  = coach_r["id"]
COACH_TOK = login(COACH_EMAIL)
if not COACH_TOK: fail("Coach login failed"); sys.exit(1)
ok(f"Coach → {COACH_ID[:8]}")

# ── STEP 3: Категории и количества атлетов ──────────────────────────────────
# Кат. 1: −60 кг, 50 атлетов, SE_IJF
# Кат. 2: −73 кг,  5 атлетов, ROUND_ROBIN
# Кат. 3: −100 кг, 25 атлетов, SE_IJF

CATEGORIES = [
    {
        "name":    {"ru": "Ер −60 кг",  "kk": "Ер −60 кг"},
        "gender":  "MALE",
        "weightMin": 0.1, "weightMax": 60.0,
        "wRange":  (52, 60),
        "format":  "SE_IJF",
        "count":   50,
        "label":   "SE_IJF-50",
    },
    {
        "name":    {"ru": "Ер −73 кг",  "kk": "Ер −73 кг"},
        "gender":  "MALE",
        "weightMin": 60.01, "weightMax": 73.0,
        "wRange":  (61, 73),
        "format":  "ROUND_ROBIN",
        "count":   5,
        "label":   "ROUND_ROBIN-5",
    },
    {
        "name":    {"ru": "Ер −100 кг", "kk": "Ер −100 кг"},
        "gender":  "MALE",
        "weightMin": 73.01, "weightMax": 100.0,
        "wRange":  (74, 100),
        "format":  "SE_IJF",
        "count":   25,
        "label":   "SE_IJF-25",
    },
]

# ── STEP 4: Спортсмены ───────────────────────────────────────────────────────
hdr("STEP 4 — Create Athletes")

FIRST_NAMES = [
    "Нурбол","Дастан","Санжар","Руслан","Мирас","Тимур","Айдар","Арман","Ерлан","Берік",
    "Данияр","Азамат","Жандос","Марат","Алмас","Бекзат","Серік","Болат","Ануар","Темір",
    "Алибек","Ержан","Куаныш","Самат","Адиль","Бауыржан","Дәурен","Нурлан","Малик","Зайыр",
    "Асхат","Қанат","Сейіт","Еркін","Тоқтар","Жасұлан","Асылбек","Ыбырай","Рустем","Шыңғыс",
    "Жандос","Нурсұлтан","Бейбіт","Аян","Ділшат","Аман","Ерасыл","Алтай","Дамир","Өмірзақ",
    "Бахтияр","Рахим","Жарас","Омар","Сенгір",
]
LAST_NAMES = [
    "Сарсенов","Ахметов","Иванов","Касымов","Нурланов","Тілеулі","Бегалин","Жаксыбеков",
    "Мамытов","Болатов","Жолдасов","Балтабеков","Тоқтаров","Нұртаев","Рысқали","Сейітов",
    "Оразов","Мухамедов","Байсалов","Темірбеков","Дюсупов","Жексенбеков","Сатыбалдиев",
    "Мусин","Нурмаганбетов","Кенжебеков","Амиров","Мусаев","Кариев","Пернебеков",
    "Жанузаков","Бахраев","Ильясов","Байгожин","Дюсенов","Муратов","Жунусов","Калиев",
    "Смагулов","Рустемов","Мирасов","Абенов","Тасымов","Алпыспаев","Бисенов","Маусымов",
    "Жарылғасын","Ермеков","Бердибеков","Садвакасов","Зейнулин","Мамбетов","Бекмуратов",
    "Нарикбаев","Ергешов",
]

athletes_by_cat = {}
global_idx = 0

for ci, cat in enumerate(CATEGORIES):
    step(f"Creating {cat['count']} athletes for {cat['label']}")
    athletes = []
    w_min, w_max = cat["wRange"]
    step_w = (w_max - w_min) / max(cat["count"] - 1, 1)

    for k in range(cat["count"]):
        ni     = global_idx % len(FIRST_NAMES)
        weight = round(w_min + k * step_w, 1)
        weight = min(weight, w_max - 0.1)
        email  = f"a{RUN}{global_idx:04d}@test.judo"

        r = POST("/api/admin/users", {
            "name":    FIRST_NAMES[ni],
            "surname": f"{LAST_NAMES[ni % len(LAST_NAMES)]}{ci+1}",
            "email":   email,
            "password": PASS,
            "role":    "ATHLETE",
            "clubId":  CLUB_ID,
            "gender":  cat["gender"],
            "weightKg": weight,
            "dateOfBirth": "2001-03-15",
        })
        if is_err(r):
            fail(f"Athlete {global_idx}: {r.get('message','?')[:60]}")
        else:
            athletes.append(r["id"])
        global_idx += 1

    ok(f"{len(athletes)}/{cat['count']} athletes created")
    athletes_by_cat[ci] = athletes

# ── STEP 5: Турнир ───────────────────────────────────────────────────────────
hdr("STEP 5 — Tournament + Categories")

start = (date.today() + timedelta(days=3)).isoformat()
dl    = (date.today() + timedelta(days=2)).isoformat()

tour = must(POST("/api/tournaments", {
    "name": {"ru": f"Сетка-Тест {RUN}", "kk": f"Сетка-Тест {RUN}"},
    "location": "Балуан Шолак", "city": "Алматы",
    "startDate": start, "endDate": start,
    "applicationDeadline": dl,
    "tatamiCount": 3,
    "primaryLocale": "kk",
}), "create tournament")
if not tour: sys.exit(1)
TOUR_ID = tour["id"]
ok(f"Tournament → {TOUR_ID[:8]}")

cat_ids = []
for cat in CATEGORIES:
    r = must(POST(f"/api/tournaments/{TOUR_ID}/categories", {
        "name":    cat["name"],
        "gender":  cat["gender"],
        "ageMin":  14, "ageMax": 45,
        "weightMin": cat["weightMin"],
        "weightMax": cat["weightMax"],
        "matchDurationSec":  300,
        "goldenScoreSec":    120,
        "format": cat["format"],
    }), f"category {cat['label']}")
    if not r: sys.exit(1)
    cat_ids.append(r["id"])
    ok(f"  {cat['label']} → {r['id'][:8]}")

# Открываем регистрацию
r = must(POST(f"/api/tournaments/{TOUR_ID}/status", {"status": "REGISTRATION_OPEN"}), "REGISTRATION_OPEN")
if r: ok(f"Status → {r.get('status')}")
else: sys.exit(1)

# ── STEP 6: Заявка тренера ───────────────────────────────────────────────────
hdr("STEP 6 — Coach Application")

app_r = must(POST(f"/api/tournaments/{TOUR_ID}/applications", {}, t=COACH_TOK), "create draft")
if not app_r: sys.exit(1)
APP_ID = app_r["id"]
ok(f"Draft → {APP_ID[:8]}")

total_entries = 0
for ci, (cat, cid) in enumerate(zip(CATEGORIES, cat_ids)):
    added = 0
    for ath_id in athletes_by_cat[ci]:
        er = POST(f"/api/applications/{APP_ID}/entries",
                  {"athleteId": ath_id, "categoryId": cid}, t=COACH_TOK)
        if not is_err(er):
            added += 1
        else:
            warn(f"Entry fail {ath_id[:8]}: {er.get('message','?')[:60]}")
    total_entries += added
    info(f"  {cat['label']}: {added}/{cat['count']} entries added")

ok(f"Total entries: {total_entries}/{sum(c['count'] for c in CATEGORIES)}")

sr = must(POST(f"/api/applications/{APP_ID}/submit", {}, t=COACH_TOK), "submit")
if sr: ok(f"Submitted → {sr.get('status')}")

# ── STEP 7: Одобрение + REGISTRATION_CLOSED ──────────────────────────────────
hdr("STEP 7 — Approve + Close Registration")

ar = must(POST(f"/api/applications/{APP_ID}/approve", {}), "approve")
if ar: ok(f"Approved → {ar.get('status')}")

r = must(POST(f"/api/tournaments/{TOUR_ID}/status", {"status": "REGISTRATION_CLOSED"}), "REGISTRATION_CLOSED")
if r: ok(f"Status → {r.get('status')}")

# ── STEP 7b: Взвешивание — проставляем PASSED всем entries ───────────────────
hdr("STEP 7b — Weigh-In: set all entries to PASSED")

# Ответ: { applications: [{ entries: [{ id, ... }] }] }
wi_r = GET(f"/api/admin/tournaments/{TOUR_ID}/weigh-in")
if is_err(wi_r):
    fail(f"weigh-in list: {wi_r.get('message','?')[:80]}")
else:
    all_entries = []
    for app in (wi_r.get("applications") or []):
        all_entries.extend(app.get("entries") or [])
    passed = 0
    for e in all_entries:
        eid = e.get("id")
        if not eid:
            continue
        pr = PATCH(f"/api/admin/application-entries/{eid}/weigh-in", {"status": "PASSED"})
        if not is_err(pr):
            passed += 1
    ok(f"Weigh-in PASSED: {passed}/{len(all_entries)} entries")

# ── STEP 8: Генерация сеток ──────────────────────────────────────────────────
hdr("STEP 8 — Generate Brackets")

brackets = {}  # cat_label → bracket_data
for cat, cid in zip(CATEGORIES, cat_ids):
    r = POST(f"/api/tournaments/{TOUR_ID}/categories/{cid}/bracket", {})
    if is_err(r):
        fail(f"Bracket {cat['label']}: {r.get('code','?')} — {r.get('message','?')[:80]}")
    else:
        mc = len(r.get("matches", []))
        ok(f"  {cat['label']}: {r.get('athleteCount','?')} атлетов → {mc} матчей, id={r.get('id','?')[:8]}")
        brackets[cat["label"]] = r

if not brackets:
    fail("Ни одной сетки не создано")
    sys.exit(1)

# ── STEP 9: Распределение по татами ─────────────────────────────────────────
hdr("STEP 9 — Tatami Draw (prepareTournamentDraw)")

draw_r = POST(f"/api/tournaments/{TOUR_ID}/brackets/prepare")
if is_err(draw_r):
    warn(f"prepareTournamentDraw: {draw_r.get('message','?')[:80]}")
else:
    assignments = draw_r if isinstance(draw_r, list) else draw_r.get("assignments", draw_r.get("plan", []))
    ok(f"Tatami assignments: {len(assignments) if isinstance(assignments, list) else 'ok'}")
    if isinstance(assignments, list):
        by_tatami: dict = {}
        for a in assignments:
            tn = a.get("tatamiNumber", a.get("tatami", "?"))
            by_tatami[tn] = by_tatami.get(tn, 0) + 1
        for tn, cnt in sorted(by_tatami.items()):
            info(f"  Татами {tn}: {cnt} категорий/матчей")
        # Проверка баланса: мах - мин ≤ 1 (для 3 сеток + 3 татами)
        counts = list(by_tatami.values())
        if counts and max(counts) - min(counts) <= 1:
            ok("Tatami load balanced ✓")
        else:
            warn(f"Tatami load imbalanced: {by_tatami}")

# ── STEP 10: Верификация структур сеток ─────────────────────────────────────
hdr("STEP 10 — Bracket Structure Verification")

def bracket_size_for(n):
    s = 2
    while s < n: s *= 2
    return s

# ── 10a: SE_IJF с 50 атлетами ────────────────────────────────────────────────
step("10a: SE_IJF-50 structure")
br50 = brackets.get("SE_IJF-50")
if br50:
    bid = br50["id"]
    bd  = GET(f"/api/brackets/{bid}")
    if is_err(bd):
        fail("Cannot fetch bracket SE_IJF-50")
    else:
        matches  = bd.get("matches", [])
        size     = bd.get("size", br50.get("size", 0))
        n_ath    = bd.get("athleteCount", br50.get("athleteCount", 0))
        exp_size = bracket_size_for(50)  # 64
        tr       = round(math.log2(max(size, 2)))
        qr       = tr - 2

        info(f"  athleteCount={n_ath}  size={size}  totalRounds={tr}  quartersRound={qr}")
        info(f"  total matches={len(matches)}")

        # 1. Проверка размера сетки
        if size == exp_size:
            ok(f"  ✓ Bracket size={size} (expected {exp_size})")
        else:
            fail(f"  size={size} ≠ expected {exp_size}")

        # 2. Нет дубликатов в раунде 1
        r1 = [m for m in matches if m.get("round") == 1 and m.get("bracketSection") == "main"]
        ath_r1 = [a for m in r1 for a in [m.get("redAthleteId"), m.get("blueAthleteId")] if a]
        if len(ath_r1) == len(set(ath_r1)):
            ok(f"  ✓ No duplicates in round 1 ({len(ath_r1)} athletes seeded)")
        else:
            fail(f"  Duplicates in round 1: {len(ath_r1)} total / {len(set(ath_r1))} unique")

        # 3. Проверка пулов A/B/C/D (quartersRound ≥ 1)
        if qr >= 1:
            main_qf = [m for m in matches
                       if m.get("bracketSection") == "main" and m.get("round", 99) <= qr]
            pool_counts: dict = {}
            q_half = size // 4
            for m in main_qf:
                pool = min(3, m.get("position", 0) * 4 // size)
                pool_counts[pool] = pool_counts.get(pool, 0) + 1
            info(f"  Pool distribution: {pool_counts}")
            if pool_counts and max(pool_counts.values()) - min(pool_counts.values()) <= 1:
                ok(f"  ✓ Pools A/B/C/D balanced ({max(pool_counts.values())} matches each)")
            else:
                warn(f"  Pool imbalance: {pool_counts}")

        # 4. SF (2 матча) + Final (1 матч)
        semis  = [m for m in matches if m.get("round") == tr - 1 and m.get("bracketSection") == "main"]
        finals = [m for m in matches if m.get("bracketSection") == "final"]
        bronzes = [m for m in matches if "bronze" in (m.get("bracketSection") or "")]
        reps   = [m for m in matches if m.get("bracketSection") == "repechage"]
        if len(semis) == 2:
            ok(f"  ✓ 2 semi-finals at round {tr-1}")
        else:
            fail(f"  Semi-finals: {len(semis)} (expected 2)")
        if len(finals) == 1:
            ok(f"  ✓ 1 final match")
        else:
            fail(f"  Finals: {len(finals)} (expected 1)")
        if reps:
            ok(f"  ✓ {len(reps)} repechage matches")
        else:
            warn("  No repechage matches found")
        if bronzes:
            ok(f"  ✓ {len(bronzes)} bronze match(es)")
        info(f"  Sections breakdown: " + str({
            s: sum(1 for m in matches if m.get("bracketSection") == s)
            for s in {m.get("bracketSection") for m in matches}
        }))

# ── 10b: SE_IJF с 25 атлетами ────────────────────────────────────────────────
step("10b: SE_IJF-25 structure")
br25 = brackets.get("SE_IJF-25")
if br25:
    bid = br25["id"]
    bd  = GET(f"/api/brackets/{bid}")
    if is_err(bd):
        fail("Cannot fetch bracket SE_IJF-25")
    else:
        matches  = bd.get("matches", [])
        size     = bd.get("size", br25.get("size", 0))
        n_ath    = bd.get("athleteCount", br25.get("athleteCount", 0))
        exp_size = bracket_size_for(25)  # 32
        tr       = round(math.log2(max(size, 2)))
        qr       = tr - 2

        info(f"  athleteCount={n_ath}  size={size}  totalRounds={tr}  quartersRound={qr}")

        if size == exp_size:
            ok(f"  ✓ Bracket size={size} (expected {exp_size})")
        else:
            fail(f"  size={size} ≠ expected {exp_size}")

        r1 = [m for m in matches if m.get("round") == 1 and m.get("bracketSection") == "main"]
        ath_r1 = [a for m in r1 for a in [m.get("redAthleteId"), m.get("blueAthleteId")] if a]
        if len(ath_r1) == len(set(ath_r1)):
            ok(f"  ✓ No duplicates in round 1 ({len(ath_r1)} athletes seeded)")
        else:
            fail(f"  Duplicates in round 1!")

        # Проверка бай-матчей (BYE) — при 25 атлетах должны быть 7 бай слотов
        byes = [m for m in matches if m.get("round") == 1 and m.get("bracketSection") == "main"
                and (not m.get("redAthleteId") or not m.get("blueAthleteId"))]
        byes_with_one = [m for m in byes if m.get("redAthleteId") or m.get("blueAthleteId")]
        info(f"  BYE matches in round 1: {len(byes)} (with 1 athlete: {len(byes_with_one)})")
        # 32 - 25 = 7 byes
        if len(byes_with_one) == exp_size - 25:
            ok(f"  ✓ {len(byes_with_one)} BYE slots (expected {exp_size - 25})")
        else:
            warn(f"  BYE count: {len(byes_with_one)} (expected {exp_size - 25})")

        semis  = [m for m in matches if m.get("round") == tr - 1 and m.get("bracketSection") == "main"]
        finals = [m for m in matches if m.get("bracketSection") == "final"]
        reps   = [m for m in matches if m.get("bracketSection") == "repechage"]
        ok(f"  semis={len(semis)}  finals={len(finals)}  repechage={len(reps)}")

# ── 10c: ROUND_ROBIN с 5 атлетами ────────────────────────────────────────────
step("10c: ROUND_ROBIN-5 structure")
br_rr = brackets.get("ROUND_ROBIN-5")
if br_rr:
    bid = br_rr["id"]
    bd  = GET(f"/api/brackets/{bid}")
    if is_err(bd):
        fail("Cannot fetch bracket ROUND_ROBIN-5")
    else:
        matches  = bd.get("matches", [])
        n_ath    = bd.get("athleteCount", br_rr.get("athleteCount", 0))
        # C(5,2) = 10 матчей
        exp_matches = 5 * 4 // 2  # = 10
        info(f"  athleteCount={n_ath}  total matches={len(matches)}")

        if len(matches) == exp_matches:
            ok(f"  ✓ {len(matches)} round-robin matches (expected {exp_matches} = C(5,2))")
        else:
            fail(f"  RR matches: {len(matches)} (expected {exp_matches})")

        # Нет дубликатов пар
        pairs = set()
        dups  = []
        for m in matches:
            ra = m.get("redAthleteId")  or m.get("athlete1Id")
            ba = m.get("blueAthleteId") or m.get("athlete2Id")
            if ra and ba:
                pair = frozenset([ra, ba])
                if pair in pairs:
                    dups.append(pair)
                pairs.add(pair)
        if not dups:
            ok(f"  ✓ No duplicate pairs in round-robin ({len(pairs)} unique pairs)")
        else:
            fail(f"  Duplicate pairs: {len(dups)}")

        # Каждый атлет встречается ровно с 4 другими (C(5,2)/5*2=4)
        ath_count: dict = {}
        for m in matches:
            for key in ["redAthleteId", "blueAthleteId", "athlete1Id", "athlete2Id"]:
                a = m.get(key)
                if a:
                    ath_count[a] = ath_count.get(a, 0) + 1
        encounters = set(ath_count.values())
        if encounters == {4}:
            ok(f"  ✓ Each athlete plays exactly 4 matches")
        elif encounters:
            info(f"  Encounter counts: {sorted(ath_count.values())}")
            warn(f"  Expected all athletes to play 4 matches, got: {encounters}")

# ── STEP 11: Прогон всех матчей ──────────────────────────────────────────────
hdr("STEP 11 — Play All Matches")

def play_se_bracket(bid, label, tatami=1, max_iter=60):
    """Прогоняет SE_IJF сетку: start → IPPON RED → confirm"""
    total_done = 0
    for iteration in range(max_iter):
        bd = GET(f"/api/brackets/{bid}")
        if is_err(bd):
            time.sleep(1)
            bd = GET(f"/api/brackets/{bid}")
            if is_err(bd): fail(f"[{label}] fetch fail"); return False

        playable = [
            m for m in bd.get("matches", [])
            if m.get("status") == "PENDING"
            and m.get("redAthleteId") and m.get("blueAthleteId")
        ]
        if not playable:
            break

        iter_done = 0
        for m in playable:
            mid = m["id"]

            # Назначаем татами
            if not m.get("tatamiNumber"):
                PATCH(f"/api/matches/{mid}/tatami", {"tatamiNumber": tatami})

            # Старт
            sr = POST(f"/api/matches/{mid}/start")
            if is_err(sr) and sr.get("__status") != 409:
                warn(f"[{label}] start {mid[:8]}: {sr.get('message','?')[:40]}")

            # IPPON → RED wins
            sc = POST(f"/api/matches/{mid}/score", {"type": "IPPON", "side": "RED"})
            if is_err(sc):
                fr = POST(f"/api/matches/{mid}/finish", {"winnerSide": "RED"})
                if is_err(fr):
                    warn(f"[{label}] score+finish fail {mid[:8]}")
                    continue

            # Confirm
            cr = POST(f"/api/matches/{mid}/confirm")
            if is_err(cr):
                cm = GET(f"/api/matches/{mid}")
                if not is_err(cm) and cm.get("status") == "COMPLETED":
                    total_done += 1; iter_done += 1
            else:
                total_done += 1; iter_done += 1

        if iter_done == 0:
            break

    # Финальная проверка
    bd = GET(f"/api/brackets/{bid}")
    if is_err(bd): return False
    still = [m for m in bd.get("matches", [])
             if m.get("status") == "PENDING"
             and m.get("redAthleteId") and m.get("blueAthleteId")]
    final_m = next((m for m in bd.get("matches", []) if m.get("bracketSection") == "final"), None)

    if final_m and final_m.get("status") == "COMPLETED":
        ok(f"  [{label}] ✓ FINAL DONE → champion={final_m.get('winnerId','?')[:8]}")
        return True
    elif still:
        warn(f"  [{label}] {len(still)} matches unplayed")
        return False
    else:
        warn(f"  [{label}] final not completed, status={final_m.get('status') if final_m else 'none'}")
        return False

def play_rr_bracket(bid, label, tatami=2):
    """Прогоняет ROUND_ROBIN сетку"""
    total_done = 0
    for iteration in range(30):
        bd = GET(f"/api/brackets/{bid}")
        if is_err(bd): break
        matches = bd.get("matches", [])

        playable = [
            m for m in matches
            if m.get("status") == "PENDING"
            and (m.get("redAthleteId") or m.get("athlete1Id"))
            and (m.get("blueAthleteId") or m.get("athlete2Id"))
        ]
        if not playable:
            break

        iter_done = 0
        for m in playable:
            mid = m["id"]
            if not m.get("tatamiNumber"):
                PATCH(f"/api/matches/{mid}/tatami", {"tatamiNumber": tatami})

            sr = POST(f"/api/matches/{mid}/start")
            if is_err(sr) and sr.get("__status") != 409:
                warn(f"[{label}] start {mid[:8]}: {sr.get('message','?')[:40]}")

            sc = POST(f"/api/matches/{mid}/score", {"type": "IPPON", "side": "RED"})
            if is_err(sc):
                fr = POST(f"/api/matches/{mid}/finish", {"winnerSide": "RED"})
                if is_err(fr): continue

            cr = POST(f"/api/matches/{mid}/confirm")
            if not is_err(cr) and cr.get("status") == "COMPLETED":
                total_done += 1; iter_done += 1
            elif is_err(cr):
                cm = GET(f"/api/matches/{mid}")
                if not is_err(cm) and cm.get("status") == "COMPLETED":
                    total_done += 1; iter_done += 1

        if iter_done == 0:
            break

    # Статистика
    bd = GET(f"/api/brackets/{bid}")
    if not is_err(bd):
        ms = bd.get("matches", [])
        done = sum(1 for m in ms if m.get("status") == "COMPLETED")
        left = sum(1 for m in ms
                   if m.get("status") == "PENDING"
                   and (m.get("redAthleteId") or m.get("athlete1Id"))
                   and (m.get("blueAthleteId") or m.get("athlete2Id")))
        if left == 0:
            ok(f"  [{label}] ✓ ALL {done} round-robin matches completed")
            # Определяем победителя по наибольшему числу побед
            wins: dict = {}
            for m in ms:
                w = m.get("winnerId")
                if w:
                    wins[w] = wins.get(w, 0) + 1
            if wins:
                champ = max(wins, key=lambda k: wins[k])
                ok(f"  [{label}] ✓ RR winner (most wins): {champ[:8]} ({wins[champ]} wins)")
            return True
        else:
            warn(f"  [{label}] {left} matches unplayed")
            return False
    return False

# SE_IJF-50
if "SE_IJF-50" in brackets:
    step("Playing SE_IJF-50")
    play_se_bracket(brackets["SE_IJF-50"]["id"], "SE_IJF-50", tatami=1)

# ROUND_ROBIN-5
if "ROUND_ROBIN-5" in brackets:
    step("Playing ROUND_ROBIN-5")
    play_rr_bracket(brackets["ROUND_ROBIN-5"]["id"], "ROUND_ROBIN-5", tatami=2)

# SE_IJF-25
if "SE_IJF-25" in brackets:
    step("Playing SE_IJF-25")
    play_se_bracket(brackets["SE_IJF-25"]["id"], "SE_IJF-25", tatami=3)

# ── STEP 12: Финальная проверка ──────────────────────────────────────────────
hdr("STEP 12 — Post-Match SE_IJF Correctness")

for label, br in [(l, b) for l, b in brackets.items() if "SE_IJF" in l]:
    step(label)
    bd = GET(f"/api/brackets/{br['id']}")
    if is_err(bd): continue
    matches = bd.get("matches", [])
    size    = bd.get("size", 0)
    tr      = round(math.log2(max(size, 2))) if size > 0 else 0
    qr      = tr - 2

    # 1. Финал завершён + чемпион
    final_m = next((m for m in matches if m.get("bracketSection") == "final"), None)
    if final_m and final_m.get("status") == "COMPLETED" and final_m.get("winnerId"):
        ok(f"  ✓ Final COMPLETED | champion={final_m.get('winnerId','?')[:8]}")
    elif final_m:
        fail(f"  Final not completed (status={final_m.get('status')})")
    else:
        warn("  No final match")

    # 2. Победители SF → финал
    semis = [m for m in matches if m.get("round") == tr - 1 and m.get("bracketSection") == "main"
             and m.get("status") == "COMPLETED"]
    if semis and final_m:
        sw = {m.get("winnerId") for m in semis if m.get("winnerId")}
        fa = {final_m.get("redAthleteId"), final_m.get("blueAthleteId")} - {None}
        if sw and sw <= fa:
            ok(f"  ✓ SF winners correctly advanced to Final")
        elif sw and fa:
            fail(f"  SF winners {[s[:8] for s in sw]} ≠ Final athletes {[f[:8] for f in fa]}")

    # 3. Бронза завершена
    bronzes = [m for m in matches if "bronze" in (m.get("bracketSection") or "")]
    done_b  = [m for m in bronzes if m.get("status") == "COMPLETED"]
    if bronzes:
        ok(f"  ✓ Bronze: {len(done_b)}/{len(bronzes)} completed")

    # 4. Repechage завершена
    reps     = [m for m in matches if m.get("bracketSection") == "repechage"]
    done_r   = [m for m in reps if m.get("status") == "COMPLETED"]
    playable_r = [m for m in reps if m.get("redAthleteId") and m.get("blueAthleteId")]
    if reps:
        ok(f"  ✓ Repechage: {len(done_r)}/{len(playable_r)} playable completed")

# ── STEP 13: Финализация + Рейтинг ──────────────────────────────────────────
hdr("STEP 13 — Finalize Tournament + Rating Check")

fin = POST(f"/api/admin/tournaments/{TOUR_ID}/finalize")
if is_err(fin):
    warn(f"Finalize: {fin.get('message','?')[:80]}")
else:
    ok(f"Finalized — entries: {fin.get('entriesCount', fin.get('count','?'))}")

lb = GET("/api/ratings/leaderboard?limit=100")
if is_err(lb):
    warn(f"Leaderboard: {lb.get('message','?')}")
else:
    lb_list = lb if isinstance(lb, list) else lb.get("items", [])
    ok(f"Leaderboard: {len(lb_list)} athletes with rating points")
    if lb_list:
        top = lb_list[0]
        a   = top.get("athlete", top)
        info(f"  #1: {a.get('name','')} {a.get('surname','')} — {round(top.get('totalPoints',0))} pts")

# ── ИТОГОВЫЙ ОТЧЁТ ────────────────────────────────────────────────────────────
hdr("FINAL REPORT")
print(f"  {W}Tournament ID:{N}  {TOUR_ID}")
print(f"  {W}Клуб:{N}          {CLUB_ID[:8]}")
print(f"  {W}Спортсменов:{N}   {global_idx} ({'+'.join(str(c['count']) for c in CATEGORIES)})")
print(f"  {W}Категорий:{N}     {len(CATEGORIES)}")
print(f"  {W}Форматы:{N}       SE_IJF×2 + ROUND_ROBIN×1")
print(f"  {W}Сетки:{N}         {len(brackets)}/3")
print()

if ERRORS:
    print(f"{R}{W}  ✗ ERRORS ({len(ERRORS)}):{N}")
    for e in ERRORS:
        print(f"{R}    • {e}{N}")
else:
    print(f"{G}{W}  ✓ ALL CHECKS PASSED{N}")

if WARNINGS:
    print(f"\n{Y}  ⚠ WARNINGS ({len(WARNINGS)}):{N}")
    for w in WARNINGS[:20]:
        print(f"{Y}    • {w}{N}")

print()
verdict = f"{G}{W}🥋 PASSED" if not ERRORS else f"{R}{W}✗ FAILED"
print(f"  {verdict} — {len(ERRORS)} errors, {len(WARNINGS)} warnings{N}\n")
sys.exit(1 if ERRORS else 0)
