#!/usr/bin/env python3
"""
Judo-Arena — 500 ATHLETE SCALE TEST
=====================================
Создаёт: 10 клубов · 10 тренеров · 500 спортсменов · 1 турнир · 6 категорий
Тестирует: посев, сетку (SE_IJF), прогрессию раундов, табло, финал

Исправления vs old test:
  - После IPPON вызывается /confirm (иначе матч остаётся IN_PROGRESS и сетка не идёт)
  - Уникальные имена (суффикс клуба + номер)
  - 6 категорий, ~83 спортсмена в каждой
  - Проверка на дубликаты в сетке

Usage: python3 test-500.py
Requires: API running at localhost:4000
"""

import json, sys, time, random
from datetime import datetime, timedelta, date
from urllib import request as urllib_request, error as urllib_error
from urllib.request import Request

# Уникальный суффикс для emails — позволяет запускать тест несколько раз
RUN_TAG = datetime.now().strftime("%m%d%H%M")

API  = "http://localhost:4000"
PASS = "password123"

# ── Цвета ─────────────────────────────────────────────────────
G='\033[32m'; Y='\033[33m'; R='\033[31m'; B='\033[34m'; C='\033[36m'; N='\033[0m'; W='\033[1m'
def ok(m):   print(f"{G}  ✓ {m}{N}")
def warn(m): WARNINGS.append(m); print(f"{Y}  ⚠ {m}{N}")
def fail(m): ERRORS.append(m);   print(f"{R}  ✗ FAIL: {m}{N}")
def info(m): print(f"{C}    {m}{N}")
def step(m): print(f"\n{B}▶ {m}{N}")
def hdr(m):  print(f"\n{W}{B}{'═'*58}\n  {m}\n{'═'*58}{N}")

ERRORS   = []
WARNINGS = []

# ── HTTP ────────────────────────────────────────────────────────
TOKEN = None

def http(method, path, body=None, token=None):
    url  = f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Content-Type": "application/json"}
    if token or TOKEN:
        hdrs["Authorization"] = f"Bearer {token or TOKEN}"
    req = Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib_request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib_error.HTTPError as e:
        bb = e.read()
        try:    return {"__error": True, "__status": e.code, **json.loads(bb)}
        except: return {"__error": True, "__status": e.code, "message": bb.decode(errors="replace")}
    except Exception as e:
        return {"__error": True, "__status": 0, "message": str(e)}

def GET(p, tok=None):           return http("GET",   p, token=tok)
def POST(p, b=None, tok=None):  return http("POST",  p, b or {}, token=tok)
def PATCH(p, b=None, tok=None): return http("PATCH", p, b or {}, token=tok)
def is_err(r): return isinstance(r, dict) and r.get("__error")

def check(r, lbl):
    if is_err(r):
        fail(f"{lbl}: HTTP {r.get('__status')} — {r.get('message','?')}")
        return False
    return True

