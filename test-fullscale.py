#!/usr/bin/env python3
"""
Judo-Arena — FULL-SCALE INTEGRATION TEST
=========================================
Creates: 10 clubs · 10 coaches · 400 athletes · 1 tournament · 14 categories
Tests  : admin CRUD → coach application → approve → bracket → matches → finalize → protocol

Usage: python3 test-fullscale.py
Requires API running at localhost:4000
"""

import json, sys, time, random, re
from datetime import datetime, timedelta, date
from urllib import request as urllib_request, error as urllib_error
from urllib.request import Request

API = "http://localhost:4000"
PASS = "password123"

# ── Color helpers ──────────────────────────────────────────────────────────────
G='\033[32m'; Y='\033[33m'; R='\033[31m'; B='\033[34m'; C='\033[36m'; N='\033[0m'; W='\033[1m'
def ok(m):      print(f"{G}  ✓ {m}{N}")
def warn(m):    WARNINGS.append(m); print(f"{Y}  ⚠ {m}{N}")
def fail(m):    ERRORS.append(m); print(f"{R}  ✗ FAIL: {m}{N}")
def info(m):    print(f"{C}    {m}{N}")
def step(m):    print(f"\n{B}▶ {m}{N}")
def hdr(m):     print(f"\n{W}{B}{'═'*56}\n  {m}\n{'═'*56}{N}")

ERRORS = []
WARNINGS = []

# ── HTTP helpers ───────────────────────────────────────────────────────────────
TOKEN = None

def http(method, path, body=None, token=None):
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token or TOKEN:
        headers["Authorization"] = f"Bearer {token or TOKEN}"
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urllib_request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except urllib_error.HTTPError as e:
        body_bytes = e.read()
        try:
            return {"__error": True, "__status": e.code, **json.loads(body_bytes)}
        except Exception:
            return {"__error": True, "__status": e.code, "message": body_bytes.decode(errors="replace")}
    except Exception as e:
        return {"__error": True, "__status": 0, "message": str(e)}

def GET(path, token=None):    return http("GET", path, token=token)
def POST(path, body=None, token=None): return http("POST", path, body or {}, token=token)
def PATCH(path, body=None, token=None): return http("PATCH", path, body or {}, token=token)

def is_err(r): return isinstance(r, dict) and r.get("__error")
def check(r, label):
    if is_err(r):
        fail(f"{label}: HTTP {r.get('__status')} — {r.get('message','?')}")
        return False
    return True

# ── Data definitions ───────────────────────────────────────────────────────────
MALE_NAMES = [
    ("Әлихан","Сәрсенов"),("Нұрбол","Қайратұлы"),("Дастан","Нұрлан"),("Санжар","Бекзат"),
    ("Руслан","Олжас"),("Мирас","Ержан"),("Тимур","Алмас"),("Айдар","Бахыт"),
    ("Арман","Дүйсебек"),("Ерлан","Мамыт"),("Сейіт","Болат"),("Данияр","Жаксыбек"),
    ("Бекзат","Жарылғасын"),("Нурдаулет","Тасым"),("Алибек","Жолдас"),("Марат","Ахмет"),
    ("Жандос","Балтабек"),("Берік","Тоқтар"),("Султан","Нұртай"),("Азамат","Рысқали"),
]
FEMALE_NAMES = [
    ("Айгерім","Бекова"),("Жанна","Серікқызы"),("Динара","Қанатқызы"),("Алия","Бағдат"),
    ("Камила","Ержанқызы"),("Сабина","Талғат"),("Меруерт","Айдар"),("Назгүл","Дәурен"),
    ("Жұлдыз","Нұрлан"),("Гүлназ","Серік"),("Томирис","Батыр"),("Айсана","Тілеу"),
    ("Ботагөз","Сарсен"),("Зарина","Кенже"),("Арайлым","Нәби"),("Медина","Ілия"),
    ("Аружан","Шынтай"),("Зейнеп","Ахмет"),("Дильназ","Мұхтар"),("Лейла","Бекенов"),
]

CITIES = ["Алматы","Астана","Қарағанды","Шымкент","Атырау","Павлодар","Тараз","Өскемен","Актау","Орал"]

