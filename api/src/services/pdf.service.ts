/**
 * Сервис генерации PDF.
 *
 * Документы:
 *   1. generateBracketPdf(bracketId)         — PDF одной сетки
 *   2. generateAllBracketsPdf(tournamentId)  — PDF всех сеток турнира (одним файлом)
 *   3. generateTournamentProtocolPdf(id)     — итоговый протокол (COMPLETED)
 *
 * Шрифт: Arial Unicode (поддерживает кириллицу, казахские символы).
 * Путь: src/assets/fonts/ArialUnicode.ttf (relative to process.cwd() = api/)
 */

import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { prisma } from "../lib/prisma.js";
import { BracketFormat, type Locale } from "@prisma/client";

export class PdfError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
    this.name = "PdfError";
  }
}

// ── Шрифт ────────────────────────────────────────────────────────────────────
const FONT_PATH = path.resolve(process.cwd(), "src/assets/fonts/ArialUnicode.ttf");
const FONT_BOLD_PATH = path.resolve(process.cwd(), "src/assets/fonts/ArialUnicodeBold.ttf");

/** Регистрирует шрифт в документе и возвращает имя для использования */
function registerFonts(doc: PDFKit.PDFDocument): { regular: string; bold: string } {
  const hasFont = fs.existsSync(FONT_PATH);
  if (hasFont) {
    doc.registerFont("Unicode", FONT_PATH);
    // Bold fallback — если нет отдельного bold-файла, используем тот же
    const hasBold = fs.existsSync(FONT_BOLD_PATH);
    doc.registerFont("UnicodeBold", hasBold ? FONT_BOLD_PATH : FONT_PATH);
    return { regular: "Unicode", bold: "UnicodeBold" };
  }
  // Fallback — Helvetica (не поддерживает кириллицу, но не падает)
  return { regular: "Helvetica", bold: "Helvetica-Bold" };
}

// ── Утилиты ──────────────────────────────────────────────────────────────────

function localize(value: any, locale: Locale): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value[locale] || value.kk || value.ru || value.en || "";
  }
  return String(value);
}

function dateRange(start: Date, end: Date, locale: Locale): string {
  const lng = locale === "en" ? "en-US" : locale === "kk" ? "kk-KZ" : "ru-RU";
  const opt: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  const s = start.toLocaleDateString(lng, opt);
  const e = end.toLocaleDateString(lng, opt);
  return s === e ? s : `${s} — ${e}`;
}

function placeEmoji(place: number): string {
  if (place === 1) return "1.";
  if (place === 2) return "2.";
  if (place === 3) return "3.";
  return `${place}.`;
}

// ============================================================
// PDF ОДНОЙ СЕТКИ
// ============================================================

export async function generateBracketPdf(bracketId: string): Promise<Buffer> {
  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    include: {
      tournament: true,
      category: true,
      matches: {
        orderBy: [{ bracketSection: "asc" }, { round: "asc" }, { position: "asc" }],
        include: {
          redAthlete: { include: { club: true } },
          blueAthlete: { include: { club: true } },
        },
      },
    },
  });
  if (!bracket) throw new PdfError("BRACKET_NOT_FOUND", "Сетка не найдена", 404);

  const locale = (bracket.tournament.primaryLocale ?? "ru") as Locale;
  const isRR = bracket.format === BracketFormat.ROUND_ROBIN;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, layout: "landscape" });
    const fonts = registerFonts(doc);
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawBracketPage(doc, fonts, bracket, locale, isRR);
    doc.end();
  });
}

// ============================================================
// PDF ВСЕХ СЕТОК ТУРНИРА (один файл, страница на категорию)
// ============================================================

export async function generateAllBracketsPdf(tournamentId: string): Promise<Buffer> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      categories: { orderBy: [{ gender: "asc" }, { weightMin: "asc" }] },
    },
  });
  if (!tournament) throw new PdfError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);

  const brackets = await prisma.bracket.findMany({
    where: { tournamentId },
    include: {
      category: true,
      matches: {
        orderBy: [{ bracketSection: "asc" }, { round: "asc" }, { position: "asc" }],
        include: {
          redAthlete: { include: { club: true } },
          blueAthlete: { include: { club: true } },
        },
      },
    },
    orderBy: [
      { category: { gender: "asc" } },
      { category: { weightMin: "asc" } },
    ],
  });

  if (brackets.length === 0) {
    throw new PdfError("NO_BRACKETS", "Сетки не сгенерированы", 404);
  }

  const locale = (tournament.primaryLocale ?? "ru") as Locale;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, layout: "landscape" });
    const fonts = registerFonts(doc);
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Титульная страница
    drawTournamentCover(doc, fonts, tournament, brackets, locale);

    // По странице на каждую сетку
    for (const bracket of brackets) {
      doc.addPage({ size: "A4", margin: 0, layout: "landscape" });
      const bracketWithTournament = { ...bracket, tournament };
      const isRR = bracket.format === BracketFormat.ROUND_ROBIN;
      drawBracketPage(doc, fonts, bracketWithTournament, locale, isRR);
    }

    doc.end();
  });
}

// ── Титульная страница ────────────────────────────────────────────────────────

