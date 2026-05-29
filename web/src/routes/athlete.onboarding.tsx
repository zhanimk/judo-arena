import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import emblem from "@/assets/jcl-logo.jpeg";
import { api, ApiError } from "@/lib/api";
import { isAthleteProfileComplete, useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";

export const Route = createFileRoute("/athlete/onboarding")({
  head: () => ({ meta: [{ title: "Бастау — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <AthleteOnboarding />
    </ProtectedRoute>
  ),
});

const INPUT_CLS =
  "w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm outline-none transition-colors focus:border-gold";

function AthleteOnboarding() {
  const { user, refreshMe } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const requestsQuery = useQuery({
    queryKey: ["my-join-requests"],
    queryFn: () => api.joinRequests.myList(),
    enabled: !!user,
    // Пока заявка PENDING — обновляем каждые 15 сек, чтобы тренер мог принять и атлет сразу увидел
    refetchInterval: (q) =>
      (q.state.data ?? []).some((r: any) => r.status === "PENDING") ? 15_000 : false,
  });

  const clubsQuery = useQuery({
    queryKey: ["clubs-onboarding", search],
    queryFn: () => api.clubs.list({ search: search.trim() || undefined, limit: 50 }),
    enabled: !!user,
  });

  const activeRequest = useMemo(
    () => (requestsQuery.data ?? []).find((r: any) => r.status === "PENDING" || r.status === "APPROVED"),
    [requestsQuery.data],
  );

  const hasClubStep = Boolean(user?.clubId || activeRequest);
  const hasProfileStep = isAthleteProfileComplete(user ?? null);

  const requestClub = useMutation({
    mutationFn: (clubId: string) => api.clubs.joinRequest(clubId),
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["my-join-requests"] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Өтінім жіберілмеді"),
  });

  const cancelRequest = useMutation({
    mutationFn: (id: string) => api.joinRequests.cancel(id),
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["my-join-requests"] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Өтінім тоқтатылмады"),
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 ring-4 ring-emerald-500/30 animate-scale-in">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>
        <div className="text-xl font-bold text-foreground">Кабинет дайын!</div>
        <div className="text-sm text-muted-foreground animate-pulse">Жүктелуде...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={emblem} alt="" className="h-10 w-10 rounded-xl" />
            <div>
              <div className="font-display text-lg font-bold">JUDO·ARENA</div>
              <div className="text-xs text-muted-foreground">Спортшыны бастапқы баптау</div>
            </div>
          </div>
        </header>

        <main className="grid flex-1 gap-6 lg:grid-cols-[0.78fr_1fr]">
          <aside className="rounded-xl border border-border bg-card p-5">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Қош келдіңіз</p>
              <h1 className="mt-2 font-display text-2xl font-bold">
                {user.name} {user.surname}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Кабинет ашылу үшін алдымен клубқа өтінім жіберіп, спорттық деректерді толтырыңыз.
              </p>
            </div>

            <div className="space-y-3">
              <StepRow
                number="1"
                title="Клуб таңдау"
                done={hasClubStep}
                hint={user.club ? localizeName(user.club.name) : activeRequest ? "Өтінім жіберілді" : "Бір клубқа ғана өтінім"}
              />
              <StepRow
                number="2"
                title="Профильді толтыру"
                done={hasProfileStep}
                disabled={!hasClubStep}
                hint="Жасы, жынысы, салмағы"
              />
              <StepRow
                number="3"
                title="Дэшборд"
                done={hasClubStep && hasProfileStep}
                disabled={!hasClubStep || !hasProfileStep}
                hint="Барлығы дайын болғанда ашылады"
              />
            </div>
          </aside>

          <section className="space-y-5">
            <ClubStep
              userClub={user.club}
              activeRequest={activeRequest}
              clubs={clubsQuery.data?.items ?? []}
              loading={clubsQuery.isLoading || requestsQuery.isLoading}
              search={search}
              setSearch={setSearch}
              requestClub={(id) => requestClub.mutate(id)}
              cancelRequest={(id) => cancelRequest.mutate(id)}
              busy={requestClub.isPending || cancelRequest.isPending}
            />

            <ProfileStep
              locked={!hasClubStep}
              user={user}
              onSaved={async () => {
                await refreshMe();
                setDone(true);
                setTimeout(() => navigate({ to: "/athlete" }), 1200);
              }}
            />

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function StepRow({
  number,
  title,
  hint,
  done,
  disabled,
}: {
  number: string;
  title: string;
  hint: string;
  done: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`flex gap-3 rounded-lg border p-3 ${disabled ? "opacity-50" : ""} ${done ? "border-emerald-500/30 bg-emerald-500/8" : "border-border bg-muted/25"}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-emerald-500 text-white" : "bg-gold/15 text-gold"}`}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : number}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

function ClubStep({
  userClub,
  activeRequest,
  clubs,
  loading,
  search,
  setSearch,
  requestClub,
  cancelRequest,
  busy,
}: {
  userClub?: { id: string; name: any; city: string } | null;
  activeRequest?: any;
  clubs: any[];
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  requestClub: (clubId: string) => void;
  cancelRequest: (requestId: string) => void;
  busy: boolean;
}) {
  const locked = Boolean(userClub || activeRequest);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold">1. Клуб таңдаңыз</h2>
          <p className="text-sm text-muted-foreground">Спортшы бір ғана клубта тұра алады.</p>
        </div>
      </div>

      {userClub ? (
        <StatusBox icon={<CheckCircle2 className="h-5 w-5" />} title={localizeName(userClub.name)} hint={`${userClub.city} · клубқа тіркелген`} tone="success" />
      ) : activeRequest ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/25 bg-gold/8 p-4">
          <StatusBox icon={<Clock className="h-5 w-5" />} title={localizeName(activeRequest.club?.name)} hint={`${activeRequest.club?.city ?? ""} · өтінім күтілуде`} tone="gold" unframed />
          <button
            onClick={() => cancelRequest(activeRequest.id)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            Өзгерту
          </button>
        </div>
      ) : (
        <>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Клуб атауы немесе қала"
              className={`${INPUT_CLS} pl-9`}
            />
          </div>
          <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Клубтар жүктелуде...</div>
            ) : clubs.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Клуб табылмады</div>
            ) : (
              clubs.map((club) => (
                <div key={club.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-input/35 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{localizeName(club.name)}</div>
                    <div className="text-xs text-muted-foreground">{club.city}</div>
                  </div>
                  <button
                    onClick={() => requestClub(club.id)}
                    disabled={busy || locked}
                    className="shrink-0 rounded-md bg-gradient-gold px-3 py-2 text-xs font-semibold text-gold-foreground shadow-gold disabled:opacity-50"
                  >
                    Өтінім жіберу
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ProfileStep({
  locked,
  user,
  onSaved,
}: {
  locked: boolean;
  user: { id: string; dateOfBirth?: string | null; gender?: "MALE" | "FEMALE" | null; weightKg?: number | null; beltRank?: string | null; phone?: string | null };
  onSaved: () => Promise<void>;
}) {
  const [dateOfBirth, setDateOfBirth] = useState(toDateInput(user.dateOfBirth));
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "">((user.gender ?? "") as "MALE" | "FEMALE" | "");
  const [weightKg, setWeightKg] = useState(user.weightKg ? String(user.weightKg) : "");
  const [beltRank, setBeltRank] = useState(user.beltRank ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () =>
      api.athletes.update(user.id, {
        dateOfBirth,
        gender,
        weightKg: Number(weightKg),
        beltRank: beltRank || undefined,
        phone: phone || undefined,
      }),
    onSuccess: () => onSaved(),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Профиль сақталмады"),
  });

  const disabled = locked || save.isPending;

  return (
    <div className={`rounded-xl border border-border bg-card p-5 ${locked ? "opacity-60" : ""}`}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
          <UserRound className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold">2. Профильді толтырыңыз</h2>
          <p className="text-sm text-muted-foreground">Телефон міндетті емес. Жарыс үшін жас, жыныс және салмақ керек.</p>
        </div>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          if (!dateOfBirth || !gender || !weightKg) {
            setError("Туған күн, жыныс және салмақ міндетті");
            return;
          }
          save.mutate();
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Туған күні</span>
          <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} disabled={disabled} className={INPUT_CLS} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Жынысы</span>
          <select value={gender} onChange={(e) => setGender(e.target.value as "MALE" | "FEMALE" | "")} disabled={disabled} className={INPUT_CLS} required>
            <option value="">Таңдау</option>
            <option value="MALE">Ер</option>
            <option value="FEMALE">Әйел</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Салмақ, кг</span>
          <input type="number" min="1" max="300" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} disabled={disabled} className={INPUT_CLS} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Белбеу</span>
          <input value={beltRank} onChange={(e) => setBeltRank(e.target.value)} disabled={disabled} placeholder="Мысалы: 5 kyu" className={INPUT_CLS} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs text-muted-foreground">Телефон, болса</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={disabled} placeholder="+7..." className={INPUT_CLS} />
        </label>

        {error && <div className="sm:col-span-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-4 py-2.5 text-sm font-semibold text-gold-foreground shadow-gold disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Сақтап, кабинетке өту
          </button>
        </div>
      </form>
    </div>
  );
}

function StatusBox({
  icon,
  title,
  hint,
  tone,
  unframed,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  tone: "success" | "gold";
  unframed?: boolean;
}) {
  const color = tone === "success" ? "text-emerald-400" : "text-gold";
  return (
    <div className={`flex items-center gap-3 ${unframed ? "" : "rounded-lg border border-emerald-500/20 bg-emerald-500/8 p-4"}`}>
      <div className={color}>{icon}</div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

function localizeName(n: any): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}

function toDateInput(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}
