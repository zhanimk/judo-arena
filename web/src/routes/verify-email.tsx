import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import emblem from "@/assets/jcl-logo.jpeg";
import { apiUrl } from "@/lib/api";

export const Route = createFileRoute("/verify-email")({
  head: () => ({ meta: [{ title: "Email растау — Judo-Arena" }] }),
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const { token } = Route.useSearch();

  useEffect(() => {
    if (!token) return;
    window.location.replace(apiUrl(`/api/auth/verify-email?token=${encodeURIComponent(token)}`));
  }, [token]);

  if (!token) {
    return (
      <EmailStatusCard
        title="Сілтеме жарамсыз"
        description="Email растау сілтемесінде токен жоқ. Жаңа растау хатын сұраңыз."
        action="/login"
        actionLabel="Кіру бетіне оралу"
        tone="error"
      />
    );
  }

  return (
    <EmailStatusCard
      title="Email расталып жатыр"
      description="Сілтемені тексеріп жатырмыз. Бір сәт күтіңіз."
      loading
    />
  );
}

function EmailStatusCard({
  title,
  description,
  action,
  actionLabel,
  loading = false,
  tone = "success",
}: {
  title: string;
  description: string;
  action?: "/login";
  actionLabel?: string;
  loading?: boolean;
  tone?: "success" | "error";
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-card/80 p-8 text-center shadow-elegant backdrop-blur">
        <img src={emblem} alt="" className="mx-auto mb-6 h-16 w-16 rounded-full object-cover" />
        {loading ? (
          <Loader2 className="mx-auto mb-5 h-10 w-10 animate-spin text-gold" />
        ) : (
          <div
            className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
              tone === "error"
                ? "border border-red-500/25 bg-red-500/10 text-red-400"
                : "border border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
            }`}
          >
            {tone === "error" ? "!" : "✓"}
          </div>
        )}
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {action && actionLabel ? (
          <Link
            to={action}
            className="mt-7 inline-flex rounded-xl bg-gradient-gold px-6 py-3 font-semibold text-gold-foreground shadow-gold"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
