import { localizeName } from "./shared";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-store";
import { api } from "@/lib/api";
import type { Application, Tournament } from "@/lib/api-types";

export function SelfRegistrationForm({ tournaments }: { tournaments: Tournament[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tournamentId, setTournamentId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [application, setApplication] = useState<Application | null>(null);
  const categories = useQuery({
    queryKey: ["self-categories", tournamentId],
    queryFn: () => api.tournaments.categories(tournamentId),
    enabled: !!tournamentId,
  });
  const refresh = (app: Application) => {
    setApplication(app);
    qc.invalidateQueries({ queryKey: ["athlete-application-entries"] });
  };
  const register = useMutation({
    mutationFn: () => api.applications.selfRegister(tournamentId, categoryId),
    onSuccess: refresh,
  });
  const payment = useMutation({
    mutationFn: () => api.applications.payKaspi(application!.id),
    onSuccess: refresh,
  });
  const submit = useMutation({
    mutationFn: () => api.applications.submit(application!.id),
    onSuccess: refresh,
  });
  const error = register.error || payment.error || submit.error || categories.error;
  const eligible = tournaments.filter(
    (t) => t.status === "REGISTRATION_OPEN" && t.selfRegistrationEnabled && t.audience !== "CHILD",
  );
  const cls = "mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm";
  const dob = new Date(user?.dateOfBirth ?? "");
  const adult =
    Number.isFinite(+dob) &&
    Date.UTC(dob.getUTCFullYear() + 18, dob.getUTCMonth(), dob.getUTCDate()) <= Date.now();
  if (!adult)
    return (
      <p className="mb-6 rounded-lg border border-border p-4 text-sm text-muted-foreground">
        {t("registration.manual_hint")}
      </p>
    );
  return (
    <section className="mb-6 rounded-lg border border-border p-4">
      <h2 className="mb-2 font-medium">{t("registration.self_title")}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("registration.self_hint")}</p>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          register.mutate();
        }}
      >
        <label className="text-sm">
          {t("registration.choose_tournament")}
          <select
            required
            className={cls}
            aria-label={t("registration.choose_tournament")}
            value={tournamentId}
            onChange={(e) => {
              setTournamentId(e.target.value);
              setCategoryId("");
              setApplication(null);
              register.reset();
              payment.reset();
              submit.reset();
            }}
          >
            <option value="">—</option>
            {eligible.map((t) => (
              <option key={t.id} value={t.id}>
                {localizeName(t.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t("registration.choose_category")}
          <select
            required
            className={cls}
            aria-label={t("registration.choose_category")}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">—</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {localizeName(c.name) || `${c.gender} ${c.weightMin}–${c.weightMax} кг`} ·{" "}
                {c.birthYearMin}–{c.birthYearMax}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={register.isPending || !tournamentId || !categoryId || !!application}
          className="rounded-md bg-gold px-4 py-2 text-sm text-gold-foreground disabled:opacity-50"
        >
          {t("registration.apply")}
        </button>
      </form>
      {application && (
        <div className="mt-3 space-y-2 text-sm" aria-live="polite">
          <p>
            {t("registration.saved")} · {t(`status.${application.status}`)} ·{" "}
            {application.paymentAmountKzt} ₸
          </p>
          {application.status === "DRAFT" && (
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded border border-border p-2"
                disabled={payment.isPending}
                onClick={() => payment.mutate()}
              >
                {t("registration.pay")}
              </button>
              <button
                className="rounded border border-border p-2"
                disabled={submit.isPending}
                onClick={() => submit.mutate()}
              >
                {t("registration.submit")}
              </button>
            </div>
          )}
          {application.paymentUrl && (
            <a
              className="block text-gold underline"
              href={application.paymentUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t("registration.pay")} · {application.paymentReference}
            </a>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error.message}
        </p>
      )}
    </section>
  );
}

/** Payment and submission remain accessible after reload for the owner's draft. */
export function SelfApplicationActions({ application }: { application: Application }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [paymentUrl, setPaymentUrl] = useState(application.paymentUrl);
  const pay = useMutation({
    mutationFn: () => api.applications.payKaspi(application.id),
    onSuccess: (app) => {
      setPaymentUrl(app.paymentUrl);
      qc.invalidateQueries({ queryKey: ["athlete-application-entries"] });
    },
  });
  const submit = useMutation({
    mutationFn: () => api.applications.submit(application.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["athlete-application-entries"] }),
  });
  if (application.source !== "SELF" || application.status !== "DRAFT") return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
      <button
        className="rounded border p-2"
        onClick={(e) => {
          e.preventDefault();
          pay.mutate();
        }}
        disabled={pay.isPending}
      >
        {t("registration.pay")}
      </button>
      {paymentUrl && (
        <a
          className="rounded border p-2 underline"
          href={paymentUrl}
          target="_blank"
          rel="noreferrer"
        >
          Kaspi
        </a>
      )}
      <button
        className="rounded border p-2"
        onClick={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
        disabled={submit.isPending}
      >
        {t("registration.submit")}
      </button>
      {(pay.error || submit.error) && <p role="alert">{(pay.error || submit.error)!.message}</p>}
    </div>
  );
}
