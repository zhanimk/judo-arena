import { ApiResponse, http } from './http';

export interface MatchEntity {
  _id: string;
  roundNumber: number;
  status: string;
  tatamiNumber?: number;
  categoryKey: string;
  scoreA?: number;
  scoreB?: number;
  penaltiesA?: number;
  penaltiesB?: number;
  slotA?: {
    displayNameSnapshot?: string;
    athleteId?: { fullName?: string };
  };
  slotB?: {
    displayNameSnapshot?: string;
    athleteId?: { fullName?: string };
  };
}

export async function getMatchesByTournament(tournamentId: string): Promise<MatchEntity[]> {
  const response = await http.get<ApiResponse<MatchEntity[]>>(`/matches/tournament/${tournamentId}`);
  return response.data.data;
}

export async function getMatchById(matchId: string): Promise<MatchEntity> {
  const response = await http.get<ApiResponse<MatchEntity>>(`/matches/${matchId}`);
  return response.data.data;
}

export async function startMatch(matchId: string): Promise<MatchEntity> {
  const response = await http.patch<ApiResponse<MatchEntity>>(`/matches/${matchId}/start`);
  return response.data.data;
}

export async function updateMatchScore(matchId: string, payload: { scoreA?: number; scoreB?: number }): Promise<MatchEntity> {
  const response = await http.patch<ApiResponse<MatchEntity>>(`/matches/${matchId}/score`, payload);
  return response.data.data;
}

export async function updateMatchPenalties(matchId: string, payload: { penaltiesA?: number; penaltiesB?: number }): Promise<MatchEntity> {
  const response = await http.patch<ApiResponse<MatchEntity>>(`/matches/${matchId}/penalties`, payload);
  return response.data.data;
}

export async function finishMatch(matchId: string, payload: { winnerSlot: 'A' | 'B'; scoreA?: number; scoreB?: number; penaltiesA?: number; penaltiesB?: number }): Promise<MatchEntity> {
  const response = await http.patch<ApiResponse<MatchEntity>>(`/matches/${matchId}/finish`, payload);
  return response.data.data;
}
