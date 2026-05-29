import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import emblem from "@/assets/jcl-logo.jpeg";
import { Menu, X, LayoutDashboard, LogOut, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth, logout as doLogout } from "@/lib/auth-store";

const publicNav = [
  { to: "/", labelKey: "nav.home" },
  { to: "/tournaments", labelKey: "nav.tournaments" },
  { to: "/rankings", labelKey: "nav.rankings" },
];

const dashboardRoot = (role?: string) => {
  if (role === "ADMIN") return "/admin";
  if (role === "COACH") return "/coach";
  return "/athlete";
};

const roleLabel = (role?: string) => {
  if (role === "ADMIN") return "Әкімші";
  if (role === "COACH") return "Жаттықтырушы";
  return "Спортшы";
};

type SiteHeaderProps = { hideUntilScroll?: boolean };

export function SiteHeader({ hideUntilScroll = false }: SiteHeaderProps) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(!hideUntilScroll);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hideUntilScroll) { setScrolled(true); return; }
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hideUntilScroll]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await doLogout();
    navigate({ to: "/" });
  };

  const initials = user
    ? `${user.name?.[0] ?? ""}${user.surname?.[0] ?? ""}`.toUpperCase()
    : "";

  return (
    <header
      className={`${hideUntilScroll ? "fixed inset-x-0" : "sticky"} top-0 z-50 py-3 transition-all duration-300 sm:py-4 ${
        scrolled || open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-full bg-background/60 backdrop-blur-md" />
      <div className="container mx-auto px-4">
        <div className="relative grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-gold/20 bg-background/85 px-4 py-3 shadow-elegant backdrop-blur-xl md:grid-cols-[1fr_auto_1fr] sm:px-5">
          {/* Decorative glows clipped to the card — keep overflow-hidden on this inner layer only */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
            <div className="absolute -left-20 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-gold/15 blur-2xl" />
            <div className="absolute -right-16 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-primary/10 blur-2xl" />
          </div>

          {/* Logo — goes to dashboard if logged in, else home */}
          <Link
            to={user ? dashboardRoot(user.role) : "/"}
            className="group relative flex items-center gap-3"
          >
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

          {/* Center nav */}
          <nav className="relative hidden items-center justify-self-center rounded-full border border-border/50 bg-card/60 p-1 md:flex">
            {publicNav.map((n) => {
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

          {/* Right side */}
          <div className="relative hidden items-center justify-end gap-2 md:flex">
            <LanguageSwitcher />
            <ThemeToggle className="bg-card/60" />

            {user ? (
              /* ── Logged-in user pill ── */
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 rounded-full border border-gold/25 bg-gold/8 pl-1 pr-3 py-1 transition-all hover:border-gold/50 hover:bg-gold/15"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-gold text-[11px] font-bold text-[#1a1204]">
                    {initials}
                  </span>
                  <span className="text-sm font-medium max-w-[100px] truncate">{user.name}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-elegant overflow-hidden animate-in slide-in-from-top-2 duration-150">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-border/40">
                      <p className="text-xs font-semibold truncate">{user.name} {user.surname}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                      <span className="mt-1.5 inline-block text-[10px] uppercase tracking-widest text-gold bg-gold/10 rounded-full px-2 py-0.5">
                        {roleLabel(user.role)}
                      </span>
                    </div>
                    {/* Dashboard link */}
                    <Link
                      to={dashboardRoot(user.role)}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Дэшборд
                    </Link>
                    {/* Logout */}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors border-t border-border/40"
                    >
                      <LogOut className="h-4 w-4" />
                      {t("nav.logout")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* ── Guest buttons ── */
              <>
                <Link
                  to="/login"
                  className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-card/70 hover:text-foreground"
                >
                  {t("nav.login")}
                </Link>
                <Link
                  to="/login"
                  search={{ mode: "register" }}
                  className="rounded-full bg-gradient-gold px-5 py-2 text-sm font-semibold text-gold-foreground shadow-gold transition-transform hover:scale-105"
                >
                  {t("nav.register")}
                </Link>
              </>
            )}
          </div>

          {/* Mobile right */}
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

      {/* Mobile menu */}
      {open && (
        <div className="container mx-auto px-4 pt-3 md:hidden">
          <div className="flex flex-col gap-2 rounded-2xl border border-gold/20 bg-card/95 p-3 shadow-elegant backdrop-blur-xl animate-in slide-in-from-top duration-200">
            {publicNav.map((n) => (
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

            {user ? (
              <>
                <Link
                  to={dashboardRoot(user.role)}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-xl bg-gold/10 border border-gold/20 px-3 py-2.5 text-sm font-medium text-gold"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Дэшборд · {roleLabel(user.role)}
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  {t("nav.logout")}
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-xl bg-gradient-gold px-3 py-2.5 text-center text-sm font-semibold text-gold-foreground"
                onClick={() => setOpen(false)}
              >
                {t("nav.login")} / {t("nav.register")}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