function drawTournamentCover(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string },
  tournament: any,
  brackets: any[],
  locale: Locale,
) {
  const PW = doc.page.width;
  const PH = doc.page.height;
  const M = 40;

  // Фон
  doc.rect(0, 0, PW, PH).fill("#0B1426");

  // Золотая полоса сверху
  doc.rect(0, 0, PW, 6).fill("#D4AF37");
  // Золотая полоса снизу
  doc.rect(0, PH - 6, PW, 6).fill("#D4AF37");

  // Название турнира
  const tourName = localize(tournament.name, locale);
  doc.font(fonts.bold).fontSize(28).fillColor("#D4AF37")
    .text(tourName, M, 60, { width: PW - 2 * M, align: "center" });

  doc.font(fonts.regular).fontSize(14).fillColor("#FFFFFF")
    .text(`${tournament.location}, ${tournament.city}`, M, 105, { width: PW - 2 * M, align: "center" });

  doc.font(fonts.regular).fontSize(12).fillColor("#9CA3AF")
    .text(dateRange(tournament.startDate, tournament.endDate, locale), M, 125, { width: PW - 2 * M, align: "center" });

  // Разделитель
  doc.rect(M * 2, 155, PW - M * 4, 1).fill("#D4AF37");

  // Заголовок содержания
  const contentsLabel = locale === "kk" ? "САНАТТАР" : locale === "en" ? "CATEGORIES" : "КАТЕГОРИИ";
  doc.font(fonts.bold).fontSize(11).fillColor("#D4AF37")
    .text(contentsLabel, M, 170, { width: PW - 2 * M, align: "center" });

  // Список категорий
  const colW = (PW - 2 * M) / 2;
  let y = 195;
  brackets.forEach((br, i) => {
    const col = i % 2;
    const x = M + col * colW;
    if (col === 0 && i > 0) y += 22;

    const catName = localize(br.category.name, locale);
    const gender = br.category.gender === "MALE"
      ? (locale === "kk" ? "Ер" : locale === "en" ? "Men" : "Муж")
      : (locale === "kk" ? "Әйел" : locale === "en" ? "Women" : "Жен");
    const wMax = br.category.weightMax >= 200
      ? `+${br.category.weightMin} кг`
      : `-${br.category.weightMax} кг`;
    const formatLabel = br.format === BracketFormat.ROUND_ROBIN
      ? (locale === "kk" ? "Дөңгелек" : "Круговая")
      : "SE-IJF";
    const matchCount = br.matches.length;
    const label = `${catName || `${gender} ${wMax}`}   •   ${matchCount} ${locale === "kk" ? "матч" : locale === "en" ? "matches" : "матчей"}   •   ${formatLabel}`;

    doc.font(fonts.regular).fontSize(10).fillColor("#FFFFFF")
      .text(`${i + 1}.  ${label}`, x, y, { width: colW - 10, lineBreak: false });
  });

  // Подвал
  doc.font(fonts.regular).fontSize(8).fillColor("#555555")
    .text(`Judo-Arena · ${new Date().toLocaleDateString()}`, M, PH - 22, {
      width: PW - 2 * M, align: "center", lineBreak: false,
    });
}

// ── Страница одной сетки ──────────────────────────────────────────────────────

function drawBracketPage(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string },
  bracket: any,
  locale: Locale,
  isRR: boolean,
) {
  const PW = doc.page.width;
  const PH = doc.page.height;
  const M = 24;
  const BAND_H = 58;

  // ── Header band ───────────────────────────────────────────────────────────
  doc.rect(0, 0, PW, BAND_H).fill("#0B1426");
  doc.rect(0, BAND_H - 1.5, PW, 1.5).fill("#D4AF37");

  const tourName = localize(bracket.tournament.name, locale);
  const catGender =
    bracket.category.gender === "MALE"
      ? locale === "kk" ? "Ерлер" : locale === "en" ? "Men" : "Мужчины"
      : locale === "kk" ? "Әйелдер" : locale === "en" ? "Women" : "Женщины";
  const catWeight =
    bracket.category.weightMax >= 200
      ? `+${bracket.category.weightMin} кг`
      : `-${bracket.category.weightMax} кг`;
  const catLabel = localize(bracket.category.name, locale) || `${catGender} · ${catWeight}`;
  const locStr = `${bracket.tournament.location}, ${bracket.tournament.city}`;
  const dateStr = dateRange(bracket.tournament.startDate, bracket.tournament.endDate, locale);
  const formatLabel = isRR
    ? (locale === "kk" ? "Дөңгелек тор" : locale === "en" ? "Round Robin" : "Круговая")
    : "Single Elimination (IJF)";

  doc.font(fonts.bold).fontSize(13).fillColor("#D4AF37")
    .text(tourName, M, 8, { width: PW - 2 * M, align: "center", lineBreak: false });
  doc.font(fonts.bold).fontSize(11).fillColor("#FFFFFF")
    .text(catLabel, M, 25, { width: PW - 2 * M, align: "center", lineBreak: false });
  doc.font(fonts.regular).fontSize(7.5).fillColor("#9CA3AF")
    .text(`${locStr}   ·   ${dateStr}   ·   ${formatLabel}`, M, 43, { width: PW - 2 * M, align: "center", lineBreak: false });

  // ── Content ───────────────────────────────────────────────────────────────
  if (isRR) {
    pdfDrawRR(doc, fonts, bracket.matches, locale, BAND_H, PW, PH, M);
    // RR footer
    doc.font(fonts.regular).fontSize(7).fillColor("#777777")
      .text(`Judo-Arena · ${new Date().toLocaleDateString()}`, M, PH - 13, { width: PW - 2 * M, align: "right", lineBreak: false });
  } else {
    // SE: pdfDrawSE handles its own pages + footers (may add pages for pools C/D + finals)
    pdfDrawSE(doc, fonts, bracket.matches, bracket.size ?? 8, locale, BAND_H, PW, PH, M, bracket);
  }
}

