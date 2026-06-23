const fs = require("fs");

// 1. athlete-nav.tsx
let athleteNav = fs.readFileSync(
  "web/src/components/dashboard/athlete-nav.tsx",
  "utf8",
);
athleteNav = athleteNav.replace("Swords,\n", "");
fs.writeFileSync("web/src/components/dashboard/athlete-nav.tsx", athleteNav);

// 2. coach-nav.tsx
let coachNav = fs.readFileSync(
  "web/src/components/dashboard/coach-nav.tsx",
  "utf8",
);
coachNav = coachNav.replace("ClipboardList,\n", "");
fs.writeFileSync("web/src/components/dashboard/coach-nav.tsx", coachNav);

// 3. admin.notifications.tsx
let adminNotif = fs.readFileSync(
  "web/src/routes/admin.notifications.tsx",
  "utf8",
);
adminNotif = adminNotif.replace("  Panel,\n", "");
fs.writeFileSync("web/src/routes/admin.notifications.tsx", adminNotif);

// 4. athlete.matches.$id.tsx
let athleteMatchId = fs.readFileSync(
  "web/src/routes/athlete.matches.$id.tsx",
  "utf8",
);
athleteMatchId = athleteMatchId.replace(
  'to="/athlete/matches"',
  'to="/athlete/results" search={{ tab: "matches" }}',
);
// But search isn't defined on the link easily if it's not typed. Actually just to="/athlete/results" is fine.
athleteMatchId = athleteMatchId.replace('search={{ tab: "matches" }}', ""); // if I added it above, wait, I'll just use to="/athlete/results"
athleteMatchId = athleteMatchId.replace(
  'to="/athlete/matches"',
  'to="/athlete/results"',
);
fs.writeFileSync("web/src/routes/athlete.matches.$id.tsx", athleteMatchId);

// 5. coach.applications.$id.tsx
let coachAppId = fs.readFileSync(
  "web/src/routes/coach.applications.$id.tsx",
  "utf8",
);
coachAppId = coachAppId.replace(
  'to="/coach/applications"',
  'to="/coach/tournaments"',
);
fs.writeFileSync("web/src/routes/coach.applications.$id.tsx", coachAppId);

// 6. coach.index.tsx
let coachIndex = fs.readFileSync("web/src/routes/coach.index.tsx", "utf8");
coachIndex = coachIndex.replace(
  /to="\/coach\/applications"/g,
  'to="/coach/tournaments"',
);
fs.writeFileSync("web/src/routes/coach.index.tsx", coachIndex);
