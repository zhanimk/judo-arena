/**
 * Страница протокола — список завершённых турниров с PDF-протоколами.
 */

import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FileText, Loader2, Calendar, MapPin, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { Tournament } from "@/lib/api-types";

export const Route = createFileRoute("/protocol")({
  head: () => ({ meta: [{ title: "Хаттамалар — Judo Child League" }] }),
  errorComponent: RouteErrorUI,
  component: Protocol,
});

function Protocol() {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["completed-tournaments"],
    queryFn: () => api.tournaments.list({ status: "COMPLETED" }),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-hero opacity-60" />
        <div className="container mx-auto px-4 relative py-14 sm:py-20">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold mb-3">
            {t("protocol.official_docs")}
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
            {t("protocol.title_prefix")}{" "}
            <span className="text-gradient-gold italic">{t("protocol.title_highlight")}</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl">{t("protocol.description")}</p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 flex-1">
        {query.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gold" />
          </div>
        ) : (query.data?.items ?? []).length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <div className="text-lg font-medium">{t("protocol.empty")}</div>
            <div className="text-sm mt-1">{t("protocol.empty_hint")}</div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {query.data!.items.map((tournament: Tournament) => (
              <div key={tournament.id} className="glass rounded-xl p-5">
                <div className="font-display text-lg font-semibold mb-2">
                  {localizeName(tournament.name)}
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-gold/70" />
                    {new Date(tournament.endDate).toLocaleDateString("kk-KZ", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-gold/70" />
                    {tournament.city}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    to="/tournaments/$id"
                    params={{ id: tournament.id }}
                    className="flex-1 text-xs glass border border-border px-3 py-2 rounded text-center hover:border-gold/40"
                  >
                    {t("common.view")}
                  </Link>
                  <a
                    href={api.admin.protocolPdfUrl(tournament.id)}
                    target="_blank"
                    rel="noopener"
                    className="flex-1 text-xs bg-gradient-gold text-gold-foreground px-3 py-2 rounded shadow-gold text-center inline-flex items-center justify-center gap-1"
                  >
                    <Download className="h-3 w-3" /> PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
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
