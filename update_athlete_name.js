const fs = require('fs');
const file = '/Users/zhanetta/Desktop/judo-arena/web/src/routes/admin.matches.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/function athleteName\(athlete: MatchAthlete \| null \| undefined\) \{/g, "function athleteName(athlete: MatchAthlete | null | undefined, t?: any) {");
content = content.replace(/if \(\!athlete\) return "TBD";/g, 'const fallback = t ? t("common.tbd", { defaultValue: "TBD" }) : "TBD";\n  if (!athlete) return fallback;');
content = content.replace(/return \[athlete\.name, athlete\.surname\]\.filter\(Boolean\)\.join\(" "\) \|\| "TBD";/g, 'return [athlete.name, athlete.surname].filter(Boolean).join(" ") || fallback;');

content = content.replace(/athleteName\((m\.redAthlete|m\.blueAthlete|match\.redAthlete|match\.blueAthlete|athlete)\)/g, "athleteName($1, t)");

fs.writeFileSync(file, content);
console.log('done');
