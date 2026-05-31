import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/components/dashboard/DashboardShell";
import { api, ApiError } from "@/lib/api";
import { localizeName, formatWeighIn } from "./shared";

export function TournamentNotifyTab({ tournament }: { tournament: any }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const tournamentId = tournament.id;

  const fillWeighInTemplate = () => {
    setTitle(t("notify.weigh_in_title"));
    setBody(
      [
        `${localizeName(tournament.name)} ${t("notify.weigh_in_body_prefix")}:`,
        `${t("common.location")}: ${tournament.weighInLocation || tournament.location}, ${tournament.city}`,
        `${t("common.time")}: ${formatWeighIn(tournament)}`,
        tournament.mapUrl ? `${t("notify.map")}: ${tournament.mapUrl}` : null,
      ].filter(Boolean).join("\n"),
    );
  };

  const mut = useMutation({
    mutationFn: () =>
      api.notifications.broadcast({
        kind: "tournament",
        tournamentId,
        title,
        body,
        type: "tournament_update",
      }),
    onSuccess: (r) => {
      setResult(`✓ ${t("notify.sent_to", { count: r.count })}`);
      setTitle(""); setBody(""); setError("");
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  return (
    <Panel title={t("notify.panel_title")}>
      <p className="text-xs text-muted-foreground mb-4">
        {t("notify.panel_desc")}
      </p>
      <button
        type="button"
        onClick={fillWeighInTemplate}
        className="mb-4 inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/15"
      >
        <Clock className="h-4 w-4" /> {t("notify.weigh_in_template_btn")}
      </button>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">{t("notify.title_label")}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required
            className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
            placeholder={t("notify.title_placeholder")} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">{t("notify.body_label")}</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4}
            className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
            placeholder={t("notify.body_placeholder")} />
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {result && <div className="text-sm text-emerald-300">{result}</div>}
        <button type="submit" disabled={mut.isPending}
          className="bg-gradient-gold text-gold-foreground px-4 py-2 rounded font-medium shadow-gold inline-flex items-center gap-2 disabled:opacity-50">
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {t("common.send")}
        </button>
      </form>
    </Panel>
  );
}