// ── Pool index (same logic as OlympicBracket.tsx) ────────────────────────────
function matchPoolIdx(position: number, round: number, size: number): number {
  const matchesInRound = size / Math.pow(2, round);
  return Math.min(3, Math.floor((position * 4) / matchesInRound));
}

function poolRoundLabelPdf(stepsToQF: number, locale: Locale): string {
  const kk: Record<number, string> = { 0: "Pool Final", 1: "1/8", 2: "1/16", 3: "1/32", 4: "1/64" };
  const en: Record<number, string> = { 0: "Pool Final", 1: "QF", 2: "1/16", 3: "1/32", 4: "1/64" };
  const ru: Record<number, string> = { 0: "Pool Final", 1: "1/8", 2: "1/16", 3: "1/32", 4: "1/64" };
  const map = locale === "en" ? en : locale === "kk" ? kk : ru;
  return map[stepsToQF] ?? `R${stepsToQF}`;
}

// ── Draw the header band on current page ────────────────────────────────────
function drawPageHeader(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string },
  bracket: any,
  locale: Locale,
  BAND_H: number,
  PW: number,
  M: number,
  subtitle?: string,
) {
  doc.rect(0, 0, PW, BAND_H).fill("#0B1426");
  doc.rect(0, BAND_H - 1.5, PW, 1.5).fill("#D4AF37");

  const tourName = localize(bracket.tournament.name, locale);
  const catGender =
    bracket.category.gender === "MALE"
      ? locale === "kk" ? "Ерлер" : locale === "en" ? "Men" : "Мужчины"
      : locale === "kk" ? "Әйелдер" : locale === "en" ? "Women" : "Женщины";
  const catWeight =
    bracket.category.weightMax >= 200
      ? `+${bracket.category.weightMin} кг`
      : `-${bracket.category.weightMax} кг`;
  const catLabel = localize(bracket.category.name, locale) || `${catGender} · ${catWeight}`;
  const sub = subtitle ?? catLabel;

  doc.font(fonts.bold).fontSize(13).fillColor("#D4AF37")
    .text(tourName, M, 8, { width: PW - 2 * M, align: "center", lineBreak: false });
  doc.font(fonts.bold).fontSize(10).fillColor("#FFFFFF")
    .text(sub, M, 25, { width: PW - 2 * M, align: "center", lineBreak: false });
}

// ── Single Elimination — IJF Pool layout ─────────────────────────────────────

