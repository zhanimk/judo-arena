/**
 * API клиент для Judo-Arena Backend.
 *
 * Особенности:
 *   • Автоматически добавляет Bearer-токен из auth-store
 *   • При 401 — пробует обновить токен через /auth/refresh (refresh лежит в httpOnly cookie)
 *   • При повторном 401 — выкидывает на логин
 *   • Обрабатывает CORS с credentials (нужно для cookie)
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setOnUnauthorized(handler: () => void) {
  onUnauthorized = handler;
}

interface RequestOptions extends RequestInit {
  json?: unknown;
  // Для судьи: альтернативная авторизация через X-Judge-Token
  judgeToken?: string;
  // Не делать refresh при 401 (например, при логине)
  skipRefresh?: boolean;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

async function refreshTokens(): Promise<string | null> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return null;
      const data = await res.json();
      accessToken = data.accessToken ?? null;
      return accessToken;
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { json, judgeToken, skipRefresh, headers, ...rest } = opts;

  const buildHeaders = (token?: string | null): HeadersInit => {
    const h: Record<string, string> = {};
    if (json !== undefined) h["Content-Type"] = "application/json";
    if (judgeToken) h["X-Judge-Token"] = judgeToken;
    else if (token) h["Authorization"] = `Bearer ${token}`;
    if (headers) Object.assign(h, headers as Record<string, string>);
    return h;
  };

  const doFetch = (token?: string | null) =>
    fetch(`${API_BASE}${path}`, {
      ...rest,
      credentials: "include",
      headers: buildHeaders(token),
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });

  let res = await doFetch(accessToken);

  // Если 401 — пробуем обновить токен и повторить запрос
  if (res.status === 401 && !skipRefresh && !judgeToken) {
    const newToken = await refreshTokens();
    if (newToken) {
      res = await doFetch(newToken);
    } else {
      if (onUnauthorized) onUnauthorized();
    }
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const err = isJson ? body : { error: "HTTP_ERROR", message: body || res.statusText };
    throw new ApiError(
      res.status,
      err?.error ?? "UNKNOWN",
      err?.message ?? "Запрос упал",
      err?.issues ?? err?.details,
    );
  }

  return body as T;
}

// ============================================================
// API методы (типизированные удобные функции)
// ============================================================

export const api = {
  // --- AUTH ---
  auth: {
    register: (data: {
      email: string;
      password: string;
      role: "ATHLETE" | "COACH";
      name: string;
      surname: string;
      gender?: "MALE" | "FEMALE";
      dateOfBirth?: string;
      weightKg?: number;
      preferredLocale?: "ru" | "kk" | "en";
    }) => request<{ user: any; accessToken: string }>("/api/auth/register", { method: "POST", json: data, skipRefresh: true }),

    login: (email: string, password: string) =>
      request<{ user: any; accessToken: string }>("/api/auth/login", {
        method: "POST",
        json: { email, password },
        skipRefresh: true,
      }),

    refresh: () => refreshTokens(),

    logout: () => request<void>("/api/auth/logout", { method: "POST" }),

    me: () => request<{ user: any }>("/api/auth/me"),

    setLocale: (locale: "ru" | "kk" | "en") =>
      request<{ ok: boolean; locale: string }>("/api/auth/me/locale", { method: "PATCH", json: { locale } }),
  },

  // --- CLUBS ---
  clubs: {
    list: (params?: { city?: string; search?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<{ items: any[]; total: number }>(`/api/clubs${q ? "?" + q : ""}`);
    },
    get: (id: string) => request<any>(`/api/clubs/${id}`),
    create: (data: any) => request<any>("/api/clubs", { method: "POST", json: data }),
    update: (id: string, data: any) => request<any>(`/api/clubs/${id}`, { method: "PATCH", json: data }),
    groups: (id: string) => request<any[]>(`/api/clubs/${id}/groups`),
    createGroup: (id: string, data: any) =>
      request<any>(`/api/clubs/${id}/groups`, { method: "POST", json: data }),
    updateGroup: (id: string, data: any) =>
      request<any>(`/api/club-groups/${id}`, { method: "PATCH", json: data }),
    deleteGroup: (id: string) => request<void>(`/api/club-groups/${id}`, { method: "DELETE" }),
    members: (id: string) => request<any[]>(`/api/clubs/${id}/members`),
    addAthlete: (clubId: string, data: any) =>
      request<any>(`/api/clubs/${clubId}/athletes`, { method: "POST", json: data }),
  },
  athletes: {
    update: (id: string, data: any) =>
      request<any>(`/api/athletes/${id}`, { method: "PATCH", json: data }),
    detachFromClub: (id: string) =>
      request<void>(`/api/athletes/${id}/club`, { method: "DELETE" }),
  },

  // --- TOURNAMENTS ---
  tournaments: {
    list: (params?: { status?: string; city?: string; search?: string; upcoming?: boolean; limit?: number; offset?: number }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<{ items: any[]; total: number }>(`/api/tournaments${q ? "?" + q : ""}`);
    },
    get: (id: string) => request<any>(`/api/tournaments/${id}`),
    create: (data: any) => request<any>("/api/tournaments", { method: "POST", json: data }),
    update: (id: string, data: any) => request<any>(`/api/tournaments/${id}`, { method: "PATCH", json: data }),
    delete: (id: string) => request<void>(`/api/tournaments/${id}`, { method: "DELETE" }),
    setStatus: (id: string, status: string) =>
      request<any>(`/api/tournaments/${id}/status`, { method: "POST", json: { status } }),
    categories: (id: string) => request<any[]>(`/api/tournaments/${id}/categories`),
    addCategory: (id: string, data: any) =>
      request<any>(`/api/tournaments/${id}/categories`, { method: "POST", json: data }),
    updateCategory: (id: string, data: any) =>
      request<any>(`/api/categories/${id}`, { method: "PATCH", json: data }),
    deleteCategory: (id: string) => request<void>(`/api/categories/${id}`, { method: "DELETE" }),
    applications: (id: string) => request<any[]>(`/api/tournaments/${id}/applications`),
    createApplication: (id: string, notes?: string) =>
      request<any>(`/api/tournaments/${id}/applications`, { method: "POST", json: { notes } }),
  },

  // --- APPLICATIONS ---
  applications: {
    get: (id: string) => request<any>(`/api/applications/${id}`),
    addEntry: (id: string, athleteId: string, categoryId: string) =>
      request<any>(`/api/applications/${id}/entries`, { method: "POST", json: { athleteId, categoryId } }),
    removeEntry: (id: string, entryId: string) =>
      request<void>(`/api/applications/${id}/entries/${entryId}`, { method: "DELETE" }),
    submit: (id: string) => request<any>(`/api/applications/${id}/submit`, { method: "POST" }),
    withdraw: (id: string) => request<any>(`/api/applications/${id}/withdraw`, { method: "POST" }),
    approve: (id: string, notes?: string) =>
      request<any>(`/api/applications/${id}/approve`, { method: "POST", json: { reviewerNotes: notes } }),
    reject: (id: string, notes?: string) =>
      request<any>(`/api/applications/${id}/reject`, { method: "POST", json: { reviewerNotes: notes } }),
  },

  // --- BRACKETS ---
  brackets: {
    generate: (tournamentId: string, categoryId: string) =>
      request<any>(`/api/tournaments/${tournamentId}/categories/${categoryId}/bracket`, { method: "POST" }),
    getByCategory: (tournamentId: string, categoryId: string) =>
      request<any>(`/api/tournaments/${tournamentId}/categories/${categoryId}/bracket`),
    forTournament: (tournamentId: string) =>
      request<any[]>(`/api/tournaments/${tournamentId}/brackets`),
    prepareTournament: (tournamentId: string) =>
      request<any>(`/api/tournaments/${tournamentId}/brackets/prepare`, { method: "POST" }),
    get: (id: string) => request<any>(`/api/brackets/${id}`),
    delete: (id: string) => request<void>(`/api/brackets/${id}`, { method: "DELETE" }),
  },

  // --- MATCHES ---
  matches: {
    list: (params?: { tournamentId?: string; bracketId?: string; athleteId?: string; status?: string; tatamiNumber?: number; limit?: number; offset?: number }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<any[]>(`/api/matches${q ? "?" + q : ""}`);
    },
    get: (id: string) => request<any>(`/api/matches/${id}`),
    start: (id: string, judgeToken?: string) =>
      request<any>(`/api/matches/${id}/start`, { method: "POST", judgeToken }),
    pause: (id: string, judgeToken?: string) =>
      request<any>(`/api/matches/${id}/pause`, { method: "POST", judgeToken }),
    score: (id: string, type: string, side: "RED" | "BLUE", judgeToken?: string) =>
      request<any>(`/api/matches/${id}/score`, { method: "POST", json: { type, side }, judgeToken }),
    osaekomi: (id: string, side: "RED" | "BLUE", judgeToken?: string) =>
      request<any>(`/api/matches/${id}/osaekomi`, { method: "POST", json: { side }, judgeToken }),
    toketa: (id: string, judgeToken?: string) =>
      request<any>(`/api/matches/${id}/toketa`, { method: "POST", json: { reason: "TOKETA" }, judgeToken }),
    finish: (id: string, winnerSide: "RED" | "BLUE", reason?: string, judgeToken?: string) =>
      request<any>(`/api/matches/${id}/finish`, { method: "POST", json: { winnerSide, reason }, judgeToken }),
    assignTatami: (id: string, tatamiNumber: number | null) =>
      request<any>(`/api/matches/${id}/tatami`, { method: "PATCH", json: { tatamiNumber } }),
    reorderQueue: (id: string, direction: "up" | "down") =>
      request<any>(`/api/matches/${id}/queue`, { method: "PATCH", json: { direction } }),
    tatamiQueue: (tournamentId: string, tatamiNumber: number) =>
      request<any[]>(`/api/tatami/${tournamentId}/${tatamiNumber}/queue`),
    createJudgeSession: (id: string, judgeName?: string) =>
      request<any>(`/api/matches/${id}/judge-session`, { method: "POST", json: { judgeName } }),
    judgeByToken: (token: string) => request<any>(`/api/judge/${token}`),
  },

  // --- ADMIN ---
  admin: {
    override: (matchId: string, winnerSide: "RED" | "BLUE", reason: string) =>
      request<any>(`/api/admin/matches/${matchId}/override`, { method: "POST", json: { winnerSide, reason } }),
    finalize: (tournamentId: string) =>
      request<any>(`/api/admin/tournaments/${tournamentId}/finalize`, { method: "POST" }),
    auditLogs: (params?: any) => {
      const q = new URLSearchParams(params as any).toString();
      return request<any>(`/api/admin/audit-logs${q ? "?" + q : ""}`);
    },
    bracketPdfUrl: (bracketId: string) => `${API_BASE}/api/pdf/bracket?bracketId=${bracketId}`,
    protocolPdfUrl: (tournamentId: string) =>
      `${API_BASE}/api/pdf/protocol?tournamentId=${tournamentId}`,

    // Клубы — управление
    getClub: (id: string) => request<any>(`/api/admin/clubs/${id}`),
    blockClub: (id: string, blocked: boolean, reason?: string) =>
      request<any>(`/api/admin/clubs/${id}/block`, { method: "PATCH", json: { blocked, reason } }),

    // Пользователи
    listUsers: (params?: any) => {
      const q = new URLSearchParams(params as any).toString();
      return request<{ items: any[]; total: number }>(`/api/admin/users${q ? "?" + q : ""}`);
    },
    getUser: (id: string) => request<any>(`/api/admin/users/${id}`),
    toggleUserActive: (id: string, active: boolean) =>
      request<any>(`/api/admin/users/${id}/active`, { method: "PATCH", json: { active } }),

    // Турниры — featured/archive
    featureTournament: (id: string, featured: boolean) =>
      request<any>(`/api/admin/tournaments/${id}/feature`, { method: "PATCH", json: { featured } }),
    archiveTournament: (id: string, archive: boolean) =>
      request<any>(`/api/admin/tournaments/${id}/archive`, { method: "PATCH", json: { archive } }),

    // SystemConfig
    getConfig: (key: string) => request<any>(`/api/admin/system-config/${key}`),
    updateConfig: (key: string, value: unknown) =>
      request<any>(`/api/admin/system-config/${key}`, { method: "PATCH", json: { value } }),

    // Stats
    stats: () => request<any>("/api/admin/stats"),
  },

  // --- NOTIFICATIONS ---
  notifications: {
    list: () => request<any[]>("/api/notifications"),
    unreadCount: () => request<{ count: number }>("/api/notifications/unread-count"),
    markAllRead: () => request<void>("/api/notifications/mark-read", { method: "POST" }),
    markRead: (id: string) => request<any>(`/api/notifications/${id}/read`, { method: "POST" }),
    broadcast: (data: any) =>
      request<{ count: number }>("/api/notifications/broadcast", { method: "POST", json: data }),
  },

  // --- RATINGS ---
  ratings: {
    athlete: (id: string) =>
      request<{ athleteId: string; totalPoints: number; entries: any[] }>(`/api/ratings/athletes/${id}`),
    leaderboard: (params?: { categoryId?: string; clubId?: string; limit?: number }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<any[]>(`/api/ratings/leaderboard${q ? "?" + q : ""}`);
    },
  },
};

export const apiBaseUrl = API_BASE;
