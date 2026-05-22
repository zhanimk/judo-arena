#!/usr/bin/env python3
"""
Judo-Arena — FLOW TEST (uses pre-seeded data)
Tests: close registration → brackets → matches → finalize → protocol → rating
Tournament: fulltest-championship-2026 (400 athletes, 14 categories)
"""

import json, sys, time
from urllib import request as urllib_request, error as urllib_error
from urllib.request import Request

API = "http://localhost:4000"
PASS = "password123"
TOUR_ID = "fulltest-championship-2026"

G='\033[32m'; Y='\033[33m'; R='\033[31m'; B='\033[34m'; C='\033[36m'; N='\033[0m'; W='\033[1m'
def ok(m):   print(f"{G}  ✓ {m}{N}")
def warn(m): WARNINGS.append(m); print(f"{Y}  ⚠ {m}{N}")
def fail(m): ERRORS.append(m); print(f"{R}  ✗ FAIL: {m}{N}")
def info(m): print(f"{C}    {m}{N}")
def step(m): print(f"\n{B}{W}▶ {m}{N}")
def hdr(m):  print(f"\n{W}{B}{'═'*60}\n  {m}\n{'═'*60}{N}")

ERRORS = []
WARNINGS = []
TOKEN = None

def http(method, path, body=None, token=None):
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token or TOKEN:
        headers["Authorization"] = f"Bearer {token or TOKEN}"
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urllib_request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read())
    except urllib_error.HTTPError as e:
        raw = e.read()
        try:
            return {"__error": True, "__status": e.code, **json.loads(raw)}
        except Exception:
            return {"__error": True, "__status": e.code, "message": raw.decode(errors="replace")}
    except Exception as e:
        return {"__error": True, "__status": 0, "message": str(e)}

def GET(p, token=None):   return http("GET", p, token=token)
def POST(p, b=None, token=None): return http("POST", p, b if b is not None else {}, token=token)
def PATCH(p, b=None, token=None): return http("PATCH", p, b if b is not None else {}, token=token)
def is_err(r): return isinstance(r, dict) and r.get("__error")

# ── STEP 0: Health ─────────────────────────────────────────────────────────────
hdr("STEP 0 — API + Admin Login")
r = GET("/api/tournaments")
if is_err(r): fail("API down"); sys.exit(1)
ok("API alive")

login_r = POST("/api/auth/login", {"email":"admin@judo-arena.kz","password":PASS})
if is_err(login_r) or not login_r.get("accessToken"):
    fail(f"Admin login: {login_r}"); sys.exit(1)
TOKEN = login_r["accessToken"]
ok("Admin logged in")

# ── STEP 1: Verify tournament + applications ───────────────────────────────────
hdr("STEP 1 — Tournament & Application Verification")
tour = GET(f"/api/tournaments/{TOUR_ID}")
if is_err(tour):
    fail(f"Tournament not found: {tour.get('message')}"); sys.exit(1)

ok(f"Tournament: {tour.get('name',{}).get('ru','?')} — status={tour.get('status')}")

apps = GET(f"/api/tournaments/{TOUR_ID}/applications")
if is_err(apps):
    fail(f"List applications: {apps.get('message')}")
    apps_list = []
else:
    apps_list = apps if isinstance(apps, list) else apps.get("applications", apps.get("items", []))

approved = [a for a in apps_list if a.get("status") == "APPROVED"]
ok(f"Applications: {len(apps_list)} total, {len(approved)} APPROVED")

if not approved:
    fail("No approved applications — cannot generate brackets"); sys.exit(1)

# Count entries per category
cats_r = GET(f"/api/tournaments/{TOUR_ID}/categories")
if is_err(cats_r):
    fail(f"Categories: {cats_r.get('message')}"); sys.exit(1)
cat_list = cats_r if isinstance(cats_r, list) else cats_r.get("items", [])
ok(f"Categories: {len(cat_list)}")

for cat in cat_list:
    info(f"  {cat.get('name',{}).get('ru','?')} — id={cat['id']}")

# ── STEP 2: Close registration ─────────────────────────────────────────────────
hdr("STEP 2 — Close Registration")

if tour.get("status") in ("REGISTRATION_CLOSED", "IN_PROGRESS", "COMPLETED"):
    ok(f"Already in correct status: {tour.get('status')}")