function pdfDrawSE(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string },
  allMatches: any[],
  bracketSize: number,
  locale: Locale,
  headerH: number,
  PW: number,
  PH: number,
  M: number,
  bracket?: any, // needed for headers on new pages
) {
  const totalRounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, bracketSize))));
  const quartersRound = totalRounds - 2; // round where Pool Final (QF) is played
  const semisRound   = totalRounds - 1;

  // ── Small bracket (≤8): flat view ──────────────────────────────────────────
  if (quartersRound < 1) {
    pdfDrawFlatSE(doc, fonts, allMatches, bracketSize, locale, headerH, PW, PH, M);
    return;
  }

  // ── Dimensions ─────────────────────────────────────────────────────────────
  const BAND_H   = headerH;
  const POOL_TOP = BAND_H + 28;     // top of pool cards
  const POOL_SEP = 20;              // gap between left and right pool columns
  const RND_GAP  = 18;              // gap between rounds inside a pool

  // max number of cards in round-0 per pool (quarter of round-1 total)
  const maxRound0 = bracketSize / 8;  // 8 for size=64, 4 for size=32, 2 for size=16

  // Card height: smaller for large brackets so all cards fit on one page
  const CARD_H = maxRound0 >= 8 ? 28 : maxRound0 >= 4 ? 32 : 36;

  // SLOT_H: vertical unit per round-0 slot.
  //  Constraint 1: SLOT_H > 2*CARD_H  → cards in adjacent rounds don't overlap
  //  Constraint 2: (maxRound0-1)*SLOT_H + CARD_H ≤ availH  → fits on page
  const availH   = PH - POOL_TOP - 14;
  const minSlot  = CARD_H * 2 + 2;   // minimum for no-overlap
  const maxSlot  = maxRound0 > 1
    ? Math.floor((availH - CARD_H) / (maxRound0 - 1))
    : 80;
  const SLOT_H   = Math.min(80, Math.max(minSlot, Math.min(maxSlot, minSlot + 4)));

  const halfW    = Math.floor((PW - 2 * M - POOL_SEP) / 2);
  const CARD_W   = Math.floor((halfW - (quartersRound - 1) * RND_GAP) / quartersRound);

  const poolBaseX = (pairPos: number) => M + pairPos * (halfW + POOL_SEP);
  const roundX = (base: number, ri: number) => base + ri * (CARD_W + RND_GAP);

  // Non-overlapping Y formula:
  //   slot size at round ri = SLOT_H * 2^ri
  //   center offset within block = SLOT_H*(2^ri-1)/2
  //   card top = POOL_TOP + mi*SLOT_H*2^ri + SLOT_H*(2^ri-1)/2
  const cardY = (ri: number, mi: number) =>
    POOL_TOP + mi * SLOT_H * Math.pow(2, ri) + (SLOT_H * (Math.pow(2, ri) - 1)) / 2;

  const getPoolRound = (poolIdx: number, round: number) =>
    allMatches
      .filter((m) => m.bracketSection === "main" && m.round === round && matchPoolIdx(m.position, round, bracketSize) === poolIdx)
      .sort((a: any, b: any) => a.position - b.position);

  // ── Draw pool pair (left=poolA, right=poolB) ──────────────────────────────
  const drawPoolPair = (poolA: number, poolB: number) => {
    // Vertical divider between the two pools
    const divX = M + halfW + POOL_SEP / 2;
    doc.save().lineWidth(0.5).strokeColor("#D4AF3730")
      .moveTo(divX, BAND_H + 2).lineTo(divX, PH - 15).stroke().restore();

    const pools = [poolA, poolB];
    pools.forEach((poolIdx, pairPos) => {
      const base = poolBaseX(pairPos);
      const poolLabel = "ABCD"[poolIdx] ?? String(poolIdx + 1);

      // Pool label badge
      doc.font(fonts.bold).fontSize(9).fillColor("#D4AF37")
        .text(`Pool ${poolLabel}`, base, BAND_H + 6, { width: halfW, align: "center", lineBreak: false });

      // Round labels (one per round column)
      for (let ri = 0; ri < quartersRound; ri++) {
        const lbl = poolRoundLabelPdf(quartersRound - (ri + 1), locale);
        doc.font(fonts.regular).fontSize(6.5).fillColor("#6B7280")
          .text(lbl, roundX(base, ri), BAND_H + 18, { width: CARD_W, align: "center", lineBreak: false });
      }

      // Connector lines — drawn BEFORE cards so they appear underneath
      doc.save();
      doc.lineWidth(0.8).strokeColor("#D4AF3750");
      for (let ri = 0; ri < quartersRound - 1; ri++) {
        const ms = getPoolRound(poolIdx, ri + 1);
        for (let mi = 0; mi < ms.length; mi++) {
          const x1 = roundX(base, ri) + CARD_W;
          const y1 = cardY(ri, mi) + CARD_H / 2;
          const x2 = roundX(base, ri + 1);
          const y2 = cardY(ri + 1, Math.floor(mi / 2)) + CARD_H / 2;
          const mx = x1 + RND_GAP / 2;
          doc.moveTo(x1, y1).lineTo(mx, y1).lineTo(mx, y2).lineTo(x2, y2).stroke();
        }
      }
      doc.restore();

      // Cards (drawn on top of connector lines)
      for (let ri = 0; ri < quartersRound; ri++) {
        const ms = getPoolRound(poolIdx, ri + 1);
        for (let mi = 0; mi < ms.length; mi++) {
          pdfDrawCard(doc, fonts, ms[mi], roundX(base, ri), cardY(ri, mi), CARD_W, CARD_H, locale);
        }
      }
    });
  };

  // ── Page 1: Pool A + B ────────────────────────────────────────────────────
  drawPoolPair(0, 1);

  // Footer
  doc.font(fonts.regular).fontSize(7).fillColor("#777")
    .text(`Judo-Arena · Pool A–B`, M, PH - 12, { width: PW - 2 * M, align: "right", lineBreak: false });

  // ── Page 2: Pool C + D (if bracket is large enough) ──────────────────────
  const hasCDPools = bracketSize >= 16;
  if (hasCDPools && bracket) {
    doc.addPage({ size: "A4", margin: 0, layout: "landscape" });
    const catGender = bracket.category?.gender === "MALE"
      ? (locale === "kk" ? "Ерлер" : "Men") : (locale === "kk" ? "Әйелдер" : "Women");
    const catWeight = bracket.category?.weightMax >= 200
      ? `+${bracket.category?.weightMin} кг` : `-${bracket.category?.weightMax} кг`;
    const catLbl = localize(bracket.category?.name, locale) || `${catGender} · ${catWeight}`;
    drawPageHeader(doc, fonts, bracket, locale, BAND_H, PW, M, catLbl);
    drawPoolPair(2, 3);
    doc.font(fonts.regular).fontSize(7).fillColor("#777")
      .text(`Judo-Arena · Pool C–D`, M, PH - 12, { width: PW - 2 * M, align: "right", lineBreak: false });
  }

  // ── Finals page ──────────────────────────────────────────────────────────
  if (bracket) {
    doc.addPage({ size: "A4", margin: 0, layout: "landscape" });
    const catGender2 = bracket.category?.gender === "MALE"
      ? (locale === "kk" ? "Ерлер" : "Men") : (locale === "kk" ? "Әйелдер" : "Women");
    const catWeight2 = bracket.category?.weightMax >= 200
      ? `+${bracket.category?.weightMin} кг` : `-${bracket.category?.weightMax} кг`;
    const catLbl2 = localize(bracket.category?.name, locale) || `${catGender2} · ${catWeight2}`;
    const finalsLabel = locale === "kk" ? `${catLbl2} · Финалдар` : locale === "en" ? `${catLbl2} · Finals` : `${catLbl2} · Финалы`;
    drawPageHeader(doc, fonts, bracket, locale, BAND_H, PW, M, finalsLabel);
    pdfDrawFinals(doc, fonts, allMatches, bracketSize, locale, BAND_H, PW, PH, M, semisRound, totalRounds);
  }
}

// ── Finals page (SF + Final + Repechage + Bronze) ────────────────────────────

