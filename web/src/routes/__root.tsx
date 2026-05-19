import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter,
  HeadContent, Scripts, useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import appCss from "../styles.css?url";
import { hydrateLocaleFromStorage } from "@/lib/i18n";
import { hydrateThemeFromStorage } from "@/lib/theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-gradient-hero">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl font-bold text-gradient-gold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Бет табылмады</h2>
        <p className="mt-2 text-sm text-muted-foreground">Залда мұндай татами жоқ сияқты.</p>
        <Link to="/" className="mt-6 inline-flex bg-gradient-gold text-gold-foreground px-5 py-2.5 rounded-md font-medium shadow-gold">
          Басты бетке
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold">Бірдеңе дұрыс болмады</h1>
        <p className="mt-2 text-sm text-muted-foreground">Бетті қайта жүктеп көріңіз.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 bg-gradient-gold text-gold-foreground px-5 py-2.5 rounded-md font-medium"
        >Қайталау</button>
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
      { name: "description", content: "Дзюдо жарыстарын автоматтандыру: жеребе, төрелік, IJF стандарты бойынша нақты уақыттағы дәреже." },
      { property: "og:title", content: "Judo-Arena — Дзюдо жарыстарын басқару платформасы" },
      { property: "og:description", content: "Дзюдо жарыстарын автоматтандыру: жеребе, төрелік, IJF стандарты бойынша нақты уақыттағы дәреже." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Judo-Arena — Дзюдо жарыстарын басқару платформасы" },
      { name: "twitter:description", content: "Дзюдо жарыстарын автоматтандыру: жеребе, төрелік, IJF стандарты бойынша нақты уақыттағы дәреже." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/701e16dc-8548-4334-b32d-89729d10108e/id-preview-4951deee--a9962790-e058-4141-bcbb-53a075002025.lovable.app-1778479143923.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/701e16dc-8548-4334-b32d-89729d10108e/id-preview-4951deee--a9962790-e058-4141-bcbb-53a075002025.lovable.app-1778479143923.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="kk" className="dark">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap />
      <Outlet />
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
    import("@/lib/auth-store").then(({ bootstrap }) => {
      bootstrap();
    });
  }, [pathname]);
  return null;
}
