import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { Building2, LayoutDashboard, Users, ClipboardList, Trophy, Bell, UserPlus, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";

export const Route = createFileRoute("/coach/athletes")({
  head: () => ({ meta: [{ title: "Спортшылар — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachAthletes />
    </ProtectedRoute>
  ),
});

const nav = [
  { to: "/coach", label: "Шолу", icon: LayoutDashboard },
  { to: "/coach/club", label: "Клуб", icon: Building2 },
  { to: "/coach/athletes", label: "Спортшылар", icon: Users },
  { to: "/coach/applications", label: "Өтінімдер", icon: ClipboardList },
  { to: "/coach/tournaments", label: "Жарыстар", icon: Trophy },
  { to: "/coach/notifications", label: "Хабарландырулар", icon: Bell },
];

function CoachAthletes() {
  const { user } = useAuth();
  const clubId = user?.clubId;
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const membersQuery = useQuery({
    queryKey: ["club-members", clubId],
    queryFn: () => (clubId ? api.clubs.members(clubId) : []),
    enabled: !!clubId,
  });

  return (
    <DashboardShell role="Жаттықтырушы" navItems={nav} accentTitle="Менің спортшыларым">
      <Panel
        title={`Барлығы ${membersQuery.data?.length ?? 0}`}
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 text-sm bg-gradient-gold text-gold-foreground px-3 py-1.5 rounded-md shadow-gold"
          >
            <UserPlus className="h-4 w-4" /> {showForm ? "Жабу" : "Қосу"}
          </button>
        }
      >
        {showForm && clubId && (
          <AddAthleteForm clubId={clubId} onDone={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["club-members", clubId] }); }} />
        )}

        {membersQuery.isLoading ? <LoadingState /> :
          (membersQuery.data ?? []).length === 0 ? (
            <EmptyState title="Спортшылар жоқ" hint="Алғашқы спортшыңызды қосыңыз" />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40">
                  <tr><th className="py-2">Аты-жөні</th><th>Жыныс</th><th>Жасы</th><th>Салмақ</th><th>Белбеу</th></tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {(membersQuery.data ?? []).map((a: any) => (
                    <tr key={a.id} className="hover:bg-gold/5">
                      <td className="py-2.5 font-medium">{a.name} {a.surname}</td>
                      <td className="text-xs text-muted-foreground">{a.gender === "MALE" ? "Ер" : "Әйел"}</td>
                      <td className="text-xs text-muted-foreground">{a.dateOfBirth ? getAge(a.dateOfBirth) : "—"}</td>
                      <td className="text-xs">{a.weightKg ? `${a.weightKg} кг` : "—"}</td>
                      <td className="text-xs text-gold">{a.beltRank ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Panel>
    </DashboardShell>
  );
}

function AddAthleteForm({ clubId, onDone }: { clubId: string; onDone: () => void }) {
  const [form, setForm] = useState({
    email: "", password: "", name: "", surname: "",
    gender: "MALE" as "MALE" | "FEMALE", dateOfBirth: "", weightKg: "", beltRank: "",
  });
  const [error, setError] = useState("");
  const mut = useMutation({
    mutationFn: () =>
      api.clubs.addAthlete(clubId, {
        ...form,
        weightKg: Number(form.weightKg),
        dateOfBirth: new Date(form.dateOfBirth).toISOString(),
        preferredLocale: "kk",
      }),
    onSuccess: onDone,
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="mt-4 mb-6 glass rounded-lg p-4 grid gap-3 md:grid-cols-2">
      <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({...form, email: v})} required />
      <Input label="Бастапқы құпиясөз" type="password" value={form.password} onChange={(v) => setForm({...form, password: v})} required minLength={8} />
      <Input label="Аты" value={form.name} onChange={(v) => setForm({...form, name: v})} required />
      <Input label="Тегі" value={form.surname} onChange={(v) => setForm({...form, surname: v})} required />
      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground">Жыныс</label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(["MALE", "FEMALE"] as const).map((g) => (
            <button key={g} type="button" onClick={() => setForm({...form, gender: g})}
              className={`py-2 rounded-md text-sm border ${form.gender === g ? "bg-gold/15 text-gold border-gold/40" : "glass border-border"}`}>
              {g === "MALE" ? "Ер" : "Әйел"}
            </button>
          ))}
        </div>
      </div>
      <Input label="Туған күн" type="date" value={form.dateOfBirth} onChange={(v) => setForm({...form, dateOfBirth: v})} required />
      <Input label="Салмақ (кг)" type="number" step="0.1" value={form.weightKg} onChange={(v) => setForm({...form, weightKg: v})} required />
      <Input label="Белбеу" value={form.beltRank} onChange={(v) => setForm({...form, beltRank: v})} placeholder="мысалы 2 kyu" />

      {error && <div className="md:col-span-2 text-sm text-destructive">{error}</div>}
      <button disabled={mut.isPending} type="submit" className="md:col-span-2 bg-gradient-gold text-gold-foreground py-2.5 rounded-md font-medium shadow-gold inline-flex items-center justify-center gap-2 disabled:opacity-50">
        {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Қосу
      </button>
    </form>
  );
}

function Input({ label, value, onChange, ...rest }: any) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        {...rest}
        className="mt-1.5 w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:border-gold focus:outline-none" />
    </div>
  );
}

function getAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}
