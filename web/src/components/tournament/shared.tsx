import { Clock } from "lucide-react";

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

export function Input({ label, value, onChange, className = "", ...rest }: any) {
  return (
    <div className={className}>
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
        className="mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
    </div>
  );
}

export function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
      >
        {options.map(([v, labelText]) => <option key={v} value={v}>{labelText}</option>)}
      </select>
    </div>
  );
}

export function ApplicationMetric({ label, value, tone }: { label: string; value: string | number; tone?: "gold" | "green" | "red" }) {
  const toneClass = tone === "gold"
    ? "text-gold"
    : tone === "green"
      ? "text-emerald-300"
      : tone === "red"
        ? "text-destructive"
        : "text-foreground";

  return (
    <div className="rounded-md border border-border/60 bg-background/30 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

export function EntryCheckBadge({ issues }: { issues: string[] }) {
  if (issues.length === 0) {
    return <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">OK</span>;
  }
  return <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-200">{issues.length} мәселе</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { c: string; l: string }> = {
    DRAFT: { c: "bg-muted text-muted-foreground", l: "Жоба" },
    REGISTRATION_OPEN: { c: "bg-gold/15 text-gold border border-gold/30", l: "Тіркеу ашық" },
    REGISTRATION_CLOSED: { c: "bg-amber-500/15 text-amber-300 border border-amber-500/30", l: "Тіркеу жабық" },
    IN_PROGRESS: { c: "bg-destructive/20 text-destructive border border-destructive/40", l: "LIVE" },
    COMPLETED: { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", l: "Аяқталды" },
    CANCELLED: { c: "bg-muted text-muted-foreground", l: "Тоқтатылды" },
    SUBMITTED: { c: "bg-gold/15 text-gold border border-gold/30", l: "Қарауда" },
    APPROVED: { c: "bg-emerald-500/15 text-emerald-300", l: "Бекітілді" },
    REJECTED: { c: "bg-destructive/15 text-destructive", l: "Қайтарылды" },
  };
  const x = m[status] ?? { c: "bg-muted", l: status };
  return <span className={`text-xs px-3 py-1 rounded-full ${x.c}`}>{x.l}</span>;
}

export function WeighInStatusBadge({ status }: { status: string }) {
  const m: Record<string, { c: string; l: string }> = {
    PENDING: { c: "bg-muted text-muted-foreground", l: "Күтуде" },
    PASSED: { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", l: "Допуск" },
    FAILED_WEIGHT: { c: "bg-destructive/15 text-destructive border border-destructive/30", l: "Вес өтпеді" },
    FAILED_DOCUMENTS: { c: "bg-destructive/15 text-destructive border border-destructive/30", l: "Құжат" },
    ABSENT: { c: "bg-amber-500/15 text-amber-300 border border-amber-500/30", l: "Келмеді" },
    WITHDRAWN: { c: "bg-muted text-muted-foreground", l: "Снято" },
  };
  const x = m[status] ?? { c: "bg-muted text-muted-foreground", l: status };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${x.c}`}>{x.l}</span>;
}

export function FormatBadge({ format }: { format: string }) {
  const m: Record<string, string> = {
    SE_IJF: "Olympic / IJF",
    ROUND_ROBIN: "Round-robin",
    MIXED: "Mixed",
  };
  return <span className="shrink-0 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-gold">{m[format] ?? format}</span>;
}

export function categoryTitle(c: any): string {
  if (!c) return "Санат";
  const custom = localizeName(c.name);
  if (custom) return custom;
  return `${c.gender === "MALE" ? "Ер" : "Қыз"} ${c.ageMin}-${c.ageMax} жас ${c.weightMin}-${c.weightMax} кг`;
}

export function validateApplicationEntry(entry: any): string[] {
  const issues: string[] = [];
  const athlete = entry.athlete;
  const category = entry.category;
  if (!athlete || !category) return ["дерек толық емес"];

  if (athlete.gender !== category.gender) {
    issues.push("жыныс сәйкес емес");
  }

  const age = athleteAge(athlete);
  if (age === null) {
    issues.push("жасы жоқ");
  } else if (age < Number(category.ageMin) || age > Number(category.ageMax)) {
    issues.push(`жас ${age}, керек ${category.ageMin}-${category.ageMax}`);
  }

  const weight = Number(athlete.weightKg);
  if (!Number.isFinite(weight)) {
    issues.push("салмақ жоқ");
  } else if (weight <= Number(category.weightMin) || weight > Number(category.weightMax)) {
    issues.push(`салмақ ${weight} кг, керек (${category.weightMin}, ${category.weightMax}]`);
  }

  return issues;
}

export function athleteAge(athlete: any): number | null {
  if (!athlete?.dateOfBirth) return null;
  const dob = new Date(athlete.dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const birthdayPassed = now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

export function weightLabel(c: any): string {
  const max = Number(c.weightMax);
  if (Number.isFinite(max) && max >= 100) return `+${Math.round(Number(c.weightMin))} кг`;
  return `-${Math.round(max)} кг`;
}

export function compactI18n(value: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, item.trim()])
      .filter(([, item]) => item),
  );
}

export function toDateTimeLocal(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function mapEmbedUrl(t: any): string {
  const query = `${t.location}, ${t.city}`;
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

export function formatWeighIn(t: any): string {
  const place = t.weighInLocation || "орын көрсетілмеген";
  const start = t.weighInStart ? new Date(t.weighInStart).toLocaleString("kk-KZ") : "";
  const end = t.weighInEnd ? new Date(t.weighInEnd).toLocaleString("kk-KZ") : "";
  const time = start && end ? `${start} — ${end}` : start || "уақыт көрсетілмеген";
  return `${place} · ${time}`;
}

export function localizeName(n: any): string { if (!n) return ""; if (typeof n === "string") return n; return n.kk || n.ru || n.en || ""; }

export function DurationEstimate({ categories, matches, tatamiCount }: { categories: any[]; matches: any[]; tatamiCount: number }) {
  const playable = matches.filter((m: any) => m.redAthlete && m.blueAthlete && m.status !== "CANCELLED");
  if (playable.length === 0) return null;

  const catDurations = new Map<string, number>();
  for (const c of categories) {
    catDurations.set(c.id, (c.matchDurationSec ?? 240) / 60);
  }

  let maleCount = 0;
  let femaleCount = 0;
  let totalMatchMinutes = 0;
  const bufferPerMatch = 2;

  for (const m of playable) {
    const catId = m.bracket?.categoryId || m.bracket?.category?.id;
    const cat = m.bracket?.category;
    const matchDur = catDurations.get(catId) ?? 4;
    totalMatchMinutes += matchDur + bufferPerMatch;
    if (cat?.gender === "MALE") maleCount++;
    else femaleCount++;
  }

  const estimatedMinutes = Math.ceil(totalMatchMinutes / tatamiCount);
  const hours = Math.floor(estimatedMinutes / 60);
  const mins = estimatedMinutes % 60;
  const durationStr = hours > 0 ? `~${hours} сағ ${mins} мин` : `~${mins} мин`;

  return (
    <div className="mt-4 rounded-md border border-gold/30 bg-gold/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gold">
        <Clock className="h-4 w-4" />
        Шамамен ұзақтығы: {durationStr}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {playable.length} матч · {tatamiCount} татами
        {maleCount > 0 && ` · Ер: ${maleCount}`}
        {femaleCount > 0 && ` · Қыз: ${femaleCount}`}
      </div>
    </div>
  );
}
