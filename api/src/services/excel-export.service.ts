/**
 * Export tournament results as a standards-compliant XLSX workbook.
 *
 * The workbook contains participants, results and completed matches. XLSX is
 * an Open XML ZIP package, so we generate the small set of XML parts directly
 * instead of depending on a full spreadsheet runtime.
 */

import JSZip from "jszip";
import { prisma } from "../lib/prisma.js";

type CellValue = string | number | null | undefined;

interface SheetRow {
  values: CellValue[];
  style?: number;
  boldColumn?: number;
}

interface SheetSpec {
  name: string;
  title: string;
  headers: string[];
  widths: number[];
  rows: SheetRow[];
  autoFilter?: boolean;
}

function locStr(value: unknown, locale: "kk" | "ru" = "kk"): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const obj = value as Record<string, string>;
  return obj[locale] ?? obj["ru"] ?? obj["kk"] ?? obj["en"] ?? "";
}

function catLabel(
  gender: string,
  ageMin: number,
  ageMax: number,
  weightMin: number,
  weightMax: number,
): string {
  const genderLabel = gender === "MALE" ? "Ер" : "Әйел";
  const weight = weightMax >= 200 ? `+${weightMin}` : `-${weightMax}`;
  return `${genderLabel} ${weight} кг (${ageMin}–${ageMax} жас)`;
}

function placeLabel(place: number): string {
  if (place === 1) return "🥇 1";
  if (place === 2) return "🥈 2";
  if (place === 3) return "🥉 3";
  return String(place);
}