# ── Данные ─────────────────────────────────────────────────────
# 50 мужских имён и 50 женских — с запасом для 250+250 спортсменов
MALE_FIRST = [
    "Әлихан","Нұрбол","Дастан","Санжар","Руслан","Мирас","Тимур","Айдар",
    "Арман","Ерлан","Сейіт","Данияр","Бекзат","Нурдаулет","Алибек","Марат",
    "Жандос","Берік","Султан","Азамат","Ержан","Нұрлан","Болат","Жасұлан",
    "Асхат","Қанат","Алмас","Бауыржан","Дәурен","Серік","Ыбырай","Малик",
    "Ануар","Темір","Рустем","Нурлан","Самат","Адиль","Еркін","Тоқтар",
    "Зайырбек","Аман","Ділшат","Нурсұлтан","Аян","Бейбіт","Куаныш","Шыңғыс",
    "Ерасыл","Асылбек",
]
MALE_LAST = [
    "Сәрсенов","Қайратұлы","Нұрланов","Бекзатов","Олжасов","Ержанов","Алмасов",
    "Бахытов","Дүйсебеков","Мамытов","Болатов","Жаксыбеков","Жарылғасынов",
    "Тасымов","Жолдасов","Ахметов","Балтабеков","Тоқтаров","Нұртаев","Рысқалиев",
    "Сейітов","Оразов","Мұхамедов","Байсалов","Қасымов","Темірбеков","Абенов",
    "Дюсупов","Жексенбеков","Сатыбалдиев","Мусин","Нурмаганбетов","Кенжебеков",
    "Сейткалиев","Амиров","Мусаев","Кариев","Джаксыбеков","Пернебеков","Утебаев",
    "Жанузаков","Бахраев","Ильясов","Байгожин","Дюсенов","Муратов","Жунусов",
    "Сагындыков","Калиев","Смагулов",
]
FEMALE_FIRST = [
    "Айгерім","Жанна","Динара","Алия","Камила","Сабина","Меруерт","Назгүл",
    "Жұлдыз","Гүлназ","Томирис","Айсана","Ботагөз","Зарина","Арайлым","Медина",
    "Аружан","Зейнеп","Дильназ","Лейла","Гүлмира","Айнұр","Маржан","Бақытгүл",
    "Айдана","Перизат","Ұлбосын","Жазира","Нургүл","Гаухар","Ақерке","Анар",
    "Зухра","Малика","Сауле","Дана","Алтын","Асем","Бота","Гүлден",
    "Жамиля","Айжан","Күлән","Назым","Ажар","Гүлсім","Нәзір","Фариза",
    "Дарина","Аяулым",
]
FEMALE_LAST = [
    "Бекова","Серікқызы","Қанатқызы","Бағдат","Ержанқызы","Талғат","Айдарова",
    "Дәуренова","Нұрланова","Серікова","Батырова","Тілеуова","Сарсенова","Кенжеқызы",
    "Нәбиева","Ілияева","Шынтайова","Ахметова","Мұхтарова","Бекенова","Жанбосынова",
    "Абеуова","Қасымова","Темірбекова","Дюсупова","Жексенбекова","Сатыбалдиева",
    "Мусина","Нурмаганбетова","Кенжебекова","Сейткалиева","Амирова","Мусаева",
    "Кариева","Джаксыбекова","Байсалова","Оразова","Мұхамедова","Тасымова","Жолдасова",
    "Балтабекова","Тоқтарова","Нұртаева","Рысқалиева","Сейітова","Дюсенова","Муратова",
    "Жунусова","Калиева","Смагулова",
]

CITIES = ["Алматы","Астана","Қарағанды","Шымкент","Атырау","Павлодар","Тараз","Өскемен","Ақтау","Орал"]

def rand_dob(age_min=18, age_max=33):
    age = random.randint(age_min, age_max)
    y   = date.today().year - age
    m   = random.randint(1, 12)
    d   = random.randint(1, 28)
    return f"{y}-{m:02d}-{d:02d}"

# ── 6 КАТЕГОРИЙ ────────────────────────────────────────────────
# 3 мужских + 3 женских, каждая ~80–90 человек
# wRange: (min_kg, max_kg) для генерации веса
SIX_CATS = [
    {"name":{"ru":"Мужчины −73 кг","kk":"Ер −73 кг"},  "gender":"MALE",
     "weightMin":0.01, "weightMax":73.0,  "wRange":(60,73), "perClub":8},
    {"name":{"ru":"Мужчины −90 кг","kk":"Ер −90 кг"},  "gender":"MALE",
     "weightMin":73.01,"weightMax":90.0,  "wRange":(74,90), "perClub":9},
    {"name":{"ru":"Мужчины +90 кг","kk":"Ер +90 кг"},  "gender":"MALE",
     "weightMin":90.01,"weightMax":200.0, "wRange":(91,130),"perClub":8},
    {"name":{"ru":"Женщины −57 кг","kk":"Әйел −57 кг"},"gender":"FEMALE",
     "weightMin":0.01, "weightMax":57.0,  "wRange":(48,57), "perClub":8},
    {"name":{"ru":"Женщины −70 кг","kk":"Әйел −70 кг"},"gender":"FEMALE",
     "weightMin":57.01,"weightMax":70.0,  "wRange":(58,70), "perClub":9},
    {"name":{"ru":"Женщины +70 кг","kk":"Әйел +70 кг"},"gender":"FEMALE",
     "weightMin":70.01,"weightMax":200.0, "wRange":(71,110),"perClub":8},
]
# total per club = 8+9+8 + 8+9+8 = 50 → 10×50 = 500

