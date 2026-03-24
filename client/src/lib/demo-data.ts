import { Tournament, Athlete, Application, Match, Club } from './types';

export const demoTournaments: Tournament[] = [
  {
    id: 't1', name: 'Алматы Гран-При 2025', date: '2025-03-15', endDate: '2025-03-17',
    location: 'Алматы, Халықаралық спорт кешені', status: 'active',
    categories: ['Кадеттер', 'Юниорлар', 'Ересектер'], participants: 186, maxParticipants: 250,
    boutDuration: 300, description: 'Халықаралық дзюдо турнирі', organizer: 'ҚР Дзюдо федерациясы',
  },
  {
    id: 't2', name: 'Астана Чемпионаты', date: '2025-04-10', endDate: '2025-04-12',
    location: 'Астана, Барыс Арена', status: 'upcoming',
    categories: ['Юниорлар', 'Ересектер'], participants: 124, maxParticipants: 200,
    boutDuration: 240, description: 'Қазақстан чемпионаты', organizer: 'Астана Дзюдо Клубы',
  },
  {
    id: 't3', name: 'Шымкент Ашық Кубогы', date: '2025-02-20', endDate: '2025-02-21',
    location: 'Шымкент, Орталық спорт залы', status: 'completed',
    categories: ['Кадеттер', 'Юниорлар'], participants: 98, maxParticipants: 150,
    boutDuration: 240, description: 'Оңтүстік Қазақстан ашық кубогы', organizer: 'Шымкент Дзюдо',
  },
  {
    id: 't4', name: 'Қарағанды Мемориал', date: '2025-05-01', endDate: '2025-05-02',
    location: 'Қарағанды, Жеңіс спорт кешені', status: 'draft',
    categories: ['Ересектер'], participants: 0, maxParticipants: 128,
    boutDuration: 300, description: 'Дәстүрлі мемориалдық турнир', organizer: 'Қарағанды облысы',
  },
  {
    id: 't5', name: 'Ақтау Жағажай Кубогы', date: '2025-06-15', endDate: '2025-06-16',
    location: 'Ақтау, Каспий спорт залы', status: 'upcoming',
    categories: ['Кадеттер', 'Юниорлар', 'Ересектер'], participants: 67, maxParticipants: 180,
    boutDuration: 240, description: 'Маңғыстау облысы турнирі', organizer: 'Ақтау Дзюдо Клубы',
  },
];

export const demoAthletes: Athlete[] = [
  { id: 'a1', name: 'Әлібек Серіков', club: 'Алматы Барыс', weight: 73, age: 22, category: 'Ересектер', rank: 'МС', wins: 34, losses: 8, region: 'Алматы' },
  { id: 'a2', name: 'Данияр Қасымов', club: 'Астана Жұлдыз', weight: 66, age: 20, category: 'Юниорлар', rank: '1-разряд', wins: 22, losses: 5, region: 'Астана' },
  { id: 'a3', name: 'Нұрсұлтан Бекболатов', club: 'Шымкент Батыр', weight: 81, age: 24, category: 'Ересектер', rank: 'МС', wins: 41, losses: 12, region: 'Шымкент' },
  { id: 'a4', name: 'Ержан Тұрсынбеков', club: 'Қарағанды Номад', weight: 60, age: 17, category: 'Кадеттер', rank: '2-разряд', wins: 15, losses: 3, region: 'Қарағанды' },
  { id: 'a5', name: 'Асқар Мұратов', club: 'Алматы Барыс', weight: 90, age: 23, category: 'Ересектер', rank: 'МСХК', wins: 56, losses: 9, region: 'Алматы' },
  { id: 'a6', name: 'Бауыржан Өмірбеков', club: 'Ақтөбе Арлан', weight: 73, age: 19, category: 'Юниорлар', rank: '1-разряд', wins: 18, losses: 6, region: 'Ақтөбе' },
  { id: 'a7', name: 'Қайрат Жүнісов', club: 'Астана Жұлдыз', weight: 100, age: 25, category: 'Ересектер', rank: 'МС', wins: 38, losses: 11, region: 'Астана' },
  { id: 'a8', name: 'Тимур Сәрсенов', club: 'Шымкент Батыр', weight: 66, age: 16, category: 'Кадеттер', rank: '2-разряд', wins: 12, losses: 4, region: 'Шымкент' },
  { id: 'a9', name: 'Мади Ахметов', club: 'Қарағанды Номад', weight: 81, age: 21, category: 'Юниорлар', rank: 'КМС', wins: 27, losses: 7, region: 'Қарағанды' },
  { id: 'a10', name: 'Сұлтан Нұрланов', club: 'Ақтау Самұрық', weight: 73, age: 23, category: 'Ересектер', rank: 'КМС', wins: 29, losses: 10, region: 'Ақтау' },
];