function pdfDrawFinals(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string },
  allMatches: any[],
  _bracketSize: number,
  locale: Locale,
  headerH: number,
  PW: number,
  PH: number,
  M: number,
  semisRound: number,
  totalRounds: number,
) {
  const CARD_H = 36;
  const CARD_W = Math.floor((PW - 2 * M) / 5) - 10;
  const TOP    = headerH + 24;
  const ROW2   = TOP + CARD_H * 2 + 40; // row for bronze/repechage

  const sfLabel   = locale === "kk" ? "Жартылай финал" : locale === "en" ? "Semi-Finals" : "Полуфиналы";
  const finLabel  = locale === "kk" ? "Финал" : "Final";
  const repLabel  = locale === "kk" ? "Жұбату" : locale === "en" ? "Repechage" : "Репашаж";
  const brnLabel  = locale === "kk" ? "Қола" : locale === "en" ? "Bronze" : "Бронза";
  const champLabel = locale === "kk" ? "Чемпион" : locale === "en" ? "Champion" : "Чемпион";

  // --- Semi-Finals ---
  const sfs = allMatches
    .filter((m) => (m.bracketSection === "main" || m.bracketSection === "final") && m.round === semisRound)
    .sort((a: any, b: any) => a.position - b.position);

  doc.font(fonts.bold).fontSize(7.5).fillColor("#D4AF37")
    .text(sfLabel, M, TOP - 14, { width: CARD_W * 2, align: "center", lineBreak: false });

  const sfGap = CARD_H + 14;
  sfs.forEach((m, i) => {
    pdfDrawCard(doc, fonts, m, M, TOP + i * (CARD_H + sfGap), CARD_W, CARD_H, locale);
  });

  // Connector lines from SFs to Final
  if (sfs.length >= 2) {
    const SF_CX = M + CARD_W;
    const SF1_Y = TOP + CARD_H / 2;
    const SF2_Y = TOP + (CARD_H + sfGap) + CARD_H / 2;
    const FIN_X  = M + CARD_W + 30;
    const FIN_Y  = (SF1_Y + SF2_Y) / 2 - CARD_H / 2;
    const midX   = SF_CX + 15;

    doc.save().lineWidth(0.5).strokeColor("#D4AF3770");
    doc.moveTo(SF_CX, SF1_Y).lineTo(midX, SF1_Y).lineTo(midX, FIN_Y + CARD_H / 2).lineTo(FIN_X, FIN_Y + CARD_H / 2).stroke();
    doc.moveTo(SF_CX, SF2_Y).lineTo(midX, SF2_Y).lineTo(midX, FIN_Y + CARD_H / 2).stroke();
    doc.restore();

    // Final
    const finalMatch = allMatches.find(
      (m) => m.bracketSection === "final" && m.round === totalRounds,
    ) ?? allMatches.find((m) => m.bracketSection === "final");

    doc.font(fonts.bold).fontSize(7.5).fillColor("#D4AF37")
      .text(finLabel, FIN_X, TOP - 14, { width: CARD_W, align: "center", lineBreak: false });

    if (finalMatch) {
      pdfDrawCard(doc, fonts, finalMatch, FIN_X, FIN_Y, CARD_W, CARD_H, locale);

      // Champion box
      const champion = finalMatch.winnerId
        ? (finalMatch.redAthlete?.id === finalMatch.winnerId ? finalMatch.redAthlete : finalMatch.blueAthlete)
        : null;

      const CX = FIN_X + CARD_W + 20;
      const CY = FIN_Y;
      const CW = CARD_W;
      if (CX + CW < PW - M) {
        doc.save().lineWidth(0.6).strokeColor("#D4AF37")
          .moveTo(FIN_X + CARD_W, CY + CARD_H / 2).lineTo(CX, CY + CARD_H / 2).stroke().restore();

        doc.rect(CX, CY, CW, CARD_H).fill("#FEF3C7");
        doc.rect(CX, CY, CW, CARD_H).lineWidth(1.5).strokeColor("#D4AF37").stroke();
        doc.font(fonts.bold).fontSize(7).fillColor("#D4AF37")
          .text(`🏆 ${champLabel}`, CX, CY + 4, { width: CW, align: "center", lineBreak: false });
        if (champion) {
          doc.font(fonts.bold).fontSize(8).fillColor("#0B1426")
            .text(`${champion.name} ${(champion.surname ?? "").toUpperCase()}`, CX + 3, CY + 16, { width: CW - 6, align: "center", lineBreak: false });
          if (champion.club) {
            doc.font(fonts.regular).fontSize(5.5).fillColor("#666")
              .text(localize(champion.club.name, locale), CX + 3, CY + 27, { width: CW - 6, align: "center", lineBreak: false });
          }
        } else {
          doc.font(fonts.regular).fontSize(7).fillColor("#666")
            .text("TBD", CX, CY + 18, { width: CW, align: "center", lineBreak: false });
        }
      }
    }
  }

  // Divider
  doc.rect(M, ROW2 - 12, PW - 2 * M, 0.5).fill("#D4AF3740");

  // --- Repechage ---
  const repechage = allMatches
    .filter((m) => m.bracketSection === "repechage")
    .sort((a: any, b: any) => a.position - b.position);

  const REP_CW = Math.min(CARD_W, Math.floor((PW / 2 - 2 * M) / Math.max(1, repechage.length)) - 6);
  if (repechage.length > 0) {
    doc.font(fonts.bold).fontSize(7).fillColor("#9CA3AF")
      .text(repLabel, M, ROW2 - 8, { lineBreak: false });
    repechage.forEach((m, i) => {
      pdfDrawCard(doc, fonts, m, M + i * (REP_CW + 8), ROW2, REP_CW, CARD_H, locale);
    });
  }

  // --- Bronze ---
  const bronze = allMatches
    .filter((m) => m.bracketSection === "bronze1" || m.bracketSection === "bronze2")
    .sort((a: any, b: any) => a.bracketSection.localeCompare(b.bracketSection));

  const BRN_X = PW / 2;
  const BRN_CW = Math.min(CARD_W + 20, Math.floor((PW / 2 - M) / Math.max(1, bronze.length)) - 6);
  if (bronze.length > 0) {
    doc.font(fonts.bold).fontSize(7).fillColor("#9CA3AF")
      .text(brnLabel, BRN_X, ROW2 - 8, { lineBreak: false });
    bronze.forEach((m, i) => {
      pdfDrawCard(doc, fonts, m, BRN_X + i * (BRN_CW + 10), ROW2, BRN_CW, CARD_H, locale);
    });
  }

  // Footer
  doc.font(fonts.regular).fontSize(7).fillColor("#777")
    .text(`Judo-Arena · ${new Date().toLocaleDateString()}`, M, PH - 12, { width: PW - 2 * M, align: "right", lineBreak: false });
}

