import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
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
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import emblem from "@/assets/jcl-logo.jpeg";
import { api, ApiError } from "@/lib/api";
import type { Club, ClubJoinRequest } from "@/lib/api-types";
import { isAthleteProfileComplete, useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";

const BELT_RANKS = [
  { value: "6 КЮ", label: "6 КЮ — Ақ (Белый)", gradient: "from-zinc-100 to-zinc-300" },
  { value: "5 КЮ", label: "5 КЮ — Сары (Жёлтый)", gradient: "from-yellow-300 to-yellow-500" },
  {
    value: "4 КЮ",
    label: "4 КЮ — Қызғылт сары (Оранжевый)",
    gradient: "from-orange-400 to-orange-600",
  },
  { value: "3 КЮ", label: "3 КЮ — Жасыл (Зелёный)", gradient: "from-green-500 to-emerald-700" },
  { value: "2 КЮ", label: "2 КЮ — Көк (Синий)", gradient: "from-sky-500 to-blue-700" },
  { value: "1 КЮ", label: "1 КЮ — Қоңыр (Коричневый)", gradient: "from-amber-700 to-amber-950" },
  { value: "1 ДАН", label: "1 ДАН — Қара (Чёрный)", gradient: "from-gray-800 to-gray-950" },
  { value: "2 ДАН", label: "2 ДАН — Қара (Чёрный)", gradient: "from-gray-800 to-gray-950" },
  { value: "3 ДАН", label: "3 ДАН — Қара (Чёрный)", gradient: "from-gray-800 to-gray-950" },
  { value: "4 ДАН", label: "4 ДАН — Қара (Чёрный)", gradient: "from-gray-800 to-gray-950" },
  { value: "5 ДАН", label: "5 ДАН — Қара (Чёрный)", gradient: "from-gray-800 to-gray-950" },
];

export const Route = createFileRoute("/athlete/onboarding")({
  head: () => ({ meta: [{ title: "Бастау — Judo-Arena" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <AthleteOnboarding />
    </ProtectedRoute>
  ),
});

const INPUT_CLS =
  "w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm outline-none transition-colors focus:border-gold";

function AthleteOnboarding() {
  const { t } = useTranslation();
  const { user, refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const requestsQuery = useQuery({
    queryKey: ["my-join-requests"],
    queryFn: () => api.joinRequests.myList(),
    enabled: !!user,
    refetchInterval: (q) =>
      (q.state.data ?? []).some((r: { status: string }) => r.status === "PENDING") ? 15_000 : false,
  });

  const clubsQuery = useQuery({
    queryKey: ["clubs-onboarding", search],
    queryFn: () => api.clubs.list({ search: search.trim() || undefined, limit: 50 }),
    enabled: !!user,
  });

  const activeRequest = useMemo(
    () =>
      (requestsQuery.data ?? []).find(
        (r: { status: string }) => r.status === "PENDING" || r.status === "APPROVED",
      ),
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
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : t("athlete_onboarding.request_error")),
  });

  const cancelRequest = useMutation({
    mutationFn: (id: string) => api.joinRequests.cancel(id),
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["my-join-requests"] });
    },
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : t("athlete_onboarding.cancel_error")),
  });

  const cancelRegistration = useMutation({
    mutationFn: () => api.auth.cancelRegistration(),
    onSuccess: async () => {
      await logout();
      navigate({ to: "/login" });
    },
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : t("onboarding.cancel_registration_error")),
  });

  async function handleCancelRegistration() {
    if (!window.confirm(t("onboarding.cancel_registration_confirm"))) return;
    setError("");
    cancelRegistration.mutate();
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (done) {
    return <OnboardingSuccessScreen name={user.name} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={emblem} alt="" className="h-10 w-10 rounded-full object-cover" />
            <div>
              <div className="font-display text-lg font-bold">JUDO·ARENA</div>
              <div className="text-xs text-muted-foreground">
                {t("athlete_onboarding.subtitle")}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelRegistration}
            disabled={cancelRegistration.isPending}
            className="inline-flex items-center gap-2 rounded-md border border-destructive/35 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            {cancelRegistration.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            {t("onboarding.cancel_registration")}
          </button>
        </header>

        <main className="grid flex-1 gap-6 lg:grid-cols-[0.78fr_1fr] lg:items-start">
          <aside className="rounded-xl border border-border bg-card p-5">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("coach_onboarding.welcome")}
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold">
                {user.name} {user.surname}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("athlete_onboarding.description")}
              </p>
            </div>

            <div className="space-y-3">
              <StepRow
                number="1"
                title={t("athlete_onboarding.step_club")}
                done={hasClubStep}
                hint={
                  user.club
                    ? localizeName(user.club.name)
                    : activeRequest
                      ? t("coach_onboarding.request_pending")
                      : t("athlete_onboarding.step_club_hint")
                }
              />
              <StepRow
                number="2"
                title={t("athlete_onboarding.step_profile")}
                done={hasProfileStep}
                disabled={!hasClubStep}
                hint={t("athlete_onboarding.step_profile_hint")}
              />
              <StepRow
                number="3"
                title={t("coach_onboarding.step_dashboard")}
                done={hasClubStep && hasProfileStep}
                disabled={!hasClubStep || !hasProfileStep}
                hint={t("coach_onboarding.step_dashboard_hint")}
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
                setTimeout(() => navigate({ to: "/athlete" }), 3500);
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
    <div
      className={`flex gap-3 rounded-lg border p-3 ${disabled ? "opacity-50" : ""} ${done ? "border-emerald-500/30 bg-emerald-500/8" : "border-border bg-muted/25"}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-emerald-500 text-white" : "bg-gold/15 text-gold"}`}
      >
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
  userClub?: {
    id: string;
    name: import("@/lib/api-types").LocalizedName | string;
    city: string;
  } | null;
  activeRequest?: ClubJoinRequest | null;
  clubs: Club[];
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  requestClub: (clubId: string) => void;
  cancelRequest: (requestId: string) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const locked = Boolean(userClub || activeRequest);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold">
            1. {t("athlete_onboarding.club_title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("athlete_onboarding.club_desc")}</p>
        </div>
      </div>

      {userClub ? (
        <StatusBox
          icon={<CheckCircle2 className="h-5 w-5" />}
          title={localizeName(userClub.name)}
          hint={`${userClub.city} · ${t("athlete_onboarding.club_joined")}`}
          tone="success"
        />
      ) : activeRequest ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/25 bg-gold/8 p-4">
          <StatusBox
            icon={<Clock className="h-5 w-5" />}
            title={localizeName(activeRequest.club?.name)}
            hint={`${activeRequest.club?.city ?? ""} · ${t("coach_onboarding.request_pending")}`}
            tone="gold"
            unframed
          />
          <button
            onClick={() => cancelRequest(activeRequest.id)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            {t("coach_onboarding.change_club")}
          </button>
        </div>
      ) : (
        <>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("athlete_onboarding.club_search_placeholder")}
              className={`${INPUT_CLS} pl-9`}
            />
          </div>
          <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t("athlete_onboarding.clubs_loading")}
              </div>
            ) : clubs.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t("coach_onboarding.not_found")}
              </div>
            ) : (
              clubs.map((club) => (
                <div
                  key={club.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-input/35 p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{localizeName(club.name)}</div>
                    <div className="text-xs text-muted-foreground">{club.city}</div>
                  </div>
                  <button
                    onClick={() => requestClub(club.id)}
                    disabled={busy || locked}
                    className="shrink-0 rounded-md bg-gradient-gold px-3 py-2 text-xs font-semibold text-gold-foreground shadow-gold disabled:opacity-50"
                  >
                    {t("coach_onboarding.send_request")}
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
  user: {
    id: string;
    dateOfBirth?: string | null;
    gender?: "MALE" | "FEMALE" | null;
    weightKg?: number | null;
    beltRank?: string | null;
    phone?: string | null;
  };
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [dateOfBirth, setDateOfBirth] = useState(toDateInput(user.dateOfBirth));
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "">(
    (user.gender ?? "") as "MALE" | "FEMALE" | "",
  );
  const [weightKg, setWeightKg] = useState(user.weightKg ? String(user.weightKg) : "");
  const [beltRank, setBeltRank] = useState(user.beltRank ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () =>
      api.athletes.update(user.id, {
        dateOfBirth,
        gender: gender || null,
        weightKg: Number(weightKg),
        beltRank: beltRank || undefined,
        phone: phone || undefined,
      }),
    onSuccess: () => onSaved(),
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : t("athlete_onboarding.profile_save_error")),
  });

  const disabled = locked || save.isPending;

  return (
    <div className={`rounded-xl border border-border bg-card p-5 ${locked ? "opacity-60" : ""}`}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
          <UserRound className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold">
            2. {t("athlete_onboarding.profile_title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("athlete_onboarding.profile_desc")}</p>
        </div>
      </div>

      <form
        className="grid gap-3 grid-cols-1 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          if (!dateOfBirth || !gender || !weightKg) {
            setError(t("athlete_onboarding.profile_required_error"));
            return;
          }
          save.mutate();
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("athlete_onboarding.dob_label")}
          </span>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            disabled={disabled}
            className={INPUT_CLS}
            required
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">{t("common.gender")}</span>
          <div className="flex items-center gap-2">
            {gender && (
              <div
                className={`h-8 w-3 shrink-0 rounded-full ${gender === "MALE" ? "bg-sky-500" : "bg-pink-500"}`}
              />
            )}
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as "MALE" | "FEMALE" | "")}
              disabled={disabled}
              className={`${INPUT_CLS} flex-1`}
              required
            >
              <option value="">{t("common.select")}</option>
              <option value="MALE">{t("common.male")}</option>
              <option value="FEMALE">{t("common.female")}</option>
            </select>
          </div>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("athlete_onboarding.weight_label")}
          </span>
          <input
            type="number"
            min="1"
            max="300"
            step="0.1"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            disabled={disabled}
            className={INPUT_CLS}
            required
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">{t("common.belt")}</span>
          <div className="flex items-center gap-2">
            {beltRank && (
              <div
                className={`h-8 w-3 shrink-0 rounded-full bg-gradient-to-b ${BELT_RANKS.find((b) => b.value === beltRank)?.gradient ?? "from-zinc-300 to-zinc-500"}`}
              />
            )}
            <select
              value={beltRank}
              onChange={(e) => setBeltRank(e.target.value)}
              disabled={disabled}
              className={`${INPUT_CLS} flex-1`}
            >
              <option value="">{t("common.select")}</option>
              {BELT_RANKS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("athlete_onboarding.phone_label")}
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={disabled}
            placeholder="+7..."
            className={INPUT_CLS}
          />
        </label>

        {error && (
          <div className="sm:col-span-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-4 py-2.5 text-sm font-semibold text-gold-foreground shadow-gold disabled:opacity-50"
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {t("athlete_onboarding.save_btn")}
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
    <div
      className={`flex items-center gap-3 ${unframed ? "" : "rounded-lg border border-emerald-500/20 bg-emerald-500/8 p-4"}`}
    >
      <div className={color}>{icon}</div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

function OnboardingSuccessScreen({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex flex-col items-center justify-center">
      {/* Glow rings */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[420px] w-[420px] rounded-full border border-emerald-500/10 animate-ping-slow" />
        <div className="absolute h-[300px] w-[300px] rounded-full border border-emerald-500/15" />
        <div className="absolute h-[500px] w-[500px] rounded-full bg-emerald-500/4 blur-3xl" />
        <div className="absolute h-[300px] w-[300px] rounded-full bg-gold/4 blur-2xl" />
      </div>

      {/* Gold accent line top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold to-transparent" />

      {/* Main card */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
        {/* Icon */}
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/15 animate-pulse" />
          <div className="absolute inset-2 rounded-full bg-emerald-500/10 ring-2 ring-emerald-500/30" />
          <CheckCircle2 className="relative h-14 w-14 text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
        </div>

        {/* Texts */}
        <div className="space-y-2">
          <div className="font-display text-3xl font-black tracking-tight">
            {t("coach_onboarding.setup_done")}
          </div>
          <div className="text-base text-muted-foreground">
            {t("coach_onboarding.welcome")},{" "}
            <span className="font-semibold text-foreground">{name}</span>!
          </div>
        </div>

        {/* Animated progress bar */}
        <div className="w-48 h-1 rounded-full bg-border/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-gold"
            style={{ animation: "grow-bar 3.3s ease-in-out forwards" }}
          />
        </div>

        <div className="text-xs text-muted-foreground animate-pulse">{t("common.loading")}</div>
      </div>

      {/* Belt color stripes decoration */}
      <div className="absolute bottom-8 flex gap-2 opacity-30">
        {[
          "bg-zinc-300",
          "bg-yellow-400",
          "bg-orange-500",
          "bg-green-600",
          "bg-sky-500",
          "bg-amber-800",
          "bg-gray-900",
        ].map((c, i) => (
          <div key={i} className={`h-1.5 w-8 rounded-full ${c}`} />
        ))}
      </div>

      <style>{`
        @keyframes grow-bar { from { width: 0% } to { width: 100% } }
        @keyframes ping-slow { 0%,100%{transform:scale(1);opacity:.3} 50%{transform:scale(1.08);opacity:.1} }
        .animate-ping-slow { animation: ping-slow 2.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function localizeName(
  n: import("@/lib/api-types").LocalizedName | string | null | undefined,
): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}

function toDateInput(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}
