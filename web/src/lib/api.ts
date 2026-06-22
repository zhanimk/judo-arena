/**
 * API клиент для Judo-Arena Backend.
 *
 * Особенности:
 *   • Автоматически добавляет Bearer-токен из auth-store
 *   • При 401 — пробует обновить токен через /auth/refresh (refresh лежит в httpOnly cookie)
 *   • При повторном 401 — выкидывает на логин
 *   • Обрабатывает CORS с credentials (нужно для cookie)
 */

// Пустая строка → запросы идут как относительные URL через Vite proxy.
// Непустая строка (продакш) → прямой адрес API сервера.
import { updateSocketToken } from "./socket";

const API_BASE = import.meta.env.VITE_API_URL || "";

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export function mediaUrl(url?: string | null): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return apiUrl(url);
}

function qs(params?: Record<string, string | number | boolean | null | undefined>): string {
  if (!params) return "";
  const filtered = Object.fromEntries(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => [k, String(v)]),
  );
  const q = new URLSearchParams(filtered).toString();
  return q ? "?" + q : "";
}

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
let refreshFailCount = 0;
const MAX_REFRESH_FAILURES = 3;

// Дедупликация GET-запросов — предотвращает дублирующие fetch при двойном клике
const pendingRequests = new Map<string, Promise<unknown>>();

// ── CSRF Protection ────────────────────────────────────────────────────────
// Получаем CSRF токен один раз при загрузке и передаём в заголовке
// x-csrf-token при каждом state-changing запросе (POST/PATCH/PUT/DELETE).
let csrfToken: string | null = null;

