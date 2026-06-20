/**
 * Shared API response types — mirrors the Prisma schema and route response shapes.
 * Use these as generic parameters for request<T>() calls in api.ts.
 */

// ── Primitives ────────────────────────────────────────────────────────────────

export type LocalizedName = { ru?: string; kk?: string; en?: string } | string | null | undefined;
export type Locale = "ru" | "kk" | "en";
export type Gender = "MALE" | "FEMALE";
export type UserRole = "ATHLETE" | "COACH" | "ADMIN" | "JUDGE";
export type ClubRole = "OWNER" | "COACH";
export type TournamentStatus =
  | "DRAFT"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
export type BracketFormat = "SE_IJF" | "ROUND_ROBIN" | "MIXED";
export type ApplicationStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "WITHDRAWN";
export type PaymentStatus = "NOT_REQUIRED" | "PENDING" | "PAID" | "FAILED";
export type WeighInStatus =
  | "PENDING"
  | "PASSED"
  | "FAILED_WEIGHT"
  | "FAILED_DOCUMENTS"
  | "ABSENT"
  | "WITHDRAWN";
export type MatchStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

// ── User / Auth ───────────────────────────────────────────────────────────────

export interface UserDocument {
  id: string;
  type: "BIRTH_CERTIFICATE" | "STUDY_CERTIFICATE" | "COACH_ID";
  url: string;
  originalName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  surname: string;
  nameLatin?: string | null;
  surnameLatin?: string | null;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  weightKg?: number | null;
  beltRank?: string | null;
  preferredLocale: Locale;
  avatarUrl?: string | null;
  phone?: string | null;
  isActive: boolean;
  emailVerified: boolean;
  totpEnabled?: boolean;
  clubId?: string | null;
  clubRole?: ClubRole | null;
  club?: Club | null;
  documents?: UserDocument[];
  /** Admin-extended fields */
  ratingEntries?: RatingEntry[];
  totalPoints?: number;
  _count?: {
    redmatches?: number;
    bluematches?: number;
    wonMatches?: number;
    [key: string]: number | undefined;
  };
  createdAt: string;
  updatedAt?: string;
}

// ── Club ──────────────────────────────────────────────────────────────────────

export interface ClubGroup {
  id: string;
  name: string;
  ageMin: number;
  ageMax: number;
}

export interface Club {
  id: string;
  name: LocalizedName;
  shortName?: string | null;
  city: string;
  country: string;
  logoUrl?: string | null;
  description?: LocalizedName;
  isActive: boolean;
  isBlocked: boolean;
  blockedReason?: string | null;
  groups?: ClubGroup[];
  /** Admin-extended fields (only present in admin detail endpoint) */
  members?: User[];
  applications?: Application[];
  createdBy?: { id: string; name: string; surname: string; email: string } | null;
  _count?: {
    members?: number;
    applications?: number;
    groups?: number;
    [key: string]: number | undefined;
  };
  createdAt: string;
  updatedAt: string;
}

// ── Tournament / Category ─────────────────────────────────────────────────────

export interface Category {
  id: string;
  tournamentId: string;
  name?: LocalizedName;
  gender: Gender;
  ageMin: number;
  ageMax: number;
  weightMin: number;
  weightMax: number;
  matchDate?: string | null;
  matchDurationSec: number;
  goldenScoreSec: number;
  format: BracketFormat;
  allowYuko: boolean;
  createdAt: string;
}

