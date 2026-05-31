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

    drawBracketOnePage(doc, fonts, bracket, locale, isRR);
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
      drawBracketOnePage(doc, fonts, bracketWithTournament, locale, isRR);
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

function drawBracketOnePage(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string },
  bracket: any,
  locale: Locale,
  isRR: boolean,
) {
  const PW = doc.page.width;
  const PH = doc.page.height;
  const M = 18;
  const BAND_H = 54;

  // Header
  doc.rect(0, 0, PW, BAND_H).fill("#D4AF37");
  doc.rect(0, BAND_H - 1.5, PW, 1.5).fill("#0B1426");

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
  doc.font(fonts.bold).fontSize(14).fillColor("#111827");
  pdfStrongText(doc, tourName, M, 14, { width: 260, align: "left", lineBreak: false });
  doc.font(fonts.bold).fontSize(24).fillColor("#111827");
  pdfStrongText(doc, catLabel, M, 14, { width: PW - 2 * M, align: "center", lineBreak: false });
  doc.font(fonts.bold).fontSize(7.8).fillColor("#374151");
  pdfStrongText(doc, `${locStr}\n${dateStr}`, PW - M - 230, 13, {
    width: 230,
    align: "right",
    lineBreak: false,
  });

  const matches = [...(bracket.matches ?? [])].sort((a, b) => pdfMatchSort(a, b, bracket.size ?? 8));
  if (matches.length === 0) {
    const empty = locale === "kk" ? "Матчтар жоқ" : locale === "en" ? "No matches" : "Матчей нет";
    doc.font(fonts.regular).fontSize(10).fillColor("#777")
      .text(empty, M, BAND_H + 45, { width: PW - 2 * M, align: "center" });
    return;
  }

  const top = BAND_H + 8;
  const bottom = PH - 14;

  if (!isRR) {
    if ((bracket.size ?? 8) <= 16) {
      pdfDrawSECompactOnePage(doc, fonts, bracket, matches, locale, top, bottom, PW, PH, M);
      doc.font(fonts.regular).fontSize(6).fillColor("#777")
        .text(`Judo-Arena · ${catLabel}`, M, PH - 12, { width: PW - 2 * M, align: "right", lineBreak: false });
      return;
    }

    pdfDrawSEVisualOnePage(doc, fonts, bracket, matches, locale, top, bottom, PW, PH, M);
    doc.font(fonts.regular).fontSize(6).fillColor("#777")
      .text(`Judo-Arena · ${catLabel}`, M, PH - 12, { width: PW - 2 * M, align: "right", lineBreak: false });
    const finalMatches = pdfSEFinalMatches(matches, bracket.size ?? 8);
    if (finalMatches.length > 0) {
      doc.addPage({ size: "A4", margin: 0, layout: "landscape" });
      pdfDrawSEFinalsVisualPage(doc, fonts, bracket, finalMatches, locale);
    }
    return;
  }

  const gap = 8;
  const columns = matches.length > 48 ? 4 : matches.length > 28 ? 3 : matches.length > 14 ? 2 : 1;
  const rowsPerColumn = Math.ceil(matches.length / columns);
  const rowH = Math.max(13, Math.min(24, Math.floor((bottom - top - 16) / rowsPerColumn)));
  const colW = Math.floor((PW - 2 * M - gap * (columns - 1)) / columns);
  const stageW = Math.min(54, Math.max(42, Math.floor(colW * 0.27)));
  const resultW = Math.min(58, Math.max(46, Math.floor(colW * 0.28)));
  const pairW = colW - stageW - resultW - 8;
  const fontSize = rowH <= 14 ? 5.1 : rowH <= 17 ? 5.7 : 6.4;
  const labelFont = Math.max(4.8, fontSize - 0.4);

  for (let c = 0; c < columns; c++) {
    const x = M + c * (colW + gap);
    doc.roundedRect(x, top, colW, 13, 2).fill("#0B1426");
    doc.font(fonts.bold).fontSize(5.8).fillColor("#D4AF37")
      .text(
        locale === "kk" ? "КЕЗЕҢ" : locale === "en" ? "STAGE" : "ЭТАП",
        x + 4,
        top + 4,
        { width: stageW, lineBreak: false },
      );
    doc.text(
      locale === "kk" ? "ЖҰП" : locale === "en" ? "MATCH" : "ПАРА",
      x + 4 + stageW,
      top + 4,
      { width: pairW, lineBreak: false },
    );
    doc.text(
      locale === "kk" ? "НӘТИЖЕ" : locale === "en" ? "RESULT" : "ИТОГ",
      x + colW - resultW - 4,
      top + 4,
      { width: resultW, align: "right", lineBreak: false },
    );
  }

  matches.forEach((match, idx) => {
    const c = Math.floor(idx / rowsPerColumn);
    const r = idx % rowsPerColumn;
    const x = M + c * (colW + gap);
    const y = top + 16 + r * rowH;
    const fill = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";

    doc.rect(x, y, colW, rowH - 1).fill(fill);
    doc.rect(x, y + rowH - 1, colW, 0.35).fill("#E5E7EB");

    const stage = pdfMatchStageLabel(match, bracket.size ?? 8, locale);
    const pair = pdfMatchPairLabel(match);
    const result = pdfMatchResultLabel(match, locale);

    doc.font(fonts.bold).fontSize(labelFont).fillColor("#92660A");
    pdfTextOneLine(doc, stage, x + 4, y + 3, stageW);

    doc.font(fonts.regular).fontSize(fontSize).fillColor("#111827");
    pdfTextOneLine(doc, pair, x + 4 + stageW, y + 3, pairW);

    doc.font(match.winnerId ? fonts.bold : fonts.regular).fontSize(labelFont).fillColor(match.winnerId ? "#D4AF37" : "#6B7280");
    const resultText = pdfEllipsize(doc, result, resultW);
    doc.text(resultText, x + colW - resultW - 4, y + 3, {
      width: resultW,
      align: "right",
      lineBreak: false,
    });
  });

  doc.font(fonts.regular).fontSize(6).fillColor("#777")
    .text(`Judo-Arena · ${catLabel}`, M, PH - 12, { width: PW - 2 * M, align: "right", lineBreak: false });
}

