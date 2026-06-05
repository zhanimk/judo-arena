import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Clock, Youtube } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/components/dashboard/DashboardShell";
import { api, ApiError } from "@/lib/api";
import { Field, Input, localizeName, formatWeighIn, toDateTimeLocal, mapEmbedUrl } from "./shared";

export function TournamentOverviewTab({ tournament: tourney }: { tournament: any }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [posterUrl, setPosterUrl] = useState(tourney.posterUrl ?? "");
  const [mapUrl, setMapUrl] = useState(tourney.mapUrl ?? "");
  const [weighInLocation, setWeighInLocation] = useState(tourney.weighInLocation ?? "");
  const [weighInStart, setWeighInStart] = useState(toDateTimeLocal(tourney.weighInStart ?? ""));
  const [weighInEnd, setWeighInEnd] = useState(toDateTimeLocal(tourney.weighInEnd ?? ""));
  const [applicationDeadline, setApplicationDeadline] = useState(
    toDateTimeLocal(tourney.applicationDeadline ?? tourney.startDate),
  );
  const [entryFeeKzt, setEntryFeeKzt] = useState(String(tourney.entryFeeKzt ?? 0));
  const [kaspiPaymentUrl, setKaspiPaymentUrl] = useState(tourney.kaspiPaymentUrl ?? "");
  const [error, setError] = useState("");

  const tatamiCount = Number(tourney.tatamiCount ?? 1);
  const initUrls = useMemo(() => {
    const saved: string[] = Array.isArray(tourney.youtubeUrls) ? tourney.youtubeUrls : [];
    return Array.from({ length: tatamiCount }, (_, i) => saved[i] ?? "");
  }, [tourney.youtubeUrls, tatamiCount]);
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>(initUrls);

  const savePoster = useMutation({
    mutationFn: () =>
      api.tournaments.update(tourney.id, {
        posterUrl: posterUrl || null,
        mapUrl: mapUrl || null,
        weighInLocation: weighInLocation || null,
        weighInStart: weighInStart ? new Date(weighInStart).toISOString() : null,
        weighInEnd: weighInEnd ? new Date(weighInEnd).toISOString() : null,
        applicationDeadline: applicationDeadline
          ? new Date(applicationDeadline).toISOString()
          : null,
        entryFeeKzt: Number(entryFeeKzt) || 0,
        kaspiPaymentUrl: kaspiPaymentUrl || null,
        youtubeUrls:
          youtubeUrls.map((u) => u.trim()).filter(Boolean).length > 0
            ? youtubeUrls.map((u) => u.trim())
            : null,
      }),
    onSuccess: () => {
      setError("");
      qc.invalidateQueries({ queryKey: ["admin-tournament", tourney.id] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  return (
    <Panel title={t("tournament.overview_label")}>
      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <Field label={t("tournament.name")} value={localizeName(tourney.name)} />
        <Field label={t("tournament.location")} value={`${tourney.location}, ${tourney.city}`} />
        <Field
          label={t("tournament.start_date")}
          value={new Date(tourney.startDate).toLocaleString()}
        />
        <Field
          label={t("tournament.end_date")}
          value={new Date(tourney.endDate).toLocaleString()}
        />
        <Field
          label={t("tournament.application_deadline")}
          value={
            tourney.applicationDeadline
              ? new Date(tourney.applicationDeadline).toLocaleString()
              : new Date(tourney.startDate).toLocaleString()
          }
        />
        <Field label={t("tournament.weigh_in_tab")} value={formatWeighIn(tourney, t)} />
        <Field label={t("common.tatami")} value={String(tourney.tatamiCount)} />
        <Field label={t("tournament.categories")} value={String(tourney.categories?.length ?? 0)} />
        <Field
          label={t("tournament.metric_applications")}
          value={String(tourney._count?.applications ?? 0)}
        />
        <Field label={t("payments.entry_fee")} value={formatKzt(tourney.entryFeeKzt ?? 0)} />
        <Field label={t("common.language")} value={tourney.primaryLocale} />
      </div>
      <div className="mt-4 grid gap-4 border-t border-border/30 pt-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            {t("tournament.poster")}, {t("tournament.map_link")}, {t("tournament.weigh_in_tab")}
          </div>
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
                label={t("tournament.application_deadline")}
                type="datetime-local"
                value={applicationDeadline}
                onChange={setApplicationDeadline}
              />
              <Input
                label={t("tournament.map_url")}
                type="url"
                value={mapUrl}
                onChange={setMapUrl}
                placeholder="Google Maps / 2GIS"
              />
              <Input
                label={t("tournament.weigh_in_location")}
                value={weighInLocation}
                onChange={setWeighInLocation}
                placeholder={t("tournament.location")}
              />
              <Input
                label={t("tournament.weigh_in_start")}
                type="datetime-local"
                value={weighInStart}
                onChange={setWeighInStart}
              />
              <Input
                label={t("tournament.weigh_in_end")}
                type="datetime-local"
                value={weighInEnd}
                onChange={setWeighInEnd}
              />
              <Input
                label={t("payments.entry_fee")}
                type="number"
                min={0}
                value={entryFeeKzt}
                onChange={setEntryFeeKzt}
              />
              <Input
                label={t("payments.kaspi_url")}
                type="url"
                value={kaspiPaymentUrl}
                onChange={setKaspiPaymentUrl}
                placeholder="https://kaspi.kz/pay?...amount={amount}&order={orderId}"
              />
            </div>
            <button
              type="button"
              onClick={() => savePoster.mutate()}
              disabled={savePoster.isPending}
              className="self-end rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-gold-foreground shadow-gold disabled:opacity-50"
            >
              {t("common.save")}
            </button>
          </div>
          {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
          {tourney.posterUrl && (
            <a
              href={tourney.posterUrl}
              target="_blank"
              rel="noopener"
              className="mt-3 inline-flex rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/15"
            >
              {t("common.open")}
            </a>
          )}
          {tourney.mapUrl && (
            <a
              href={tourney.mapUrl}
              target="_blank"
              rel="noopener"
              className="ml-2 mt-3 inline-flex rounded-md border border-border bg-card/50 px-3 py-2 text-sm hover:border-gold/40"
            >
              {t("tournament.map_link")}
            </a>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
          <iframe
            title="Tournament map"
            src={mapEmbedUrl(tourney)}
            className="h-64 w-full border-0"
            loading="lazy"
          />
          <div className="space-y-2 p-3 text-sm">
            <div className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <div>
                <div className="font-medium">{tourney.location}</div>
                <div className="text-xs text-muted-foreground">{tourney.city}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <div>
                <div className="font-medium">{t("tournament.weigh_in_tab")}</div>
                <div className="text-xs text-muted-foreground">{formatWeighIn(tourney, t)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-border/30">
        <div className="mb-3 flex items-center gap-2">
          <Youtube className="h-4 w-4 text-red-500" />
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            YouTube трансляция (татамиге байланысты)
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: tatamiCount }, (_, i) => (
            <Input
              key={i}
              label={`Татами #${i + 1} — YouTube URL`}
              type="url"
              value={youtubeUrls[i] ?? ""}
              onChange={(v: string) =>
                setYoutubeUrls((prev) => {
                  const next = [...prev];
                  next[i] = v;
                  return next;
                })
              }
              placeholder="https://www.youtube.com/watch?v=..."
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => savePoster.mutate()}
          disabled={savePoster.isPending}
          className="mt-3 rounded-md bg-red-500/90 px-4 py-2 text-sm font-medium text-white shadow disabled:opacity-50 hover:bg-red-500"
        >
          YouTube сақтау
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          YouTube видео URL немесе тікелей эфир URL. Публичный беттегі «Татами live» қойындысында
          көрсетіледі.
        </p>
      </div>
      {tourney.description && (
        <div className="mt-4 pt-4 border-t border-border/30">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            {t("tournament.description")}
          </div>
          <p className="text-sm leading-relaxed">{localizeName(tourney.description)}</p>
        </div>
      )}
    </Panel>
  );
}

function formatKzt(value: number): string {
  return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
}
