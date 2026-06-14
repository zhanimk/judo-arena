import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, Link } from "@tanstack/react-router";
import emblem from "@/assets/jcl-logo.jpeg";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Loader2, Mail, ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Құпиясөзді ұмыттым — Judo-Arena" }] }),
  errorComponent: RouteErrorUI,
  component: ForgotPassword,
});

const INPUT_CLS =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pl-11 text-sm text-white placeholder:text-white/35 transition-all focus:border-gold/60 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-gold/20 backdrop-blur-sm";

function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

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
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6"
      style={{ background: "linear-gradient(135deg,#050814 0%,#0a1128 40%,#060d1e 100%)" }}
    >
      {/* bg orbs */}
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle,rgba(200,146,42,0.10) 0%,transparent 65%)",
            filter: "blur(48px)",
          }}
        />
        <div
          className="absolute -bottom-24 -right-24 w-[400px] h-[400px] rounded-full"
          style={{
            background: "radial-gradient(circle,rgba(26,58,122,0.22) 0%,transparent 65%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* logo */}
        <Link to="/" className="mb-8 flex items-center gap-3 group">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-gold/30 transition-transform group-hover:scale-105">
            <img src={emblem} alt="JCL" className="h-full w-full object-cover" />
          </span>
          <span className="font-display text-lg font-black text-white tracking-tight">
            JUDO<span style={{ color: "#c8922a" }}>·</span>ARENA
          </span>
        </Link>

        {/* card */}
        <div
          className="rounded-3xl p-6 sm:p-8"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            backdropFilter: "blur(32px)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset",
          }}
        >
          {sent ? (
            /* ── SUCCESS STATE ── */
            <div className="text-center py-4">
              <div
                className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
                style={{
                  background: "rgba(34,197,94,0.12)",
                  border: "1px solid rgba(34,197,94,0.25)",
                }}
              >
                <CheckCircle2 className="h-9 w-9 text-emerald-400" />
              </div>
              <h2
                className="font-black text-2xl text-white mb-3"
                style={{ letterSpacing: "-0.02em" }}
              >
                {t("auth.reset_email_sent")}
              </h2>
              <p
                className="text-sm leading-relaxed mb-2"
                style={{ color: "rgba(255,255,255,0.50)" }}
              >
                {t("auth.reset_email_sent_to")}
              </p>
              <p className="font-semibold text-base mb-6" style={{ color: "#e8a93a" }}>
                {email}
              </p>
              <p
                className="text-xs leading-relaxed mb-8"
                style={{ color: "rgba(255,255,255,0.38)" }}
              >
                {t("auth.reset_check_spam")}
              </p>

              {/* resend */}
              <button
                onClick={() => setSent(false)}
                className="mb-4 text-xs transition-colors hover:text-[#c8922a]"
                style={{ color: "rgba(255,255,255,0.40)" }}
              >
                {t("auth.resend")}
              </button>

              <div className="h-px mb-6" style={{ background: "rgba(255,255,255,0.07)" }} />

              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:text-[#c8922a]"
                style={{ color: "rgba(255,255,255,0.50)" }}
              >
                <ArrowLeft className="h-4 w-4" /> {t("auth.back_to_login")}
              </Link>
            </div>
          ) : (
            /* ── FORM STATE ── */
            <>
              {/* header */}
              <div className="mb-7">
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{
                    background: "rgba(200,146,42,0.12)",
                    border: "1px solid rgba(200,146,42,0.25)",
                  }}
                >
                  <KeyRound className="h-5 w-5 text-[#c8922a]" />
                </div>
                <h1
                  className="font-black text-2xl text-white mb-2"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {t("auth.forgot_password")}
                </h1>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {t("auth.forgot_password_hint")}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
                    <Mail className="h-4 w-4" />
                  </span>
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

                {error && (
                  <div
                    className="flex items-start gap-2.5 rounded-xl p-3 text-sm"
                    style={{
                      color: "#f87171",
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.20)",
                    }}
                  >
                    <span className="mt-0.5 shrink-0">⚠</span>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                  style={{
                    background: "linear-gradient(135deg,#f0c040,#c8922a)",
                    color: "#1a0e00",
                    boxShadow: "0 8px 28px rgba(200,146,42,0.40)",
                    letterSpacing: "0.01em",
                  }}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? t("common.sending") : t("auth.send_reset_link")}
                </button>
              </form>

              <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[#c8922a]"
                  style={{ color: "rgba(255,255,255,0.40)" }}
                >
                  <ArrowLeft className="h-4 w-4" /> {t("common.back")}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