# IJF weight categories
MALE_CATS = [
    {"name":{"ru":"Мужчины −60 кг","kk":"Ер адамдар −60 кг"},"gender":"MALE","ageMin":18,"ageMax":35,"weightMin":0,"weightMax":60.0,"wRange":(52,60)},
    {"name":{"ru":"Мужчины −66 кг","kk":"Ер адамдар −66 кг"},"gender":"MALE","ageMin":18,"ageMax":35,"weightMin":60.01,"weightMax":66.0,"wRange":(61,66)},
    {"name":{"ru":"Мужчины −73 кг","kk":"Ер адамдар −73 кг"},"gender":"MALE","ageMin":18,"ageMax":35,"weightMin":66.01,"weightMax":73.0,"wRange":(67,73)},
    {"name":{"ru":"Мужчины −81 кг","kk":"Ер адамдар −81 кг"},"gender":"MALE","ageMin":18,"ageMax":35,"weightMin":73.01,"weightMax":81.0,"wRange":(74,81)},
    {"name":{"ru":"Мужчины −90 кг","kk":"Ер адамдар −90 кг"},"gender":"MALE","ageMin":18,"ageMax":35,"weightMin":81.01,"weightMax":90.0,"wRange":(82,90)},
    {"name":{"ru":"Мужчины −100 кг","kk":"Ер адамдар −100 кг"},"gender":"MALE","ageMin":18,"ageMax":35,"weightMin":90.01,"weightMax":100.0,"wRange":(91,100)},
    {"name":{"ru":"Мужчины +100 кг","kk":"Ер адамдар +100 кг"},"gender":"MALE","ageMin":18,"ageMax":35,"weightMin":100.01,"weightMax":200.0,"wRange":(101,130)},
]
FEMALE_CATS = [
    {"name":{"ru":"Женщины −48 кг","kk":"Әйелдер −48 кг"},"gender":"FEMALE","ageMin":18,"ageMax":35,"weightMin":0,"weightMax":48.0,"wRange":(42,48)},
    {"name":{"ru":"Женщины −52 кг","kk":"Әйелдер −52 кг"},"gender":"FEMALE","ageMin":18,"ageMax":35,"weightMin":48.01,"weightMax":52.0,"wRange":(49,52)},
    {"name":{"ru":"Женщины −57 кг","kk":"Әйелдер −57 кг"},"gender":"FEMALE","ageMin":18,"ageMax":35,"weightMin":52.01,"weightMax":57.0,"wRange":(53,57)},
    {"name":{"ru":"Женщины −63 кг","kk":"Әйелдер −63 кг"},"gender":"FEMALE","ageMin":18,"ageMax":35,"weightMin":57.01,"weightMax":63.0,"wRange":(58,63)},
    {"name":{"ru":"Женщины −70 кг","kk":"Әйелдер −70 кг"},"gender":"FEMALE","ageMin":18,"ageMax":35,"weightMin":63.01,"weightMax":70.0,"wRange":(64,70)},
    {"name":{"ru":"Женщины −78 кг","kk":"Әйелдер −78 кг"},"gender":"FEMALE","ageMin":18,"ageMax":35,"weightMin":70.01,"weightMax":78.0,"wRange":(71,78)},
    {"name":{"ru":"Женщины +78 кг","kk":"Әйелдер +78 кг"},"gender":"FEMALE","ageMin":18,"ageMax":35,"weightMin":78.01,"weightMax":200.0,"wRange":(79,105)},
]
ALL_CATS = MALE_CATS + FEMALE_CATS  # 14 categories

def rand_dob(age_min=18, age_max=33):
    age = random.randint(age_min, age_max)
    y = date.today().year - age
    m = random.randint(1,12)
    d = random.randint(1,28)
    return f"{y}-{m:02d}-{d:02d}"

# ── STEP 0: API health check ───────────────────────────────────────────────────
hdr("STEP 0 — API Health Check")
r = GET("/api/tournaments")
if is_err(r):
    fail("API не отвечает на http://localhost:4000 — запусти сервер"); sys.exit(1)
ok(f"API alive — {len(r) if isinstance(r,list) else r.get('total','?')} турниров в БД")

# ── STEP 1: Admin login ────────────────────────────────────────────────────────
hdr("STEP 1 — Admin Login")
login_r = POST("/api/auth/login", {"email":"admin@judo-arena.kz","password":PASS})
if is_err(login_r) or not login_r.get("accessToken"):
    fail(f"Admin login failed: {login_r}")
    sys.exit(1)
