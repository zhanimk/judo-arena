import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  login as loginApi,
  mapApiRoleToUi,
  me as meApi,
  register as registerApi,
  ApiUser,
  LoginPayload,
  RegisterPayload,
} from '@/api/auth';
import { getAuthToken, setAuthToken } from '@/api/http';
import { UserRole } from '@/lib/types';

interface AuthState {
  user: ApiUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<ApiUser>;
  register: (payload: RegisterPayload) => Promise<ApiUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const token = getAuthToken();

      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await meApi();
        setUser(currentUser);
      } catch {
        setAuthToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      role: user ? mapApiRoleToUi(user.role) : null,
      isAuthenticated: Boolean(user),
      isLoading,
      login: async (payload) => {
        const result = await loginApi(payload);
        setAuthToken(result.token);
        setUser(result.user);

        return result.user;
      },
      register: async (payload) => {
        const result = await registerApi(payload);
        setAuthToken(result.token);
        setUser(result.user);

        return result.user;
      },
      logout: () => {
        setAuthToken(null);
        setUser(null);
      },
    }),
    [isLoading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthState {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
