import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Clock } from "lucide-react";
import { Panel } from "@/components/dashboard/DashboardShell";
import { api, ApiError } from "@/lib/api";
import { Field, Input, localizeName, formatWeighIn, toDateTimeLocal, mapEmbedUrl } from "./shared";

export function TournamentOverviewTab({ tournament: t }: { tournament: any }) {
  const qc = useQueryClient();
  const [posterUrl, setPosterUrl] = useState(t.posterUrl ?? "");
  const [mapUrl, setMapUrl] = useState(t.mapUrl ?? "");
  const [weighInLocation, setWeighInLocation] = useState(t.weighInLocation ?? "");
  const [weighInStart, setWeighInStart] = useState(toDateTimeLocal(t.weighInStart ?? ""));
  const [weighInEnd, setWeighInEnd] = useState(toDateTimeLocal(t.weighInEnd ?? ""));
  const [applicationDeadline, setApplicationDeadline] = useState(toDateTimeLocal(t.applicationDeadline ?? t.startDate));
  const [error, setError] = useState("");
  const savePoster = useMutation({
    mutationFn: () => api.tournaments.update(t.id, {
      posterUrl: posterUrl || null,
      mapUrl: mapUrl || null,
      weighInLocation: weighInLocation || null,
      weighInStart: weighInStart ? new Date(weighInStart).toISOString() : null,
      weighInEnd: weighInEnd ? new Date(weighInEnd).toISOString() : null,
      applicationDeadline: applicationDeadline ? new Date(applicationDeadline).toISOString() : null,
    }),
    onSuccess: () => {
      setError("");
      qc.invalidateQueries({ queryKey: ["admin-tournament", t.id] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Положение сақталмады"),
  });

  return (
    <Panel title="Жалпы ақпарат">
      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <Field label="Атауы" value={localizeName(t.name)} />
        <Field label="Орын" value={`${t.location}, ${t.city}`} />
        <Field label="Басталу" value={new Date(t.startDate).toLocaleString("kk-KZ")} />
        <Field label="Аяқталу" value={new Date(t.endDate).toLocaleString("kk-KZ")} />
        <Field label="Өтінім дедлайны" value={t.applicationDeadline ? new Date(t.applicationDeadline).toLocaleString("kk-KZ") : new Date(t.startDate).toLocaleString("kk-KZ")} />
        <Field label="Взвешивание" value={formatWeighIn(t)} />
        <Field label="Татами" value={String(t.tatamiCount)} />
        <Field label="Санаттар" value={String(t.categories?.length ?? 0)} />
        <Field label="Өтінімдер" value={String(t._count?.applications ?? 0)} />
        <Field label="Тіл" value={t.primaryLocale} />
      </div>
      <div className="mt-4 grid gap-4 border-t border-border/30 pt-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
        <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Положение, карта және взвешивание</div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="URL"
              type="url"
              value={posterUrl}
              onChange={setPosterUrl}
              placeholder="https://..."
            />
            <Input
              label="Өтінім дедлайны"
              type="datetime-local"
              value={applicationDeadline}
              onChange={setApplicationDeadline}
            />
            <Input
              label="Карта URL"
              type="url"
              value={mapUrl}
              onChange={setMapUrl}
              placeholder="Google Maps / 2GIS"
            />
            <Input
              label="Взвешивание орны"
              value={weighInLocation}
              onChange={setWeighInLocation}
              placeholder="Спортзал, кабинет, вход..."
            />
            <Input
              label="Взвешивание басталуы"
              type="datetime-local"
              value={weighInStart}
              onChange={setWeighInStart}
            />
            <Input
              label="Взвешивание аяқталуы"
              type="datetime-local"
              value={weighInEnd}
              onChange={setWeighInEnd}
            />
          </div>
          <button
            type="button"
            onClick={() => savePoster.mutate()}
            disabled={savePoster.isPending}
            className="self-end rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-gold-foreground shadow-gold disabled:opacity-50"
          >
            Сақтау
          </button>
        </div>
        {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
        {t.posterUrl && (
          <a
            href={t.posterUrl}
            target="_blank"
            rel="noopener"
            className="mt-3 inline-flex rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/15"
          >
            Ашу
          </a>
        )}
        {t.mapUrl && (
          <a
            href={t.mapUrl}
            target="_blank"
            rel="noopener"
            className="ml-2 mt-3 inline-flex rounded-md border border-border bg-card/50 px-3 py-2 text-sm hover:border-gold/40"
          >
            Карта сілтемесі
          </a>
        )}
        </div>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
          <iframe
            title="Tournament map"
            src={mapEmbedUrl(t)}
            className="h-64 w-full border-0"
            loading="lazy"
          />
          <div className="space-y-2 p-3 text-sm">
            <div className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <div>
                <div className="font-medium">{t.location}</div>
                <div className="text-xs text-muted-foreground">{t.city}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <div>
                <div className="font-medium">Взвешивание</div>
                <div className="text-xs text-muted-foreground">{formatWeighIn(t)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {t.description && (
        <div className="mt-4 pt-4 border-t border-border/30">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Сипаттама</div>
          <p className="text-sm leading-relaxed">{localizeName(t.description)}</p>
        </div>
      )}
    </Panel>
  );
}