else:
    close_r = POST(f"/api/tournaments/{TOUR_ID}/status", {"status": "REGISTRATION_CLOSED"})
    if is_err(close_r):
        fail(f"Close registration: HTTP {close_r.get('__status')} — {close_r.get('message')}")
        warn("Will attempt brackets anyway")
    else:
        ok(f"Registration closed → {close_r.get('status','?')}")

# ── STEP 3: Generate brackets ──────────────────────────────────────────────────
hdr("STEP 3 — Generate Brackets (14 categories)")
brackets = []
bracket_errors = []

for cat in cat_list:
    cat_id = cat["id"]
    cat_name = cat.get("name", {}).get("ru", "?")

    # Check if bracket already exists
    existing = GET(f"/api/tournaments/{TOUR_ID}/categories/{cat_id}/bracket")
    if not is_err(existing) and existing.get("id"):
        ok(f"Bracket EXISTS: {cat_name}")
        brackets.append({**existing, "catName": cat_name})
        continue

    r = POST(f"/api/tournaments/{TOUR_ID}/categories/{cat_id}/bracket")
    if is_err(r):
        code = r.get("code","?")
        msg  = r.get("message","?")
        if code == "NOT_ENOUGH_ATHLETES":
            warn(f"Bracket {cat_name}: NOT_ENOUGH_ATHLETES")
        elif code == "INVALID_STATUS":
            fail(f"Bracket {cat_name}: INVALID_STATUS — {msg}")
            bracket_errors.append((cat_name, code, msg))
        else:
            fail(f"Bracket {cat_name}: {code} — {msg}")
            bracket_errors.append((cat_name, code, msg))
    else:
        match_count = len(r.get("matches", []))
        ok(f"Bracket {cat_name}: {match_count} matches, id={r.get('id','?')}")
        brackets.append({**r, "catName": cat_name})

ok(f"Brackets generated: {len(brackets)}/{len(cat_list)} (errors: {len(bracket_errors)})")
if not brackets:
    fail("No brackets available"); sys.exit(1)

# ── STEP 4: Play all matches ───────────────────────────────────────────────────
hdr("STEP 4 — Play All Matches (Ippon for RED)")
total_played = 0
total_skipped = 0

for br in brackets:
    bracket_id = br.get("id")
    cat_name   = br.get("catName", "?")

    for _iter in range(30):  # max 30 rounds per bracket
        matches_r = GET(f"/api/matches?bracketId={bracket_id}&limit=200")
        if is_err(matches_r):
            fail(f"List matches bracket {bracket_id}: {matches_r.get('message')}")
            break

        match_list = matches_r if isinstance(matches_r, list) else \
                     matches_r.get("items", matches_r.get("matches", []))
        pending = [m for m in match_list
                   if m.get("status") in ("PENDING", "IN_PROGRESS")
                   and m.get("redAthleteId") and m.get("blueAthleteId")]

        if not pending:
            break

        iter_played = 0
        for match in pending:
            mid = match["id"]

            # Start (ignore 409 = already started)
            http("POST", f"/api/matches/{mid}/start", {})

            # Score: Ippon RED — admin JWT, no judge session needed
            score_r = POST(f"/api/matches/{mid}/score",
                           {"type": "IPPON", "side": "RED"})
            if is_err(score_r):
                total_skipped += 1
                fail(f"Score {mid}: {score_r.get('code','?')} — {score_r.get('message','?')}")
            else:
                m_result = score_r.get("match", score_r)
                if m_result.get("status") == "COMPLETED":
                    total_played += 1
                    iter_played  += 1

        if iter_played == 0:
            break

    # Verify all done
    final = GET(f"/api/matches?bracketId={bracket_id}&limit=200")
    if not is_err(final):
        fl = final if isinstance(final, list) else final.get("items", final.get("matches", []))
        done  = sum(1 for m in fl if m.get("status") == "COMPLETED")
        left  = sum(1 for m in fl if m.get("status") in ("PENDING", "IN_PROGRESS")
                    and m.get("redAthleteId") and m.get("blueAthleteId"))
        icon = "✓" if left == 0 else "⚠"
        msg  = f"{icon} {cat_name}: {done} completed, {left} unplayed"
        (info if left == 0 else warn)(msg)
        if left > 0:
            WARNINGS.append(msg)

