import { Link, useRouterState } from "@tanstack/react-router";
import emblem from "@/assets/jcl-logo.jpeg";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

const nav = [
  { to: "/", labelKey: "nav.home" },
  { to: "/tournaments", labelKey: "nav.tournaments" },
  { to: "/rankings", labelKey: "nav.rankings" },
  { to: "/protocol", labelKey: "nav.protocol" },
];

export function SiteHeader() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 py-3 sm:py-4">
      <div className="absolute inset-x-0 top-0 h-full bg-background/60 backdrop-blur-md" />
      <div className="container mx-auto px-4">
        <div className="relative grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 overflow-hidden rounded-2xl border border-gold/20 bg-background/85 px-4 py-3 shadow-elegant backdrop-blur-xl md:grid-cols-[1fr_auto_1fr] sm:px-5">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
          <div className="pointer-events-none absolute -left-20 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-gold/15 blur-2xl" />
          <div className="pointer-events-none absolute -right-16 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-primary/10 blur-2xl" />

          <Link to="/" className="group relative flex items-center gap-3">
            <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center">
              <span className="absolute inset-0 rounded-2xl conic-gold opacity-70 blur-[7px] transition-opacity group-hover:opacity-100" />
              <span className="absolute inset-[2px] rounded-[14px] bg-card" />
              <img
                src={emblem}
                alt="Judo Child League"
                className="relative h-9 w-9 rounded-xl object-cover shadow-gold transition-transform group-hover:rotate-6 group-hover:scale-105"
              />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-sm font-bold leading-none tracking-normal sm:text-lg md:text-xl">
                JUDO<span className="text-gradient-gold">·</span>CHILD<span className="text-gradient-gold">·</span>LEAGUE
              </span>
              <span className="mt-1 hidden text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:block">
                {t("app.tagline")}
              </span>
            </span>
          </Link>

          <nav className="relative hidden items-center justify-self-center rounded-full border border-border/50 bg-card/60 p-1 md:flex">
            {nav.map((n) => {
              const active = path === n.to || (n.to !== "/" && path.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`rounded-full px-4 py-2 text-sm leading-none transition-all ${
                    active
                      ? "bg-gold text-gold-foreground shadow-gold"
                      : "text-muted-foreground hover:bg-gold/10 hover:text-foreground"
                  }`}
                >
                  {t(n.labelKey)}
                </Link>
              );
            })}
          </nav>

          <div className="relative hidden items-center justify-end gap-2 md:flex">
            <LanguageSwitcher />
            <ThemeToggle className="bg-card/60" />
            <Link
              to="/login"
              className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-card/70 hover:text-foreground"
            >
              {t("nav.login")}
            </Link>
            <Link
              to="/login"
              className="rounded-full bg-gradient-gold px-5 py-2 text-sm font-semibold text-gold-foreground shadow-gold transition-transform hover:scale-105"
            >
              {t("nav.register")}
            </Link>
          </div>

          <div className="relative flex items-center justify-end gap-2 md:hidden">
            <LanguageSwitcher className="hidden sm:inline-flex md:hidden" />
            <ThemeToggle className="bg-card/60" />
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/60 transition-colors hover:border-gold/50"
              onClick={() => setOpen(!open)}
              aria-label="Мәзір"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="container mx-auto px-4 pt-3 md:hidden">
          <div className="flex flex-col gap-2 rounded-2xl border border-gold/20 bg-card/95 p-3 shadow-elegant backdrop-blur-xl animate-in slide-in-from-top duration-200">
            {nav.map((n) => (
              <Link
                key={n.labelKey}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-gold/10 hover:text-foreground"
              >
                {t(n.labelKey)}
              </Link>
            ))}
            <div className="px-3 py-1">
              <LanguageSwitcher className="w-full justify-center" />
            </div>
            <Link
              to="/login"
              className="rounded-xl bg-gradient-gold px-3 py-2.5 text-center text-sm font-semibold text-gold-foreground"
              onClick={() => setOpen(false)}
            >
              {t("nav.login")} / {t("nav.register")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
