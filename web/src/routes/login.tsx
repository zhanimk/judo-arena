import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
const emblem = "/jcl-logo.jpg";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-store";
import { api, ApiError, setAccessToken } from "@/lib/api";
import {
  Lock,
  UserPlus,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  KeyRound,
  User,
  Shield,
  Trophy,
  ClipboardList,
  Medal,
  UsersRound,
  ArrowUpRight,
  Zap,
} from "lucide-react";
import { PasswordStrength, isPasswordStrong } from "@/components/ui/PasswordStrength";
import { RedirectIfAuthenticated } from "@/lib/protected-route";
import { LanguageSwitcher } from "@/components/site/LanguageSwitcher";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import type { Locale } from "@/lib/i18n";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Turnstile } from "@marsidev/react-turnstile";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Judo-Arena — вход и регистрация" }] }),
  errorComponent: RouteErrorUI,
  validateSearch: (search: Record<string, unknown>): { mode?: Mode } => ({
    mode: search.mode === "register" ? "register" : search.mode === "login" ? "login" : undefined,
  }),
  component: () => (
    <RedirectIfAuthenticated>
      <Login />
    </RedirectIfAuthenticated>
  ),
});

type Mode = "login" | "register";

const INPUT_CLS =
  "lp-input w-full rounded-xl border px-4 py-3 pl-11 text-sm transition-all focus:outline-none focus:ring-2 " +
  "focus:border-[#c8922a]/60 focus:ring-[#c8922a]/20";

function InputIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="lp-input-icon pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
      {children}
    </span>
  );
}

