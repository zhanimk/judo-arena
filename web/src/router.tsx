import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ApiError } from "@/lib/api";
import { sentryTrackNavigation } from "@/lib/sentry";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Don't retry on client errors (4xx) — only on network/server errors
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
        // 30 s stale time prevents over-fetching on window focus
        staleTime: 30_000,
        // Don't refetch on window focus by default (individual queries can opt in)
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Don't retry mutations at all
        retry: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  // Track route navigations in Sentry as breadcrumbs
  router.subscribe("onResolved", (event) => {
    sentryTrackNavigation(event.toLocation.pathname);
  });

  return router;
};
