/**
 * Хелперы для защищённых маршрутов.
 * Использует TanStack Router + наш auth-store.
 */

import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { isAthleteProfileComplete, useAuth, UserRole } from "./auth-store";
import { api } from "./api";

export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: UserRole[];
}) {
  const { user, status } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mounted, setMounted] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [hasClubRequest, setHasClubRequest] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (status === "unauthenticated") {
      navigate({ to: "/login" });
    } else if (status === "authenticated" && allowedRoles && user) {
      if (!allowedRoles.includes(user.role)) {
        // Не та роль — отправим на дашборд их роли
        const target =
          user.role === "ADMIN" ? "/admin" : user.role === "COACH" ? "/coach" : "/athlete";
        navigate({ to: target });
      }
    }
  }, [mounted, status, user, allowedRoles, navigate]);

  useEffect(() => {
    if (!mounted || status !== "authenticated") return;
    if (user?.role !== "ATHLETE" && user?.role !== "COACH") return;

    let alive = true;
    setHasClubRequest(null);
    setCheckingOnboarding(true);

    const fetchPromise =
      user.role === "ATHLETE" ? api.joinRequests.myList() : api.coachClubRequests.myList();

    fetchPromise
      .then((requests) => {
        if (!alive) return;
        const hasPendingOrApproved = requests.some(
          (r: any) => r.status === "PENDING" || r.status === "APPROVED",
        );
        setHasClubRequest(Boolean(user.clubId || hasPendingOrApproved));
      })
      .catch(() => {
        if (!alive) return;
        setHasClubRequest(Boolean(user.clubId));
      })
      .finally(() => {
        if (alive) setCheckingOnboarding(false);
      });

    return () => {
      alive = false;
    };
  }, [mounted, status, user?.id, user?.role, user?.clubId]);

  useEffect(() => {
    if (!mounted || status !== "authenticated" || !user || user.role !== "ATHLETE") return;
    if (checkingOnboarding) return;
    if (hasClubRequest === null) return;

    const profileComplete = isAthleteProfileComplete(user);
    const onboardingComplete = hasClubRequest && profileComplete;
    const onOnboarding = path === "/athlete/onboarding";

    if (!onboardingComplete && !onOnboarding) {
      navigate({ to: "/athlete/onboarding" });
    }
  }, [mounted, status, user, checkingOnboarding, hasClubRequest, path, navigate]);

  useEffect(() => {
    if (!mounted || status !== "authenticated" || !user || user.role !== "COACH") return;
    if (checkingOnboarding) return;
    if (hasClubRequest === null) return;

    const onboardingDone = hasClubRequest;
    const onboardingPaths = ["/coach/onboarding", "/coach/club", "/coach/profile"];
    const onOnboarding = onboardingPaths.includes(path);

    if (!onboardingDone && !onOnboarding) {
      navigate({ to: "/coach/onboarding" });
    }
  }, [mounted, status, user, checkingOnboarding, hasClubRequest, path, navigate]);

  if (!mounted) return null;

  if (
    status === "loading" ||
    status === "idle" ||
    checkingOnboarding ||
    (user?.role === "ATHLETE" && hasClubRequest === null)
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-muted-foreground text-sm animate-pulse">Жүктелуде...</div>
      </div>
    );
  }
  if (status === "unauthenticated") return null;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return null;

  return <>{children}</>;
}

/** Редирект уже авторизованных юзеров с /login на их дашборд. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (status === "authenticated" && user) {
      const target =
        user.role === "ADMIN"
          ? "/admin"
          : user.role === "COACH"
            ? user.clubId
              ? "/coach"
              : "/coach/onboarding"
            : "/athlete/onboarding";
      navigate({ to: target });
    }
  }, [mounted, status, user, navigate]);

  if (!mounted) return null;
  if (status === "loading") return null;
  return <>{children}</>;
}