function Login() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>(search.mode ?? "login");
  const [role, setRole] = useState<"ATHLETE" | "COACH">("ATHLETE");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState("");
  // 2FA state
  const [totpChallenge, setTotpChallenge] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60);
    return () => clearInterval(id);
  }, []);
  void tick;

  const roleOptions = [
    {
      key: "ATHLETE" as const,
      label: t("roles.athlete"),
      icon: Medal,
      hint: t("athlete.register_cta"),
    },
    {
      key: "COACH" as const,
      label: t("roles.coach"),
      icon: ClipboardList,
      hint: t("coach.club_title"),
    },
  ];

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setConfirmPassword("");
  };

  const redirectToDashboard = (userRole: string, userClubId?: string | null) => {
    if (userRole === "ADMIN") navigate({ to: "/admin" });
    else if (userRole === "COACH") navigate({ to: userClubId ? "/coach" : "/coach/onboarding" });
    else navigate({ to: "/athlete/onboarding" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "register" && !turnstileToken && !isDev) {
      setError("Пожалуйста, подтвердите что вы не робот (Капча)");
      return;
    }
    if (mode === "register" && !isPasswordStrong(password)) {
      setError(t("auth.pwd_strength_weak"));
      return;
    }
    if (mode === "register" && !termsAccepted) {
      setError(t("auth.accept_terms_error", "Вы должны согласиться с условиями платформы"));
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError(t("auth.pwd_no_match") || "Құпиясөздер сәйкес келмейді");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        // Если уже в стадии 2FA challenge
        if (totpChallenge) {
          const result = await api.auth.twofa.challenge(totpChallenge, totpCode);
          setAccessToken((result as { accessToken: string }).accessToken);
          const { bootstrap, getCurrentUser } = await import("@/lib/auth-store");
          await bootstrap();
          const user = getCurrentUser();
          toast.success(`${t("auth.welcome_back")} 👋`);
          if (user) redirectToDashboard(user.role, user.clubId);
          return;
        }
        const result = await login(email, password);
        // Проверяем 2FA challenge
        if ("totpRequired" in result && result.totpRequired) {
          setTotpChallenge((result as unknown as { challengeToken: string }).challengeToken);
          setError("");
          setLoading(false);
          return;
        }
        const user = result as import("@/lib/auth-store").User;
        toast.success(`${t("auth.welcome_back")} ${user.name} 👋`);
        redirectToDashboard(user.role, user.clubId);
      } else {
        const user = await register({
          email,
          password,
          role,
          name,
          surname,
          preferredLocale: i18n.language.slice(0, 2) as Locale,
        });
        toast.success(t("auth.welcome_back") + " 🎉");
        redirectToDashboard(user.role, user.clubId);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("error.generic");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const isDev = import.meta.env.DEV;

  const fillDemo = (kind: "admin" | "coach" | "athlete") => {
    if (!isDev) return;
    switchMode("login");
    setPassword("password123");
    if (kind === "admin") setEmail("admin@judo-arena.kz");
    if (kind === "coach") setEmail("coach.almaty@judo-arena.kz");
    if (kind === "athlete") setEmail("rr.01@almaty-demo.demo.judo-arena.kz");
  };

  return (
    <div className="lp-root min-h-screen overflow-x-hidden">
      {/* ambient orbs */}
      <div className="lp-orb1 absolute h-[700px] w-[700px] rounded-full blur-3xl pointer-events-none -top-40 -left-40 opacity-60" />
      <div className="lp-orb2 absolute h-[600px] w-[600px] rounded-full blur-3xl pointer-events-none bottom-0 right-0 opacity-50" />
      {/* floating gold dots */}
      <div className="lp-dots">
        {[
          { left: "8%", top: "20%", dur: "7s", delay: "0s" },
          { left: "18%", top: "65%", dur: "9s", delay: "1.2s" },
          { left: "32%", top: "35%", dur: "11s", delay: "0.5s" },
          { left: "55%", top: "80%", dur: "8s", delay: "2s" },
          { left: "70%", top: "15%", dur: "10s", delay: "0.8s" },
          { left: "82%", top: "55%", dur: "7s", delay: "1.8s" },
          { left: "92%", top: "30%", dur: "12s", delay: "0.3s" },
          { left: "45%", top: "10%", dur: "9s", delay: "3s" },
        ].map((d, i) => (
          <div
            key={i}
            className="lp-dot"
            style={{
              left: d.left,
              top: d.top,
              ["--dur" as string]: d.dur,
              ["--delay" as string]: d.delay,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-x-0 top-0 z-30 px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="lp-nav-bar mx-auto flex max-w-[1500px] items-center justify-between gap-3 rounded-full border border-gold/20 bg-background/85 p-1.5 pl-2 shadow-[0_10px_40px_rgba(0,0,0,0.40)] backdrop-blur-2xl">
          <Link to="/" className="group flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-gold/35 transition-transform group-hover:scale-105">
              <img src={emblem} alt="" className="h-full w-full object-cover" />
            </span>
            <span className="truncate font-display text-sm font-bold sm:text-[15px]">
              JUDO<span className="text-gradient-gold">·</span>ARENA
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              to="/"
              className="hidden rounded-full px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-gold/10 hover:text-foreground sm:inline-flex"
            >
              {t("auth.back_home")}
            </Link>
            <LanguageSwitcher className="max-sm:[&>svg]:hidden max-sm:[&>button]:px-2" />
            <ThemeToggle className="h-9 w-9 border-border/40" />
          </div>
        </div>
      </div>

      <div className="relative min-h-screen grid pt-20 lg:grid-cols-[minmax(0,1fr)_480px] lg:pt-0 xl:grid-cols-[minmax(0,1fr)_540px]">
        {/* ══════════════════ LEFT – SHOWCASE ══════════════════ */}
        <div className="relative hidden lg:flex flex-col justify-between overflow-hidden px-14 pb-10 pt-28">
          {/* grid lines */}
          <div className="lp-grid absolute inset-0 pointer-events-none" />
          {/* ambient glow */}
          <div className="lp-glow absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none" />

          {/* TOP: badge */}
          <div className="relative z-10 pt-2">
            <div
              className="lp-badge inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
              style={{ color: "#e8a93a" }}
            >
              <Zap className="h-3 w-3" />
              {t("auth.platform_badge")}
            </div>
          </div>

          {/* MIDDLE: title + medal */}
          <div className="relative z-10 flex items-center justify-between gap-8 flex-1 py-8">
            {/* title block */}
            <div className="flex-1 min-w-0">
              <h1
                className="lp-heading font-black uppercase leading-[0.84]"
                style={{ fontSize: "clamp(3.6rem,5.8vw,5rem)", letterSpacing: "-0.025em" }}
              >
                {mode === "register" && role === "COACH"
                  ? t("auth.hero_coach_line_1")
                  : t("auth.hero_champion_line_1")}
                <span
                  className="block"
                  style={
                    mode === "register" && role === "COACH"
                      ? { WebkitTextStroke: "2px #c8922a", color: "transparent" }
                      : { color: "#e8a93a" }
                  }
                >
                  {mode === "register" && role === "COACH"
                    ? t("auth.hero_coach_line_2")
                    : t("auth.hero_champion_line_2")}
                </span>
              </h1>
              <p
                className="mt-5 text-base font-semibold leading-relaxed max-w-[300px]"
                style={{ color: "rgba(255,255,255,0.78)" }}
              >
                {t("auth.hero_subtitle")}
              </p>

              {/* stats chips */}
              <div className="mt-8 flex gap-3">
                {[
                  ["1,240+", t("auth.stat_tournaments")],
                  ["8,500+", t("auth.stat_athletes")],
                ].map(([n, l]) => (
                  <div key={l} className="lp-chip rounded-2xl px-5 py-3.5">
                    <div
                      className="text-[11px] font-bold uppercase tracking-widest mb-1.5"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                    >
                      {l}
                    </div>
                    <div className="text-2xl font-black leading-none" style={{ color: "#e8a93a" }}>
                      {n}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* medal column */}
            <div
              className="relative flex-shrink-0 flex flex-col items-center"
              style={{ width: 220 }}
            >
              {/* orbit ring */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="rounded-full lp-orbit"
                  style={{
                    width: 210,
                    height: 210,
                    position: "relative",
                    animation: "spinRing 20s linear infinite",
                  }}
                >
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                    style={{ background: "#c8922a", boxShadow: "0 0 12px #c8922a" }}
                  />
                </div>
              </div>

              {/* medal */}
              <div
                className="relative z-10 flex flex-col items-center"
                style={{
                  animation: "floatMedal 4.5s ease-in-out infinite",
                  filter: "drop-shadow(0 20px 40px rgba(200,146,42,0.55))",
                }}
              >
                <div className="relative h-14 w-20 mb-[-4px]">
                  <div
                    className="absolute bottom-0 left-[42%] w-8 h-12 rounded-t-full"
                    style={{
                      background: "linear-gradient(180deg,#2554b0,#173070)",
                      transform: "rotate(10deg)",
                      transformOrigin: "bottom center",
                      boxShadow: "inset -2px 0 6px rgba(0,0,0,0.3)",
                    }}
                  />
                  <div
                    className="absolute bottom-0 left-[36%] w-8 h-12 rounded-t-full"
                    style={{
                      background: "linear-gradient(180deg,#eef0ff,#c0caee)",
                      transform: "rotate(-8deg)",
                      transformOrigin: "bottom center",
                    }}
                  />
                </div>
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    width: 140,
                    height: 140,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(circle at 33% 28%, #fffbe0 0%, #e8a93a 50%, #7a4e10 100%)",
                    border: "3px solid rgba(255,255,255,0.30)",
                    boxShadow:
                      "0 20px 50px rgba(200,146,42,0.60), inset 0 -8px 20px rgba(0,0,0,0.20), inset 0 4px 12px rgba(255,255,255,0.28)",
                  }}
                >
                  <div
                    className="absolute rounded-full"
                    style={{ inset: 11, border: "1.5px solid rgba(255,255,255,0.28)" }}
                  />
                  <Trophy
                    className="relative z-10 text-[#3a1e00]"
                    style={{ width: 52, height: 52 }}
                  />
                  <div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: 44,
                      height: 44,
                      top: 14,
                      left: 16,
                      background:
                        "radial-gradient(circle,rgba(255,255,255,0.52) 0%,transparent 70%)",
                    }}
                  />
                </div>
              </div>

              {/* cube */}
              <div
                className="absolute -right-4 top-[20%] pointer-events-none"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 11,
                  background: "linear-gradient(135deg,#f5c842,#a86510)",
                  border: "1.5px solid rgba(255,255,255,0.20)",
                  boxShadow: "0 12px 28px rgba(200,146,42,0.50)",
                  transform: "rotate(-20deg)",
                  animation: "floatCube 5s ease-in-out infinite",
                }}
              />
              {/* diamond */}
              <div
                className="absolute -left-2 bottom-[22%] pointer-events-none"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  background: "rgba(200,146,42,0.40)",
                  border: "1px solid rgba(200,146,42,0.55)",
                  transform: "rotate(45deg)",
                  animation: "floatCube 6s ease-in-out infinite 0.8s",
                  boxShadow: "0 6px 16px rgba(200,146,42,0.30)",
                }}
              />
            </div>
          </div>

          {/* BOTTOM: tatami + belt */}
          <div className="relative z-10 pb-2">
            <div
              className="relative mx-auto"
              style={{ width: "100%", maxWidth: 440, height: 130, perspective: 700 }}
            >
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-72 h-6 rounded-full"
                style={{ background: "rgba(0,0,0,0.25)", filter: "blur(14px)" }}
              />
              <div
                className="absolute inset-x-0 top-0 rounded-[1.4rem]"
                style={{
                  height: 110,
                  transform: "rotateX(52deg)",
                  transformOrigin: "bottom center",
                  background: "linear-gradient(135deg,#1a2d68,#0c1840)",
                  border: "7px solid rgba(200,146,42,0.68)",
                  boxShadow:
                    "0 0 40px rgba(200,146,42,0.18), inset 0 0 0 1px rgba(255,255,255,0.05)",
                }}
              >
                {[28, 50, 72].map((p) => (
                  <div
                    key={p}
                    className="absolute top-2 bottom-2 w-px"
                    style={{ left: `${p}%`, background: "rgba(200,146,42,0.18)" }}
                  />
                ))}
                <div
                  className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2"
                  style={{ background: "rgba(200,146,42,0.15)" }}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {["#1a0a00", "#1a0a00", "#c8922a", "#c8922a", "#c8922a"].map((c, i) => (
                  <div
                    key={i}
                    className="rounded-full"
                    style={{
                      width: 10,
                      height: 10,
                      background: c,
                      boxShadow: c === "#c8922a" ? "0 0 8px rgba(200,146,42,0.75)" : "none",
                    }}
                  />
                ))}
                <span className="lp-dan ml-2 text-[10px] font-bold uppercase tracking-widest">
                  {t("auth.dan_rank")}
                </span>
              </div>
              <div className="lp-brand-badge flex items-center gap-2.5 rounded-xl px-3 py-2">
                <img
                  src={emblem}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                  style={{ boxShadow: "0 0 10px rgba(200,146,42,0.45)" }}
                />
                <span className="lp-brand-text text-xs font-black uppercase tracking-[0.12em]">
                  Judo-Arena
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════ RIGHT – FORM PANEL ══════════════════ */}
        <div className="lp-right relative flex min-h-screen items-center justify-center px-4 pb-6 pt-4 lg:px-8 lg:pb-8 lg:pt-24">
          <div className="lp-right-glow absolute inset-0 pointer-events-none" />

          <div
            className="lp-card relative w-full max-w-[440px] overflow-hidden"
            style={{ borderRadius: 24, backdropFilter: "blur(32px)", padding: "2rem 1.75rem" }}
          >
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/80 to-transparent" />
            {/* header */}
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <div
                  className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-[#c8922a]"
                  style={{
                    background: "rgba(200,146,42,0.12)",
                    border: "1px solid rgba(200,146,42,0.25)",
                  }}
                >
                  {mode === "login" ? (
                    <Lock className="h-5 w-5" />
                  ) : (
                    <UserPlus className="h-5 w-5" />
                  )}
                </div>
                <h2
                  className="lp-title font-black text-3xl leading-tight"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {mode === "login" ? t("auth.login_title") : t("auth.register_title")}
                </h2>
                <p className="lp-subtitle mt-1.5 text-sm">
                  {mode === "login" ? t("auth.login_subtitle") : t("auth.register_subtitle")}
                </p>
              </div>
              <Link
                to="/"
                className="lp-home-btn hidden h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:text-[#c8922a] sm:inline-flex"
                aria-label="Judo-Arena"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            {/* mode tabs */}
            <div className="lp-tabs mb-6 flex gap-1 rounded-2xl p-1">
              {(
                [
                  ["login", Lock, "auth.login_title"],
                  ["register", UserPlus, "auth.register_title"],
                ] as const
              ).map(([m, Icon, labelKey]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all duration-200"
                  style={
                    mode === m
                      ? {
                          background: "linear-gradient(135deg,#e8a93a,#c8922a)",
                          color: "#1a0e00",
                          boxShadow: "0 6px 20px rgba(200,146,42,0.40)",
                        }
                      : undefined
                  }
                  data-inactive={mode !== m ? "true" : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(labelKey)}
                </button>
              ))}
            </div>

            <form className="space-y-3.5" onSubmit={handleSubmit}>
              {mode === "register" && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="relative">
                      <InputIcon>
                        <User className="h-4 w-4" />
                      </InputIcon>
                      <input
                        type="text"
                        required
                        placeholder={t("auth.first_name")}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div className="relative">
                      <InputIcon>
                        <User className="h-4 w-4" />
                      </InputIcon>
                      <input
                        type="text"
                        required
                        placeholder={t("auth.last_name")}
                        value={surname}
                        onChange={(e) => setSurname(e.target.value)}
                        className={INPUT_CLS}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {roleOptions.map(({ key, label, icon: Icon, hint }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setRole(key)}
                        className="lp-role flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-center text-sm font-bold transition-all"
                        data-active={role === key ? "true" : undefined}
                      >
                        <span className="lp-role-icon flex h-9 w-9 items-center justify-center rounded-xl">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span>{label}</span>
                        <span className="text-[10px] leading-4 opacity-55">{hint}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="relative">
                <InputIcon>
                  <Mail className="h-4 w-4" />
                </InputIcon>
                <input
                  type="email"
                  required
                  placeholder={t("common.email")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={INPUT_CLS}
                />
              </div>

              {/* 2FA challenge screen */}
              {totpChallenge && (
                <div className="rounded-xl border border-gold/30 bg-gold/5 p-5 text-center space-y-3">
                  <div className="text-gold text-2xl">🔐</div>
                  <div className="font-semibold text-sm">
                    {t("auth.2fa_title") ?? "Аутентификатор коды"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("auth.2fa_hint") ??
                      "Google Authenticator немесе Authy қолданбасынан 6 санды кодты енгізіңіз"}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoFocus
                    required
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className={`${INPUT_CLS} text-center text-2xl font-mono tracking-[0.5em]`}
                  />
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline underline-offset-2"
                    onClick={() => {
                      setTotpChallenge(null);
                      setTotpCode("");
                    }}
                  >
                    {t("auth.back_to_login") ?? "← Артқа"}
                  </button>
                </div>
              )}

              <div className={totpChallenge ? "hidden" : ""}>
                <div className="relative">
                  <InputIcon>
                    <KeyRound className="h-4 w-4" />
                  </InputIcon>
                  <input
                    type={showPwd ? "text" : "password"}
                    required={!totpChallenge}
                    placeholder={t("common.password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={mode === "register" ? 8 : 1}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className={`${INPUT_CLS} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 lp-eye-btn transition-colors"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === "login" ? (
                  <div className="mt-2 text-right">
                    <Link
                      to="/forgot-password"
                      className="lp-forgot text-xs transition-colors hover:text-[#c8922a]"
                    >
                      {t("auth.forgot_password")}
                    </Link>
                  </div>
                ) : (
                  <PasswordStrength password={password} />
                )}
              </div>

              {/* confirm password — only on register */}
              {mode === "register" && (
                <div className="relative">
                  <InputIcon>
                    <KeyRound className="h-4 w-4" />
                  </InputIcon>
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    placeholder={t("auth.confirm_password") || "Құпиясөзді растаңыз"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className={`${INPUT_CLS} pr-11 ${
                      confirmPassword.length > 0
                        ? password === confirmPassword
                          ? "border-green-500/50 focus:border-green-500/70"
                          : "border-red-500/50 focus:border-red-500/70"
                        : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 lp-eye-btn transition-colors"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  {/* match indicator */}
                  {confirmPassword.length > 0 && (
                    <div
                      className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-medium ${
                        password === confirmPassword ? "text-green-500" : "text-red-400"
                      }`}
                    >
                      {password === confirmPassword ? (
                        <>
                          <span className="text-base leading-none">✓</span>
                          {t("auth.passwords_match")}
                        </>
                      ) : (
                        <>
                          <span className="text-base leading-none">✗</span>
                          {t("auth.passwords_mismatch")}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div
                  className="flex items-start gap-2.5 text-sm rounded-xl p-3"
                  style={{
                    color: "#e05555",
                    background: "rgba(220,50,50,0.08)",
                    border: "1px solid rgba(220,50,50,0.20)",
                  }}
                >
                  <span className="mt-0.5 shrink-0">⚠</span>
                  {error}
                </div>
              )}

              {mode === "register" && (
                <label className="flex items-start gap-3 mt-2 cursor-pointer group">
                  <div className="relative flex items-center justify-center mt-0.5">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-5 rounded border border-border/60 bg-background/50 transition-all peer-checked:border-gold peer-checked:bg-gold/15 group-hover:border-gold/50" />
                    <svg
                      className="absolute h-3 w-3 text-gold opacity-0 transition-opacity peer-checked:opacity-100"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-muted-foreground leading-snug">
                    {t("auth.accept_terms_prefix", "Я соглашаюсь с")}{" "}
                    <a
                      href="#"
                      className="text-foreground hover:text-gold transition-colors underline underline-offset-2"
                    >
                      {t("auth.privacy_policy", "Политикой конфиденциальности")}
                    </a>{" "}
                    {t("auth.and", "и")}{" "}
                    <a
                      href="#"
                      className="text-foreground hover:text-gold transition-colors underline underline-offset-2"
                    >
                      {t("auth.terms_of_use", "Условиями использования")}
                    </a>
                    .
                  </span>
                </label>
              )}

              {mode === "register" && !isDev && (
                <div className="flex justify-center mt-2">
                  <Turnstile
                    siteKey="1x00000000000000000000AA"
                    onSuccess={(token) => setTurnstileToken(token)}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-black text-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg,#f0c040 0%,#c8922a 50%,#a87020 100%)",
                  color: "#1a0e00",
                  boxShadow: "0 8px 32px rgba(200,146,42,0.45), 0 2px 6px rgba(0,0,0,0.15)",
                  letterSpacing: "0.01em",
                }}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading
                  ? mode === "login"
                    ? t("auth.signing_in")
                    : t("auth.registering")
                  : mode === "login"
                    ? t("nav.login")
                    : t("nav.register")}
              </button>
            </form>

            {isDev && (
              <div className="lp-demo-section mt-5 pt-4">
                <p className="lp-demo-label mb-3 text-center text-[11px] uppercase tracking-widest">
                  {t("auth.demo_access")}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["admin", Shield, t("roles.admin")],
                      ["coach", ClipboardList, t("roles.coach")],
                      ["athlete", UsersRound, t("roles.athlete")],
                    ] as const
                  ).map(([k, Icon, label]) => (
                    <button
                      key={k}
                      onClick={() => fillDemo(k)}
                      className="lp-demo-btn group flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-xl transition-all"
                    >
                      <Icon className="h-5 w-5 lp-demo-icon transition-colors group-hover:text-[#c8922a]" />
                      <span className="lp-demo-text text-[11px] transition-colors">{label}</span>
                    </button>
                  ))}
                </div>
                <p className="lp-demo-pwd mt-2.5 text-center text-[10px]">
                  {t("common.password")}:{" "}
                  <span className="font-mono" style={{ color: "#c8922a" }}>
                    password123
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        <style>{`
        /* ── DARK theme ── */
        :root,
        html.dark {
          --lp-page-bg:    linear-gradient(135deg,#04060f 0%,#08102a 45%,#050c1c 100%);
          --lp-orb1:       rgba(200,146,42,0.18);
          --lp-orb2:       rgba(30,60,140,0.45);
          --lp-grid:       rgba(200,146,42,0.06) 1px, transparent 1px;
          --lp-glow:       radial-gradient(circle,rgba(200,146,42,0.14) 0%,transparent 65%);
          --lp-badge-bg:   rgba(200,146,42,0.13);
          --lp-badge-bdr:  rgba(200,146,42,0.35);
          --lp-heading:    #ffffff;
          --lp-sub:        rgba(255,255,255,0.55);
          --lp-chip-bg:    rgba(255,255,255,0.05);
          --lp-chip-bdr:   rgba(200,146,42,0.20);
          --lp-chip-lbl:   rgba(255,255,255,0.40);
          --lp-orbit-bdr:  rgba(200,146,42,0.30);
          --lp-dan:        rgba(255,255,255,0.35);
          --lp-brand-bg:   rgba(255,255,255,0.04);
          --lp-brand-bdr:  rgba(255,255,255,0.09);
          --lp-brand-fg:   #ffffff;
          --lp-right-bdr:  rgba(200,146,42,0.12);
          --lp-right-glow: radial-gradient(ellipse at 50% 0%,rgba(200,146,42,0.10) 0%,transparent 65%);
          --lp-card-bg:    rgba(8,14,38,0.85);
          --lp-card-bdr:   rgba(200,146,42,0.22);
          --lp-card-shad:  0 40px 100px rgba(0,0,0,0.70), 0 0 0 1px rgba(200,146,42,0.08) inset;
          --lp-mobile-fg:  #ffffff;
          --lp-title:      #ffffff;
          --lp-subtitle:   rgba(255,255,255,0.48);
          --lp-home-btn:   rgba(255,255,255,0.08);
          --lp-home-fg:    rgba(255,255,255,0.40);
          --lp-tabs-bg:    rgba(255,255,255,0.04);
          --lp-tabs-bdr:   rgba(255,255,255,0.08);
          --lp-tab-inactive: rgba(255,255,255,0.45);
          --lp-role-bg:    rgba(255,255,255,0.03);
          --lp-role-bdr:   rgba(255,255,255,0.08);
          --lp-role-fg:    rgba(255,255,255,0.50);
          --lp-role-icon:  rgba(255,255,255,0.06);
          --lp-eye:        rgba(255,255,255,0.35);
          --lp-forgot:     rgba(255,255,255,0.40);
          --lp-sep:        rgba(255,255,255,0.08);
          --lp-demo-lbl:   rgba(255,255,255,0.30);
          --lp-demo-bg:    rgba(255,255,255,0.03);
          --lp-demo-bdr:   rgba(255,255,255,0.08);
          --lp-demo-icon:  rgba(255,255,255,0.40);
          --lp-demo-text:  rgba(255,255,255,0.40);
          --lp-demo-pwd:   rgba(255,255,255,0.28);
        }

        /* ── LIGHT theme ── */
        html.light {
          --lp-page-bg:    linear-gradient(135deg,#f0f4ff 0%,#e8edf8 45%,#f5f7ff 100%);
          --lp-orb1:       rgba(200,146,42,0.12);
          --lp-orb2:       rgba(100,140,220,0.20);
          --lp-grid:       rgba(200,146,42,0.07) 1px, transparent 1px;
          --lp-glow:       radial-gradient(circle,rgba(200,146,42,0.10) 0%,transparent 65%);
          --lp-badge-bg:   rgba(200,146,42,0.10);
          --lp-badge-bdr:  rgba(200,146,42,0.30);
          --lp-heading:    #0d1325;
          --lp-sub:        rgba(13,19,37,0.60);
          --lp-chip-bg:    rgba(255,255,255,0.75);
          --lp-chip-bdr:   rgba(200,146,42,0.25);
          --lp-chip-lbl:   rgba(13,19,37,0.50);
          --lp-orbit-bdr:  rgba(200,146,42,0.25);
          --lp-dan:        rgba(13,19,37,0.40);
          --lp-brand-bg:   rgba(13,19,37,0.05);
          --lp-brand-bdr:  rgba(13,19,37,0.12);
          --lp-brand-fg:   #0d1325;
          --lp-right-bdr:  rgba(200,146,42,0.15);
          --lp-right-glow: radial-gradient(ellipse at 50% 0%,rgba(200,146,42,0.08) 0%,transparent 65%);
          --lp-card-bg:    rgba(255,255,255,0.92);
          --lp-card-bdr:   rgba(200,146,42,0.25);
          --lp-card-shad:  0 20px 60px rgba(13,19,37,0.12), 0 0 0 1px rgba(200,146,42,0.10) inset;
          --lp-mobile-fg:  #0d1325;
          --lp-title:      #0d1325;
          --lp-subtitle:   rgba(13,19,37,0.50);
          --lp-home-btn:   rgba(13,19,37,0.08);
          --lp-home-fg:    rgba(13,19,37,0.45);
          --lp-tabs-bg:    rgba(13,19,37,0.04);
          --lp-tabs-bdr:   rgba(13,19,37,0.10);
          --lp-tab-inactive: rgba(13,19,37,0.45);
          --lp-role-bg:    rgba(13,19,37,0.03);
          --lp-role-bdr:   rgba(13,19,37,0.10);
          --lp-role-fg:    rgba(13,19,37,0.55);
          --lp-role-icon:  rgba(13,19,37,0.06);
          --lp-eye:        rgba(13,19,37,0.35);
          --lp-forgot:     rgba(13,19,37,0.45);
          --lp-sep:        rgba(13,19,37,0.10);
          --lp-demo-lbl:   rgba(13,19,37,0.35);
          --lp-demo-bg:    rgba(13,19,37,0.03);
          --lp-demo-bdr:   rgba(13,19,37,0.10);
          --lp-demo-icon:  rgba(13,19,37,0.40);
          --lp-demo-text:  rgba(13,19,37,0.45);
          --lp-demo-pwd:   rgba(13,19,37,0.30);
        }

        .lp-root           { background: var(--lp-page-bg); color-scheme: light dark; }
        .lp-orb1           { background: var(--lp-orb1); }
        .lp-orb2           { background: var(--lp-orb2); }
        .lp-grid           { background-image: linear-gradient(var(--lp-grid)),linear-gradient(90deg,var(--lp-grid)); background-size: 56px 56px; }
        .lp-glow           { background: var(--lp-glow); }
        .lp-badge          { background: var(--lp-badge-bg); border: 1px solid var(--lp-badge-bdr); }
        .lp-heading        { color: var(--lp-heading); }
        .lp-sub            { color: var(--lp-sub); }
        .lp-chip           { background: var(--lp-chip-bg); border: 1px solid var(--lp-chip-bdr); backdrop-filter: blur(12px); }
        .lp-chip-label     { color: var(--lp-chip-lbl); }
        .lp-orbit          { border: 1px solid var(--lp-orbit-bdr); }
        .lp-dan            { color: var(--lp-dan); }
        .lp-brand-badge    { background: var(--lp-brand-bg); border: 1px solid var(--lp-brand-bdr); }
        .lp-brand-text     { color: var(--lp-brand-fg); }
        .lp-right          { border-left: 1px solid var(--lp-right-bdr); }
        .lp-right-glow     { background: var(--lp-right-glow); }
        .lp-card           { background: var(--lp-card-bg); border: 1px solid var(--lp-card-bdr); box-shadow: var(--lp-card-shad); }
        .lp-mobile-brand   { color: var(--lp-mobile-fg); }
        .lp-title          { color: var(--lp-title); }
        .lp-subtitle       { color: var(--lp-subtitle); }
        .lp-home-btn       { border: 1px solid var(--lp-home-btn); color: var(--lp-home-fg); }
        .lp-tabs           { background: var(--lp-tabs-bg); border: 1px solid var(--lp-tabs-bdr); }
        .lp-tabs button[data-inactive] { color: var(--lp-tab-inactive); }
        .lp-role           { background: var(--lp-role-bg); border: 1.5px solid var(--lp-role-bdr); color: var(--lp-role-fg); }
        .lp-role[data-active] { border-color: #c8922a; background: rgba(200,146,42,0.12); color: #e8a93a; }
        .lp-role-icon      { background: var(--lp-role-icon); }
        .lp-eye-btn        { color: var(--lp-eye); }
        .lp-eye-btn:hover  { color: var(--lp-heading); }
        .lp-forgot         { color: var(--lp-forgot); }
        .lp-demo-section   { border-top: 1px solid var(--lp-sep); }
        .lp-demo-label     { color: var(--lp-demo-lbl); }
        .lp-demo-btn       { background: var(--lp-demo-bg); border: 1px solid var(--lp-demo-bdr); }
        .lp-demo-btn:hover { border-color: rgba(200,146,42,0.40); background: rgba(200,146,42,0.08); }
        .lp-demo-icon      { color: var(--lp-demo-icon); }
        .lp-demo-text      { color: var(--lp-demo-text); }
        .lp-demo-pwd       { color: var(--lp-demo-pwd); }

        /* animated gold border on card */
        .lp-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 24px;
          padding: 1px;
          background: linear-gradient(120deg, transparent 20%, rgba(200,146,42,0.6) 50%, transparent 80%);
          background-size: 200% 200%;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: borderSweep 4s linear infinite;
          pointer-events: none;
        }
        /* scan line */
        .lp-card::after {
          content: '';
          position: absolute;
          left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(200,146,42,0.5), transparent);
          animation: scanLine 6s ease-in-out infinite;
          pointer-events: none;
        }
        /* stat chips glow on hover */
        .lp-chip:hover { border-color: rgba(200,146,42,0.45); box-shadow: 0 0 20px rgba(200,146,42,0.12); transition: all 0.3s; }
        /* floating dots background */
        .lp-dots {
          position: absolute; inset: 0; pointer-events: none; overflow: hidden;
        }
        .lp-dot {
          position: absolute;
          width: 3px; height: 3px;
          border-radius: 50%;
          background: rgba(200,146,42,0.5);
          animation: dotFloat var(--dur, 8s) ease-in-out infinite var(--delay, 0s);
        }
        /* navbar: dark by default, adapts in light mode */
        html.dark .lp-nav-bar, :root .lp-nav-bar {
          background: rgba(6,10,24,0.90) !important;
          border-color: rgba(200,146,42,0.15) !important;
        }
        html.dark .lp-nav-bar *, :root .lp-nav-bar * { color: rgba(255,255,255,0.85) !important; }
        html.dark .lp-nav-bar button[aria-pressed="true"], :root .lp-nav-bar button[aria-pressed="true"] { color: #111827 !important; }
        html.dark .lp-nav-bar a:hover *, :root .lp-nav-bar a:hover * { color: #c8922a !important; }
        html.light .lp-nav-bar {
          background: rgba(245,247,255,0.92) !important;
          border-color: rgba(200,146,42,0.18) !important;
        }
        html.light .lp-nav-bar * { color: rgba(13,19,37,0.80) !important; }
        html.light .lp-nav-bar a:hover * { color: #c8922a !important; }

        /* inputs */
        html.dark .lp-input, :root .lp-input {
          border-color: rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.05);
          color: #ffffff;
        }
        html.dark .lp-input::placeholder, :root .lp-input::placeholder { color: rgba(255,255,255,0.35); }
        html.dark .lp-input:focus, :root .lp-input:focus { background: rgba(255,255,255,0.08); }
        html.dark .lp-input-icon, :root .lp-input-icon { color: rgba(255,255,255,0.40); }
        html.light .lp-input {
          border-color: rgba(13,19,37,0.14);
          background: rgba(13,19,37,0.04);
          color: #0d1325;
        }
        html.light .lp-input::placeholder { color: rgba(13,19,37,0.38); }
        html.light .lp-input:focus { background: rgba(255,255,255,0.90); border-color: rgba(200,146,42,0.50); }
        html.light .lp-input-icon { color: rgba(13,19,37,0.40); }

        @keyframes borderSweep {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes scanLine {
          0%   { top: 10%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        @keyframes dotFloat {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.4; }
          50%      { transform: translateY(-30px) scale(1.3); opacity: 0.8; }
        }

        @keyframes floatMedal {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          50%      { transform: translateY(-18px) rotate(3deg); }
        }
        @keyframes floatCube {
          0%,100% { transform: rotate(-20deg) translateY(0px); }
          50%      { transform: rotate(-14deg) translateY(-12px); }
        }
        @keyframes spinRing {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
      </div>
    </div>
  );
}
