import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, Wand2, Monitor, ExternalLink, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel, EmptyState } from "@/components/dashboard/DashboardShell";
import { api, ApiError } from "@/lib/api";
import { LiveBracket } from "@/components/judo/LiveBracket";
import { DurationEstimate, categoryTitle, weightLabel } from "./shared";

function CategoryPills({
  items,
  selected,
  onSelect,
}: {
  items: Array<{ category: any; bracket?: any; participants: number }>;
  selected: string | null;
  onSelect: (categoryId: string) => void;
}) {
  const { t } = useTranslation();
  const male = items.filter((item) => item.category.gender === "MALE");
  const female = items.filter((item) => item.category.gender === "FEMALE");
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-4">
      {[
        { labelKey: "bracket.male_label", symbol: "♂", items: male },
        { labelKey: "bracket.female_label", symbol: "♀", items: female },
      ].map((group) => (
        <div key={group.labelKey} className="flex flex-wrap items-center gap-2 py-1.5">
          <div className="w-16 text-sm font-semibold text-gold">
            {group.symbol} {t(group.labelKey)}
          </div>
          {group.items.length === 0 ? (
            <span className="text-xs text-muted-foreground">{t("bracket.no_category_here")}</span>
          ) : (
            group.items.map((item) => {
              const active = selected === item.category.id;
              const ready = Boolean(item.bracket);
              return (
                <button
                  key={item.category.id}
                  type="button"
                  onClick={() => onSelect(item.category.id)}
                  className={`min-h-10 rounded-full px-4 text-sm font-medium transition ${
                    active
                      ? "bg-gradient-gold text-gold-foreground shadow-gold"
                      : ready
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : "bg-card/70 border border-border hover:border-gold/40"
                  }`}
                >
                  {weightLabel(item.category, t)} · {item.participants}
                </button>
              );
            })
          )}
        </div>
      ))}
    </div>
  );
}

function buildCategoryEntryCounts(applications: any[]) {
  const counts = new Map<string, number>();
  for (const app of applications) {
    if (app.status !== "APPROVED") continue;
    for (const entry of app.entries ?? []) {
      counts.set(entry.categoryId, (counts.get(entry.categoryId) ?? 0) + 1);
    }
  }
  return counts;
}

