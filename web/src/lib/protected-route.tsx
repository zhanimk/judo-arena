/**
 * Хелперы для защищённых маршрутов.
 * Использует TanStack Router + наш auth-store.
 */

import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, UserRole } from "./auth-store";

export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: Exclude<UserRole, "JUDGE">[];
}) {
  const { user, status } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

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
          user.role === "ADMIN" ? "/admin" :
          user.role === "COACH" ? "/coach" :
          "/athlete";
        navigate({ to: target });
      }
    }
  }, [mounted, status, user, allowedRoles, navigate]);

  if (!mounted) return null;

  if (status === "loading" || status === "idle") {
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
        user.role === "ADMIN" ? "/admin" :
        user.role === "COACH" ? "/coach" :
        "/athlete";
      navigate({ to: target });
    }
  }, [mounted, status, user, navigate]);

  if (!mounted) return null;
  if (status === "loading") return null;
  return <>{children}</>;
}
