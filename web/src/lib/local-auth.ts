// Жергілікті аутентификация (admin/organizer/judge үшін)
export type LocalRole = "admin" | "judge";

export const LOCAL_CREDENTIALS: Record<string, { password: string; role: LocalRole; route: string; name: string }> = {
  admin: { password: "admin123", role: "admin", route: "/admin", name: "Әкімші" },
  judge: { password: "judge123", role: "judge", route: "/judge", name: "Төреші" },
};

export function tryLocalLogin(username: string, password: string) {
  const u = LOCAL_CREDENTIALS[username.trim().toLowerCase()];
  if (u && u.password === password) return u;
  return null;
}
