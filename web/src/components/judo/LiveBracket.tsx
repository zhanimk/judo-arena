/**
 * LiveBracket — Olympic-style сетка с подключением к API + real-time через Socket.IO.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OlympicBracket } from "./OlympicBracket";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/socket";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  tournamentId: string;
  categoryId: string;
}

export function LiveBracket({ tournamentId, categoryId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["bracket", tournamentId, categoryId],
    queryFn: () => api.brackets.getByCategory(tournamentId, categoryId),
  });

  useRealtime(
    query.data ? [`bracket:${query.data.id}`, `tournament:${tournamentId}`] : [],
    {
      "match:scoreUpdate": () => qc.invalidateQueries({ queryKey: ["bracket", tournamentId, categoryId] }),
      "match:finished": () => qc.invalidateQueries({ queryKey: ["bracket", tournamentId, categoryId] }),
      "match:started": () => qc.invalidateQueries({ queryKey: ["bracket", tournamentId, categoryId] }),
      "bracket:update": () => qc.invalidateQueries({ queryKey: ["bracket", tournamentId, categoryId] }),
    },
  );

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        {t("bracket.no_bracket")}
      </div>
    );
  }

  return (
    <OlympicBracket
      matches={(query.data.matches ?? []) as any}
      size={query.data.size ?? 0}
      format={query.data.format}
    />
  );
}
