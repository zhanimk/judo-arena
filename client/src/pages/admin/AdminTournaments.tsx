import React, { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge, DataTable } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoTournaments } from '@/lib/demo-data';
import { Plus, Search, Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const AdminTournaments: React.FC = () => {
  const [showForm, setShowForm] = useState(false);

  return (
    <AppLayout title={kz.nav.tournaments}>
      <div className="space-y-6 animate-slide-in">
        <div className="flex items-center justify-between">
          <SectionTitle>{kz.nav.tournaments}</SectionTitle>
          <Button variant="gold" size="sm" className="gap-1" onClick={() => setShowForm(!showForm)}>
            <Plus size={14} /> {kz.tournament.create}
          </Button>
        </div>

        {showForm && (
          <div className="card-premium p-6 space-y-4">
            <h3 className="font-display font-semibold text-foreground">{kz.tournament.create}</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.tournament.name}</label>
                <input className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.tournament.location}</label>
                <input className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.tournament.date}</label>
                <input type="date" className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.tournament.endDate}</label>
                <input type="date" className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.tournament.boutDuration} ({kz.tournament.boutDurationMin})</label>
                <select className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="180">3 {kz.tournament.boutDurationMin}</option>
                  <option value="240">4 {kz.tournament.boutDurationMin}</option>
                  <option value="300">5 {kz.tournament.boutDurationMin}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.tournament.maxParticipants}</label>
                <input type="number" className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{kz.tournament.ageGroups}</label>
              <div className="flex gap-2 flex-wrap">
                {['Кадеттер (U15)', 'Юниорлар (U18)', 'Юниорлар (U21)', 'Ересектер'].map(g => (
                  <label key={g} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-navy-surface text-xs text-muted-foreground cursor-pointer hover:border-primary/50">
                    <input type="checkbox" className="accent-[hsl(43,90%,55%)]" /> {g}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{kz.tournament.weightCategories}</label>
              <div className="flex gap-2 flex-wrap">
                {['-60кг', '-66кг', '-73кг', '-81кг', '-90кг', '-100кг', '+100кг'].map(w => (
                  <label key={w} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-navy-surface text-xs text-muted-foreground cursor-pointer hover:border-primary/50">
                    <input type="checkbox" className="accent-[hsl(43,90%,55%)]" /> {w}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{kz.tournament.description}</label>
              <textarea rows={3} className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex gap-2">
              <Button variant="gold" size="sm">{kz.common.save}</Button>
              <Button variant="navy" size="sm" onClick={() => setShowForm(false)}>{kz.common.cancel}</Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="w-full pl-9 pr-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder={kz.table.search} />
          </div>
        </div>

        <DataTable headers={[kz.tournament.name, kz.tournament.date, kz.tournament.location, kz.tournament.status, kz.tournament.participants, kz.tournament.boutDuration, kz.table.actions]}>
          {demoTournaments.map(t => (
            <tr key={t.id} className="hover:bg-navy-light/50 transition-colors">
              <td className="px-4 py-3 text-sm font-medium text-foreground">{t.name}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{t.date}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{t.location}</td>
              <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{t.participants}/{t.maxParticipants}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{t.boutDuration / 60} {kz.tournament.boutDurationMin}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <Link to={`/admin/tournaments/${t.id}`}><Button variant="ghost" size="icon" className="h-7 w-7"><Eye size={14} /></Button></Link>
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Edit size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 size={14} /></Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
    </AppLayout>
  );
};

export default AdminTournaments;