// Site/Club join applications (not tournament applications)
export const demoApplications: Application[] = [
  { id: 'ap1', athleteName: 'Әлібек Серіков', clubName: 'Алматы Барыс', tournamentName: 'Алматы Гран-При 2025', category: 'Ересектер', weight: '-73 кг', status: 'approved', submittedAt: '2025-03-01', coachName: 'Марат Жанұзақов' },
  { id: 'ap2', athleteName: 'Данияр Қасымов', clubName: 'Астана Жұлдыз', tournamentName: 'Алматы Гран-При 2025', category: 'Юниорлар', weight: '-66 кг', status: 'approved', submittedAt: '2025-03-02', coachName: 'Талғат Есімов' },
  { id: 'ap3', athleteName: 'Ержан Тұрсынбеков', clubName: 'Қарағанды Номад', tournamentName: 'Алматы Гран-При 2025', category: 'Кадеттер', weight: '-60 кг', status: 'pending', submittedAt: '2025-03-05', coachName: 'Болат Сейтов' },
  { id: 'ap4', athleteName: 'Нұрсұлтан Бекболатов', clubName: 'Шымкент Батыр', tournamentName: 'Астана Чемпионаты', category: 'Ересектер', weight: '-81 кг', status: 'approved', submittedAt: '2025-03-08', coachName: 'Серік Жаңабеков' },
  { id: 'ap5', athleteName: 'Бауыржан Өмірбеков', clubName: 'Ақтөбе Арлан', tournamentName: 'Астана Чемпионаты', category: 'Юниорлар', weight: '-73 кг', status: 'pending', submittedAt: '2025-03-10', coachName: 'Нұрлан Байқоңыров' },
  { id: 'ap6', athleteName: 'Асқар Мұратов', clubName: 'Алматы Барыс', tournamentName: 'Алматы Гран-При 2025', category: 'Ересектер', weight: '-90 кг', status: 'approved', submittedAt: '2025-03-01', coachName: 'Марат Жанұзақов' },
  { id: 'ap7', athleteName: 'Тимур Сәрсенов', clubName: 'Шымкент Батыр', tournamentName: 'Алматы Гран-При 2025', category: 'Кадеттер', weight: '-66 кг', status: 'rejected', submittedAt: '2025-03-04', coachName: 'Серік Жаңабеков' },
  { id: 'ap8', athleteName: 'Мади Ахметов', clubName: 'Қарағанды Номад', tournamentName: 'Астана Чемпионаты', category: 'Юниорлар', weight: '-81 кг', status: 'pending', submittedAt: '2025-03-11', coachName: 'Болат Сейтов' },
];

// Site join requests (registration requests for the platform)
export interface SiteJoinRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: 'site' | 'club' | 'team';
  clubName?: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  notes: string;
}

