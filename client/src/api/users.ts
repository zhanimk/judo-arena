import { ApiResponse, http } from './http';

export type UserRole = 'ATHLETE' | 'COACH' | 'JUDGE' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface UserListItem {
  _id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  city?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
  clubId?: {
    _id: string;
    name: string;
    city?: string;
  } | null;
}

export interface UsersListResponse {
  items: UserListItem[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface UsersListParams {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getUsers(params: UsersListParams = {}): Promise<UsersListResponse> {
  const response = await http.get<ApiResponse<UsersListResponse>>('/users', { params });
  return response.data.data;
}

export async function updateUserStatus(id: string, status: UserStatus): Promise<UserListItem> {
  const response = await http.patch<ApiResponse<UserListItem>>(`/users/${id}/status`, { status });
  return response.data.data;
}
