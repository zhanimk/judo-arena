import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoClubs } from '@/lib/demo-data';
import { Users, MapPin, Calendar } from 'lucide-react';

const CoachClub: React.FC = () => {
  const club = demoClubs[0];
  return (
    <AppLayout title={kz.nav.clubs}>
      <div className="max-w-2xl space-y-6 animate-slide-in">
        <div className="card-premium p-6">
          <h2 className="text-xl font-display font-bold text-foreground mb-3">{club.name}</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2"><MapPin size={14} /> {club.city}, {club.region}</p>
            <p className="flex items-center gap-2"><Users size={14} /> {club.athleteCount} спортшы</p>
            <p className="flex items-center gap-2"><Calendar size={14} /> Құрылған: {club.founded} ж.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CoachClub;
