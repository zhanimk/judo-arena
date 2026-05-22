import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ReactNode, useState } from "react";
import emblem from "@/assets/jcl-logo.jpeg";
import { LogOut, Loader2, Menu, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth, logout as doLogout } from "@/lib/auth-store";
import { LanguageSwitcher } from "@/components/site/LanguageSwitcher";
import { ThemeToggle } from "@/components/site/ThemeToggle";

export interface NavItem { to: string; label: string; icon: React.ComponentType<{ className?: string }>; }

const navLabelKeys: Record<string, string> = {
  "Шолу": "dashboard.overview",
  "Профиль": "dashboard.profile",
  "Спортшылар": "dashboard.athletes",
  "Өтінімдер": "dashboard.applications",
  "Live матчтар": "dashboard.live_matches",
  "LIVE матчтар": "dashboard.live_matches",
  "Жарыстар": "dashboard.tournaments",
  "Клуб": "dashboard.clubs",
  "Клубтар": "dashboard.clubs",
  "Пайдаланушылар": "dashboard.users",
  "Аудит": "dashboard.audit",
  "Баптаулар": "dashboard.settings",
  "Жекпе-жектер": "dashboard.live_matches",
  "Нәтижелер": "dashboard.results",
  "Хабарландырулар": "dashboard.notifications",
  "Рейтинг": "nav.rankings",
};

const roleKeys: Record<string, string> = {
  "Әкімші": "roles.admin",
  "Жаттықтырушы": "roles.coach",
  "Спортшы": "roles.athlete",
};

export function DashboardShell({
  role, navItems, children, accentTitle,
}: { role: string; navItems: NavItem[]; children: ReactNode; accentTitle: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const translatedRole = roleKeys[role] ? t(roleKeys[role]) : role;
  const navLabel = (label: string) => (navLabelKeys[label] ? t(navLabelKeys[label]) : label);

  // Desktop: collapsed = icon-only mode, persisted
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; }
    catch { return false; }
  });
  // Mobile: overlay open state
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch { /* */ }
      return next;
    });
  };

  const handleLogout = async () => {
    await doLogout();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex bg-gradient-hero">

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border/40 glass",
          "transition-all duration-300 ease-in-out",
          // Mobile: slide in/out
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
          // Desktop overrides
          "lg:relative lg:inset-auto lg:z-auto lg:translate-x-0 lg:shrink-0",
          collapsed ? "lg:w-16" : "lg:w-64",
          "w-64",
        ].join(" ")}
      >
        {/* Logo row */}
        <div className={`flex h-16 items-center border-b border-border/40 ${collapsed ? "justify-center px-2" : "px-4 gap-2"}`}>
          {collapsed ? (
            <Link to="/" title="JUDO·ARENA" className="flex items-center justify-center">
              <img src={emblem} alt="" className="h-8 w-8" />
            </Link>
          ) : (
            <Link to="/" className="flex flex-1 min-w-0 items-center gap-2">
              <img src={emblem} alt="" className="h-8 w-8 shrink-0" />
              <span className="font-display font-bold truncate">JUDO·ARENA</span>
            </Link>
          )}

          {/* Desktop collapse toggle */}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden lg:flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            {collapsed
              ? <PanelLeftOpen className="h-4 w-4" />
              : <PanelLeftClose className="h-4 w-4" />
            }
          </button>

          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Role / user info */}
        {collapsed ? (
          <div className="flex justify-center py-4">
            <div
              title={`${translatedRole}${user ? ` · ${user.email}` : ""}`}
              className="h-8 w-8 rounded-full bg-gold/20 flex items-center justify-center text-xs font-bold text-gold cursor-default select-none"
            >
              {translatedRole.charAt(0)}
            </div>
          </div>
        ) : (
          <div className="px-6 py-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("common.role")}</div>
            <div className="font-display text-lg text-gold">{translatedRole}</div>
            {user && <div className="mt-1 text-xs text-muted-foreground truncate">{user.email}</div>}
          </div>
        )}

        {/* Nav */}
        <nav className={`flex-1 space-y-1 ${collapsed ? "px-2" : "px-3"}`}>
          {navItems.map((n, idx) => {
            const active = path === n.to;
            return (
              <Link
                key={`${n.to}-${idx}`}
                to={n.to}
                title={collapsed ? navLabel(n.label) : undefined}
                onClick={() => setMobileOpen(false)}
                className={[
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all",
                  collapsed ? "justify-center" : "",
                  active
                    ? "bg-gold/10 text-gold border border-gold/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                ].join(" ")}
              >
                <n.icon className="h-4 w-4 shrink-0" />
                {!collapsed && navLabel(n.label)}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className={`border-t border-border/40 p-3 space-y-1`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <ThemeToggle className="bg-card/60" />
            </div>
          ) : (
            <>
              <LanguageSwitcher className="w-full justify-center rounded-md" />
              <ThemeToggle className="w-full justify-center bg-card/60" showLabel />
            </>
          )}
          <button
            onClick={handleLogout}
            title={collapsed ? t("nav.logout") : undefined}
            className={[
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm",
              "text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors",
              collapsed ? "justify-center" : "",
            ].join(" ")}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && t("nav.logout")}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="border-b border-border/40 glass px-4 py-3 lg:px-10">
          <div className="flex min-h-12 items-center justify-between gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden shrink-0 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>

            <h1 className="min-w-0 flex-1 truncate font-display text-lg font-semibold md:text-2xl">{accentTitle}</h1>

            <div className="hidden items-center gap-2 sm:flex lg:hidden">
              <ThemeToggle className="bg-card/60" />
              <LanguageSwitcher />
            </div>
            <button
              onClick={handleLogout}
              className="shrink-0 text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 lg:hidden"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t("nav.logout")}</span>
            </button>
          </div>

          {/* Mobile horizontal nav tabs */}
          <nav className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden [scrollbar-width:none]">
            {navItems.map((n, idx) => {
              const active = path === n.to;
              return (
                <Link
                  key={`${n.to}-${idx}`}
                  to={n.to}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs transition-colors ${
                    active
                      ? "border-gold/40 bg-gold/15 text-gold"
                      : "border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <n.icon className="h-3.5 w-3.5" />
                  {navLabel(n.label)}
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 sm:hidden lg:hidden">
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <ThemeToggle className="bg-card/60" />
              <LanguageSwitcher className="w-full justify-center" />
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-10">{children}</div>
      </main>
    </div>
  );
}

export function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`glass rounded-xl p-4 sm:p-6 ${accent ? "border-gold/40" : ""}`}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 break-words font-display text-3xl font-bold sm:text-4xl ${accent ? "text-gradient-gold" : ""}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="glass rounded-xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function LoadingState({ message }: { message?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {message ?? t("common.loading")}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-8">
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
