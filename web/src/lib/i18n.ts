/**
 * react-i18next setup.
 * 3 локали: kk (default) / ru / en.
 * Переводы лежат в shared/locales/{lang}.json.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import kk from "@/shared/locales/kk.json";
import ru from "@/shared/locales/ru.json";
import en from "@/shared/locales/en.json";

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
  i18n
    .use(initReactI18next)
    .init({
      resources: { kk: { common: kk }, ru: { common: ru }, en: { common: en } },
      lng: "kk",
      fallbackLng: "kk",
      defaultNS: "common",
      supportedLngs: ["kk", "ru", "en"],
      interpolation: { escapeValue: false },
    })
    .then(() => applyDocumentLocale(i18n.resolvedLanguage ?? i18n.language));

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
      applyDocumentLocale(i18n.resolvedLanguage ?? i18n.language);
    }
  } catch {
    applyDocumentLocale(i18n.resolvedLanguage ?? i18n.language);
  }
}
