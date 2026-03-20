import { api } from "@/shared/lib/axios";

export async function getTournaments() {
  const { data } = await api.get("/tournaments");
  return data;
}

export async function getTournamentById(id) {
  const { data } = await api.get(`/tournaments/${id}`);
  return data;
}