export async function exportTournamentExcel(
  tournamentId: string,
): Promise<Buffer> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      categories: {
        orderBy: [{ gender: "asc" }, { ageMin: "asc" }, { weightMin: "asc" }],
      },
    },
  });
  if (!tournament) throw new Error("Турнир не найден");

  const entries = await prisma.applicationEntry.findMany({
    where: {
      application: { tournamentId, status: "APPROVED" },
    },
    include: {
      athlete: {
        select: {
          name: true,
          surname: true,
          nameLatin: true,
          surnameLatin: true,
          gender: true,
          weightKg: true,
          dateOfBirth: true,
          beltRank: true,
          club: { select: { name: true, city: true, shortName: true } },
        },
      },
      category: {
        select: {
          gender: true,
          ageMin: true,
          ageMax: true,
          weightMin: true,
          weightMax: true,
        },
      },
    },
    orderBy: [
      { category: { gender: "asc" } },
      { category: { weightMin: "asc" } },
      { athlete: { surname: "asc" } },
    ],
  });

  const ratingEntries = await prisma.ratingEntry.findMany({
    where: { tournamentId },
    include: {
      athlete: {
        select: {
          name: true,
          surname: true,
          nameLatin: true,
          surnameLatin: true,
          club: { select: { name: true, city: true } },
        },
      },
      category: {
        select: {
          gender: true,
          ageMin: true,
          ageMax: true,
          weightMin: true,
          weightMax: true,
        },
      },
    },
    orderBy: [
      { category: { gender: "asc" } },
      { category: { weightMin: "asc" } },
      { place: "asc" },
    ],
  });

  const matches = await prisma.match.findMany({
    where: { tournamentId, status: "COMPLETED" },
    include: {
      redAthlete: {
        select: {
          name: true,
          surname: true,
          club: { select: { shortName: true, name: true } },
        },
      },
      blueAthlete: {
        select: {
          name: true,
          surname: true,
          club: { select: { shortName: true, name: true } },
        },
      },
      winner: { select: { name: true, surname: true } },
      bracket: {
        include: {
          category: {
            select: {
              gender: true,
              ageMin: true,
              ageMax: true,
              weightMin: true,
              weightMax: true,
            },
          },
        },
      },
    },
    orderBy: [
      { bracket: { category: { gender: "asc" } } },
      { round: "asc" },
      { position: "asc" },
    ],
  });

  const tournamentName = locStr(tournament.name);
  const tournamentDate = tournament.startDate.toLocaleDateString("kk-KZ");

  const participantRows: SheetRow[] = entries.map((entry, index) => ({
    style: index % 2 === 0 ? 3 : 4,
    values: [
      index + 1,
      entry.athlete.surname,
      entry.athlete.name,
      [entry.athlete.surnameLatin, entry.athlete.nameLatin]
        .filter(Boolean)
        .join(" "),
      entry.athlete.gender === "MALE" ? "Ер / М" : "Әйел / Ж",
      entry.athlete.dateOfBirth?.toLocaleDateString("kk-KZ") ?? "",
      entry.athlete.weightKg ?? "",
      catLabel(
        entry.category.gender,
        entry.category.ageMin,
        entry.category.ageMax,
        entry.category.weightMin,
        entry.category.weightMax,
      ),
      locStr(entry.athlete.club?.name),
      entry.athlete.club?.city ?? "",
      entry.athlete.beltRank ?? "",
      entry.weighInStatus === "PASSED"
        ? "✓ Өтті"
        : entry.weighInStatus === "PENDING"
          ? "Күтеді"
          : entry.weighInStatus,
    ],
  }));

  const resultRows: SheetRow[] = ratingEntries.map((entry, index) => ({
    style:
      entry.place === 1
        ? 5
        : entry.place === 2
          ? 6
          : entry.place === 3
            ? 7
            : index % 2 === 0
              ? 3
              : 4,
    values: [
      placeLabel(entry.place),
      entry.athlete.surname,
      entry.athlete.name,
      [entry.athlete.surnameLatin, entry.athlete.nameLatin]
        .filter(Boolean)
        .join(" "),
      catLabel(
        entry.category.gender,
        entry.category.ageMin,
        entry.category.ageMax,
        entry.category.weightMin,
        entry.category.weightMax,
      ),
      locStr(entry.athlete.club?.name),
      entry.athlete.club?.city ?? "",
      Number(entry.points),
    ],
  }));
  if (resultRows.length === 0) {
    resultRows.push({
      values: ["", "Нәтижелер жоқ (турнир аяқталмаған)"],
      style: 3,
    });
  }

  const matchRows: SheetRow[] = matches.map((match, index) => {
    const winner = match.winner
      ? `${match.winner.surname} ${match.winner.name}`
      : "—";
    return {
      style: index % 2 === 0 ? 3 : 4,
      boldColumn:
        match.winnerId && match.winnerId === match.redAthleteId
          ? 3
          : match.winnerId && match.winnerId === match.blueAthleteId
            ? 5
            : undefined,
      values: [
        match.bracket?.category
          ? catLabel(
              match.bracket.category.gender,
              match.bracket.category.ageMin,
              match.bracket.category.ageMax,
              match.bracket.category.weightMin,
              match.bracket.category.weightMax,
            )
          : "",
        match.bracketSection ?? "",
        match.redAthlete
          ? `${match.redAthlete.surname} ${match.redAthlete.name}`
          : "BYE",
        locStr(match.redAthlete?.club?.name),
        match.blueAthlete
          ? `${match.blueAthlete.surname} ${match.blueAthlete.name}`
          : "BYE",
        locStr(match.blueAthlete?.club?.name),
        winner,
        match.isGoldenScore ? "✓ GS" : "",
      ],
    };
  });

  return buildWorkbook(tournamentName, [
    {
      name: "Қатысушылар",
      title: `${tournamentName} — ${tournamentDate} | Қатысушылар тізімі`,
      headers: [
        "#",
        "Тегі / Фамилия",
        "Аты / Имя",
        "Latin",
        "Жыны / Пол",
        "Туылған / Дата рождения",
        "Нақты вес, кг",
        "Санат / Категория",
        "Клуб",
        "Қала / Город",
        "Белдік / Пояс",
        "Таразылау",
      ],
      widths: [5, 20, 16, 22, 10, 14, 12, 24, 22, 14, 12, 12],
      rows: participantRows,
      autoFilter: true,
    },
    {
      name: "Нәтижелер",
      title: `${tournamentName} — ${tournamentDate} | Нәтижелер`,
      headers: [
        "Орын / Место",
        "Тегі / Фамилия",
        "Аты / Имя",
        "Latin",
        "Санат",
        "Клуб",
        "Қала",
        "Балл / Очки",
      ],
      widths: [12, 20, 16, 22, 24, 22, 14, 10],
      rows: resultRows,
    },
    {
      name: "Матчтар",
      title: `${tournamentName} — ${tournamentDate} | Матчтар тізімі`,
      headers: [
        "Санат",
        "Кезең",
        "Ақ / Красный",
        "Клуб (Ақ)",
        "Көк / Синий",
        "Клуб (Көк)",
        "Жеңімпаз / Победитель",
        "Golden Score",
      ],
      widths: [22, 12, 22, 16, 22, 16, 22, 10],
      rows: matchRows,
    },
  ]);
}

async function buildWorkbook(
  title: string,
  sheets: SheetSpec[],
): Promise<Buffer> {
  const zip = new JSZip();
  const createdAt = new Date().toISOString();

  zip.file("[Content_Types].xml", contentTypesXml(sheets.length));
  zip.file("_rels/.rels", rootRelationshipsXml());
  zip.file("docProps/app.xml", appPropertiesXml(sheets));
  zip.file("docProps/core.xml", corePropertiesXml(title, createdAt));
  zip.file("xl/workbook.xml", workbookXml(sheets));
  zip.file(
    "xl/_rels/workbook.xml.rels",
    workbookRelationshipsXml(sheets.length),
  );
  zip.file("xl/styles.xml", stylesXml());
  sheets.forEach((sheet, index) => {
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(sheet));
  });

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

