import { ApiResponse, http } from './http';

export interface DashboardResponse {
  role: 'ADMIN' | 'COACH' | 'ATHLETE' | 'JUDGE';
  stats?: Record<string, number>;
  summary?: Record<string, unknown>;
  recentTournaments?: Array<{
    _id: string;
    title: string;
    startDate: string;
    location: string;
    status: string;
  }>;
  queue?: Array<{
    _id: string;
    tatamiNumber: number;
    roundNumber: number;
    status: string;
    categoryKey: string;
    slotA?: { displayNameSnapshot?: string };
    slotB?: { displayNameSnapshot?: string };
  }>;
}

export async function getMyDashboard(): Promise<DashboardResponse> {
  const response = await http.get<ApiResponse<DashboardResponse>>('/dashboard/me');
  return response.data.data;
}
