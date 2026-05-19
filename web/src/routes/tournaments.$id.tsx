/**
 * Детальная страница турнира — публичная.
 * Показывает: описание, категории с количеством участников,
 * сетки (если есть), последние результаты.
 */

import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Calendar, Clock, MapPin, Users, Loader2, Trophy, GitBranch } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LiveBracket } from "@/components/judo/LiveBracket";
import { useState } from "react";

export const Route = createFileRoute("/tournaments/$id")({
  head: () => ({ meta: [{ title: "Жарыс — Judo-Arena" }] }),
  component: TournamentDetail,
});

function TournamentDetail() {
  const { id } = useParams({ from: "/tournaments/$id" });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const tQuery = useQuery({ queryKey: ["tournament", id], queryFn: () => api.tournaments.get(id) });
  const bracketsQuery = useQuery({
    queryKey: ["tournament-brackets", id],
    queryFn: () => api.brackets.forTournament(id),
    enabled: !!id,
  });

  if (tQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <Loader2 className="h-10 w-10 animate-spin text-gold" />
      </div>
    );
  }

  if (tQuery.error) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-destructive font-display text-2xl">Жарыс табылмады</div>
            <Link to="/tournaments" className="mt-4 inline-block text-gold underline">
              Жарыстарға қайту
            </Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const t = tQuery.data;
  const name = localizeName(t.name);
  const desc = localizeName(t.description);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-hero opacity-70" />
        <div className="container mx-auto px-4 relative py-14 sm:py-20">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <StatusBadge status={t.status} />
            <span className="text-xs text-muted-foreground">
              Жасаған: {t.createdBy?.name} {t.createdBy?.surname}
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
            {name}
          </h1>
          {desc && <p className="mt-4 text-muted-foreground max-w-2xl">{desc}</p>}

          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Info icon={Calendar}>{new Date(t.startDate).toLocaleDateString("kk-KZ")} — {new Date(t.endDate).toLocaleDateString("kk-KZ")}</Info>
            <Info icon={MapPin}>{t.location}, {t.city}</Info>
            <Info icon={Clock}>{formatWeighIn(t)}</Info>
            <Info icon={Users}>{t._count?.applications ?? 0} өтінім</Info>
            <Info icon={GitBranch}>{t.tatamiCount} татами</Info>
          </div>
          {t.mapUrl && (
            <a
              href={t.mapUrl}
              target="_blank"
              rel="noopener"
              className="mt-5 inline-flex rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm text-gold hover:bg-gold/15"
            >
              Картадан ашу
            </a>
          )}
        </div>
      </section>

      <section className="container mx-auto grid gap-6 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="glass rounded-xl p-5">
          <h2 className="font-display text-2xl font-bold">Взвешивание</h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <Info icon={MapPin}>{t.weighInLocation || t.location}, {t.city}</Info>
            <Info icon={Clock}>{formatWeighIn(t)}</Info>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
          <iframe
            title="Tournament map"
            src={mapEmbedUrl(t)}
            className="h-64 w-full border-0"
            loading="lazy"
          />
        </div>
      </section>

      {/* Категории */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="font-display text-3xl font-bold mb-6">Санаттар</h2>
        {(t.categories ?? []).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Әзірше санаттар қосылмаған.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {t.categories.map((c: any) => {
              const bracket = bracketsQuery.data?.find((b: any) => b.categoryId === c.id);
              return (
                <div key={c.id} className="glass rounded-xl p-5">
                  <div className="font-display text-lg font-semibold mb-1">
                    {localizeName(c.name) || `${c.gender === "MALE" ? "Ер" : "Әйел"} ${c.weightMin}-${c.weightMax} кг`}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>{c.gender === "MALE" ? "Ер" : "Әйел"} · {c.ageMin}-{c.ageMax} жас</div>
                    <div>{c.weightMin}-{c.weightMax} кг · {c.matchDurationSec}с матч</div>
                    <div className="mt-1">
                      <FormatBadge format={c.format} />
                    </div>
                  </div>
                  {bracket && (
                    <div className="mt-3 pt-3 border-t border-border/30 flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Тор дайын: {bracket.size} орын</span>
                      <a
                        href={api.admin.bracketPdfUrl(bracket.id)}
                        target="_blank"
                        rel="noopener"
                        className="text-gold hover:underline"
                      >
                        PDF →
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Сетки */}
      {(bracketsQuery.data ?? []).length > 0 && (
        <section className="container mx-auto px-4 py-12 border-t border-border/40">
          <h2 className="font-display text-3xl font-bold mb-6">Торлар (live)</h2>

          {/* Селектор категорий */}
          <div className="flex flex-wrap gap-2 mb-6">
            {bracketsQuery.data!.map((b: any) => {
              const active = selectedCategoryId === b.categoryId;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedCategoryId(active ? null : b.categoryId)}
                  className={`px-4 py-2 rounded-md text-sm transition ${
                    active
                      ? "bg-gradient-gold text-gold-foreground shadow-gold"
                      : "glass border border-border hover:border-gold/40"
                  }`}
                >
                  {localizeName(b.category?.name) || `${b.category?.weightMin}-${b.category?.weightMax} кг`}
                  <span className="ml-2 text-[10px] opacity-70">({b.size})</span>
                </button>
              );
            })}
          </div>

          {/* Визуальная сетка */}
          {selectedCategoryId ? (
            <div className="glass rounded-2xl p-6 border border-gold/20">
              <LiveBracket tournamentId={id} categoryId={selectedCategoryId} />
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Толық торды көру үшін санатты таңдаңыз ↑
            </div>
          )}

          {/* Список всех сеток */}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {bracketsQuery.data!.map((b: any) => (
              <div key={b.id} className="glass rounded-xl p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-display text-lg font-semibold">
                      {localizeName(b.category?.name) || `${b.category?.weightMin}-${b.category?.weightMax} кг`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {b.format === "ROUND_ROBIN" ? "Круговая система" : "Single Elimination + Repechage"}
                    </div>
                  </div>
                  <span className="text-2xl font-display text-gold">{b.size}</span>
                </div>
                <div className="mt-3 flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">{b._count?.matches ?? 0} жекпе-жек</span>
                  <a
                    href={api.admin.bracketPdfUrl(b.id)}
                    target="_blank"
                    rel="noopener"
                    className="text-gold hover:underline"
                  >
                    PDF →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PDF протокола если завершён */}
      {t.status === "COMPLETED" && (
        <section className="container mx-auto px-4 py-12 border-t border-border/40 text-center">
          <Trophy className="h-12 w-12 text-gold mx-auto mb-3" />
          <h2 className="font-display text-2xl font-bold mb-3">Жарыс аяқталды</h2>
          <a
            href={api.admin.protocolPdfUrl(t.id)}
            target="_blank"
            rel="noopener"
            className="inline-block bg-gradient-gold text-gold-foreground px-6 py-3 rounded-md shadow-gold"
          >
            📄 Ресми хаттаманы жүктеу
          </a>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}

function Info({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4 text-gold/70" /> {children}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { c: string; l: string }> = {
    DRAFT: { c: "bg-muted text-muted-foreground", l: "Жоба" },
    REGISTRATION_OPEN: { c: "bg-gold/15 text-gold border border-gold/30", l: "Тіркеу ашық" },
    REGISTRATION_CLOSED: { c: "bg-amber-500/15 text-amber-300 border border-amber-500/30", l: "Тіркеу жабық" },
    IN_PROGRESS: { c: "bg-destructive/20 text-destructive border border-destructive/40", l: "LIVE" },
    COMPLETED: { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", l: "Аяқталды" },
  };
  const x = m[status] ?? { c: "bg-muted", l: status };
  return <span className={`text-xs px-3 py-1 rounded-full ${x.c}`}>{x.l}</span>;
}

function FormatBadge({ format }: { format: string }) {
  const m: Record<string, string> = {
    SE_IJF: "Single Elimination + Repechage",
    ROUND_ROBIN: "Round-Robin (круговая)",
    MIXED: "Mixed",
  };
  return <span className="text-[10px] px-2 py-0.5 rounded bg-gold/10 text-gold/90">{m[format] ?? format}</span>;
}

function mapEmbedUrl(t: any): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(`${t.location}, ${t.city}`)}&output=embed`;
}

function formatWeighIn(t: any): string {
  const start = t.weighInStart ? new Date(t.weighInStart).toLocaleString("kk-KZ") : "";
  const end = t.weighInEnd ? new Date(t.weighInEnd).toLocaleString("kk-KZ") : "";
  return start && end ? `${start} — ${end}` : start || "время взвешивания будет позже";
}

function localizeName(n: any): string {
  if (!n) return "";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "";
}
