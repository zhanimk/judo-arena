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
    if (!hideUntilScroll) {
      setScrolled(true);
      return;
    }
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

  const initials = user ? `${user.name?.[0] ?? ""}${user.surname?.[0] ?? ""}`.toUpperCase() : "";

  return (
    <header
      className={`${hideUntilScroll ? "fixed inset-x-0" : "sticky"} top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-full opacity-0"
      }`}
    >
      <div className="container mx-auto px-3 py-2.5 sm:px-4 sm:py-3">
        {/* ── floating pill ── */}
        <div className="flex h-14 items-center justify-between gap-2 rounded-full border border-gold/20 bg-background/90 px-2 shadow-[0_4px_24px_rgba(0,0,0,0.14)] backdrop-blur-2xl dark:bg-[#0a0f20]/92 sm:px-3">
          {/* Logo */}
          <Link
            to={user ? dashboardRoot(user.role) : "/"}
            className="group flex shrink-0 items-center gap-2.5 pl-1"
          >
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-gold/30 transition-all group-hover:ring-gold/60 group-hover:scale-105">
              <img src={emblem} alt="JCL" className="h-full w-full object-cover" />
            </span>
            <span className="hidden font-display text-[15px] font-bold leading-none sm:block">
              JUDO<span className="text-gradient-gold">·</span>CHILD
              <span className="text-gradient-gold">·</span>LEAGUE
            </span>
            <span className="font-display text-[15px] font-bold leading-none sm:hidden">JCL</span>
          </Link>

          {/* Center nav — desktop */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {publicNav.map((n) => {
              const active = path === n.to || (n.to !== "/" && path.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`rounded-full px-4 py-2 text-sm font-medium leading-none transition-all ${
                    active
                      ? "bg-gold text-gold-foreground shadow-gold"
                      : "text-muted-foreground hover:bg-gold/10 hover:text-foreground"
                  }`}
                >
                  <span suppressHydrationWarning>{t(n.labelKey)}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right — desktop */}
          <div className="hidden items-center gap-1.5 md:flex pr-1">
            <LanguageSwitcher />
            <ThemeToggle className="border-border/40" />
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 rounded-full border border-gold/22 bg-gold/8 py-1 pl-1 pr-3 transition-all hover:border-gold/45 hover:bg-gold/14"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-gold text-[11px] font-bold text-[#1a1204]">
                    {initials}
                  </span>
                  <span className="max-w-[90px] truncate text-sm font-medium">{user.name}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-2xl border border-border/60 bg-card/97 shadow-[0_12px_40px_rgba(0,0,0,0.15)] backdrop-blur-xl animate-in slide-in-from-top-2 duration-150">
                    <div className="border-b border-border/40 px-4 py-3">
                      <p className="truncate text-xs font-semibold">
                        {user.name} {user.surname}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                      <span className="mt-1.5 inline-block rounded-full bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gold">
                        {roleLabel(user.role)}
                      </span>
                    </div>
                    <Link
                      to={dashboardRoot(user.role)}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                    >
                      <LayoutDashboard className="h-4 w-4" /> Дэшборд
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 border-t border-border/40 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/8 hover:text-destructive"
                    >
                      <LogOut className="h-4 w-4" /> {t("nav.logout")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-gold/10 hover:text-foreground"
                >
                  <span suppressHydrationWarning>{t("nav.login")}</span>
                </Link>
                <Link
                  to="/login"
                  search={{ mode: "register" }}
                  className="rounded-full bg-gradient-gold px-5 py-2 text-sm font-semibold text-gold-foreground shadow-gold transition-transform hover:scale-105"
                >
                  <span suppressHydrationWarning>{t("nav.register")}</span>
                </Link>
              </>
            )}
          </div>

          {/* Right — mobile */}
          <div className="flex items-center gap-1.5 pr-1 md:hidden">
            <ThemeToggle className="h-9 w-9 border-border/40" />
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gold/20 bg-gold/8 text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
              onClick={() => setOpen(!open)}
              aria-label="Мәзір"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      {open && (
        <div className="px-3 pt-1.5 md:hidden">
          <div
            className="overflow-hidden rounded-3xl border border-gold/18 bg-card/97 shadow-[0_16px_48px_rgba(0,0,0,0.16)] backdrop-blur-2xl dark:bg-[#0a0f20]/97"
            style={{ animation: "menuDrop 0.22s cubic-bezier(0.22,1,0.36,1) both" }}
          >
            <div className="h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
            <nav className="p-2 space-y-0.5">
              {publicNav.map((n) => {
                const active = path === n.to || (n.to !== "/" && path.startsWith(n.to));
                return (
                  <Link
                    key={n.labelKey}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                      active
                        ? "bg-gradient-gold text-gold-foreground shadow-gold"
                        : "text-foreground/70 hover:bg-gold/8 hover:text-foreground"
                    }`}
                  >
                    <span suppressHydrationWarning>{t(n.labelKey)}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-border/25 px-3 py-2.5">
              <LanguageSwitcher className="w-full" />
            </div>
            <div className="border-t border-border/25 p-2.5">
              {user ? (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-3 rounded-2xl bg-gold/8 border border-gold/18 px-3 py-2.5 mb-1">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-gold text-xs font-bold text-[#1a1204]">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {user.name} {user.surname}
                      </p>
                      <span className="text-[10px] uppercase tracking-widest text-gold">
                        {roleLabel(user.role)}
                      </span>
                    </div>
                  </div>
                  <Link
                    to={dashboardRoot(user.role)}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 rounded-2xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                  >
                    <LayoutDashboard className="h-4 w-4" /> Дэшборд
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-2xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-destructive/8 hover:text-destructive transition-colors"
                  >
                    <LogOut className="h-4 w-4" />{" "}
                    <span suppressHydrationWarning>{t("nav.logout")}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center rounded-2xl border border-gold/25 py-3 text-sm font-semibold text-gold hover:bg-gold/8 transition-colors"
                  >
                    <span suppressHydrationWarning>{t("nav.login")}</span>
                  </Link>
                  <Link
                    to="/login"
                    search={{ mode: "register" }}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center rounded-2xl bg-gradient-gold py-3 text-sm font-bold text-gold-foreground shadow-gold"
                  >
                    <span suppressHydrationWarning>{t("nav.register")}</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
          <style>{`@keyframes menuDrop{from{opacity:0;transform:translateY(-8px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
        </div>
      )}
    </header>
  );
}
