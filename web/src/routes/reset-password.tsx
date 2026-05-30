import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import emblem from "@/assets/jcl-logo.jpeg";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Loader2, CheckCircle2, ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Жаңа құпиясөз — Judo-Arena" }] }),
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: ResetPassword,
});

const INPUT_CLS =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-11 text-sm placeholder:text-white/30 focus:border-gold/60 focus:outline-none transition-all";

function ResetPassword() {
  const { t } = useTranslation();
  const { token }               = Route.useSearch();
  const navigate                = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [showCfm, setShowCfm]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError(t("auth.passwords_mismatch")); return; }
    if (!token)               { setError(t("error.generic")); return; }
    setLoading(true);
    try {
      await api.auth.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate({ to: "/login" }), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-deep p-6">
      <div className="w-full max-w-sm">

        <Link to="/" className="inline-flex items-center gap-2.5 mb-10">
          <img src={emblem} alt="" className="h-9 w-9 rounded-lg" />
          <span className="font-display text-xl font-bold">JUDO·ARENA</span>
        </Link>

        {!token ? (
          <div className="rounded-2xl bg-white/4 border border-white/8 p-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
              <span className="text-2xl">🔗</span>
            </div>
            <h2 className="font-display text-2xl font-bold mb-2">{t("error.generic")}</h2>
            <p className="text-white/50 text-sm leading-relaxed mb-6">
              {t("error.generic")}
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center justify-center gap-2 text-sm bg-gradient-gold text-[#1a1204] font-semibold px-6 py-2.5 rounded-xl hover:brightness-110 transition-all"
            >
              {t("auth.send_reset_link")}
            </Link>
          </div>

        ) : done ? (
          <div className="rounded-2xl bg-white/4 border border-white/8 p-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/12 border border-emerald-500/20">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-2">{t("common.success")}</h2>
            <p className="text-white/50 text-sm leading-relaxed">
              {t("auth.reset_success")}
            </p>
            <div className="mt-4 h-1 rounded-full bg-white/8 overflow-hidden">
              <div className="h-full bg-gradient-gold animate-[shrink_3s_linear_forwards]" style={{ width: "100%" }} />
            </div>
          </div>

        ) : (
          <>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10 border border-gold/20">
              <ShieldCheck className="h-6 w-6 text-gold" />
            </div>

            <h1 className="font-display text-2xl font-bold mb-1.5">{t("auth.reset_password")}</h1>
            <p className="text-white/45 text-sm mb-8">{t("auth.reset_password_subtitle")}</p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <input
                  type={showPwd ? "text" : "password"}
                  required minLength={8}
                  placeholder={t("auth.new_password")}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`${INPUT_CLS} pr-11`}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <input
                  type={showCfm ? "text" : "password"}
                  required minLength={8}
                  placeholder={t("auth.confirm_password")}
                  value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className={`${INPUT_CLS} pr-11 ${confirm && confirm !== password ? "border-red-500/50" : ""}`}
                />
                <button type="button" onClick={() => setShowCfm(!showCfm)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                  {showCfm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <p className="text-[11px] text-white/30">{t("auth.password_too_short")}</p>

              {error && (
                <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-gold text-[#1a1204] font-semibold py-3 rounded-xl shadow-lg shadow-gold/25 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center gap-2 mt-1"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("auth.set_new_password")}
              </button>
            </form>

            <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/80 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
