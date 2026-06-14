import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  if (issues.length === 0) {
    return <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">OK</span>;
  }
  return <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-200">{issues.length} {t("tournament.issues")}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const colorMap: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    REGISTRATION_OPEN: "bg-gold/15 text-gold border border-gold/30",
    REGISTRATION_CLOSED: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    IN_PROGRESS: "bg-destructive/20 text-destructive border border-destructive/40",
    COMPLETED: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    CANCELLED: "bg-muted text-muted-foreground",
    SUBMITTED: "bg-gold/15 text-gold border border-gold/30",
    APPROVED: "bg-emerald-500/15 text-emerald-300",
    REJECTED: "bg-destructive/15 text-destructive",
  };
  const cls = colorMap[status] ?? "bg-muted";
  const label = String(t(`status.${status}`, status));
  return <span className={`text-xs px-3 py-1 rounded-full ${cls}`}>{label}</span>;
}

export function WeighInStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const colorMap: Record<string, string> = {
    PENDING: "bg-muted text-muted-foreground",
    PASSED: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    FAILED_WEIGHT: "bg-destructive/15 text-destructive border border-destructive/30",
    FAILED_DOCUMENTS: "bg-destructive/15 text-destructive border border-destructive/30",
    ABSENT: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    WITHDRAWN: "bg-muted text-muted-foreground",
  };
  const cls = colorMap[status] ?? "bg-muted text-muted-foreground";
  const labelMap: Record<string, string> = {
    PENDING: t("weigh_in.status_pending"),
    PASSED: t("weigh_in.status_passed"),
    FAILED_WEIGHT: t("weigh_in.status_failed_weight"),
    FAILED_DOCUMENTS: t("weigh_in.status_failed_docs"),
    ABSENT: t("weigh_in.status_absent"),
    WITHDRAWN: t("weigh_in.status_withdrawn"),
  };
  const label = labelMap[status] ?? status;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${cls}`}>{label}</span>;
}

export function FormatBadge({ format }: { format: string }) {
  const m: Record<string, string> = {
    SE_IJF: "Olympic / IJF",
    ROUND_ROBIN: "Round-robin",
    MIXED: "Mixed",
  };
  return <span className="shrink-0 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-gold">{m[format] ?? format}</span>;
}

export function categoryTitle(c: any, t?: any): string {
  if (!c) return t ? t("common.category") : "Category";
  const custom = localizeName(c.name);
  if (custom) return custom;
  const gender = c.gender === "MALE"
    ? (t ? t("common.male") : "M")
    : (t ? t("tatami.female_short") : "F");
  const weightPart = weightLabel(c, t);
  return `${gender} ${c.ageMin}-${c.ageMax} ${t ? t("common.years_short") : "yrs"} ${weightPart}`;
}

export function validateApplicationEntry(entry: any, t?: any): string[] {
  const issues: string[] = [];
  const athlete = entry.athlete;
  const category = entry.category;
  if (!athlete || !category) return [t ? t("validate.incomplete_data") : "incomplete data"];

  if (athlete.gender !== category.gender) {
    issues.push(t ? t("validate.gender_mismatch") : "gender mismatch");
  }

  const age = athleteAge(athlete);
  if (age === null) {
    issues.push(t ? t("validate.no_age") : "no age");
  } else if (age < Number(category.ageMin) || age > Number(category.ageMax)) {
    issues.push(t ? `${t("validate.age")} ${age}, ${t("validate.need")} ${category.ageMin}-${category.ageMax}` : `age ${age}, need ${category.ageMin}-${category.ageMax}`);
  }

  const weight = Number(athlete.weightKg);
  const wMax = Number(category.weightMax);
  const wMin = Number(category.weightMin);
  // weightMax=999 означает открытую категорию (+): нижняя граница не ограничена сверху
  const isOpenCategory = wMax >= 999;
  if (!Number.isFinite(weight)) {
    issues.push(t ? t("validate.no_weight") : "no weight");
  } else if (weight <= wMin || (!isOpenCategory && weight > wMax)) {
    const rangeLabel = isOpenCategory
      ? `>${wMin} ${t ? t("common.kg") : "kg"}`
      : `(${wMin}, ${wMax}] ${t ? t("common.kg") : "kg"}`;
    issues.push(t
      ? `${t("validate.weight")} ${weight} ${t("common.kg")}, ${t("validate.need")} ${rangeLabel}`
      : `weight ${weight} kg, need ${rangeLabel}`);
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

export function weightLabel(c: any, t?: any): string {
  const kg = t ? t("common.kg") : "kg";
  const max = Number(c.weightMax);
  if (Number.isFinite(max) && max >= 100) return `+${Math.round(Number(c.weightMin))} ${kg}`;
  return `-${Math.round(max)} ${kg}`;
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

export function mapEmbedUrl(tourney: any): string {
  const coordinates = String(tourney.mapUrl ?? "").match(
    /(?:[?&](?:q|query)=|@)(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/,
  );
  if (coordinates) {
    return `https://maps.google.com/maps?q=${coordinates[1]},${coordinates[2]}&z=16&output=embed`;
  }
  const query = `${tourney.location}, ${tourney.city}`;
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

export function formatWeighIn(tourney: any, t?: any): string {
  const place = tourney.weighInLocation || (t ? t("tournament.no_location") : "—");
  const start = tourney.weighInStart ? new Date(tourney.weighInStart).toLocaleString() : "";
  const end = tourney.weighInEnd ? new Date(tourney.weighInEnd).toLocaleString() : "";
  const time = start && end ? `${start} — ${end}` : start || (t ? t("tournament.no_time") : "—");
  return `${place} · ${time}`;
}

export function localizeName(n: any): string { if (!n) return ""; if (typeof n === "string") return n; return n.kk || n.ru || n.en || ""; }

export function DurationEstimate({ categories, matches, tatamiCount }: { categories: any[]; matches: any[]; tatamiCount: number }) {
  const { t } = useTranslation();
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
  const durationStr = hours > 0 ? `~${hours} ${t("tournament.hours_short")} ${mins} ${t("tournament.min_short")}` : `~${mins} ${t("tournament.min_short")}`;

  return (
    <div className="mt-4 rounded-md border border-gold/30 bg-gold/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gold">
        <Clock className="h-4 w-4" />
        {t("tournament.est_duration")}: {durationStr}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {playable.length} {t("tatami.match_word")} · {tatamiCount} {t("common.tatami")}
        {maleCount > 0 && ` · ${t("common.male")}: ${maleCount}`}
        {femaleCount > 0 && ` · ${t("tatami.female_short")}: ${femaleCount}`}
      </div>
    </div>
  );
}
