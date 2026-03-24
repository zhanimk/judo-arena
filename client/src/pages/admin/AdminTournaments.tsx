import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge, DataTable } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { createTournament, getTournaments } from '@/api/tournaments';
import { Plus, Search, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

function mapTournamentStatus(status: string): string {
  switch (status) {
    case 'REGISTRATION_OPEN':
      return 'upcoming';
    case 'REGISTRATION_CLOSED':
    case 'BRACKETS_GENERATED':
    case 'IN_PROGRESS':
    case 'PAUSED':
      return 'active';
    case 'COMPLETED':
    case 'ARCHIVED':
      return 'completed';
    case 'DRAFT':
    default:
      return 'draft';
  }
}

const AdminTournaments: React.FC = () => {
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [tatamiCount, setTatamiCount] = useState(2);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const tournamentsQuery = useQuery({
    queryKey: ['tournaments'],
    queryFn: getTournaments,
  });

  const createMutation = useMutation({
    mutationFn: createTournament,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setShowForm(false);
      setTitle('');
      setLocation('');
      setStartDate('');
      setEndDate('');
      setRegistrationDeadline('');
      setTatamiCount(2);
      setErrorMessage(null);
    },
    onError: () => {
      setErrorMessage('Failed to create tournament. Check required fields.');
    },
  });

  const tournaments = tournamentsQuery.data || [];

  const filteredTournaments = useMemo(
    () =>
      tournaments.filter((t) =>
        `${t.title} ${t.location}`.toLowerCase().includes(search.toLowerCase())
      ),
    [search, tournaments]
  );

  const onCreate = (event: React.FormEvent) => {
    event.preventDefault();

    createMutation.mutate({
      title,
      location,
      startDate,
      endDate,
      registrationDeadline,
      tatamiCount,
      categories: [],
    });
  };

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
          <form className="card-premium p-6 space-y-4" onSubmit={onCreate}>
            <h3 className="font-display font-semibold text-foreground">{kz.tournament.create}</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.tournament.name}</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.tournament.location}</label>
                <input
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.tournament.date}</label>
                <input
                  required
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{kz.tournament.endDate}</label>
                <input
                  required
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Registration deadline</label>
                <input
                  required
                  type="date"
                  value={registrationDeadline}
                  onChange={(e) => setRegistrationDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Tatami count</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={tatamiCount}
                  onChange={(e) => setTatamiCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {errorMessage && <div className="text-xs text-destructive">{errorMessage}</div>}

            <div className="flex gap-2">
              <Button type="submit" variant="gold" size="sm" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : kz.common.save}
              </Button>
              <Button type="button" variant="navy" size="sm" onClick={() => setShowForm(false)}>{kz.common.cancel}</Button>
            </div>
          </form>
        )}

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={kz.table.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {tournamentsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading tournaments...</div>}
        {tournamentsQuery.isError && <div className="text-sm text-destructive">Failed to load tournaments.</div>}

        {!tournamentsQuery.isLoading && !tournamentsQuery.isError && (
          <DataTable headers={[kz.tournament.name, kz.tournament.date, kz.tournament.location, kz.tournament.status, kz.tournament.categories, 'Tatami', kz.table.actions]}>
            {filteredTournaments.map((t) => (
              <tr key={t._id} className="hover:bg-navy-light/50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-foreground">{t.title}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(t.startDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{t.location}</td>
                <td className="px-4 py-3"><StatusBadge status={mapTournamentStatus(t.status)} /></td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{t.categories.length}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{t.tatamiCount}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Link to={`/admin/tournaments/${t._id}`}><Button variant="ghost" size="icon" className="h-7 w-7"><Eye size={14} /></Button></Link>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminTournaments;
