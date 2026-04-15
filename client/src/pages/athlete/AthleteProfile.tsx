import React, { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { MapPin, Award, Dumbbell } from 'lucide-react';
import { getMyProfile } from '@/api/users';
import { getClubById } from '@/api/clubs';

const AthleteProfile: React.FC = () => {
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getMyProfile>> | null>(null);
  const [clubName, setClubName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const me = await getMyProfile();
        setProfile(me);

        const clubId = typeof me.clubId === 'string' ? me.clubId : me.clubId?._id;
        if (clubId) {
          const club = await getClubById(clubId);
          setClubName(club.club.name);
        }
      } catch {
        setError('Профиль ақпаратын жүктеу мүмкін болмады');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const firstLetter = useMemo(() => profile?.fullName?.charAt(0)?.toUpperCase() || 'A', [profile]);

  return (
    <AppLayout title={kz.nav.profile}>
      <div className="max-w-2xl space-y-6 animate-slide-in">
        {isLoading && <p className="text-sm text-muted-foreground">Жүктелуде...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!isLoading && !error && profile && (
          <>
            <div className="card-premium p-6 flex items-center gap-6">
              <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center text-2xl font-bold text-primary-foreground">
                {firstLetter}
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-display font-bold text-foreground">{profile.fullName}</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-2"><MapPin size={14} /> {profile.city || '-'}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-2"><Award size={14} /> {profile.rank || '-'}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-2"><Dumbbell size={14} /> {profile.weight ? `${profile.weight} кг` : '-'} </p>
              </div>
            </div>

            <SectionTitle>{kz.nav.clubs}</SectionTitle>
            <div className="card-premium p-4">
              <h4 className="font-medium text-foreground">{clubName || '-'}</h4>
              <p className="text-sm text-muted-foreground">{profile.city || '-'}</p>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default AthleteProfile;