function pdfDrawSEVisualOnePage(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string },
  bracket: any,
  allMatches: any[],
  locale: Locale,
  top: number,
  bottom: number,
  PW: number,
  _PH: number,
  M: number,
) {
  const bracketSize = bracket.size ?? 8;
  const totalRounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, bracketSize))));
  const quartersRound = Math.max(1, totalRounds - 2);
  const maxRound0 = Math.max(1, bracketSize / 8);

  const poolGapX = 14;
  const poolGapY = 10;
  const poolsAreaH = bottom - top;
  const poolW = Math.floor((PW - 2 * M - poolGapX) / 2);
  const poolH = Math.floor((poolsAreaH - poolGapY) / 2);
  const cardGapX = 6;
  const labelH = 16;
  const cardW = Math.floor((poolW - 10 - cardGapX * (quartersRound - 1)) / quartersRound);
  const slotH = maxRound0 > 1
    ? Math.max(16, Math.floor((poolH - labelH - 8) / maxRound0))
    : Math.max(18, poolH - labelH - 8);
  const cardH = Math.max(16, Math.min(22, Math.floor(slotH * 0.82)));

  const poolX = (idx: number) => M + (idx % 2) * (poolW + poolGapX);
  const poolY = (idx: number) => top + Math.floor(idx / 2) * (poolH + poolGapY);
  const roundX = (baseX: number, ri: number) => baseX + 6 + ri * (cardW + cardGapX);
  const cardY = (baseY: number, ri: number, mi: number) =>
    baseY + labelH + 5 + mi * slotH * Math.pow(2, ri) + (slotH * (Math.pow(2, ri) - 1)) / 2;

  const getPoolRound = (poolIdx: number, round: number) =>
    allMatches
      .filter((m) => m.bracketSection === "main" && m.round === round && matchPoolIdx(m.position, round, bracketSize) === poolIdx)
      .sort((a: any, b: any) => a.position - b.position);

  for (let poolIdx = 0; poolIdx < 4; poolIdx++) {
    const x = poolX(poolIdx);
    const y = poolY(poolIdx);
    const poolLabel = "ABCD"[poolIdx];

    doc.roundedRect(x, y, poolW, poolH, 5).fill("#FFFFFF");
    doc.roundedRect(x, y, poolW, poolH, 5).lineWidth(0.45).strokeColor("#E5D7A8").stroke();
    doc.font(fonts.bold).fontSize(7).fillColor("#D4AF37")
      .text(`Pool ${poolLabel}`, x + 6, y + 5, { width: poolW - 12, align: "center", lineBreak: false });

    for (let ri = 0; ri < quartersRound; ri++) {
      const lbl = poolRoundLabelPdf(quartersRound - (ri + 1), locale);
      doc.font(fonts.regular).fontSize(4.8).fillColor("#6B7280")
        .text(lbl, roundX(x, ri), y + 16, { width: cardW, align: "center", lineBreak: false });
    }

    doc.save();
    doc.lineWidth(0.45).strokeColor("#B8A06A");
    for (let ri = 0; ri < quartersRound - 1; ri++) {
      const ms = getPoolRound(poolIdx, ri + 1);
      for (let mi = 0; mi < ms.length; mi++) {
        const x1 = roundX(x, ri) + cardW;
        const y1 = cardY(y, ri, mi) + cardH / 2;
        const x2 = roundX(x, ri + 1);
        const y2 = cardY(y, ri + 1, Math.floor(mi / 2)) + cardH / 2;
        const mx = x1 + cardGapX / 2;
        doc.moveTo(x1, y1).lineTo(mx, y1).lineTo(mx, y2).lineTo(x2, y2).stroke();
      }
    }
    doc.restore();

    for (let ri = 0; ri < quartersRound; ri++) {
      const ms = getPoolRound(poolIdx, ri + 1);
      for (let mi = 0; mi < ms.length; mi++) {
        pdfDrawTinyCard(doc, fonts, ms[mi], roundX(x, ri), cardY(y, ri, mi), cardW, cardH, locale);
      }
    }
  }

}

