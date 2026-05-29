/**
 * Redirects /admin/ratings → /admin/clubs (Рейтинг tab is now inside Пайдаланушылар)
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/ratings")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/clubs" });
  },
  component: () => null,
});
