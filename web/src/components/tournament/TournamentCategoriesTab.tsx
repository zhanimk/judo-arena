import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wand2, Plus, X, Pencil, Trash2, Save, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel, EmptyState } from "@/components/dashboard/DashboardShell";
import { api, ApiError } from "@/lib/api";
import { Input, Select, FormatBadge, categoryTitle, compactI18n } from "./shared";
import { AGE_GROUPS, buildWeightCategories, wLabel } from "./age-groups";

function CategoryForm({
  initial,
  busy,
  onSubmit,
  onCancel,
  tournamentYear,
}: {
  initial?: any;
  busy: boolean;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  tournamentYear?: number;
}) {
  const { t } = useTranslation();
  const tYear = tournamentYear ?? new Date().getFullYear();

  const [form, setForm] = useState({
    nameKk: initial?.name?.kk ?? "",
    nameRu: initial?.name?.ru ?? "",
    nameEn: initial?.name?.en ?? "",
    gender: initial?.gender ?? "MALE",
    ageMin: String(initial?.ageMin ?? 13),
    ageMax: String(initial?.ageMax ?? 15),
    weightMin: String(initial?.weightMin ?? 0.1),
    weightMax: String(initial?.weightMax ?? 60),
    matchDurationSec: String(initial?.matchDurationSec ?? 120),
    goldenScoreSec: String(initial?.goldenScoreSec ?? 60),
    format: initial?.format ?? "SE_IJF",
    allowYuko: Boolean(initial?.allowYuko ?? false),
  });

  function applyPreset(presetKey: string) {
    const preset = AGE_GROUPS.find((g) => g.key === presetKey);
    if (!preset) return;
    const birthFrom = tYear - preset.ageMax;
    const birthTo = tYear - preset.ageMin;
    const gStr = form.gender === "MALE" ? t("common.male") : t("tatami.female_short");
    const gStrRu = form.gender === "MALE" ? t("common.male_abbr") : t("common.female_abbr");
    const wMax = Number(form.weightMax);
    const wMin = Number(form.weightMin);
    const label = wMax >= 999 ? `+${Math.floor(wMin)}` : `-${wMax}`;
    setForm((f) => ({
      ...f,
      ageMin: String(preset.ageMin),
      ageMax: String(preset.ageMax),
      matchDurationSec: String(preset.matchDurationSec),
      goldenScoreSec: String(preset.goldenScoreSec),
      nameKk:
        f.nameKk ||
        `${preset.labelKk} ${gStr} ${label} ${t("common.kg")} (${birthFrom}–${birthTo})`,
      nameRu: f.nameRu || `${preset.labelRu} ${gStrRu} ${label} кг`,
    }));
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = compactI18n({ kk: form.nameKk, ru: form.nameRu, en: form.nameEn });
    onSubmit({
      ...(Object.keys(name).length > 0 ? { name } : {}),
      gender: form.gender,
      ageMin: Number(form.ageMin),
      ageMax: Number(form.ageMax),
      weightMin: Number(form.weightMin),
      weightMax: Number(form.weightMax),
      matchDurationSec: Number(form.matchDurationSec),
      goldenScoreSec: Number(form.goldenScoreSec),
      format: form.format,
      allowYuko: form.allowYuko,
    });
  };

  return (
    <form onSubmit={submit} className="mb-4 rounded-md border border-gold/20 bg-gold/5 p-4">
      <div className="mb-4 rounded-md border border-border/40 bg-background/40 p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t("categories.preset_hint")}
        </div>
        <div className="flex flex-wrap gap-2">
          {AGE_GROUPS.map((g) => {
            const birthFrom = tYear - g.ageMax;
            const birthTo = tYear - g.ageMin;
            const isActive = form.ageMin === String(g.ageMin) && form.ageMax === String(g.ageMax);
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => applyPreset(g.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-gold text-gold-foreground"
                    : "border border-border text-muted-foreground hover:border-gold/50 hover:text-foreground"
                }`}
              >
                {g.labelRu}
                <span className="ml-1 opacity-60">
                  {birthFrom}–{birthTo}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Input
          label={t("categories.name_kk")}
          value={form.nameKk}
          onChange={(v: string) => setForm({ ...form, nameKk: v })}
          placeholder="U17 Ер -66 кг"
        />
        <Input
          label={t("categories.name_ru")}
          value={form.nameRu}
          onChange={(v: string) => setForm({ ...form, nameRu: v })}
        />
        <Input
          label={t("categories.name_en")}
          value={form.nameEn}
          onChange={(v: string) => setForm({ ...form, nameEn: v })}
        />

        <Select
          label={t("common.gender")}
          value={form.gender}
          onChange={(gender) => setForm({ ...form, gender })}
          options={[
            ["MALE", t("common.male")],
            ["FEMALE", t("tatami.female_short")],
          ]}
        />

        <div>
          <Input
            label={t("categories.age_min")}
            type="number"
            value={form.ageMin}
            onChange={(v: string) => setForm({ ...form, ageMin: v })}
            required
          />
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {t("categories.birth_year_le")} {tYear - Number(form.ageMin)}
          </div>
        </div>
        <div>
          <Input
            label={t("categories.age_max")}
            type="number"
            value={form.ageMax}
            onChange={(v: string) => setForm({ ...form, ageMax: v })}
            required
          />
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {t("categories.birth_year_ge")} {tYear - Number(form.ageMax)}
            {form.ageMin !== form.ageMax && (
              <span className="ml-2 text-gold/80">
                ({tYear - Number(form.ageMax)}–{tYear - Number(form.ageMin)})
              </span>
            )}
          </div>
        </div>

        <Input
          label={t("categories.weight_min")}
          type="number"
          step="0.01"
          value={form.weightMin}
          onChange={(v: string) => setForm({ ...form, weightMin: v })}
          required
        />
        <Input
          label={t("categories.weight_max")}
          type="number"
          step="0.01"
          value={form.weightMax}
          onChange={(v: string) => setForm({ ...form, weightMax: v })}
          required
        />

        <Select
          label={t("categories.format_label")}
          value={form.format}
          onChange={(format) => setForm({ ...form, format })}
          options={[
            ["SE_IJF", "Olympic / IJF"],
            ["ROUND_ROBIN", "Round-robin"],
            ["MIXED", "Mixed"],
          ]}
        />

        <Input
          label={t("categories.match_sec")}
          type="number"
          value={form.matchDurationSec}
          onChange={(matchDurationSec: string) => setForm({ ...form, matchDurationSec })}
          required
        />
        <Input
          label={t("categories.gs_sec")}
          type="number"
          value={form.goldenScoreSec}
          onChange={(goldenScoreSec: string) => setForm({ ...form, goldenScoreSec })}
        />
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm select-none">
        <input
          type="checkbox"
          checked={form.allowYuko}
          onChange={(e) => setForm({ ...form, allowYuko: e.target.checked })}
          className="h-4 w-4 rounded border-border accent-gold"
        />
        <span>
          <span className="font-medium">Yuko</span>
          <span className="ml-1.5 text-xs text-muted-foreground">
            — {t("categories.yuko_desc")}
          </span>
        </span>
      </label>

      <div className="mt-4 flex gap-2">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-gold-foreground shadow-gold disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("common.save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

export function TournamentCategoriesTab({ tournament: tourney }: { tournament: any }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkGroup, setBulkGroup] = useState(AGE_GROUPS[3].key);
  const [bulkGenders, setBulkGenders] = useState<("MALE" | "FEMALE")[]>(["MALE", "FEMALE"]);
  const [bulkAdding, setBulkAdding] = useState(false);
  const canEdit = tourney.status === "DRAFT";
  const tournamentYear = tourney.startDate
    ? new Date(tourney.startDate).getFullYear()
    : new Date().getFullYear();

  const create = useMutation({
    mutationFn: (data: any) => api.tournaments.addCategory(tourney.id, data),
    onSuccess: () => {
      setShowForm(false);
      setError("");
      qc.invalidateQueries({ queryKey: ["admin-tournament", tourney.id] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("categories.create_error")),
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.tournaments.updateCategory(id, data),
    onSuccess: () => {
      setEditing(null);
      setError("");
      qc.invalidateQueries({ queryKey: ["admin-tournament", tourney.id] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("categories.update_error")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.tournaments.deleteCategory(id),
    onSuccess: () => {
      setError("");
      qc.invalidateQueries({ queryKey: ["admin-tournament", tourney.id] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("categories.delete_error")),
  });

  async function handleBulkAdd() {
    const preset = AGE_GROUPS.find((g) => g.key === bulkGroup);
    if (!preset) return;
    setBulkAdding(true);
    setError("");
    setSuccess("");
    const categories = bulkGenders.flatMap((gender) =>
      buildWeightCategories(preset, gender, tournamentYear).map(
        ({ _birthRange: _ignored, ...category }) => category,
      ),
    );

    try {
      const result = await api.tournaments.addCategoriesBulk(tourney.id, categories);
      qc.setQueryData(["admin-tournament", tourney.id], (current: any) =>
        current ? { ...current, categories: result.categories } : current,
      );
      await qc.invalidateQueries({ queryKey: ["tournament", "detail", tourney.id] });
      setShowBulk(false);
      setSuccess(
        result.added > 0
          ? t("categories.bulk_success", { count: result.added })
          : t("categories.bulk_already_exists"),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("categories.bulk_error"));
    } finally {
      setBulkAdding(false);
    }
  }

  const selectedPreset = AGE_GROUPS.find((g) => g.key === bulkGroup);
  const previewCats = selectedPreset
    ? bulkGenders.flatMap((g) => buildWeightCategories(selectedPreset, g, tournamentYear))
    : [];

  return (
    <Panel
      title={t("categories.total", { count: tourney.categories?.length ?? 0 })}
      action={
        canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowBulk((v) => !v);
                setShowForm(false);
                setEditing(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm text-gold hover:bg-gold/20"
            >
              <Wand2 className="h-4 w-4" />
              {t("categories.template_btn")}
            </button>
            <button
              onClick={() => {
                setShowForm((v) => !v);
                setEditing(null);
                setShowBulk(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-gold px-3 py-1.5 text-sm text-gold-foreground shadow-gold"
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? t("common.close") : t("categories.add_btn")}
            </button>
          </div>
        )
      }
    >
      {!canEdit && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          {t("categories.draft_only_warning")}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {success}
        </div>
      )}

      {showBulk && canEdit && (
        <div className="mb-4 rounded-lg border-2 border-gold/30 bg-gold/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-gold" />
            <span className="font-semibold text-sm">{t("categories.bulk_title")}</span>
          </div>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("categories.age_group_label")}
              </label>
              <select
                value={bulkGroup}
                onChange={(e) => setBulkGroup(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {AGE_GROUPS.map((g) => {
                  const birthFrom = tournamentYear - g.ageMax;
                  const birthTo = tournamentYear - g.ageMin;
                  return (
                    <option key={g.key} value={g.key}>
                      {g.labelRu} ({birthFrom}–{birthTo})
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("common.gender")}
              </label>
              <div className="flex gap-3 pt-2">
                {(["MALE", "FEMALE"] as const).map((g) => (
                  <label key={g} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkGenders.includes(g)}
                      onChange={(e) =>
                        setBulkGenders((prev) =>
                          e.target.checked ? [...prev, g] : prev.filter((x) => x !== g),
                        )
                      }
                      className="h-4 w-4"
                    />
                    {g === "MALE" ? t("common.male") : t("tatami.female_short")}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {selectedPreset && previewCats.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 text-xs text-muted-foreground">
                {previewCats.length}{" "}
                {t("categories.bulk_preview", {
                  match: selectedPreset.matchDurationSec,
                  gs: selectedPreset.goldenScoreSec,
                })}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {previewCats.map((c: any, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                      c.gender === "MALE"
                        ? "bg-blue-500/15 text-blue-300"
                        : "bg-pink-500/15 text-pink-300"
                    }`}
                  >
                    {c.gender === "MALE" ? "♂" : "♀"} {wLabel(c.weightMin, c.weightMax)}{" "}
                    {t("common.kg")}
                    <span className="opacity-60 text-[10px]">{c._birthRange}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleBulkAdd}
              disabled={bulkAdding || bulkGenders.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-gold-foreground shadow-gold disabled:opacity-50"
            >
              {bulkAdding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {bulkAdding
                ? t("categories.bulk_adding")
                : t("categories.bulk_add_n", { count: previewCats.length })}
            </button>
            <button
              type="button"
              onClick={() => setShowBulk(false)}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <CategoryForm
          tournamentYear={tournamentYear}
          busy={create.isPending}
          onSubmit={(data) => create.mutate(data)}
          onCancel={() => setShowForm(false)}
        />
      )}
      {(tourney.categories ?? []).length === 0 ? (
        <EmptyState title={t("categories.empty")} hint={t("categories.empty_hint")} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {tourney.categories.map((c: any) => (
            <div
              key={c.id}
              className="rounded-md border border-border/60 bg-background/30 p-4 text-sm"
            >
              {editing?.id === c.id ? (
                <CategoryForm
                  initial={c}
                  tournamentYear={tournamentYear}
                  busy={update.isPending}
                  onSubmit={(data) => update.mutate({ id: c.id, data })}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{categoryTitle(c, t)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {c.gender === "MALE"
                          ? `♂ ${t("common.male")}`
                          : `♀ ${t("tatami.female_short")}`}{" "}
                        · {c.ageMin}–{c.ageMax} {t("common.years_short")}{" "}
                        <span className="text-gold/60">
                          ({tournamentYear - c.ageMax}–{tournamentYear - c.ageMin})
                        </span>{" "}
                        · ({c.weightMin}, {c.weightMax >= 999 ? "+∞" : c.weightMax}]{" "}
                        {t("common.kg")}
                      </div>
                    </div>
                    <FormatBadge format={c.format} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="rounded border border-border/50 p-2">
                      {t("categories.match_label")}
                      <br />
                      <span className="text-foreground">{c.matchDurationSec}s</span>
                    </div>
                    <div className="rounded border border-border/50 p-2">
                      Golden Score
                      <br />
                      <span className="text-foreground">
                        {c.goldenScoreSec ? `${c.goldenScoreSec}s` : t("categories.unlimited")}
                      </span>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => {
                          setEditing(c);
                          setShowForm(false);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
                      </button>
                      <button
                        onClick={() => remove.mutate(c.id)}
                        disabled={remove.isPending}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
