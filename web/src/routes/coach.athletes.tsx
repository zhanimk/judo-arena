import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState, TableSkeleton, CardListSkeleton } from "@/components/dashboard/DashboardShell";
import { UserPlus, Loader2, CheckCircle2, XCircle, Clock, Search, SlidersHorizontal, Scale, CalendarDays, Users } from "lucide-react";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { useMemo, useState, type InputHTMLAttributes } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/coach/athletes")({
  head: () => ({ meta: [{ title: "Спортшылар — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachAthletes />
    </ProtectedRoute>
  ),
});



function CoachAthletes() {
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
      toast.success(approve ? "Спортшы клубқа қабылданды ✓" : "Өтінім қабылданбады");
    },
    onError: () => toast.error("Кезде қате орын алды"),
  });

  const pendingRequests = requestsQuery.data ?? [];
  const athletes = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);

  const visibleAthletes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return athletes
      .filter((a: any) => {
        if (gender !== "ALL" && a.gender !== gender) return false;
        if (!q) return true;
        const haystack = `${a.name ?? ""} ${a.surname ?? ""} ${a.email ?? ""} ${a.beltRank ?? ""}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a: any, b: any) => compareAthletes(a, b, sortBy));
  }, [athletes, gender, search, sortBy]);

  const stats = useMemo(() => getAthleteStats(athletes), [athletes]);

  return (
    <DashboardShell role="Жаттықтырушы" navItems={nav} accentTitle="Менің спортшыларым">
      <div className="space-y-6">

        {/* Incoming join requests */}
        {pendingRequests.length > 0 && (
          <Panel
            title={
              <span className="flex items-center gap-2">
                Клубқа өтінімдер
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-navy-deep">
                  {pendingRequests.length}
                </span>
              </span>
            }
          >
            <div className="mt-2 space-y-2">
              {pendingRequests.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-gold/15 bg-gold/5 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/15 text-sm font-bold text-gold">
                      {r.athlete?.surname?.[0]}{r.athlete?.name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{r.athlete?.surname} {r.athlete?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.athlete?.gender === "MALE" ? "Ер" : "Әйел"}
                        {r.athlete?.weightKg ? ` · ${r.athlete.weightKg} кг` : ""}
                        {r.athlete?.dateOfBirth ? ` · ${getAge(r.athlete.dateOfBirth)} жас` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => reviewMut.mutate({ id: r.id, approve: true })}
                      disabled={reviewMut.isPending}
                      className="flex items-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Қабылдау
                    </button>
                    <button
                      onClick={() => reviewMut.mutate({ id: r.id, approve: false })}
                      disabled={reviewMut.isPending}
                      className="flex items-center gap-1.5 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Бас тарту
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Athletes list */}
        <Panel
          title={`Барлығы ${athletes.length}`}
          action={
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-1.5 text-sm bg-gradient-gold text-gold-foreground px-3 py-1.5 rounded-md shadow-gold"
            >
              <UserPlus className="h-4 w-4" /> {showForm ? "Жабу" : "Қосу"}
            </button>
          }
        >
          {showForm && clubId && (
            <AddAthleteForm clubId={clubId} onDone={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["club-members", clubId] }); }} />
          )}

          {membersQuery.isLoading ? <TableSkeleton rows={6} cols={5} /> :
            athletes.length === 0 ? (
              <EmptyState title="Спортшылар жоқ" hint="Алғашқы спортшыңызды қосыңыз" />
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
  const groups = useMemo(() => groupByAgeBand(athletes), [athletes]);

  return (
    <div className="mt-4 space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <MiniMetric icon={Users} label="Спортшылар" value={String(total)} />
        <MiniMetric icon={CalendarDays} label="Орташа жас" value={stats.avgAge ? `${stats.avgAge} жас` : "—"} />
        <MiniMetric icon={Scale} label="Орташа салмақ" value={stats.avgWeight ? `${stats.avgWeight} кг` : "—"} />
        <MiniMetric icon={Users} label="Ер / Әйел" value={`${stats.male} / ${stats.female}`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_220px_220px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Аты, тегі, email немесе белбеу"
            className="h-10 w-full rounded-md border border-border bg-input pl-9 pr-3 text-sm outline-none focus:border-gold"
          />
        </label>

        <Segmented
          value={gender}
          options={[
            ["ALL", "Барлығы"],
            ["MALE", "Ер"],
            ["FEMALE", "Әйел"],
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
            <option value="ageWeight">Жас → салмақ</option>
            <option value="weight">Салмақ бойынша</option>
            <option value="name">Аты-жөні бойынша</option>
          </select>
        </label>
      </div>

      {athletes.length === 0 ? (
        <EmptyState title="Сәйкес спортшы жоқ" hint="Іздеу немесе фильтрді өзгертіңіз" />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.key} className="rounded-xl border border-border/60 bg-background/25 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-muted/25 px-4 py-3">
                <div>
                  <h3 className="font-display text-base font-semibold">{group.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {group.items.length} спортшы · {group.weightRange}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.weightBuckets.map((bucket) => (
                    <span key={bucket.label} className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
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
  const age = athlete.dateOfBirth ? getAge(athlete.dateOfBirth) : null;
  return (
    <Link
      to="/coach/athletes/$id"
      params={{ id: athlete.id }}
      className="grid gap-3 px-4 py-3 text-sm transition-colors hover:bg-gold/5 md:grid-cols-[minmax(180px,1.3fr)_90px_100px_110px_1fr]"
    >
      <div className="min-w-0">
        <div className="truncate font-semibold">{athlete.surname} {athlete.name}</div>
        <div className="truncate text-xs text-muted-foreground">{athlete.email}</div>
      </div>
      <Cell label="Жыныс" value={athlete.gender === "MALE" ? "Ер" : "Әйел"} />
      <Cell label="Жасы" value={age ? `${age} жас` : "—"} />
      <Cell label="Салмақ" value={athlete.weightKg ? `${athlete.weightKg} кг` : "—"} strong />
      <Cell label="Белбеу" value={athlete.beltRank ?? "—"} gold />
    </Link>
  );
}

function Cell({ label, value, strong, gold }: { label: string; value: string; strong?: boolean; gold?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground md:hidden">{label}</div>
      <div className={`${strong ? "font-semibold" : ""} ${gold ? "text-gold" : "text-foreground"}`}>{value}</div>
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

function Segmented({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (value: string) => void }) {
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
  const [form, setForm] = useState({
    email: "", password: "", name: "", surname: "",
    gender: "MALE" as "MALE" | "FEMALE", dateOfBirth: "", weightKg: "", beltRank: "",
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
    onSuccess: () => { toast.success("Спортшы сәтті қосылды ✓"); onDone(); },
    onError: (e: any) => {
      const msg = e instanceof ApiError ? e.message : "Қате орын алды";
      setError(msg);
      toast.error(msg);
    },
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="mt-4 mb-6 glass rounded-lg p-4 grid gap-3 md:grid-cols-2">
      <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({...form, email: v})} required />
      <Input label="Бастапқы құпиясөз" type="password" value={form.password} onChange={(v) => setForm({...form, password: v})} required minLength={8} />
      <Input label="Аты" value={form.name} onChange={(v) => setForm({...form, name: v})} required />
      <Input label="Тегі" value={form.surname} onChange={(v) => setForm({...form, surname: v})} required />
      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground">Жыныс</label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(["MALE", "FEMALE"] as const).map((g) => (
            <button key={g} type="button" onClick={() => setForm({...form, gender: g})}
              className={`py-2 rounded-md text-sm border ${form.gender === g ? "bg-gold/15 text-gold border-gold/40" : "glass border-border"}`}>
              {g === "MALE" ? "Ер" : "Әйел"}
            </button>
          ))}
        </div>
      </div>
      <Input label="Туған күн" type="date" value={form.dateOfBirth} onChange={(v) => setForm({...form, dateOfBirth: v})} required />
      <Input label="Салмақ (кг)" type="number" step="0.1" value={form.weightKg} onChange={(v) => setForm({...form, weightKg: v})} required />
      <Input label="Белбеу" value={form.beltRank} onChange={(v) => setForm({...form, beltRank: v})} placeholder="мысалы 2 kyu" />

      {error && <div className="md:col-span-2 text-sm text-destructive">{error}</div>}
      <button disabled={mut.isPending} type="submit" className="md:col-span-2 bg-gradient-gold text-gold-foreground py-2.5 rounded-md font-medium shadow-gold inline-flex items-center justify-center gap-2 disabled:opacity-50">
        {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Қосу
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
      <input value={value} onChange={(e) => onChange(e.target.value)}
        {...rest}
        className="mt-1.5 w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:border-gold focus:outline-none" />
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
  if (sortBy === "weight") return weightA - weightB || ageA - ageB || nameA.localeCompare(nameB, "kk");
  return ageA - ageB || weightA - weightB || nameA.localeCompare(nameB, "kk");
}

function getAthleteStats(athletes: any[]) {
  const ages = athletes.map((a) => a.dateOfBirth ? getAge(a.dateOfBirth) : null).filter((v): v is number => v !== null);
  const weights = athletes.map((a) => Number(a.weightKg)).filter((v) => Number.isFinite(v) && v > 0);
  return {
    male: athletes.filter((a) => a.gender === "MALE").length,
    female: athletes.filter((a) => a.gender === "FEMALE").length,
    avgAge: ages.length ? Math.round(ages.reduce((s, v) => s + v, 0) / ages.length) : 0,
    avgWeight: weights.length ? Math.round((weights.reduce((s, v) => s + v, 0) / weights.length) * 10) / 10 : 0,
  };
}

function groupByAgeBand(athletes: any[]) {
  const bands = [
    { key: "u8", label: "U8 · 7 жасқа дейін", min: 0, max: 7 },
    { key: "u10", label: "U10 · 8-9 жас", min: 8, max: 9 },
    { key: "u12", label: "U12 · 10-11 жас", min: 10, max: 11 },
    { key: "u14", label: "U14 · 12-13 жас", min: 12, max: 13 },
    { key: "u16", label: "U16 · 14-15 жас", min: 14, max: 15 },
    { key: "u18", label: "U18 · 16-17 жас", min: 16, max: 17 },
    { key: "senior", label: "18+ · ересектер", min: 18, max: 99 },
    { key: "unknown", label: "Жасы көрсетілмеген", min: 100, max: 999 },
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
  if (weights.length === 0) return "салмақ көрсетілмеген";
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
