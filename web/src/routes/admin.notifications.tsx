import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/lib/protected-route";
import { useTranslation } from "react-i18next";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({ meta: [{ title: "Уведомления — Judo Child League" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminNotifications />
    </ProtectedRoute>
  ),
});

function AdminNotifications() {
  const { t } = useTranslation();
  return (
    <NotificationsView
      roleLabel={t("admin.role_label", { defaultValue: "Администратор" })}
      navItems={nav}
    />
  );
}
