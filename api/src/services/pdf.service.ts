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

  const locale = bracket.tournament.primaryLocale;
  const isRR = bracket.format === BracketFormat.ROUND_ROBIN;

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // --- Шапка ---
    doc.fontSize(20).fillColor("#0B1426").text(localize(bracket.tournament.name, locale), { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(11).fillColor("#666");
    doc.text(`${bracket.tournament.location}, ${bracket.tournament.city}`, { align: "center" });
    doc.text(dateRange(bracket.tournament.startDate, bracket.tournament.endDate, locale), { align: "center" });
    doc.moveDown(1);

    // Категория
    const catName = localize(bracket.category.name, locale) ||
      `${bracket.category.gender} ${bracket.category.weightMin}-${bracket.category.weightMax} кг`;
    doc.fontSize(16).fillColor("#0B1426").text(catName, { align: "center" });
    doc.fontSize(10).fillColor("#999").text(
      `${locale === "en" ? "Format" : locale === "kk" ? "Форматы" : "Формат"}: ${
        isRR ? (locale === "en" ? "Round-Robin" : "Круговая система")
             : "Single Elimination + Repechage"
      }  |  ${bracket.matches.length} ${locale === "en" ? "matches" : "матчей"}`,
      { align: "center" },
    );
    doc.moveDown(1.5);

    // --- Матчи ---
    if (isRR) {
      // Round-Robin: один общий список по турам
      const byRound = groupBy(bracket.matches, "round");
      for (const [round, ms] of byRound) {
        doc.fontSize(12).fillColor("#D4AF37").text(`${locale === "en" ? "Round" : "Тур"} ${round}`);
        doc.moveDown(0.3);
        for (const m of ms) drawMatchLine(doc, m, locale);
        doc.moveDown(0.5);
      }
    } else {
      // Single Elimination: группы по bracketSection
      const sections = ["main", "repechage", "bronze1", "bronze2", "final"];
      for (const sec of sections) {
        const matchesInSec = bracket.matches.filter((m) => m.bracketSection === sec);
        if (matchesInSec.length === 0) continue;
        const title = SECTION_NAMES[sec]?.[locale] ?? sec;
        doc.fontSize(13).fillColor("#D4AF37").text("─ " + title + " ─");
        doc.moveDown(0.3);
        const byRound = groupBy(matchesInSec, "round");
        for (const [round, ms] of byRound) {
          if (sec === "main") {
            doc.fontSize(11).fillColor("#666").text(`${locale === "en" ? "Round" : "Раунд"} ${round}`);
          }
          for (const m of ms) drawMatchLine(doc, m, locale);
        }
        doc.moveDown(0.8);
      }
    }

    // Подвал
    doc.moveDown(1);
    doc.fontSize(8).fillColor("#999")
      .text(`Generated: ${new Date().toLocaleString()}  |  Judo-Arena`, { align: "center" });

    doc.end();
  });
}

function groupBy<T extends Record<string, any>>(items: T[], key: keyof T): Map<any, T[]> {
  const map = new Map<any, T[]>();
  for (const it of items) {
    const k = it[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return new Map(Array.from(map.entries()).sort((a, b) => (a[0] > b[0] ? 1 : -1)));
}

function drawMatchLine(doc: PDFKit.PDFDocument, m: any, locale: Locale): void {
  const red = m.redAthlete
    ? `${m.redAthlete.name} ${m.redAthlete.surname}` +
      (m.redAthlete.club ? ` (${localize(m.redAthlete.club.name, locale)})` : "")
    : "— TBD —";
  const blue = m.blueAthlete
    ? `${m.blueAthlete.name} ${m.blueAthlete.surname}` +
      (m.blueAthlete.club ? ` (${localize(m.blueAthlete.club.name, locale)})` : "")
    : "— TBD —";
  const tatami = m.tatamiNumber ? `Татами ${m.tatamiNumber}` : "";
  doc.fontSize(10).fillColor("#333")
    .text(`  ${red}   vs   ${blue}${tatami ? "   · " + tatami : ""}`);
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

  const locale = tournament.primaryLocale;

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
