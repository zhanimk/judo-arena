/**
 * Сервис генерации PDF.
 *
 * Только два документа:
 *   1. PDF сетки — после распределения, перед турниром (расписание матчей)
 *   2. PDF итогового протокола — после COMPLETED (медалисты + очки)
 *
 * Используется PDFKit (легковесно, без headless-браузера).
 */

import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma.js";
import { BracketFormat, type Locale } from "@prisma/client";

export class PdfError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
    this.name = "PdfError";
  }
}

// ============================================================
// УТИЛИТЫ
// ============================================================

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
  return `${start.toLocaleDateString(lng, opt)} — ${end.toLocaleDateString(lng, opt)}`;
}

const SECTION_NAMES: Record<string, Record<Locale, string>> = {
  main: { ru: "Основная сетка", kk: "Негізгі тор", en: "Main bracket" },
  repechage: { ru: "Repechage (Жұбату)", kk: "Жұбату", en: "Repechage" },
  bronze1: { ru: "Матч за бронзу #1", kk: "Қола үшін №1", en: "Bronze #1" },
  bronze2: { ru: "Матч за бронзу #2", kk: "Қола үшін №2", en: "Bronze #2" },
  final: { ru: "Финал", kk: "Финал", en: "Final" },
};

// ============================================================
// PDF СЕТКИ (расписание матчей)
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
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = doc.page.width;   // ~841.89
    const PH = doc.page.height;  // ~595.28
    const M = 24;
    const BAND_H = 58;

    // ── Header band ─────────────────────────────────────────
    doc.rect(0, 0, PW, BAND_H).fill("#0B1426");
    doc.rect(0, BAND_H - 1, PW, 1.5).fill("#D4AF37");

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

    doc.fontSize(14).fillColor("#D4AF37")
      .text(tourName, M, 9, { width: PW - 2 * M, align: "center", lineBreak: false });
    doc.fontSize(11).fillColor("#FFFFFF")
      .text(catLabel, M, 27, { width: PW - 2 * M, align: "center", lineBreak: false });
    doc.fontSize(8).fillColor("#9CA3AF")
      .text(`${locStr}   ·   ${dateStr}`, M, 44, { width: PW - 2 * M, align: "center", lineBreak: false });

    // ── Content ──────────────────────────────────────────────
    if (isRR) {
      pdfDrawRR(doc, bracket.matches, locale, BAND_H, PW, PH, M);
    } else {
      pdfDrawSE(doc, bracket.matches, bracket.size ?? 8, locale, BAND_H, PW, PH, M);
    }

    // ── Footer ───────────────────────────────────────────────
    doc.fontSize(7).fillColor("#999999")
      .text(`Judo-Arena · ${new Date().toLocaleDateString()}`, M, PH - 13, {
        width: PW - 2 * M, align: "right", lineBreak: false,
      });

    doc.end();
  });
}

// ── Single Elimination ───────────────────────────────────────

