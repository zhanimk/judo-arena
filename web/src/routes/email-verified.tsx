import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
const emblem = "/main-logo.png";

export const Route = createFileRoute("/email-verified")({
  head: () => ({ meta: [{ title: "Email расталды — Judo-Arena" }] }),
  validateSearch: (search: Record<string, unknown>): { email?: string } => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: EmailVerified,
});

function EmailVerified() {
  const { email } = Route.useSearch();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-4">
      <div className="w-full max-w-md rounded-3xl border border-emerald-500/20 bg-card/80 p-8 text-center shadow-elegant backdrop-blur">
        <img src={emblem} alt="" className="mx-auto mb-6 h-16 w-16 rounded-full object-cover" />
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        </div>
        <h1 className="font-display text-2xl font-bold">Email сәтті расталды!</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {email ? `${email} мекенжайы расталды.` : "Email мекенжайыңыз расталды."} Енді Judo-Arena
          мүмкіндіктерін толық пайдалана аласыз.
        </p>
        <Link
          to="/login"
          className="mt-7 inline-flex rounded-xl bg-gradient-gold px-6 py-3 font-semibold text-gold-foreground shadow-gold"
        >
          Кіру бетіне өту
        </Link>
      </div>
    </div>
  );
}
