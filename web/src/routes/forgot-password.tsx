import { createFileRoute, Link } from "@tanstack/react-router";
import emblem from "@/assets/jcl-logo.jpeg";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Loader2, Mail, ArrowLeft, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Құпиясөзді ұмыттым — Judo-Arena" }] }),
  component: ForgotPassword,
});

const INPUT_CLS =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-11 text-sm placeholder:text-white/30 focus:border-gold/60 focus:outline-none transition-all";

function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.forgotPassword(email);
      setSent(true);
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

        {sent ? (
          <div className="rounded-2xl bg-white/4 border border-white/8 p-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/12 border border-emerald-500/20">
              <Mail className="h-7 w-7 text-emerald-400" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-2">{t("auth.reset_link_sent").split(".")[0]}</h2>
            <p className="text-white/50 text-sm leading-relaxed mb-6">
              <span className="text-white/80 font-medium">{email}</span>
              {" "}{t("auth.reset_link_sent")}
            </p>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-gold transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back")}
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10 border border-gold/20">
              <KeyRound className="h-6 w-6 text-gold" />
            </div>

            <h1 className="font-display text-2xl font-bold mb-1.5">{t("auth.forgot_password")}</h1>
            <p className="text-white/45 text-sm mb-8">{t("auth.reset_password_subtitle")}</p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email" required placeholder={t("common.email")}
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={INPUT_CLS}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-gold text-[#1a1204] font-semibold py-3 rounded-xl shadow-lg shadow-gold/25 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("auth.send_reset_link")}
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
