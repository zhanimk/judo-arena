/**
 * Web Vitals мониторинг — отправка Core Web Vitals в Sentry.
 *
 * Метрики:
 *   LCP  — Largest Contentful Paint  (цель: < 2.5с)
 *   INP  — Interaction to Next Paint  (цель: < 200мс, заменяет FID)
 *   CLS  — Cumulative Layout Shift    (цель: < 0.1)
 *   FCP  — First Contentful Paint     (цель: < 1.8с)
 *   TTFB — Time To First Byte         (цель: < 800мс)
 *
 * Как использовать:
 *   import { initWebVitals } from "@/lib/web-vitals";
 *   // В root компоненте, один раз:
 *   useEffect(() => { initWebVitals(); }, []);
 */

import * as Sentry from "@sentry/react";

type VitalsReport = {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  id: string;
};

function sendToSentry(metric: VitalsReport) {
  Sentry.addBreadcrumb({
    category: "web-vitals",
    message: `${metric.name}: ${metric.value.toFixed(1)}`,
    level: "info",
    data: metric,
  });

  // Логируем плохие метрики как breadcrumb для debugging
  if (metric.rating === "poor") {
    Sentry.addBreadcrumb({
      category: "web-vitals",
      message: `${metric.name} is poor: ${metric.value.toFixed(0)}ms`,
      level: "warning",
      data: { name: metric.name, value: metric.value, rating: metric.rating, id: metric.id },
    });
  }

  if (import.meta.env.DEV) {
    const emoji = metric.rating === "good" ? "✅" : metric.rating === "needs-improvement" ? "⚠️" : "❌";
    console.log(`[WebVitals] ${emoji} ${metric.name}: ${metric.value.toFixed(1)}`);
  }
}

let initialized = false;

/**
 * Инициализирует Web Vitals репортинг.
 * Безопасно вызывать несколько раз — инициализируется только один раз.
 */
export async function initWebVitals(): Promise<void> {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  try {
    // Динамический импорт — не блокирует загрузку страницы
    const { onCLS, onINP, onFCP, onLCP, onTTFB } = await import("web-vitals");

    onCLS(sendToSentry);
    onINP(sendToSentry);
    onFCP(sendToSentry);
    onLCP(sendToSentry);
    onTTFB(sendToSentry);
  } catch {
    // web-vitals не загрузился — не критично, не ломаем приложение
  }
}
