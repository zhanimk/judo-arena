import { ApiResponse, http } from './http';

export type ApplicationStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export interface ApplicationEntity {
  _id?: string;
  id?: string;
  status: ApplicationStatus;
  reviewComment?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  tournamentId: {
    _id?: string;
    id?: string;
    title: string;
  };
  clubId: {
    _id?: string;
    id?: string;
    name: string;
    city?: string;
  };
  coachId: {
    _id?: string;
    id?: string;
    fullName: string;
    email: string;
  };
  athletes?: Array<{ _id?: string; id?: string; fullName: string }>;
}

function withEntityIds<T extends { _id?: string; id?: string }>(entity: T): T {
  const normalizedId = entity._id || entity.id;
  return {
    ...entity,
    _id: normalizedId,
    id: normalizedId,
  };
}

function normalizeApplication(application: ApplicationEntity): ApplicationEntity {
  return {
    ...withEntityIds(application),
    tournamentId: withEntityIds(application.tournamentId),
    clubId: withEntityIds(application.clubId),
    coachId: withEntityIds(application.coachId),
    athletes: (application.athletes || []).map((athlete) => withEntityIds(athlete)),
  };
}

export async function getMyApplications(): Promise<ApplicationEntity[]> {
  const response = await http.get<ApiResponse<ApplicationEntity[]>>('/applications/my');
  return response.data.data.map(normalizeApplication);
}

export async function approveApplication(id: string): Promise<ApplicationEntity> {
  const response = await http.patch<ApiResponse<ApplicationEntity>>(`/applications/${id}/approve`);
  return normalizeApplication(response.data.data);
}

export async function rejectApplication(id: string, reviewComment?: string): Promise<ApplicationEntity> {
  const response = await http.patch<ApiResponse<ApplicationEntity>>(`/applications/${id}/reject`, {
    reviewComment,
  });
  return normalizeApplication(response.data.data);
}

export async function markApplicationUnderReview(id: string): Promise<ApplicationEntity> {
  const response = await http.patch<ApiResponse<ApplicationEntity>>(`/applications/${id}/review`);
  return normalizeApplication(response.data.data);
}

export async function getApplicationsByTournament(tournamentId: string): Promise<ApplicationEntity[]> {
  const response = await http.get<ApiResponse<ApplicationEntity[]>>(`/applications/tournament/${tournamentId}`);
  return response.data.data.map(normalizeApplication);
}
