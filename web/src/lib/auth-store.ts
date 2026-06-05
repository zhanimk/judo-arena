/**
 * Zustand-based store для текущего пользователя.
 * Хранит:
 *   - user: профиль с ролью + клубом
 *   - status: idle / loading / authenticated / unauthenticated
 *   - accessToken: для синхронной проверки
 *
 * Refresh-токен живёт в httpOnly cookie — JS его не видит, это правильно.
 * При старте приложения вызываем bootstrap() — пытается обновить токен.
 */

import { useSyncExternalStore } from "react";
import { api, setAccessToken, setOnUnauthorized } from "./api";
import { Sentry } from "./sentry";

export type UserRole = "ATHLETE" | "COACH" | "ADMIN" | "JUDGE";

export interface User {
  id: string;
  email: string;
  role: Exclude<UserRole, "JUDGE">;
  name: string;
  surname: string;
  nameLatin?: string | null;
  surnameLatin?: string | null;
  preferredLocale: "ru" | "kk" | "en";
  dateOfBirth?: string | null;
  gender?: "MALE" | "FEMALE" | null;
  weightKg?: number | null;
  beltRank?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  clubId?: string | null;
  clubRole?: "OWNER" | "COACH" | null;
  club?: { id: string; name: any; shortName?: string; city: string } | null;
  documents?: Array<{
    id: string;
    type: "BIRTH_CERTIFICATE" | "STUDY_CERTIFICATE" | "COACH_ID";
    url: string;
    originalName?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    updatedAt: string;
  }>;
  isActive: boolean;
  createdAt: string;
}

type Status = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  user: User | null;
  status: Status;
}

let state: AuthState = { user: null, status: "idle" };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  // Sync Sentry user context whenever auth state changes
  if (patch.user !== undefined) {
    if (patch.user) {
      Sentry.setUser({
        id: patch.user.id,
        email: patch.user.email,
        username: `${patch.user.name} ${patch.user.surname}`,
        // extra fields shown in Sentry UI
        role: patch.user.role,
      } as Parameters<typeof Sentry.setUser>[0]);
    } else {
      Sentry.setUser(null);
    }
  }
  emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): AuthState {
  return state;
}

// ============================================================
// PUBLIC API
// ============================================================

export function useAuth(): AuthState & {
  login: (email: string, password: string) => Promise<User>;
  register: (data: Parameters<typeof api.auth.register>[0]) => Promise<User>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  refreshMe: () => Promise<void>;
} {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    ...s,
    login,
    register,
    logout,
    bootstrap,
    refreshMe,
  };
}

export async function login(email: string, password: string): Promise<User> {
  setState({ status: "loading" });
  try {
    const { user, accessToken } = await api.auth.login(email, password);
    setAccessToken(accessToken);
    setState({ user, status: "authenticated" });
    return user;
  } catch (err) {
    setState({ user: null, status: "unauthenticated" });
    throw err;
  }
}

export async function register(data: Parameters<typeof api.auth.register>[0]): Promise<User> {
  setState({ status: "loading" });
  try {
    const { user, accessToken } = await api.auth.register(data);
    setAccessToken(accessToken);
    setState({ user, status: "authenticated" });
    return user;
  } catch (err) {
    setState({ user: null, status: "unauthenticated" });
    throw err;
  }
}

export async function logout(): Promise<void> {
  try {
    await api.auth.logout();
  } catch {
    // ignore
  }
  setAccessToken(null);
  setState({ user: null, status: "unauthenticated" });
}

/** При старте приложения: пытаемся обновить токен и подтянуть профиль. */
export async function bootstrap(): Promise<void> {
  if (state.status === "loading" || state.status === "authenticated") return;
  setState({ status: "loading" });
  try {
    const newToken = await api.auth.refresh();
    if (!newToken) {
      setState({ user: null, status: "unauthenticated" });
      return;
    }
    setAccessToken(newToken);
    const { user } = await api.auth.me();
    setState({ user, status: "authenticated" });
  } catch {
    setState({ user: null, status: "unauthenticated" });
  }
}

export async function refreshMe(): Promise<void> {
  try {
    const { user } = await api.auth.me();
    setState({ user });
  } catch {
    setState({ user: null, status: "unauthenticated" });
  }
}

// Когда API увидит 401 и не сможет refresh — снести юзера
setOnUnauthorized(() => {
  setAccessToken(null);
  setState({ user: null, status: "unauthenticated" });
});

export function getCurrentUser(): User | null {
  return state.user;
}

export function isAthleteProfileComplete(user: User | null): boolean {
  if (!user || user.role !== "ATHLETE") return true;
  return Boolean(user.name && user.surname && user.dateOfBirth && user.gender && user.weightKg);
}