ok(f"Total matches played: {total_played} (skipped: {total_skipped})")

# ── STEP 5: Finalize tournament ────────────────────────────────────────────────
hdr("STEP 5 — Finalize Tournament → Rating")

# Re-check status (might be COMPLETED already)
tour_now = GET(f"/api/tournaments/{TOUR_ID}")
if not is_err(tour_now) and tour_now.get("status") == "COMPLETED":
    warn("Tournament already COMPLETED — skipping finalize")
else:
    fin_r = POST(f"/api/admin/tournaments/{TOUR_ID}/finalize")
    if is_err(fin_r):
        fail(f"Finalize: HTTP {fin_r.get('__status')} — {fin_r.get('message')}")
    else:
        entries = fin_r.get("entriesCount", fin_r.get("count", "?"))
        ok(f"Tournament finalized — rating entries created: {entries}")

# ── STEP 6: Verify rating ──────────────────────────────────────────────────────
hdr("STEP 6 — Verify Rating Leaderboard")
lb = GET("/api/ratings/leaderboard?limit=100")
if is_err(lb):
    fail(f"Leaderboard: {lb.get('message')}")
else:
    lb_list = lb if isinstance(lb, list) else lb.get("items", lb.get("entries", []))
    ok(f"Leaderboard: {len(lb_list)} athletes with rating points")
    if lb_list:
        top = lb_list[0]
        a = top.get("athlete", top)
        info(f"  #1: {a.get('name','')} {a.get('surname','')} — {round(top.get('totalPoints',0),1)} pts")
        if len(lb_list) >= 3:
            t3 = lb_list[2]
            a3 = t3.get("athlete", t3)
            info(f"  #3: {a3.get('name','')} {a3.get('surname','')} — {round(t3.get('totalPoints',0),1)} pts")

# ── STEP 7: Protocol PDF ───────────────────────────────────────────────────────
hdr("STEP 7 — Protocol PDF Generation")
pdf_req = Request(
    f"{API}/api/pdf/protocol?tournamentId={TOUR_ID}",
    headers={"Authorization": f"Bearer {TOKEN}"}
)
try:
    with urllib_request.urlopen(pdf_req, timeout=30) as resp:
        pdf_bytes = resp.read()
        ct = resp.headers.get("Content-Type", "")
        if ct.startswith("application/pdf") or pdf_bytes[:4] == b"%PDF":
            ok(f"Protocol PDF: {len(pdf_bytes) // 1024} KB")
        else:
            warn(f"PDF response not PDF — Content-Type: {ct}")
except urllib_error.HTTPError as e:
    body = e.read().decode(errors="replace")
    fail(f"Protocol PDF HTTP {e.code}: {body[:300]}")
except Exception as e:
    fail(f"Protocol PDF error: {e}")

# ── STEP 8: Diploma PDF (sample) ───────────────────────────────────────────────
hdr("STEP 8 — Diploma PDF (sample athlete)")
# Get first athlete from leaderboard
if not is_err(lb) and lb_list:
    top_athlete = lb_list[0].get("athlete", lb_list[0])
    athlete_id  = top_athlete.get("id")

    # Get their tournament entry
    entries_r = GET(f"/api/ratings/athletes/{athlete_id}")
    if not is_err(entries_r) and entries_r.get("entries"):
        entry = entries_r["entries"][0]
        cat_id = entry.get("categoryId") or entry.get("category",{}).get("id")
        dip_req = Request(
            f"{API}/api/pdf/diploma?athleteId={athlete_id}&tournamentId={TOUR_ID}&categoryId={cat_id}",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )
        try:
            with urllib_request.urlopen(dip_req, timeout=20) as resp:
                dip_bytes = resp.read()
                if dip_bytes[:4] == b"%PDF" or resp.headers.get("Content-Type","").startswith("application/pdf"):
                    ok(f"Diploma PDF: {len(dip_bytes)//1024} KB for athlete {athlete_id}")
                else:
                    warn(f"Diploma not PDF")
        except urllib_error.HTTPError as e:
            warn(f"Diploma PDF HTTP {e.code}: {e.read().decode()[:200]}")
        except Exception as e:
            warn(f"Diploma PDF: {e}")
    else:
        warn("No rating entries found for top athlete — diploma test skipped")

