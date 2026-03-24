import { ApiResponse, http } from './http';
import { UserRole } from '@/lib/types';

export type ApiRole = 'ATHLETE' | 'COACH' | 'ADMIN' | 'JUDGE';

export interface ApiUser {
  _id: string;
  fullName: string;
  email: string;
  role: ApiRole;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
}

export interface AuthPayload {
  user: ApiUser;
  token: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  role: 'ATHLETE' | 'COACH';
}

export function mapApiRoleToUi(role: ApiRole): UserRole {
  switch (role) {
    case 'ATHLETE':
      return 'athlete';
    case 'COACH':
      return 'coach';
    case 'JUDGE':
      return 'judge';
    case 'ADMIN':
    default:
      return 'admin';
  }
}

export async function login(payload: LoginPayload): Promise<AuthPayload> {
  const response = await http.post<ApiResponse<AuthPayload>>('/auth/login', payload);
  return response.data.data;
}

export async function register(payload: RegisterPayload): Promise<AuthPayload> {
  const response = await http.post<ApiResponse<AuthPayload>>('/auth/register', payload);
  return response.data.data;
}

export async function me(): Promise<ApiUser> {
  const response = await http.get<ApiResponse<ApiUser>>('/auth/me');
  return response.data.data;
}
