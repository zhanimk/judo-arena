/**
 * pdf-certificate.service.ts — генерация PDF-сертификатов победителям.
 *
 * Сертификат содержит:
 *   - Имя спортсмена (крупно)
 *   - Место (🥇 / 🥈 / 🥉 или числом)
 *   - Название турнира
 *   - Весовая категория и возраст
 *   - Дата проведения
 *   - Подпись "Judo-Arena"
 *
 * Стиль: A5 landscape, тёмно-синий фон с золотыми акцентами.
 */

import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma.js";
import { registerFonts, localize } from "./pdf-bracket.service.js";

export class CertificateError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
    this.name = "CertificateError";
  }
}

function placeLabel(place: number): string {
  if (place === 1) return "1 ОРЫН / 1 МЕСТО";
  if (place === 2) return "2 ОРЫН / 2 МЕСТО";
  if (place === 3) return "3 ОРЫН / 3 МЕСТО";
  return `${place} ОРЫН`;
}

function placeColor(place: number): string {
  if (place === 1) return "#D4AF37"; // gold
  if (place === 2) return "#C0C0C0"; // silver
  if (place === 3) return "#CD7F32"; // bronze
  return "#6B8AB0";
}

function categoryLabel(
  gender: string,
  ageMin: number,
  ageMax: number,
  weightMin: number,
  weightMax: number,
): string {
  const g = gender === "MALE" ? "Ер / Мужчины" : "Әйел / Женщины";
  const w = weightMax >= 200 ? `+${weightMin} кг` : `до ${weightMax} кг`;
  return `${g}  ·  ${w}  ·  ${ageMin}–${ageMax} жас`;
}

export async function generateCertificate(
  athleteId: string,
  tournamentId: string,
): Promise<Buffer> {
  // Подгружаем данные
  const entry = await prisma.ratingEntry.findFirst({
    where: { athleteId, tournamentId },
    include: {
      athlete: {
        select: {
          name: true,
          surname: true,
          nameLatin: true,
          surnameLatin: true,
          club: { select: { name: true, shortName: true } },
        },
      },
      tournament: {
        select: { name: true, startDate: true, endDate: true, city: true, location: true },
      },
      category: {
        select: {
          gender: true, ageMin: true, ageMax: true, weightMin: true, weightMax: true,
        },
      },
    },
  });

  if (!entry) {
    throw new CertificateError(
      "ENTRY_NOT_FOUND",
      "Результат не найден. Убедитесь что турнир завершён.",
      404,
    );
  }

  const athlete = entry.athlete;
  const tournament = entry.tournament;
  const cat = entry.category;

  const athleteName = `${athlete.surname} ${athlete.name}`;
  const athleteNameLatin =
    athlete.surnameLatin && athlete.nameLatin
      ? `${athlete.surnameLatin} ${athlete.nameLatin}`
      : "";
  const clubName = localize(athlete.club?.name, "kk") || "";
  const tName = localize(tournament.name, "kk");
  const tDate = new Date(tournament.startDate).toLocaleDateString("kk-KZ", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const place = entry.place;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A5",
      layout: "landscape",
      margin: 0,
      info: {
        Title: `Сертификат — ${athleteName}`,
        Author: "Judo-Arena",
        Subject: tName,
      },
    });

    const fonts = registerFonts(doc);
    const W = doc.page.width;   // 595 pts (A5 landscape)
    const H = doc.page.height;  // 420 pts

    const GOLD  = "#D4AF37";
    const NAVY  = "#0B1426";
    const WHITE = "#FFFFFF";
    const LIGHT = "#E8EFF8";

    // ── Фон ──────────────────────────────────────────────────
    doc.rect(0, 0, W, H).fill(NAVY);

    // Декоративная рамка
    const brd = 14;
    doc.rect(brd, brd, W - brd * 2, H - brd * 2)
      .lineWidth(2)
      .strokeColor(GOLD)
      .stroke();

    // Внутренняя тонкая линия
    const brd2 = 18;
    doc.rect(brd2, brd2, W - brd2 * 2, H - brd2 * 2)
      .lineWidth(0.5)
      .strokeColor(GOLD)
      .stroke();

    // Угловые украшения
    [[brd, brd], [W - brd, brd], [brd, H - brd], [W - brd, H - brd]].forEach(([cx, cy]) => {
      doc.circle(cx!, cy!, 4).fill(GOLD);
    });

    // ── Заголовок "СЕРТИФИКАТ" ────────────────────────────────
    doc.font(fonts.bold)
      .fontSize(11)
      .fillColor(GOLD)
      .text("СЕРТИФИКАТ / КУӘЛІК", 0, 30, {
        width: W,
        align: "center",
        characterSpacing: 4,
      });

    // Горизонтальная линия под заголовком
    doc.moveTo(60, 52).lineTo(W - 60, 52).lineWidth(0.8).strokeColor(GOLD).stroke();

    // ── Место (большой золотой текст) ─────────────────────────
    const pColor = placeColor(place);
    const pLabel = placeLabel(place);
    doc.font(fonts.bold)
      .fontSize(28)
      .fillColor(pColor)
      .text(pLabel, 0, 60, {
        width: W,
        align: "center",
        characterSpacing: 2,
      });

    // ── Имя спортсмена ────────────────────────────────────────
    doc.font(fonts.bold)
      .fontSize(32)
      .fillColor(WHITE)
      .text(athleteName.toUpperCase(), 0, 102, {
        width: W,
        align: "center",
        characterSpacing: 1,
      });

    if (athleteNameLatin) {
      doc.font(fonts.regular)
        .fontSize(13)
        .fillColor(LIGHT)
        .text(athleteNameLatin, 0, 142, {
          width: W,
          align: "center",
        });
    }

    if (clubName) {
      doc.font(fonts.regular)
        .fontSize(10)
        .fillColor(GOLD)
        .text(clubName, 0, 162, {
          width: W,
          align: "center",
        });
    }

    // Разделитель
    const midY = 185;
    doc.moveTo(80, midY).lineTo(W - 80, midY)
      .lineWidth(0.5)
      .strokeColor(GOLD)
      .stroke();

    // ── Турнир и категория ────────────────────────────────────
    doc.font(fonts.bold)
      .fontSize(12)
      .fillColor(WHITE)
      .text(tName, 0, midY + 10, {
        width: W,
        align: "center",
      });

    doc.font(fonts.regular)
      .fontSize(9)
      .fillColor(LIGHT)
      .text(
        categoryLabel(cat.gender, cat.ageMin, cat.ageMax, cat.weightMin, cat.weightMax),
        0, midY + 30,
        { width: W, align: "center" },
      );

    // ── Дата и место проведения ───────────────────────────────
    doc.font(fonts.regular)
      .fontSize(9)
      .fillColor(LIGHT)
      .text(`${tDate}  ·  ${tournament.city}`, 0, midY + 48, {
        width: W,
        align: "center",
      });

    // ── Нижняя полоса "Judo-Arena" ─────────────────────────────
    doc.rect(0, H - 38, W, 38).fill(GOLD);
    doc.font(fonts.bold)
      .fontSize(14)
      .fillColor(NAVY)
      .text("JUDO-ARENA", 0, H - 27, {
        width: W,
        align: "center",
        characterSpacing: 5,
      });

    // ── Рендеринг ─────────────────────────────────────────────
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
