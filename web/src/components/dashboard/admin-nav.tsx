/**
 * Единое меню админ-панели.
 *
 * ВАЖНО (архитектура):
 *   Всё что внутри ОДНОГО турнира (категории, заявки, сетки, матчи, уведомления
 *   участникам, аудит этого турнира) — находится ВНУТРИ /admin/tournaments/$id
 *   (там есть табы). Сюда в боковое меню выводятся только ГЛОБАЛЬНЫЕ модули,
 *   не привязанные к конкретному турниру.
 */

import {
  LayoutDashboard, Users, Trophy, ShieldAlert, Settings,
  GitBranch,
} from "lucide-react";

export const adminNav = [
  { to: "/admin", label: "Шолу", icon: LayoutDashboard },
  { to: "/admin/tournaments", label: "Жарыстар", icon: Trophy },
  { to: "/admin/clubs", label: "Клубтар", icon: Users },
  { to: "/admin/users", label: "Спортшылар", icon: GitBranch },
  { to: "/admin/audit", label: "Аудит", icon: ShieldAlert },
  { to: "/admin/settings", label: "Баптаулар", icon: Settings },
];
