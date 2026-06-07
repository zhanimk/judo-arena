import { createFileRoute } from "@tanstack/react-router";
import {
  DashboardShell,
  Panel,
  EmptyState,
  TableSkeleton,
} from "@/components/dashboard/DashboardShell";
import {
  UserPlus,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  SlidersHorizontal,
  Scale,
  CalendarDays,
  Users,
} from "lucide-react";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { useMemo, useState, type InputHTMLAttributes } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/coach/athletes")({
  head: () => ({ meta: [{ title: "Спортшылар — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachAthletes />
    </ProtectedRoute>
  ),
});

function CoachAthletes() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const clubId = user?.clubId;
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<"ALL" | "MALE" | "FEMALE">("ALL");
  const [sortBy, setSortBy] = useState<"ageWeight" | "weight" | "name">("ageWeight");

  const membersQuery = useQuery({
    queryKey: ["club-members", clubId],
    queryFn: () => (clubId ? api.clubs.members(clubId) : []),
    enabled: !!clubId,
  });

  const requestsQuery = useQuery({
    queryKey: ["coach-join-requests"],
    queryFn: () => api.joinRequests.coachList(),
    enabled: !!clubId,
    refetchInterval: 30_000,
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api.joinRequests.review(id, approve),
    onSuccess: (_data, { approve }) => {
      qc.invalidateQueries({ queryKey: ["coach-join-requests"] });
      qc.invalidateQueries({ queryKey: ["club-members", clubId] });
      toast.success(approve ? t("coach.athlete_accepted") : t("coach.request_declined"));
    },
    onError: () => toast.error(t("error.generic")),
  });

  const pendingRequests = requestsQuery.data ?? [];
  const athletes = useMemo(
    () => (membersQuery.data ?? []).filter((m: any) => m.role === "ATHLETE"),
    [membersQuery.data],
  );

  const visibleAthletes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return athletes
      .filter((a: any) => {
        if (gender !== "ALL" && a.gender !== gender) return false;
        if (!q) return true;
        const haystack =
          `${a.name ?? ""} ${a.surname ?? ""} ${a.email ?? ""} ${a.beltRank ?? ""}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a: any, b: any) => compareAthletes(a, b, sortBy));
  }, [athletes, gender, search, sortBy]);

  const stats = useMemo(() => getAthleteStats(athletes), [athletes]);

  return (
    <DashboardShell role={t("roles.COACH")} navItems={nav} accentTitle={t("coach.my_athletes")}>
      <div className="space-y-6">
        {/* Incoming join requests */}
        {pendingRequests.length > 0 && (
          <Panel
            title={
              <span className="flex items-center gap-2">
                {t("coach.join_requests")}
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-navy-deep">
                  {pendingRequests.length}
                </span>
              </span>
            }
          >
            <div className="mt-2 space-y-2">
              {pendingRequests.map((r: any) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gold/15 bg-gold/5 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/15 text-sm font-bold text-gold">
                      {r.athlete?.surname?.[0]}
                      {r.athlete?.name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {r.athlete?.surname} {r.athlete?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.athlete?.gender === "MALE" ? t("common.male") : t("common.female")}
                        {r.athlete?.weightKg ? ` · ${r.athlete.weightKg} кг` : ""}
                        {r.athlete?.dateOfBirth
                          ? ` · ${getAge(r.athlete.dateOfBirth)} ${t("common.years_short")}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => reviewMut.mutate({ id: r.id, approve: true })}
                      disabled={reviewMut.isPending}
                      className="flex items-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t("common.approve")}
                    </button>
                    <button
                      onClick={() => reviewMut.mutate({ id: r.id, approve: false })}
                      disabled={reviewMut.isPending}
                      className="flex items-center gap-1.5 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" /> {t("common.reject")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Athletes list */}
        <Panel
          title={`${t("common.all")} ${athletes.length}`}
          action={
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-1.5 text-sm bg-gradient-gold text-gold-foreground px-3 py-1.5 rounded-md shadow-gold"
            >
              <UserPlus className="h-4 w-4" /> {showForm ? t("common.close") : t("common.add")}
            </button>
          }
        >
          {showForm && clubId && (
            <AddAthleteForm
              clubId={clubId}
              onDone={() => {
                setShowForm(false);
                qc.invalidateQueries({ queryKey: ["club-members", clubId] });
              }}
            />
          )}

          {membersQuery.isLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : athletes.length === 0 ? (
            <EmptyState title={t("coach.no_athletes")} hint={t("coach.invite_athlete")} />
          ) : (
            <AthletesBoard
              athletes={visibleAthletes}
              total={athletes.length}
              stats={stats}
              search={search}
              gender={gender}
              sortBy={sortBy}
              onSearch={setSearch}
              onGender={setGender}
              onSort={setSortBy}
            />
          )}
        </Panel>
      </div>
    </DashboardShell>
  );
}

