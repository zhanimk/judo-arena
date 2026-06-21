/**
 * SMS Service — Mobizon / Twilio Mock.
 *
 * Для отправки критических уведомлений (например, о переносе взвешивания).
 */

import { env } from "../lib/env.js";

export async function sendSms(
  phoneNumber: string,
  message: string,
): Promise<boolean> {
  // Mock SMS for dev
  if (!env.MOBIZON_API_KEY) {
    console.log(`\n========================================`);
    console.log(`[SMS MOCK] To: ${phoneNumber}`);
    console.log(`[SMS MOCK] Text: ${message}`);
    console.log(`========================================\n`);
    return true;
  }

  // Real implementation for Mobizon.kz
  try {
    const url = `https://api.mobizon.kz/service/message/sendsmsmessage?recipient=${encodeURIComponent(phoneNumber)}&text=${encodeURIComponent(message)}&apiKey=${env.MOBIZON_API_KEY}`;

    const resp = await fetch(url, { method: "GET" });
    const data = (await resp.json()) as { code: number; message?: string };

    if (data.code === 0) {
      return true;
    } else {
      console.error(`[SMS Error] Mobizon:`, data.message);
      return false;
    }
  } catch (error) {
    console.error(`[SMS Error] Network:`, error);
    return false;
  }
}