function pdfDrawSE(
  doc: PDFKit.PDFDocument,
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
  const ROUND_GAP = 30;
  const CARD_H = 38;
  const BASE_GAP = 8;
  // Leave half a card width for the champion slot on the right
  const CARD_W = Math.min(150, Math.floor(
    (PW - 2 * M - NUM_ROUNDS * ROUND_GAP) / (NUM_ROUNDS + 0.5),
  ));
  const LABEL_OFFSET = 16; // pixels below header band for round labels
  const TOP = headerH + LABEL_OFFSET + 10;

  const posX = (ri: number) => M + ri * (CARD_W + ROUND_GAP);
  const posY = (ri: number, mi: number) => {
    const top = TOP + ((CARD_H + BASE_GAP) * (Math.pow(2, ri) - 1)) / 2;
    const gap = (CARD_H + BASE_GAP) * Math.pow(2, ri) - CARD_H;
    return top + mi * (CARD_H + gap);
  };

  // Round labels
  const ALL_LABELS = ["1/32", "1/16", "1/8", "1/4", "1/2", "Финал"];
  const labels = ALL_LABELS.slice(-NUM_ROUNDS);
  for (let ri = 0; ri < NUM_ROUNDS; ri++) {
    doc.fontSize(7).fillColor("#D4AF37")
      .text(labels[ri] ?? `R${ri + 1}`, posX(ri), headerH + 5,
        { width: CARD_W, align: "center", lineBreak: false });
  }

  // Connector lines (draw before cards so cards sit on top)
  doc.save();
  doc.lineWidth(0.6).strokeColor("#D4AF37").fillOpacity(0.35);
  for (let ri = 0; ri < NUM_ROUNDS - 1; ri++) {
    for (let mi = 0; mi < mainRounds[ri].length; mi++) {
      const x1 = posX(ri) + CARD_W;
      const y1 = posY(ri, mi) + CARD_H / 2;
      const x2 = posX(ri + 1);
      const y2 = posY(ri + 1, Math.floor(mi / 2)) + CARD_H / 2;
      const midX = x1 + ROUND_GAP / 2;
      doc.moveTo(x1, y1).lineTo(midX, y1).lineTo(midX, y2).lineTo(x2, y2).stroke();
    }
  }
  doc.restore();

  // Match cards
  for (let ri = 0; ri < NUM_ROUNDS; ri++) {
    for (let mi = 0; mi < mainRounds[ri].length; mi++) {
      pdfDrawCard(doc, mainRounds[ri][mi], posX(ri), posY(ri, mi), CARD_W, CARD_H, locale);
    }
  }

  // Champion slot
  const finalMatch = allMatches.find(
    (m: any) => m.bracketSection === "final" && m.status === "COMPLETED",
  );
  const champion = finalMatch?.winnerId
    ? (finalMatch.redAthlete?.id === finalMatch.winnerId
        ? finalMatch.redAthlete
        : finalMatch.blueAthlete)
    : null;
  if (champion) {
    const lastRi = NUM_ROUNDS - 1;
    const cx = posX(lastRi) + CARD_W + ROUND_GAP;
    const cy = posY(lastRi, 0);
    const cw = Math.min(CARD_W, PW - M - cx);
    if (cw > 40) {
      doc.save();
      doc.lineWidth(0.6).strokeColor("#D4AF37")
        .moveTo(posX(lastRi) + CARD_W, cy + CARD_H / 2)
        .lineTo(cx, cy + CARD_H / 2).stroke();
      doc.restore();
      doc.rect(cx, cy, cw, CARD_H).fill("#FEF3C7");
      doc.rect(cx, cy, cw, CARD_H).lineWidth(1.5).strokeColor("#D4AF37").stroke();
      doc.fontSize(9).fillColor("#D4AF37")
        .text("🏆", cx, cy + 3, { width: cw, align: "center", lineBreak: false });
      doc.fontSize(7.5).fillColor("#0B1426")
        .text(`${champion.name} ${(champion.surname ?? "").toUpperCase()}`,
          cx + 3, cy + 16, { width: cw - 6, align: "center", lineBreak: false });
      if (champion.clubCity) {
        doc.fontSize(5.5).fillColor("#888888")
          .text(champion.clubCity, cx + 3, cy + 27, { width: cw - 6, align: "center", lineBreak: false });
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
      const secLabel = locale === "kk" ? "Жұбату & Қола" : "Repechage & Bronze";
      doc.fontSize(7).fillColor("#D4AF37")
        .text(secLabel, M, secY + 3, { lineBreak: false });
      const EW = Math.min(148, Math.floor((PW - 2 * M - (extra.length - 1) * 10) / extra.length));
      for (let i = 0; i < extra.length; i++) {
        const ex = M + i * (EW + 10);
        if (ex + EW < PW - M) {
          pdfDrawCard(doc, extra[i], ex, secY + 14, EW, CARD_H, locale);
        }
      }
    }
  }
}

// ── Round Robin ──────────────────────────────────────────────

function pdfDrawRR(
  doc: PDFKit.PDFDocument,
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

  const CARD_W = 162;
  const CARD_H = 38;
  const COL_GAP = 10;
  const ROW_GAP = 10;
  const cols = Math.max(1, Math.floor((PW - 2 * M + COL_GAP) / (CARD_W + COL_GAP)));
  let curY = headerH + M;

  for (const [round, ms] of Array.from(byRound.entries()).sort((a, b) => a[0] - b[0])) {
    const roundLabel = locale === "kk" ? `${round}-тур` : `Раунд ${round}`;
    doc.fontSize(8).fillColor("#D4AF37").text(roundLabel, M, curY, { lineBreak: false });
    curY += 13;
    let col = 0;
    for (const m of [...ms].sort((a: any, b: any) => a.position - b.position)) {
      pdfDrawCard(doc, m, M + col * (CARD_W + COL_GAP), curY, CARD_W, CARD_H, locale);
      col++;
      if (col >= cols) { col = 0; curY += CARD_H + ROW_GAP; }
    }
    if (col > 0) curY += CARD_H + ROW_GAP;
    curY += 6;
    if (curY > PH - 30) { doc.addPage(); curY = M; }
  }
}

// ── Match card ───────────────────────────────────────────────

function pdfDrawCard(
  doc: PDFKit.PDFDocument,
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

  // Winner row highlight
  if (redWon) doc.rect(x, y, w, ROW_H).fill("#FFFBEB");
  if (blueWon) doc.rect(x, y + ROW_H + 1, w, ROW_H).fill("#FFFBEB");

  // Side colour bars (red / blue)
  doc.rect(x, y, 2.5, ROW_H).fill(redLost ? "#FBD5D5" : "#FCA5A5");
  doc.rect(x, y + ROW_H + 1, 2.5, ROW_H).fill(blueLost ? "#DBEAFE" : "#93C5FD");

  // Separator line
  doc.rect(x, y + ROW_H, w, 1).fill("#E5E7EB");

  // Card border
  const bCol = live ? "#DC2626" : done ? "#D4AF37" : "#CCCCCC";
  const bW = live || (done && match.winnerId) ? 1.2 : 0.7;
  doc.rect(x, y, w, h).lineWidth(bW).strokeColor(bCol).stroke();

  // LIVE badge
  if (live) {
    doc.rect(x + w - 22, y + 1.5, 20, 8).fill("#DC2626");
    doc.fontSize(5).fillColor("#FFFFFF")
      .text("LIVE", x + w - 22, y + 2.5, { width: 20, align: "center", lineBreak: false });
  }

  const scoreRed = pdfFormatScore(match.scoreSnapshot?.red);
  const scoreBlue = pdfFormatScore(match.scoreSnapshot?.blue);
  const SW = scoreRed || scoreBlue ? 36 : 0;
  const NW = w - 8 - SW;

  // Red athlete
  const rName = red ? `${red.name} ${(red.surname ?? "").toUpperCase()}` : "— TBD —";
  doc.fontSize(7).fillColor(redLost ? "#BBBBBB" : redWon ? "#92660A" : "#1A1A1A")
    .text(rName, x + 7, y + 3, { width: NW, lineBreak: false });
  if (red?.club) {
    doc.fontSize(5.5).fillColor(redLost ? "#DDDDDD" : "#AAAAAA")
      .text(localize(red.club.name, locale), x + 7, y + 12, { width: NW, lineBreak: false });
  }
  if (scoreRed) {
    doc.fontSize(7).fillColor(redWon ? "#D4AF37" : "#999999")
      .text(scoreRed, x + w - SW - 1, y + 4, { width: SW - 2, align: "right", lineBreak: false });
  }

  // Blue athlete
  const bName = blue ? `${blue.name} ${(blue.surname ?? "").toUpperCase()}` : "— TBD —";
  doc.fontSize(7).fillColor(blueLost ? "#BBBBBB" : blueWon ? "#92660A" : "#1A1A1A")
    .text(bName, x + 7, y + ROW_H + 4, { width: NW, lineBreak: false });
  if (blue?.club) {
    doc.fontSize(5.5).fillColor(blueLost ? "#DDDDDD" : "#AAAAAA")
      .text(localize(blue.club.name, locale), x + 7, y + ROW_H + 13, { width: NW, lineBreak: false });
  }
  if (scoreBlue) {
    doc.fontSize(7).fillColor(blueWon ? "#D4AF37" : "#999999")
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

  const locale = tournament.primaryLocale ?? "ru";

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

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Шапка
    doc.fontSize(22).fillColor("#0B1426").text(localize(tournament.name, locale), { align: "center" });
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor("#666");
    doc.text(`${tournament.location}, ${tournament.city}`, { align: "center" });
    doc.text(dateRange(tournament.startDate, tournament.endDate, locale), { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#999").text(
      locale === "en" ? "Official Final Protocol"
      : locale === "kk" ? "Ресми қорытынды хаттама"
      : "Официальный итоговый протокол",
      { align: "center" },
    );
    doc.moveDown(2);

    // По каждой категории — медалисты
    for (const category of tournament.categories) {
      const entries = (byCategory.get(category.id) || []).filter((e) => e.place <= 5);
      if (entries.length === 0) continue;

      const catName = localize(category.name, locale) ||
        `${category.gender} ${category.weightMin}-${category.weightMax} кг`;
      doc.fontSize(14).fillColor("#0B1426").text(catName);
      doc.moveDown(0.3);

      doc.fontSize(11).fillColor("#333");
      for (const e of entries) {
        const medal = e.place === 1 ? "🥇" : e.place === 2 ? "🥈" : e.place === 3 ? "🥉" : `${e.place}.`;
        const athleteName = `${e.athlete.name} ${e.athlete.surname}`;
        const club = e.athlete.club ? localize(e.athlete.club.name, locale) : "—";
        const pts = `${Number(e.points)} ${locale === "en" ? "pts" : "очк."}`;
        doc.text(`  ${medal}  ${athleteName}  (${club})   —   ${pts}`);
      }
      doc.moveDown(0.8);
    }

    // Подвал
    doc.moveDown(2);
    doc.fontSize(9).fillColor("#999")
      .text(`Generated: ${new Date().toLocaleString()}  |  Judo-Arena`, { align: "center" });

    doc.end();
  });
}

// ============================================================
// PDF ДИПЛОМА (индивидуальный, после COMPLETED)
// ============================================================

export async function generateDiplomaPdf(
  athleteId: string,
  tournamentId: string,
  categoryId: string,
): Promise<Buffer> {
  const entry = await prisma.ratingEntry.findFirst({
    where: { athleteId, tournamentId, categoryId },
    include: {
      athlete: { include: { club: true } },
      tournament: true,
      category: true,
    },
  });
  if (!entry) throw new PdfError("ENTRY_NOT_FOUND", "Запись рейтинга не найдена", 404);
  if (entry.tournament.status !== "COMPLETED") {
    throw new PdfError("NOT_COMPLETED", "Диплом доступен только для завершённых турниров", 409);
  }

  const locale: Locale = (entry.tournament.primaryLocale as Locale) ?? "ru";

  const placeLabel =
    entry.place === 1
      ? locale === "kk" ? "I орын" : locale === "en" ? "1st Place" : "I место"
      : entry.place === 2
      ? locale === "kk" ? "II орын" : locale === "en" ? "2nd Place" : "II место"
      : entry.place === 3
      ? locale === "kk" ? "III орын" : locale === "en" ? "3rd Place" : "III место"
      : `${entry.place} ${locale === "kk" ? "орын" : locale === "en" ? "place" : "место"}`;

  const athleteName = `${entry.athlete.name} ${entry.athlete.surname}`;
  const clubName = entry.athlete.club ? localize(entry.athlete.club.name, locale) : "";
  const catName = localize(entry.category.name, locale) ||
    `${entry.category.gender} ${entry.category.weightMin}–${entry.category.weightMax} кг`;
  const tourName = localize(entry.tournament.name, locale);
  const tourDate = dateRange(entry.tournament.startDate, entry.tournament.endDate, locale);

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 60, layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    let y = 80;

    // Border
    doc.rect(30, 30, W - 60, doc.page.height - 60).lineWidth(3).strokeColor("#D4AF37").stroke();
    doc.rect(38, 38, W - 76, doc.page.height - 76).lineWidth(1).strokeColor("#D4AF37").stroke();

    // Header label
    doc.fontSize(13).fillColor("#888")
      .text(locale === "kk" ? "ДИПЛОМ" : locale === "en" ? "DIPLOMA" : "ДИПЛОМ", 0, y, { align: "center", width: W });
    y += 40;

    // Tournament name
    doc.fontSize(20).fillColor("#0B1426")
      .text(tourName, 0, y, { align: "center", width: W });
    y += 36;

    // Date & location
    doc.fontSize(12).fillColor("#555")
      .text(`${entry.tournament.city}  ·  ${tourDate}`, 0, y, { align: "center", width: W });
    y += 50;

    // Athlete name
    doc.fontSize(30).fillColor("#0B1426")
      .text(athleteName, 0, y, { align: "center", width: W });
    y += 44;

    // Club
    if (clubName) {
      doc.fontSize(14).fillColor("#444")
        .text(clubName, 0, y, { align: "center", width: W });
      y += 28;
    }

    // Category
    doc.fontSize(15).fillColor("#333")
      .text(catName, 0, y, { align: "center", width: W });
    y += 50;

    // Place
    const placeColor = entry.place === 1 ? "#D4AF37" : entry.place === 2 ? "#B0B0B0" : entry.place === 3 ? "#CD7F32" : "#333";
    doc.fontSize(36).fillColor(placeColor)
      .text(placeLabel, 0, y, { align: "center", width: W });
    y += 56;

    // Points
    doc.fontSize(13).fillColor("#666")
      .text(
        `${Number(entry.points)} ${locale === "en" ? "rating pts" : locale === "kk" ? "рейтинг ұпайы" : "рейтинговых очков"}`,
        0, y, { align: "center", width: W }
      );

    // Footer
    doc.fontSize(9).fillColor("#bbb")
      .text(`Judo-Arena  ·  ${new Date().toLocaleDateString()}`, 0, doc.page.height - 55, { align: "center", width: W });

    doc.end();
  });
}