function pdfDrawSECompactOnePage(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string },
  bracket: any,
  allMatches: any[],
  locale: Locale,
  top: number,
  bottom: number,
  PW: number,
  _PH: number,
  M: number,
) {
  const bracketSize = bracket.size ?? 8;
  const totalRounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, bracketSize))));
  const mainRounds: any[][] = [];

  for (let round = 1; round <= totalRounds; round++) {
    const roundMatches = allMatches
      .filter((m) =>
        ((m.bracketSection || "main") === "main" && (m.round ?? 1) === round)
        || (m.bracketSection === "final" && (m.round ?? 1) === round)
      )
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    if (roundMatches.length > 0) mainRounds.push(roundMatches);
  }

  if (mainRounds.length === 0) return;

  const extra = allMatches
    .filter((m) => m.bracketSection === "repechage" || m.bracketSection === "bronze1" || m.bracketSection === "bronze2")
    .sort((a, b) => pdfMatchSort(a, b, bracketSize));
  const hasExtra = extra.length > 0;
  const extraH = hasExtra ? 86 : 0;
  const mainTop = top + 4;
  const mainBottom = bottom - extraH - 6;
  const rounds = mainRounds.length;
  const champW = 92;
  const roundGap = 14;
  const cardW = Math.floor((PW - 2 * M - champW - roundGap * rounds) / (rounds + 1));
  const cardH = bracketSize <= 8 ? 34 : 27;
  const firstCount = Math.max(1, mainRounds[0]?.length ?? 1);
  const usableH = Math.max(120, mainBottom - mainTop - 18);
  const baseSlot = usableH / firstCount;

  const roundLabel = (ri: number) => {
    const left = totalRounds - ri - 1;
    if (left === 0) return locale === "kk" ? "Финал" : locale === "en" ? "Final" : "Финал";
    if (left === 1) return locale === "kk" ? "Жартылай финал" : locale === "en" ? "Semi-final" : "Полуфинал";
    if (left === 2) return "1/4";
    if (left === 3) return "1/8";
    if (left === 4) return "1/16";
    return `R${ri + 1}`;
  };

  const posX = (ri: number) => M + 12 + ri * (cardW + roundGap);
  const posY = (ri: number, mi: number) => {
    const step = baseSlot * Math.pow(2, ri);
    const offset = (step - cardH) / 2;
    return mainTop + 16 + mi * step + offset;
  };

  for (let ri = 0; ri < rounds; ri++) {
    doc.font(fonts.bold).fontSize(6.5).fillColor("#B77900")
      .text(roundLabel(ri), posX(ri), mainTop, { width: cardW, align: "center", lineBreak: false });
  }

  doc.save().lineWidth(0.65).strokeColor("#B8A06A");
  for (let ri = 0; ri < rounds - 1; ri++) {
    for (let mi = 0; mi < mainRounds[ri].length; mi++) {
      const x1 = posX(ri) + cardW;
      const y1 = posY(ri, mi) + cardH / 2;
      const x2 = posX(ri + 1);
      const y2 = posY(ri + 1, Math.floor(mi / 2)) + cardH / 2;
      const mx = x1 + roundGap / 2;
      doc.moveTo(x1, y1).lineTo(mx, y1).lineTo(mx, y2).lineTo(x2, y2).stroke();
    }
  }
  doc.restore();

  for (let ri = 0; ri < rounds; ri++) {
    for (let mi = 0; mi < mainRounds[ri].length; mi++) {
      pdfDrawTinyCard(doc, fonts, mainRounds[ri][mi], posX(ri), posY(ri, mi), cardW, cardH, locale);
    }
  }

  const finalMatch = mainRounds[rounds - 1]?.[0];
  const champion = finalMatch?.winnerId
    ? (finalMatch.redAthlete?.id === finalMatch.winnerId ? finalMatch.redAthlete : finalMatch.blueAthlete)
    : null;
  const champX = posX(rounds - 1) + cardW + roundGap;
  const champY = posY(rounds - 1, 0);
  const champLabel = locale === "kk" ? "Чемпион" : locale === "en" ? "Champion" : "Чемпион";

  doc.save().lineWidth(0.65).strokeColor("#B8A06A")
    .moveTo(posX(rounds - 1) + cardW, champY + cardH / 2)
    .lineTo(champX, champY + cardH / 2)
    .stroke().restore();
  doc.roundedRect(champX, champY, champW, cardH, 3).fill("#FFF2D2");
  doc.roundedRect(champX, champY, champW, cardH, 3).lineWidth(1.1).strokeColor("#D4AF37").stroke();
  doc.font(fonts.bold).fontSize(5.8).fillColor("#B77900")
    .text(champLabel, champX + 4, champY + 4, { width: champW - 8, align: "center", lineBreak: false });
  doc.font(fonts.bold).fontSize(cardH <= 28 ? 7 : 8).fillColor("#111827")
    .text(champion ? pdfAthleteBracketName(champion) : "TBD", champX + 4, champY + cardH / 2 - 1, {
      width: champW - 8,
      align: "center",
      lineBreak: false,
    });

  if (!hasExtra) return;

  const extraTop = bottom - extraH + 6;
  doc.roundedRect(M, extraTop, PW - 2 * M, extraH - 10, 5).fill("#FFFFFF");
  doc.roundedRect(M, extraTop, PW - 2 * M, extraH - 10, 5).lineWidth(0.45).strokeColor("#E5D7A8").stroke();

  const repechage = extra.filter((m) => m.bracketSection === "repechage");
  const bronze = extra.filter((m) => m.bracketSection === "bronze1" || m.bracketSection === "bronze2");
  const repLabel = locale === "kk" ? "Жұбату" : locale === "en" ? "Repechage" : "Репашаж";
  const bronzeLabel = locale === "kk" ? "Қола үшін" : locale === "en" ? "Bronze" : "За бронзу";
  const sectionGap = 20;
  const secW = (PW - 2 * M - sectionGap) / 2;
  const eCardH = 28;
  const eGap = 7;
  const repW = repechage.length
    ? Math.max(74, Math.floor((secW - 16 - eGap * (repechage.length - 1)) / repechage.length))
    : 90;
  const bronzeW = bronze.length
    ? Math.max(92, Math.floor((secW - 16 - eGap * (bronze.length - 1)) / bronze.length))
    : 110;

  doc.font(fonts.bold).fontSize(7).fillColor("#B77900")
    .text(repLabel, M + 8, extraTop + 7, { width: secW - 16, align: "center", lineBreak: false });
  repechage.forEach((m, i) => {
    pdfDrawTinyCard(doc, fonts, m, M + 8 + i * (repW + eGap), extraTop + 23, repW, eCardH, locale);
  });

  const bronzeX = M + secW + sectionGap;
  doc.font(fonts.bold).fontSize(7).fillColor("#B77900")
    .text(bronzeLabel, bronzeX + 8, extraTop + 7, { width: secW - 16, align: "center", lineBreak: false });
  bronze.forEach((m, i) => {
    pdfDrawTinyCard(doc, fonts, m, bronzeX + 8 + i * (bronzeW + eGap), extraTop + 23, bronzeW, eCardH, locale);
  });
}

