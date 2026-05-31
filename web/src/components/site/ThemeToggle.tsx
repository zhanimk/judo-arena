import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { applyTheme, getStoredTheme, setStoredTheme, type Theme } from "@/lib/theme";

export function ThemeToggle({ className = "", showLabel = false }: { className?: string; showLabel?: boolean }) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const t = getStoredTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setStoredTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("theme.toggle")}
      className={`relative inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border/60 px-2.5 text-sm text-muted-foreground transition-colors hover:border-gold/60 hover:text-foreground ${showLabel ? "min-w-0" : "w-9 px-0"} ${className}`}
    >
      {theme === "dark" ? <Sun className="h-4 w-4 text-gold" /> : <Moon className="h-4 w-4 text-gold" />}
      {showLabel && <span className="truncate">{theme === "dark" ? "Light" : "Dark"}</span>}
    </button>
  );
}