// ── Flat SE (size ≤ 8) — simple horizontal view ───────────────────────────────
function pdfDrawFlatSE(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string },
  allMatches: any[],
  bracketSize: number,
  locale: Locale,
  headerH: number,
  PW: number,
  PH: number,
  M: number,
) {
  const totalRounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, bracketSize))));
  const mainRounds: any[][] = [];
  for (let r = 1; r <= totalRounds; r++) {
    const ms = allMatches
      .filter((m) => (m.bracketSection === "main" || m.bracketSection === "final") && m.round === r)
      .sort((a: any, b: any) => a.position - b.position);
    if (ms.length) mainRounds.push(ms);
  }
  if (mainRounds.length === 0) return;

  const NUM_ROUNDS = mainRounds.length;
  const ROUND_GAP = 24;
  const CARD_H = 36;
  const BASE_GAP = 8;
  const CARD_W = Math.min(160, Math.floor((PW - 2 * M - NUM_ROUNDS * ROUND_GAP) / (NUM_ROUNDS + 0.5)));
  const TOP = headerH + 26;

  const posX = (ri: number) => M + ri * (CARD_W + ROUND_GAP);
  const posY = (ri: number, mi: number) => {
    const top = TOP + ((CARD_H + BASE_GAP) * (Math.pow(2, ri) - 1)) / 2;
    const gap = (CARD_H + BASE_GAP) * Math.pow(2, ri) - CARD_H;
    return top + mi * (CARD_H + gap);
  };

  // Round labels
  const rlabels = ["1/64","1/32","1/16","1/8","1/4","1/2","Финал"].slice(-NUM_ROUNDS);
  rlabels.forEach((lbl, ri) => {
    doc.font(fonts.bold).fontSize(7).fillColor("#D4AF37")
      .text(lbl, posX(ri), headerH + 8, { width: CARD_W, align: "center", lineBreak: false });
  });

  // Connectors
  doc.save().lineWidth(0.5).strokeColor("#D4AF3760");
  for (let ri = 0; ri < NUM_ROUNDS - 1; ri++) {
    for (let mi = 0; mi < mainRounds[ri].length; mi++) {
      const x1 = posX(ri) + CARD_W, y1 = posY(ri, mi) + CARD_H / 2;
      const x2 = posX(ri + 1),      y2 = posY(ri + 1, Math.floor(mi / 2)) + CARD_H / 2;
      const mx = x1 + ROUND_GAP / 2;
      doc.moveTo(x1, y1).lineTo(mx, y1).lineTo(mx, y2).lineTo(x2, y2).stroke();
    }
  }
  doc.restore();

  // Cards
  for (let ri = 0; ri < NUM_ROUNDS; ri++) {
    for (let mi = 0; mi < mainRounds[ri].length; mi++) {
      pdfDrawCard(doc, fonts, mainRounds[ri][mi], posX(ri), posY(ri, mi), CARD_W, CARD_H, locale);
    }
  }

  // Champion slot — keep existing logic
  const finalMatch = allMatches.find((m: any) => m.bracketSection === "final" && m.status === "COMPLETED");
  const champion = finalMatch?.winnerId
    ? (finalMatch.redAthlete?.id === finalMatch.winnerId ? finalMatch.redAthlete : finalMatch.blueAthlete)
    : null;
  if (champion) {
    const lastRi = NUM_ROUNDS - 1;
    const cx = posX(lastRi) + CARD_W + ROUND_GAP;
    const cy = posY(lastRi, 0);
    const cw = Math.min(CARD_W, PW - M - cx);
    if (cw > 40) {
      doc.save().lineWidth(0.6).strokeColor("#D4AF37")
        .moveTo(posX(lastRi) + CARD_W, cy + CARD_H / 2).lineTo(cx, cy + CARD_H / 2).stroke().restore();
      doc.rect(cx, cy, cw, CARD_H).fill("#FEF3C7");
      doc.rect(cx, cy, cw, CARD_H).lineWidth(1.5).strokeColor("#D4AF37").stroke();
      const champLabel = locale === "kk" ? "Чемпион" : locale === "en" ? "Champion" : "Чемпион";
      doc.font(fonts.bold).fontSize(7).fillColor("#D4AF37")
        .text(champLabel, cx, cy + 4, { width: cw, align: "center", lineBreak: false });
      doc.font(fonts.bold).fontSize(7).fillColor("#0B1426")
        .text(`${champion.name} ${(champion.surname ?? "").toUpperCase()}`, cx + 3, cy + 16, { width: cw - 6, align: "center", lineBreak: false });
      if (champion.club) {
        doc.font(fonts.regular).fontSize(5.5).fillColor("#666")
          .text(localize(champion.club.name, locale), cx + 3, cy + 27, { width: cw - 6, align: "center", lineBreak: false });
      }
    }
  }

  // Repechage & Bronze
  const repechage = allMatches.filter((m: any) => m.bracketSection === "repechage");
  const bronze = allMatches.filter((m: any) => m.bracketSection.startsWith("bronze"));
  const extra = [...repechage, ...bronze];
  if (extra.length > 0) {
    const lastRowBottom = posY(0, mainRounds[0].length - 1) + CARD_H;
    const secY = lastRowBottom + 14;
    if (secY + CARD_H + 20 < PH - 18) {
      doc.rect(M, secY - 2, PW - 2 * M, 0.5).fill("#D4AF3760");
      const secLabel =
        locale === "kk" ? "Жұбату және Қола матчтары"
        : locale === "en" ? "Repechage & Bronze"
        : "Репашаж и Бронзовые матчи";
      doc.font(fonts.regular).fontSize(7).fillColor("#D4AF37")
        .text(secLabel, M, secY + 3, { lineBreak: false });
      const EW = Math.min(145, Math.floor((PW - 2 * M - (extra.length - 1) * 10) / extra.length));
      for (let i = 0; i < extra.length; i++) {
        const ex = M + i * (EW + 10);
        if (ex + EW < PW - M) {
          pdfDrawCard(doc, fonts, extra[i], ex, secY + 14, EW, CARD_H, locale);
        }
      }
    }
  }
}

