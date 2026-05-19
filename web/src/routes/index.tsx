import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import heroImg from "@/assets/hero-judo.jpg";
import emblem from "@/assets/jcl-logo.jpeg";
import judoka3d from "@/assets/technique-kyu.jpg";
import heroKazakhstan from "@/assets/hero-kazakhstan-judo.jpg";
import teamLineup from "@/assets/team-lineup.jpg";
import athleteWomanWhite from "@/assets/athlete-woman-white.jpg";
import athleteBlue1 from "@/assets/athlete-blue-1.jpg";
import athleteBlue2 from "@/assets/athlete-blue-2.jpg";
import techniqueKyu from "@/assets/technique-kyu.jpg";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy, Shield, Users, ArrowRight,
  Sparkles, Medal, Timer, Radio, ChevronRight,
  Building2, User, Calendar, MapPin, Star, BarChart, Search, GitBranch,
  PlayCircle, BookOpen,
} from "lucide-react";
import { api } from "@/lib/api";
import { Bracket, sampleRounds } from "@/components/judo/Bracket";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Judo-Arena — Дзюдо жарыстарын автоматтандыру" },
      { name: "description", content: "Дзюдо жарыстарына арналған цифрлық платформа: автоматты жеребе тастау, төрелік панелі, нақты уақыттағы дәреже." },
      { property: "og:title", content: "Judo-Arena — Дзюдоның цифрлық аренасы" },
      { property: "og:description", content: "Жарыстар, жеребе, төрелік, дәреже — бір экранда, нақты уақытта." },
    ],
  }),
  component: Home,
});

const stats = [
  { value: "<1с", label: "Жеребе тастау" },
  { value: "100%", label: "IJF стандарты" },
  { value: "24/7", label: "Live трансляция" },
  { value: "∞", label: "Қайтару тереңдігі" },
];

const statusText: Record<string, string> = {
  DRAFT: "Жоба",
  REGISTRATION_OPEN: "Тіркеу ашық",
  REGISTRATION_CLOSED: "Тіркеу жабық",
  IN_PROGRESS: "LIVE",
  COMPLETED: "Аяқталды",
  CANCELLED: "Болдырылмады",
};

const partners = [
  { name: "ҚР Дзюдо Федерациясы", type: "Федерация", city: "Қазақстан", desc: "Ұлттық жарыстар мен төрешілік стандарттарды қолдайды.", image: heroKazakhstan, logo: emblem, accent: "from-sky-500/25" },
  { name: "Almaty Judo Club", type: "Клуб", city: "Алматы", desc: "Жас спортшыларды республикалық аренаға дайындайды.", image: athleteBlue1, logo: emblem, accent: "from-amber-500/25" },
  { name: "Astana Pro", type: "Академия", city: "Астана", desc: "Жаттықтырушылар штабы және турнирлік аналитика серіктесі.", image: teamLineup, logo: emblem, accent: "from-emerald-500/25" },
  { name: "Tigers Karaganda", type: "Клуб", city: "Қарағанды", desc: "Аймақтық жарыстар мен балалар лигасын дамытады.", image: athleteBlue2, logo: emblem, accent: "from-orange-500/25" },
  { name: "Shymkent Warriors", type: "Клуб", city: "Шымкент", desc: "Татами мәдениетін және ашық турнирлерді қолдайды.", image: athleteWomanWhite, logo: emblem, accent: "from-rose-500/25" },
  { name: "IJF Standard", type: "Стандарт", city: "International", desc: "Ережелер, хаттамалар және бағалау логикасына негіз.", image: techniqueKyu, logo: emblem, accent: "from-violet-500/25" },
  { name: "Aktobe Dojo", type: "Dojo", city: "Ақтөбе", desc: "Өңірлік таланттарды цифрлық рейтингке қосады.", image: heroImg, logo: emblem, accent: "from-cyan-500/25" },
  { name: "Pavlodar Elite", type: "Клуб", city: "Павлодар", desc: "Жарыс күніндегі live-табло және протокол серіктесі.", image: judoka3d, logo: emblem, accent: "from-lime-500/25" },
];

const upcoming = [
  { name: "Алматы Кубогі 2026", date: "24–26 мамыр", city: "Алматы", status: "LIVE", participants: 248, teams: 32, categories: 18, format: "SE + Repechage", startsAt: Date.now() + 1000 * 60 * 60 * 6, accent: "from-destructive/20 to-gold/10" },
  { name: "Қазақстан Чемпионаты", date: "12–15 маусым", city: "Астана", status: "Тіркеу", participants: 412, teams: 44, categories: 24, format: "SE + Round-Robin", startsAt: Date.now() + 1000 * 60 * 60 * 24 * 18, accent: "from-gold/20 to-sky-500/10" },
  { name: "Tigers Open", date: "2–3 шілде", city: "Қарағанды", status: "Тіркеу", participants: 96, teams: 14, categories: 10, format: "Round-Robin", startsAt: Date.now() + 1000 * 60 * 60 * 24 * 41, accent: "from-orange-500/20 to-gold/10" },
  { name: "Astana Junior Cup", date: "20 шілде", city: "Астана", status: "Тіркеу", participants: 184, teams: 26, categories: 16, format: "SE + Repechage", startsAt: Date.now() + 1000 * 60 * 60 * 24 * 60, accent: "from-emerald-500/20 to-gold/10" },
];

const liveTatami = [
  { tatami: 1, category: "U18 · −66 кг", current: "Д. Нұрлан vs Р. Олжас", next: "Final · Match 42", status: "Golden Score", progress: 72 },
  { tatami: 2, category: "Senior · −81 кг", current: "Ә. Сәрсенов vs Н. Қайратұлы", next: "Bronze A · Match 57", status: "Semi-final", progress: 58 },
  { tatami: 3, category: "U21 · −73 кг", current: "М. Ержан vs С. Бекзат", next: "Repechage · Match 31", status: "Ippon review", progress: 84 },
];

const clubs = [
  { name: "Almaty Judo Club", city: "Алматы", coach: "Қ. Серіков", athletes: 86, wins: 142, entries: 34, categories: 12, ready: 92, color: "from-sky-500/20 to-sky-500/5", image: athleteBlue1 },
  { name: "Astana Pro", city: "Астана", coach: "Д. Жұмабек", athletes: 64, wins: 118, entries: 28, categories: 10, ready: 86, color: "from-amber-500/20 to-amber-500/5", image: teamLineup },
  { name: "Tigers Karaganda", city: "Қарағанды", coach: "Б. Темірлан", athletes: 48, wins: 96, entries: 21, categories: 8, ready: 78, color: "from-orange-500/20 to-orange-500/5", image: athleteBlue2 },
  { name: "Shymkent Warriors", city: "Шымкент", coach: "Е. Сейітжан", athletes: 52, wins: 88, entries: 24, categories: 9, ready: 82, color: "from-emerald-500/20 to-emerald-500/5", image: athleteWomanWhite },
  { name: "Aktobe Dojo", city: "Ақтөбе", coach: "Н. Қанат", athletes: 39, wins: 71, entries: 16, categories: 7, ready: 74, color: "from-violet-500/20 to-violet-500/5", image: techniqueKyu },
  { name: "Pavlodar Elite", city: "Павлодар", coach: "Р. Дәурен", athletes: 41, wins: 65, entries: 18, categories: 7, ready: 70, color: "from-rose-500/20 to-rose-500/5", image: heroKazakhstan },
];

