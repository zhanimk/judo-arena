import { ApiResponse, http } from './http';

export type ApplicationStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export interface ApplicationEntity {
  _id: string;
  status: ApplicationStatus;
  reviewComment?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  tournamentId: {
    _id: string;
    title: string;
  };
  clubId: {
    _id: string;
    name: string;
    city?: string;
  };
  coachId: {
    _id: string;
    fullName: string;
    email: string;
  };
  athletes?: Array<{ _id: string; fullName: string }>;
}

export async function getMyApplications(): Promise<ApplicationEntity[]> {
  const response = await http.get<ApiResponse<ApplicationEntity[]>>('/applications/my');
  return response.data.data;
}

export async function approveApplication(id: string): Promise<ApplicationEntity> {
  const response = await http.patch<ApiResponse<ApplicationEntity>>(`/applications/${id}/approve`);
  return response.data.data;
}

export async function rejectApplication(id: string, reviewComment?: string): Promise<ApplicationEntity> {
  const response = await http.patch<ApiResponse<ApplicationEntity>>(`/applications/${id}/reject`, {
    reviewComment,
  });
  return response.data.data;
}

export async function markApplicationUnderReview(id: string): Promise<ApplicationEntity> {
  const response = await http.patch<ApiResponse<ApplicationEntity>>(`/applications/${id}/review`);
  return response.data.data;
}

export async function getApplicationsByTournament(tournamentId: string): Promise<ApplicationEntity[]> {
  const response = await http.get<ApiResponse<ApplicationEntity[]>>(`/applications/tournament/${tournamentId}`);
  return response.data.data;
}
