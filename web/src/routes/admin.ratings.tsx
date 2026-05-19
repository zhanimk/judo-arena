import { Navigate, createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/lib/protected-route";

export const Route = createFileRoute("/admin/ratings")({
  head: () => ({ meta: [{ title: "Рейтинг — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <Navigate to="/admin/users" replace />
    </ProtectedRoute>
  ),
});
