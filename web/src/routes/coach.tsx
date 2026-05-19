import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/coach")({
  component: CoachLayout,
});

function CoachLayout() {
  return <Outlet />;
}
