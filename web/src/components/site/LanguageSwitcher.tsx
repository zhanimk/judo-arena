import { Globe2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { setLocale, type Locale } from "@/lib/i18n";

const locales: { code: Locale; label: string }[] = [
  { code: "kk", label: "KZ" },
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
];

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { i18n } = useTranslation();
  const current = i18n.language.slice(0, 2) as Locale;

  const changeLocale = async (locale: Locale) => {
    setLocale(locale);
    try {
      await api.auth.setLocale(locale);
    } catch {
      /* Guests and offline frontend previews do not need profile sync. */
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-gold/20 bg-muted/70 p-1 shadow-[0_0_0_1px_oklch(1_0_0/0.55)_inset] dark:border-gold/15 dark:bg-[#0d111a] dark:shadow-[0_0_0_1px_oklch(1_0_0/0.04)_inset] ${className}`}
      aria-label="Language switcher"
    >
      <Globe2 className="ml-2 h-4 w-4 text-muted-foreground" />
      {locales.map((locale) => (
        <button
          key={locale.code}
          type="button"
          onClick={() => changeLocale(locale.code)}
          className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
            current === locale.code
              ? "bg-gold text-gold-foreground shadow-gold"
              : "text-muted-foreground hover:bg-gold/10 hover:text-foreground dark:hover:bg-white/5"
          }`}
        >
          {locale.label}
        </button>
      ))}
    </div>
  );
}
