import { Bell, Building2, LayoutDashboard, Trophy, User, Users, BarChart } from "lucide-react";

export const coachNav = [
  { to: "/coach", label: "dashboard.overview", icon: LayoutDashboard },
  { to: "/coach/profile", label: "dashboard.profile", icon: User },
  { to: "/coach/club", label: "dashboard.my_club", icon: Building2 },
  { to: "/coach/athletes", label: "dashboard.athletes", icon: Users },
  { to: "/coach/analytics", label: "dashboard.analytics", icon: BarChart },
  { to: "/coach/tournaments", label: "dashboard.tournaments", icon: Trophy },
  { to: "/coach/notifications", label: "dashboard.notifications", icon: Bell },
];
