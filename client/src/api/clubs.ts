import { ApiResponse, http } from './http';

export interface ClubEntity {
  _id: string;
  name: string;
  city: string;
  description?: string | null;
  contacts?: string | null;
  coachId?: {
    _id: string;
    fullName?: string;
    email?: string;
    role?: 'COACH' | 'ADMIN' | 'ATHLETE' | 'JUDGE';
  } | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClubMember {
  _id: string;
  fullName: string;
  email: string;
  role: 'ATHLETE' | 'COACH' | 'ADMIN' | 'JUDGE';
  city?: string | null;
  rank?: string | null;
  weight?: number | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
}

export interface ClubDetails {
  club: ClubEntity;
  members: ClubMember[];
}

export interface CreateClubPayload {
  name: string;
  city: string;
  description?: string;
  contacts?: string;
}

export interface UpdateClubPayload {
  name?: string;
  city?: string;
  description?: string;
  contacts?: string;
}

export async function getClubs(params?: { city?: string }): Promise<ClubEntity[]> {
  const response = await http.get<ApiResponse<ClubEntity[]>>('/clubs', { params });
  return response.data.data;
}

export async function getClubById(id: string): Promise<ClubDetails> {
  const response = await http.get<ApiResponse<ClubDetails>>(`/clubs/${id}`);
  return response.data.data;
}

export async function createClub(payload: CreateClubPayload): Promise<ClubEntity> {
  const response = await http.post<ApiResponse<ClubEntity>>('/clubs', payload);
  return response.data.data;
}

export async function updateClub(id: string, payload: UpdateClubPayload): Promise<ClubEntity> {
  const response = await http.put<ApiResponse<ClubEntity>>(`/clubs/${id}`, payload);
  return response.data.data;
}

export async function sendJoinRequest(clubId: string): Promise<void> {
  await http.post<ApiResponse<null>>(`/clubs/${clubId}/join-request`);
}

export async function removeAthleteFromClub(clubId: string, athleteId: string): Promise<void> {
  await http.patch<ApiResponse<null>>(`/clubs/${clubId}/members/${athleteId}/remove`);
}
