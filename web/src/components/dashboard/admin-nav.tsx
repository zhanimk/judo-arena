import {
  LayoutDashboard, Users, Trophy, Settings,
  Bell, Activity, BarChart3,
} from "lucide-react";

export const adminNav = [
  { to: "/admin",               label: "Шолу",            icon: LayoutDashboard },
  { to: "/admin/tournaments",   label: "Жарыстар",        icon: Trophy },
  { to: "/admin/matches",       label: "Матчтар",         icon: Activity },
  { to: "/admin/clubs",         label: "Пайдаланушылар",  icon: Users },
  { to: "/admin/reports",       label: "Есептер",         icon: BarChart3 },
  { to: "/admin/notifications", label: "Хабарландырулар", icon: Bell },
  { to: "/admin/settings",      label: "Баптаулар",       icon: Settings },
];
