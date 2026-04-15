import React, { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { getClubById, getClubs, ClubEntity, ClubMember } from '@/api/clubs';
import { Search, Users, MapPin, Building2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AdminClubs: React.FC = () => {
  const [clubs, setClubs] = useState<ClubEntity[]>([]);
  const [search, setSearch] = useState('');
  const [expandedClubId, setExpandedClubId] = useState<string | null>(null);
  const [membersByClub, setMembersByClub] = useState<Record<string, ClubMember[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getClubs();
        setClubs(data);
      } catch {
        setError('Клубтарды жүктеу кезінде қате орын алды');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clubs;
    return clubs.filter(
      (club) =>
        club.name.toLowerCase().includes(query) || club.city.toLowerCase().includes(query)
    );
  }, [clubs, search]);

  const toggleMembers = async (clubId: string) => {
    if (expandedClubId === clubId) {
      setExpandedClubId(null);
      return;
    }

    setExpandedClubId(clubId);

    if (membersByClub[clubId]) {
      return;
    }

    try {
      const result = await getClubById(clubId);
      setMembersByClub((prev) => ({ ...prev, [clubId]: result.members }));
    } catch {
      setMembersByClub((prev) => ({ ...prev, [clubId]: [] }));
    }
  };

  return (
    <AppLayout title={kz.nav.clubs}>
      <div className="space-y-6 animate-slide-in">
        <SectionTitle>{kz.nav.clubs}</SectionTitle>

        <div className="relative max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={kz.table.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Жүктелуде...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!isLoading && filtered.map((club) => {
            const members = membersByClub[club._id] || [];
            const isExpanded = expandedClubId === club._id;
            return (
              <div key={club._id} className="card-premium p-5">
                <h3 className="font-display font-semibold text-foreground mb-2">{club.name}</h3>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><MapPin size={14} /> {club.city}</p>
                  <p className="flex items-center gap-2"><Building2 size={14} /> {kz.clubs.coach}: {club.coachId?.fullName || '-'}</p>
                  <p className="flex items-center gap-2"><Calendar size={14} /> {new Date(club.createdAt || Date.now()).toLocaleDateString()}</p>
                  <p className="flex items-center gap-2"><Users size={14} /> {members.length} {kz.nav.athletes.toLowerCase()}</p>
                </div>

                <Button variant="ghost" size="sm" className="mt-3 text-xs w-full" onClick={() => void toggleMembers(club._id)}>
                  {isExpanded ? kz.common.close : `${kz.nav.users} (${members.length})`}
                </Button>
                {isExpanded && (
                  <div className="mt-2 space-y-1 border-t border-border pt-2">
                    {members.length > 0 ? members.map((member) => (
                      <div key={member._id} className="flex items-center justify-between text-xs text-muted-foreground py-1">
                        <span className="text-foreground">{member.fullName}</span>
                        <span className="text-primary">{member.rank || '-'}</span>
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