function pdfSEFinalMatches(allMatches: any[], bracketSize: number): any[] {
  const totalRounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, bracketSize))));
  const poolFinalRound = Math.max(1, totalRounds - 2);
  return allMatches
    .filter((m) => {
      const section = m.bracketSection || "main";
      if (section !== "main") return true;
      return (m.round ?? 1) > poolFinalRound;
    })
    .sort((a, b) => pdfMatchSort(a, b, bracketSize));
}

function pdfDrawSEFinalsVisualPage(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string },
  bracket: any,
  finalMatches: any[],
  locale: Locale,
) {
  const PW = doc.page.width;
  const PH = doc.page.height;
  const M = 28;
  const BAND_H = 54;
  const bracketSize = bracket.size ?? 8;
  const totalRounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, bracketSize))));
  const semisRound = Math.max(1, totalRounds - 1);

  const catGender =
    bracket.category.gender === "MALE"
      ? locale === "kk" ? "Ерлер" : locale === "en" ? "Men" : "Мужчины"
      : locale === "kk" ? "Әйелдер" : locale === "en" ? "Women" : "Женщины";
  const catWeight =
    bracket.category.weightMax >= 200
      ? `+${bracket.category.weightMin} кг`
      : `-${bracket.category.weightMax} кг`;
  const catLabel = localize(bracket.category.name, locale) || `${catGender} · ${catWeight}`;
  const pageTitle =
    locale === "kk" ? `${catLabel} · Финалдар`
      : locale === "en" ? `${catLabel} · Finals`
      : `${catLabel} · Финалы`;

  doc.rect(0, 0, PW, BAND_H).fill("#D4AF37");
  doc.rect(0, BAND_H - 1.5, PW, 1.5).fill("#0B1426");
  doc.font(fonts.bold).fontSize(21).fillColor("#111827");
  pdfStrongText(doc, pageTitle, M, 16, { width: PW - 2 * M, align: "center", lineBreak: false });

  const sfLabel = locale === "kk" ? "Жартылай финал" : locale === "en" ? "Semi-finals" : "Полуфиналы";
  const finalLabel = locale === "kk" ? "Финал" : locale === "en" ? "Final" : "Финал";
  const championLabel = locale === "kk" ? "Чемпион" : locale === "en" ? "Champion" : "Чемпион";
  const repechageLabel = locale === "kk" ? "Жұбату" : locale === "en" ? "Repechage" : "Репашаж";
  const bronzeLabel = locale === "kk" ? "Қола үшін" : locale === "en" ? "Bronze" : "За бронзу";

  const cardW = 190;
  const cardH = 38;
  const top = BAND_H + 44;
  const sfX = M + 34;
  const finalX = PW / 2 - cardW / 2;
  const champX = PW - M - 34 - cardW;
  const sfY1 = top + 16;
  const sfY2 = top + 126;
  const finalY = top + 71;
  const champY = finalY;

  const semis = finalMatches
    .filter((m) => (m.bracketSection === "main" || m.bracketSection === "final") && (m.round ?? 0) === semisRound)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .slice(0, 2);
  const finalMatch =
    finalMatches.find((m) => m.bracketSection === "final" && (m.round ?? 0) === totalRounds)
    ?? finalMatches.find((m) => m.bracketSection === "final");
  const champion = finalMatch?.winnerId
    ? (finalMatch.redAthlete?.id === finalMatch.winnerId ? finalMatch.redAthlete : finalMatch.blueAthlete)
    : null;

  doc.font(fonts.bold).fontSize(8.5).fillColor("#B77900")
    .text(sfLabel, sfX, top - 8, { width: cardW, align: "center", lineBreak: false });
  doc.font(fonts.bold).fontSize(8.5).fillColor("#B77900")
    .text(finalLabel, finalX, top - 8, { width: cardW, align: "center", lineBreak: false });
  doc.font(fonts.bold).fontSize(8.5).fillColor("#B77900")
    .text(championLabel, champX, top - 8, { width: cardW, align: "center", lineBreak: false });

  if (semis[0]) pdfDrawTinyCard(doc, fonts, semis[0], sfX, sfY1, cardW, cardH, locale);
  if (semis[1]) pdfDrawTinyCard(doc, fonts, semis[1], sfX, sfY2, cardW, cardH, locale);
  if (finalMatch) pdfDrawTinyCard(doc, fonts, finalMatch, finalX, finalY, cardW, cardH, locale);

  doc.save().lineWidth(0.9).strokeColor("#B8A06A");
  if (semis.length > 0 && finalMatch) {
    const midX = sfX + cardW + (finalX - sfX - cardW) / 2;
    if (semis[0]) {
      doc.moveTo(sfX + cardW, sfY1 + cardH / 2)
        .lineTo(midX, sfY1 + cardH / 2)
        .lineTo(midX, finalY + cardH / 2)
        .lineTo(finalX, finalY + cardH / 2)
        .stroke();
    }
    if (semis[1]) {
      doc.moveTo(sfX + cardW, sfY2 + cardH / 2)
        .lineTo(midX, sfY2 + cardH / 2)
        .lineTo(midX, finalY + cardH / 2)
        .stroke();
    }
  }
  if (finalMatch) {
    doc.moveTo(finalX + cardW, finalY + cardH / 2)
      .lineTo(champX, champY + cardH / 2)
      .stroke();
  }
  doc.restore();

  doc.roundedRect(champX, champY, cardW, cardH, 3).fill("#FFF2D2");
  doc.roundedRect(champX, champY, cardW, cardH, 3).lineWidth(1.2).strokeColor("#D4AF37").stroke();
  doc.font(fonts.bold).fontSize(11).fillColor("#111827")
    .text(champion ? pdfAthleteBracketName(champion) : "TBD", champX + 8, champY + 12, {
      width: cardW - 16,
      align: "center",
      lineBreak: false,
    });

  const lowerTop = top + 230;
  doc.roundedRect(M, lowerTop - 18, PW - 2 * M, PH - lowerTop - 22, 5).fill("#FFFFFF");
  doc.roundedRect(M, lowerTop - 18, PW - 2 * M, PH - lowerTop - 22, 5).lineWidth(0.45).strokeColor("#E5D7A8").stroke();

  const repechage = finalMatches
    .filter((m) => m.bracketSection === "repechage")
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const bronze = finalMatches
    .filter((m) => m.bracketSection === "bronze1" || m.bracketSection === "bronze2")
    .sort((a, b) => (a.bracketSection || "").localeCompare(b.bracketSection || ""));

  const sectionGap = 28;
  const secW = (PW - 2 * M - sectionGap) / 2;
  const smallGap = 10;
  const smallH = 34;
  const repCardW = repechage.length > 0
    ? Math.min(170, Math.floor((secW - smallGap * (repechage.length - 1)) / repechage.length))
    : 170;
  const bronzeCardW = bronze.length > 0
    ? Math.min(185, Math.floor((secW - smallGap * (bronze.length - 1)) / bronze.length))
    : 185;

  doc.font(fonts.bold).fontSize(10).fillColor("#B77900")
    .text(repechageLabel, M + 10, lowerTop - 8, { width: secW - 20, align: "center", lineBreak: false });
  repechage.forEach((m, i) => {
    pdfDrawTinyCard(doc, fonts, m, M + 10 + i * (repCardW + smallGap), lowerTop + 14, repCardW, smallH, locale);
  });

  const bronzeX = M + secW + sectionGap;
  doc.font(fonts.bold).fontSize(10).fillColor("#B77900")
    .text(bronzeLabel, bronzeX + 10, lowerTop - 8, { width: secW - 20, align: "center", lineBreak: false });
  bronze.forEach((m, i) => {
    pdfDrawTinyCard(doc, fonts, m, bronzeX + 10 + i * (bronzeCardW + smallGap), lowerTop + 14, bronzeCardW, smallH, locale);
  });

  doc.font(fonts.regular).fontSize(7).fillColor("#777")
    .text(`Judo-Arena · ${catLabel}`, M, PH - 14, { width: PW - 2 * M, align: "right", lineBreak: false });
}

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

