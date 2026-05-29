import {
  Activity,
  Bell,
  LayoutDashboard,
  Swords,
  Trophy,
  User,
} from "lucide-react";

export const athleteNav = [
  { to: "/athlete", label: "Шолу", icon: LayoutDashboard },
  { to: "/athlete/profile", label: "Профиль", icon: User },
  { to: "/athlete/tournaments", label: "Жарыстар", icon: Trophy },
  { to: "/athlete/matches", label: "Жекпе-жектер", icon: Swords },
  { to: "/athlete/results", label: "Нәтижелер", icon: Activity },
  { to: "/athlete/notifications", label: "Хабарландырулар", icon: Bell },
];
