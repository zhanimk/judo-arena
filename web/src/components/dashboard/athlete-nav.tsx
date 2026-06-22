import { Activity, Bell, LayoutDashboard, Trophy, User } from "lucide-react";

export const athleteNav = [
  { to: "/athlete", label: "dashboard.overview", icon: LayoutDashboard },
  { to: "/athlete/profile", label: "dashboard.profile", icon: User },
  { to: "/athlete/tournaments", label: "dashboard.tournaments", icon: Trophy },
  { to: "/athlete/results", label: "dashboard.results", icon: Activity },
  { to: "/athlete/notifications", label: "dashboard.notifications", icon: Bell },
];