function pdfMatchSectionOrder(section?: string | null): number {
  const order: Record<string, number> = {
    main: 0,
    repechage: 1,
    bronze1: 2,
    bronze2: 3,
    final: 4,
  };
  return order[section || "main"] ?? 9;
}

function pdfMatchSort(a: any, b: any, bracketSize: number): number {
  const ao = pdfMatchSectionOrder(a.bracketSection);
  const bo = pdfMatchSectionOrder(b.bracketSection);
  if (ao !== bo) return ao - bo;
  if ((a.bracketSection || "main") === "main") {
    const ap = matchPoolIdx(a.position ?? 0, a.round ?? 1, bracketSize);
    const bp = matchPoolIdx(b.position ?? 0, b.round ?? 1, bracketSize);
    if (ap !== bp) return ap - bp;
  }
  if ((a.round ?? 0) !== (b.round ?? 0)) return (a.round ?? 0) - (b.round ?? 0);
  return (a.position ?? 0) - (b.position ?? 0);
}

function pdfMatchStageLabel(match: any, bracketSize: number, locale: Locale): string {
  const totalRounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, bracketSize))));
  const quartersRound = totalRounds - 2;
  const section = match.bracketSection || "main";

  if (section === "main") {
    const pool = "ABCD"[matchPoolIdx(match.position ?? 0, match.round ?? 1, bracketSize)] ?? "?";
    const stage = (match.round ?? 1) <= quartersRound
      ? poolRoundLabelPdf(quartersRound - (match.round ?? 1), locale)
      : (locale === "kk" ? "Жартылай финал" : locale === "en" ? "SF" : "ПФ");
    return `P${pool} ${stage}`;
  }

  if (section === "final") return locale === "kk" ? "Финал" : "Final";
  if (section === "repechage") return locale === "kk" ? "Жұбату" : locale === "en" ? "Repechage" : "Репашаж";
  if (section === "bronze1" || section === "bronze2") return locale === "kk" ? "Қола" : locale === "en" ? "Bronze" : "Бронза";
  return section;
}

