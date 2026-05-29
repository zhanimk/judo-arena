/**
 * Redirects /admin/protocols → /admin/reports (Хаттамалар tab is now inside Есептер)
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/protocols")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/reports" });
  },
  component: () => null,
});
