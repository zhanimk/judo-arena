/**
 * Страница «Барлық торлар» (Все сетки) для админа.
 * Показывает все сетки всех турниров с возможностью переключения категорий
 * и просмотра в Olympic-style визуализации.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { ArrowLeft, GitBranch, Trophy, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState, useMemo } from "react";
import { OlympicBracket } from "@/components/judo/OlympicBracket";
import { useRealtime } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/brackets")({
  head: () => ({ meta: [{ title: "Торлар — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminBrackets />
    </ProtectedRoute>
  ),
});

function AdminBrackets() {
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const tournamentsQuery = useQuery({
    queryKey: ["admin-all-tournaments-brackets"],
    queryFn: () => api.tournaments.list(),
  });

  // Все сетки выбранного турнира
  const bracketsQuery = useQuery({
    queryKey: ["admin-all-brackets-for-tournament", selectedTournament],
    queryFn: () => api.brackets.forTournament(selectedTournament),
    enabled: !!selectedTournament,
  });

  // Все турниры с категориями для общего списка
  const allBracketsQuery = useQuery({
    queryKey: ["admin-all-brackets-overview", (tournamentsQuery.data?.items ?? []).map((t: any) => t.id).join(",")],
    queryFn: async () => {
      const all: any[] = [];
      for (const t of tournamentsQuery.data?.items ?? []) {
        try {
          const brackets = await api.brackets.forTournament(t.id);
          for (const b of brackets) {
            all.push({ ...b, tournament: t, tournamentName: localizeName(t.name) });
          }
        } catch { /* ignore */ }
      }
      return all;
    },
    enabled: (tournamentsQuery.data?.items ?? []).length > 0,
  });

  const tournaments = tournamentsQuery.data?.items ?? [];

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle="Барлық торлар">
      {/* Селектор турнира */}
      <Panel
        title="Жарысты таңдау"
        action={
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedTournament}
              onChange={(e) => { setSelectedTournament(e.target.value); setSelectedCategory(""); }}
              className="text-sm bg-input border border-border rounded px-2 py-1.5"
            >
              <option value="">— барлығы (тізім) —</option>
              {tournaments.map((t: any) => (
                <option key={t.id} value={t.id}>{localizeName(t.name)} · {t.city}</option>
              ))}
            </select>
          </div>
        }
      >
        {!selectedTournament ? (
          // Общий список всех сеток
          allBracketsQuery.isLoading ? <LoadingState /> :
            (allBracketsQuery.data ?? []).length === 0 ? (
              <EmptyState
                title="Әзірше торлар жоқ"
                hint="Жарыстар Тіркеу жабылғаннан кейін торлар құруға болады"
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {allBracketsQuery.data!.map((b: any) => (
                  <button
                    key={b.id}
                    onClick={() => { setSelectedTournament(b.tournament.id); setSelectedCategory(b.categoryId); }}
                    className="text-left glass rounded-xl p-4 hover:border-gold/40 transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-lg font-semibold truncate">
                          {b.category?.gender === "MALE" ? "Ер" : "Әйел"} {b.category?.weightMin}-{b.category?.weightMax} кг
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{b.tournamentName}</div>
                      </div>
                      <div className="text-2xl font-display text-gold">{b.size}</div>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">
                        {b.format === "ROUND_ROBIN" ? "Круговая" : "SE + Repechage"}
                      </span>
                      <span className="text-gold">Қарау →</span>
                    </div>
                  </button>
                ))}
              </div>
            )
        ) : (
          // Селектор категорий для выбранного турнира
          <div>
            {bracketsQuery.isLoading ? <LoadingState /> :
              (bracketsQuery.data ?? []).length === 0 ? (
                <EmptyState title="Бұл жарыста торлар жоқ" />
              ) : (
                <div className="flex flex-wrap gap-2 mb-2">
                  {bracketsQuery.data!.map((b: any) => {
                    const active = selectedCategory === b.categoryId;
                    return (
                      <button
                        key={b.id}
                        onClick={() => setSelectedCategory(active ? "" : b.categoryId)}
                        className={`px-3 py-1.5 rounded text-sm transition ${
                          active
                            ? "bg-gradient-gold text-gold-foreground shadow-gold"
                            : "glass border border-border hover:border-gold/40"
                        }`}
                      >
                        {b.category?.gender === "MALE" ? "Ер" : "Әйел"} {b.category?.weightMin}-{b.category?.weightMax} кг
                        <span className="ml-2 text-[10px] opacity-70">({b.size})</span>
                      </button>
                    );
                  })}
                </div>
              )}
          </div>
        )}
      </Panel>

      {/* Визуальная сетка */}
      {selectedTournament && selectedCategory && (
        <div className="mt-6">
          <Panel title="Тор · Live визуализация">
            <LiveBracketView tournamentId={selectedTournament} categoryId={selectedCategory} />
          </Panel>
        </div>
      )}
    </DashboardShell>
  );
}

function LiveBracketView({ tournamentId, categoryId }: { tournamentId: string; categoryId: string }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["bracket-admin", tournamentId, categoryId],
    queryFn: () => api.brackets.getByCategory(tournamentId, categoryId),
  });

  useRealtime(
    query.data ? [`bracket:${query.data.id}`, `tournament:${tournamentId}`] : [],
    {
      "match:scoreUpdate": () => qc.invalidateQueries({ queryKey: ["bracket-admin", tournamentId, categoryId] }),
      "match:finished": () => qc.invalidateQueries({ queryKey: ["bracket-admin", tournamentId, categoryId] }),
      "match:started": () => qc.invalidateQueries({ queryKey: ["bracket-admin", tournamentId, categoryId] }),
    },
  );

  if (query.isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  if (query.error || !query.data) return <EmptyState title="Тор табылмады" />;

  return (
    <>
      <div className="flex justify-between items-center mb-4 text-sm">
        <div className="text-muted-foreground">
          {query.data.matches?.length ?? 0} матч · Формат: {query.data.format === "ROUND_ROBIN" ? "Круговая" : "SE + Repechage"}
        </div>
        <a
          href={api.admin.bracketPdfUrl(query.data.id)}
          target="_blank"
          rel="noopener"
          className="text-xs bg-gold/15 text-gold border border-gold/40 px-3 py-1.5 rounded"
        >
          📄 PDF
        </a>
      </div>
      <OlympicBracket
        matches={query.data.matches ?? []}
        size={query.data.size}
        format={query.data.format}
      />
    </>
  );
}

function localizeName(n: any): string { if (!n) return "—"; if (typeof n === "string") return n; return n.kk || n.ru || n.en || "—"; }
