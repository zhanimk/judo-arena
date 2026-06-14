/**
 * PDF-bracket — типы данных и ошибки.
 * Интерфейсы описывают структуры данных из Prisma include-запросов.
 */

import type { Locale } from "@prisma/client";

// ── Ошибки ────────────────────────────────────────────────────────────────────

export class PdfError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "PdfError";
  }
}

// ── Типы ─────────────────────────────────────────────────────────────────────

/**
 * Мультиязычная строка — { kk: "...", ru: "...", en: "..." } или просто string.
 * Принимает Prisma JsonValue — локализатор обрабатывает fallback.
 */
export type PdfLocalized = unknown;

export interface PdfClub {
  id: string;
  name: PdfLocalized;
  shortName?: string | null;
  city?: string | null;
}

export interface PdfAthlete {
  id: string;
  name: string;
  surname: string;
  nameLatin?: string | null;
  surnameLatin?: string | null;
  clubId?: string | null;
  club?: PdfClub | null;
  weightKg?: number | null;
  gender?: string | null;
}

export interface PdfSideScore {
  ippon?: number;
  wazaari?: number;
  yuko?: number;
  shido?: number;
  hansokuMake?: boolean;
  [key: string]: unknown;
}

export interface PdfScoreSnapshot {
  red?: PdfSideScore | null;
  blue?: PdfSideScore | null;
  white?: PdfSideScore | null;
  pendingResult?: {
    winner: "WHITE" | "BLUE" | "RED";
    method: string;
    proposedAt?: string;
  } | null;
  [key: string]: unknown;
}

export interface PdfMatch {
  id: string;
  /** Round number (1-based). Prisma field: `round` */
  round: number;
  /** Position within round. Prisma field: `position` */
  position?: number | null;
  bracketSection?: string | null;
  status: string;
  redAthleteId?: string | null;
  blueAthleteId?: string | null;
  winnerId?: string | null;
  redAthlete?: PdfAthlete | null;
  blueAthlete?: PdfAthlete | null;
  scoreSnapshot?: PdfScoreSnapshot | null;
  scheduledAt?: Date | string | null;
  finishedAt?: Date | string | null;
}

export interface PdfCategory {
  id: string;
  name: PdfLocalized;
  gender: string;
  ageMin: number;
  ageMax: number;
  weightMin?: number | null;
  weightMax?: number | null;
}

export interface PdfBracket {
  id: string;
  format: string;
  /** Bracket size: 4/8/16/32/64 for SE; N for round-robin */
  size?: number | null;
  matches: PdfMatch[];
  /** Always present when loaded via PDF queries */
  category: PdfCategory;
  /** Present when bracket is loaded with tournament relation */
  tournament: PdfTournament;
}

export interface PdfTournament {
  id: string;
  name: PdfLocalized;
  city?: string | null;
  location?: string | null;
  startDate: Date;
  endDate: Date;
  primaryLocale?: string | null;
  posterUrl?: string | null;
  categories?: PdfCategory[];
}

// ── Локализация ───────────────────────────────────────────────────────────────

export function localize(value: unknown, locale: Locale): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return String(obj[locale] || obj["kk"] || obj["ru"] || obj["en"] || "");
  }
  return String(value);
}

export function dateRange(start: Date, end: Date, locale: Locale): string {
  const lng = locale === "en" ? "en-US" : locale === "kk" ? "kk-KZ" : "ru-RU";
  const opt: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  const s = start.toLocaleDateString(lng, opt);
  const e = end.toLocaleDateString(lng, opt);
  return s === e ? s : `${s} — ${e}`;
}

export function placeEmoji(place: number): string {
  if (place === 1) return "1.";
  if (place === 2) return "2.";
  if (place === 3) return "3.";
  return `${place}.`;
}

export function pdfAthleteFullDisplayName(athlete: PdfAthlete | null | undefined): string {
  if (!athlete) return "";
  const latinName =
    athlete.surnameLatin && athlete.nameLatin
      ? `${athlete.surnameLatin} ${athlete.nameLatin}`
      : null;
  const cyrillicName = `${athlete.surname} ${athlete.name}`;
  return latinName ? `${cyrillicName} / ${latinName}` : cyrillicName;
}