const topAthletes = [
  { rank: 1, name: "Ә. Сәрсенов", club: "Almaty Judo", weight: "−73 кг", points: 460, change: "+2", image: athleteBlue1 },
  { rank: 2, name: "Н. Қайратұлы", club: "Astana Pro", weight: "−81 кг", points: 410, change: "+1", image: athleteBlue2 },
  { rank: 3, name: "Д. Нұрлан", club: "Tigers Karaganda", weight: "−66 кг", points: 380, change: "−1", image: athleteWomanWhite },
  { rank: 4, name: "С. Бекзат", club: "Shymkent Warriors", weight: "−90 кг", points: 295, change: "+3", image: techniqueKyu },
  { rank: 5, name: "Р. Олжас", club: "Aktobe Dojo", weight: "−60 кг", points: 245, change: "—", image: heroKazakhstan },
  { rank: 6, name: "М. Ержан", club: "Pavlodar Elite", weight: "−100 кг", points: 215, change: "+1", image: teamLineup },
];

const techniqueVideos = [
  {
    title: "Видео техник на 5 КЮ",
    level: "5 КЮ",
    date: "12.11.2021",
    focus: "Базалық лақтырулар",
    duration: "18 мин",
    moves: ["De-ashi-barai", "Hiza-guruma", "O-goshi"],
    image: techniqueKyu,
  },
  {
    title: "Видео техник на 4 КЮ",
    level: "4 КЮ",
    date: "22.11.2021",
    focus: "Қорғаныс және ауысу",
    duration: "22 мин",
    moves: ["Sasae-tsurikomi-ashi", "Tai-otoshi", "Kesa-gatame"],
    image: athleteBlue1,
  },
  {
    title: "Видео техник на 3 КЮ",
    level: "3 КЮ",
    date: "23.11.2021",
    focus: "Комбинация",
    duration: "26 мин",
    moves: ["Uchi-mata", "Harai-goshi", "Okuri-eri-jime"],
    image: athleteBlue2,
  },
  {
    title: "Видео техник на 2 КЮ",
    level: "2 КЮ",
    date: "23.11.2021",
    focus: "Татамидегі бақылау",
    duration: "24 мин",
    moves: ["Tomoe-nage", "Ude-garami", "Sumi-gaeshi"],
    image: teamLineup,
  },
  {
    title: "Видео техник на 1 КЮ",
    level: "1 КЮ",
    date: "23.11.2021",
    focus: "Жарысқа дайындық",
    duration: "31 мин",
    moves: ["Kata-guruma", "Sode-tsurikomi-goshi", "Juji-gatame"],
    image: athleteWomanWhite,
  },
];

function localizeName(name: unknown): string {
  if (!name) return "—";
  if (typeof name === "string") return name;
  const values = name as Record<string, unknown>;
  return String(values.kk || values.ru || values.en || "—");
}

function formatDateRange(start?: string | Date | null, end?: string | Date | null) {
  if (!start) return "Күні белгісіз";
  const fmt = new Intl.DateTimeFormat("kk-KZ", { day: "2-digit", month: "short" });
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  if (!endDate || startDate.toDateString() === endDate.toDateString()) {
    return fmt.format(startDate);
  }
  return `${fmt.format(startDate)} – ${fmt.format(endDate)}`;
}

function athleteName(a: any) {
  return `${a?.name ?? ""} ${a?.surname ?? ""}`.trim() || "Спортшы";
}

function categoryName(category: any) {
  if (!category) return "Санат";
  const gender = category.gender === "FEMALE" ? "Қыздар" : category.gender === "MALE" ? "Ұлдар" : "Аралас";
  const age = category.ageMin || category.ageMax ? `U${category.ageMax ?? category.ageMin}` : "Open";
  const weight = category.weightMax ? `−${category.weightMax} кг` : category.weightMin ? `+${category.weightMin} кг` : "Open";
  return `${gender} · ${age} · ${weight}`;
}

function Countdown({ to }: { to: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, to - now);
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diff / (1000 * 60)) % 60);
  const s = Math.floor((diff / 1000) % 60);
  const Cell = ({ v, l }: { v: number; l: string }) => (
    <div className="flex flex-col items-center min-w-[44px]">
      <div className="font-display text-xl sm:text-2xl font-bold text-gradient-gold tabular-nums leading-none">
        {String(v).padStart(2, "0")}
      </div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">{l}</div>
    </div>
  );
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Cell v={d} l="күн" />
      <span className="text-gold/40">:</span>
      <Cell v={h} l="сағ" />
      <span className="text-gold/40">:</span>
      <Cell v={m} l="мин" />
      <span className="text-gold/40">:</span>
      <Cell v={s} l="сек" />
    </div>
  );
}

function useTicker() {
  const [score, setScore] = useState({ blue: 0, white: 0, time: 240 });
  useEffect(() => {
    const id = setInterval(() => {
      setScore((s) => ({
        blue: Math.random() > 0.7 ? Math.min(s.blue + 1, 10) : s.blue,
        white: Math.random() > 0.75 ? Math.min(s.white + 1, 10) : s.white,
        time: s.time > 0 ? s.time - 1 : 240,
      }));
    }, 1400);
    return () => clearInterval(id);
  }, []);
  return score;
}

