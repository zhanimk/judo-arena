/**
 * react-i18next — все три локали бандлятся инлайн.
 * Нет HTTP-запросов → нет гидрационных несовпадений SSR/клиент.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import kkCommon from "../locales/kk/common.json";
import ruCommon from "../locales/ru/common.json";
import enCommon from "../locales/en/common.json";

export type Locale = "kk" | "ru" | "en";

function normalizeLocale(locale: string | undefined): Locale {
  if (locale?.startsWith("ru")) return "ru";
  if (locale?.startsWith("en")) return "en";
  return "kk";
}

function applyDocumentLocale(locale: string | undefined): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = normalizeLocale(locale);
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: "kk",
    fallbackLng: "kk",
    ns: ["common"],
    defaultNS: "common",
    supportedLngs: ["kk", "ru", "en"],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    // Synchronous — no async, no hydration mismatch
    initImmediate: false,
    resources: {
      kk: { common: kkCommon },
      ru: { common: ruCommon },
      en: { common: enCommon },
    },
  });

  applyDocumentLocale(i18n.language);
  i18n.on("languageChanged", applyDocumentLocale);
}

export default i18n;

export function setLocale(locale: Locale): void {
  i18n.changeLanguage(locale);
  try {
    localStorage.setItem("judo-locale", locale);
  } catch {
    /* ignore */
  }
}

export function hydrateLocaleFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem("judo-locale");
    if (stored === "kk" || stored === "ru" || stored === "en") {
      i18n.changeLanguage(stored);
    } else {
      applyDocumentLocale(i18n.language);
    }
  } catch {
    applyDocumentLocale(i18n.language);
  }
}
