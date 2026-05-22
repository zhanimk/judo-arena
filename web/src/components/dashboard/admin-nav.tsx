import {
  LayoutDashboard, Users, Trophy, ShieldAlert, Settings,
  Bell, FileText, Star,
} from "lucide-react";

export const adminNav = [
  { to: "/admin", label: "Шолу", icon: LayoutDashboard },
  { to: "/admin/tournaments", label: "Жарыстар", icon: Trophy },
  { to: "/admin/clubs", label: "Клубтар & Спортшылар", icon: Users },
  { to: "/admin/protocols", label: "Хаттамалар", icon: FileText },
  { to: "/admin/notifications", label: "Хабарландырулар", icon: Bell },
  { to: "/admin/audit", label: "Аудит", icon: ShieldAlert },
  { to: "/admin/settings", label: "Баптаулар", icon: Settings },
];