TOKEN = login_r["accessToken"]
ok("Admin logged in")

# ── STEP 2: Create 10 clubs ────────────────────────────────────────────────────
hdr("STEP 2 — Create 10 Clubs")
clubs = []
for i, city in enumerate(CITIES):
    r = POST("/api/admin/clubs", {
        "name": {"ru": f"Клуб {city} #{i+1}", "kk": f"{city} клубы #{i+1}"},
        "city": city, "country": "KZ", "shortName": f"CLUB{i+1}"
    })
    if is_err(r):
        fail(f"Create club {city}: {r.get('message')}")
    else:
        clubs.append(r)
        ok(f"Club created: {city} — id={r['id']}")

if len(clubs) < 10:
    fail(f"Only {len(clubs)}/10 clubs created"); sys.exit(1)
ok(f"Total clubs: {len(clubs)}")

# ── STEP 3: Create 10 coaches ──────────────────────────────────────────────────
hdr("STEP 3 — Create Coaches (1 per club)")
coaches = []
for i, club in enumerate(clubs):
    email = f"coach.test{i+1}@judo-arena.kz"
    r = POST("/api/admin/users", {
        "email": email, "password": PASS, "role": "COACH",
        "name": f"Тренер", "surname": f"Тест{i+1}",
        "nameLatin": f"Coach", "surnameLatin": f"Test{i+1}",
        "clubId": club["id"]
    })
    if is_err(r):
        fail(f"Create coach for {club['city']}: {r.get('message')}")
    else:
        coaches.append({"user": r, "club": club, "email": email})
        ok(f"Coach created for {club['city']}: {email}")

ok(f"Total coaches: {len(coaches)}")

# ── STEP 4: Create 400 athletes (40 per club) ──────────────────────────────────
hdr("STEP 4 — Create 400 Athletes (40 per club)")
# Weight plan per club: 20 male (3+3+3+3+3+2+3=20), 20 female (3+3+3+3+3+3+2=20)
M_DIST = [3,3,3,3,3,2,3]  # 20 total male per club
F_DIST = [3,3,3,3,3,3,2]  # 20 total female per club

athletes_by_club = {}  # clubId → list of athlete objects with category info

total_athletes = 0
for ci, club in enumerate(clubs):
    club_athletes = []

    # Male athletes
    male_idx = 0
    for cat_i, cnt in enumerate(M_DIST):
        cat = MALE_CATS[cat_i]
        for k in range(cnt):
            nm = MALE_NAMES[(ci * 20 + male_idx) % len(MALE_NAMES)]
            w_min, w_max = cat["wRange"]
            weight = round(random.uniform(w_min, w_max - 0.5), 1)
            email = f"m{ci}-{male_idx}@test.judo-arena.kz"
            r = POST("/api/admin/users", {
                "email": email, "password": PASS, "role": "ATHLETE",
                "name": nm[0], "surname": nm[1],
                "nameLatin": nm[0][:6], "surnameLatin": nm[1][:8],
                "gender": "MALE", "dateOfBirth": rand_dob(),
                "weightKg": weight, "clubId": club["id"]
            })
            if is_err(r):
                fail(f"Create male athlete club{ci} idx{male_idx}: {r.get('message')}")
            else:
                club_athletes.append({"id": r["id"], "gender": "MALE", "catIdx": cat_i})
                total_athletes += 1
            male_idx += 1

    # Female athletes
    female_idx = 0
    for cat_i, cnt in enumerate(F_DIST):
        cat = FEMALE_CATS[cat_i]
        for k in range(cnt):
            nf = FEMALE_NAMES[(ci * 20 + female_idx) % len(FEMALE_NAMES)]
            w_min, w_max = cat["wRange"]
            weight = round(random.uniform(w_min, w_max - 0.5), 1)
            email = f"f{ci}-{female_idx}@test.judo-arena.kz"
            r = POST("/api/admin/users", {
                "email": email, "password": PASS, "role": "ATHLETE",
                "name": nf[0], "surname": nf[1],
                "nameLatin": nf[0][:6], "surnameLatin": nf[1][:8],
                "gender": "FEMALE", "dateOfBirth": rand_dob(),
                "weightKg": weight, "clubId": club["id"]
            })
            if is_err(r):
                fail(f"Create female athlete club{ci} idx{female_idx}: {r.get('message')}")
            else:
                club_athletes.append({"id": r["id"], "gender": "FEMALE", "catIdx": len(MALE_CATS) + cat_i})
                total_athletes += 1
            female_idx += 1

    athletes_by_club[club["id"]] = club_athletes
    info(f"Club {club['city']}: {len(club_athletes)} athletes created")

