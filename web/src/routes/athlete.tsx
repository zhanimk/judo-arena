import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/athlete")({
  component: AthleteLayout,
});

// Layout-роут: подстраницы рендерятся через Outlet.
// Подстраницы:
//   athlete.index.tsx     → /athlete           (Шолу)
//   athlete.profile.tsx   → /athlete/profile   (Профиль)
//   athlete.tournaments.tsx → /athlete/tournaments
//   athlete.results.tsx   → /athlete/results
//   athlete.notifications.tsx → /athlete/notifications
function AthleteLayout() {
  return <Outlet />;
}
