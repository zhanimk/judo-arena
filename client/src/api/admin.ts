import { ApiResponse, http } from './http';

export interface AdminDashboardStats {
  tournamentsTotal: number;
  clubsTotal: number;
  athletesTotal: number;
  pendingApplications: number;
  activeMatches: number;
}

export interface AdminTournamentOverview {
  _id: string;
  title: string;
  startDate: string;
  endDate: string;
  location: string;
  status: string;
  categories: Array<{ id: string; label: string }>;
}

export interface AdminDashboardPayload {
  stats: AdminDashboardStats;
  recentTournaments: AdminTournamentOverview[];
}

export interface NotificationPayload {
  _id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  isRead: boolean;
}

export async function getAdminDashboard(): Promise<AdminDashboardPayload> {
  const response = await http.get<ApiResponse<AdminDashboardPayload>>('/admin/dashboard');
  return response.data.data;
}

export async function getMyNotifications(): Promise<NotificationPayload[]> {
  const response = await http.get<ApiResponse<NotificationPayload[]>>('/notifications');
  return response.data.data;
}