function worksheetXml(sheet: SheetSpec): string {
  const lastColumn = columnName(sheet.headers.length);
  const lastRow = Math.max(2, sheet.rows.length + 2);
  const columns = sheet.widths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
    )
    .join("");
  const titleRow = `<row r="1" ht="22" customHeight="1">${cellXml(sheet.title, "A1", 1)}</row>`;
  const headerRow = `<row r="2" ht="28" customHeight="1">${sheet.headers
    .map((header, index) => cellXml(header, `${columnName(index + 1)}2`, 2))
    .join("")}</row>`;
  const dataRows = sheet.rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 3;
      const baseStyle = row.style ?? (rowIndex % 2 === 0 ? 3 : 4);
      const cells = row.values
        .map((value, columnIndex) => {
          const column = columnIndex + 1;
          const style =
            row.boldColumn === column ? (baseStyle === 4 ? 9 : 8) : baseStyle;
          return cellXml(value, `${columnName(column)}${rowNumber}`, style);
        })
        .join("");
      return `<row r="${rowNumber}" ht="18" customHeight="1">${cells}</row>`;
    })
    .join("");
  const autoFilter = sheet.autoFilter
    ? `<autoFilter ref="A2:${lastColumn}${lastRow}"/>`
    : "";

  return xml(
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<dimension ref="A1:${lastColumn}${lastRow}"/>` +
      `<sheetViews><sheetView workbookViewId="0"/></sheetViews>` +
      `<sheetFormatPr defaultRowHeight="15"/>` +
      `<cols>${columns}</cols>` +
      `<sheetData>${titleRow}${headerRow}${dataRows}</sheetData>` +
      `<mergeCells count="1"><mergeCell ref="A1:${lastColumn}1"/></mergeCells>` +
      autoFilter +
      `<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>` +
      `</worksheet>`,
  );
}

function cellXml(value: CellValue, reference: string, style: number): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  }
  const text = value == null ? "" : String(value);
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function columnName(index: number): string {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function contentTypesXml(sheetCount: number): string {
  const sheets = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");
  return xml(
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
      `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
      sheets +
      `</Types>`,
  );
}

function rootRelationshipsXml(): string {
  return xml(
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
      `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
      `</Relationships>`,
  );
}

function workbookXml(sheets: SheetSpec[]): string {
  const sheetNodes = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");
  return xml(
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<bookViews><workbookView/></bookViews><sheets>${sheetNodes}</sheets>` +
      `<calcPr calcId="191029"/></workbook>`,
  );
}

function workbookRelationshipsXml(sheetCount: number): string {
  const sheetRelations = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");
  return xml(
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      sheetRelations +
      `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`,
  );
}

function appPropertiesXml(sheets: SheetSpec[]): string {
  const titles = sheets
    .map((sheet) => `<vt:lpstr>${escapeXml(sheet.name)}</vt:lpstr>`)
    .join("");
  return xml(
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
      `<Application>Judo-Arena</Application>` +
      `<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheets.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>` +
      `<TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${titles}</vt:vector></TitlesOfParts>` +
      `</Properties>`,
  );
}

function corePropertiesXml(title: string, createdAt: string): string {
  return xml(
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `<dc:creator>Judo-Arena</dc:creator><dc:title>${escapeXml(title)}</dc:title>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>` +
      `</cp:coreProperties>`,
  );
}

function stylesXml(): string {
  return xml(
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts>` +
      `<fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
      fill("D4AF37") +
      fill("FFF8DC") +
      fill("F9F9F9") +
      fill("FFF9C4") +
      fill("F5F5F5") +
      fill("FFF3E0") +
      `</fills>` +
      `<borders count="2"><border/><border><left/><right/><top/><bottom style="thin"><color rgb="FF999999"/></bottom><diagonal/></border></borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="10">` +
      `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
      `<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
      `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` +
      bodyStyle(0, 0) +
      bodyStyle(0, 4) +
      bodyStyle(0, 5) +
      bodyStyle(0, 6) +
      bodyStyle(0, 7) +
      bodyStyle(1, 0) +
      bodyStyle(1, 4) +
      `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
      `</styleSheet>`,
  );
}

function fill(color: string): string {
  return `<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`;
}

function bodyStyle(fontId: number, fillId: number): string {
  return `<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0" applyFont="${fontId ? 1 : 0}" applyFill="${fillId ? 1 : 0}" applyAlignment="1"><alignment vertical="center"/></xf>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xml(content: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${content}`;
}