function pdfAthleteShortName(athlete: any): string {
  if (!athlete) return "TBD";
  const first = pdfCleanNamePart(athlete.name);
  const surname = pdfCleanNamePart(athlete.surname);
  return `${first} ${surname}`.trim() || "TBD";
}

function pdfMatchPairLabel(match: any): string {
  const red = pdfAthleteShortName(match.redAthlete);
  const blue = pdfAthleteShortName(match.blueAthlete);
  return `${red} vs ${blue}`;
}

function pdfMatchResultLabel(match: any, locale: Locale): string {
  if (!match.winnerId) {
    if (match.status === "IN_PROGRESS") return "LIVE";
    return locale === "kk" ? "күтілуде" : locale === "en" ? "pending" : "ожидает";
  }
  const winner = match.redAthlete?.id === match.winnerId ? match.redAthlete : match.blueAthlete;
  const winnerScore = match.redAthlete?.id === match.winnerId
    ? pdfFormatScore(match.scoreSnapshot?.red)
    : pdfFormatScore(match.scoreSnapshot?.blue);
  const winnerName = pdfAthleteShortName(winner);
  return winnerScore ? `${winnerName} · ${winnerScore}` : winnerName;
}

function pdfAthleteBracketName(athlete: any): string {
  if (!athlete) return "TBD";
  const surname = pdfCleanNamePart(athlete.surname);
  const name = pdfCleanNamePart(athlete.name);
  return (surname || name || "TBD").toUpperCase();
}

