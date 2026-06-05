import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  Phone,
  Search,
  ShieldCheck,
  //   UserRound,
  XCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import emblem from "@/assets/jcl-logo.jpeg";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";

export const Route = createFileRoute("/coach/onboarding")({
  head: () => ({ meta: [{ title: "Бастау — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachOnboarding />
    </ProtectedRoute>
  ),
});

const AGREED_KEY = "coach_rules_agreed";

const KZ_CITIES = [
  "Алматы",
  "Астана",
  "Шымкент",
  "Қарағанды",
  "Ақтөбе",
  "Тараз",
  "Павлодар",
  "Өскемен",
  "Семей",
  "Атырау",
  "Қостанай",
  "Орал",
  "Петропавл",
  "Қызылорда",
  "Ақтау",
  "Теміртау",
  "Түркістан",
  "Көкшетау",
  "Талдықорған",
  "Жезқазған",
  "Балқаш",
  "Рудный",
  "Қонаев",
  "Степногорск",
  "Екібастұз",
];

const INPUT_CLS =
  "w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm outline-none transition-colors focus:border-gold";

function CoachOnboarding() {
  const { t } = useTranslation();
  const { user, refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [savingPhone, setSavingPhone] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [agreed, setAgreed] = useState(() => Boolean(localStorage.getItem(AGREED_KEY)));
  const [done, setDone] = useState(false);

  const requestsQuery = useQuery({
    queryKey: ["coach-join-requests-onboarding"],
    queryFn: () => api.coachClubRequests.myList(),
    enabled: !!user,
    refetchInterval: (q) =>
      (q.state.data ?? []).some((r: any) => r.status === "PENDING") ? 15_000 : false,
  });

  const clubsQuery = useQuery({
    queryKey: ["clubs-coach-onboarding", search],
    queryFn: () => api.clubs.list({ search: search.trim() || undefined, limit: 8 }),
    enabled: !!user && search.trim().length >= 1,
  });

  const activeRequest = (requestsQuery.data ?? []).find(
    (r: any) => r.status === "PENDING" || r.status === "APPROVED",
  );

  const hasClubStep = Boolean(user?.clubId || activeRequest);
  const hasPhoneStep = Boolean(user?.phone || phone.trim());

  const requestClub = useMutation({
    mutationFn: (clubId: string) => api.clubs.coachJoinRequest(clubId),
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["coach-join-requests-onboarding"] });
    },
    onError: (e: any) =>
      setError(e instanceof ApiError ? e.message : t("coach_onboarding.request_error")),
  });

  const cancelRequest = useMutation({
    mutationFn: (id: string) => api.coachClubRequests.cancel(id),
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["coach-join-requests-onboarding"] });
    },
    onError: (e: any) =>
      setError(e instanceof ApiError ? e.message : t("coach_onboarding.cancel_error")),
  });

  const cancelRegistration = useMutation({
    mutationFn: () => api.auth.cancelRegistration(),
    onSuccess: async () => {
      await logout();
      navigate({ to: "/login" });
    },
    onError: (e: any) =>
      setError(e instanceof ApiError ? e.message : t("onboarding.cancel_registration_error")),
  });

  async function handleCancelRegistration() {
    if (!window.confirm(t("onboarding.cancel_registration_confirm"))) return;
    setError("");
    cancelRegistration.mutate();
  }

  async function savePhoneAndProceed() {
    if (!phone.trim()) return;
    setSavingPhone(true);
    try {
      await api.auth.updateProfile({ phone: phone.trim() });
      await refreshMe();
    } catch {
      // ignore — phone saved locally
    } finally {
      setSavingPhone(false);
    }
  }

  async function handleFinish() {
    if (!agreed) {
      setShowRulesModal(true);
      return;
    }
    if (phone.trim() && !user?.phone) {
      await savePhoneAndProceed();
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/coach" }), 1200);
  }

  // Auto-redirect when already fully set up
  useEffect(() => {
    if (user?.clubId && agreed && !done) {
      setDone(true);
      setTimeout(() => navigate({ to: "/coach" }), 500);
    }
  }, [user?.clubId, agreed, done, navigate]);

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
        <div className="text-xl font-bold text-foreground">{t("coach_onboarding.setup_done")}</div>
        <div className="text-sm text-muted-foreground animate-pulse">{t("common.loading")}</div>
      </div>
    );
  }

  const canFinish = hasClubStep && agreed;

  return (
    <div className="min-h-screen bg-background">
      {showRulesModal && (
        <RulesModal
          onAgree={() => {
            localStorage.setItem(AGREED_KEY, "1");
            setAgreed(true);
            setShowRulesModal(false);
          }}
          onClose={() => setShowRulesModal(false)}
        />
      )}

      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={emblem} alt="" className="h-10 w-10 rounded-xl" />
            <div>
              <div className="font-display text-lg font-bold">JUDO·ARENA</div>
              <div className="text-xs text-muted-foreground">{t("coach_onboarding.subtitle")}</div>
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

        <main className="grid flex-1 gap-6 lg:grid-cols-[0.78fr_1fr]">
          {/* Sidebar progress */}
          <aside className="rounded-xl border border-border bg-card p-5">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("coach_onboarding.welcome")}
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold">
                {user.name} {user.surname}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("coach_onboarding.description")}
              </p>
            </div>
            <div className="space-y-3">
              <StepRow
                number="1"
                title={t("coach_onboarding.step_phone")}
                done={Boolean(user?.phone || phone.trim())}
                hint={t("coach_onboarding.step_phone_hint")}
              />
              <StepRow
                number="2"
                title={t("coach_onboarding.step_club")}
                done={hasClubStep}
                hint={
                  user?.club
                    ? localizeName(user.club.name)
                    : activeRequest
                      ? t("coach_onboarding.request_pending")
                      : t("coach_onboarding.step_club_hint")
                }
              />
              <StepRow
                number="3"
                title={t("coach_onboarding.step_rules")}
                done={agreed}
                hint={t("coach_onboarding.step_rules_hint")}
              />
              <StepRow
                number="4"
                title={t("coach_onboarding.step_dashboard")}
                done={canFinish}
                disabled={!canFinish}
                hint={t("coach_onboarding.step_dashboard_hint")}
              />
            </div>
          </aside>

          <section className="space-y-5">
            {/* Step 1: Phone */}
            <div
              className={`rounded-xl border border-border bg-card p-5 ${hasPhoneStep ? "border-emerald-500/20" : ""}`}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold">
                    1. {t("coach_onboarding.phone_title")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("coach_onboarding.phone_desc")}
                  </p>
                </div>
              </div>
              {user?.phone ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/8 p-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span className="text-sm font-medium">{user.phone}</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 777 000 0000"
                    className={INPUT_CLS}
                  />
                  {phone.trim() && (
                    <button
                      type="button"
                      onClick={savePhoneAndProceed}
                      disabled={savingPhone}
                      className="shrink-0 rounded-lg bg-gradient-gold px-4 py-2.5 text-sm font-semibold text-gold-foreground shadow-gold disabled:opacity-50"
                    >
                      {savingPhone ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t("common.save")
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Club */}
            <ClubStep
              userClub={user.club ?? null}
              activeRequest={activeRequest}
              clubs={search.trim().length >= 1 ? (clubsQuery.data?.items ?? []) : []}
              loading={search.trim().length >= 1 && clubsQuery.isLoading}
              search={search}
              setSearch={setSearch}
              requestClub={(id) => requestClub.mutate(id)}
              cancelRequest={(id) => cancelRequest.mutate(id)}
              busy={requestClub.isPending || cancelRequest.isPending}
              onClubCreated={async () => {
                await qc.invalidateQueries({ queryKey: ["coach-join-requests-onboarding"] });
                await refreshMe();
              }}
            />

            {/* Step 3: Responsibility */}
            <div
              className={`rounded-xl border bg-card p-5 transition ${agreed ? "border-emerald-500/20" : "border-border"}`}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold">
                    3. {t("coach_onboarding.rules_title")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("coach_onboarding.rules_desc")}
                  </p>
                </div>
              </div>
              {agreed ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/8 p-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span className="text-sm font-medium">
                    {t("coach_onboarding.rules_accepted")}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowRulesModal(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-300 hover:bg-amber-500/15"
                >
                  <AlertTriangle className="h-4 w-4" />
                  {t("coach_onboarding.rules_review_btn")}
                </button>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Finish */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleFinish}
                disabled={!canFinish}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-6 py-3 text-sm font-semibold text-gold-foreground shadow-gold disabled:opacity-40 transition"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t("coach_onboarding.go_dashboard")}
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function RulesModal({ onAgree, onClose }: { onAgree: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const ruleKeys = [
    "coach_onboarding.rule_1",
    "coach_onboarding.rule_2",
    "coach_onboarding.rule_3",
    "coach_onboarding.rule_4",
    "coach_onboarding.rule_5",
  ] as const;

  const ruleIcons = ["🤝", "🔇", "⚖️", "👥", "🚫"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl"
        style={{ animation: "scale-in 0.2s ease" }}
      >
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            <h2 className="font-display text-lg font-bold">{t("coach_onboarding.modal_title")}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-6 py-5 text-sm leading-relaxed space-y-4">
          <p className="text-muted-foreground">{t("coach_onboarding.modal_intro")}</p>
          <ul className="space-y-3">
            {ruleKeys.map((key, i) => (
              <li key={key} className="flex gap-3">
                <span className="text-lg leading-none shrink-0 mt-0.5">{ruleIcons[i]}</span>
                <span className="text-foreground">{t(key)}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 p-3">
            <p className="text-amber-200 text-xs">{t("coach_onboarding.modal_warning")}</p>
          </div>
        </div>

        <div className="border-t border-border/50 px-6 py-4 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${checked ? "border-gold bg-gold/20" : "border-border group-hover:border-gold/50"}`}
            >
              {checked && <CheckCircle2 className="h-3.5 w-3.5 text-gold" />}
            </div>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="sr-only"
            />
            <span className="text-sm">{t("coach_onboarding.modal_agree_label")}</span>
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onAgree}
              disabled={!checked}
              className="flex-1 rounded-lg bg-gradient-gold py-2.5 text-sm font-semibold text-gold-foreground shadow-gold disabled:opacity-40 transition"
            >
              {t("coach_onboarding.modal_accept_btn")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
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
  onClubCreated,
}: {
  userClub: { id: string; name: any; city: string } | null;
  activeRequest?: any;
  clubs: any[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  requestClub: (id: string) => void;
  cancelRequest: (id: string) => void;
  busy: boolean;
  onClubCreated: () => void;
}) {
  const { t } = useTranslation();
  const locked = Boolean(userClub || activeRequest);
  const [tab, setTab] = useState<"join" | "create">("join");
  const [form, setForm] = useState({ nameKk: "", nameRu: "", city: "", country: "KZ" });
  const [createError, setCreateError] = useState("");
  const { refreshMe } = useAuth();

  const createClub = useMutation({
    mutationFn: () =>
      api.clubs.create({
        name: { kk: form.nameKk.trim(), ru: form.nameRu.trim() || form.nameKk.trim() },
        city: form.city.trim(),
        country: form.country || "KZ",
      }),
    onSuccess: async () => {
      setCreateError("");
      await refreshMe();
      onClubCreated();
    },
    onError: (e: any) =>
      setCreateError(e instanceof ApiError ? e.message : t("coach_onboarding.create_club_error")),
  });

  return (
    <div
      className={`rounded-xl border bg-card p-5 ${locked ? "border-emerald-500/20" : "border-border"}`}
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold">2. {t("coach_onboarding.step_club")}</h2>
          <p className="text-sm text-muted-foreground">{t("coach_onboarding.club_desc")}</p>
        </div>
      </div>

      {userClub ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/8 p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <div className="text-sm font-semibold">{localizeName(userClub.name)}</div>
            <div className="text-xs text-muted-foreground">{userClub.city}</div>
          </div>
        </div>
      ) : activeRequest ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/25 bg-gold/8 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-gold shrink-0" />
            <div>
              <div className="text-sm font-semibold">{localizeName(activeRequest.club?.name)}</div>
              <div className="text-xs text-muted-foreground">
                {activeRequest.club?.city ?? ""} · {t("coach_onboarding.request_pending")}
              </div>
            </div>
          </div>
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
          {/* Tabs */}
          <div className="mb-4 flex gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
            {(
              [
                ["join", t("coach_onboarding.tab_join")],
                ["create", t("coach_onboarding.tab_create")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition ${
                  tab === id
                    ? "bg-gradient-gold text-gold-foreground shadow-gold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "join" ? (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("coach_onboarding.search_placeholder")}
                  className={`${INPUT_CLS} pl-9`}
                />
              </div>
              {search.trim().length < 1 ? (
                <div className="rounded-lg border border-border/40 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                  {t("coach_onboarding.search_hint")}
                </div>
              ) : loading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" />
                  {t("coach_onboarding.searching")}
                </div>
              ) : clubs.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {t("coach_onboarding.not_found")}{" "}
                  <button
                    type="button"
                    onClick={() => setTab("create")}
                    className="text-gold underline underline-offset-2"
                  >
                    {t("coach_onboarding.tab_create")}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {clubs.map((club) => (
                    <div
                      key={club.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-input/35 p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {localizeName(club.name)}
                        </div>
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
                  ))}
                </div>
              )}
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createClub.mutate();
              }}
              className="space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("coach_onboarding.name_kk_label")}
                  </label>
                  <input
                    required
                    value={form.nameKk}
                    onChange={(e) => setForm({ ...form, nameKk: e.target.value })}
                    placeholder="Алматы Дзюдо"
                    className={`mt-1.5 ${INPUT_CLS}`}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("coach_onboarding.name_ru_label")}
                  </label>
                  <input
                    value={form.nameRu}
                    onChange={(e) => setForm({ ...form, nameRu: e.target.value })}
                    placeholder="Алматы Дзюдо (рус)"
                    className={`mt-1.5 ${INPUT_CLS}`}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("common.city")}
                  </label>
                  <select
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className={`mt-1.5 ${INPUT_CLS}`}
                  >
                    <option value="">Қаланы таңдаңыз</option>
                    {KZ_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("coach_onboarding.country_label")}
                  </label>
                  <input
                    value={form.country}
                    maxLength={2}
                    onChange={(e) =>
                      setForm({ ...form, country: e.target.value.toUpperCase().slice(0, 2) })
                    }
                    className={`mt-1.5 ${INPUT_CLS}`}
                  />
                </div>
              </div>
              {createError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {createError}
                </div>
              )}
              <button
                type="submit"
                disabled={createClub.isPending || !form.nameKk.trim() || !form.city.trim()}
                className="w-full rounded-lg bg-gradient-gold py-2.5 text-sm font-semibold text-gold-foreground shadow-gold disabled:opacity-40 inline-flex items-center justify-center gap-2"
              >
                {createClub.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
                {t("coach_onboarding.create_and_own")}
              </button>
            </form>
          )}
        </>
      )}
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
      className={`flex gap-3 rounded-lg border p-3 transition ${disabled ? "opacity-50" : ""} ${done ? "border-emerald-500/30 bg-emerald-500/8" : "border-border bg-muted/25"}`}
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

function localizeName(n: any): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}