// ── Round Robin ───────────────────────────────────────────────────────────────

function pdfDrawRR(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string },
  matches: any[],
  locale: Locale,
  headerH: number,
  PW: number,
  PH: number,
  M: number,
) {
  const byRound = new Map<number, any[]>();
  for (const m of matches) {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push(m);
  }

  const CARD_W = 160;
  const CARD_H = 36;
  const COL_GAP = 10;
  const ROW_GAP = 10;
  const cols = Math.max(1, Math.floor((PW - 2 * M + COL_GAP) / (CARD_W + COL_GAP)));
  let curY = headerH + M;

  for (const [round, ms] of Array.from(byRound.entries()).sort((a, b) => a[0] - b[0])) {
    const roundLabel =
      locale === "kk" ? `${round}-тур`
      : locale === "en" ? `Round ${round}`
      : `Раунд ${round}`;
    doc.font(fonts.bold).fontSize(8).fillColor("#D4AF37").text(roundLabel, M, curY, { lineBreak: false });
    curY += 13;
    let col = 0;
    for (const m of [...ms].sort((a: any, b: any) => a.position - b.position)) {
      pdfDrawCard(doc, fonts, m, M + col * (CARD_W + COL_GAP), curY, CARD_W, CARD_H, locale);
      col++;
      if (col >= cols) { col = 0; curY += CARD_H + ROW_GAP; }
    }
    if (col > 0) curY += CARD_H + ROW_GAP;
    curY += 8;
    if (curY > PH - 30) { doc.addPage({ size: "A4", margin: 0, layout: "landscape" }); curY = M; }
  }
}

// ── Match card ────────────────────────────────────────────────────────────────

function pdfDrawCard(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string },
  match: any,
  x: number,
  y: number,
  w: number,
  h: number,
  locale: Locale,
) {
  const ROW_H = Math.floor((h - 1) / 2);
  const red = match.redAthlete;
  const blue = match.blueAthlete;
  const done = match.status === "COMPLETED";
  const live = match.status === "IN_PROGRESS";
  const redWon = done && !!match.winnerId && match.winnerId === red?.id;
  const blueWon = done && !!match.winnerId && match.winnerId === blue?.id;
  const redLost = done && !!match.winnerId && !redWon;
  const blueLost = done && !!match.winnerId && !blueWon;

  // Card background
  doc.rect(x, y, w, h).fill("#FAFAFA");

  if (redWon) doc.rect(x, y, w, ROW_H).fill("#FFFBEB");
  if (blueWon) doc.rect(x, y + ROW_H + 1, w, ROW_H).fill("#FFFBEB");

  // Side bars
  doc.rect(x, y, 3, ROW_H).fill(redLost ? "#FBD5D5" : "#FCA5A5");
  doc.rect(x, y + ROW_H + 1, 3, ROW_H).fill(blueLost ? "#DBEAFE" : "#93C5FD");

  // Separator
  doc.rect(x, y + ROW_H, w, 1).fill("#E5E7EB");

  // Border
  const bCol = live ? "#DC2626" : done ? "#D4AF37" : "#CCCCCC";
  const bW = live || (done && match.winnerId) ? 1.2 : 0.6;
  doc.rect(x, y, w, h).lineWidth(bW).strokeColor(bCol).stroke();

  // LIVE badge
  if (live) {
    doc.rect(x + w - 22, y + 1.5, 20, 8).fill("#DC2626");
    doc.font(fonts.bold).fontSize(5).fillColor("#FFFFFF")
      .text("LIVE", x + w - 22, y + 2.5, { width: 20, align: "center", lineBreak: false });
  }

  const scoreRed = pdfFormatScore(match.scoreSnapshot?.red);
  const scoreBlue = pdfFormatScore(match.scoreSnapshot?.blue);
  const SW = scoreRed || scoreBlue ? 36 : 0;
  const NW = w - 9 - SW;

  // Red athlete
  const rName = red ? `${red.name} ${(red.surname ?? "").toUpperCase()}` : "— TBD —";
  doc.font(redWon ? fonts.bold : fonts.regular)
    .fontSize(7).fillColor(redLost ? "#BBBBBB" : redWon ? "#92660A" : "#1A1A1A")
    .text(rName, x + 8, y + 3, { width: NW, lineBreak: false });
  if (red?.club) {
    doc.font(fonts.regular).fontSize(5.5).fillColor(redLost ? "#DDDDDD" : "#AAAAAA")
      .text(localize(red.club.name, locale), x + 8, y + 12, { width: NW, lineBreak: false });
  }
  if (scoreRed) {
    doc.font(fonts.regular).fontSize(7).fillColor(redWon ? "#D4AF37" : "#999999")
      .text(scoreRed, x + w - SW - 1, y + 4, { width: SW - 2, align: "right", lineBreak: false });
  }

  // Blue athlete
  const bName = blue ? `${blue.name} ${(blue.surname ?? "").toUpperCase()}` : "— TBD —";
  doc.font(blueWon ? fonts.bold : fonts.regular)
    .fontSize(7).fillColor(blueLost ? "#BBBBBB" : blueWon ? "#92660A" : "#1A1A1A")
    .text(bName, x + 8, y + ROW_H + 4, { width: NW, lineBreak: false });
  if (blue?.club) {
    doc.font(fonts.regular).fontSize(5.5).fillColor(blueLost ? "#DDDDDD" : "#AAAAAA")
      .text(localize(blue.club.name, locale), x + 8, y + ROW_H + 13, { width: NW, lineBreak: false });
  }
  if (scoreBlue) {
    doc.font(fonts.regular).fontSize(7).fillColor(blueWon ? "#D4AF37" : "#999999")
      .text(scoreBlue, x + w - SW - 1, y + ROW_H + 5, { width: SW - 2, align: "right", lineBreak: false });
  }
}