ok(f"Total athletes created: {total_athletes}/400")
if total_athletes < 380:
    fail("Too many athlete creation errors — aborting"); sys.exit(1)

# ── STEP 5: Create tournament with 14 categories ──────────────────────────────
hdr("STEP 5 — Create Tournament + 14 Categories")
start_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%dT12:00:00.000Z")
end_date   = (datetime.now() + timedelta(days=32)).strftime("%Y-%m-%dT18:00:00.000Z")
# Deadline in the future so we can add entries
deadline   = (datetime.now() + timedelta(days=25)).strftime("%Y-%m-%dT23:59:59.000Z")

tourney = POST("/api/tournaments", {
    "name": {"ru":"Чемпионат Казахстана 2026","kk":"Қазақстан чемпионаты 2026","en":"Kazakhstan Championship 2026"},
    "description": {"ru":"Полномасштабный тест 400 спортсменов"},
    "location": "Спорткомплекс Балуан Шолак",
    "city": "Алматы",
    "startDate": start_date,
    "endDate": end_date,
    "applicationDeadline": deadline,
    "tatamiCount": 6,
    "status": "REGISTRATION_OPEN",
    "format": "SE_IJF"
})
if is_err(tourney):
    fail(f"Create tournament: {tourney.get('message')}"); sys.exit(1)
TOUR_ID = tourney["id"]
ok(f"Tournament created: {TOUR_ID}")

# Create all 14 categories
cat_ids = []
for cat_def in ALL_CATS:
    r = POST(f"/api/tournaments/{TOUR_ID}/categories", {
        "name": cat_def["name"],
        "gender": cat_def["gender"],
        "ageMin": cat_def["ageMin"],
        "ageMax": cat_def["ageMax"],
        "weightMin": cat_def["weightMin"],
        "weightMax": cat_def["weightMax"],
        "matchDurationSec": 240,
        "format": "SE_IJF"
    })
    if is_err(r):
        fail(f"Create category {cat_def['name']['ru']}: {r.get('message')}")
        cat_ids.append(None)
    else:
        cat_ids.append(r["id"])
        ok(f"Category: {cat_def['name']['ru']} → {r['id']}")

valid_cats = [c for c in cat_ids if c]
ok(f"Categories created: {len(valid_cats)}/14")

# ── STEP 6: Coach applications ─────────────────────────────────────────────────
hdr("STEP 6 — Coach Applications (submit entries)")
app_ids = {}  # clubId → applicationId
skipped_entries = 0
total_entries = 0
entry_errors = 0

for i, coach_info in enumerate(coaches):
    club_id = coach_info["club"]["id"]
    coach_email = coach_info["email"]

    # Login as coach
    coach_login = POST("/api/auth/login", {"email": coach_email, "password": PASS})
    if is_err(coach_login) or not coach_login.get("accessToken"):
        fail(f"Coach {coach_email} login failed"); continue
    CTOK = coach_login["accessToken"]

    # Create or get application
    app_r = POST(f"/api/applications/{TOUR_ID}/draft", token=CTOK)
    if is_err(app_r):
        fail(f"Coach {i} create draft application: {app_r.get('message')}"); continue
    app_id = app_r["id"]
    app_ids[club_id] = app_id

    # Add entries for all athletes in this club
    club_athl = athletes_by_club.get(club_id, [])
    added = 0
    for athl in club_athl:
        cat_idx = athl["catIdx"]
        if cat_idx >= len(cat_ids) or cat_ids[cat_idx] is None:
            skipped_entries += 1; continue
        entry_r = POST(f"/api/applications/{app_id}/entries",
                       {"athleteId": athl["id"], "categoryId": cat_ids[cat_idx]},
                       token=CTOK)
        if is_err(entry_r):
            entry_errors += 1
            if entry_r.get("code") not in ("DUPLICATE_ENTRY","AGE_MISMATCH","WEIGHT_MISMATCH"):
                warn(f"Entry error club{i} athlete {athl['id']}: {entry_r.get('code','?')} — {entry_r.get('message','?')}")
        else:
            added += 1
            total_entries += 1

    # Submit application
    sub_r = POST(f"/api/applications/{app_id}/submit", token=CTOK)
    if is_err(sub_r):
        fail(f"Coach {i} submit application: {sub_r.get('message')}")
    else:
        ok(f"Club {coach_info['club']['city']}: {added} entries submitted (app {app_id})")

