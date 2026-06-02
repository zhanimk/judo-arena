/**
 * pdf-protocol.service.ts — итоговый протокол турнира (PDF).
 *
 * Генерирует официальный протокол по завершённому турниру:
 *   - Медалисты по каждой категории (1-5 место)
 *   - Приложение: сетки всех категорий
 *
 * Требует: tournament.status === "COMPLETED"
 */

import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma.js";
import { BracketFormat, type Locale } from "@prisma/client";
import {
  PdfError,
  registerFonts,
  localize,
  dateRange,
  placeEmoji,
  pdfAthleteFullDisplayName,
  drawBracketOnePage,
} from "./pdf-bracket.service.js";

export async function generateTournamentProtocolPdf(
  tournamentId: string,
): Promise<Buffer> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      categories: { orderBy: [{ gender: "asc" }, { weightMin: "asc" }] },
    },
  });
  if (!tournament)
    throw new PdfError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
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
        orderBy: [
          { bracketSection: "asc" },
          { round: "asc" },
          { position: "asc" },
        ],
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
    doc
      .font(fonts.bold)
      .fontSize(20)
      .fillColor("#0B1426")
      .text(localize(tournament.name, locale), { align: "center" });
    doc.moveDown(0.4);
    doc
      .font(fonts.regular)
      .fontSize(11)
      .fillColor("#555555")
      .text(`${tournament.location}, ${tournament.city}`, { align: "center" });
    doc
      .font(fonts.regular)
      .fontSize(10)
      .fillColor("#777777")
      .text(dateRange(tournament.startDate, tournament.endDate, locale), {
        align: "center",
      });
    doc.moveDown(0.4);
    doc
      .font(fonts.bold)
      .fontSize(10)
      .fillColor("#888888")
      .text(
        locale === "en"
          ? "Official Final Protocol"
          : locale === "kk"
            ? "Ресми қорытынды хаттама"
            : "Официальный итоговый протокол",
        { align: "center" },
      );

    // Разделитель
    const lineY = doc.y + 8;
    doc
      .moveTo(50, lineY)
      .lineTo(doc.page.width - 50, lineY)
      .lineWidth(1)
      .strokeColor("#D4AF37")
      .stroke();
    doc.moveDown(1.5);

    // ── Медалисты по категориям ───────────────────────────────
    for (const category of tournament.categories) {
      const entries = (byCategory.get(category.id) || []).filter(
        (e) => e.place <= 5,
      );
      if (entries.length === 0) continue;

      const catName =
        localize(category.name, locale) ||
        `${category.gender} ${category.weightMin}–${category.weightMax} кг`;

      doc.font(fonts.bold).fontSize(13).fillColor("#0B1426").text(catName);
      doc.moveDown(0.25);

      for (const e of entries) {
        const medal = placeEmoji(e.place);
        const athleteName = pdfAthleteFullDisplayName(e.athlete);
        const club = e.athlete.club
          ? localize(e.athlete.club.name, locale)
          : "—";
        const pts = `${Number(e.points)} ${locale === "en" ? "pts" : locale === "kk" ? "ұпай" : "очк."}`;

        const rowColor =
          e.place === 1
            ? "#92660A"
            : e.place === 2
              ? "#555555"
              : e.place === 3
                ? "#7C4D1E"
                : "#333333";

        doc
          .font(fonts.bold)
          .fontSize(10)
          .fillColor(rowColor)
          .text(`${medal}  ${athleteName}`, { continued: true });
        doc
          .font(fonts.regular)
          .fontSize(10)
          .fillColor("#666666")
          .text(`   ${club}`, { continued: true });
        doc
          .font(fonts.bold)
          .fontSize(10)
          .fillColor("#D4AF37")
          .text(`   ${pts}`);
      }
      doc.moveDown(0.7);

      if (doc.y > doc.page.height - 120) {
        doc.addPage();
      }
    }

    // ── Подвал ────────────────────────────────────────────────
    doc.moveDown(2);
    doc
      .font(fonts.regular)
      .fontSize(8)
      .fillColor("#AAAAAA")
      .text(`Judo-Arena  ·  ${new Date().toLocaleString()}`, {
        align: "center",
      });

    // ── Приложение: сетки категорий ───────────────────────────
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
