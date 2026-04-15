import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, DataTable } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { getClubById, getClubs, ClubMember } from '@/api/clubs';
import { getMyProfile } from '@/api/users';

const CoachAthletes: React.FC = () => {
  const [athletes, setAthletes] = useState<ClubMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const profile = await getMyProfile();
        const clubs = await getClubs();
        const ownClub = clubs.find((item) => item.coachId?._id === profile._id);

        if (!ownClub) {
          setAthletes([]);
          return;
        }

        const details = await getClubById(ownClub._id);
        setAthletes(details.members);
      } catch {
        setError('Спортшылар тізімін жүктеу мүмкін болмады');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <AppLayout title={kz.nav.athletes}>
      <div className="space-y-6 animate-slide-in">
        <SectionTitle>{kz.dashboard.myAthletes}</SectionTitle>

        {isLoading && <p className="text-sm text-muted-foreground">Жүктелуде...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!isLoading && !error && (
          <DataTable headers={[kz.table.name, kz.table.weight, kz.table.rank, 'Қала', 'Статус']}>
            {athletes.map((athlete) => (
              <tr key={athlete._id} className="hover:bg-navy-light/50">
                <td className="px-4 py-3 text-sm font-medium text-foreground">{athlete.fullName}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{athlete.weight ? `${athlete.weight} кг` : '-'}</td>
                <td className="px-4 py-3 text-sm text-primary">{athlete.rank || '-'}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{athlete.city || '-'}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{athlete.status}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </AppLayout>
  );
};

export default CoachAthletes;
