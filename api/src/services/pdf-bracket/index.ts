/**
 * pdf-bracket — подмодуль: типы, утилиты, шрифты.
 *
 * НЕ содержит функции рисования PDFKit — они в ../pdf-bracket.service.ts.
 * Это намеренно: функции рисования зависят от PDFDocument и не могут быть
 * перемещены без разбивки на draw-se.ts / draw-rr.ts (будущий шаг).
 *
 * Использование:
 *   import { localize, PdfError, registerFonts } from "./pdf-bracket/index.js";
 */

export {
  PdfError,
  localize,
  dateRange,
  placeEmoji,
  pdfAthleteFullDisplayName,
} from "./types.js";

export type {
  PdfLocalized,
  PdfClub,
  PdfAthlete,
  PdfSideScore,
  PdfScoreSnapshot,
  PdfMatch,
  PdfCategory,
  PdfBracket,
  PdfTournament,
} from "./types.js";

export { registerFonts } from "./fonts.js";
export type { RegisteredFonts } from "./fonts.js";
