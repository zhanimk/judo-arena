import {
  Bell,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Trophy,
  User,
  Users,
} from "lucide-react";

export const coachNav = [
  { to: "/coach", label: "Шолу", icon: LayoutDashboard },
  { to: "/coach/profile", label: "Профиль", icon: User },
  { to: "/coach/club", label: "Клуб", icon: Building2 },
  { to: "/coach/athletes", label: "Спортшылар", icon: Users },
  { to: "/coach/applications", label: "Өтінімдер", icon: ClipboardList },
  { to: "/coach/tournaments", label: "Жарыстар", icon: Trophy },
  { to: "/coach/notifications", label: "Хабарландырулар", icon: Bell },
];
