import { localizeName } from "./shared";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { Category } from "@/lib/api-types";

export function ManualEntryForm({
  tournamentId,
  categories,
}: {
  tournamentId: string;
  categories: Category[];
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("existing");
  const [search, setSearch] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [form, setForm] = useState({
    name: "",
    surname: "",
    dateOfBirth: "",
    gender: "MALE" as "MALE" | "FEMALE",
    weightKg: "",
    email: "",
  });
  const users = useQuery({
    queryKey: ["manual-athletes", search],
    queryFn: () => api.admin.listUsers({ role: "ATHLETE", search, limit: 30 }),
    enabled: open && mode === "existing",
  });
  const mut = useMutation({
    mutationFn: () =>
      api.applications.manualRegister(tournamentId, {
        categoryId,
        ...(mode === "existing"
          ? { athleteId }
          : {
              participant: {
                ...form,
                dateOfBirth: `${form.dateOfBirth}T00:00:00.000Z`,
                weightKg: Number(form.weightKg),
                email: form.email || undefined,
              },
            }),
      }),
    onSuccess: () => {
      setOpen(false);
      setAthleteId("");
      setForm({ name: "", surname: "", dateOfBirth: "", gender: "MALE", weightKg: "", email: "" });
      qc.invalidateQueries({ queryKey: ["tournament-apps", tournamentId] });
      qc.invalidateQueries({ queryKey: ["manual-athletes"] });
    },
  });
  const inputClass = "block w-full rounded-md border border-border bg-background p-2 text-sm";
  return (
    <div className="mb-4 rounded-md border border-border p-3">
      <button
        type="button"
        className="text-sm font-medium text-gold"
        onClick={() => setOpen(!open)}
      >
        {t("registration.manual")}
      </button>
      {open && (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          <label className="block text-sm">
            {t("registration.manual")}
            <select
              className={inputClass}
              aria-label={t("registration.manual")}
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                mut.reset();
              }}
            >
              <option value="existing">{t("registration.existing")}</option>
              <option value="new">{t("registration.new")}</option>
            </select>
          </label>
          {mode === "existing" ? (
            <>
              <label className="block text-sm">
                {t("registration.search")}
                <input
                  className={inputClass}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setAthleteId("");
                  }}
                />
              </label>
              <label className="block text-sm">
                {t("registration.choose_athlete")}
                <select
                  required
                  className={inputClass}
                  aria-label={t("registration.choose_athlete")}
                  value={athleteId}
                  onChange={(e) => setAthleteId(e.target.value)}
                >
                  <option value="">—</option>
                  {users.data?.items.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.surname} {u.name} · {u.dateOfBirth?.slice(0, 10)} · {u.email}
                    </option>
                  ))}
                </select>
              </label>
              {users.error && (
                <p role="alert" className="text-sm text-destructive">
                  {users.error.message}
                </p>
              )}
            </>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  ["name", "name", "text"],
                  ["surname", "surname", "text"],
                  ["dateOfBirth", "dob", "date"],
                  ["weightKg", "weight", "number"],
                  ["email", "email", "email"],
                ] as const
              ).map(([field, key, type]) => (
                <label key={field} className="text-sm">
                  {t(`registration.${key}`)}
                  <input
                    className={inputClass}
                    type={type}
                    required={field !== "email"}
                    step={field === "weightKg" ? "0.01" : undefined}
                    min={field === "weightKg" ? "0.01" : undefined}
                    max={field === "weightKg" ? "300" : undefined}
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  />
                </label>
              ))}
              <label className="text-sm">
                {t("common.gender")}
                <select
                  className={inputClass}
                  aria-label={t("common.gender")}
                  value={form.gender}
                  onChange={(e) =>
                    setForm({ ...form, gender: e.target.value as "MALE" | "FEMALE" })
                  }
                >
                  <option value="MALE">{t("common.male")}</option>
                  <option value="FEMALE">{t("common.female")}</option>
                </select>
              </label>
            </div>
          )}
          <label className="block text-sm">
            {t("registration.choose_category")}
            <select
              required
              className={inputClass}
              aria-label={t("registration.choose_category")}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {localizeName(c.name) || `${c.gender} ${c.weightMin}–${c.weightMax} кг`} ·{" "}
                  {c.birthYearMin}–{c.birthYearMax}
                </option>
              ))}
            </select>
          </label>
          {mut.error && (
            <p role="alert" className="text-sm text-destructive">
              {mut.error.message}
            </p>
          )}
          <button
            disabled={mut.isPending}
            className="rounded-md bg-gold px-4 py-2 text-sm text-gold-foreground disabled:opacity-50"
          >
            {t("registration.add")}
          </button>
        </form>
      )}
    </div>
  );
}