export const demoJoinRequests: SiteJoinRequest[] = [
  { id: 'jr1', name: 'Арман Қалиев', email: 'arman@mail.kz', phone: '+7 701 123 4567', type: 'site', role: 'Спортшы', status: 'pending', submittedAt: '2025-03-12', notes: 'Алматы Барыс клубына қосылғысы келеді' },
  { id: 'jr2', name: 'Ақтөбе Самбо Клубы', email: 'aktobe.sambo@mail.kz', phone: '+7 713 222 3344', type: 'club', clubName: 'Ақтөбе Самбо', role: 'Клуб', status: 'pending', submittedAt: '2025-03-11', notes: 'Жаңа клуб тіркелу, 15 спортшы' },
  { id: 'jr3', name: 'Серік Оразов', email: 'serik.o@mail.kz', phone: '+7 707 555 6677', type: 'site', role: 'Жаттықтырушы', status: 'approved', submittedAt: '2025-03-10', notes: '' },
  { id: 'jr4', name: 'Тараз Жігіттер', email: 'taraz.team@mail.kz', phone: '+7 726 111 2233', type: 'team', clubName: 'Тараз Жігіттер', role: 'Команда', status: 'pending', submittedAt: '2025-03-09', notes: '12 спортшыдан тұратын команда' },
  { id: 'jr5', name: 'Ерлан Мұхаметов', email: 'erlan.m@mail.kz', phone: '+7 702 333 4455', type: 'site', role: 'Төреші', status: 'approved', submittedAt: '2025-03-08', notes: 'Халықаралық санатты төреші' },
  { id: 'jr6', name: 'Қостанай Барыс', email: 'kostanay.b@mail.kz', phone: '+7 714 444 5566', type: 'club', clubName: 'Қостанай Барыс', role: 'Клуб', status: 'rejected', submittedAt: '2025-03-07', notes: 'Құжаттары толық емес' },
  { id: 'jr7', name: 'Нұрбол Сейтқали', email: 'nurbol.s@mail.kz', phone: '+7 705 777 8899', type: 'site', role: 'Спортшы', status: 'pending', submittedAt: '2025-03-13', notes: 'Шымкент Батыр клубына қосылғысы келеді' },
  { id: 'jr8', name: 'Семей Жасөспірім', email: 'semey.team@mail.kz', phone: '+7 722 666 7788', type: 'team', clubName: 'Семей Жасөспірім', role: 'Команда', status: 'pending', submittedAt: '2025-03-14', notes: '8 кадет спортшы' },
];

// Demo users for admin management
export interface DemoUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  club: string;
  registeredAt: string;
  lastActive: string;
  status: 'active' | 'blocked';
}

export const demoUsers: DemoUser[] = [
  { id: 'u1', name: 'Әлібек Серіков', email: 'alibek@mail.kz', phone: '+7 701 111 2233', role: 'Спортшы', club: 'Алматы Барыс', registeredAt: '2024-06-15', lastActive: '2025-03-14', status: 'active' },
  { id: 'u2', name: 'Марат Жанұзақов', email: 'marat.zh@mail.kz', phone: '+7 707 222 3344', role: 'Жаттықтырушы', club: 'Алматы Барыс', registeredAt: '2024-01-10', lastActive: '2025-03-14', status: 'active' },
  { id: 'u3', name: 'Данияр Қасымов', email: 'daniyar@mail.kz', phone: '+7 702 333 4455', role: 'Спортшы', club: 'Астана Жұлдыз', registeredAt: '2024-08-20', lastActive: '2025-03-13', status: 'active' },
  { id: 'u4', name: 'Талғат Есімов', email: 'talgat@mail.kz', phone: '+7 705 444 5566', role: 'Жаттықтырушы', club: 'Астана Жұлдыз', registeredAt: '2024-03-05', lastActive: '2025-03-12', status: 'active' },
  { id: 'u5', name: 'Нұрсұлтан Бекболатов', email: 'nursultan@mail.kz', phone: '+7 708 555 6677', role: 'Спортшы', club: 'Шымкент Батыр', registeredAt: '2024-05-12', lastActive: '2025-03-14', status: 'active' },
  { id: 'u6', name: 'Серік Жаңабеков', email: 'serik.zh@mail.kz', phone: '+7 701 666 7788', role: 'Жаттықтырушы', club: 'Шымкент Батыр', registeredAt: '2023-11-01', lastActive: '2025-03-11', status: 'active' },
  { id: 'u7', name: 'Болат Сейтов', email: 'bolat@mail.kz', phone: '+7 707 777 8899', role: 'Жаттықтырушы', club: 'Қарағанды Номад', registeredAt: '2024-02-18', lastActive: '2025-03-10', status: 'active' },
  { id: 'u8', name: 'Ержан Тұрсынбеков', email: 'erzhan@mail.kz', phone: '+7 702 888 9900', role: 'Спортшы', club: 'Қарағанды Номад', registeredAt: '2024-09-01', lastActive: '2025-03-09', status: 'blocked' },
  { id: 'u9', name: 'Нұрлан Байқоңыров', email: 'nurlan@mail.kz', phone: '+7 705 999 0011', role: 'Жаттықтырушы', club: 'Ақтөбе Арлан', registeredAt: '2024-04-22', lastActive: '2025-03-08', status: 'active' },
  { id: 'u10', name: 'Ерлан Мұхаметов', email: 'erlan@mail.kz', phone: '+7 708 000 1122', role: 'Төреші', club: '—', registeredAt: '2024-07-15', lastActive: '2025-03-14', status: 'active' },
  { id: 'u11', name: 'Асқар Мұратов', email: 'askar@mail.kz', phone: '+7 701 112 2334', role: 'Спортшы', club: 'Алматы Барыс', registeredAt: '2024-06-30', lastActive: '2025-03-14', status: 'active' },
  { id: 'u12', name: 'Қайрат Жүнісов', email: 'kairat@mail.kz', phone: '+7 707 223 3445', role: 'Спортшы', club: 'Астана Жұлдыз', registeredAt: '2024-05-01', lastActive: '2025-03-13', status: 'active' },
];

