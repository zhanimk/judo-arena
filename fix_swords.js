const fs = require("fs");
let code = fs.readFileSync(
  "web/src/components/dashboard/athlete-nav.tsx",
  "utf8",
);
code = code.replace(/Swords,\s*/g, "");
fs.writeFileSync("web/src/components/dashboard/athlete-nav.tsx", code);