# ── STEP 9: Admin Module Checks ────────────────────────────────────────────────
hdr("STEP 9 — Admin Module Spot Checks")

# Tournament detail
td = GET(f"/api/tournaments/{TOUR_ID}")
if is_err(td): fail(f"Tournament detail: {td.get('message')}")
else: ok(f"Tournament detail: status={td.get('status')} cats={td.get('_count',{}).get('categories','?')}")

# Brackets list
brk_r = GET(f"/api/tournaments/{TOUR_ID}/brackets")
if is_err(brk_r): fail(f"Brackets list: {brk_r.get('message')}")
else:
    bl = brk_r if isinstance(brk_r, list) else brk_r.get("items", brk_r.get("brackets", []))
    ok(f"Brackets list: {len(bl)} brackets in DB")

# Tatami plan
tat = GET(f"/api/tournaments/{TOUR_ID}/brackets/prepare")
if is_err(tat):
    # Try to get match list as tatami proxy
    tat_m = GET(f"/api/matches?tournamentId={TOUR_ID}&limit=10")
    if is_err(tat_m): warn(f"Tatami (matches list): {tat_m.get('message')}")
    else:
        ml = tat_m if isinstance(tat_m, list) else tat_m.get("items", tat_m.get("matches", []))
        ok(f"Matches list (tatami proxy): {len(ml)} matches visible")
else:
    ok(f"Tatami draw prepared")

# Club leaderboard
clb = GET("/api/ratings/clubs?limit=30")
if is_err(clb): warn(f"Club leaderboard: {clb.get('message')}")
else:
    clb_list = clb if isinstance(clb, list) else clb.get("items", clb.get("clubs", []))
    ok(f"Club leaderboard: {len(clb_list)} clubs ranked")
    if clb_list:
        c = clb_list[0]
        cname = c.get("club", c).get("name", {})
        cname_str = cname.get("ru", cname.get("kk", "?")) if isinstance(cname, dict) else cname
        info(f"  #1 Club: {cname_str} — {round(c.get('totalPoints',0),1)} pts")

# Admin users list
users_r = GET("/api/admin/users?role=ATHLETE&limit=500")
if is_err(users_r): fail(f"Admin users list: {users_r.get('message')}")
else: ok(f"Admin users list: {users_r.get('total',0)} athletes visible")

# Admin clubs list
clubs_r = GET("/api/clubs")
if is_err(clubs_r): fail(f"Clubs list: {clubs_r.get('message')}")
else:
    cl = clubs_r if isinstance(clubs_r, list) else clubs_r.get("items", [])
    ok(f"Clubs list: {len(cl)} clubs")

# Admin club detail
cl_list = clubs_r if isinstance(clubs_r, list) else clubs_r.get("items", [])
ft_clubs = [c for c in cl_list if c.get("shortName","").startswith("FT")]
if ft_clubs:
    cid = ft_clubs[0]["id"]
    cd = GET(f"/api/admin/clubs/{cid}")
    if is_err(cd): fail(f"Admin club detail: {cd.get('message')}")
    else: ok(f"Admin club detail: {len(cd.get('members',[]))} members, {len(cd.get('groups',[]))} groups")

# ── FINAL REPORT ───────────────────────────────────────────────────────────────
hdr("FINAL REPORT")
print(f"  {W}Tournament:{N}     {TOUR_ID}")
print(f"  {W}Brackets:{N}       {len(brackets)}/14")
print(f"  {W}Matches played:{N} {total_played}")
print(f"  {W}Skipped:{N}        {total_skipped}")
print()

if ERRORS:
    print(f"{R}{W}  ✗ ERRORS ({len(ERRORS)}):{N}")
    for e in ERRORS:
        print(f"{R}    • {e}{N}")
else:
    print(f"{G}{W}  ✓ NO CRITICAL ERRORS{N}")

if WARNINGS:
    print(f"\n{Y}  ⚠ WARNINGS ({len(WARNINGS)}):{N}")
    for w in WARNINGS[:20]:
        print(f"{Y}    • {w}{N}")

print()
verdict = f"{G}{W}🥋 PASSED" if not ERRORS else f"{R}{W}✗ FAILED"
print(f"  {verdict} — {len(ERRORS)} errors, {len(WARNINGS)} warnings{N}\n")
