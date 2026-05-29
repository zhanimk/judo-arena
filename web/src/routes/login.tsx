import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import emblem from "@/assets/jcl-logo.jpeg";
import heroImg from "@/assets/hero-judo.jpg";
import { useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { ApiError } from "@/lib/api";
import {
  Lock, UserPlus, Loader2, Eye, EyeOff,
  Mail, KeyRound, User, Shield, Trophy, Zap,
} from "lucide-react";
import { RedirectIfAuthenticated } from "@/lib/protected-route";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Кіру — Judo-Arena" }] }),
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

const FEATURES = [
  { icon: Trophy, text: "Жарыс кестесі мен нәтижелер онлайн" },
  { icon: Zap,    text: "Жарты финал сеткасы автоматты" },
  { icon: Shield, text: "Татами судьясы үшін арнайы панель" },
];

const INPUT_CLS =
  "w-full bg-input border border-border rounded-xl px-4 py-3 pl-11 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-gold focus:ring-2 focus:ring-gold/20 focus:outline-none transition-all";

function InputIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50">
      {children}
    </span>
  );
}

function Login() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>(search.mode ?? "login");
  const [role, setRole] = useState<"ATHLETE" | "COACH">("ATHLETE");

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [surname,  setSurname]  = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [leaving,  setLeaving]  = useState(false);

  const switchMode = (m: Mode) => { setMode(m); setError(""); };

  const redirectToDashboard = (userRole: "ATHLETE" | "COACH" | "ADMIN", isNew = false) => {
    setLeaving(true);
    setTimeout(() => {
      if (userRole === "ADMIN") navigate({ to: "/admin" });
      else if (userRole === "COACH") navigate({ to: "/coach/onboarding" });
      else navigate({ to: "/athlete/onboarding" });
    }, 420);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        const user = await login(email, password);
        toast.success(`Сәлем, ${user.name}! 👋`);
        redirectToDashboard(user.role);
      } else {
        const user = await register({ email, password, role, name, surname, preferredLocale: "kk" });
        toast.success("Аккаунт сәтті жасалды! Қош келдіңіз 🎉");
        redirectToDashboard(user.role, true);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Қате орын алды. Қайталап көріңіз.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (kind: "admin" | "coach" | "athlete") => {
    switchMode("login");
    setPassword("password123");
    if (kind === "admin")   setEmail("admin@judo-arena.kz");
    if (kind === "coach")   setEmail("coach.almaty@judo-arena.kz");
    if (kind === "athlete") setEmail("m0-0@almaty-judo.judo-arena.kz");
  };

  return (
    <div
      className={`min-h-screen grid lg:grid-cols-[1fr_480px] xl:grid-cols-[1fr_520px] transition-opacity duration-400 ${leaving ? "opacity-0 scale-[0.99]" : "opacity-100 scale-100"}`}
      style={{ transition: "opacity 0.42s ease, transform 0.42s ease" }}
    >

      {/* ── LEFT PANEL — always dark hero ── */}
      <div className="relative hidden lg:flex flex-col overflow-hidden" style={{ background: "#09090f" }}>
        <img src={heroImg} alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          style={{ opacity: 0.45 }}
        />
        {/* gradient overlay — always dark regardless of theme */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgba(9,9,15,0.92) 0%, rgba(9,9,15,0.65) 60%, rgba(9,9,15,0.40) 100%)" }}
        />
        {/* gold glow accents */}
        <div className="absolute bottom-1/4 right-0 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(212,160,55,0.18) 0%, transparent 70%)", filter: "blur(50px)" }}
        />

        {/* Top logo */}
        <div className="relative px-12 pt-10">
          <Link to="/" className="inline-flex items-center gap-3" style={{ textDecoration: "none" }}>
            <img src={emblem} alt="" className="h-10 w-10 rounded-xl shadow-lg" />
            <span style={{ fontFamily: "'Sora','Inter',sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.06em", color: "#fff" }}>
              JUDO·ARENA
            </span>
          </Link>
        </div>

        {/* Centre */}
        <div className="relative flex-1 flex flex-col justify-center px-12 pb-20">
          <div className="inline-flex items-center gap-2 mb-6" style={{ color: "#d4a037", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            <span style={{ height: 1, width: 32, background: "#d4a037", opacity: 0.6 }} />
            Қазақстандық дзюдо платформасы
          </div>
          <h2 style={{ fontFamily: "'Sora','Inter',sans-serif", fontSize: 52, fontWeight: 800, lineHeight: 1.12, margin: "0 0 20px", color: "#fff" }}>
            Дзюдоның<br />
            <span style={{ background: "linear-gradient(135deg,#f0c56d,#c48b1a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontStyle: "italic" }}>
              цифрлық аренасы
            </span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 16, lineHeight: 1.75, maxWidth: 380, marginBottom: 36 }}>
            Жарыстарды ұйымдастыру, өтінімдерді бекіту және нәтижелерді жариялау — бәрі бір жерде.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 32, width: 32, borderRadius: 8, background: "rgba(212,160,55,0.14)", border: "1px solid rgba(212,160,55,0.25)", flexShrink: 0 }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: "#d4a037" }} />
                </span>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.68)" }}>{text}</span>
              </li>
            ))}
          </ul>

          {/* Stats */}
          <div style={{ display: "flex", gap: 36, marginTop: 44 }}>
            {[["500+", "Спортшы"], ["50+", "Турнир"], ["3", "Демо рөл"]].map(([val, label]) => (
              <div key={label}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#d4a037", fontFamily: "'Sora','Inter',sans-serif" }}>{val}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative px-12 pb-8" style={{ fontSize: 11, color: "rgba(255,255,255,0.22)" }}>
          © 2026 Judo-Arena · Казахстандық дзюдо платформасы
        </div>
      </div>

      {/* ── RIGHT PANEL — fully theme-aware ── */}
      <div className="flex items-center justify-center bg-background p-6 lg:p-10 lg:border-l lg:border-border/40 min-h-screen">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <Link to="/" className="lg:hidden inline-flex items-center gap-2.5 mb-8">
            <img src={emblem} alt="" className="h-9 w-9 rounded-lg" />
            <span className="font-display text-xl font-bold">JUDO·ARENA</span>
          </Link>

          {/* Heading */}
          <div className="mb-7">
            <h1 className="font-display text-2xl font-bold text-foreground">
              {mode === "login" ? "Жүйеге кіру" : "Жаңа аккаунт"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1.5">
              {mode === "login"
                ? "Деректерді енгізіп, жүйеге кіріңіз."
                : "Аккаунт жасап, жарыстарға қатысыңыз."}
            </p>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 p-1.5 rounded-2xl bg-muted/60 border border-border/60 mb-7">
            {([["login", Lock, "Кіру"], ["register", UserPlus, "Тіркелу"]] as const).map(([m, Icon, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  mode === m
                    ? "bg-gradient-gold text-gold-foreground shadow-gold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>

            {/* Register-only fields */}
            {mode === "register" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <InputIcon><User className="h-4 w-4" /></InputIcon>
                    <input type="text" required placeholder="Аты" value={name}
                      onChange={(e) => setName(e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div className="relative">
                    <InputIcon><User className="h-4 w-4" /></InputIcon>
                    <input type="text" required placeholder="Тегі" value={surname}
                      onChange={(e) => setSurname(e.target.value)} className={INPUT_CLS} />
                  </div>
                </div>

                {/* Role picker */}
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["ATHLETE", "Спортшы",      "🥋", "Жарыстарға қатысу"],
                    ["COACH",   "Жаттықтырушы", "📋", "Клуб басқару"],
                  ] as const).map(([k, label, emoji, hint]) => (
                    <button
                      key={k} type="button"
                      onClick={() => setRole(k)}
                      className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl border-2 text-sm font-medium transition-all ${
                        role === k
                          ? "border-gold bg-gold/10 text-gold"
                          : "border-border bg-muted/40 text-muted-foreground hover:border-gold/40 hover:text-foreground"
                      }`}
                    >
                      <span className="text-2xl leading-none">{emoji}</span>
                      <span className="font-semibold">{label}</span>
                      <span className="text-[11px] opacity-60">{hint}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Email */}
            <div className="relative">
              <InputIcon><Mail className="h-4 w-4" /></InputIcon>
              <input type="email" required placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                className={INPUT_CLS} />
            </div>

            {/* Password */}
            <div>
              <div className="relative">
                <InputIcon><KeyRound className="h-4 w-4" /></InputIcon>
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  placeholder="Құпиясөз"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={mode === "register" ? 8 : 1}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className={`${INPUT_CLS} pr-11`}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === "login" ? (
                <div className="mt-2 text-right">
                  <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-gold transition-colors">
                    Құпиясөзді ұмыттым?
                  </Link>
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] text-muted-foreground/70">Кемінде 8 таңба</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                <span className="mt-0.5 shrink-0">⚠</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-gold text-gold-foreground font-semibold py-3.5 rounded-xl shadow-gold hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center gap-2 mt-1"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Кіру" : "Аккаунт жасау"}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-7 pt-6 border-t border-border/60">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground/60 text-center mb-3">
              Демо аккаунттар
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["admin",   "🛡️", "Әкімші"],
                ["coach",   "📋", "Тренер"],
                ["athlete", "🥋", "Спортшы"],
              ] as const).map(([k, emoji, label]) => (
                <button
                  key={k}
                  onClick={() => fillDemo(k)}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl bg-muted/50 border border-border/60 hover:border-gold/40 hover:bg-gold/8 transition-all group"
                >
                  <span className="text-xl">{emoji}</span>
                  <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-center text-[10px] text-muted-foreground/50">
              Барлығының құпиясөзі:{" "}
              <span className="font-mono text-gold/80">password123</span>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