async function fetchCsrfToken(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/csrf-token`, {
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrfToken ?? null;
    }
  } catch {
    // Не блокируем — токен будет запрошен при следующей ошибке
  }
}

export async function initCsrf(): Promise<void> {
  return fetchCsrfToken();
}

const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function getCsrfToken(): string | null {
  return csrfToken;
}

function shouldUseE2eRateLimitBypass(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem("judo-e2e-rate-limit-bypass") === "1"
    );
  } catch {
    return false;
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) refreshFailCount = 0;
  updateSocketToken(token);
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
  // Для судьи татами: авторизация через X-Tatami-Token
  tatamiToken?: string;
  // Не делать refresh при 401 (например, при логине)
  skipRefresh?: boolean;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function refreshTokens(): Promise<string | null> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  if (refreshFailCount >= MAX_REFRESH_FAILURES) {
    if (onUnauthorized) onUnauthorized();
    return null;
  }
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        refreshFailCount++;
        return null;
      }
      const data = await res.json();
      setAccessToken(data.accessToken ?? null);
      refreshFailCount = 0;
      return accessToken;
    } catch {
      refreshFailCount++;
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export function resetRefreshFailCount(): void {
  refreshFailCount = 0;
}

async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { json, judgeToken, tatamiToken, skipRefresh, headers, ...rest } = opts;

  // Дедупликация: одинаковые GET-запросы не дублируются пока первый в процессе
  const method = (rest.method ?? "GET").toUpperCase();
  if (method === "GET" && !judgeToken && !tatamiToken) {
    const dedupKey = path;
    const inflight = pendingRequests.get(dedupKey);
    if (inflight) return inflight as Promise<T>;
    const promise = _doRequest<T>(path, opts);
    pendingRequests.set(dedupKey, promise);
    promise.finally(() => pendingRequests.delete(dedupKey));
    return promise;
  }

  return _doRequest<T>(path, opts);
}

async function _doRequest<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { json, judgeToken, tatamiToken, skipRefresh, headers, ...rest } = opts;

  const method = (rest.method ?? "GET").toUpperCase();

  const buildHeaders = (token?: string | null): HeadersInit => {
    const h: Record<string, string> = {};
    if (json !== undefined) h["Content-Type"] = "application/json";
    if (judgeToken) h["X-Judge-Token"] = judgeToken;
    else if (tatamiToken) h["X-Tatami-Token"] = tatamiToken;
    else if (token) h["Authorization"] = `Bearer ${token}`;
    if (shouldUseE2eRateLimitBypass()) h["x-e2e-test"] = "1";
    // Добавляем CSRF токен на все state-changing запросы
    if (!CSRF_SAFE_METHODS.has(method)) {
      const csrf = getCsrfToken();
      if (csrf) {
        h["x-csrf-token"] = csrf;
      } else {
        console.warn(`[api] CSRF token missing for ${method} ${path} — request may fail with 403`);
      }
    }
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
  if (res.status === 401 && !skipRefresh && !judgeToken && !tatamiToken) {
    const newToken = await refreshTokens();
    if (newToken) {
      res = await doFetch(newToken);
    } else {
      if (onUnauthorized) onUnauthorized();
    }
  }

  // Если 403 из-за устаревшего CSRF-токена — обновляем и повторяем один раз
  if (res.status === 403 && !CSRF_SAFE_METHODS.has(method) && !judgeToken && !tatamiToken) {
    const body403 = await res.json().catch(() => null);
    if (body403?.error === "CSRF_INVALID" || body403?.error === "CSRF_MISSING") {
      await fetchCsrfToken();
      res = await doFetch(accessToken);
    } else {
      // Не CSRF-ошибка — вернуть тело обратно в поток для дальнейшей обработки
      const errBody = body403 ?? { error: "FORBIDDEN", message: res.statusText };
      throw new ApiError(
        403,
        errBody?.error ?? "FORBIDDEN",
        errBody?.message ?? "Доступ запрещён",
        errBody?.issues,
      );
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

// Authenticated download — fetches with Bearer token and triggers browser download
export async function downloadWithAuth(path: string, filename: string): Promise<void> {
  const token = accessToken;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, "DOWNLOAD_ERROR", "Жүктеу қатесі");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// API методы (типизированные удобные функции)
// ============================================================

import type {
  User,
  UserDocument,
  Club,
  ClubGroup,
  Tournament,
  Category,
  Application,
  ApplicationEntry,
  Bracket,
  Match,
  RatingEntry,
  Notification,
  NotificationBroadcast,
  AdminStats,
  AuditLog,
  TatamiSession,
  Paginated,
  // Input types
  UpdateProfileInput,
  CreateClubInput,
  UpdateClubInput,
  CreateGroupInput,
  UpdateGroupInput,
  CreateTournamentInput,
  UpdateTournamentInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateUserInput,
  UpdateUserInput,
  AddAthleteInput,
  AdminListUsersParams,
  BroadcastNotificationInput,
  ClubJoinRequest,
  AthleteLeaderboardEntry,
  ClubLeaderboardEntry,
  WeightClassLeaderboardEntry,
  FederationAnalytics,
  PaymentInitResult,
  ClubAnalytics,
} from "./api-types";

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
    }) =>
      request<{ user: User; accessToken: string }>("/api/auth/register", {
        method: "POST",
        json: data,
        skipRefresh: true,
      }),

    // 2FA (TOTP)
    twofa: {
      status: () => request<{ enabled: boolean }>("/api/auth/2fa/status"),
      setup: () =>
        request<{ secret: string; otpauthUrl: string; qrDataUrl: string }>("/api/auth/2fa/setup", {
          method: "POST",
        }),
      verifySetup: (code: string) =>
        request<{ ok: boolean }>("/api/auth/2fa/verify-setup", {
          method: "POST",
          json: { code },
        }),
      disable: (code: string) =>
        request<{ ok: boolean }>("/api/auth/2fa/disable", {
          method: "POST",
          json: { code },
        }),
      challenge: (challengeToken: string, code: string) =>
        request<{ accessToken: string; user: unknown }>("/api/auth/2fa/challenge", {
          method: "POST",
          json: { challengeToken, code },
          skipRefresh: true,
        }),
    },
    login: (email: string, password: string) =>
      request<{ user: User; accessToken: string } | { totpRequired: true; challengeToken: string }>(
        "/api/auth/login",
        {
          method: "POST",
          json: { email, password },
          skipRefresh: true,
        },
      ),

    refresh: () => refreshTokens(),

    logout: () => request<void>("/api/auth/logout", { method: "POST" }),

    cancelRegistration: () => request<void>("/api/auth/me", { method: "DELETE" }),

    me: () => request<{ user: User }>("/api/auth/me"),

    setLocale: (locale: "ru" | "kk" | "en") =>
      request<{ ok: boolean; locale: string }>("/api/auth/me/locale", {
        method: "PATCH",
        json: { locale },
      }),

    updateProfile: (data: UpdateProfileInput) =>
      request<{ user: User }>("/api/auth/me/profile", { method: "PATCH", json: data }),

    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      request<{ ok: boolean }>("/api/auth/me/change-password", { method: "POST", json: data }),

    saveDocument: (data: {
      type: "BIRTH_CERTIFICATE" | "STUDY_CERTIFICATE" | "COACH_ID";
      url: string;
      originalName?: string | null;
      mimeType?: string | null;
      sizeBytes?: number | null;
    }) =>
      request<{ document: UserDocument }>("/api/auth/me/documents", { method: "PUT", json: data }),

    downloadDocument: (document: Pick<UserDocument, "id" | "originalName">) =>
      downloadWithAuth(
        `/api/auth/documents/${document.id}/download`,
        document.originalName || `document-${document.id}`,
      ),

    forgotPassword: (email: string) =>
      request<{ ok: boolean }>("/api/auth/forgot-password", {
        method: "POST",
        json: { email },
        skipRefresh: true,
      }),

    resetPassword: (token: string, password: string) =>
      request<{ ok: boolean }>("/api/auth/reset-password", {
        method: "POST",
        json: { token, password },
        skipRefresh: true,
      }),

    resendVerification: () =>
      request<{ ok: boolean }>("/api/auth/resend-verification", { method: "POST" }),
  },

  uploads: {
    image: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<{ url: string }>("/api/upload/image", { method: "POST", body: form });
    },
    avatar: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<{ url: string }>("/api/upload/avatar", { method: "POST", body: form });
    },
    document: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<{ url: string; fileName: string; mimeType: string; size: number }>(
        "/api/upload/document",
        { method: "POST", body: form },
      );
    },
    regulation: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<{ url: string; fileName: string; mimeType: string; size: number }>(
        "/api/upload/regulation",
        { method: "POST", body: form },
      );
    },
  },

  // --- CLUBS ---
  clubs: {
    list: (params?: { city?: string; search?: string; limit?: number }) => {
      const q = qs(params);
      return request<Paginated<Club>>(`/api/clubs${q}`);
    },
    get: (id: string) => request<Club>(`/api/clubs/${id}`),
    analytics: (id: string) => request<ClubAnalytics>(`/api/clubs/${id}/analytics`),
    create: (data: CreateClubInput) => request<Club>("/api/clubs", { method: "POST", json: data }),
    update: (id: string, data: UpdateClubInput) =>
      request<Club>(`/api/clubs/${id}`, { method: "PATCH", json: data }),
    groups: (id: string) => request<ClubGroup[]>(`/api/clubs/${id}/groups`),
    createGroup: (id: string, data: CreateGroupInput) =>
      request<ClubGroup>(`/api/clubs/${id}/groups`, { method: "POST", json: data }),
    updateGroup: (id: string, data: UpdateGroupInput) =>
      request<ClubGroup>(`/api/club-groups/${id}`, { method: "PATCH", json: data }),
    deleteGroup: (id: string) => request<void>(`/api/club-groups/${id}`, { method: "DELETE" }),
    members: (id: string) => request<User[]>(`/api/clubs/${id}/members`),
    addAthlete: (clubId: string, data: AddAthleteInput) =>
      request<User>(`/api/clubs/${clubId}/athletes`, { method: "POST", json: data }),
    bulkImportAthletes: (clubId: string, rows: AddAthleteInput[]) =>
      request<{
        created: number;
        skipped: number;
        errors: Array<{ row: number; email: string; reason: string }>;
      }>(`/api/clubs/${clubId}/athletes/bulk-import`, { method: "POST", json: { rows } }),
    joinRequest: (clubId: string) =>
      request<ClubJoinRequest>(`/api/clubs/${clubId}/join-request`, { method: "POST" }),
    coachJoinRequest: (clubId: string) =>
      request<ClubJoinRequest>(`/api/clubs/${clubId}/coach-join-request`, { method: "POST" }),
    removeCoach: (clubId: string, coachId: string) =>
      request<{ ok: boolean }>(`/api/clubs/${clubId}/coaches/${coachId}`, { method: "DELETE" }),
    transferOwner: (clubId: string, coachId: string) =>
      request<{ ok: boolean }>(`/api/clubs/${clubId}/coaches/${coachId}/transfer-owner`, {
        method: "POST",
      }),
  },

  // --- JOIN REQUESTS ---
  joinRequests: {
    myList: () => request<ClubJoinRequest[]>("/api/athlete/join-requests"),
    cancel: (id: string) => request<void>(`/api/athlete/join-requests/${id}`, { method: "DELETE" }),
    coachList: () => request<ClubJoinRequest[]>("/api/coach/join-requests"),
    review: (id: string, approve: boolean) =>
      request<{ ok: boolean }>(`/api/coach/join-requests/${id}/review`, {
        method: "POST",
        json: { approve },
      }),
  },
  coachClubRequests: {
    myList: () => request<ClubJoinRequest[]>("/api/coach/club-join-requests"),
    cancel: (id: string) =>
      request<{ ok: boolean }>(`/api/coach/club-join-requests/${id}`, { method: "DELETE" }),
    incoming: () => request<ClubJoinRequest[]>("/api/coach/club-join-requests/incoming"),
    review: (id: string, approve: boolean) =>
      request<{ ok: boolean }>(`/api/coach/club-join-requests/${id}/review`, {
        method: "POST",
        json: { approve },
      }),
  },
  athletes: {
    update: (id: string, data: UpdateUserInput) =>
      request<User>(`/api/athletes/${id}`, { method: "PATCH", json: data }),
    detachFromClub: (id: string) => request<void>(`/api/athletes/${id}/club`, { method: "DELETE" }),
  },

  // --- TOURNAMENTS ---
  tournaments: {
    list: (params?: {
      status?: string;
      city?: string;
      search?: string;
      upcoming?: boolean;
      limit?: number;
      offset?: number;
      includeArchived?: boolean;
    }) => {
      const q = qs(params);
      return request<Paginated<Tournament>>(`/api/tournaments${q}`);
    },
    get: (id: string) => request<Tournament>(`/api/tournaments/${id}`),
    create: (data: CreateTournamentInput) =>
      request<Tournament>("/api/tournaments", { method: "POST", json: data }),
    update: (id: string, data: UpdateTournamentInput) =>
      request<Tournament>(`/api/tournaments/${id}`, { method: "PATCH", json: data }),
    delete: (id: string) => request<void>(`/api/tournaments/${id}`, { method: "DELETE" }),
    setStatus: (id: string, status: string) =>
      request<Tournament>(`/api/tournaments/${id}/status`, { method: "POST", json: { status } }),
    categories: (id: string) => request<Category[]>(`/api/tournaments/${id}/categories`),
    addCategory: (id: string, data: CreateCategoryInput) =>
      request<Category>(`/api/tournaments/${id}/categories`, { method: "POST", json: data }),
    addCategoriesBulk: (id: string, categories: CreateCategoryInput[]) =>
      request<{ added: number; skipped: number; categories: Category[] }>(
        `/api/tournaments/${id}/categories/bulk`,
        { method: "POST", json: { categories } },
      ),
    updateCategory: (id: string, data: UpdateCategoryInput) =>
      request<Category>(`/api/categories/${id}`, { method: "PATCH", json: data }),
    deleteCategory: (id: string) => request<void>(`/api/categories/${id}`, { method: "DELETE" }),
    applications: (id: string) => request<Application[]>(`/api/tournaments/${id}/applications`),
    createApplication: (id: string, notes?: string) =>
      request<Application>(`/api/tournaments/${id}/applications`, {
        method: "POST",
        json: { notes },
      }),
    bulkApprove: (id: string, notes?: string) =>
      request<{ approved: number }>(`/api/tournaments/${id}/applications/bulk-approve`, {
        method: "POST",
        json: { reviewerNotes: notes },
      }),
    // Публичный список участников по категории — draw list как на IJF
    categoryParticipants: (tournamentId: string, categoryId: string) =>
      request<
        Array<{
          entryId: string;
          weighInStatus: string;
          athlete: {
            id: string;
            name: string;
            surname: string;
            nameLatin: string | null;
            surnameLatin: string | null;
            gender: string;
            weightKg: number | null;
            beltRank: string | null;
            avatarUrl: string | null;
            club: { id: string; name: any; city: string | null; logoUrl: string | null } | null;
          };
        }>
      >(`/api/tournaments/${tournamentId}/categories/${categoryId}/participants`),

    // Все участники по всем категориям — полный drawsheet
    allParticipants: (tournamentId: string) =>
      request<
        Array<{
          categoryId: string;
          gender: string;
          ageMin: number;
          ageMax: number;
          weightMin: number;
          weightMax: number;
          name: unknown;
          count: number;
          athletes: Array<{
            entryId: string;
            weighInStatus: string;
            athlete: {
              id: string;
              name: string;
              surname: string;
              nameLatin: string | null;
              surnameLatin: string | null;
              weightKg: number | null;
              beltRank: string | null;
              avatarUrl: string | null;
              club: {
                id: string;
                name: unknown;
                shortName: string | null;
                city: string | null;
                logoUrl: string | null;
              } | null;
            };
          }>;
        }>
      >(`/api/tournaments/${tournamentId}/participants`),
  },

  // --- APPLICATIONS ---
  applications: {
    myClub: () => request<Application[]>("/api/coach/applications"),
    mineAsAthlete: () => request<ApplicationEntry[]>("/api/athlete/applications"),
    get: (id: string) => request<Application>(`/api/applications/${id}`),
    addEntry: (id: string, athleteId: string, categoryId: string) =>
      request<ApplicationEntry>(`/api/applications/${id}/entries`, {
        method: "POST",
        json: { athleteId, categoryId },
      }),
    removeEntry: (id: string, entryId: string) =>
      request<void>(`/api/applications/${id}/entries/${entryId}`, { method: "DELETE" }),
    payKaspi: (id: string) =>
      request<Application>(`/api/applications/${id}/payment/kaspi`, { method: "POST" }),
    submit: (id: string) =>
      request<Application>(`/api/applications/${id}/submit`, { method: "POST" }),
    markPaid: (id: string, providerReference?: string) =>
      request<Application>(`/api/applications/${id}/payment/paid`, {
        method: "POST",
        json: { providerReference },
      }),
    withdraw: (id: string) =>
      request<Application>(`/api/applications/${id}/withdraw`, { method: "POST" }),
    history: (id: string) => request<AuditLog[]>(`/api/applications/${id}/history`),
    approve: (id: string, notes?: string) =>
      request<Application>(`/api/applications/${id}/approve`, {
        method: "POST",
        json: { reviewerNotes: notes },
      }),
    reject: (id: string, notes?: string) =>
      request<Application>(`/api/applications/${id}/reject`, {
        method: "POST",
        json: { reviewerNotes: notes },
      }),
    // Admin-only: bypass DRAFT check (for weigh-in adjustments)
    adminRemoveEntry: (appId: string, entryId: string) =>
      request<void>(`/api/admin/applications/${appId}/entries/${entryId}`, { method: "DELETE" }),
    adminMoveEntry: (appId: string, entryId: string, newCategoryId: string) =>
      request<ApplicationEntry>(`/api/admin/applications/${appId}/entries/${entryId}/category`, {
        method: "PATCH",
        json: { newCategoryId },
      }),
  },

  // --- BRACKETS ---
  brackets: {
    generate: (tournamentId: string, categoryId: string) =>
      request<Bracket>(`/api/tournaments/${tournamentId}/categories/${categoryId}/bracket`, {
        method: "POST",
      }),
    getByCategory: (tournamentId: string, categoryId: string) =>
      request<Bracket>(`/api/tournaments/${tournamentId}/categories/${categoryId}/bracket`),
    forTournament: (tournamentId: string) =>
      request<Bracket[]>(`/api/tournaments/${tournamentId}/brackets`),
    prepareTournament: (tournamentId: string) =>
      request<{ ok: boolean }>(`/api/tournaments/${tournamentId}/brackets/prepare`, {
        method: "POST",
      }),
    get: (id: string) => request<Bracket>(`/api/brackets/${id}`),
    delete: (id: string) => request<void>(`/api/brackets/${id}`, { method: "DELETE" }),
  },

  // --- MATCHES ---
  matches: {
    list: (params?: {
      tournamentId?: string;
      bracketId?: string;
      athleteId?: string;
      status?: string;
      tatamiNumber?: number;
      limit?: number;
      offset?: number;
    }) => {
      const q = qs(params);
      return request<Match[]>(`/api/matches${q}`);
    },
    get: (id: string) => request<Match>(`/api/matches/${id}`),
    start: (id: string, judgeToken?: string, tatamiToken?: string) =>
      request<Match>(`/api/matches/${id}/start`, { method: "POST", judgeToken, tatamiToken }),
    pause: (id: string, judgeToken?: string, tatamiToken?: string) =>
      request<Match>(`/api/matches/${id}/pause`, { method: "POST", judgeToken, tatamiToken }),
    score: (
      id: string,
      type: string,
      side: "RED" | "BLUE",
      judgeToken?: string,
      tatamiToken?: string,
      version?: number,
    ) =>
      request<Match>(`/api/matches/${id}/score`, {
        method: "POST",
        json: { type, side, version },
        judgeToken,
        tatamiToken,
      }),
    osaekomi: (
      id: string,
      side: "RED" | "BLUE",
      judgeToken?: string,
      tatamiToken?: string,
      version?: number,
    ) =>
      request<Match>(`/api/matches/${id}/osaekomi`, {
        method: "POST",
        json: { side, version },
        judgeToken,
        tatamiToken,
      }),
    toketa: (id: string, judgeToken?: string, tatamiToken?: string, version?: number) =>
      request<Match>(`/api/matches/${id}/toketa`, {
        method: "POST",
        json: { reason: "TOKETA", version },
        judgeToken,
        tatamiToken,
      }),
    finish: (
      id: string,
      winnerSide: "RED" | "BLUE",
      reason?: string,
      judgeToken?: string,
      tatamiToken?: string,
      version?: number,
    ) =>
      request<Match>(`/api/matches/${id}/finish`, {
        method: "POST",
        json: { winnerSide, reason, version },
        judgeToken,
        tatamiToken,
      }),
    confirm: (id: string, judgeToken?: string, tatamiToken?: string) =>
      request<Match>(`/api/matches/${id}/confirm`, { method: "POST", judgeToken, tatamiToken }),
    cancelResult: (id: string, judgeToken?: string, tatamiToken?: string) =>
      request<Match>(`/api/matches/${id}/cancel-result`, {
        method: "POST",
        judgeToken,
        tatamiToken,
      }),
    undoLast: (id: string, judgeToken?: string, tatamiToken?: string) =>
      request<Match>(`/api/matches/${id}/undo`, { method: "POST", judgeToken, tatamiToken }),
    assignTatami: (id: string, tatamiNumber: number | null) =>
      request<Match>(`/api/matches/${id}/tatami`, { method: "PATCH", json: { tatamiNumber } }),
    reorderQueue: (id: string, direction: "up" | "down") =>
      request<Match>(`/api/matches/${id}/queue`, { method: "PATCH", json: { direction } }),
    tatamiQueue: (tournamentId: string, tatamiNumber: number) =>
      request<Match[]>(`/api/tatami/${tournamentId}/${tatamiNumber}/queue`),
    createJudgeSession: (id: string, judgeName?: string) =>
      request<{ token: string; judgeName?: string | null; expiresAt: string }>(
        `/api/matches/${id}/judge-session`,
        { method: "POST", json: { judgeName } },
      ),
    judgeByToken: (token: string) =>
      request<{ match: Match; judgeName?: string | null; expiresAt?: string }>(
        `/api/judge/${token}`,
      ),
    forfeit: (
      id: string,
      forfeitSide: "RED" | "BLUE",
      reason: "NO_SHOW" | "INJURY" | "DISQUALIFIED" | "WITHDREW" = "NO_SHOW",
      judgeToken?: string,
      tatamiToken?: string,
    ) =>
      request<unknown>(`/api/matches/${id}/forfeit`, {
        method: "POST",
        json: { forfeitSide, reason },
        judgeToken,
        tatamiToken,
      }),
    moveToPosition: (id: string, newIndex: number) =>
      request<void>(`/api/matches/${id}/queue-position`, {
        method: "PATCH",
        json: { newIndex },
      }),
    reset: (id: string) => request<Match>(`/api/matches/${id}/reset`, { method: "POST" }),
    goldenScore: (id: string, judgeToken?: string, tatamiToken?: string) =>
      request<Match>(`/api/matches/${id}/golden-score`, {
        method: "POST",
        judgeToken,
        tatamiToken,
      }),
  },

  // --- TATAMI SESSIONS ---
  tatamiSession: {
    /** Продлить сессию на +2 часа (heartbeat, вызывать каждые 30 мин) */
    heartbeat: (token: string) =>
      request<{ expiresAt: string }>(`/api/tatami-session/${token}/heartbeat`, {
        method: "POST",
        tatamiToken: token,
      }),
    create: (tournamentId: string, tatamiNumber: number, judgeName?: string) =>
      request<TatamiSession>(`/api/tournaments/${tournamentId}/tatami-sessions`, {
        method: "POST",
        json: { tatamiNumber, judgeName },
      }),
    get: (token: string) =>
      request<TatamiSession>(`/api/tatami-session/${token}`, { skipRefresh: true }),
    list: (tournamentId: string) =>
      request<TatamiSession[]>(`/api/tournaments/${tournamentId}/tatami-sessions`),
    revoke: (sessionId: string) =>
      request<void>(`/api/tatami-sessions/${sessionId}/revoke`, { method: "POST" }),
  },

  // --- ADMIN ---
  admin: {
    override: (matchId: string, winnerSide: "RED" | "BLUE", reason: string) =>
      request<Match>(`/api/admin/matches/${matchId}/override`, {
        method: "POST",
        json: { winnerSide, reason },
      }),
    finalize: (tournamentId: string) =>
      request<Tournament>(`/api/admin/tournaments/${tournamentId}/finalize`, { method: "POST" }),
    auditLogs: (params?: {
      entity?: string;
      targetEntity?: string;
      targetId?: string;
      action?: string;
      userId?: string;
      limit?: number;
      offset?: number;
    }) => {
      const q = qs(params);
      return request<Paginated<AuditLog>>(`/api/admin/audit-logs${q}`);
    },
    bracketPdfUrl: (bracketId: string) => `${API_BASE}/api/pdf/bracket?bracketId=${bracketId}`,
    allBracketsPdfUrl: (tournamentId: string) =>
      `${API_BASE}/api/pdf/tournament-brackets?tournamentId=${tournamentId}`,
    protocolPdfUrl: (tournamentId: string) =>
      `${API_BASE}/api/pdf/protocol?tournamentId=${tournamentId}`,
    excelExportUrl: (tournamentId: string) =>
      `${API_BASE}/api/pdf/export/excel?tournamentId=${tournamentId}`,
    certificateUrl: (athleteId: string, tournamentId: string) =>
      `${API_BASE}/api/pdf/certificate?athleteId=${athleteId}&tournamentId=${tournamentId}`,
    triggerBackup: () =>
      request<{ ok: boolean; filename: string; sizeBytes: number; durationMs: number }>(
        "/api/admin/backup",
        { method: "POST" },
      ),

    // Клубы — полный CRUD
    getClub: (id: string) => request<Club>(`/api/admin/clubs/${id}`),
    createClub: (data: {
      name: { ru: string; kk?: string; en?: string };
      city: string;
      country?: string;
      shortName?: string;
    }) => request<Club>("/api/admin/clubs", { method: "POST", json: data }),
    updateClub: (id: string, data: UpdateClubInput) =>
      request<Club>(`/api/admin/clubs/${id}/details`, { method: "PATCH", json: data }),
    deleteClub: (id: string) =>
      request<{ ok: boolean }>(`/api/admin/clubs/${id}`, { method: "DELETE" }),
    blockClub: (id: string, blocked: boolean, reason?: string) =>
      request<Club>(`/api/admin/clubs/${id}/block`, { method: "PATCH", json: { blocked, reason } }),

    // Группы клуба — полный CRUD
    createGroup: (clubId: string, data: { name: string; ageMin: number; ageMax: number }) =>
      request<ClubGroup>(`/api/admin/clubs/${clubId}/groups`, { method: "POST", json: data }),
    updateGroup: (groupId: string, data: { name?: string; ageMin?: number; ageMax?: number }) =>
      request<ClubGroup>(`/api/admin/club-groups/${groupId}`, { method: "PATCH", json: data }),
    deleteGroup: (groupId: string) =>
      request<{ ok: boolean }>(`/api/admin/club-groups/${groupId}`, { method: "DELETE" }),

    // Пользователи — полный CRUD
    listUsers: (params?: AdminListUsersParams) => {
      const q = qs(params as Record<string, string | number | boolean | null | undefined>);
      return request<Paginated<User>>(`/api/admin/users${q}`);
    },
    getUser: (id: string) => request<User>(`/api/admin/users/${id}`),
    createUser: (data: CreateUserInput) =>
      request<User>("/api/admin/users", { method: "POST", json: data }),
    updateUser: (id: string, data: UpdateUserInput) =>
      request<User>(`/api/admin/users/${id}/profile`, { method: "PATCH", json: data }),
    changeUserClub: (id: string, clubId: string | null) =>
      request<User>(`/api/admin/users/${id}/club`, { method: "PATCH", json: { clubId } }),
    resetUserPassword: (id: string, password: string) =>
      request<{ ok: boolean }>(`/api/admin/users/${id}/reset-password`, {
        method: "POST",
        json: { password },
      }),
    toggleUserActive: (id: string, active: boolean) =>
      request<User>(`/api/admin/users/${id}/active`, { method: "PATCH", json: { active } }),
    deleteUser: (id: string) => request<void>(`/api/admin/users/${id}`, { method: "DELETE" }),
    // Турниры — featured/archive
    featureTournament: (id: string, featured: boolean) =>
      request<Tournament>(`/api/admin/tournaments/${id}/feature`, {
        method: "PATCH",
        json: { featured },
      }),
    archiveTournament: (id: string, archive: boolean) =>
      request<Tournament>(`/api/admin/tournaments/${id}/archive`, {
        method: "PATCH",
        json: { archive },
      }),

    // SystemConfig
    getConfig: (key: string) =>
      request<{ key: string; value: unknown }>(`/api/admin/system-config/${key}`),
    updateConfig: (key: string, value: unknown) =>
      request<{ key: string; value: unknown }>(`/api/admin/system-config/${key}`, {
        method: "PATCH",
        json: { value },
      }),

    // Все заявки (один запрос вместо N+1)
    allApplications: (params?: { status?: string; tournamentId?: string }) => {
      const q = qs(params);
      return request<Application[]>(`/api/admin/applications${q}`);
    },

    // Stats
    stats: () => request<AdminStats>("/api/admin/stats"),
    analytics: () => request<FederationAnalytics>("/api/admin/analytics"),
    weighIn: (tournamentId: string) =>
      request<{ applications: Application[] }>(`/api/admin/tournaments/${tournamentId}/weigh-in`),
    updateWeighIn: (entryId: string, data: { status: string; notes?: string | null }) =>
      request<ApplicationEntry>(`/api/admin/application-entries/${entryId}/weigh-in`, {
        method: "PATCH",
        json: data,
      }),
  },

  // --- PAYMENTS ---
  payments: {
    init: (applicationId: string) =>
      request<PaymentInitResult>("/api/payments/init", { method: "POST", json: { applicationId } }),
    adminConfirm: (appId: string, reference?: string) =>
      request<{ ok: boolean }>(`/api/payments/${appId}/confirm`, {
        method: "POST",
        json: { reference },
      }),
  },

  // --- NOTIFICATIONS ---
  notifications: {
    list: (params?: { type?: string; unreadOnly?: boolean; limit?: number }) =>
      request<Notification[]>(`/api/notifications${qs(params as any)}`),
    unreadCount: () => request<{ count: number }>("/api/notifications/unread-count"),
    markAllRead: () => request<void>("/api/notifications/mark-read", { method: "POST" }),
    markRead: (id: string) =>
      request<Notification>(`/api/notifications/${id}/read`, { method: "POST" }),
    broadcast: (data: BroadcastNotificationInput) =>
      request<NotificationBroadcast>("/api/notifications/broadcast", {
        method: "POST",
        json: data,
      }),
    broadcastHistory: () => request<NotificationBroadcast[]>("/api/notifications/broadcasts"),
    updateBroadcast: (id: string, data: { title: string; body: string }) =>
      request<{ id: string; updated: number; title: string; body: string }>(
        `/api/notifications/broadcasts/${id}`,
        { method: "PATCH", json: data },
      ),
    deleteBroadcast: (id: string) =>
      request<{ id: string; deleted: number }>(`/api/notifications/broadcasts/${id}`, {
        method: "DELETE",
      }),
  },

  // --- WEB PUSH ---
  push: {
    vapidPublicKey: () => request<{ publicKey: string }>("/push/vapid-public-key"),
    subscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
      request<{ ok: boolean }>("/push/subscribe", { method: "POST", json: sub }),
    unsubscribe: (body: { endpoint: string }) =>
      request<void>("/push/subscribe", { method: "DELETE", json: body }),
  },

  // --- RATINGS ---
  ratings: {
    athlete: (id: string) =>
      request<{ athleteId: string; totalPoints: number; entries: RatingEntry[] }>(
        `/api/ratings/athletes/${id}`,
      ),
    athleteStats: (id: string) =>
      request<{
        athleteId: string;
        matches: {
          total: number;
          wins: number;
          losses: number;
          winRate: number;
          goldenScoreWins: number;
          ipponWins: number;
          wazaariWins: number;
          hansokuWins: number;
          ipponWinRate: number;
        };
        tournaments: { total: number; bestPlace: number | null };
        rating: {
          totalPoints: number;
          entriesCount: number;
          history: Array<{ date: string; points: number; tournamentName: string }>;
          recent: RatingEntry[];
        };
      }>(`/api/ratings/athletes/${id}/stats`),
    leaderboard: (params?: { categoryId?: string; clubId?: string; limit?: number }) => {
      const q = qs(params);
      return request<AthleteLeaderboardEntry[]>(`/api/ratings/leaderboard${q}`);
    },
    clubLeaderboard: (params?: { limit?: number }) => {
      const q = qs(params);
      return request<ClubLeaderboardEntry[]>(`/api/ratings/clubs${q}`);
    },
    weightClasses: () =>
      request<Array<{ gender: string; weightMax: number; weightMin: number; label: string }>>(
        "/api/ratings/weight-classes",
      ),
    weightClassLeaderboard: (params: {
      gender: "MALE" | "FEMALE";
      weightMax: number;
      limit?: number;
    }) => {
      const q = qs(params);
      return request<WeightClassLeaderboardEntry[]>(`/api/ratings/weight-class${q}`);
    },
  },
};

export const apiBaseUrl = API_BASE;
