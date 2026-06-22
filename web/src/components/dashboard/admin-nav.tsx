import {
  LayoutDashboard,
  Users,
  Trophy,
  Settings,
  Bell,
  Activity,
  BarChart3,
  Megaphone,
} from "lucide-react";

export const adminNav = [
  { to: "/admin", label: "dashboard.overview", icon: LayoutDashboard },
  { to: "/admin/tournaments", label: "dashboard.tournaments", icon: Trophy },
  { to: "/admin/matches", label: "dashboard.matches", icon: Activity },
  { to: "/admin/clubs", label: "dashboard.users", icon: Users },
  { to: "/admin/reports", label: "dashboard.reports", icon: BarChart3 },
  { to: "/admin/notifications", label: "dashboard.notifications", icon: Bell },
  { to: "/admin/broadcasts", label: "dashboard.broadcasts", icon: Megaphone },
  { to: "/admin/settings", label: "dashboard.settings", icon: Settings },
];
