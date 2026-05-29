/**
 * Email-сервис через Nodemailer.
 *
 * Dev:  Mailpit (localhost:1025) — уже поднят в docker-compose, письма видны на localhost:8025
 * Prod: SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS из .env
 *
 * Используется только для ключевых событий:
 *   • Одобрение / отклонение заявки клуба (AP1 / N1)
 */

import nodemailer from "nodemailer";
import { env } from "../lib/env.js";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  auth: env.SMTP_USER
    ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
    : undefined,
  secure: env.SMTP_PORT === 465,
});

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

/** Убирает HTML-теги для plain-text версии письма (важно для spam-фильтров) */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      // Отправляем оба формата — spam-фильтры штрафуют письма без text-части
      text: htmlToText(payload.html),
    });
  } catch (err) {
    // Email не должен ронять основной flow — логируем и продолжаем
    console.error("[email] Не удалось отправить письмо:", err);
  }
}

// ============================================================
// Шаблоны
// ============================================================

export function applicationApprovedHtml(tournamentName: string, reviewerNotes?: string): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
      <h2 style="color:#1a1a2e;margin-top:0">✅ Өтінім бекітілді</h2>
      <p style="color:#374151">Клубыңыздың <b>${escapeHtml(tournamentName)}</b> жарысына берген өтінімі бекітілді.</p>
      ${reviewerNotes ? `<blockquote style="border-left:4px solid #10b981;padding:8px 16px;color:#374151;background:#f0fdf4">${escapeHtml(reviewerNotes)}</blockquote>` : ""}
      <p style="color:#6b7280;font-size:13px;margin-top:24px">Judo-Arena — Қазақстандық дзюдо турнирлер платформасы</p>
    </div>`;
}

export function applicationRejectedHtml(tournamentName: string, reviewerNotes?: string): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
      <h2 style="color:#1a1a2e;margin-top:0">❌ Өтінімде түзету керек</h2>
      <p style="color:#374151"><b>${escapeHtml(tournamentName)}</b> жарысына берген өтінімде кемшілік анықталды.</p>
      ${reviewerNotes ? `<blockquote style="border-left:4px solid #ef4444;padding:8px 16px;color:#374151;background:#fef2f2">Себебі: ${escapeHtml(reviewerNotes)}</blockquote>` : ""}
      <p style="color:#374151">Заявканы түзетіп, қайта жіберіңіз.</p>
      <p style="color:#6b7280;font-size:13px;margin-top:24px">Judo-Arena — Қазақстандық дзюдо турнирлер платформасы</p>
    </div>`;
}

export function passwordResetHtml(resetUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
      <h2 style="color:#1a1a2e;margin-top:0">🔑 Құпиясөзді қалпына келтіру</h2>
      <p style="color:#374151">Judo-Arena аккаунтыңыздың құпиясөзін өзгерту сұрауы түсті.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#c9a227,#f0c040);color:#1a1a2e;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none">
          Құпиясөзді өзгерту
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">Сілтеме 1 сағат бойы жарамды. Егер сіз сұрамаған болсаңыз — бұл хатты елемеңіз.</p>
      <p style="color:#6b7280;font-size:13px;margin-top:24px">Judo-Arena — Қазақстандық дзюдо турнирлер платформасы</p>
    </div>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
