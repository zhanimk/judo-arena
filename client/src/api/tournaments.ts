import { ApiResponse, http } from './http';

export interface TournamentCategory {
  id?: string;
  _id?: string;
  label: string;
  gender: 'male' | 'female';
  ageCategory: string;
  weightCategory: string;
  categoryKey: string;
}

export interface TournamentEntity {
  _id?: string;
  id?: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  status: string;
  tatamiCount: number;
  categories: TournamentCategory[];
  registrationDeadline: string;
}

export interface CreateTournamentPayload {
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  tatamiCount: number;
  categories: TournamentCategory[];
  description?: string;
}

export async function getTournaments(): Promise<TournamentEntity[]> {
  const response = await http.get<ApiResponse<TournamentEntity[]>>('/tournaments');
  return response.data.data;
}

export async function createTournament(payload: CreateTournamentPayload): Promise<TournamentEntity> {
  const response = await http.post<ApiResponse<TournamentEntity>>('/tournaments', payload);
  return response.data.data;
}

export async function getTournamentById(id: string): Promise<TournamentEntity> {
  const response = await http.get<ApiResponse<TournamentEntity>>(`/tournaments/${id}`);
  return response.data.data;
}
