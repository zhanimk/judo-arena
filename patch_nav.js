const fs = require("fs");
let code = fs.readFileSync(
  "web/src/components/dashboard/coach-nav.tsx",
  "utf8",
);
code = code.replace(
  /  \{ to: "\/coach\/tournaments", label: "dashboard.tournaments", icon: Trophy \},\n  \{ to: "\/coach\/tournaments", label: "dashboard.tournaments", icon: Trophy \},/,
  '  { to: "/coach/tournaments", label: "dashboard.tournaments", icon: Trophy },',
);
fs.writeFileSync("web/src/components/dashboard/coach-nav.tsx", code);
