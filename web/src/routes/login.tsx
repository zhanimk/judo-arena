import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import emblem from "@/assets/jcl-logo.jpeg";
import heroImg from "@/assets/hero-judo.jpg";
import { useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { ApiError } from "@/lib/api";
import { Lock, UserPlus, Loader2 } from "lucide-react";
import { RedirectIfAuthenticated } from "@/lib/protected-route";

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

function Login() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>(search.mode ?? "login");
  const [role, setRole] = useState<"ATHLETE" | "COACH">("ATHLETE");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const redirectToDashboard = (userRole: "ATHLETE" | "COACH" | "ADMIN") => {
    if (userRole === "ADMIN") navigate({ to: "/admin" });
    else if (userRole === "COACH") navigate({ to: "/coach" });
    else navigate({ to: "/athlete" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        const user = await login(email, password);
        redirectToDashboard(user.role);
      } else {
        const user = await register({
          email, password, role, name, surname,
          preferredLocale: "kk",
        });
        redirectToDashboard(user.role);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Қате орын алды. Қайталап көріңіз.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (kind: "admin" | "coach" | "athlete") => {
    setMode("login");
    setPassword("password123");
    if (kind === "admin") setEmail("admin@judo-arena.kz");
    if (kind === "coach") setEmail("coach.almaty@judo-arena.kz");
    if (kind === "athlete") setEmail("m0-0@almaty-judo.judo-arena.kz");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:block overflow-hidden">
        <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-navy-deep/95 via-navy-deep/70 to-navy/40" />
        <div className="relative p-12 h-full flex flex-col justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={emblem} alt="" className="h-9 w-9" />
            <span className="font-display text-xl font-bold">JUDO·ARENA</span>
          </Link>
          <div>
            <h2 className="font-display text-5xl font-bold leading-tight">
              Дзюдоның<br/><span className="text-gradient-gold italic">цифрлық аренасы</span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-md">
              Жарыстарды, өтінімдерді және төрелік етуді басқару үшін жүйеге кіріңіз.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
            <img src={emblem} alt="" className="h-9 w-9" />
            <span className="font-display text-xl font-bold">JUDO·ARENA</span>
          </Link>

          {/* Mode switch */}
          <div className="grid grid-cols-2 gap-2 p-1 glass rounded-lg mb-8">
            <button
              onClick={() => setMode("login")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
                mode === "login" ? "bg-gradient-gold text-gold-foreground shadow-gold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Lock className="h-4 w-4" /> Кіру
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
                mode === "register" ? "bg-gradient-gold text-gold-foreground shadow-gold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus className="h-4 w-4" /> Тіркелу
            </button>
          </div>

          <h1 className="font-display text-3xl font-bold">
            {mode === "login" ? "Жүйеге кіру" : "Жаңа аккаунт"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {mode === "login"
              ? "Email мен құпиясөзіңізді енгізіңіз."
              : "Спортшы немесе жаттықтырушы ретінде тіркеліңіз."}
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            {mode === "register" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">Аты</label>
                    <input
                      type="text" required value={name} onChange={(e) => setName(e.target.value)}
                      className="mt-1.5 w-full bg-input border border-border rounded-md px-4 py-2.5 focus:border-gold focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">Тегі</label>
                    <input
                      type="text" required value={surname} onChange={(e) => setSurname(e.target.value)}
                      className="mt-1.5 w-full bg-input border border-border rounded-md px-4 py-2.5 focus:border-gold focus:outline-none transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Рөл</label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {([["ATHLETE","Спортшы"],["COACH","Жаттықтырушы"]] as const).map(([k,l]) => (
                      <button key={k} type="button" onClick={() => setRole(k)}
                        className={`py-2.5 rounded-md text-sm border transition-all ${
                          role === k ? "bg-gold/15 text-gold border-gold/40" : "glass border-border hover:border-gold/30"
                        }`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full bg-input border border-border rounded-md px-4 py-2.5 focus:border-gold focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Құпиясөз</label>
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                minLength={mode === "register" ? 8 : 1}
                className="mt-1.5 w-full bg-input border border-border rounded-md px-4 py-2.5 focus:border-gold focus:outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-gold text-gold-foreground font-medium py-3 rounded-md shadow-gold hover:scale-[1.02] transition-transform disabled:opacity-60 disabled:hover:scale-100 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Кіру" : "Аккаунт жасау"}
            </button>
          </form>

          {/* Демо-логины */}
          <div className="mt-8 pt-6 border-t border-border/40">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 text-center">Демо-аккаунттар</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button onClick={() => fillDemo("admin")} className="glass rounded-md py-2 hover:border-gold/50 transition-colors">
                Әкімші
              </button>
              <button onClick={() => fillDemo("coach")} className="glass rounded-md py-2 hover:border-gold/50 transition-colors">
                Жаттықтырушы
              </button>
              <button onClick={() => fillDemo("athlete")} className="glass rounded-md py-2 hover:border-gold/50 transition-colors">
                Спортшы
              </button>
            </div>
            <div className="mt-2 text-[10px] text-center text-muted-foreground">
              Құпиясөз бәріне бірдей: <span className="text-gold font-mono">password123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
