export type Theme = "dark" | "light";

const STORAGE_KEY = "theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "dark";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
}

export function setStoredTheme(theme: Theme) {
  applyTheme(theme);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, theme);
  }
}

export function hydrateThemeFromStorage() {
  applyTheme(getStoredTheme());
}