# ── STEP 0: Проверка API ────────────────────────────────────────
hdr("STEP 0 — API Health")
r = GET("/api/tournaments")
if is_err(r):
    fail("API не отвечает на http://localhost:4000 — запусти сервер"); sys.exit(1)
ok(f"API alive")

# ── STEP 1: Admin login ─────────────────────────────────────────
hdr("STEP 1 — Admin Login")
lr = POST("/api/auth/login", {"email":"admin@judo-arena.kz","password":PASS})
if is_err(lr) or not lr.get("accessToken"):
    fail(f"Admin login: {lr}"); sys.exit(1)
TOKEN = lr["accessToken"]
ok("Admin logged in")

# ── STEP 2: 10 клубов ──────────────────────────────────────────
hdr("STEP 2 — Create 10 Clubs")
clubs = []
for i, city in enumerate(CITIES):
    r = POST("/api/admin/clubs", {
        "name":{"ru":f"Клуб {city}","kk":f"{city} клубы"},
        "city":city,"country":"KZ","shortName":f"C{i+1:02d}"
    })
    if is_err(r): fail(f"Club {city}: {r.get('message')}"); continue
    clubs.append(r); ok(f"Club: {city} id={r['id']}")
if len(clubs) < 10: fail("Не все клубы созданы"); sys.exit(1)

# ── STEP 3: 10 тренеров ────────────────────────────────────────
hdr("STEP 3 — Create Coaches")
coaches = []
for i, club in enumerate(clubs):
    email = f"coach500.{RUN_TAG}.{i+1}@test.judo-arena.kz"
    r = POST("/api/admin/users", {
        "email":email,"password":PASS,"role":"COACH",
        "name":"Тренер","surname":f"Тест{i+1}",
        "nameLatin":"Coach","surnameLatin":f"Test{i+1}",
        "clubId":club["id"]
    })
    if is_err(r): fail(f"Coach {club['city']}: {r.get('message')}"); continue
    coaches.append({"user":r,"club":club,"email":email})
    ok(f"Coach for {club['city']}")
ok(f"Total coaches: {len(coaches)}")

# ── STEP 4: 500 спортсменов (50 на клуб) ──────────────────────
hdr("STEP 4 — Create 500 Athletes (50 per club)")
athletes_by_club = {}  # clubId → [{id, catIdx}]
total_athletes   = 0
global_idx       = 0  # глобальный счётчик для уникальных имён

for ci, club in enumerate(clubs):
    club_a = []
    for cat_i, cat in enumerate(SIX_CATS):
        cnt = cat["perClub"]  # 8 или 9
        is_male = cat["gender"] == "MALE"
        for k in range(cnt):
            # Уникальное имя: first_names[idx%50] + last_names[idx%50]
            ni = global_idx
            if is_male:
                fname = MALE_FIRST[ni % len(MALE_FIRST)]
                lname = MALE_LAST[ni  % len(MALE_LAST)]
                gender = "MALE"
            else:
                fname = FEMALE_FIRST[ni % len(FEMALE_FIRST)]
                lname = FEMALE_LAST[ni  % len(FEMALE_LAST)]
                gender = "FEMALE"
            # Суффикс клуба делает фамилию уникальной в рамках сетки
            unique_lname = f"{lname}-{CITIES[ci][:3].upper()}"
            w_min, w_max = cat["wRange"]
            weight = round(random.uniform(w_min, w_max - 0.5), 1)
            email = f"a{RUN_TAG}{global_idx:05d}@test.judo-arena.kz"

            r = POST("/api/admin/users", {
                "email":email,"password":PASS,"role":"ATHLETE",
                "name":fname,"surname":unique_lname,
                "nameLatin":fname[:6],"surnameLatin":f"Ath{global_idx:05d}",
                "gender":gender,"dateOfBirth":rand_dob(),
                "weightKg":weight,"clubId":club["id"]
            })
            if is_err(r):
                fail(f"Athlete a{global_idx}: {r.get('message')}")
            else:
                club_a.append({"id":r["id"],"catIdx":cat_i})
                total_athletes += 1
            global_idx += 1

    athletes_by_club[club["id"]] = club_a
    info(f"Club {club['city']}: {len(club_a)} athletes")