ok(f"Total entries submitted: {total_entries} (skipped: {skipped_entries}, errors: {entry_errors})")

# ── STEP 7: Admin approves all applications ────────────────────────────────────
hdr("STEP 7 — Admin Approves All Applications")
apps_list = GET(f"/api/applications?tournamentId={TOUR_ID}")
if is_err(apps_list):
    fail(f"List applications: {apps_list.get('message')}")
    apps_raw = []
else:
    apps_raw = apps_list if isinstance(apps_list, list) else apps_list.get("items", apps_list.get("applications", []))

approved = 0
for app in apps_raw:
    app_id = app["id"] if isinstance(app, dict) else app
    if isinstance(app, dict) and app.get("status") == "APPROVED":
        approved += 1; continue
    r = POST(f"/api/applications/{app_id}/approve", {"reviewerNotes": "Auto-approved"})
    if is_err(r):
        fail(f"Approve app {app_id}: {r.get('message')}")
    else:
        approved += 1

ok(f"Applications approved: {approved}")

# ── STEP 8: Close registration ─────────────────────────────────────────────────
hdr("STEP 8 — Close Tournament Registration")
close_r = PATCH(f"/api/admin/tournaments/{TOUR_ID}/status", {"status": "REGISTRATION_CLOSED"})
if is_err(close_r):
    # Try alternate endpoint
    close_r = PATCH(f"/api/tournaments/{TOUR_ID}", {"status": "REGISTRATION_CLOSED"})
if is_err(close_r):
    fail(f"Close registration: {close_r.get('message')}")
    warn("Will try bracket generation anyway (tournament might support IN_PROGRESS)")
else:
    ok(f"Registration closed — status: {close_r.get('status','?')}")

# ── STEP 9: Generate brackets ──────────────────────────────────────────────────
hdr("STEP 9 — Generate Brackets for All Categories")
brackets = []
bracket_errors = 0

for cat_i, cat_id in enumerate(cat_ids):
    if cat_id is None: continue
    cat_name = ALL_CATS[cat_i]["name"]["ru"]
    r = POST(f"/api/brackets", {"tournamentId": TOUR_ID, "categoryId": cat_id})
    if is_err(r):
        bracket_errors += 1
        code = r.get("code","?")
        msg = r.get("message","?")
        if code == "NOT_ENOUGH_ATHLETES":
            warn(f"Bracket {cat_name}: NOT_ENOUGH_ATHLETES ({msg})")
        else:
            fail(f"Bracket {cat_name}: {code} — {msg}")
    else:
        brackets.append(r)
        match_count = r.get("matchCount", len(r.get("matches",[])))
        info(f"Bracket {cat_name}: {match_count} matches, id={r.get('id','?')}")

ok(f"Brackets generated: {len(brackets)}/{len(valid_cats)} (errors: {bracket_errors})")
if len(brackets) == 0:
    fail("No brackets generated — cannot test matches"); sys.exit(1)

# ── STEP 10: Play all matches ──────────────────────────────────────────────────
hdr("STEP 10 — Play All Matches (Ippon for RED)")
total_played = 0
total_skipped = 0
total_match_errors = 0

