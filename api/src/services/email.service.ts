/**
 * Email-сервис.
 *
 * Prod: Resend SDK (RESEND_API_KEY задан в .env)
 * Dev:  Mailpit через nodemailer SMTP (localhost:1025 → http://localhost:8025)
 */

import { env } from "../lib/env.js";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

// ============================================================
// Отправка
// ============================================================

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (env.RESEND_API_KEY) {
    await sendViaResend(payload);
  } else {
    await sendViaSMTP(payload);
  }
}

async function sendViaResend(payload: EmailPayload): Promise<void> {
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    if (error) {
      process.stderr.write(`[email/resend] Ошибка: ${JSON.stringify(error)}\n`);
    }
  } catch (err) {
    process.stderr.write(`[email/resend] Не удалось отправить: ${(err as Error).message}\n`);
  }
}

async function sendViaSMTP(payload: EmailPayload): Promise<void> {
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
    });
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: htmlToText(payload.html),
    });
  } catch (err) {
    process.stderr.write(`[email/smtp] Не удалось отправить на ${payload.to}: ${(err as Error).message}\n`);
  }
}

// ============================================================
// Startup health check
// ============================================================

export async function verifySmtpConnection(): Promise<void> {
  if (env.RESEND_API_KEY) {
    process.stdout.write(`✅ Email provider: Resend (from: ${env.EMAIL_FROM})\n`);
    return;
  }
  try {
    const nodemailer = await import("nodemailer");
    const t = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
    await t.verify();
    process.stdout.write(`✅ Email provider: SMTP ${env.SMTP_HOST}:${env.SMTP_PORT}\n`);
  } catch (err) {
    process.stderr.write(`⚠️  Email недоступен (${env.SMTP_HOST}:${env.SMTP_PORT}): ${(err as Error).message}\n`);
    process.stderr.write(`   → Задай RESEND_API_KEY в .env для production.\n`);
  }
}

// ============================================================
// Утилиты
// ============================================================

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim();
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;background:linear-gradient(135deg,#c9a227,#f0c040);border-radius:12px;padding:14px 20px">
          <span style="font-size:28px">🔑</span>
        </div>
      </div>
      <h2 style="color:#1a1a2e;margin-top:0;text-align:center">Құпиясөзді қалпына келтіру</h2>
      <p style="color:#374151;text-align:center">Judo-Arena аккаунтыңыздың құпиясөзін өзгерту сұрауы түсті.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${resetUrl}"
          style="display:inline-block;background:linear-gradient(135deg,#c9a227,#f0c040);color:#1a1a2e;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.5px">
          Құпиясөзді өзгерту →
        </a>
      </div>
      <p style="color:#6b7280;font-size:13px;text-align:center;border-top:1px solid #f3f4f6;padding-top:16px;margin-top:16px">
        Сілтеме <b>1 сағат</b> бойы жарамды.<br>
        Егер сіз сұрамаған болсаңыз — бұл хатты елемеңіз.
      </p>
      <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:8px">
        Judo-Arena — Қазақстандық дзюдо турнирлер платформасы
      </p>
    </div>`;
}