ok(f"Total athletes: {total_athletes}/500")
if total_athletes < 480:
    fail("Слишком много ошибок создания спортсменов"); sys.exit(1)

# ── STEP 5: Турнир + 6 категорий ──────────────────────────────
hdr("STEP 5 — Create Tournament + 6 Categories")
start = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%dT10:00:00.000Z")
end   = (datetime.now() + timedelta(days=8)).strftime("%Y-%m-%dT18:00:00.000Z")
dl    = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%dT23:59:59.000Z")

tourney = POST("/api/tournaments", {
    "name":{"ru":"Тест 500 спортсменов","kk":"500 спортшы тесті","en":"500 Athletes Test"},
    "description":{"ru":"Масштабный тест сеток"},
    "location":"Балуан Шолак","city":"Алматы",
    "startDate":start,"endDate":end,"applicationDeadline":dl,
    "tatamiCount":6,"primaryLocale":"kk"
})
if is_err(tourney): fail(f"Create tournament: {tourney.get('message')}"); sys.exit(1)
TOUR_ID = tourney["id"]
ok(f"Tournament created (DRAFT): {TOUR_ID}")

# Создаём категории пока статус DRAFT
cat_ids = []
for cat in SIX_CATS:
    r = POST(f"/api/tournaments/{TOUR_ID}/categories", {
        "name":cat["name"],"gender":cat["gender"],
        "ageMin":14,"ageMax":40,
        "weightMin":cat["weightMin"],"weightMax":cat["weightMax"],
        "matchDurationSec":240,"format":"SE_IJF"
    })
    if is_err(r): fail(f"Category {cat['name']['ru']}: {r.get('message')}"); cat_ids.append(None)
    else: cat_ids.append(r["id"]); ok(f"Category: {cat['name']['ru']} → {r['id']}")

valid_cat_ids = [c for c in cat_ids if c]
ok(f"Categories: {len(valid_cat_ids)}/6")

# Открываем регистрацию (DRAFT → REGISTRATION_OPEN)
or_ = POST(f"/api/tournaments/{TOUR_ID}/status", {"status":"REGISTRATION_OPEN"})
if is_err(or_): fail(f"Open registration: {or_.get('message','?')}")
else: ok(f"Registration opened: status={or_.get('status','?')}")

# ── STEP 6: Заявки от тренеров ──────────────────────────────────
hdr("STEP 6 — Coach Applications")
total_entries = 0
entry_errors  = 0

for i, coach_info in enumerate(coaches):
    club_id = coach_info["club"]["id"]
    cl = POST("/api/auth/login",{"email":coach_info["email"],"password":PASS})
    if is_err(cl) or not cl.get("accessToken"):
        fail(f"Coach login {coach_info['email']}"); continue
    CTOK = cl["accessToken"]

    app_r = POST(f"/api/tournaments/{TOUR_ID}/applications", tok=CTOK)
    if is_err(app_r): fail(f"Draft app club{i}: {app_r.get('message')}"); continue
    app_id = app_r["id"]

    added = 0
    for athl in athletes_by_club.get(club_id, []):
        cid = cat_ids[athl["catIdx"]] if athl["catIdx"] < len(cat_ids) else None
        if not cid: continue
        er = POST(f"/api/applications/{app_id}/entries",
                  {"athleteId":athl["id"],"categoryId":cid}, tok=CTOK)
        if is_err(er):
            entry_errors += 1
            if er.get("code") not in ("DUPLICATE_ENTRY","AGE_MISMATCH","WEIGHT_MISMATCH"):
                warn(f"Entry error: {er.get('code','?')} — {er.get('message','?')[:60]}")
        else:
            added += 1; total_entries += 1

    sr = POST(f"/api/applications/{app_id}/submit", tok=CTOK)
    if is_err(sr): fail(f"Submit app club{i}: {sr.get('message')}")
    else:          ok(f"Club {coach_info['club']['city']}: {added} entries submitted")

