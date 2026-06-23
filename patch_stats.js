const fs = require("fs");
let code = fs.readFileSync("web/src/routes/athlete.results.tsx", "utf8");

const newStatsPanel = `
type AthleteStatsData = Awaited<ReturnType<typeof import("@/lib/api").api.ratings.athleteStats>>;

function AthleteStatsPanel({ stats, t }: { stats: AthleteStatsData; t: (k: string) => string }) {
  const m = stats.matches;
  const r = stats.rating;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {/* Rating Points Card */}
        <div className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/20 to-black/40 p-6 shadow-lg">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative">
            <div className="text-xs font-semibold uppercase tracking-widest text-gold/80">
              {t("stats.rating_points") ?? "Рейтинг ұпайы"}
            </div>
            <div className="mt-2 text-5xl font-black tracking-tight text-white drop-shadow-md">
              {r.totalPoints.toFixed(0)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {stats.tournaments.total} {t("stats.tournaments")?.toLowerCase() ?? "жарыстар"}
            </div>
          </div>
        </div>

        {/* Win Rate Card */}
        <div className="col-span-1 md:col-span-2 overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("stats.total_matches") ?? "Барлық матчтар"}: <span className="text-foreground text-sm ml-1">{m.total}</span>
            </div>
            <div className="text-xs font-bold bg-gold/10 text-gold px-2 py-1 rounded-md">
              {m.winRate}% WIN RATE
            </div>
          </div>
          
          <div className="h-4 w-full rounded-full bg-black/40 flex overflow-hidden mb-3">
            <div 
              className="bg-emerald-500 transition-all duration-1000 ease-out" 
              style={{ width: \`\${m.winRate}%\` }}
            />
            <div 
              className="bg-rose-500 transition-all duration-1000 ease-out" 
              style={{ width: \`\${100 - m.winRate}%\` }}
            />
          </div>
          
          <div className="flex justify-between text-sm font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-emerald-400">{m.wins} {t("stats.wins") ?? "Жеңістер"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-rose-400">{m.losses} {t("stats.losses") ?? "Жеңілістер"}</span>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Technical breakdown */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur-sm">
          <div className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Техникалық статистика
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-foreground/80">Иппон (Ippon)</span>
              <div className="flex items-center gap-3">
                <div className="w-24 h-2 bg-black/40 rounded-full overflow-hidden">
                  <div className="bg-yellow-500 h-full" style={{ width: \`\${m.ipponWinRate}%\` }} />
                </div>
                <span className="text-sm font-bold w-6 text-right tabular-nums">{m.ipponWins}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-foreground/80">Вазаари (Waza-ari)</span>
              <div className="flex items-center gap-3">
                <div className="w-24 h-2 bg-black/40 rounded-full overflow-hidden">
                  <div className="bg-white/50 h-full" style={{ width: \`\${m.wins > 0 ? (m.wazaariWins / m.wins) * 100 : 0}%\` }} />
                </div>
                <span className="text-sm font-bold w-6 text-right tabular-nums">{m.wazaariWins}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-foreground/80">Алтын балл (Golden Score)</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold w-6 text-right tabular-nums text-gold">{m.goldenScoreWins}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rating history sparkline */}
        {r.history.length > 1 ? (
          <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur-sm flex flex-col justify-center relative overflow-hidden">
             <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />
             <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("stats.rating_history") ?? "Рейтинг тарихы"}
            </div>
            <div className="h-20 w-full mt-2">
              <RatingSparkline history={r.history} />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/40 bg-card/20 p-5 flex items-center justify-center">
             <div className="text-sm text-muted-foreground/50 italic">
               Рейтинг тарихы әлі қалыптаспаған
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RatingSparkline({
`;

const splitCode = code.split(
  "// ─── AthleteStatsPanel ────────────────────────────────────────────────────────",
);
const afterPanel = splitCode[1].split("function RatingSparkline({");
const updatedCode =
  splitCode[0] +
  "// ─── AthleteStatsPanel ────────────────────────────────────────────────────────\n" +
  newStatsPanel +
  afterPanel[1];

fs.writeFileSync("web/src/routes/athlete.results.tsx", updatedCode);
