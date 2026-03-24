export type UserRole = 'athlete' | 'coach' | 'admin' | 'judge';

export interface Tournament {
  id: string;
  name: string;
  date: string;
  endDate: string;
  location: string;
  status: 'upcoming' | 'active' | 'completed' | 'draft';
  categories: string[];
  participants: number;
  maxParticipants: number;
  boutDuration: number; // seconds
  description: string;
  organizer: string;
}

export interface Athlete {
  id: string;
  name: string;
  club: string;
  weight: number;
  age: number;
  category: string;
  rank: string;
  wins: number;
  losses: number;
  region: string;
}

export interface Application {
  id: string;
  athleteName: string;
  clubName: string;
  tournamentName: string;
  category: string;
  weight: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  coachName: string;
}

export interface Match {
  id: string;
  round: number;
  athlete1: string;
  athlete2: string;
  score1: string;
  score2: string;
  winner?: string;
  status: 'scheduled' | 'active' | 'completed';
  tatami: number;
  category: string;
}

export interface Club {
  id: string;
  name: string;
  city: string;
  coach: string;
  athleteCount: number;
  founded: number;
  region: string;
}

export interface MatchAction {
  type: 'ippon' | 'wazaari' | 'uko' | 'shido' | 'hansoku';
  athlete: 1 | 2;
  time: number;
}
