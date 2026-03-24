import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoAthletes } from '@/lib/demo-data';
import { User, MapPin, Award, Dumbbell } from 'lucide-react';

const AthleteProfile: React.FC = () => {
  const me = demoAthletes[0];
  return (
    <AppLayout title={kz.nav.profile}>
      <div className="max-w-2xl space-y-6 animate-slide-in">
        <div className="card-premium p-6 flex items-center gap-6">
          <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center text-2xl font-bold text-primary-foreground">
            {me.name.charAt(0)}
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-display font-bold text-foreground">{me.name}</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-2"><MapPin size={14} /> {me.region}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Award size={14} /> {me.rank}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Dumbbell size={14} /> {me.weight} кг · {me.category}</p>
          </div>
        </div>

        <SectionTitle>{kz.dashboard.performance}</SectionTitle>
        <div className="card-premium p-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-display font-bold text-success">{me.wins}</p>
              <p className="text-xs text-muted-foreground">{kz.table.wins}</p>
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-destructive">{me.losses}</p>
              <p className="text-xs text-muted-foreground">{kz.table.losses}</p>
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-primary">{Math.round(me.wins / (me.wins + me.losses) * 100)}%</p>
              <p className="text-xs text-muted-foreground">Жеңіс пайызы</p>
            </div>
          </div>
        </div>

        <SectionTitle>{kz.nav.clubs}</SectionTitle>
        <div className="card-premium p-4">
          <h4 className="font-medium text-foreground">{me.club}</h4>
          <p className="text-sm text-muted-foreground">{me.region}</p>
        </div>
      </div>
    </AppLayout>
  );
};

export default AthleteProfile;