export function TournamentProtocolTab({ tournament }: { tournament: any }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [prepareResult, setPrepareResult] = useState<any | null>(null);
  const [prepareError, setPrepareError] = useState("");
  const bracketsQuery = useQuery({
    queryKey: ["protocol-brackets", tournament.id],
    queryFn: () => api.brackets.forTournament(tournament.id),
  });
  const matchesQuery = useQuery({
    queryKey: ["protocol-matches", tournament.id],
    queryFn: () => api.matches.list({ tournamentId: tournament.id, limit: 1000 }),
  });
  const applicationsQuery = useQuery({
    queryKey: ["protocol-applications", tournament.id],
    queryFn: () => api.tournaments.applications(tournament.id),
  });
  const prepare = useMutation({
    mutationFn: () => api.brackets.prepareTournament(tournament.id),
    onSuccess: (result) => {
      setPrepareResult(result);
      setPrepareError("");
      qc.invalidateQueries({ queryKey: ["protocol-brackets", tournament.id] });
      qc.invalidateQueries({ queryKey: ["protocol-matches", tournament.id] });
      qc.invalidateQueries({ queryKey: ["admin-tournament", tournament.id] });
    },
    onError: (e: any) => {
      setPrepareError(e instanceof ApiError ? e.message : t("bracket.prepare_error"));
      setPrepareResult(null);
    },
  });
  const generate = useMutation({
    mutationFn: (categoryId: string) => api.brackets.generate(tournament.id, categoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["protocol-brackets", tournament.id] });
      qc.invalidateQueries({ queryKey: ["protocol-matches", tournament.id] });
    },
  });
  const remove = useMutation({
    mutationFn: (bracketId: string) => api.brackets.delete(bracketId),
    onSuccess: () => {
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["protocol-brackets", tournament.id] });
      qc.invalidateQueries({ queryKey: ["protocol-matches", tournament.id] });
    },
  });
  const completed = (matchesQuery.data ?? []).filter((m: any) => m.status === "COMPLETED").length;
  const total = matchesQuery.data?.length ?? 0;
  const entryCountByCategory = buildCategoryEntryCounts(applicationsQuery.data ?? []);
  const categoryStatuses = (tournament.categories ?? []).map((category: any) => {
    const bkt = bracketsQuery.data?.find((b: any) => b.categoryId === category.id);
    return {
      category,
      bracket: bkt,
      participants: entryCountByCategory.get(category.id) ?? 0,
    };
  });
  const readyCategories = categoryStatuses.filter((item: any) => item.bracket).length;
  const progress =
    (tournament.categories?.length ?? 0) > 0
      ? Math.round((readyCategories / (tournament.categories?.length ?? 1)) * 100)
      : 0;
  const playableTotal = (matchesQuery.data ?? []).filter(
    (m: any) => m.redAthlete && m.blueAthlete,
  ).length;

  return (
    <div className="space-y-6">
      <Panel title={t("bracket.panel_title")}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => prepare.mutate()}
                disabled={
                  prepare.isPending ||
                  tournament.status === "DRAFT" ||
                  tournament.status === "REGISTRATION_OPEN"
                }
                className="inline-flex min-h-12 items-center gap-2 rounded-md bg-gradient-gold px-5 py-3 text-sm font-semibold text-gold-foreground shadow-gold disabled:opacity-50"
              >
                {prepare.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {t("bracket.prepare_btn")}
              </button>
              <Link
                to="/admin/tournaments/$id"
                params={{ id: tournament.id }}
                search={{ tab: "scoreboard" }}
                className="inline-flex min-h-12 items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold hover:bg-gold/15"
              >
                <Monitor className="h-4 w-4" /> {t("bracket.scoreboard_btn")}
              </Link>
              <Link
                to="/live-wall/$tournamentId"
                params={{ tournamentId: tournament.id }}
                target="_blank"
                className="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-card/50 px-4 py-3 text-sm hover:border-gold/40"
              >
                <ExternalLink className="h-4 w-4" /> {t("bracket.projector_btn")}
              </Link>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t("bracket.prepare_desc")}</p>
            {prepareError && (
              <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {prepareError}
              </div>
            )}
            {prepareResult && (
              <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                <div>
                  {t("bracket.prepare_ready", {
                    brackets: prepareResult.totals?.bracketsCreated ?? 0,
                    existing: prepareResult.totals?.bracketsExisting ?? 0,
                    matches: prepareResult.totals?.playableMatches ?? 0,
                  })}
                </div>
                {prepareResult.tatami?.loads?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {prepareResult.tatami.loads.map((load: any) => (
                      <span
                        key={load.tatamiNumber}
                        className="rounded-full border border-emerald-500/30 bg-background/30 px-2.5 py-1"
                      >
                        {t("bracket.tatami_load", {
                          n: load.tatamiNumber,
                          cats: load.categories ?? 0,
                          matches: load.matches ?? 0,
                        })}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <div className="rounded-md border border-border/60 bg-background/30 p-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
              <span>{t("bracket.readiness")}</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              {t("bracket.readiness_desc", {
                ready: readyCategories,
                total: tournament.categories?.length ?? 0,
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-md border border-border/60 bg-background/30 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("bracket.stat_categories")}
            </div>
            <div className="mt-2 font-display text-3xl font-bold">
              {tournament.categories?.length ?? 0}
            </div>
          </div>
          <div className="rounded-md border border-border/60 bg-background/30 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("bracket.stat_brackets")}
            </div>
            <div className="mt-2 font-display text-3xl font-bold">
              {bracketsQuery.data?.length ?? 0}
            </div>
          </div>
          <div className="rounded-md border border-border/60 bg-background/30 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("bracket.stat_matches")}
            </div>
            <div className="mt-2 font-display text-3xl font-bold">
              {completed}/{total}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("bracket.stat_ready_pairs", { n: playableTotal })}
            </div>
          </div>
          <div className="rounded-md border border-border/60 bg-background/30 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("bracket.stat_tatami")}
            </div>
            <div className="mt-2 font-display text-3xl font-bold">{tournament.tatamiCount}</div>
          </div>
        </div>

        {playableTotal > 0 && tournament.tatamiCount > 0 && (
          <DurationEstimate
            categories={tournament.categories ?? []}
            matches={matchesQuery.data ?? []}
            tatamiCount={tournament.tatamiCount}
          />
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={api.admin.allBracketsPdfUrl(tournament.id)}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-md border border-gold/40 px-4 py-2 text-sm font-medium text-gold hover:border-gold/70"
          >
            <FileText className="h-4 w-4" /> {t("bracket.all_pdf")}
          </a>
          <a
            href={api.admin.protocolPdfUrl(tournament.id)}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-gold-foreground shadow-gold"
          >
            <FileText className="h-4 w-4" /> {t("bracket.protocol_pdf")}
          </a>
          <Link
            to="/tournaments/$id"
            params={{ id: tournament.id }}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {t("bracket.public_page")}
          </Link>
        </div>
      </Panel>

      <Panel title={t("bracket.categories_panel")}>
        <CategoryPills
          items={categoryStatuses}
          selected={selected}
          onSelect={(categoryId) => setSelected(selected === categoryId ? null : categoryId)}
        />
        <div className="mt-5 space-y-2">
          {categoryStatuses.map(({ category: c, bracket, participants }: any) => {
            return (
              <div
                key={c.id}
                className="rounded-md border border-border/60 bg-background/30 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{categoryTitle(c, t)}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("bracket.participants", { n: participants })} ·{" "}
                      {bracket
                        ? t("bracket.match_bracket_info", {
                            matches: bracket._count?.matches ?? 0,
                            size: bracket.size,
                          })
                        : t("bracket.no_bracket")}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {bracket ? (
                      <>
                        <button
                          onClick={() => setSelected(selected === c.id ? null : c.id)}
                          className="rounded-md border border-gold/30 px-2.5 py-1 text-xs text-gold hover:border-gold/60"
                        >
                          {selected === c.id ? t("bracket.hide_live") : t("bracket.view_live")}
                        </button>
                        <a
                          href={api.admin.bracketPdfUrl(bracket.id)}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 rounded-md border border-gold/30 px-2.5 py-1 text-xs text-gold hover:border-gold/60"
                        >
                          <FileText className="h-3.5 w-3.5" /> PDF
                        </a>
                        <button
                          onClick={() => remove.mutate(bracket.id)}
                          disabled={remove.isPending}
                          className="rounded-md border border-destructive/30 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {t("bracket.delete")}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => generate.mutate(c.id)}
                        disabled={generate.isPending}
                        className="rounded-md border border-gold/40 bg-gold/15 px-2.5 py-1 text-xs text-gold disabled:opacity-50"
                      >
                        {t("bracket.generate")}
                      </button>
                    )}
                  </div>
                </div>
                {selected === c.id && bracket && (
                  <div className="mt-4 rounded-lg border border-gold/20 bg-background/40 p-4">
                    <LiveBracket tournamentId={tournament.id} categoryId={c.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {(tournament.categories ?? []).length === 0 && (
          <EmptyState title={t("bracket.no_categories")} hint={t("bracket.no_categories_hint")} />
        )}
      </Panel>
    </div>
  );
}
