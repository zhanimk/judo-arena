import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { kz } from '@/lib/kz';
import { Users, MapPin, Calendar } from 'lucide-react';
import { getClubById, getClubs } from '@/api/clubs';
import { getMyProfile } from '@/api/users';

const CoachClub: React.FC = () => {
  const [club, setClub] = useState<{ name: string; city: string; createdAt?: string } | null>(null);
  const [membersCount, setMembersCount] = useState(0);
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
          setClub(null);
          return;
        }

        const details = await getClubById(ownClub._id);
        setClub({
          name: ownClub.name,
          city: ownClub.city,
          createdAt: ownClub.createdAt,
        });
        setMembersCount(details.members.length);
      } catch {
        setError('Клуб ақпаратын алу мүмкін болмады');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <AppLayout title={kz.nav.clubs}>
      <div className="max-w-2xl space-y-6 animate-slide-in">
        <div className="card-premium p-6">
          {isLoading && <p className="text-sm text-muted-foreground">Жүктелуде...</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!isLoading && !error && !club && <p className="text-sm text-muted-foreground">Сізде әлі клуб жоқ</p>}
          {!isLoading && !error && club && (
            <>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">{club.name}</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><MapPin size={14} /> {club.city}</p>
                <p className="flex items-center gap-2"><Users size={14} /> {membersCount} спортшы</p>
                <p className="flex items-center gap-2"><Calendar size={14} /> Құрылған: {new Date(club.createdAt || Date.now()).getFullYear()} ж.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default CoachClub;