for br in brackets:
    bracket_id = br.get("id")
    cat_name = "?"
    # find category name
    for ci, cid in enumerate(cat_ids):
        if cid == br.get("categoryId"):
            cat_name = ALL_CATS[ci]["name"]["ru"]; break

    MAX_ROUNDS = 20  # protection against infinite loop
    for _round in range(MAX_ROUNDS):
        # Fetch pending matches for this bracket
        matches_r = GET(f"/api/matches?bracketId={bracket_id}&limit=200")
        if is_err(matches_r):
            fail(f"List matches bracket {bracket_id}: {matches_r.get('message')}")
            break

        match_list = matches_r if isinstance(matches_r, list) else matches_r.get("items", matches_r.get("matches",[]))
        pending = [m for m in match_list
                   if m.get("status") in ("PENDING","IN_PROGRESS")
                   and m.get("redAthleteId") and m.get("blueAthleteId")]

        if not pending:
            break

        round_played = 0
        for match in pending:
            mid = match["id"]

            # Create judge session
            js = POST(f"/api/matches/{mid}/judge-session",
                      {"judgeName":"AutoJudge","ttlHours":1})
            if is_err(js):
                total_match_errors += 1
                warn(f"Judge session {mid}: {js.get('message')}")
                total_skipped += 1
                continue
            jt = js.get("token")

            # Start match
            start_r = http("POST", f"/api/matches/{mid}/start",
                           body={}, token=jt)
            if is_err(start_r) and start_r.get("__status") != 409:
                warn(f"Start match {mid}: {start_r.get('message')}")

            # Score: Ippon for RED
            score_r = http("POST", f"/api/matches/{mid}/score",
                           body={"type":"IPPON","side":"RED"}, token=jt)
            if is_err(score_r):
                total_match_errors += 1
                fail(f"Score match {mid}: {score_r.get('message')}")
            else:
                status = score_r.get("match",score_r).get("status","?")
                if status == "COMPLETED":
                    total_played += 1
                    round_played += 1
                else:
                    warn(f"Match {mid} scored but status={status}")

        if round_played == 0:
            break  # no progress, exit round loop

    # Final check: all matches in this bracket should be completed
    final_r = GET(f"/api/matches?bracketId={bracket_id}&limit=200")
    if not is_err(final_r):
        ml = final_r if isinstance(final_r,list) else final_r.get("items",final_r.get("matches",[]))
        completed = sum(1 for m in ml if m.get("status")=="COMPLETED")
        remaining = sum(1 for m in ml if m.get("status") in ("PENDING","IN_PROGRESS"))
        status_icon = "✓" if remaining == 0 else "⚠"
        info(f"  {status_icon} {cat_name}: {completed} completed, {remaining} remaining")
        if remaining > 0:
            warn(f"  Bracket {bracket_id} ({cat_name}): {remaining} matches not completed")

ok(f"Matches played: {total_played} (skipped: {total_skipped}, errors: {total_match_errors})")

# ── STEP 11: Finalize tournament ───────────────────────────────────────────────
hdr("STEP 11 — Finalize Tournament (Rating)")
fin_r = POST(f"/api/admin/tournaments/{TOUR_ID}/finalize")
if is_err(fin_r):
    fail(f"Finalize tournament: {fin_r.get('message')}")
else:
    entries_count = fin_r.get("entriesCount", fin_r.get("count","?"))
    ok(f"Tournament finalized — rating entries: {entries_count}")

# ── STEP 12: Verify rating ─────────────────────────────────────────────────────
hdr("STEP 12 — Verify Rating Leaderboard")
lb = GET(f"/api/ratings/leaderboard?limit=500")
if is_err(lb):
    fail(f"Leaderboard: {lb.get('message')}")
else:
    lb_list = lb if isinstance(lb,list) else lb.get("items",lb.get("entries",[]))
    ok(f"Leaderboard: {len(lb_list)} athletes with rating")
    if lb_list:
        top = lb_list[0]
        a = top.get("athlete",top)
        info(f"#1: {a.get('name','')} {a.get('surname','')} — {round(top.get('totalPoints',0))} pts")

# ── STEP 13: Protocol PDF ──────────────────────────────────────────────────────
hdr("STEP 13 — Protocol PDF Generation")
pdf_url = f"{API}/api/pdf/protocol?tournamentId={TOUR_ID}"
pdf_req = Request(pdf_url, headers={"Authorization": f"Bearer {TOKEN}"})
try:
    with urllib_request.urlopen(pdf_req, timeout=30) as resp:
        pdf_bytes = resp.read()
        if resp.headers.get("Content-Type","").startswith("application/pdf") or pdf_bytes[:4] == b"%PDF":
            ok(f"Protocol PDF generated: {len(pdf_bytes)//1024} KB")
        else:
            warn(f"Protocol response not PDF: {resp.headers.get('Content-Type')}")
