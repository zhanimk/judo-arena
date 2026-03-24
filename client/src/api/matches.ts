import { ApiResponse, http } from './http';

export interface MatchEntity {
  _id: string;
  roundNumber: number;
  status: string;
  tatamiNumber?: number;
  categoryKey: string;
  slotA?: { displayNameSnapshot?: string };
  slotB?: { displayNameSnapshot?: string };
}

export async function getMatchesByTournament(tournamentId: string): Promise<MatchEntity[]> {
  const response = await http.get<ApiResponse<MatchEntity[]>>(`/matches/tournament/${tournamentId}`);
  return response.data.data;
}
