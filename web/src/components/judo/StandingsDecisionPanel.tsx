import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { Bracket, BracketStandingTable } from "@/lib/api-types";

export function StandingsDecisionPanel({
  bracket,
  table,
  onSaved,
}: {
  bracket: Bracket;
  table: BracketStandingTable;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState(table.rows);
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      api.brackets.decideStandings(bracket.id, {
        section: table.section,
        order: rows.map((row) => row.athleteId),
        reason,
        fingerprint: table.fingerprint,
      }),
    onSuccess: onSaved,
  });
  const names = new Map(
    (bracket.matches ?? [])
      .flatMap((m) => [m.redAthlete, m.blueAthlete])
      .filter((a) => a != null)
      .map((a) => [a.id, `${a.surname} ${a.name}`]),
  );
  function move(index: number, offset: number) {
    const next = [...rows];
    [next[index], next[index + offset]] = [next[index + offset]!, next[index]!];
    setRows(next);
  }
  return (
    <section
      className="rounded-xl border border-amber-500/40 p-4 space-y-3"
      aria-label={t("standings_decision.title")}
    >
      <h3 className="font-semibold">
        {t("standings_decision.title")} ·{" "}
        {table.section === "main" ? "RR" : table.section.replace("group_", "")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("standings_decision.help")}</p>
      <ol className="space-y-2">
        {rows.map((row, index) => (
          <li key={row.athleteId} className="flex items-center gap-3">
            <span className="w-6">{index + 1}.</span>
            <span className="flex-1">{names.get(row.athleteId) ?? row.athleteId}</span>
            <button
              type="button"
              className="border rounded px-3 py-1 disabled:opacity-30"
              aria-label={`${t("standings_decision.up")}: ${names.get(row.athleteId)}`}
              disabled={mutation.isPending || index === 0 || row.place !== rows[index - 1]?.place}
              onClick={() => move(index, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="border rounded px-3 py-1 disabled:opacity-30"
              aria-label={`${t("standings_decision.down")}: ${names.get(row.athleteId)}`}
              disabled={
                mutation.isPending ||
                index === rows.length - 1 ||
                row.place !== rows[index + 1]?.place
              }
              onClick={() => move(index, 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <label className="block text-sm">
        {t("standings_decision.reason")}
        <textarea
          className="mt-1 w-full rounded border bg-background p-2"
          value={reason}
          maxLength={2000}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {mutation.error && (
        <p role="alert" className="text-destructive text-sm">
          {mutation.error.message}
        </p>
      )}
      <button
        type="button"
        className="rounded bg-gold px-4 py-2 text-black disabled:opacity-40"
        disabled={mutation.isPending || reason.trim().length < 5}
        onClick={() => mutation.mutate()}
      >
        {t("standings_decision.save")}
      </button>
    </section>
  );
}
