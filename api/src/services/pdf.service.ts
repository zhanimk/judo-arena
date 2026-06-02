/**
 * pdf.service.ts — barrel re-export для PDF-генерации.
 *
 * Код разбит на модули:
 *
 *   pdf-bracket.service.ts  — generateBracketPdf, generateAllBracketsPdf
 *                             + все private функции рисования (pdfDraw*, pdfMatch*, etc.)
 *   pdf-protocol.service.ts — generateTournamentProtocolPdf
 *
 * Внешний код (admin.routes.ts) продолжает импортировать из "pdf.service.js" без изменений.
 */

export {
  PdfError,
  generateBracketPdf,
  generateAllBracketsPdf,
} from "./pdf-bracket.service.js";
export { generateTournamentProtocolPdf } from "./pdf-protocol.service.js";