export interface Tournament {
  id: string;
  name: LocalizedName;
  description?: LocalizedName;
  location: string;
  city: string;
  startDate: string;
  endDate: string;
  applicationDeadline?: string | null;
  mapUrl?: string | null;
  weighInLocation?: string | null;
  weighInStart?: string | null;
  weighInEnd?: string | null;
  status: TournamentStatus;
  tatamiCount: number;
  primaryLocale: Locale;
  posterUrl?: string | null;
  galleryUrls?: string[] | null;
  regulationUrl?: string | null;
  regulationFileName?: string | null;
  entryFeeKzt: number;
  kaspiPaymentUrl?: string | null;
  youtubeUrls?: string[] | null;
  isFeatured: boolean;
  isArchived: boolean;
  categories?: Category[];
  _count?: {
    applications?: number;
    matches?: number;
    categories?: number;
    participants?: number;
    entries?: number;
    applicationEntries?: number;
  };
  participantsCount?: number;
  entriesCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ── Application ───────────────────────────────────────────────────────────────

export interface ApplicationEntry {
  id: string;
  applicationId: string;
  athleteId: string;
  categoryId: string;
  weighInStatus: WeighInStatus;
  athlete?: User;
  category?: Category;
  application?: Application;
}

export interface Application {
  id: string;
  tournamentId: string;
  clubId: string;
  status: ApplicationStatus;
  notes?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewerNotes?: string | null;
  paymentStatus: PaymentStatus;
  paymentAmountKzt: number;
  paymentProvider?: string | null;
  paymentReference?: string | null;
  paymentUrl?: string | null;
  paidAt?: string | null;
  tournament?: Tournament;
  club?: Club;
  entries?: ApplicationEntry[];
  tournamentName?: string;
  _count?: { entries?: number };
  createdAt: string;
  updatedAt: string;
}

// ── Bracket / Match ───────────────────────────────────────────────────────────

export interface MatchSideScore {
  ippon: number;
  wazaari: number;
  yuko: number;
  shido: number;
  hansoku: boolean;
}

export interface MatchPendingResult {
  winnerSide: "RED" | "BLUE";
  winnerId: string;
  reason: string;
  proposedAt?: string;
  triggeredBy?: string;
  createdAt?: string;
}

export interface MatchScoreSnapshot {
  red: MatchSideScore;
  blue: MatchSideScore;
  bye?: boolean;
  isGoldenScore?: boolean;
  pendingResult?: MatchPendingResult | null;
  clock?: {
    running: boolean;
    elapsedSec: number;
    runningStartedAt?: string | null;
  };
  osaekomi?: { side: "RED" | "BLUE"; startedAt: string } | null;
}

export interface Match {
  id: string;
  status: MatchStatus;
  round: number;
  position: number;
  tatamiNumber?: number | null;
  queuePosition?: number | null;
  bracketSection?: string | null;
  bracketId: string;
  tournamentId: string;
  redAthleteId?: string | null;
  blueAthleteId?: string | null;
  winnerId?: string | null;
  winMethod?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  isGoldenScore: boolean;
  version: number;
  scoreSnapshot?: MatchScoreSnapshot | null;
  osaekomi?: { side: "RED" | "BLUE"; startedAt: string } | null;
  redAthlete?: User | null;
  blueAthlete?: User | null;
  winner?: User | null;
  bracket?: Bracket | null;
  tournament?: Tournament | null;
  events?: Array<{
    id: string;
    type: string;
    side?: string | null;
    time?: number | null;
    occurredAt?: string;
    createdAt?: string;
  }> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Bracket {
  id: string;
  tournamentId: string;
  categoryId: string;
  format: BracketFormat;
  size?: number | null;
  category?: Category;
  matches?: Match[];
  createdAt: string;
  updatedAt: string;
}

// ── Rating ────────────────────────────────────────────────────────────────────

export interface RatingEntry {
  id: string;
  athleteId: string;
  tournamentId: string;
  categoryId: string;
  place: number;
  points: number;
  rank?: number;
  totalPoints?: number;
  wins?: number;
  losses?: number;
  ipponWins?: number;
  wazaariWins?: number;
  yukoWins?: number;
  goldenScoreWins?: number;
  athlete?: User;
  tournament?: Tournament;
  category?: Category;
  awardedAt?: string;
}

// ── Notification ──────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: string;
  titleKey: string;
  bodyKey: string;
  payload?: Record<string, unknown> | null;
  read: boolean;
  locale?: Locale;
  createdAt: string;
}

export interface NotificationBroadcast {
  id: string;
  title: string;
  body: string;
  type: string;
  target:
    | { kind: "all" }
    | { kind: "user"; userId: string }
    | { kind: "role"; role: "ATHLETE" | "COACH" | "ADMIN" }
    | { kind: "tournament"; tournamentId: string }
    | { kind: "club"; clubId: string };
  count: number;
  createdAt: string;
  actor?: { id: string; name: string; surname: string } | null;
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  totalClubs: number;
  totalTournaments: number;
  activeTournaments: number;
  totalMatches: number;
  pendingApplications: number;
  /** Extended fields returned by admin/reports endpoint */
  clubsCount?: number;
  ratingEntriesCount?: number;
  tournaments?: Array<{ status: string; _count: { id: number } }>;
  users?: Array<{ role: string; _count: { id: number } }>;
  matches?: Array<{ status: string; _count: { id: number } }>;
}

export interface FederationAnalytics {
  period: { from: string; to: string };
  athletes: {
    byMonth: Array<{ year: number; month: number; count: number }>;
    byCity: Array<{ city: string; count: number }>;
    byGender: Array<{ gender: string; count: number }>;
    avgAgeByGender: Array<{ gender: string; avgAge: number; count: number }>;
    topClubs: Array<{ clubId: string; name: LocalizedName; city: string; count: number }>;
  };
  tournaments: {
    byMonth: Array<{ year: number; month: number; count: number; status: string }>;
    completedThisYear: Array<{
      id: string;
      name: LocalizedName;
      city: string;
      startDate: string;
      categoriesCount: number;
    }>;
  };
  matches: {
    byMonth: Array<{ year: number; month: number; count: number }>;
  };
  categories: {
    popularWeightClasses: Array<{ gender: string; weightMax: number; count: number }>;
  };
  ratings: {
    topAthletesThisYear: Array<{
      athleteId: string;
      name: string;
      surname: string;
      total: number;
      clubCity: string | null;
    }>;
  };
  generatedAt: string;
}

export interface PaymentInitResult {
  paymentUrl: string;
  paymentId?: string;
  isMock: boolean;
}

export interface AuditLog {
  id: string;
  actorUserId?: string | null;
  action: string;
  targetEntity: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  actor?: Pick<User, "id" | "name" | "surname" | "role"> | null;
  createdAt: string;
}

export interface TatamiSession {
  id: string;
  tournamentId: string;
  tatamiNumber: number;
  token: string;
  judgeName?: string | null;
  expiresAt: string;
  isRevoked: boolean;
  createdAt: string;
  /** Present in get-session response (enriched endpoint) */
  session?: TatamiSession;
  tournament?: Tournament | null;
  currentMatch?: Match | null;
  queue?: Match[];
  stats?: { total: number; completed: number; pending: number };
}

// ── Paginated responses ───────────────────────────────────────────────────────

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ── Input types (мутации) ─────────────────────────────────────────────────────
// Используются в api.ts вместо `any` для type-safe вызовов

export interface UpdateProfileInput {
  name?: string;
  surname?: string;
  nameLatin?: string | null;
  surnameLatin?: string | null;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  weightKg?: number | null;
  beltRank?: string | null;
  phone?: string | null;
  preferredLocale?: Locale;
  avatarUrl?: string | null;
  currentPassword?: string;
  newPassword?: string;
}

export interface CreateClubInput {
  name: LocalizedName;
  shortName?: string | null;
  city: string;
  country?: string;
  description?: LocalizedName;
  logoUrl?: string | null;
}

export type UpdateClubInput = Partial<CreateClubInput>;

export interface CreateGroupInput {
  name: string;
  ageMin: number;
  ageMax: number;
}

export type UpdateGroupInput = Partial<CreateGroupInput>;

export interface CreateTournamentInput {
  name: LocalizedName;
  description?: LocalizedName | null;
  location: string;
  city: string;
  startDate: string;
  endDate: string;
  applicationDeadline?: string | null;
  mapUrl?: string | null;
  weighInLocation?: string | null;
  weighInStart?: string | null;
  weighInEnd?: string | null;
  tatamiCount?: number;
  primaryLocale?: Locale;
  entryFeeKzt?: number;
  kaspiPaymentUrl?: string | null;
  posterUrl?: string | null;
  galleryUrls?: string[] | null;
  regulationUrl?: string | null;
  regulationFileName?: string | null;
  youtubeUrls?: string[] | null;
  isFeatured?: boolean;
}

export type UpdateTournamentInput = Partial<CreateTournamentInput>;

export interface CreateCategoryInput {
  gender: Gender;
  ageMin: number;
  ageMax: number;
  weightMin: number;
  weightMax: number;
  matchDurationSec?: number;
  goldenScoreSec?: number;
  format?: string;
  allowYuko?: boolean;
  name?: LocalizedName | null;
  matchDate?: string | null;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

export interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  surname: string;
  nameLatin?: string | null;
  surnameLatin?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  weightKg?: number | null;
  beltRank?: string | null;
  phone?: string | null;
  preferredLocale?: Locale;
  clubId?: string | null;
  clubRole?: ClubRole | null;
  avatarUrl?: string | null;
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, "password" | "role">>;

export interface AddAthleteInput {
  email: string;
  password: string;
  name: string;
  surname: string;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  weightKg?: number | null;
  nameLatin?: string | null;
  surnameLatin?: string | null;
  beltRank?: string | null;
  phone?: string | null;
  preferredLocale?: Locale;
}

export interface AdminListUsersParams {
  role?: UserRole;
  clubId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  isActive?: boolean;
}

interface BroadcastBase {
  title: string;
  body: string;
  type: string;
}

export type BroadcastNotificationInput =
  | (BroadcastBase & { kind: "all" })
  | (BroadcastBase & { kind: "user"; userId: string })
  | (BroadcastBase & { kind: "role"; role: "ATHLETE" | "COACH" | "ADMIN" })
  | (BroadcastBase & { kind: "tournament"; tournamentId: string })
  | (BroadcastBase & { kind: "club"; clubId: string });

export interface ClubJoinRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  clubId?: string;
  athleteId?: string;
  coachId?: string;
  club?: Pick<Club, "id" | "name" | "shortName" | "city" | "logoUrl"> | null;
  athlete?: Pick<User, "id" | "name" | "surname" | "email" | "gender" | "weightKg" | "dateOfBirth">;
  coach?: Pick<
    User,
    "id" | "name" | "surname" | "email" | "phone" | "avatarUrl" | "clubId" | "clubRole"
  >;
  createdAt?: string;
}

export interface AthleteLeaderboardEntry {
  rank: number;
  totalPoints: number;
  wins?: number;
  losses?: number;
  ipponWins?: number;
  place?: number;
  athlete: {
    id: string;
    name: string;
    surname: string;
    gender?: Gender | null;
    weightKg?: number | null;
    beltRank?: string | null;
    clubId?: string | null;
    avatarUrl?: string | null;
    club?: {
      id: string;
      name: LocalizedName;
      shortName?: string | null;
      city?: string | null;
    } | null;
  };
}

export interface ClubLeaderboardEntry {
  rank: number;
  totalPoints: number;
  athleteCount: number;
  club: {
    id: string;
    name: LocalizedName;
    shortName?: string | null;
    city: string;
    _count?: { members?: number };
  };
}

export interface WeightClassLeaderboardEntry {
  rank: number;
  totalPoints: number;
  tournamentsCount: number;
  bestPlace: number | null;
  athlete: {
    id: string;
    name: string;
    surname: string;
    nameLatin: string | null;
    surnameLatin: string | null;
    gender: Gender | null;
    weightKg: number | null;
    beltRank: string | null;
    club: {
      id: string;
      name: LocalizedName;
      shortName: string | null;
      city: string | null;
    } | null;
  };
}
