import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/lib/protected-route";
import { useTranslation } from "react-i18next";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export const Route = createFileRoute("/coach/notifications")({
  head: () => ({ meta: [{ title: "Хабарландырулар — Judo Child League" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachNotifications />
    </ProtectedRoute>
  ),
});

function CoachNotifications() {
  const { t } = useTranslation();
  return <NotificationsView roleLabel={t("coach.role_label")} navItems={nav} />;
}