export const demoMatches: Match[] = [
  { id: 'm1', round: 1, athlete1: 'Әлібек Серіков', athlete2: 'Сұлтан Нұрланов', score1: '10', score2: '1', winner: 'Әлібек Серіков', status: 'completed', tatami: 1, category: '-73 кг' },
  { id: 'm2', round: 1, athlete1: 'Бауыржан Өмірбеков', athlete2: 'Данияр Қасымов', score1: '0', score2: '10', winner: 'Данияр Қасымов', status: 'completed', tatami: 1, category: '-66 кг' },
  { id: 'm3', round: 1, athlete1: 'Нұрсұлтан Бекболатов', athlete2: 'Мади Ахметов', score1: '1', score2: '0', winner: 'Нұрсұлтан Бекболатов', status: 'completed', tatami: 2, category: '-81 кг' },
  { id: 'm4', round: 2, athlete1: 'Әлібек Серіков', athlete2: 'Қайрат Жүнісов', score1: '', score2: '', status: 'active', tatami: 1, category: '-73 кг' },
  { id: 'm5', round: 2, athlete1: 'Данияр Қасымов', athlete2: 'Ержан Тұрсынбеков', score1: '', score2: '', status: 'scheduled', tatami: 2, category: '-66 кг' },
  { id: 'm6', round: 1, athlete1: 'Асқар Мұратов', athlete2: 'Қайрат Жүнісов', score1: '10', score2: '1', winner: 'Асқар Мұратов', status: 'completed', tatami: 2, category: '-90 кг' },
  { id: 'm7', round: 2, athlete1: 'Нұрсұлтан Бекболатов', athlete2: 'Асқар Мұратов', score1: '', score2: '', status: 'scheduled', tatami: 1, category: '-81 кг' },
  { id: 'm8', round: 3, athlete1: '', athlete2: '', score1: '', score2: '', status: 'scheduled', tatami: 1, category: '-73 кг' },
];

export const demoClubs: Club[] = [
  { id: 'c1', name: 'Алматы Барыс', city: 'Алматы', coach: 'Марат Жанұзақов', athleteCount: 45, founded: 2008, region: 'Алматы қ.' },
  { id: 'c2', name: 'Астана Жұлдыз', city: 'Астана', coach: 'Талғат Есімов', athleteCount: 38, founded: 2012, region: 'Астана қ.' },
  { id: 'c3', name: 'Шымкент Батыр', city: 'Шымкент', coach: 'Серік Жаңабеков', athleteCount: 32, founded: 2010, region: 'Түркістан обл.' },
  { id: 'c4', name: 'Қарағанды Номад', city: 'Қарағанды', coach: 'Болат Сейтов', athleteCount: 28, founded: 2015, region: 'Қарағанды обл.' },
  { id: 'c5', name: 'Ақтөбе Арлан', city: 'Ақтөбе', coach: 'Нұрлан Байқоңыров', athleteCount: 22, founded: 2014, region: 'Ақтөбе обл.' },
  { id: 'c6', name: 'Ақтау Самұрық', city: 'Ақтау', coach: 'Ерлан Мұхаметов', athleteCount: 18, founded: 2017, region: 'Маңғыстау обл.' },
];

export const demoNotifications = [
  { id: 'n1', text: 'Жаңа тіркелу өтінімі түсті — Арман Қалиев', time: '5 мин бұрын', type: 'info' as const },
  { id: 'n2', text: 'Татами №1 — жекпе-жек аяқталды', time: '12 мин бұрын', type: 'success' as const },
  { id: 'n3', text: '5 өтінім мақұлдауды күтуде', time: '1 сағат бұрын', type: 'warning' as const },
  { id: 'n4', text: 'Ақтөбе Самбо клубы тіркелу өтінімін жіберді', time: '3 сағат бұрын', type: 'info' as const },
];
