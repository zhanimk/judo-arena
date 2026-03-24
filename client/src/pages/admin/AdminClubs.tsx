import React, { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoClubs, demoUsers } from '@/lib/demo-data';
import { Club } from '@/lib/types';
import { Search, Users, MapPin, Plus, Edit, Trash2, X, Building2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

const inputCls = 'w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary';

const AdminClubs: React.FC = () => {
  const [clubs, setClubs] = useState<Club[]>(demoClubs);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [expandedClub, setExpandedClub] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', city: '', region: '', coach: '', founded: 2024 });

  const filtered = clubs.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.city.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingClub(null);
    setForm({ name: '', city: '', region: '', coach: '', founded: 2024 });
    setShowForm(true);
  };

  const openEdit = (c: Club) => {
    setEditingClub(c);
    setForm({ name: c.name, city: c.city, region: c.region, coach: c.coach, founded: c.founded });
    setShowForm(true);
  };

  const saveClub = () => {
    if (editingClub) {
      setClubs(prev => prev.map(c => c.id === editingClub.id ? { ...c, ...form } : c));
    } else {
      const newClub: Club = { id: `c${Date.now()}`, ...form, athleteCount: 0 };
      setClubs(prev => [newClub, ...prev]);
    }
    setShowForm(false);
  };

  const deleteClub = (id: string) => {
    setClubs(prev => prev.filter(c => c.id !== id));
  };

  // Members of the club from demo users
  const getClubMembers = (clubName: string) => demoUsers.filter(u => u.club === clubName);

  return (
    <AppLayout title={kz.nav.clubs}>
      <div className="space-y-6 animate-slide-in">
        <div className="flex items-center justify-between">
          <SectionTitle>{kz.nav.clubs}</SectionTitle>
          <Button variant="gold" size="sm" className="gap-1" onClick={openCreate}>
            <Plus size={14} /> {kz.clubs.addClub}
          </Button>
        </div>

        {/* Create / Edit Form */}
        {showForm && (
          <div className="card-premium p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground">
                {editingClub ? kz.clubs.editClub : kz.clubs.addClub}
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowForm(false)}><X size={16} /></Button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.clubs.clubName}</label>
                <input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.clubs.city}</label>
                <input className={inputCls} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.clubs.region}</label>
                <input className={inputCls} value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.clubs.coach}</label>
                <input className={inputCls} value={form.coach} onChange={e => setForm({ ...form, coach: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.clubs.founded}</label>
                <input type="number" className={inputCls} value={form.founded} onChange={e => setForm({ ...form, founded: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="gold" size="sm" onClick={saveClub}>{kz.common.save}</Button>
              <Button variant="navy" size="sm" onClick={() => setShowForm(false)}>{kz.common.cancel}</Button>
            </div>
          </div>
        )}

        <div className="relative max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="w-full pl-9 pr-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder={kz.table.search} value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => {
            const members = getClubMembers(c.name);
            const isExpanded = expandedClub === c.id;
            return (
              <div key={c.id} className="card-premium p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-display font-semibold text-foreground">{c.name}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Edit size={14} /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteClub(c.id)}><Trash2 size={14} /></Button>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><MapPin size={14} /> {c.city}, {c.region}</p>
                  <p className="flex items-center gap-2"><Users size={14} /> {c.athleteCount} {kz.nav.athletes.toLowerCase()}</p>
                  <p className="flex items-center gap-2"><Building2 size={14} /> {kz.clubs.coach}: {c.coach}</p>
                  <p className="flex items-center gap-2"><Calendar size={14} /> {kz.clubs.founded}: {c.founded} ж.</p>
                </div>

                {/* Expandable member list */}
                <Button variant="ghost" size="sm" className="mt-3 text-xs w-full" onClick={() => setExpandedClub(isExpanded ? null : c.id)}>
                  {isExpanded ? kz.common.close : `${kz.nav.users} (${members.length})`}
                </Button>
                {isExpanded && (
                  <div className="mt-2 space-y-1 border-t border-border pt-2">
                    {members.length > 0 ? members.map(m => (
                      <div key={m.id} className="flex items-center justify-between text-xs text-muted-foreground py-1">
                        <span className="text-foreground">{m.name}</span>
                        <span className="text-primary">{m.role}</span>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground">{kz.table.noData}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminClubs;