ok(f"Total entries: {total_entries} (errors: {entry_errors})")

# ── STEP 7: Утверждение заявок ─────────────────────────────────
hdr("STEP 7 — Approve Applications")
apps = GET(f"/api/tournaments/{TOUR_ID}/applications")
if is_err(apps): fail(f"List apps: {apps.get('message')}"); apps = []
apps_list = apps if isinstance(apps,list) else apps.get("items",apps.get("applications",[]))
approved = 0
for app in apps_list:
    aid = app["id"] if isinstance(app,dict) else app
    if isinstance(app,dict) and app.get("status") == "APPROVED":
        approved += 1; continue
    r = POST(f"/api/applications/{aid}/approve",{"reviewerNotes":"Auto-approved"})
    if is_err(r): fail(f"Approve {aid}: {r.get('message')}")
    else: approved += 1
ok(f"Approved: {approved}")

# ── STEP 8: Закрыть регистрацию ────────────────────────────────
hdr("STEP 8 — Close Registration")
cr = POST(f"/api/tournaments/{TOUR_ID}/status",{"status":"REGISTRATION_CLOSED"})
if is_err(cr): warn(f"Close registration: {cr.get('message','?')}")
else: ok(f"Status: {cr.get('status','?')}")

# ── STEP 9: Генерация сеток ────────────────────────────────────
hdr("STEP 9 — Generate Brackets")
brackets = []
for cat_i, cat_id in enumerate(cat_ids):
    if not cat_id: continue
    cat_name = SIX_CATS[cat_i]["name"]["ru"]
    r = POST(f"/api/tournaments/{TOUR_ID}/categories/{cat_id}/bracket",{})
    if is_err(r):
        fail(f"Bracket {cat_name}: {r.get('code','?')} — {r.get('message','?')}")
    else:
        mc = r.get("matchCount", len(r.get("matches",[])))
        info(f"  {cat_name}: {mc} matches, id={r.get('id','?')[:10]}...")
        brackets.append(r)

ok(f"Brackets: {len(brackets)}/{len(valid_cat_ids)}")
if not brackets: fail("Сетки не сгенерированы"); sys.exit(1)

# ── STEP 9b: Проверка дубликатов в сетке ───────────────────────
hdr("STEP 9b — Verify No Duplicate Athletes in Brackets")
duplicate_found = False
for br in brackets:
    bid = br.get("id")
    # Загружаем полную сетку
    full = GET(f"/api/brackets/{bid}")
    if is_err(full): warn(f"Load bracket {bid}: {full.get('message')}"); continue
    matches_list = full.get("matches",[])
    round1 = [m for m in matches_list
              if m.get("bracketSection")=="main" and m.get("round")==1]
    seen_ids = set()
    dups = []
    for m in round1:
        for ath_key in ["redAthleteId","blueAthleteId"]:
            aid = m.get(ath_key)
            if aid:
                if aid in seen_ids: dups.append(aid)
                seen_ids.add(aid)
    cat_name = br.get("category",{}).get("name",{}).get("ru","?")
    if dups:
        fail(f"DUPLICATE athletes in bracket {cat_name}: {dups}")
        duplicate_found = True
    else:
        ok(f"No duplicates in {cat_name} ({len(seen_ids)} athletes in round 1)")

if not duplicate_found:
    ok("All brackets: no duplicate athletes ✓")

# ── STEP 10: Играем все матчи (IPPON + CONFIRM) ─────────────────
hdr("STEP 10 — Play All Matches (HAJIME → IPPON RED → CONFIRM)")
total_played  = 0
total_confirm = 0
total_skipped = 0
match_errors  = 0

