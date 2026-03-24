import React, { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge, DataTable } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoJoinRequests, SiteJoinRequest } from '@/lib/demo-data';
import { Check, X, Search, Eye, UserPlus, Building2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const typeLabels: Record<string, string> = {
  site: kz.application.typeSite,
  club: kz.application.typeClub,
  team: kz.application.typeTeam,
};

const typeIcons: Record<string, React.ReactNode> = {
  site: <UserPlus size={14} />,
  club: <Building2 size={14} />,
  team: <Users size={14} />,
};

const AdminApplications: React.FC = () => {
  const [filter, setFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [requests, setRequests] = useState<SiteJoinRequest[]>(demoJoinRequests);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = requests.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    return true;
  });

  const updateStatus = (id: string, status: 'approved' | 'rejected') => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <AppLayout title={kz.nav.applications}>
      <div className="space-y-6 animate-slide-in">
        <div className="flex items-center justify-between">
          <SectionTitle>{kz.application.review}</SectionTitle>
          <span className="text-sm text-muted-foreground">
            {kz.status.pending}: <span className="text-warning font-semibold">{pendingCount}</span>
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="pl-9 pr-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary w-60" placeholder={kz.table.search} />
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">{kz.application.filterByStatus}: {kz.application.all}</option>
            <option value="pending">{kz.status.pending}</option>
            <option value="approved">{kz.status.approved}</option>
            <option value="rejected">{kz.status.rejected}</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">{kz.application.filterByCategory}: {kz.application.typeAll}</option>
            <option value="site">{kz.application.typeSite}</option>
            <option value="club">{kz.application.typeClub}</option>
            <option value="team">{kz.application.typeTeam}</option>
          </select>
          <div className="ml-auto flex gap-2">
            <Button variant="success" size="sm" className="gap-1" onClick={() => {
              setRequests(prev => prev.map(r => r.status === 'pending' ? { ...r, status: 'approved' } : r));
            }}><Check size={14} /> {kz.application.bulkApprove}</Button>
            <Button variant="destructive" size="sm" className="gap-1" onClick={() => {
              setRequests(prev => prev.map(r => r.status === 'pending' ? { ...r, status: 'rejected' } : r));
            }}><X size={14} /> {kz.application.bulkReject}</Button>
          </div>
        </div>

        {/* Table */}
        <DataTable headers={[kz.application.applicantType, kz.application.applicantName, kz.users.email, kz.users.phone, kz.users.role, kz.application.requestDate, kz.tournament.status, kz.table.actions]}>
          {filtered.map(r => (
            <React.Fragment key={r.id}>
              <tr className="hover:bg-navy-light/50 transition-colors">
                <td className="px-4 py-3 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {typeIcons[r.type]} {typeLabels[r.type]}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-foreground">
                  {r.name}
                  {r.clubName && <span className="block text-xs text-muted-foreground">{r.clubName}</span>}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{r.email}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{r.phone}</td>
                <td className="px-4 py-3 text-sm text-primary font-medium">{r.role}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{r.submittedAt}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {r.status === 'pending' ? (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => updateStatus(r.id, 'approved')}><Check size={14} /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => updateStatus(r.id, 'rejected')}><X size={14} /></Button>
                      </>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}><Eye size={14} /></Button>
                  </div>
                </td>
              </tr>
              {expandedId === r.id && (
                <tr>
                  <td colSpan={8} className="px-4 py-3 bg-navy-light/30">
                    <div className="text-sm space-y-1">
                      <p className="text-muted-foreground"><span className="text-foreground font-medium">{kz.application.notes}:</span> {r.notes || '—'}</p>
                      <p className="text-muted-foreground"><span className="text-foreground font-medium">{kz.application.contactInfo}:</span> {r.email} · {r.phone}</p>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </DataTable>

        {filtered.length === 0 && (
          <div className="card-premium p-12 text-center">
            <p className="text-muted-foreground">{kz.application.noApplications}</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminApplications;