except urllib_error.HTTPError as e:
    fail(f"Protocol PDF error: HTTP {e.code} — {e.read().decode(errors='replace')[:200]}")
except Exception as e:
    fail(f"Protocol PDF exception: {e}")

# ── STEP 14: Module checks ─────────────────────────────────────────────────────
hdr("STEP 14 — Module Spot Checks")

# Check tournament detail
td = GET(f"/api/tournaments/{TOUR_ID}")
if is_err(td):
    fail(f"Tournament detail: {td.get('message')}")
else:
    ok(f"Tournament detail: status={td.get('status')} cats={td.get('_count',{}).get('categories','?')}")

# Check categories list
cats_r = GET(f"/api/tournaments/{TOUR_ID}/categories")
if is_err(cats_r):
    fail(f"Categories list: {cats_r.get('message')}")
else:
    cat_list = cats_r if isinstance(cats_r,list) else cats_r.get("items",[])
    ok(f"Categories: {len(cat_list)} returned")

# Check brackets list
brk_r = GET(f"/api/brackets?tournamentId={TOUR_ID}")
if is_err(brk_r):
    fail(f"Brackets list: {brk_r.get('message')}")
else:
    brk_list = brk_r if isinstance(brk_r,list) else brk_r.get("items",brk_r.get("brackets",[]))
    ok(f"Brackets: {len(brk_list)} in DB")

# Check admin club detail (our first club)
club_detail = GET(f"/api/admin/clubs/{clubs[0]['id']}")
if is_err(club_detail):
    fail(f"Admin club detail: {club_detail.get('message')}")
else:
    member_count = len(club_detail.get("members",[]))
    ok(f"Admin club detail: {member_count} members visible")

# Check admin user detail
athl_sample = next(
    (a for a in athletes_by_club.get(clubs[0]["id"],[]) if a), None)
if athl_sample:
    usr_r = GET(f"/api/admin/users/{athl_sample['id']}")
    if is_err(usr_r):
        fail(f"Admin user detail: {usr_r.get('message')}")
    else:
        ok(f"Admin user detail: {usr_r.get('name','')} {usr_r.get('surname','')} loaded")

# Check tatami plan
tatami_r = GET(f"/api/brackets/tatami-plan?tournamentId={TOUR_ID}")
if is_err(tatami_r):
    warn(f"Tatami plan: {tatami_r.get('message')}")
else:
    ok(f"Tatami plan: {len(tatami_r) if isinstance(tatami_r,list) else 'ok'}")

# Club leaderboard
clb_lb = GET("/api/ratings/clubs?limit=20")
if is_err(clb_lb):
    warn(f"Club leaderboard: {clb_lb.get('message')}")
else:
    ok(f"Club leaderboard: {len(clb_lb) if isinstance(clb_lb,list) else clb_lb.get('total','?')} clubs")

# ── FINAL REPORT ──────────────────────────────────────────────────────────────
hdr("FINAL REPORT")
print(f"\n  {W}Clubs:{N}         {len(clubs)}")
print(f"  {W}Coaches:{N}       {len(coaches)}")
print(f"  {W}Athletes:{N}      {total_athletes}")
print(f"  {W}Categories:{N}    {len(valid_cats)}/14")
print(f"  {W}Brackets:{N}      {len(brackets)}")
print(f"  {W}Matches played:{N} {total_played}")
print(f"  {W}Match errors:{N}  {total_match_errors}")
print(f"  {W}Entry errors:{N}  {entry_errors}")
print()

if ERRORS:
    print(f"{R}{W}  ERRORS ({len(ERRORS)}):{N}")
    for e in ERRORS:
        print(f"{R}    • {e}{N}")
else:
    print(f"{G}{W}  ✓ NO ERRORS{N}")

if WARNINGS:
    print(f"\n{Y}  WARNINGS ({len(WARNINGS)}):{N}")
    for w in WARNINGS:
        print(f"{Y}    • {w}{N}")

print()
if not ERRORS:
    print(f"{G}{W}  🥋 ALL SYSTEMS GO — полный сценарий прошёл без ошибок!{N}")
else:
    print(f"{R}{W}  ✗ FOUND {len(ERRORS)} ERROR(S) — см. выше{N}")

print(f"\n  Tournament ID: {TOUR_ID}")
print(f"  Admin: admin@judo-arena.kz / {PASS}\n")