function Home() {
  const live = useTicker();
  const mm = String(Math.floor(live.time / 60)).padStart(2, "0");
  const ss = String(live.time % 60).padStart(2, "0");
  const tournamentsQuery = useQuery({
    queryKey: ["home-tournaments"],
    queryFn: () => api.tournaments.list({ limit: 8 }),
    staleTime: 60_000,
  });
  const clubsQuery = useQuery({
    queryKey: ["home-clubs"],
    queryFn: () => api.clubs.list(),
    staleTime: 60_000,
  });
  const leaderboardQuery = useQuery({
    queryKey: ["home-leaderboard"],
    queryFn: () => api.ratings.leaderboard({ limit: 6 }),
    staleTime: 60_000,
  });
  const tournaments = tournamentsQuery.data?.items ?? [];
  const featuredTournament = useMemo(() => {
    return (
      tournaments.find((t: any) => t.status === "IN_PROGRESS") ??
      tournaments.find((t: any) => t.status === "REGISTRATION_OPEN") ??
      tournaments[0] ??
      null
    );
  }, [tournaments]);
  const upcomingRest = useMemo(
    () => tournaments.filter((t: any) => t.id !== featuredTournament?.id).slice(0, 3),
    [featuredTournament?.id, tournaments],
  );
  const featuredMatchesQuery = useQuery({
    queryKey: ["home-featured-matches", featuredTournament?.id],
    queryFn: () => api.matches.list({ tournamentId: featuredTournament!.id, limit: 12 }),
    enabled: Boolean(featuredTournament?.id),
    staleTime: 20_000,
  });
  const liveMatches = (featuredMatchesQuery.data ?? []).slice(0, 3).map((match: any, i: number) => ({
    tatami: match.tatamiNumber ?? i + 1,
    category: categoryName(match.bracket?.category),
    current: `${athleteName(match.redAthlete)} vs ${athleteName(match.blueAthlete)}`,
    next: `Round ${match.round ?? 1} · Match ${match.position ?? i + 1}`,
    status: statusText[match.status] ?? match.status ?? "Кезекте",
    progress: match.status === "COMPLETED" ? 100 : match.status === "IN_PROGRESS" ? 64 : 28,
  }));
  const totalApplications = tournaments.reduce((sum: number, t: any) => sum + (t._count?.applications ?? 0), 0);
  const totalCategories = tournaments.reduce((sum: number, t: any) => sum + (t._count?.categories ?? 0), 0);
  const homeStats = [
    { value: String(tournamentsQuery.data?.total ?? tournaments.length), label: "Жарыс" },
    { value: String(totalApplications), label: "Өтінім" },
    { value: String(clubsQuery.data?.total ?? 0), label: "Клуб" },
    { value: String(totalCategories), label: "Санат" },
  ];

  const teamRows = (clubsQuery.data?.items ?? []).slice(0, 6).map((club: any, i: number) => ({
    name: localizeName(club.name),
    city: club.city ?? "—",
    coach: club.createdBy?.name ? `${club.createdBy.name} ${club.createdBy.surname ?? ""}`.trim() : "—",
    athletes: club._count?.members ?? 0,
    entries: Math.round((club._count?.members ?? 0) * 0.42),
    categories: Math.max(0, Math.round((club._count?.members ?? 0) / 7)),
    ready: Math.min(100, 62 + i * 8),
    color: clubs[i]?.color ?? "from-gold/20 to-gold/5",
    image: clubs[i]?.image ?? teamLineup,
  }));

  const athleteRows = (leaderboardQuery.data ?? []).slice(0, 6).map((row: any, i: number) => ({
    rank: row.rank ?? i + 1,
    name: `${row.athlete?.name ?? ""} ${row.athlete?.surname ?? ""}`.trim() || "—",
    club: row.athlete?.club ? localizeName(row.athlete.club.name) : "—",
    weight: row.athlete?.weightKg ? `−${row.athlete.weightKg} кг` : "—",
    points: Math.round(row.totalPoints ?? 0),
    change: i < 3 ? "+1" : "—",
    image: topAthletes[i]?.image ?? athleteBlue1,
  }));
  const [activeTechnique, setActiveTechnique] = useState(0);
  const currentTechnique = techniqueVideos[activeTechnique];

  // Parallax scroll for cinematic section
  const cineRef = useRef<HTMLDivElement | null>(null);
  const [cineY, setCineY] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = cineRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const progress = 1 - (r.top + r.height / 2) / vh;
      setCineY(progress * 60);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 3D mouse tilt for the live scoreboard
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const handleTilt = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateZ(0)`;
  };
  const resetTilt = () => {
    if (tiltRef.current) tiltRef.current.style.transform = "rotateY(-8deg) rotateX(6deg)";
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="absolute inset-0 opacity-20">
          <img src={heroKazakhstan} alt="" className="h-full w-full object-cover object-center mix-blend-luminosity" />
        </div>
        {/* Aurora blobs */}
        <div className="absolute -top-32 -left-32 h-[32rem] w-[32rem] rounded-full bg-gold/15 blur-3xl animate-aurora" />
        <div className="absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-primary/15 blur-3xl animate-aurora" style={{ animationDelay: "3s" }} />
        <div className="absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-gold/5 blur-3xl animate-aurora" style={{ animationDelay: "6s" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background" />

        <div className="container mx-auto px-4 relative pt-12 pb-20 sm:pt-20 sm:pb-28 lg:pt-28 lg:pb-36">
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-12 items-center">
            {/* Left: copy */}
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
              <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-destructive animate-ping opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                </span>
                <span className="text-xs tracking-widest uppercase text-muted-foreground">
                  Қазір {tournaments.filter((t: any) => t.status === "IN_PROGRESS").length} жарыс — LIVE эфирде
                </span>
              </div>
              <h1 className="font-display text-[2.75rem] sm:text-6xl md:text-7xl lg:text-[8rem] font-bold leading-[0.9] tracking-tight">
                <span className="block text-3d">Дзюдоның</span>
                <span className="block text-gradient-gold italic text-3d">цифрлық</span>
                <span className="relative inline-block text-3d">
                  аренасы
                  <span className="absolute -right-6 top-2 h-3 w-3 rounded-full bg-gold animate-gold-pulse" />
                </span>
              </h1>
              <p className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
                Өтінімнен медаль табыстауға дейін — бәрі бір экранда.
                Жеребе, төрелік және дәреже нақты уақытта жұмыс істейді.
              </p>
              <div className="mt-8 sm:mt-10 flex flex-wrap gap-3 sm:gap-4">
                <Link to="/tournaments" className="group bg-gradient-gold text-gold-foreground px-5 sm:px-7 py-3 sm:py-3.5 rounded-md font-medium shadow-gold hover:scale-105 transition-transform inline-flex items-center gap-2 text-sm sm:text-base">
                  Жарыстарды көру
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/login" className="glass border border-gold/30 px-5 sm:px-7 py-3 sm:py-3.5 rounded-md font-medium hover:border-gold/60 transition-colors text-sm sm:text-base">
                  Жүйеге кіру
                </Link>
              </div>

              <div className="mt-10 sm:mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-2xl">
                {homeStats.map((s, i) => (
                  <div key={s.label} className="animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${i * 100}ms`, animationFillMode: "backwards" }}>
                    <div className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-gradient-gold">{s.value}</div>
                    <div className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: 3D live judging mock */}
            <div
              className="relative perspective-1200 animate-in fade-in slide-in-from-right-8 duration-1000 delay-200 fill-mode-backwards"
              onMouseMove={handleTilt}
              onMouseLeave={resetTilt}
            >
              {/* Rotating conic glow */}
              <div className="absolute inset-[-30px] flex items-center justify-center pointer-events-none">
                <div className="h-[120%] w-[120%] rounded-full conic-gold opacity-30 blur-2xl animate-spin-conic" />
              </div>
              <div className="absolute -inset-4 bg-gradient-gold opacity-25 blur-3xl rounded-3xl" />

              {/* Tilted card */}
              <div
                ref={tiltRef}
                className="relative preserve-3d gradient-border rounded-2xl p-6 bg-card/60 backdrop-blur-xl shadow-elegant transition-transform duration-300 ease-out"
                style={{ transform: "rotateY(-8deg) rotateX(6deg)" }}
              >
                {/* floating emblem layer */}
                <img
                  src={emblem}
                  alt=""
                  className="hidden lg:block absolute -top-12 -right-10 h-24 w-24 opacity-40 animate-spin-slow"
                  style={{ transform: "translateZ(60px)" }}
                />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-destructive animate-pulse" />
                    <span className="text-xs uppercase tracking-widest text-destructive font-semibold">LIVE · Татами #2</span>
                  </div>
                  <div className="text-xs text-muted-foreground">−81 кг · Жартылай финал</div>
                </div>

                <div className="grid grid-cols-2 gap-3" style={{ transform: "translateZ(40px)" }}>
                  {[
                    { color: "blue", name: "Ә. Сәрсенов", club: "Almaty Judo", score: live.blue, bg: "bg-sky-500/15", text: "text-sky-300", border: "border-sky-400/30" },
                    { color: "white", name: "Н. Қайратұлы", club: "Astana Pro", score: live.white, bg: "bg-foreground/10", text: "text-foreground", border: "border-foreground/20" },
                  ].map((p) => (
                    <div key={p.color} className={`rounded-xl p-4 border ${p.bg} ${p.border}`}>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">{p.color === "blue" ? "Көк" : "Ақ"}</div>
                      <div className="mt-1 font-display text-lg font-semibold truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.club}</div>
                      <div key={p.score} className={`mt-3 font-display text-5xl font-bold tabular-nums ${p.text}`} style={{ animation: "ticker-rise 250ms ease-out" }}>
                        {p.score}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between glass rounded-lg p-3" style={{ transform: "translateZ(25px)" }}>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Timer className="h-4 w-4 text-gold" />
                    <span className="uppercase tracking-widest">Қалған уақыт</span>
                  </div>
                  <div className="font-display text-2xl font-bold tabular-nums text-gradient-gold">{mm}:{ss}</div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs" style={{ transform: "translateZ(20px)" }}>
                  <div className="glass rounded-md p-2 text-center">
                    <div className="text-gold font-semibold">IPPON</div>
                    <div className="text-muted-foreground mt-0.5">Жеңіс</div>
                  </div>
                  <div className="glass rounded-md p-2 text-center">
                    <div className="text-gold font-semibold">WAZA-ARI</div>
                    <div className="text-muted-foreground mt-0.5">Жартылай</div>
                  </div>
                  <div className="glass rounded-md p-2 text-center">
                    <div className="text-destructive font-semibold">SHIDO</div>
                    <div className="text-muted-foreground mt-0.5">Ескерту</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      </section>

      {/* TOURNAMENT ENTRY — team registration flow */}
      <section className="container mx-auto px-4 -mt-6 relative z-10">
        <div className="relative overflow-hidden rounded-2xl gradient-border bg-gradient-navy border border-gold/30 p-5 sm:p-7 shadow-elegant">
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-gold/20 blur-3xl animate-float" />
          <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute inset-0 grid-bg opacity-25" />

          <div className="relative grid gap-6 lg:grid-cols-[1fr_1.25fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-gold">
                <Sparkles className="h-3.5 w-3.5" />
                Турнирге өтінім
              </div>
              <h3 className="mt-4 font-display text-2xl font-bold leading-tight sm:text-3xl">
                Командаңызды тіркеп, қатысушыларды <span className="text-gradient-gold italic">санаттарға</span> қосыңыз
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Жаттықтырушы турнирді таңдайды, спортшыларды салмақ және жас санатына бөледі, ал әкімші өтінімді бекіткен соң сетка құрылады.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/tournaments"
                  className="inline-flex items-center gap-2 bg-gradient-gold text-gold-foreground px-5 py-3 rounded-md font-semibold shadow-gold hover:scale-105 transition-transform"
                >
                  Турнир таңдау <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 glass border border-gold/30 px-5 py-3 rounded-md font-medium hover:border-gold/60 transition-colors"
                >
                  Өтінім беру
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Trophy, n: "01", t: "Турнир", d: "Күн, қала және татами саны таңдалады." },
                { icon: Users, n: "02", t: "Қатысушылар", d: "Команда спортшыларын санаттарға бөледі." },
                { icon: Shield, n: "03", t: "Бекіту", d: "Әкімші өтінімді тексеріп, сеткаға жібереді." },
              ].map((step) => (
                <div
                  key={step.n}
                  className="group relative min-h-[10rem] overflow-hidden rounded-xl border border-gold/20 bg-background/45 p-4 backdrop-blur transition-all hover:-translate-y-1 hover:border-gold/50"
                >
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gold/10 blur-2xl group-hover:bg-gold/20 transition-colors" />
                  <div className="relative flex items-center justify-between">
                    <div className="h-11 w-11 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
                      <step.icon className="h-5 w-5 text-gold-foreground" />
                    </div>
                    <span className="font-display text-3xl font-bold text-gold/25">{step.n}</span>
                  </div>
                  <div className="relative mt-4 font-display text-lg font-semibold">{step.t}</div>
                  <p className="relative mt-2 text-xs leading-relaxed text-muted-foreground">{step.d}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-5 grid gap-3 border-t border-border/40 pt-5 text-xs text-muted-foreground sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gold" />
              Команда және клуб деректері сақталады
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gold" />
              Спортшылар жас/салмақ бойынша бөлінеді
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gold" />
              Бекітілген өтінімнен сетка жасалады
            </div>
          </div>
        </div>
      </section>

      {/* UPCOMING TOURNAMENTS WITH COUNTDOWN */}
      <section className="container mx-auto px-4 py-14 sm:py-20">
        <div className="flex items-end justify-between mb-8 sm:mb-12 flex-wrap gap-4">
          <div>
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold mb-3">Жақын жарыстар</div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold">
              Турнир күнтізбесі және <span className="text-gradient-gold italic">тіркеу</span>
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Командалар өтінім береді, қатысушылар санаттарға бөлінеді, ал басталған турнирлерде сетка мен матчтар live жаңарады.
            </p>
          </div>
          <Link to="/tournaments" className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm text-gold hover:border-gold/60">
            Барлық жарыстар <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {featuredTournament ? (
        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <Link
            to="/tournaments/$id"
            params={{ id: featuredTournament.id }}
            className="group relative min-h-[29rem] overflow-hidden rounded-2xl border border-gold/20 bg-card shadow-elegant transition-all hover:-translate-y-1 hover:border-gold/50"
          >
            <img src={featuredTournament.posterUrl || teamLineup} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45 transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-destructive/20 to-gold/10 via-background/80" />
            <div className="absolute inset-0 grid-bg opacity-30" />
            <div className="relative flex h-full flex-col justify-between p-5 sm:p-7">
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/20 px-3 py-1.5 text-[10px] uppercase tracking-widest text-destructive">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" /> {statusText[featuredTournament.status] ?? featuredTournament.status}
                  </span>
                  <span className="rounded-full border border-gold/30 bg-background/70 px-3 py-1.5 text-[10px] uppercase tracking-widest text-gold backdrop-blur">
                    Featured event
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-gold" />{formatDateRange(featuredTournament.startDate, featuredTournament.endDate)}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-gold" />{featuredTournament.city}</span>
                </div>
                <h3 className="mt-4 max-w-2xl font-display text-3xl font-bold leading-tight sm:text-5xl">
                  {localizeName(featuredTournament.name)}
                </h3>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Live турнир модулі: командалар, қатысушылар, сетка, матчтар және протокол бір жерден бақыланады.
                </p>
              </div>

              <div className="mt-8">
                <div className="mb-5 grid grid-cols-3 gap-2">
                  {[
                    { label: "Өтінім", value: featuredTournament._count?.applications ?? 0 },
                    { label: "Татами", value: featuredTournament.tatamiCount ?? 1 },
                    { label: "Санат", value: featuredTournament._count?.categories ?? 0 },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-white/10 bg-background/55 p-3 text-center backdrop-blur">
                      <div className="font-display text-2xl font-bold text-gradient-gold tabular-nums">{item.value}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {["Шолу", "Қатысушылар", "Сетка", "Матчтар", "Протокол"].map((tab, i) => (
                    <span
                      key={tab}
                      className={`rounded-full border px-3 py-2 text-xs transition-colors ${
                        i === 0
                          ? "border-gold/40 bg-gold/15 text-gold"
                          : "border-border/60 bg-background/45 text-muted-foreground"
                      }`}
                    >
                      {tab}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>

          <div className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-card/60 p-4 backdrop-blur">
              <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-gold" />
              <div className="rounded-xl border border-border/60 bg-background/55 py-3 pl-10 pr-4 text-sm text-muted-foreground">
                Турнир, қала немесе клуб іздеу
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {["2026", "LIVE", "Тіркеу ашық", "Single Elim", "Round-Robin"].map((filter) => (
                <span key={filter} className="rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs text-muted-foreground">
                  {filter}
                </span>
              ))}
            </div>
            {upcomingRest.map((t: any) => (
            <Link
              to="/tournaments/$id"
              params={{ id: t.id }}
              key={t.id}
              className="group relative overflow-hidden rounded-2xl border border-gold/20 bg-card/55 p-4 shadow-elegant backdrop-blur transition-all hover:-translate-y-1 hover:border-gold/50"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/15 to-sky-500/10 opacity-80" />
              <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gold/10 blur-2xl group-hover:bg-gold/20 transition-colors" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

              <div className="relative flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-gold/30 bg-gold/15 px-2.5 py-1 text-[10px] uppercase tracking-widest text-gold">
                        Тіркеу ашық
                      </span>
                      <span className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                        {statusText[t.status] ?? t.status}
                      </span>
                    </div>
                  <h3 className="font-display text-lg font-semibold group-hover:text-gold transition-colors">
                    {localizeName(t.name)}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-gold/70" />{formatDateRange(t.startDate, t.endDate)}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-gold/70" />{t.city}</span>
                  </div>
                </div>
                  <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-gold shadow-gold sm:flex">
                    <Trophy className="h-5 w-5 text-gold-foreground" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Өтінім", value: t._count?.applications ?? 0 },
                    { label: "Татами", value: t.tatamiCount ?? 1 },
                    { label: "Санат", value: t._count?.categories ?? 0 },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-border/60 bg-background/35 p-3 text-center">
                      <div className="font-display text-xl font-bold text-gradient-gold tabular-nums sm:text-2xl">{item.value}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-4 border-t border-border/40 pt-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {t.status === "IN_PROGRESS" ? "Матчтар жүріп жатыр" : "Басталуына дейін"}
                    </div>
                    <Countdown to={new Date(t.startDate).getTime()} />
                  </div>
                  <span className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold group-hover:border-gold/60">
                    {t.status === "IN_PROGRESS" ? "Live сетка" : "Толық ақпарат"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
          </div>
        </div>
        ) : (
          <div className="rounded-2xl border border-gold/20 bg-card/60 p-8 text-center text-muted-foreground">
            Әзірше backend-те турнир жоқ. Админ жаңа жарыс қосқанда ол осы жерде бірден шығады.
          </div>
        )}
      </section>

      {/* LIVE CENTER */}
      <section className="container mx-auto px-4 pb-14 sm:pb-20">
        <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-card/60 p-5 shadow-elegant backdrop-blur sm:p-7">
          <div className="absolute inset-0 grid-bg opacity-25" />
          <div className="absolute -right-20 top-0 h-72 w-72 rounded-full bg-destructive/10 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-destructive">
                  <Radio className="h-3.5 w-3.5 animate-pulse" />
                  Live center
                </div>
                <h2 className="font-display text-3xl font-bold sm:text-4xl md:text-5xl">
                  Татами, сетка және <span className="text-gradient-gold italic">протокол</span> бір экранда
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Халықаралық жарыс форматындағы бақылау орталығы: әр татамидегі ағымдағы матч, келесі кездесу, сетка статусы және ресми құжаттар.
                </p>
              </div>
              <Link to="/protocol" className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:border-gold/60">
                Протоколдар <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
              <div className="grid gap-4 md:grid-cols-3">
                {(liveMatches.length ? liveMatches : []).map((item) => (
                  <div key={item.tatami} className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/45 p-4 backdrop-blur">
                    <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gold/10 blur-2xl" />
                    <div className="relative flex items-center justify-between">
                      <span className="rounded-full border border-destructive/40 bg-destructive/15 px-2.5 py-1 text-[10px] uppercase tracking-widest text-destructive">
                        LIVE
                      </span>
                      <span className="font-display text-3xl font-bold text-gold/30">#{item.tatami}</span>
                    </div>
                    <div className="relative mt-4 text-[10px] uppercase tracking-widest text-muted-foreground">{item.category}</div>
                    <h3 className="relative mt-2 min-h-[3rem] font-display text-lg font-semibold leading-tight">
                      {item.current}
                    </h3>
                    <div className="relative mt-4 rounded-xl border border-border/60 bg-card/50 p-3">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Next</div>
                      <div className="mt-1 text-sm text-foreground">{item.next}</div>
                    </div>
                    <div className="relative mt-4">
                      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                        <span>{item.status}</span>
                        <span>{item.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full border border-border/50 bg-background/50">
                        <div className="h-full rounded-full bg-gradient-gold shadow-gold" style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
                {liveMatches.length === 0 && (
                  <div className="md:col-span-3 rounded-2xl border border-border/60 bg-background/45 p-8 text-center text-muted-foreground">
                    Матчтар сетка дайындалғаннан кейін осы live-блокта көрінеді.
                  </div>
                )}
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-background/45 p-5 backdrop-blur">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
                <div className="mb-5 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
                    <Shield className="h-5 w-5 text-gold-foreground" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.28em] text-gold">Official documents</div>
                    <h3 className="font-display text-xl font-semibold">Құжаттар модулі</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { title: "Старт парағы", status: "Ready" },
                    { title: "Турнир сеткасы", status: "Live" },
                    { title: "Категория протоколы", status: "Auto" },
                    { title: "PDF қорытынды", status: "After final" },
                  ].map((doc) => (
                    <div key={doc.title} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/45 px-4 py-3">
                      <span className="text-sm">{doc.title}</span>
                      <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[10px] uppercase tracking-widest text-gold">
                        {doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TEAMS + ATHLETES */}
      <section className="relative py-14 sm:py-20 border-y border-border/40 bg-navy-deep/30 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="container mx-auto px-4 relative">
          <div className="flex items-end justify-between mb-8 sm:mb-12 flex-wrap gap-4">
            <div>
              <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold mb-3">Командалар және қатысушылар</div>
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold">
                Клуб өтінімі мен <span className="text-gradient-gold italic">спортшылар рейтингі</span>
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Клубтар, спортшылар және рейтинг нақты backend деректерінен жүктеледі.
              </p>
            </div>
            <Link to="/rankings" className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm text-gold hover:border-gold/60">
              Толық рейтинг <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-4 sm:grid-cols-2">
              {teamRows.slice(0, 4).map((c, i) => (
                <Link
                  to="/rankings"
                  key={c.name}
                  className="group relative overflow-hidden rounded-2xl border border-gold/20 bg-card/55 p-5 shadow-elegant backdrop-blur transition-all hover:-translate-y-1 hover:border-gold/50"
                >
                  <img
                    src={c.image}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-12 transition-transform duration-500 group-hover:scale-105 group-hover:opacity-18"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-br ${c.color} opacity-60`} />
                  <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-gold/10 blur-2xl group-hover:bg-gold/20 transition-colors" />
                  <div className="relative">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
                          <Building2 className="h-5 w-5 text-gold-foreground" />
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Клуб #{String(i + 1).padStart(2, "0")}
                        </div>
                      </div>
                      <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[10px] uppercase tracking-widest text-gold">
                        {c.ready}%
                      </span>
                    </div>
                    <h3 className="font-display text-xl font-semibold group-hover:text-gold transition-colors">
                      {c.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-gold/70" /> {c.city}</span>
                      <span className="inline-flex items-center gap-1"><User className="h-3 w-3 text-gold/70" /> {c.coach}</span>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      {[
                        { label: "Спортшы", value: c.athletes },
                        { label: "Өтінім", value: c.entries },
                        { label: "Санат", value: c.categories },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg bg-background/40 border border-border/60 p-3">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{item.label}</div>
                          <div className="font-display text-2xl font-bold text-gradient-gold">{item.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                        <span>Турнирге дайындық</span>
                        <span>{c.ready}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-background/50 border border-border/50">
                        <div className="h-full rounded-full bg-gradient-gold shadow-gold" style={{ width: `${c.ready}%` }} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {teamRows.length === 0 && (
                <div className="sm:col-span-2 rounded-2xl border border-gold/20 bg-card/55 p-8 text-center text-muted-foreground">
                  Backend-те клубтар пайда болғанда, олар осы жерде көрсетіледі.
                </div>
              )}
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-card/55 shadow-elegant backdrop-blur">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
              <div className="flex items-center justify-between border-b border-border/40 bg-background/30 px-4 py-4 sm:px-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-gold">
                    Live leaderboard
                  </div>
                  <h3 className="font-display text-xl font-semibold">Команда спортшылары</h3>
                </div>
                <Star className="h-5 w-5 text-gold" />
              </div>
              <div className="divide-y divide-border/40">
                {athleteRows.map((a) => {
                  const medal = a.rank === 1 ? "text-yellow-400" : a.rank === 2 ? "text-zinc-300" : a.rank === 3 ? "text-amber-600" : "text-muted-foreground";
                  const change = a.change.startsWith("+") ? "text-emerald-400" : a.change.startsWith("−") ? "text-rose-400" : "text-muted-foreground";
                  return (
                    <Link
                      to="/rankings"
                      key={`${a.rank}-${a.name}`}
                      className="group grid grid-cols-[3rem_1fr_auto] gap-3 px-4 py-4 hover:bg-gold/5 transition-colors items-center sm:px-5"
                    >
                      <div className={`font-display text-2xl font-bold ${medal} flex items-center gap-2`}>
                        {a.rank <= 3 && <Star className="h-4 w-4 fill-current" />}
                        {a.rank}
                      </div>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-full border border-gold/30 bg-gradient-gold shrink-0">
                          <img src={a.image} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold group-hover:text-gold transition-colors">{a.name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">{a.club} · {a.weight}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-lg font-bold text-gradient-gold tabular-nums">{a.points}</div>
                        <div className={`text-xs tabular-nums ${change}`}>{a.change}</div>
                      </div>
                    </Link>
                  );
                })}
                {athleteRows.length === 0 && (
                  <div className="px-5 py-10 text-center text-muted-foreground">
                    Рейтингте әзірше спортшылар жоқ. Турнир қорытындысы шыққанда ұпайлар осында түседі.
                  </div>
                )}
              </div>
              <div className="border-t border-border/40 p-4">
                <Link to="/rankings" className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:border-gold/60">
                  Барлық спортшылар <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROTOCOL RESULT MODULE */}
      <section className="container mx-auto px-4 pb-14 sm:pb-20">
        <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-card/60 p-5 shadow-elegant backdrop-blur sm:p-7">
          <div className="absolute inset-0 grid-bg opacity-20" />
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-gold">
                <Trophy className="h-3.5 w-3.5" />
                Қорытынды модулі
              </div>
              <h3 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
                Финалдан кейін орындар, ұпайлар және <span className="text-gradient-gold italic">протокол</span> дайын
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Бұл блок жеке рейтинг ретінде емес, турнир қорытындысын түсіндіреді: сетка аяқталады, орындар есептеледі, рейтинг ұпайлары беріледі және PDF протокол жасалады.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { to: "/tournaments", label: "Сетка", icon: GitBranch, desc: "Матч жолы" },
                  { to: "/rankings", label: "Ұпай", icon: BarChart, desc: "Рейтингке қосу" },
                  { to: "/protocol", label: "PDF", icon: Shield, desc: "Ресми құжат" },
                ].map((q) => (
                  <Link
                    key={q.to}
                    to={q.to}
                    className="group relative overflow-hidden rounded-xl border border-gold/20 bg-background/40 p-4 transition-all hover:-translate-y-1 hover:border-gold/50"
                  >
                    <div className="mb-3 h-10 w-10 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
                      <q.icon className="h-5 w-5 text-gold-foreground" />
                    </div>
                    <div className="font-display font-semibold group-hover:text-gold transition-colors">{q.label}</div>
                    <div className="text-xs text-muted-foreground">{q.desc}</div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { p: 100, l: "1-орын", c: "from-yellow-400 to-amber-500", t: "text-navy-deep" },
                { p: 80,  l: "2-орын", c: "from-zinc-300 to-zinc-500", t: "text-navy-deep" },
                { p: 50,  l: "3-орын", c: "from-amber-700 to-amber-900", t: "text-white" },
                { p: 30,  l: "5-орын", c: "from-muted to-muted", t: "text-foreground" },
                { p: 15,  l: "7-орын", c: "from-muted to-muted", t: "text-foreground" },
              ].map((s) => (
                <div key={s.l} className={`relative rounded-xl bg-gradient-to-br ${s.c} p-4 text-center shadow-elegant md:min-h-[8rem] md:flex md:flex-col md:justify-center`}>
                  <div className={`font-display text-3xl font-bold tabular-nums ${s.t}`}>{s.p}</div>
                  <div className={`mt-1 text-[10px] uppercase tracking-widest opacity-80 ${s.t}`}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PARTNERS MARQUEE */}
      <section className="border-y border-border/40 bg-navy-deep/40 py-6 overflow-hidden">
        <div className="flex gap-12 animate-marquee whitespace-nowrap">
          {[...partners, ...partners].map((p, i) => (
            <div key={i} className="flex items-center gap-3 shrink-0 text-muted-foreground">
              <Medal className="h-4 w-4 text-gold/70" />
              <span className="font-display tracking-wide text-sm uppercase">{p.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* TECHNIQUE VIDEO LIBRARY */}
      <section ref={cineRef} className="relative overflow-hidden border-y border-border/40 py-16 sm:py-24">
        <div className="absolute inset-0 bg-gradient-hero opacity-70" />
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div
          className="pointer-events-none absolute -right-24 top-8 hidden h-[32rem] w-[32rem] rounded-full conic-gold opacity-10 blur-3xl md:block"
          style={{ transform: `translate3d(0, ${cineY * 0.35}px, 0)` }}
        />
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-gold/50 blur-[1px] animate-float"
            style={{
              left: `${(i * 71) % 100}%`,
              top: `${(i * 29) % 100}%`,
              width: `${3 + (i % 3) * 2}px`,
              height: `${3 + (i % 3) * 2}px`,
              animationDelay: `${(i * 0.35) % 4}s`,
              opacity: 0.25 + ((i % 4) / 10),
            }}
          />
        ))}

        <div className="container mx-auto px-4 relative">
          <div className="mb-8 max-w-3xl lg:mb-12">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-4 py-1.5">
                <BookOpen className="h-3.5 w-3.5 text-gold" />
                <span className="text-[10px] uppercase tracking-[0.28em] text-gold">КЮ техникасы</span>
              </div>
              <h2 className="font-display text-3xl font-bold leading-tight sm:text-5xl md:text-6xl">
                Ішкі <span className="text-gradient-gold italic">видео зал</span> техникаға
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Спортшылар КЮ деңгейін таңдап, техниканы осы жерде қарайды: сыртқы сайтқа өтпей,
                жарысқа дайындық пен белбеу жүйесі бір бетте қалады.
              </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.95fr]">
            <div className="relative min-h-[34rem] overflow-hidden rounded-2xl border border-gold/20 bg-navy-deep shadow-elegant">
              <img
                src={currentTechnique.image}
                alt={currentTechnique.title}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-70"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/5" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_30%,oklch(0.76_0.15_80/0.24),transparent_32%)]" />

              <div className="absolute right-6 top-24 hidden h-52 w-52 md:block" style={{ perspective: "900px" }}>
                <div className="relative h-full w-full preserve-3d" style={{ transform: "rotateX(62deg) rotateZ(-28deg)" }}>
                  {[0, 1, 2, 3].map((layer) => (
                    <div
                      key={layer}
                      className="absolute inset-0 rounded-xl border border-gold/25 bg-gradient-to-br from-gold/25 via-white/10 to-navy-deep/70 shadow-gold"
                      style={{ transform: `translateZ(${layer * 14}px) scale(${1 - layer * 0.07})` }}
                    />
                  ))}
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gold/35" />
                  <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gold/35" />
                </div>
              </div>

              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white backdrop-blur">
                  internal media
                </span>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold text-gold-foreground shadow-gold">
                  <PlayCircle className="h-5 w-5" />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-gold px-4 py-1.5 text-xs font-bold text-gold-foreground shadow-gold">
                    {currentTechnique.level}
                  </span>
                  <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{currentTechnique.duration}</span>
                  <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{currentTechnique.date}</span>
                </div>
                <h3 className="font-display text-3xl font-bold leading-tight sm:text-5xl">
                  {currentTechnique.title}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {currentTechnique.focus}. Бұл жерде кейін нақты video файл немесе YouTube embed қойылады,
                  ал қазір дизайн дайын player күйінде көрсетілген.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {currentTechnique.moves.map((move) => (
                    <span key={move} className="rounded-full border border-gold/20 bg-background/55 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
                      {move}
                    </span>
                  ))}
                </div>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-gold px-6 py-3 font-medium text-gold-foreground shadow-gold transition-transform hover:scale-[1.02]"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Сабақты қосу
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md border border-gold/30 bg-background/50 px-6 py-3 font-medium backdrop-blur transition-colors hover:border-gold/60"
                  >
                    Техника тізімі
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gold/20 bg-card/80 p-4 shadow-elegant backdrop-blur">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.26em] text-gold">playlist</div>
                    <div className="font-display text-xl font-bold">КЮ видеолары</div>
                  </div>
                  <div className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs text-gold">
                    {techniqueVideos.length} сабақ
                  </div>
                </div>
                <div className="space-y-3">
                  {techniqueVideos.map((video, i) => (
                    <button
                      key={video.title}
                      type="button"
                      onClick={() => setActiveTechnique(i)}
                      className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                        activeTechnique === i
                          ? "border-gold/60 bg-gold/15 shadow-gold"
                          : "border-border/60 bg-background/45 hover:border-gold/40 hover:bg-gold/10"
                      }`}
                    >
                      <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg">
                        <img src={video.image} alt="" className="h-full w-full object-cover opacity-80 transition-transform group-hover:scale-105" />
                        <span className="absolute inset-0 bg-background/20" />
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-gold-foreground">
                            <PlayCircle className="h-4 w-4" />
                          </span>
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-display font-semibold">{video.level}</span>
                          <span className="text-xs text-muted-foreground">{video.duration}</span>
                        </span>
                        <span className="mt-1 block truncate text-sm text-muted-foreground">{video.title}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-navy-deep p-5 shadow-elegant">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full conic-gold opacity-25 blur-2xl" />
                <div className="relative">
                  <div className="mb-4 text-[10px] uppercase tracking-[0.26em] text-gold">3D belt path</div>
                  <div className="space-y-2" style={{ perspective: "800px" }}>
                    {["Ақ", "Сары", "Қызғылт", "Жасыл", "Көк"].map((belt, i) => (
                      <div
                        key={belt}
                        className="flex h-9 items-center justify-between rounded-md border border-white/10 bg-gradient-to-r from-white/15 to-gold/10 px-4 text-sm"
                        style={{ transform: `rotateX(14deg) translateZ(${i * 7}px)` }}
                      >
                        <span>{belt}</span>
                        <span className="text-xs text-gold">{6 - i} КЮ</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PARTNERS / SPONSORS CAROUSEL */}
      <section className="container mx-auto px-4 py-14 sm:py-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-12">
          <div className="max-w-2xl">
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold mb-3">Серіктестер</div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold">
              Бізге <span className="text-gradient-gold italic">сенім артқандар</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Федерациялар, клубтар және демеушілер. Карталарды көлденең жылжытып көріңіз.
            </p>
          </div>
          <div className="hidden rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-gold sm:block">
            sponsor roll
          </div>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none]">
          <div className="flex gap-5">
            {partners.map((p) => (
            <div
              key={p.name}
              className="group relative h-[25rem] w-[18rem] shrink-0 overflow-hidden rounded-2xl border border-gold/20 bg-card shadow-elegant transition-all hover:-translate-y-1 hover:border-gold/50 sm:w-[21rem]"
            >
              <img
                src={p.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-55 transition-transform duration-500 group-hover:scale-105"
              />
              <div className={`absolute inset-0 bg-gradient-to-t ${p.accent} via-background/70 to-background/10`} />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
                <img src={p.logo} alt="" className="h-12 w-12 rounded-xl border border-white/20 bg-white object-cover shadow-gold" />
                <span className="rounded-full border border-gold/30 bg-background/70 px-3 py-1 text-[10px] uppercase tracking-widest text-gold backdrop-blur">
                  {p.type}
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-gold" />
                  {p.city}
                </div>
                <h3 className="font-display text-2xl font-bold leading-tight group-hover:text-gold transition-colors">
                  {p.name}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {p.desc}
                </p>
                <div className="mt-5 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-gold">
                  <Medal className="h-4 w-4" />
                  official partner
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      </section>

      {/* 3D BELT RANKS */}
      <section className="relative py-16 sm:py-24 overflow-hidden border-y border-border/40 bg-navy-deep/30">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[40rem] w-[40rem] rounded-full conic-gold opacity-10 blur-3xl animate-spin-conic" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16">
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold mb-3 sm:mb-4">Дан жүйесі</div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-6xl font-bold text-3d">
              Ақ белбеуден<br/><span className="text-gradient-gold italic">қара белбеуге</span> дейін
            </h2>
            <p className="mt-5 text-muted-foreground">
              Әр спортшының жолы дәрежеде автоматты түрде көрсетіледі. IJF стандарты.
            </p>
          </div>

          <div className="perspective-1200">
            <div className="mx-auto max-w-4xl preserve-3d" style={{ transform: "rotateX(18deg)" }}>
              <div className="space-y-3">
                {[
                  { c: "from-white/90 to-white/60", text: "text-navy-deep", label: "Ақ", k: "6 kyu" },
                  { c: "from-yellow-300 to-yellow-500", text: "text-navy-deep", label: "Сары", k: "5 kyu" },
                  { c: "from-orange-400 to-orange-600", text: "text-navy-deep", label: "Қызғылт сары", k: "4 kyu" },
                  { c: "from-green-500 to-green-700", text: "text-white", label: "Жасыл", k: "3 kyu" },
                  { c: "from-sky-500 to-sky-700", text: "text-white", label: "Көк", k: "2 kyu" },
                  { c: "from-amber-700 to-amber-900", text: "text-white", label: "Қоңыр", k: "1 kyu" },
                  { c: "from-neutral-900 to-black", text: "text-gold", label: "Қара", k: "1–10 dan" },
                ].map((b, i) => (
                  <div
                    key={b.label}
                    className={`group relative h-12 rounded-md bg-gradient-to-r ${b.c} flex items-center justify-between px-6 shadow-elegant hover:translate-y-[-4px] transition-transform`}
                    style={{ transform: `translateZ(${i * 8}px)` }}
                  >
                    <span className={`font-display font-bold tracking-wide ${b.text}`}>{b.label}</span>
                    <span className={`text-xs uppercase tracking-widest ${b.text} opacity-80`}>{b.k}</span>
                    <span className="absolute right-12 top-0 bottom-0 w-px bg-black/20" />
                    <span className="absolute right-20 top-0 bottom-0 w-px bg-black/20" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE BRACKET (public, no auth) */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-60" />
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="container mx-auto px-4 relative">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-gold mb-4">Live хаттама</div>
              <h2 className="font-display text-4xl md:text-5xl font-bold">
                Жарыс <span className="text-gradient-gold italic">хаттамасы</span> — нақты уақытта
              </h2>
              <p className="mt-3 text-muted-foreground max-w-xl">
                Кез келген көрермен тіркелусіз жекпе-жектердің нәтижелерін көре алады.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
              <Radio className="h-3.5 w-3.5 animate-pulse" /> LIVE · Татами #2 · −73 кг
            </span>
          </div>
          <div className="glass rounded-2xl p-6 border border-gold/20 shadow-elegant">
            <Bracket rounds={sampleRounds} />
          </div>
          <div className="mt-6 text-center">
            <Link to="/tournaments" className="inline-flex items-center gap-2 text-sm text-gold hover:underline">
              Барлық хаттамаларды көру <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative py-16 sm:py-24 border-y border-border/40 bg-navy-deep/40">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs uppercase tracking-[0.3em] text-gold mb-4">Жұмыс ағыны</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold">
              Тіркеуден <span className="text-gradient-gold italic">медальға</span> дейін
            </h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6 relative">
            <div className="hidden md:block absolute top-8 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
            {[
              { n: "01", t: "Тіркелу", d: "Спортшы немесе жаттықтырушы аккаунт жасайды." },
              { n: "02", t: "Өтінім", d: "Жаттықтырушы клубтан атынан өтінім жібереді." },
              { n: "03", t: "Жеребе", d: "Әкімші бір батырмамен IJF хаттамасын құрады." },
              { n: "04", t: "Жекпе-жек", d: "Төреші LIVE панелде ұпайларды тіркейді." },
            ].map((s) => (
              <div key={s.n} className="relative text-center">
                <div className="relative mx-auto h-16 w-16 rounded-full bg-gradient-gold flex items-center justify-center font-display text-xl font-bold text-gold-foreground shadow-gold mb-5">
                  {s.n}
                  <span className="absolute inset-0 rounded-full border border-gold/30 animate-ping" />
                </div>
                <h3 className="font-display text-lg font-semibold">{s.t}</h3>
                <p className="text-sm text-muted-foreground mt-1">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TOURNAMENT DAY FINALE */}
      <section className="container mx-auto px-4 pb-16 sm:pb-24">
        <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-navy-deep shadow-elegant">
          <img
            src={heroKazakhstan}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/25" />
          <div className="absolute inset-0 grid-bg opacity-20" />
          <div className="absolute right-8 top-8 hidden h-44 w-44 rounded-full conic-gold opacity-25 blur-2xl md:block" />

          <div className="relative grid gap-8 p-5 sm:p-7 lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
            <div className="flex min-h-[28rem] flex-col justify-end">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-[10px] uppercase tracking-[0.28em] text-gold backdrop-blur">
                <Trophy className="h-3.5 w-3.5" />
                жарыс күні
              </div>
              <h2 className="font-display text-3xl font-bold leading-tight sm:text-5xl md:text-6xl">
                Команда келді.<br />
                Сетка ашылды.<br />
                <span className="text-gradient-gold italic">Татами дайын.</span>
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Басты бет соңында бос ұран емес, жарыстың нақты финалдық көрінісі: кім тіркелді,
                қай татамиде күреседі және қандай құжат дайын болады.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/tournaments" className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-6 py-3 font-medium text-gold-foreground shadow-gold transition-transform hover:scale-[1.02]">
                  Live жарыстар <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/protocol" className="inline-flex items-center gap-2 rounded-md border border-gold/30 bg-background/55 px-6 py-3 font-medium backdrop-blur transition-colors hover:border-gold/60">
                  Протоколдар
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:content-end">
              {[
                { title: "Старт парағы", value: "248", desc: "қатысушы бекітілді", icon: Users },
                { title: "Сетка", value: "18", desc: "санат бойынша құрылды", icon: GitBranch },
                { title: "Татами", value: "3", desc: "live кезек жұмыс істейді", icon: Radio },
                { title: "Қорытынды", value: "PDF", desc: "медаль және хаттама", icon: Shield },
              ].map((item) => (
                <div key={item.title} className="group relative overflow-hidden rounded-2xl border border-gold/20 bg-background/55 p-5 backdrop-blur transition-all hover:-translate-y-1 hover:border-gold/50">
                  <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gold/10 blur-2xl transition-colors group-hover:bg-gold/20" />
                  <div className="relative flex items-center justify-between">
                    <div className="h-11 w-11 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
                      <item.icon className="h-5 w-5 text-gold-foreground" />
                    </div>
                    <div className="font-display text-3xl font-bold text-gradient-gold">{item.value}</div>
                  </div>
                  <div className="relative mt-5 font-display text-xl font-semibold">{item.title}</div>
                  <div className="relative mt-1 text-sm text-muted-foreground">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