function pdfFormatScore(s: any): string | undefined {
  if (!s) return undefined;
  if (s.ippon > 0) return "Ippon";
  if (s.wazaari >= 2) return "W×2";
  if (s.wazaari > 0) return "Waza";
  if (s.yuko > 0) return "Yuko";
  if (s.shido > 0) return `S×${s.shido}`;
  return undefined;
}

// ============================================================
// PDF ИТОГОВОГО ПРОТОКОЛА (после COMPLETED)
// ============================================================

export async function generateTournamentProtocolPdf(tournamentId: string): Promise<Buffer> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      categories: { orderBy: [{ gender: "asc" }, { weightMin: "asc" }] },
    },
  });
  if (!tournament) throw new PdfError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  if (tournament.status !== "COMPLETED") {
    throw new PdfError(
      "NOT_COMPLETED",
      "Протокол доступен только для завершённых турниров",
      409,
    );
  }

  const locale = (tournament.primaryLocale ?? "ru") as Locale;

  const ratingEntries = await prisma.ratingEntry.findMany({
    where: { tournamentId },
    include: { athlete: { include: { club: true } }, category: true },
    orderBy: [{ categoryId: "asc" }, { place: "asc" }],
  });

  const byCategory = new Map<string, typeof ratingEntries>();
  for (const e of ratingEntries) {
    if (!byCategory.has(e.categoryId)) byCategory.set(e.categoryId, []);
    byCategory.get(e.categoryId)!.push(e);
  }

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const fonts = registerFonts(doc);
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Шапка ────────────────────────────────────────────────
    doc.font(fonts.bold).fontSize(20).fillColor("#0B1426")
      .text(localize(tournament.name, locale), { align: "center" });
    doc.moveDown(0.4);
    doc.font(fonts.regular).fontSize(11).fillColor("#555555")
      .text(`${tournament.location}, ${tournament.city}`, { align: "center" });
    doc.font(fonts.regular).fontSize(10).fillColor("#777777")
      .text(dateRange(tournament.startDate, tournament.endDate, locale), { align: "center" });
    doc.moveDown(0.4);
    doc.font(fonts.bold).fontSize(10).fillColor("#888888").text(
      locale === "en" ? "Official Final Protocol"
        : locale === "kk" ? "Ресми қорытынды хаттама"
        : "Официальный итоговый протокол",
      { align: "center" },
    );

    // Разделитель
    const lineY = doc.y + 8;
    doc.moveTo(50, lineY).lineTo(doc.page.width - 50, lineY).lineWidth(1).strokeColor("#D4AF37").stroke();
    doc.moveDown(1.5);

    // ── По каждой категории — медалисты ──────────────────────
    for (const category of tournament.categories) {
      const entries = (byCategory.get(category.id) || []).filter((e) => e.place <= 5);
      if (entries.length === 0) continue;

      const catName = localize(category.name, locale) ||
        `${category.gender} ${category.weightMin}–${category.weightMax} кг`;

      // Заголовок категории
      doc.font(fonts.bold).fontSize(13).fillColor("#0B1426").text(catName);
      doc.moveDown(0.25);

      for (const e of entries) {
        const medal = placeEmoji(e.place);
        const athleteName = `${e.athlete.name} ${e.athlete.surname}`;
        const club = e.athlete.club ? localize(e.athlete.club.name, locale) : "—";
        const pts = `${Number(e.points)} ${locale === "en" ? "pts" : locale === "kk" ? "ұпай" : "очк."}`;

        // Строка результата
        const rowColor =
          e.place === 1 ? "#92660A" :
          e.place === 2 ? "#555555" :
          e.place === 3 ? "#7C4D1E" :
          "#333333";

        doc.font(fonts.bold).fontSize(10).fillColor(rowColor)
          .text(`${medal}  ${athleteName}`, { continued: true });
        doc.font(fonts.regular).fontSize(10).fillColor("#666666")
          .text(`   ${club}`, { continued: true });
        doc.font(fonts.bold).fontSize(10).fillColor("#D4AF37")
          .text(`   ${pts}`);
      }
      doc.moveDown(0.7);

      if (doc.y > doc.page.height - 120) {
        doc.addPage();
      }
    }

    // ── Подвал ────────────────────────────────────────────────
    doc.moveDown(2);
    doc.font(fonts.regular).fontSize(8).fillColor("#AAAAAA")
      .text(`Judo-Arena  ·  ${new Date().toLocaleString()}`, { align: "center" });

    doc.end();
  });
}