function pdfAthleteFullDisplayName(athlete: any): string {
  if (!athlete) return "TBD";
  const first = pdfCleanNamePart(athlete.name);
  const surname = pdfCleanNamePart(athlete.surname).toUpperCase();
  return `${first} ${surname}`.trim() || "TBD";
}

function pdfCleanNamePart(value: any): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\d+$/u, "");
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
            .text(pdfAthleteFullDisplayName(champion), CX + 3, CY + 16, { width: CW - 6, align: "center", lineBreak: false });
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
        .text(pdfAthleteFullDisplayName(champion), cx + 3, cy + 16, { width: cw - 6, align: "center", lineBreak: false });
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
  const compact = h < 34;
  const SW = scoreRed || scoreBlue ? (compact ? 24 : 34) : 0;
  const NW = Math.max(20, w - 11 - SW);
  const nameFont = compact ? 5.7 : 6.7;
  const clubFont = compact ? 0 : 5.1;
  const scoreFont = compact ? 5.5 : 6.3;
  const nameOffsetY = compact ? 4 : 3;
  const clubOffsetY = compact ? 0 : Math.min(12, ROW_H - 6);
  const blueNameOffsetY = compact ? 4 : 4;
  const blueClubOffsetY = compact ? 0 : Math.min(13, ROW_H - 5);

  // Red athlete
  const rName = red ? pdfAthleteFullDisplayName(red) : "— TBD —";
  doc.font(redWon ? fonts.bold : fonts.regular)
    .fontSize(nameFont).fillColor(redLost ? "#BBBBBB" : redWon ? "#92660A" : "#1A1A1A");
  pdfTextOneLine(doc, rName, x + 8, y + nameOffsetY, NW);
  if (!compact && red?.club) {
    doc.font(fonts.regular).fontSize(clubFont).fillColor(redLost ? "#DDDDDD" : "#AAAAAA");
    pdfTextOneLine(doc, localize(red.club.name, locale), x + 8, y + clubOffsetY, NW);
  }
  if (scoreRed) {
    doc.font(fonts.regular).fontSize(scoreFont).fillColor(redWon ? "#D4AF37" : "#999999")
      .text(scoreRed, x + w - SW - 2, y + nameOffsetY, { width: SW, align: "right", lineBreak: false });
  }

  // Blue athlete
  const bName = blue ? pdfAthleteFullDisplayName(blue) : "— TBD —";
  doc.font(blueWon ? fonts.bold : fonts.regular)
    .fontSize(nameFont).fillColor(blueLost ? "#BBBBBB" : blueWon ? "#92660A" : "#1A1A1A");
  pdfTextOneLine(doc, bName, x + 8, y + ROW_H + blueNameOffsetY, NW);
  if (!compact && blue?.club) {
    doc.font(fonts.regular).fontSize(clubFont).fillColor(blueLost ? "#DDDDDD" : "#AAAAAA");
    pdfTextOneLine(doc, localize(blue.club.name, locale), x + 8, y + ROW_H + blueClubOffsetY, NW);
  }
  if (scoreBlue) {
    doc.font(fonts.regular).fontSize(scoreFont).fillColor(blueWon ? "#D4AF37" : "#999999")
      .text(scoreBlue, x + w - SW - 2, y + ROW_H + blueNameOffsetY, { width: SW, align: "right", lineBreak: false });
  }
}

