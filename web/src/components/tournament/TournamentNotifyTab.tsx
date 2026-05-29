import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send, Clock } from "lucide-react";
import { Panel } from "@/components/dashboard/DashboardShell";
import { api, ApiError } from "@/lib/api";
import { localizeName, formatWeighIn } from "./shared";

export function TournamentNotifyTab({ tournament }: { tournament: any }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const tournamentId = tournament.id;

  const fillWeighInTemplate = () => {
    setTitle("Взвешивание туралы хабарландыру");
    setBody(
      [
        `${localizeName(tournament.name)} жарысына взвешивание:`,
        `Орын: ${tournament.weighInLocation || tournament.location}, ${tournament.city}`,
        `Уақыты: ${formatWeighIn(tournament)}`,
        tournament.mapUrl ? `Карта: ${tournament.mapUrl}` : null,
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
      setResult(`✓ Жіберілді ${r.count} адамға`);
      setTitle(""); setBody(""); setError("");
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  return (
    <Panel title="Қатысушыларға хабарландыру жіберу">
      <p className="text-xs text-muted-foreground mb-4">
        Бекітілген өтінімдегі барлық тренерлер мен спортшылар хабарландыру алады.
      </p>
      <button
        type="button"
        onClick={fillWeighInTemplate}
        className="mb-4 inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/15"
      >
        <Clock className="h-4 w-4" /> Взвешивание шаблонын қою
      </button>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Тақырып</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required
            className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
            placeholder="Мысалы: Жарыс уақыты өзгерді" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Мәтін</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4}
            className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
            placeholder="Толық хабарлама..." />
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {result && <div className="text-sm text-emerald-300">{result}</div>}
        <button type="submit" disabled={mut.isPending}
          className="bg-gradient-gold text-gold-foreground px-4 py-2 rounded font-medium shadow-gold inline-flex items-center gap-2 disabled:opacity-50">
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Жіберу
        </button>
      </form>
    </Panel>
  );
}
