import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import { hydrateLocaleFromStorage } from "@/lib/i18n";
import { hydrateThemeFromStorage } from "@/lib/theme";
import { bootstrap } from "@/lib/auth-store";
import { initSentry, Sentry } from "@/lib/sentry";
import { usePWA } from "@/hooks/usePWA";
import { useTranslation } from "react-i18next";
import emblem from "@/assets/jcl-logo.jpeg";

// Initialise Sentry as early as possible
initSentry();

/** Render children only after client-side hydration to avoid SSR/portal conflicts. */
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted ? <>{children}</> : null;
}

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-gradient-hero">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl font-bold text-gradient-gold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">{t("error.not_found")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.not_found_desc")}</p>
        <Link
          to="/"
          className="mt-6 inline-flex bg-gradient-gold text-gold-foreground px-5 py-2.5 rounded-md font-medium shadow-gold"
        >
          {t("error.go_home")}
        </Link>
      </div>
    </div>
  );
}

function AppLoadingScreen({ label = "Жүктелуде" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden bg-gradient-hero px-4">
      <div className="absolute inset-0 grid-bg opacity-25" />
      <div className="absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-[110px]" />
      <div className="relative text-center">
        <div className="relative mx-auto mb-7 h-28 w-28">
          <div className="absolute inset-0 rounded-full border border-gold/25 animate-ping" />
          <div className="absolute inset-3 rounded-full border border-gold/35" />
          <div className="absolute inset-6 rounded-2xl bg-card shadow-elegant" />
          <img
            src={emblem}
            alt=""
            className="absolute inset-7 h-14 w-14 rounded-xl object-cover shadow-gold"
          />
        </div>
        <div className="font-display text-3xl font-bold">
          Judo<span className="text-gradient-gold">·</span>Arena
        </div>
        <p className="mt-2 text-xs uppercase tracking-[0.35em] text-muted-foreground">{label}</p>
        <div className="mx-auto mt-7 h-1 w-56 overflow-hidden rounded-full bg-border/50">
          <div className="h-full w-1/2 rounded-full bg-gradient-gold shadow-gold animate-[loadingSlide_1.1s_ease-in-out_infinite]" />
        </div>
      </div>
      <style>{`
        @keyframes loadingSlide {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(240%); }
        }
      `}</style>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const { t } = useTranslation();
  console.error(error);
  Sentry.captureException(error);
  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden bg-gradient-hero px-4">
      <div className="absolute inset-0 grid-bg opacity-25" />
      <div className="relative max-w-md rounded-2xl border border-gold/25 bg-card/70 p-8 text-center shadow-elegant backdrop-blur">
        <img src={emblem} alt="" className="mx-auto mb-5 h-16 w-16 rounded-2xl object-cover" />
        <h1 className="font-display text-2xl font-semibold">{t("error.generic")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "Бетті қайта жүктеп көріңіз."}
        </p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-md bg-gradient-gold px-5 py-2.5 font-medium text-gold-foreground shadow-gold"
        >
          {t("error.reload")}
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Judo-Arena — Дзюдо жарыстарын басқару платформасы" },
      {
        name: "description",
        content:
          "Дзюдо жарыстарын автоматтандыру: жеребе, төрелік, IJF стандарты бойынша нақты уақыттағы дәреже.",
      },
      { property: "og:title", content: "Judo-Arena — Дзюдо жарыстарын басқару платформасы" },
      {
        property: "og:description",
        content:
          "Дзюдо жарыстарын автоматтандыру: жеребе, төрелік, IJF стандарты бойынша нақты уақыттағы дәреже.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Judo-Arena — Дзюдо жарыстарын басқару платформасы" },
      {
        name: "twitter:description",
        content:
          "Дзюдо жарыстарын автоматтандыру: жеребе, төрелік, IJF стандарты бойынша нақты уақыттағы дәреже.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/701e16dc-8548-4334-b32d-89729d10108e/id-preview-4951deee--a9962790-e058-4141-bcbb-53a075002025.lovable.app-1778479143923.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/701e16dc-8548-4334-b32d-89729d10108e/id-preview-4951deee--a9962790-e058-4141-bcbb-53a075002025.lovable.app-1778479143923.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
      // PWA / mobile
      { name: "theme-color", content: "#C9A84C" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Judo-Arena" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap",
      },
      // PWA
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: emblem, type: "image/jpeg" },
      { rel: "apple-touch-icon", href: emblem },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
  pendingComponent: () => <AppLoadingScreen label="Бет дайындалып жатыр" />,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="kk" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function PWAUpdateBanner() {
  const { needRefresh, updateServiceWorker } = usePWA();
  const { t } = useTranslation();
  if (!needRefresh) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 shadow-lg text-sm">
      <span>{t("pwa.update_available")}</span>
      <button
        onClick={updateServiceWorker}
        className="bg-gradient-gold text-gold-foreground px-3 py-1 rounded font-medium text-xs"
      >
        {t("pwa.update_action")}
      </button>
    </div>
  );
}

function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "fading" | "done">("visible");

  useEffect(() => {
    const shown = sessionStorage.getItem("splash-shown");
    if (shown) {
      setPhase("done");
      return;
    }
    sessionStorage.setItem("splash-shown", "1");
    const t1 = setTimeout(() => setPhase("fading"), 1800);
    const t2 = setTimeout(() => setPhase("done"), 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      style={{
        transition: "opacity 0.7s cubic-bezier(0.4,0,0.2,1)",
        opacity: phase === "fading" ? 0 : 1,
        pointerEvents: phase === "fading" ? "none" : "auto",
      }}
    >
      {/* Background radial glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/8 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/12 blur-[60px]" />
      </div>

      {/* Animated ring */}
      <div
        className="relative mb-8"
        style={{ animation: "splashLogoIn 0.7s cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        <div
          className="absolute inset-0 rounded-full border border-gold/30"
          style={{ animation: "splashRing1 2s ease-in-out infinite" }}
        />
        <div
          className="absolute -inset-4 rounded-full border border-gold/15"
          style={{ animation: "splashRing2 2s ease-in-out 0.3s infinite" }}
        />
        <div
          className="absolute -inset-8 rounded-full border border-gold/8"
          style={{ animation: "splashRing2 2s ease-in-out 0.6s infinite" }}
        />
        {/* Logo */}
        <span className="relative inline-flex h-24 w-24 items-center justify-center">
          <span className="absolute inset-0 rounded-[28px] conic-gold opacity-80 blur-[14px]" />
          <span className="absolute inset-[3px] rounded-[26px] bg-card" />
          <img
            src={emblem}
            alt=""
            className="relative h-20 w-20 rounded-[22px] object-cover shadow-gold"
          />
        </span>
      </div>

      {/* Brand name */}
      <div style={{ animation: "splashTextIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.25s both" }}>
        <p className="font-display text-3xl font-bold tracking-wide text-center">
          JUDO<span className="text-gradient-gold">·</span>ARENA
        </p>
        <p className="mt-2 text-center text-xs uppercase tracking-[0.35em] text-muted-foreground">
          цифрлық дзюдо платформасы
        </p>
      </div>

      {/* Loading bar */}
      <div
        className="mt-10 h-[2px] w-48 overflow-hidden rounded-full bg-border/40"
        style={{ animation: "splashFadeIn 0.4s 0.5s both" }}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold/60 via-gold to-gold/60"
          style={{
            animation: "splashBar 1.4s cubic-bezier(0.4,0,0.2,1) 0.5s forwards",
            width: "0%",
          }}
        />
      </div>

      <style>{`
        @keyframes splashLogoIn {
          from { opacity: 0; transform: scale(0.5) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes splashTextIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashFadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes splashRing1 {
          0%,100% { transform: scale(1); opacity: 0.6; }
          50%      { transform: scale(1.08); opacity: 1; }
        }
        @keyframes splashRing2 {
          0%,100% { transform: scale(1); opacity: 0.3; }
          50%      { transform: scale(1.12); opacity: 0.6; }
        }
        @keyframes splashBar {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
}

function ScrollProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrolled = el.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setPct(total > 0 ? (scrolled / total) * 100 : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[2px] pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-gold/80 via-gold to-gold/80 shadow-[0_0_8px_oklch(0.76_0.15_80/0.8)]"
        style={{ width: `${pct}%`, transition: "width 0.1s linear" }}
      />
    </div>
  );
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [visible, setVisible] = useState(true);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div style={{ opacity: visible ? 1 : 0, transition: "opacity 0.25s ease" }}>{children}</div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ClientOnly>
        <SplashScreen />
      </ClientOnly>
      <ClientOnly>
        <ScrollProgress />
      </ClientOnly>
      {/* Grain texture overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-[9990] opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />
      <AuthBootstrap />
      <PageTransition>
        <Outlet />
      </PageTransition>
      <ClientOnly>
        <PWAUpdateBanner />
      </ClientOnly>
      <ClientOnly>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--foreground))",
            },
            className: "font-sans text-sm",
          }}
        />
      </ClientOnly>
    </QueryClientProvider>
  );
}

/** При первой загрузке приложения — пробуем восстановить сессию через /auth/refresh. */
function AuthBootstrap() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    hydrateThemeFromStorage();
    hydrateLocaleFromStorage();
    if (pathname === "/login") return;
    bootstrap();
  }, [pathname]);
  return null;
}