function AthletesBoard({
  athletes,
  total,
  stats,
  search,
  gender,
  sortBy,
  onSearch,
  onGender,
  onSort,
}: {
  athletes: any[];
  total: number;
  stats: ReturnType<typeof getAthleteStats>;
  search: string;
  gender: "ALL" | "MALE" | "FEMALE";
  sortBy: "ageWeight" | "weight" | "name";
  onSearch: (value: string) => void;
  onGender: (value: "ALL" | "MALE" | "FEMALE") => void;
  onSort: (value: "ageWeight" | "weight" | "name") => void;
}) {
  const { t } = useTranslation();
  const groups = useMemo(() => groupByAgeBand(athletes, t), [athletes, t]);

  return (
    <div className="mt-4 space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <MiniMetric icon={Users} label={t("coach.stat_athletes")} value={String(total)} />
        <MiniMetric
          icon={CalendarDays}
          label={t("coach.avg_age")}
          value={stats.avgAge ? `${stats.avgAge} ${t("common.years_short")}` : "—"}
        />
        <MiniMetric
          icon={Scale}
          label={t("coach.avg_weight")}
          value={stats.avgWeight ? `${stats.avgWeight} кг` : "—"}
        />
        <MiniMetric
          icon={Users}
          label={`${t("common.male")} / ${t("common.female")}`}
          value={`${stats.male} / ${stats.female}`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_220px_220px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("coach.athlete_search_placeholder")}
            className="h-10 w-full rounded-md border border-border bg-input pl-9 pr-3 text-sm outline-none focus:border-gold"
          />
        </label>

        <Segmented
          value={gender}
          options={[
            ["ALL", t("common.all")],
            ["MALE", t("common.male")],
            ["FEMALE", t("common.female")],
          ]}
          onChange={(v) => onGender(v as "ALL" | "MALE" | "FEMALE")}
        />

        <label className="relative">
          <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => onSort(e.target.value as "ageWeight" | "weight" | "name")}
            className="h-10 w-full appearance-none rounded-md border border-border bg-input pl-9 pr-3 text-sm outline-none focus:border-gold"
          >
            <option value="ageWeight">{t("coach.sort_age_weight")}</option>
            <option value="weight">{t("coach.sort_weight")}</option>
            <option value="name">{t("coach.sort_name")}</option>
          </select>
        </label>
      </div>

      {athletes.length === 0 ? (
        <EmptyState title={t("coach.no_matching_athletes")} hint={t("coach.change_filter")} />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section
              key={group.key}
              className="rounded-xl border border-border/60 bg-background/25 overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-muted/25 px-4 py-3">
                <div>
                  <h3 className="font-display text-base font-semibold">{group.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {group.items.length} {t("coach.stat_athletes").toLowerCase()} ·{" "}
                    {group.weightRange}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.weightBuckets.map((bucket) => (
                    <span
                      key={bucket.label}
                      className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground"
                    >
                      {bucket.label}: <b className="text-foreground">{bucket.count}</b>
                    </span>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-border/35">
                {group.items.map((a: any) => (
                  <AthleteRow key={a.id} athlete={a} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function AthleteRow({ athlete }: { athlete: any }) {
  const { t } = useTranslation();
  const age = athlete.dateOfBirth ? getAge(athlete.dateOfBirth) : null;
  return (
    <Link
      to="/coach/athletes/$id"
      params={{ id: athlete.id }}
      className="grid gap-3 px-4 py-3 text-sm transition-colors hover:bg-gold/5 md:grid-cols-[minmax(180px,1.3fr)_90px_100px_110px_1fr]"
    >
      <div className="min-w-0">
        <div className="truncate font-semibold">
          {athlete.surname} {athlete.name}
        </div>
        <div className="truncate text-xs text-muted-foreground">{athlete.email}</div>
      </div>
      <Cell
        label={t("common.gender")}
        value={athlete.gender === "MALE" ? t("common.male") : t("common.female")}
      />
      <Cell label={t("common.age")} value={age ? `${age} ${t("common.years_short")}` : "—"} />
      <Cell
        label={t("common.weight")}
        value={athlete.weightKg ? `${athlete.weightKg} кг` : "—"}
        strong
      />
      <Cell label={t("common.belt")} value={athlete.beltRank ?? "—"} gold />
    </Link>
  );
}

function Cell({
  label,
  value,
  strong,
  gold,
}: {
  label: string;
  value: string;
  strong?: boolean;
  gold?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground md:hidden">
        {label}
      </div>
      <div className={`${strong ? "font-semibold" : ""} ${gold ? "text-gold" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function MiniMetric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-gold" />
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 rounded-md border border-border bg-input p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded px-2 py-1.5 text-xs font-medium transition-colors ${
            value === v ? "bg-gold/18 text-gold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function AddAthleteForm({ clubId, onDone }: { clubId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    surname: "",
    gender: "MALE" as "MALE" | "FEMALE",
    dateOfBirth: "",
    weightKg: "",
    beltRank: "",
  });
  const [error, setError] = useState("");
  const mut = useMutation({
    mutationFn: () =>
      api.clubs.addAthlete(clubId, {
        ...form,
        weightKg: Number(form.weightKg),
        dateOfBirth: new Date(form.dateOfBirth).toISOString(),
        preferredLocale: "kk",
      }),
    onSuccess: () => {
      toast.success(t("coach.athlete_added"));
      onDone();
    },
    onError: (e: any) => {
      const msg = e instanceof ApiError ? e.message : t("error.generic");
      setError(msg);
      toast.error(msg);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
      }}
      className="mt-4 mb-6 glass rounded-lg p-4 grid gap-3 md:grid-cols-2"
    >
      <Input
        label="Email"
        type="email"
        value={form.email}
        onChange={(v) => setForm({ ...form, email: v })}
        required
      />
      <Input
        label={t("coach.initial_password")}
        type="password"
        value={form.password}
        onChange={(v) => setForm({ ...form, password: v })}
        required
        minLength={8}
      />
      <Input
        label={t("common.name")}
        value={form.name}
        onChange={(v) => setForm({ ...form, name: v })}
        required
      />
      <Input
        label={t("common.surname")}
        value={form.surname}
        onChange={(v) => setForm({ ...form, surname: v })}
        required
      />
      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("common.gender")}
        </label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(["MALE", "FEMALE"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setForm({ ...form, gender: g })}
              className={`py-2 rounded-md text-sm border ${form.gender === g ? "bg-gold/15 text-gold border-gold/40" : "glass border-border"}`}
            >
              {g === "MALE" ? t("common.male") : t("common.female")}
            </button>
          ))}
        </div>
      </div>
      <Input
        label={t("auth.date_of_birth")}
        type="date"
        value={form.dateOfBirth}
        onChange={(v) => setForm({ ...form, dateOfBirth: v })}
        required
      />
      <Input
        label={`${t("common.weight")} (кг)`}
        type="number"
        step="0.1"
        value={form.weightKg}
        onChange={(v) => setForm({ ...form, weightKg: v })}
        required
      />
      <Input
        label={t("common.belt")}
        value={form.beltRank}
        onChange={(v) => setForm({ ...form, beltRank: v })}
        placeholder={t("coach.belt_placeholder")}
      />

      {error && <div className="md:col-span-2 text-sm text-destructive">{error}</div>}
      <button
        disabled={mut.isPending}
        type="submit"
        className="md:col-span-2 bg-gradient-gold text-gold-foreground py-2.5 rounded-md font-medium shadow-gold inline-flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("common.add")}
      </button>
    </form>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
};
function Input({ label, value, onChange, ...rest }: InputProps) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
        className="mt-1.5 w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
    </div>
  );
}

function getAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function compareAthletes(a: any, b: any, sortBy: "ageWeight" | "weight" | "name") {
  const ageA = a.dateOfBirth ? getAge(a.dateOfBirth) : 999;
  const ageB = b.dateOfBirth ? getAge(b.dateOfBirth) : 999;
  const weightA = Number(a.weightKg ?? 999);
  const weightB = Number(b.weightKg ?? 999);
  const nameA = `${a.surname ?? ""} ${a.name ?? ""}`;
  const nameB = `${b.surname ?? ""} ${b.name ?? ""}`;

  if (sortBy === "name") return nameA.localeCompare(nameB, "kk");
  if (sortBy === "weight")
    return weightA - weightB || ageA - ageB || nameA.localeCompare(nameB, "kk");
  return ageA - ageB || weightA - weightB || nameA.localeCompare(nameB, "kk");
}

function getAthleteStats(athletes: any[]) {
  const ages = athletes
    .map((a) => (a.dateOfBirth ? getAge(a.dateOfBirth) : null))
    .filter((v): v is number => v !== null);
  const weights = athletes
    .map((a) => Number(a.weightKg))
    .filter((v) => Number.isFinite(v) && v > 0);
  return {
    male: athletes.filter((a) => a.gender === "MALE").length,
    female: athletes.filter((a) => a.gender === "FEMALE").length,
    avgAge: ages.length ? Math.round(ages.reduce((s, v) => s + v, 0) / ages.length) : 0,
    avgWeight: weights.length
      ? Math.round((weights.reduce((s, v) => s + v, 0) / weights.length) * 10) / 10
      : 0,
  };
}

function groupByAgeBand(athletes: any[], t: (key: string) => string) {
  const bands = [
    { key: "u8", label: t("coach.age_band_u8"), min: 0, max: 7 },
    { key: "u10", label: t("coach.age_band_u10"), min: 8, max: 9 },
    { key: "u12", label: t("coach.age_band_u12"), min: 10, max: 11 },
    { key: "u14", label: t("coach.age_band_u14"), min: 12, max: 13 },
    { key: "u16", label: t("coach.age_band_u16"), min: 14, max: 15 },
    { key: "u18", label: t("coach.age_band_u18"), min: 16, max: 17 },
    { key: "senior", label: t("coach.age_band_senior"), min: 18, max: 99 },
    { key: "unknown", label: t("coach.age_band_unknown"), min: 100, max: 999 },
  ];

  return bands
    .map((band) => {
      const items = athletes.filter((a) => {
        const age = a.dateOfBirth ? getAge(a.dateOfBirth) : 999;
        return age >= band.min && age <= band.max;
      });
      return {
        ...band,
        items,
        weightRange: getWeightRange(items),
        weightBuckets: getWeightBuckets(items),
      };
    })
    .filter((band) => band.items.length > 0);
}

function getWeightRange(items: any[]) {
  const weights = items.map((a) => Number(a.weightKg)).filter((v) => Number.isFinite(v) && v > 0);
  if (weights.length === 0) return "—";
  return `${Math.min(...weights)}-${Math.max(...weights)} кг`;
}

function getWeightBuckets(items: any[]) {
  const buckets = [
    { label: "-30 кг", test: (w: number) => w > 0 && w <= 30 },
    { label: "31-45 кг", test: (w: number) => w > 30 && w <= 45 },
    { label: "46-60 кг", test: (w: number) => w > 45 && w <= 60 },
    { label: "61+ кг", test: (w: number) => w > 60 },
  ];
  return buckets
    .map((b) => ({ label: b.label, count: items.filter((a) => b.test(Number(a.weightKg))).length }))
    .filter((b) => b.count > 0);
}
