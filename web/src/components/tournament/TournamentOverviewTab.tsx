import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  ImageIcon,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Upload,
  X,
  Youtube,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/components/dashboard/DashboardShell";
import { api, ApiError, mediaUrl } from "@/lib/api";
import { Input, localizeName, formatWeighIn, toDateTimeLocal, mapEmbedUrl } from "./shared";
import { MapLocationPicker } from "./MapLocationPicker";

function formatSaveError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (!Array.isArray(error.details) || error.details.length === 0) return error.message;
  const issue = error.details[0] as { path?: string; message?: string };
  if (!issue.message) return error.message;
  const youtubeMatch = issue.path?.match(/^youtubeUrls\.(\d+)$/);
  const field = youtubeMatch ? `YouTube URL (татами #${Number(youtubeMatch[1]) + 1})` : issue.path;
  return field ? `${field}: ${issue.message}` : issue.message;
}

function formatKzt(value: number): string {
  return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/40">
      <span className="text-gold">{icon}</span>
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

export function TournamentOverviewTab({ tournament: tourney }: { tournament: any }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // Form state
  const [posterUrl, setPosterUrl] = useState(tourney.posterUrl ?? "");
  const [galleryUrls, setGalleryUrls] = useState<string[]>(
    Array.isArray(tourney.galleryUrls) ? tourney.galleryUrls : [],
  );
  const [mapUrl, setMapUrl] = useState(tourney.mapUrl ?? "");
  const [weighInLocation, setWeighInLocation] = useState(tourney.weighInLocation ?? "");
  const [weighInStart, setWeighInStart] = useState(toDateTimeLocal(tourney.weighInStart ?? ""));
  const [weighInEnd, setWeighInEnd] = useState(toDateTimeLocal(tourney.weighInEnd ?? ""));
  const [applicationDeadline, setApplicationDeadline] = useState(
    toDateTimeLocal(tourney.applicationDeadline ?? tourney.startDate),
  );
  const [entryFeeKzt, setEntryFeeKzt] = useState(String(tourney.entryFeeKzt ?? 0));
  const [kaspiPaymentUrl, setKaspiPaymentUrl] = useState(tourney.kaspiPaymentUrl ?? "");
  const [regulationUrl, setRegulationUrl] = useState(tourney.regulationUrl ?? "");
  const [regulationFileName, setRegulationFileName] = useState(tourney.regulationFileName ?? "");

  const tatamiCount = Number(tourney.tatamiCount ?? 1);
  const initUrls = useMemo(() => {
    const saved: string[] = Array.isArray(tourney.youtubeUrls) ? tourney.youtubeUrls : [];
    return Array.from({ length: tatamiCount }, (_, i) => saved[i] ?? "");
  }, [tourney.youtubeUrls, tatamiCount]);
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>(initUrls);

  const [saveError, setSaveError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Main save (all fields at once) ──────────────────────────────────────────
  const saveAll = useMutation({
    mutationFn: () =>
      api.tournaments.update(tourney.id, {
        posterUrl: posterUrl || null,
        galleryUrls: galleryUrls.length > 0 ? galleryUrls : null,
        regulationUrl: regulationUrl || null,
        regulationFileName: regulationFileName || null,
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
      setSaveError("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      qc.invalidateQueries({ queryKey: ["admin-tournament", tourney.id] });
      qc.invalidateQueries({ queryKey: ["tournament", tourney.id] });
      qc.invalidateQueries({ queryKey: ["live-wall-tournament", tourney.id] });
    },
    onError: (e: unknown) => {
      setSaveSuccess(false);
      setSaveError(formatSaveError(e, t("error.generic")));
    },
  });

  // ── Regulation upload (immediate, updates local state for main save) ─────────
  const uploadRegulation = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await api.uploads.regulation(file);
      return uploaded;
    },
    onSuccess: (uploaded) => {
      setRegulationUrl(uploaded.url);
      setRegulationFileName(uploaded.fileName);
      setUploadError("");
    },
    onError: (e: unknown) => {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : t("error.generic");
      setUploadError(msg);
    },
  });

  const uploadPoster = useMutation({
    mutationFn: (file: File) => api.uploads.image(file),
    onSuccess: ({ url }) => {
      setPosterUrl(url);
      setUploadError("");
    },
    onError: (e: unknown) => {
      setUploadError(e instanceof ApiError ? e.message : t("error.generic"));
    },
  });

  const uploadGalleryImage = useMutation({
    mutationFn: (file: File) => api.uploads.image(file),
    onSuccess: ({ url }) => {
      setGalleryUrls((current) => [...current, url].slice(0, 6));
      setUploadError("");
    },
    onError: (e: unknown) => {
      setUploadError(e instanceof ApiError ? e.message : t("error.generic"));
    },
  });

  const removeRegulation = useMutation({
    mutationFn: () =>
      api.tournaments.update(tourney.id, {
        regulationUrl: null,
        regulationFileName: null,
      }),
    onSuccess: () => {
      setRegulationUrl("");
      setRegulationFileName("");
      setUploadError("");
      qc.invalidateQueries({ queryKey: ["admin-tournament", tourney.id] });
    },
    onError: (e: unknown) => setUploadError(formatSaveError(e, t("error.generic"))),
  });

  return (
    <Panel title={t("tournament.overview_label")}>
      {/* Stats strip */}
      <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm mb-6 p-3 rounded-xl bg-card/50 border border-border/40">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-gold" />
          {tourney.location}, {tourney.city}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 text-gold" />
          {fmtDate(tourney.startDate)} — {fmtDate(tourney.endDate)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span className="text-gold font-bold text-xs">🥋</span>
          {tourney.tatamiCount} татами · {tourney.categories?.length ?? 0}{" "}
          {t("tournament.categories").toLowerCase()} · {tourney._count?.applications ?? 0}{" "}
          {t("dashboard.applications").toLowerCase()}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <CreditCard className="h-3.5 w-3.5 text-gold" />
          {formatKzt(tourney.entryFeeKzt ?? 0)}
        </span>
      </div>

      <div className="space-y-6">
        {/* ── Section 1: Dates & Deadlines ── */}
        <div className="rounded-xl border border-border/50 bg-card/30 p-4">
          <SectionHeader icon={<Calendar className="h-4 w-4" />} title="Күндер және мерзімдер" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label={t("tournament.application_deadline")}
              type="datetime-local"
              value={applicationDeadline}
              onChange={setApplicationDeadline}
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
          </div>
        </div>

        {/* ── Section 2: Location ── */}
        <div className="rounded-xl border border-border/50 bg-card/30 p-4">
          <SectionHeader icon={<MapPin className="h-4 w-4" />} title="Орналасуы" />
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
            <MapLocationPicker city={tourney.city} mapUrl={mapUrl} onChange={setMapUrl} />
            {mapUrl && (
              <div className="flex">
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/50 px-3 py-1.5 text-xs hover:border-gold/40 transition-colors"
                >
                  <MapPin className="h-3 w-3 text-gold" /> {t("tournament.map_link")}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* ── Section 3: Payment ── */}
        <div className="rounded-xl border border-border/50 bg-card/30 p-4">
          <SectionHeader icon={<CreditCard className="h-4 w-4" />} title="Төлем" />
          <div className="grid gap-3 sm:grid-cols-2">
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
              placeholder="https://kaspi.kz/pay?..."
            />
          </div>
        </div>

        {/* ── Section 4: Media (poster + gallery + YouTube) ── */}
        <div className="rounded-xl border border-border/50 bg-card/30 p-4">
          <SectionHeader
            icon={<ImageIcon className="h-4 w-4" />}
            title="Афиша және турнир галереясы"
          />
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <div>
                <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                  Негізгі афиша
                </div>
                <div className="relative overflow-hidden rounded-xl border border-border/60 bg-background/40 aspect-[16/10]">
                  {posterUrl ? (
                    <img src={mediaUrl(posterUrl)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-center text-muted-foreground">
                      <div>
                        <ImageIcon className="mx-auto h-9 w-9 text-gold/40" />
                        <div className="mt-2 text-xs">Карточка мен турнир бетінің мұқабасы</div>
                      </div>
                    </div>
                  )}
                  {posterUrl && (
                    <button
                      type="button"
                      onClick={() => setPosterUrl("")}
                      className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/85 text-muted-foreground shadow hover:text-destructive"
                      aria-label="Постерді жою"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md bg-gradient-gold px-3 py-2 text-sm font-semibold text-gold-foreground shadow-gold">
                  {uploadPoster.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {posterUrl ? "Афишаны ауыстыру" : "Афиша жүктеу"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadPoster.isPending}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadPoster.mutate(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">
                      Галерея
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Марапаттау, татами, зал немесе өткен жарыстан 6 фотоға дейін
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{galleryUrls.length}/6</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {galleryUrls.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      className="group relative overflow-hidden rounded-lg border border-border/60 bg-background/40 aspect-[4/3]"
                    >
                      <img src={mediaUrl(url)} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() =>
                          setGalleryUrls((current) =>
                            current.filter((_, currentIndex) => currentIndex !== index),
                          )
                        }
                        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-background/85 text-muted-foreground opacity-0 shadow transition group-hover:opacity-100 hover:text-destructive"
                        aria-label="Суретті жою"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {galleryUrls.length < 6 && (
                    <label className="grid cursor-pointer place-items-center rounded-lg border border-dashed border-gold/40 bg-gold/5 text-center text-gold transition hover:bg-gold/10 aspect-[4/3]">
                      <div>
                        {uploadGalleryImage.isPending ? (
                          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                        ) : (
                          <Plus className="mx-auto h-5 w-5" />
                        )}
                        <div className="mt-1 text-xs">Фото қосу</div>
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploadGalleryImage.isPending}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) uploadGalleryImage.mutate(file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-border/40 pt-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Youtube className="h-4 w-4 text-gold" />
                Тікелей трансляция
              </div>
              {tatamiCount > 0 && (
                <div>
                  <div className="mb-2 text-xs text-muted-foreground">
                    YouTube трансляция (татамиге байланысты)
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
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 5: Regulation ── */}
        <div className="rounded-xl border border-border/50 bg-card/30 p-4">
          <SectionHeader
            icon={<FileText className="h-4 w-4" />}
            title={t("tournament.regulation_title")}
          />

          {uploadError && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-lg border border-gold/30 bg-gold/10 p-2 text-gold">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                {regulationFileName ? (
                  <>
                    <div className="truncate font-medium text-sm">{regulationFileName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t("tournament.regulation_uploaded")}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-medium text-sm">{t("tournament.regulation_hint")}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      PDF, JPG, PNG, WEBP · макс 20 МБ
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {regulationUrl && (
                <a
                  href={mediaUrl(regulationUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-medium text-gold hover:bg-gold/20"
                >
                  <FileText className="h-4 w-4" /> {t("common.open")}
                </a>
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-gradient-gold px-3 py-2 text-sm font-semibold text-gold-foreground shadow-gold hover:opacity-90">
                {uploadRegulation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {regulationUrl ? t("documents.replace") : t("common.upload")}
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadRegulation.isPending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadRegulation.mutate(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {regulationUrl && (
                <button
                  type="button"
                  onClick={() => removeRegulation.mutate()}
                  disabled={removeRegulation.isPending}
                  className="inline-flex items-center gap-2 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {uploadRegulation.isSuccess && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Файл жүктелді — жалпы «Сақтау» батырмасын басыңыз
            </div>
          )}
        </div>

        {/* ── Description (read-only) ── */}
        {tourney.description && (
          <div className="rounded-xl border border-border/50 bg-card/30 p-4">
            <SectionHeader
              icon={<FileText className="h-4 w-4" />}
              title={t("tournament.description")}
            />
            <p className="text-sm leading-relaxed">{localizeName(tourney.description)}</p>
          </div>
        )}

        {/* ── Save button ── */}
        <div className="flex flex-col items-end gap-2 pt-2">
          {saveError && (
            <div className="flex w-full items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
          {saveSuccess && (
            <div className="flex w-full items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              {t("common.saved")}
            </div>
          )}
          <button
            type="button"
            onClick={() => saveAll.mutate()}
            disabled={saveAll.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-6 py-2.5 text-sm font-semibold text-gold-foreground shadow-gold disabled:opacity-50 hover:opacity-90"
          >
            {saveAll.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("common.save_all")}
          </button>
        </div>
      </div>
    </Panel>
  );
}
