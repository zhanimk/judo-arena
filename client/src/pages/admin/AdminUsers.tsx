import React, { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge, DataTable } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoUsers, DemoUser } from '@/lib/demo-data';
import { Search, Plus, Edit, Trash2, Ban, CheckCircle, X, UserPlus, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

const inputCls = 'w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary';

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<DemoUser[]>(demoUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<DemoUser | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'Спортшы', club: '' });

  const roles = [...new Set(demoUsers.map(u => u.role))];

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCreate = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', phone: '', role: 'Спортшы', club: '' });
    setShowForm(true);
  };

  const openEdit = (u: DemoUser) => {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, phone: u.phone, role: u.role, club: u.club });
    setShowForm(true);
  };

  const saveUser = () => {
    if (editingUser) {
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...form } : u));
    } else {
      const newUser: DemoUser = {
        id: `u${Date.now()}`, ...form, registeredAt: new Date().toISOString().slice(0, 10),
        lastActive: new Date().toISOString().slice(0, 10), status: 'active',
      };
      setUsers(prev => [newUser, ...prev]);
    }
    setShowForm(false);
  };

  const toggleBlock = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === 'active' ? 'blocked' as const : 'active' as const } : u));
  };

  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  return (
    <AppLayout title={kz.nav.users}>
      <div className="space-y-6 animate-slide-in">
        <div className="flex items-center justify-between">
          <SectionTitle>{kz.nav.users}</SectionTitle>
          <Button variant="gold" size="sm" className="gap-1" onClick={openCreate}>
            <UserPlus size={14} /> {kz.users.addUser}
          </Button>
        </div>

        {/* Create / Edit Form */}
        {showForm && (
          <div className="card-premium p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground">
                {editingUser ? kz.users.editUser : kz.users.addUser}
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowForm(false)}><X size={16} /></Button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.table.name}</label>
                <input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.users.email}</label>
                <input className={inputCls} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.users.phone}</label>
                <input className={inputCls} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.users.role}</label>
                <select className={inputCls} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option>Спортшы</option>
                  <option>Жаттықтырушы</option>
                  <option>Төреші</option>
                  <option>Әкімші</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.table.club}</label>
                <input className={inputCls} value={form.club} onChange={e => setForm({ ...form, club: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="gold" size="sm" onClick={saveUser}>{kz.common.save}</Button>
              <Button variant="navy" size="sm" onClick={() => setShowForm(false)}>{kz.common.cancel}</Button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="w-full pl-9 pr-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder={kz.table.search} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">{kz.users.filterByRole}: {kz.users.allRoles}</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <span className="text-xs text-muted-foreground ml-auto">{kz.common.total}: {filtered.length}</span>
        </div>

        {/* Table */}
        <DataTable headers={[kz.table.name, kz.users.email, kz.users.phone, kz.users.role, kz.table.club, kz.users.registeredAt, kz.users.lastActive, kz.users.status, kz.table.actions]}>
          {filtered.map(u => (
            <tr key={u.id} className="hover:bg-navy-light/50 transition-colors">
              <td className="px-4 py-3 text-sm font-medium text-foreground">{u.name}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{u.phone}</td>
              <td className="px-4 py-3 text-sm text-primary font-medium">{u.role}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{u.club}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{u.registeredAt}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{u.lastActive}</td>
              <td className="px-4 py-3">
                <StatusBadge status={u.status === 'active' ? 'approved' : 'rejected'} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title={kz.users.editUser} onClick={() => openEdit(u)}><Edit size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title={u.status === 'active' ? kz.users.blockUser : kz.users.unblockUser} onClick={() => toggleBlock(u.id)}>
                    {u.status === 'active' ? <Ban size={14} /> : <CheckCircle size={14} className="text-success" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title={kz.users.resetPassword}><KeyRound size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title={kz.users.deleteUser} onClick={() => deleteUser(u.id)}><Trash2 size={14} /></Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
    </AppLayout>
  );
};

export default AdminUsers;
