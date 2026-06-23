const fs = require("fs");
let content = fs.readFileSync("web/src/routeTree.gen.ts", "utf8");

// The route AthleteMatchesRoute was never generated because the file is deleted.
// Oh wait, athlete.matches.tsx was deleted.
// It was not generated because there's no athlete.matches.tsx anymore.
// The file is called routeTree.gen.ts
content = content.replace(
  /import \{ Route as AthleteMatchesRouteImport \} from '.\/routes\/athlete.matches'\n/g,
  "",
);
content = content.replace(
  /const AthleteMatchesRoute = AthleteMatchesRouteImport.update\(\{[\s\S]*?\} as any\)\n/g,
  "",
);
content = content.replace(
  /  '\/admin\/matches': typeof AdminMatchesRoute\n/g,
  "  '/admin/matches': typeof AdminMatchesRoute\n",
); // leave admin
content = content.replace(
  /  '\/athlete\/matches': typeof AthleteMatchesRoute\n/g,
  "",
);
content = content.replace(
  /  '\/athlete\/matches': typeof AthleteMatchesRoute\n/g,
  "",
);
// Wait, athlete.matches route wasn't in the tree I saw, only athlete.matches.$id.
// Oh! In line 54 there's AdminMatches, 62 is AthleteMatchesId.
// Was there an AthleteMatches route? In the text I saw:
// '/athlete/matches/$id': typeof AthleteMatchesIdRoute
// No plain athlete.matches ? Ah! The file was `athlete.matches.tsx` so yes there was `AthleteMatchesRoute`. Let's just remove anything with AthleteMatches except AthleteMatchesId? Wait, `athlete.matches.tsx` was the parent or a flat route.
