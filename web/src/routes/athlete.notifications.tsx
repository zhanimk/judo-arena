import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/lib/protected-route";
import { useTranslation } from "react-i18next";
import { athleteNav as nav } from "@/components/dashboard/athlete-nav";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export const Route = createFileRoute("/athlete/notifications")({
  head: () => ({ meta: [{ title: "Хабарландырулар — Judo Child League" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <AthleteNotifications />
    </ProtectedRoute>
  ),
});

function AthleteNotifications() {
  const { t } = useTranslation();
  return <NotificationsView roleLabel={t("athlete.role_label")} navItems={nav} />;
}
