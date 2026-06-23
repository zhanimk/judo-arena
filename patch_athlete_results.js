const fs = require("fs");

const matchesCode = fs.readFileSync(
  "web/src/routes/athlete.matches.tsx",
  "utf8",
);
let resultsCode = fs.readFileSync("web/src/routes/athlete.results.tsx", "utf8");

// We'll replace the whole file since we need to merge imports and components
// Actually it's easier to just write a new file content.
