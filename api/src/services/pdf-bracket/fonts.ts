/**
 * PDF-bracket — регистрация шрифтов.
 * Поддерживает ArialUnicode (кириллица + казахские символы).
 * Fallback на Helvetica если шрифт не установлен.
 */

import path from "path";
import fs from "fs";

const FONT_PATH = path.resolve(process.cwd(), "src/assets/fonts/ArialUnicode.ttf");
const FONT_BOLD_PATH = path.resolve(process.cwd(), "src/assets/fonts/ArialUnicodeBold.ttf");

export interface RegisteredFonts {
  regular: string;
  bold: string;
}

/** Регистрирует шрифт в PDF-документе и возвращает имена для использования. */
export function registerFonts(doc: PDFKit.PDFDocument): RegisteredFonts {
  const hasFont = fs.existsSync(FONT_PATH);
  if (hasFont) {
    doc.registerFont("Unicode", FONT_PATH);
    const hasBold = fs.existsSync(FONT_BOLD_PATH);
    doc.registerFont("UnicodeBold", hasBold ? FONT_BOLD_PATH : FONT_PATH);
    return { regular: "Unicode", bold: "UnicodeBold" };
  }
  // Fallback — Helvetica не поддерживает кириллицу, но не роняет процесс
  return { regular: "Helvetica", bold: "Helvetica-Bold" };
}
