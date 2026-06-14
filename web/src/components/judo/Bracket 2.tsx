import { Trophy } from "lucide-react";

export type Match = {
  id: string;
  a: string;
  b: string;
  scoreA?: string;
  scoreB?: string;
  winner?: "A" | "B";
  status?: "done" | "live" | "next" | "scheduled";
};
export type Round = { title: string; matches: Match[] };

export function Bracket({ rounds, champion }: { rounds: Round[]; champion?: string }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-6 min-w-max">
        {rounds.map((r, ri) => (
          <div key={`${ri}-${r.title}`} className="flex flex-col justify-around gap-4 min-w-[220px]">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold/80 text-center mb-1">{r.title}</div>
            {r.matches.map((m) => {
              const liveCls =
                m.status === "live"
                  ? "border-destructive/60 shadow-[0_0_24px_-6px_oklch(0.65_0.18_25/0.55)]"
                  : m.status === "done"
                  ? "border-gold/30"
                  : "border-border/60";
              const row = (name: string, score?: string, win?: boolean) => (
                <div
                  className={`flex items-center justify-between px-3 py-2 text-sm ${
                    win ? "text-gold font-semibold" : "text-foreground/80"
                  }`}
                >
                  <span className="truncate max-w-[140px]">{name}</span>
                  <span className={`tabular-nums text-xs ml-2 ${win ? "text-gold" : "text-muted-foreground"}`}>
                    {score ?? "—"}
                  </span>
                </div>
              );
              return (
                <div key={m.id} className={`glass rounded-lg border ${liveCls} divide-y divide-border/40 relative`}>
                  {m.status === "live" && (
                    <span className="absolute -top-2 left-3 text-[9px] px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground uppercase tracking-widest">
                      Live
                    </span>
                  )}
                  {row(m.a, m.scoreA, m.winner === "A")}
                  {row(m.b, m.scoreB, m.winner === "B")}
                </div>
              );
            })}
          </div>
        ))}
        {champion && (
          <div className="flex flex-col justify-center min-w-[200px]">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold/80 text-center mb-2">Чемпион</div>
            <div className="glass rounded-xl border-2 border-gold/60 p-4 text-center shadow-gold animate-gold-pulse">
              <Trophy className="h-6 w-6 text-gold mx-auto mb-2" />
              <div className="font-display text-lg text-gradient-gold">{champion}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const sampleRounds: Round[] = [
  {
    title: "1/8 финал",
    matches: [
      { id: "m1", a: "Ә. Сәрсен", b: "Б. Темір", scoreA: "Ippon", scoreB: "—", winner: "A", status: "done" },
      { id: "m2", a: "Д. Нұрлан", b: "А. Қанат", scoreA: "Waza-ari", scoreB: "—", winner: "A", status: "done" },
      { id: "m3", a: "С. Бекзат", b: "М. Ержан", scoreA: "—", scoreB: "Ippon", winner: "B", status: "done" },
      { id: "m4", a: "Р. Дәурен", b: "Т. Олжас", scoreA: "Yuko", scoreB: "—", winner: "A", status: "done" },
    ],
  },
  {
    title: "Жартылай финал",
    matches: [
      { id: "s1", a: "Ә. Сәрсен", b: "Д. Нұрлан", scoreA: "2", scoreB: "1", status: "live" },
      { id: "s2", a: "М. Ержан", b: "Р. Дәурен", scoreA: "—", scoreB: "—", status: "next" },
    ],
  },
  {
    title: "Финал",
    matches: [{ id: "f1", a: "Жеңімпаз S1", b: "Жеңімпаз S2", status: "scheduled" }],
  },
];
