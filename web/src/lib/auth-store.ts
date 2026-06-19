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
import { api, ApiError, setAccessToken, setOnUnauthorized, wasRefreshRejected } from "./api";
import { setOnAuthRevoked } from "./socket";
import { Sentry } from "./sentry";
import type { User, UserRole } from "./api-types";

export type { User, UserRole };

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
  login: (
    email: string,
    password: string,
  ) => Promise<User | { totpRequired: true; challengeToken: string }>;
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

export async function login(
  email: string,
  password: string,
): Promise<User | { totpRequired: true; challengeToken: string }> {
  setState({ status: "loading" });
  try {
    const result = await api.auth.login(email, password);
    if ("totpRequired" in result && result.totpRequired) {
      setState({ status: "unauthenticated" });
      return result as { totpRequired: true; challengeToken: string };
    }
    const { user, accessToken } = result as { user: User; accessToken: string };
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

  // Render can need a few seconds to wake up. Do not treat that as logout.
  const timeoutId = setTimeout(() => {
    if (state.status === "loading") {
      setState({ user: null, status: "unauthenticated" });
    }
  }, 15_000);

  try {
    let newToken: string | null = null;
    for (let attempt = 0; attempt < 3 && !newToken; attempt++) {
      newToken = await api.auth.refresh();
      if (newToken || wasRefreshRejected()) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
    if (!newToken) {
      setState({ user: null, status: "unauthenticated" });
      return;
    }
    setAccessToken(newToken);
    const { user } = await api.auth.me();
    setState({ user, status: "authenticated" });
  } catch {
    setState({ user: null, status: "unauthenticated" });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function refreshMe(): Promise<void> {
  try {
    const { user } = await api.auth.me();
    setState({ user });
  } catch (error) {
    // Do not destroy a valid local session because of a temporary network or
    // server failure. The API client handles confirmed refresh rejection.
    if (error instanceof ApiError && error.status === 401) {
      setState({ user: null, status: "unauthenticated" });
    }
  }
}

// Когда API увидит 401 и не сможет refresh — снести юзера
setOnUnauthorized(() => {
  setAccessToken(null);
  setState({ user: null, status: "unauthenticated" });
});

// Когда сервер принудительно отзывает сессию через Socket.IO (logout-all, деактивация, смена пароля)
setOnAuthRevoked(() => {
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