for br in brackets:
    bracket_id = br.get("id")
    cat_name   = br.get("category",{}).get("name",{}).get("ru","?")
    info(f"\n  Playing bracket: {cat_name}")

    for _round_iter in range(30):  # защита от бесконечного цикла
        mr = GET(f"/api/matches?bracketId={bracket_id}&limit=500")
        if is_err(mr): fail(f"List matches {bracket_id}"); break
        ml = mr if isinstance(mr,list) else mr.get("items",mr.get("matches",[]))

        # Матчи с двумя спортсменами в статусе PENDING или IN_PROGRESS
        pending = [m for m in ml
                   if m.get("status") in ("PENDING","IN_PROGRESS")
                   and m.get("redAthleteId") and m.get("blueAthleteId")]
        if not pending: break

        round_played = 0
        for match in pending:
            mid = match["id"]

            # 1. ХАДЖИМЕ (старт) — используем admin TOKEN (authorizeForMatch позволяет)
            if match.get("status") == "PENDING":
                sr = POST(f"/api/matches/{mid}/start")
                if is_err(sr) and sr.get("__status") != 409:
                    warn(f"Start {mid[:8]}: {sr.get('message','?')[:40]}")

            # 2. IPPON для RED → pendingResult
            ir = POST(f"/api/matches/{mid}/score", {"type":"IPPON","side":"RED"})
            if is_err(ir):
                match_errors += 1
                fail(f"IPPON {mid[:8]}: {ir.get('message','?')[:60]}"); continue
            total_played += 1

            # 3. БЕКІТУ (confirm) → COMPLETED + propagateWinner
            cr = POST(f"/api/matches/{mid}/confirm")
            if is_err(cr):
                match_errors += 1
                fail(f"Confirm {mid[:8]}: {cr.get('message','?')[:60]}")
            else:
                s = cr.get("status","?")
                if s == "COMPLETED":
                    total_confirm += 1
                    round_played  += 1
                else:
                    warn(f"Confirm {mid[:8]}: unexpected status={s}")

        if round_played == 0:
            # Нет прогресса — проверяем IN_PROGRESS с pendingResult
            in_prog = [m for m in ml if m.get("status")=="IN_PROGRESS"
                       and m.get("redAthleteId") and m.get("blueAthleteId")]
            if not in_prog: break
            for match in in_prog:
                mid = match["id"]
                cr2 = POST(f"/api/matches/{mid}/confirm")
                if not is_err(cr2) and cr2.get("status")=="COMPLETED":
                    total_confirm += 1; round_played += 1
            if round_played == 0: break

    # Итоги по сетке
    final_r = GET(f"/api/matches?bracketId={bracket_id}&limit=500")
    if not is_err(final_r):
        all_m = final_r if isinstance(final_r,list) else final_r.get("items",[])
        completed = sum(1 for m in all_m if m.get("status")=="COMPLETED")
        remaining = sum(1 for m in all_m
                        if m.get("status") in ("PENDING","IN_PROGRESS")
                        and m.get("redAthleteId") and m.get("blueAthleteId"))
        tbd = sum(1 for m in all_m
                  if m.get("status")=="PENDING"
                  and not (m.get("redAthleteId") and m.get("blueAthleteId")))
        icon = "✓" if remaining == 0 else "⚠"
        info(f"  {icon} {cat_name}: {completed} завершено, {remaining} ждут, {tbd} TBD-слотов")
        if remaining > 0:
            warn(f"  Bracket {cat_name}: {remaining} матчей не доиграно")
        # Проверка победителя финала
        final_m = [m for m in all_m if m.get("bracketSection")=="final"
                   and m.get("status")=="COMPLETED" and m.get("winnerId")]
        if final_m:
            w = final_m[0]
            ok(f"  Финал {cat_name}: победитель = {w.get('winnerId','?')[:12]}...")
        else:
            if remaining == 0 and completed > 0:
                warn(f"  Финал {cat_name}: не найден завершённый финальный матч")

