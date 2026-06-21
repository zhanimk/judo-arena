import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ReactNode, useState } from "react";
const emblem = "/jcl-logo.jpg";
import {
  LogOut,
  Loader2,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  PackageOpen,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth, logout as doLogout } from "@/lib/auth-store";
import { LanguageSwitcher } from "@/components/site/LanguageSwitcher";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/lib/socket";
import { api } from "@/lib/api";

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const dashboardRoot = (role?: string) => {
  if (role === "ADMIN") return "/admin";
  if (role === "COACH") return "/coach";
  return "/athlete";
};

const profileRoot = (role?: string) => {
  if (role === "COACH") return "/coach/profile";
  if (role === "ATHLETE") return "/athlete/profile";
  return dashboardRoot(role);
};

export function DashboardShell({
  role,
  navItems,
  children,
  accentTitle,
}: {
  role: string;
  navItems: NavItem[];
  children: ReactNode;
  accentTitle: string;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const translatedRole = role.includes(".") ? t(role) : role;
  const navLabel = (label: string) => (label.includes(".") ? t(label) : label);

  const unreadQuery = useQuery({
    queryKey: ["unread-count"],
    queryFn: () => api.notifications.unreadCount(),
    // No refetchInterval — Socket.IO's "notification:new" invalidates immediately
    staleTime: Infinity,
    enabled: !!user,
  });
  const unreadCount = unreadQuery.data?.count ?? 0;

  // N2: подписка на личную Socket.IO комнату — мгновенно обновляет бейдж уведомлений
  useRealtime(user?.id ? [`user:${user.id}`] : [], {
    "notification:new": () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });

  // Desktop: collapsed = icon-only mode, persisted
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  // Mobile: overlay open state
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("sidebar-collapsed", String(next));
      } catch {
        /* */
      }
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
        <div
          className={`flex h-16 items-center border-b border-border/40 ${collapsed ? "justify-center px-2" : "px-4 gap-2"}`}
        >
          {collapsed ? (
            <Link
              to={dashboardRoot(user?.role)}
              title="JUDO·ARENA"
              className="group flex items-center justify-center"
            >
              <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center">
                <span className="absolute inset-0 rounded-full conic-gold opacity-60 blur-[6px] transition-opacity group-hover:opacity-100" />
                <span className="absolute inset-[2px] rounded-full bg-card" />
                <img
                  src={emblem}
                  alt=""
                  className="relative h-7 w-7 rounded-full object-cover shadow-gold transition-transform group-hover:scale-105"
                />
              </span>
            </Link>
          ) : (
            <Link
              to={dashboardRoot(user?.role)}
              className="group flex h-16 items-center gap-3 border-b border-border/40 px-6 transition-colors hover:bg-gold/5"
            >
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-gold/30 bg-white shadow-gold transition-all group-hover:ring-gold/60 group-hover:scale-105">
                <img src="/jcl-logo.jpg" alt="JCL" className="h-full w-full object-cover" />
              </span>
              <div className="flex flex-col">
                <span className="font-display text-sm font-bold tracking-tight">
                  JUDO<span className="text-gradient-gold">·</span>ARENA
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Management
                </span>
              </div>
            </Link>
          )}

          {/* Desktop collapse toggle */}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden lg:flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
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
            <Link
              to={profileRoot(user?.role)}
              title={`${translatedRole}${user ? ` · ${user.email}` : ""}`}
              className="h-9 w-9 rounded-full bg-gradient-gold flex items-center justify-center text-xs font-bold text-[#1a1204] select-none"
            >
              {user
                ? `${user.name?.[0] ?? ""}${user.surname?.[0] ?? ""}`.toUpperCase()
                : translatedRole.charAt(0)}
            </Link>
          </div>
        ) : (
          <Link
            to={profileRoot(user?.role)}
            className="px-4 py-4 flex items-center gap-3 border-b border-border/40 hover:bg-muted/30 transition-colors"
          >
            <div className="h-10 w-10 rounded-full bg-gradient-gold flex items-center justify-center text-sm font-bold text-[#1a1204] shrink-0">
              {user ? `${user.name?.[0] ?? ""}${user.surname?.[0] ?? ""}`.toUpperCase() : "?"}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {user ? `${user.name} ${user.surname}` : "—"}
              </div>
              <div className="text-[11px] text-gold uppercase tracking-widest">
                {translatedRole}
              </div>
            </div>
          </Link>
        )}

        {/* Nav */}
        <nav className={`flex-1 space-y-1 py-2 ${collapsed ? "px-2" : "px-3"}`}>
          {navItems.map((n, idx) => {
            const active = path === n.to;
            const isNotif = n.label === "dashboard.notifications";
            return (
              <Link
                key={`${n.to}-${idx}`}
                to={n.to}
                title={collapsed ? navLabel(n.label) : undefined}
                onClick={() => setMobileOpen(false)}
                className={[
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  collapsed ? "justify-center" : "",
                  active
                    ? "bg-gold/10 text-gold border border-gold/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                ].join(" ")}
              >
                <span className="relative shrink-0">
                  <n.icon className="h-4 w-4" />
                  {isNotif && unreadCount > 0 && (
                    <span
                      aria-label={`${unreadCount} unread`}
                      className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white"
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </span>
                {!collapsed && <span className="flex-1">{navLabel(n.label)}</span>}
                {!collapsed && isNotif && unreadCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
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

            <h1 className="min-w-0 flex-1 truncate font-display text-lg font-semibold md:text-2xl">
              {accentTitle}
            </h1>

            <div className="flex items-center gap-2">
              {/* Notification bell — always visible in top bar */}
              {(() => {
                const notifNav = navItems.find((n) => n.label === "dashboard.notifications");
                if (!notifNav) return null;
                return (
                  <Link
                    to={notifNav.to}
                    aria-label={navLabel(notifNav.label)}
                    title={navLabel(notifNav.label)}
                    className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white"
                      >
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })()}

              <div className="hidden lg:flex">
                <ThemeToggle className="bg-card/60" />
              </div>

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
        </header>

        <div className="p-4 sm:p-6 lg:p-10">{children}</div>
      </main>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: { value: number; label?: string };
}) {
  return (
    <div
      className={`glass rounded-xl p-4 sm:p-5 relative overflow-hidden ${accent ? "border-gold/40" : ""}`}
    >
      {accent && <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-gold" />}
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        {Icon && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent ? "bg-gold/15 text-gold" : "bg-muted/50 text-muted-foreground"}`}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div
        className={`mt-3 break-words font-display text-3xl font-bold sm:text-4xl ${accent ? "text-gradient-gold" : ""}`}
      >
        {value}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        {trend && (
          <span
            className={`ml-auto inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${trend.value >= 0 ? "bg-emerald-500/12 text-emerald-500" : "bg-destructive/12 text-destructive"}`}
          >
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}
            {trend.label ?? "%"}
          </span>
        )}
      </div>
    </div>
  );
}

export function Panel({
  title,
  children,
  action,
  className,
}: {
  title: string | ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass rounded-xl p-4 sm:p-6${className ? ` ${className}` : ""}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {action && (
          <div className="shrink-0 max-w-full overflow-x-auto [scrollbar-width:none]">{action}</div>
        )}
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

export function EmptyState({
  title,
  hint,
  icon: Icon,
  action,
}: {
  title: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: { label: string; to: string };
}) {
  const Ico = Icon ?? PackageOpen;
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/40">
        <Ico className="h-5 w-5 text-muted-foreground/60" />
      </div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground max-w-xs">{hint}</div>}
      {action && (
        <Link
          to={action.to}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gold/10 border border-gold/20 px-4 py-2 text-xs font-medium text-gold hover:bg-gold/20 transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

// ─── Skeleton primitives ────────────────────────────────────────────────────

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/50 ${className}`} />;
}

export function StatCardSkeleton() {
  return (
    <div className="glass rounded-xl p-4 sm:p-6 space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-9 w-24 mt-1" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="mt-4 space-y-2">
      <div className="flex gap-4 pb-2 border-b border-border/40">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-2.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={`h-4 flex-1 ${c === 0 ? "max-w-[160px]" : c === cols - 1 ? "max-w-[80px]" : ""}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 mt-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border/30 p-3">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}