function pdfDrawTinyCard(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string },
  match: any,
  x: number,
  y: number,
  w: number,
  h: number,
  locale: Locale,
) {
  const rowH = Math.floor((h - 1) / 2);
  const red = match.redAthlete;
  const blue = match.blueAthlete;
  const done = match.status === "COMPLETED";
  const redWon = done && !!match.winnerId && match.winnerId === red?.id;
  const blueWon = done && !!match.winnerId && match.winnerId === blue?.id;
  const redLost = done && !!match.winnerId && !redWon;
  const blueLost = done && !!match.winnerId && !blueWon;
  const advanceW = match.winnerId ? 8 : 0;
  const nameW = Math.max(16, w - advanceW - 9);
  const nameFs = h <= 16 ? 5.3 : h <= 20 ? 5.9 : 6.4;
  const rowPadY = h <= 16 ? 1 : 1.2;

  doc.rect(x, y, w, h).fill("#FFFFFF");
  if (redWon) doc.rect(x, y, w, rowH).fill("#FFF2D2");
  if (blueWon) doc.rect(x, y + rowH + 1, w, rowH).fill("#FFF2D2");
  doc.rect(x, y, 2, rowH).fill(redLost ? "#FBCFE8" : "#FB7185");
  doc.rect(x, y + rowH + 1, 2, rowH).fill(blueLost ? "#BAE6FD" : "#38BDF8");
  doc.rect(x, y + rowH, w, 0.7).fill("#E5E7EB");
  doc.roundedRect(x, y, w, h, 2).lineWidth(done ? 0.8 : 0.45).strokeColor(done ? "#D4AF37" : "#D8D0BE").stroke();

  const redName = pdfAthleteBracketName(red);
  const blueName = pdfAthleteBracketName(blue);
  doc.font(redWon ? fonts.bold : fonts.regular).fontSize(nameFs).fillColor(redLost ? "#A7A7A7" : "#111827");
  pdfTextOneLine(doc, redName, x + 4, y + rowPadY, nameW);

  doc.font(blueWon ? fonts.bold : fonts.regular).fontSize(nameFs).fillColor(blueLost ? "#A7A7A7" : "#111827");
  pdfTextOneLine(doc, blueName, x + 4, y + rowH + 1 + rowPadY, nameW);

  if (redWon || blueWon) {
    const arrowY = redWon ? y + rowH / 2 - 3 : y + rowH + 1 + rowH / 2 - 3;
    doc.font(fonts.bold).fontSize(6).fillColor("#B77900")
      .text(">", x + w - 9, arrowY, { width: 7, align: "right", lineBreak: false });
  }
}

function pdfTextOneLine(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number) {
  const value = pdfEllipsize(doc, text, width);
  doc.text(value, x, y, { width, lineBreak: false });
}

function pdfStrongText(doc: PDFKit.PDFDocument, text: string, x: number, y: number, options: any) {
  doc.text(text, x, y, options);
  doc.text(text, x + 0.28, y, options);
  doc.text(text, x, y + 0.18, options);
}

function pdfEllipsize(doc: PDFKit.PDFDocument, text: string, width: number): string {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (doc.widthOfString(normalized) <= width) return normalized;

  const ellipsis = "...";
  let lo = 0;
  let hi = normalized.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (doc.widthOfString(normalized.slice(0, mid) + ellipsis) <= width) lo = mid;
    else hi = mid - 1;
  }
  return normalized.slice(0, Math.max(1, lo)).trimEnd() + ellipsis;
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

function pdfFormatScoreShort(s: any): string | undefined {
  if (!s) return undefined;
  if (s.ippon > 0) return "IPP";
  if (s.wazaari >= 2) return "W2";
  if (s.wazaari > 0) return "WAZ";
  if (s.yuko > 0) return "YUK";
  if (s.shido > 0) return `S${s.shido}`;
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
        const athleteName = pdfAthleteFullDisplayName(e.athlete);
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

    if (brackets.length > 0) {
      for (const bracket of brackets) {
        doc.addPage({ size: "A4", margin: 0, layout: "landscape" });
        const bracketWithTournament = { ...bracket, tournament };
        drawBracketOnePage(
          doc,
          fonts,
          bracketWithTournament,
          locale,
          bracket.format === BracketFormat.ROUND_ROBIN,
        );
      }
    }

    doc.end();
  });
}
