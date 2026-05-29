/**
 * Redirects /admin/audit → /admin/reports (Аудит tab is now inside Есептер)
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/audit")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/reports" });
  },
  component: () => null,
});