ok(f"Матчей сыграно: {total_played}, подтверждено: {total_confirm}")
ok(f"Пропущено: {total_skipped}, ошибок: {match_errors}")

# ── STEP 11: Финализация турнира ───────────────────────────────
hdr("STEP 11 — Finalize Tournament")
fin = POST(f"/api/admin/tournaments/{TOUR_ID}/finalize")
if is_err(fin): warn(f"Finalize: {fin.get('message','?')}")
else: ok(f"Finalized — entries: {fin.get('entriesCount', fin.get('count','?'))}")

# ── STEP 12: Рейтинг ────────────────────────────────────────────
hdr("STEP 12 — Check Rating Leaderboard")
lb = GET("/api/ratings/leaderboard?limit=500")
if is_err(lb): warn(f"Leaderboard: {lb.get('message')}")
else:
    lb_list = lb if isinstance(lb,list) else lb.get("items",[])
    ok(f"Leaderboard: {len(lb_list)} спортсменов с рейтингом")
    if lb_list:
        top = lb_list[0]; a = top.get("athlete",top)
        info(f"#1: {a.get('name','')} {a.get('surname','')} — {round(top.get('totalPoints',0))} pts")

# ── STEP 13: Татами план ────────────────────────────────────────
hdr("STEP 13 — Tatami Plan")
tp = GET(f"/api/tournaments/{TOUR_ID}/brackets")
if is_err(tp): warn(f"Brackets list: {tp.get('message')}")
else:
    tp_l = tp if isinstance(tp,list) else tp.get("items",[])
    ok(f"Brackets list: {len(tp_l)} сеток")

# ── STEP 14: Spot checks ────────────────────────────────────────
hdr("STEP 14 — Spot Checks")
td = GET(f"/api/tournaments/{TOUR_ID}")
ok(f"Tournament detail: status={td.get('status','?')} cats={td.get('_count',{}).get('categories','?')}")
cats_r = GET(f"/api/tournaments/{TOUR_ID}/categories")
cat_l = cats_r if isinstance(cats_r,list) else cats_r.get("items",[])
ok(f"Categories list: {len(cat_l)}")
brk_r = GET(f"/api/tournaments/{TOUR_ID}/brackets")
brk_l = brk_r if isinstance(brk_r,list) else brk_r.get("items",[])
ok(f"Brackets list: {len(brk_l)}")
club_d = GET(f"/api/admin/clubs/{clubs[0]['id']}")
ok(f"Club detail: {len(club_d.get('members',[]))} members")

# ── ИТОГ ────────────────────────────────────────────────────────
hdr("FINAL REPORT")
print(f"\n  {W}Клубы:{N}            {len(clubs)}")
print(f"  {W}Спортсменов:{N}      {total_athletes}/500")
print(f"  {W}Заявок:{N}           {total_entries}")
print(f"  {W}Категорий:{N}        {len(valid_cat_ids)}/6")
print(f"  {W}Сеток:{N}            {len(brackets)}/6")
print(f"  {W}Матчей сыграно:{N}   {total_played}")
print(f"  {W}Подтверждено:{N}     {total_confirm}")
print(f"  {W}Ошибок матчей:{N}    {match_errors}")
print(f"  {W}Ошибок заявок:{N}    {entry_errors}")
print()

if ERRORS:
    print(f"{R}{W}  ОШИБКИ ({len(ERRORS)}):{N}")
    for e in ERRORS: print(f"{R}    • {e}{N}")
else:
    print(f"{G}{W}  ✓ ОШИБОК НЕТ{N}")

if WARNINGS:
    print(f"\n{Y}  ПРЕДУПРЕЖДЕНИЯ ({len(WARNINGS)}):{N}")
    for w in WARNINGS: print(f"{Y}    • {w}{N}")

print()
if not ERRORS:
    print(f"{G}{W}  🥋 Сетки работают правильно!{N}")
else:
    print(f"{R}{W}  ✗ {len(ERRORS)} ОШИБОК — смотри выше{N}")

print(f"\n  Tournament ID: {TOUR_ID}")
print(f"  Admin: admin@judo-arena.kz / {PASS}\n")
