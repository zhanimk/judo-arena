/**
 * Хаттамалар / Сетки — централизованный раздел для всех турниров.
 *
 * Один раздел в сайдбаре вместо разбросанных страниц.
 * Отображает все активные и завершённые турниры:
 *   - IN_PROGRESS: категории + ссылки на сетки PDF
 *   - COMPLETED: категории + ссылки на сетки PDF + финальный хаттама PDF
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  Trophy,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";
import { OlympicBracket } from "@/components/judo/OlympicBracket";

export const Route = createFileRoute("/admin/protocols")({
  head: () => ({ meta: [{ title: "Хаттамалар — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminProtocols />
    </ProtectedRoute>
  ),
});

const VISIBLE_STATUSES = ["IN_PROGRESS", "COMPLETED", "REGISTRATION_CLOSED"];

function AdminProtocols() {
  const [openTournament, setOpenTournament] = useState<string | null>(null);
  const [openBracket, setOpenBracket] = useState<{ tournamentId: string; categoryId: string } | null>(null);

  const tournamentsQuery = useQuery({
    queryKey: ["admin-protocols-tournaments"],
    queryFn: () => api.tournaments.list({ limit: 100 }),
  });

  const tournaments = (tournamentsQuery.data?.items ?? []).filter((t: any) =>
    VISIBLE_STATUSES.includes(t.status),
  );

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle="Хаттамалар / Сеткалар">
      <p className="mb-6 text-sm text-muted-foreground">
        Жарысқа сайкес категориялар, жеребе сеткалары және PDF хаттамалар — бір жерде.
      </p>

      {tournamentsQuery.isLoading ? (
        <LoadingState />
      ) : tournaments.length === 0 ? (
        <EmptyState
          title="Хаттамалар жоқ"
          hint="Тіркеу жабылған, жүріп жатқан немесе аяқталған жарыстар осында шығады"
        />
      ) : (
        <div className="space-y-4">
          {tournaments.map((t: any) => (
            <TournamentProtocolCard
              key={t.id}
              tournament={t}
              isOpen={openTournament === t.id}
              onToggle={() => setOpenTournament(openTournament === t.id ? null : t.id)}
              openBracket={openBracket}
              onToggleBracket={(catId) =>
                setOpenBracket(
                  openBracket !== null && openBracket.tournamentId === t.id && openBracket.categoryId === catId
                    ? null
                    : { tournamentId: t.id, categoryId: catId },
                )
              }
            />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function TournamentProtocolCard({
  tournament: t,
  isOpen,
  onToggle,
  openBracket,
  onToggleBracket,
}: {
  tournament: any;
  isOpen: boolean;
  onToggle: () => void;
  openBracket: { tournamentId: string; categoryId: string } | null;
  onToggleBracket: (catId: string) => void;
}) {
  const bracketsQuery = useQuery({
    queryKey: ["protocols-brackets", t.id],
    queryFn: () => api.brackets.forTournament(t.id),
    enabled: isOpen,
  });

  const brackets = bracketsQuery.data ?? [];
  const isCompleted = t.status === "COMPLETED";

  return (
    <div className="glass rounded-xl border border-border/60 overflow-hidden">
      {/* Шапка турнира */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-gold/5 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`shrink-0 h-2.5 w-2.5 rounded-full ${statusDot(t.status)}`} />
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold truncate">{localizeName(t.name)}</div>
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-gold/60" /> {t.city}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3 text-gold/60" />
                {new Date(t.startDate).toLocaleDateString("kk-KZ")}
                {" – "}
                {new Date(t.endDate).toLocaleDateString("kk-KZ")}
              </span>
              <span className="inline-flex items-center gap-1">
                <Trophy className="h-3 w-3 text-gold/60" />
                {t._count?.categories ?? 0} санат
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <TournamentStatusBadge status={t.status} />
          {isCompleted && (
            <a
              href={api.admin.protocolPdfUrl(t.id)}
              target="_blank"
              rel="noopener"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-gold px-3 py-1.5 text-xs font-medium text-gold-foreground shadow-gold"
            >
              <Download className="h-3.5 w-3.5" />
              Хаттама PDF
            </a>
          )}
          <Link
            to="/admin/tournaments/$id"
            params={{ id: t.id }}
            search={{ tab: "protocol" }}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-gold/40 hover:text-gold"
          >
            <ExternalLink className="h-3 w-3" />
            Басқару
          </Link>
          {isOpen ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Раскрытый список категорий */}
      {isOpen && (
        <div className="border-t border-border/40 bg-background/20 p-5">
          {bracketsQuery.isLoading ? (
            <LoadingState />
          ) : brackets.length === 0 ? (
            <div className="rounded-md border border-border/40 p-4 text-sm text-muted-foreground">
              Бұл жарыс үшін сеткалар жасалмаған.{" "}
              <Link
                to="/admin/tournaments/$id"
                params={{ id: t.id }}
                search={{ tab: "protocol" }}
                className="text-gold hover:underline"
              >
                Жасау →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {brackets.map((b: any) => {
                const catLabel = `${b.category?.gender === "MALE" ? "Ер" : "Қыз"} ${b.category?.weightMin ?? ""}–${b.category?.weightMax ?? ""} кг · ${b.category?.ageMin ?? ""}–${b.category?.ageMax ?? ""} жас`;
                const isShowingBracket =
                  openBracket !== null && openBracket.tournamentId === t.id && openBracket.categoryId === b.categoryId;

                return (
                  <div key={b.id} className="rounded-lg border border-border/50 bg-card/40">
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div>
                        <div className="font-medium text-sm">{catLabel}</div>
                        <div className="mt-0.5 flex gap-2 text-xs text-muted-foreground">
                          <span>{b.size} қатысушы</span>
                          <span>·</span>
                          <span>{b.format === "ROUND_ROBIN" ? "Round-Robin" : "Olympic / SE"}</span>
                          <span>·</span>
                          <span>{b.matches?.length ?? 0} матч</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => onToggleBracket(b.categoryId)}
                          className="inline-flex items-center gap-1 rounded-md border border-gold/30 px-3 py-1.5 text-xs text-gold hover:bg-gold/10"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {isShowingBracket ? "Жабу" : "Сетка"}
                        </button>
                        <a
                          href={api.admin.bracketPdfUrl(b.id)}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-gold/40 hover:text-gold"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </a>
                      </div>
                    </div>

                    {isShowingBracket && (
                      <div className="border-t border-border/40 p-4">
                        <OlympicBracket
                          matches={b.matches ?? []}
                          size={b.size}
                          format={b.format}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TournamentStatusBadge({ status }: { status: string }) {
  const m: Record<string, { c: string; l: string }> = {
    REGISTRATION_CLOSED: { c: "bg-amber-500/15 text-amber-300 border border-amber-500/30", l: "Тіркеу жабық" },
    IN_PROGRESS: { c: "bg-destructive/20 text-destructive border border-destructive/40", l: "LIVE" },
    COMPLETED: { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", l: "Аяқталды" },
  };
  const x = m[status] ?? { c: "bg-muted text-muted-foreground", l: status };
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] ${x.c}`}>{x.l}</span>;
}

function statusDot(status: string): string {
  if (status === "IN_PROGRESS") return "bg-destructive animate-pulse";
  if (status === "COMPLETED") return "bg-emerald-400";
  return "bg-amber-400";
}

function localizeName(n: any): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}
