import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { LazyImage } from "@/components/ui/avatar-image";
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
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useCountUp } from "@/hooks/useCountUp";
import { useTypewriter } from "@/hooks/useTypewriter";
import { useRipple } from "@/hooks/useRipple";
import { useConfetti } from "@/components/ui/Confetti";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy,
  Shield,
  Users,
  ArrowRight,
  Medal,
  Radio,
  ChevronRight,
  Building2,
  User,
  Calendar,
  MapPin,
  Star,
  BarChart,
  Search,
  GitBranch,
  BookOpen,
} from "lucide-react";
import { api } from "@/lib/api";
import { Bracket, sampleRounds } from "@/components/judo/Bracket";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Judo-Arena — Дзюдо жарыстарын автоматтандыру" },
      {
        name: "description",
        content:
          "Дзюдо жарыстарына арналған цифрлық платформа: автоматты жеребе тастау, төрелік панелі, нақты уақыттағы дәреже.",
      },
      { property: "og:title", content: "Judo-Arena — Дзюдоның цифрлық аренасы" },
      {
        property: "og:description",
        content: "Жарыстар, жеребе, төрелік, дәреже — бір экранда, нақты уақытта.",
      },
    ],
  }),
  component: Home,
});

const statusText: Record<string, string> = {
  DRAFT: "Жоба",
  REGISTRATION_OPEN: "Тіркеу ашық",
  REGISTRATION_CLOSED: "Тіркеу жабық",
  IN_PROGRESS: "LIVE",
  COMPLETED: "Аяқталды",
  CANCELLED: "Болдырылмады",
};

const partners = [
  {
    name: "ҚР Дзюдо Федерациясы",
    type: "Федерация",
    city: "Қазақстан",
    desc: "Ұлттық жарыстар мен төрешілік стандарттарды қолдайды.",
    image: heroKazakhstan,
    logo: emblem,
    accent: "from-sky-500/25",
  },
  {
    name: "Almaty Judo Club",
    type: "Клуб",
    city: "Алматы",
    desc: "Жас спортшыларды республикалық аренаға дайындайды.",
    image: athleteBlue1,
    logo: emblem,
    accent: "from-amber-500/25",
  },
  {
    name: "Astana Pro",
    type: "Академия",
    city: "Астана",
    desc: "Жаттықтырушылар штабы және жарыс аналитикасы серіктесі.",
    image: teamLineup,
    logo: emblem,
    accent: "from-emerald-500/25",
  },
  {
    name: "Tigers Karaganda",
    type: "Клуб",
    city: "Қарағанды",
    desc: "Аймақтық жарыстар мен балалар лигасын дамытады.",
    image: athleteBlue2,
    logo: emblem,
    accent: "from-orange-500/25",
  },
  {
    name: "Shymkent Warriors",
    type: "Клуб",
    city: "Шымкент",
    desc: "Татами мәдениетін және ашық жарыстарды қолдайды.",
    image: athleteWomanWhite,
    logo: emblem,
    accent: "from-rose-500/25",
  },
  {
    name: "IJF Standard",
    type: "Стандарт",
    city: "Халықаралық",
    desc: "Ережелер, хаттама және бағалау логикасына негіз.",
    image: techniqueKyu,
    logo: emblem,
    accent: "from-violet-500/25",
  },
  {
    name: "Aktobe Dojo",
    type: "Dojo",
    city: "Ақтөбе",
    desc: "Өңірлік таланттарды цифрлық дәрежеге қосады.",
    image: heroImg,
    logo: emblem,
    accent: "from-cyan-500/25",
  },
  {
    name: "Pavlodar Elite",
    type: "Клуб",
    city: "Павлодар",
    desc: "Жарыс күніндегі live-табло және хаттама серіктесі.",
    image: judoka3d,
    logo: emblem,
    accent: "from-lime-500/25",
  },
];

const clubs = [
  {
    name: "Almaty Judo Club",
    city: "Алматы",
    coach: "Қ. Серіков",
    athletes: 86,
    wins: 142,
    entries: 34,
    categories: 12,
    ready: 92,
    color: "from-sky-500/20 to-sky-500/5",
    image: athleteBlue1,
  },
  {
    name: "Astana Pro",
    city: "Астана",
    coach: "Д. Жұмабек",
    athletes: 64,
    wins: 118,
    entries: 28,
    categories: 10,
    ready: 86,
    color: "from-amber-500/20 to-amber-500/5",
    image: teamLineup,
  },
  {
    name: "Tigers Karaganda",
    city: "Қарағанды",
    coach: "Б. Темірлан",
    athletes: 48,
    wins: 96,
    entries: 21,
    categories: 8,
    ready: 78,
    color: "from-orange-500/20 to-orange-500/5",
    image: athleteBlue2,
  },
  {
    name: "Shymkent Warriors",
    city: "Шымкент",
    coach: "Е. Сейітжан",
    athletes: 52,
    wins: 88,
    entries: 24,
    categories: 9,
    ready: 82,
    color: "from-emerald-500/20 to-emerald-500/5",
    image: athleteWomanWhite,
  },
  {
    name: "Aktobe Dojo",
    city: "Ақтөбе",
    coach: "Н. Қанат",
    athletes: 39,
    wins: 71,
    entries: 16,
    categories: 7,
    ready: 74,
    color: "from-violet-500/20 to-violet-500/5",
    image: techniqueKyu,
  },
  {
    name: "Pavlodar Elite",
    city: "Павлодар",
    coach: "Р. Дәурен",
    athletes: 41,
    wins: 65,
    entries: 18,
    categories: 7,
    ready: 70,
    color: "from-rose-500/20 to-rose-500/5",
    image: heroKazakhstan,
  },
];

const topAthletes = [
  {
    rank: 1,
    name: "Ә. Сәрсенов",
    club: "Almaty Judo",
    weight: "−73 кг",
    points: 460,
    change: "+2",
    image: athleteBlue1,
  },
  {
    rank: 2,
    name: "Н. Қайратұлы",
    club: "Astana Pro",
    weight: "−81 кг",
    points: 410,
    change: "+1",
    image: athleteBlue2,
  },
  {
    rank: 3,
    name: "Д. Нұрлан",
    club: "Tigers Karaganda",
    weight: "−66 кг",
    points: 380,
    change: "−1",
    image: athleteWomanWhite,
  },
  {
    rank: 4,
    name: "С. Бекзат",
    club: "Shymkent Warriors",
    weight: "−90 кг",
    points: 295,
    change: "+3",
    image: techniqueKyu,
  },
  {
    rank: 5,
    name: "Р. Олжас",
    club: "Aktobe Dojo",
    weight: "−60 кг",
    points: 245,
    change: "—",
    image: heroKazakhstan,
  },
  {
    rank: 6,
    name: "М. Ержан",
    club: "Pavlodar Elite",
    weight: "−100 кг",
    points: 215,
    change: "+1",
    image: teamLineup,
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

function participantCount(tournament: any) {
  return (
    tournament?._count?.participants ??
    tournament?._count?.entries ??
    tournament?._count?.applicationEntries ??
    tournament?.participantsCount ??
    tournament?.entriesCount ??
    tournament?._count?.applications ??
    0
  );
}

function athleteName(a: any) {
  return `${a?.name ?? ""} ${a?.surname ?? ""}`.trim() || "Спортшы";
}

function categoryName(category: any) {
  if (!category) return "Санат";
  const gender =
    category.gender === "FEMALE" ? "Қыздар" : category.gender === "MALE" ? "Ұлдар" : "Аралас";
  const age =
    category.ageMin || category.ageMax ? `U${category.ageMax ?? category.ageMin}` : "Open";
  const weight = category.weightMax
    ? `−${category.weightMax} кг`
    : category.weightMin
      ? `+${category.weightMin} кг`
      : "Open";
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
  const { t: tCount } = useTranslation();
  const Cell = ({ v, l }: { v: number; l: string }) => (
    <div className="flex min-w-[3.8rem] flex-col items-center rounded-xl border border-gold/20 bg-background/50 px-2 py-3 sm:min-w-[5rem] sm:px-4">
      <div className="font-display text-3xl font-bold text-gradient-gold tabular-nums leading-none sm:text-5xl">
        {String(v).padStart(2, "0")}
      </div>
      <div className="mt-2 text-[9px] uppercase tracking-widest text-muted-foreground sm:text-[10px]">
        {l}
      </div>
    </div>
  );
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      <Cell v={d} l={tCount("home.countdown_days")} />
      <Cell v={h} l={tCount("home.countdown_hours")} />
      <Cell v={m} l={tCount("home.countdown_minutes")} />
      <Cell v={s} l={tCount("home.countdown_seconds")} />
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
  const { t } = useTranslation();
  void useTicker();
  //   const _mm = String(Math.floor(live.time / 60)).padStart(2, "0");
  //   const _ss = String(live.time % 60).padStart(2, "0");
  const tournamentsQuery = useQuery({
    queryKey: ["home-tournaments"],
    queryFn: () => api.tournaments.list({ limit: 8 }),
    staleTime: 60_000,
  });
  const clubsQuery = useQuery({
    queryKey: ["home-clubs"],
    queryFn: () => api.clubs.list({ limit: 1000 }),
    staleTime: 60_000,
  });
  const leaderboardQuery = useQuery({
    queryKey: ["home-leaderboard"],
    queryFn: () => api.ratings.leaderboard({ limit: 6 }),
    staleTime: 60_000,
  });
  const tournaments = useMemo(
    () => tournamentsQuery.data?.items ?? [],
    [tournamentsQuery.data?.items],
  );
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
  const liveMatches = (featuredMatchesQuery.data ?? [])
    .slice(0, 3)
    .map((match: any, i: number) => ({
      tatami: match.tatamiNumber ?? i + 1,
      category: categoryName(match.bracket?.category),
      current: `${athleteName(match.redAthlete)} vs ${athleteName(match.blueAthlete)}`,
      next: `Кезең ${match.round ?? 1} · Белдесу ${match.position ?? i + 1}`,
      status: statusText[match.status] ?? match.status ?? "Кезекте",
      progress: match.status === "COMPLETED" ? 100 : match.status === "IN_PROGRESS" ? 64 : 28,
    }));
  const totalApplications = tournaments.reduce(
    (sum: number, t: any) => sum + (t._count?.applications ?? 0),
    0,
  );
  const totalCategories = tournaments.reduce(
    (sum: number, t: any) => sum + (t._count?.categories ?? 0),
    0,
  );

  const teamRowsFromApi = (clubsQuery.data?.items ?? [])
    .slice(0, 4)
    .map((club: any, i: number) => ({
      name: localizeName(club.name),
      city: club.city ?? "—",
      coach: club.createdBy?.name
        ? `${club.createdBy.name} ${club.createdBy.surname ?? ""}`.trim()
        : "—",
      athletes: club._count?.members ?? 0,
      entries: Math.round((club._count?.members ?? 0) * 0.42),
      categories: Math.max(0, Math.round((club._count?.members ?? 0) / 7)),
      ready: Math.min(100, 62 + i * 8),
      color: clubs[i]?.color ?? "from-gold/20 to-gold/5",
      image: clubs[i]?.image ?? teamLineup,
    }));
  /* fallback to static demo data while API loads or when no clubs returned */
  const teamRows = teamRowsFromApi.length > 0 ? teamRowsFromApi : clubs.slice(0, 4);

  const athleteRows = (leaderboardQuery.data ?? []).slice(0, 6).map((row: any, i: number) => ({
    rank: row.rank ?? i + 1,
    name: `${row.athlete?.name ?? ""} ${row.athlete?.surname ?? ""}`.trim() || "—",
    club: row.athlete?.club ? localizeName(row.athlete.club.name) : "—",
    weight: row.athlete?.weightKg ? `−${row.athlete.weightKg} кг` : "—",
    points: Math.round(row.totalPoints ?? 0),
    change: i < 3 ? "+1" : "—",
    image: topAthletes[i]?.image ?? athleteBlue1,
  }));
  // Count-up for clubs section stats
  const { value: countTournaments, ref: refT } = useCountUp(
    tournamentsQuery.data?.total ?? tournaments.length,
  );
  const { value: countApplications, ref: refA } = useCountUp(totalApplications);
  const { value: countClubs, ref: refC } = useCountUp(clubsQuery.data?.total ?? 0);
  const { value: countCategories, ref: refCat } = useCountUp(totalCategories);

  // Magnetic effect for CTA buttons
  const magneticMove = (e: React.MouseEvent<HTMLElement>, strength = 0.4) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * strength;
    const y = (e.clientY - r.top - r.height / 2) * strength;
    el.style.transform = `translate(${x}px, ${y}px) scale(1.05)`;
  };
  const magneticLeave = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.style.transition = "transform 0.45s cubic-bezier(0.34,1.56,0.64,1)";
    el.style.transform = "translate(0,0) scale(1)";
    setTimeout(() => {
      el.style.transition = "";
    }, 450);
  };

  // 3D tilt for tournament cards
  const cardTilt = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-4px) scale(1.01)`;
    el.style.transition = "transform 0.1s ease-out";
  };
  const cardTiltLeave = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement;
    el.style.transition = "transform 0.5s cubic-bezier(0.34,1.56,0.64,1)";
    el.style.transform = "perspective(800px) rotateY(0) rotateX(0) translateY(0) scale(1)";
  };

  const [activeBelt, setActiveBelt] = useState(3);
  const beltPath = [
    {
      label: "Ақ",
      level: "6 КЮ",
      color: "from-white to-zinc-200",
      text: "text-navy-deep",
      progress: 14,
      skills: "Ұстау, құлау, негізгі тұрыс",
      techniques: ["Ukemi", "Shizen-hontai", "Kumi-kata", "Tai-sabaki", "Kesa-gatame"],
    },
    {
      label: "Сары",
      level: "5 КЮ",
      color: "from-yellow-300 to-yellow-500",
      text: "text-navy-deep",
      progress: 28,
      skills: "De-ashi-barai, Hiza-guruma",
      techniques: [
        "De-ashi-barai",
        "Hiza-guruma",
        "Sasae-tsurikomi-ashi",
        "O-goshi",
        "O-soto-gari",
        "O-uchi-gari",
        "Seoi-nage",
        "Kesa-gatame",
      ],
    },
    {
      label: "Қызғылт сары",
      level: "4 КЮ",
      color: "from-orange-400 to-orange-600",
      text: "text-navy-deep",
      progress: 42,
      skills: "Tai-otoshi, Kesa-gatame",
      techniques: [
        "Ko-soto-gari",
        "Ko-uchi-gari",
        "Koshi-guruma",
        "Tsurikomi-goshi",
        "Okuri-ashi-barai",
        "Tai-otoshi",
        "Harai-goshi",
        "Uchi-mata",
      ],
    },
    {
      label: "Жасыл",
      level: "3 КЮ",
      color: "from-green-500 to-emerald-700",
      text: "text-white",
      progress: 57,
      skills: "Uchi-mata, комбинация",
      techniques: [
        "Ko-soto-gake",
        "Tsuri-goshi",
        "Yoko-otoshi",
        "Ashi-guruma",
        "Hane-goshi",
        "Harai-tsurikomi-ashi",
        "Tomoe-nage",
        "Kata-guruma",
      ],
    },
    {
      label: "Көк",
      level: "2 КЮ",
      color: "from-sky-500 to-blue-700",
      text: "text-white",
      progress: 71,
      skills: "Tomoe-nage, ne-waza бақылау",
      techniques: [
        "Sumi-gaeshi",
        "Tani-otoshi",
        "Hane-makikomi",
        "Sukui-nage",
        "Utsuri-goshi",
        "O-guruma",
        "Soto-makikomi",
        "Uki-otoshi",
      ],
    },
    {
      label: "Қоңыр",
      level: "1 КЮ",
      color: "from-amber-700 to-amber-950",
      text: "text-white",
      progress: 86,
      skills: "Sode, Juji-gatame, тактика",
      techniques: [
        "O-soto-guruma",
        "Uki-waza",
        "Yoko-wakare",
        "Yoko-guruma",
        "Ushiro-goshi",
        "Ura-nage",
        "Sumi-otoshi",
        "Yoko-gake",
      ],
    },
    {
      label: "Қара",
      level: "1 ДАН",
      color: "from-neutral-900 to-black",
      text: "text-gold",
      progress: 100,
      skills: "Шеберлік, жарыс тәжірибесі",
      techniques: [
        "Nage-no-kata",
        "Katame-no-kata",
        "Ude-hishigi-juji-gatame",
        "Hadaka-jime",
        "Okuri-eri-jime",
        "Yoko-shiho-gatame",
      ],
    },
  ];
  const currentBelt = beltPath[activeBelt];

  // Scroll reveal for section content
  const revealRef = useScrollReveal();

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

  // Typewriter
  const typeText = useTypewriter(
    [t("home.typewriter_1"), t("home.typewriter_2"), t("home.typewriter_3")],
    60,
    2000,
  );

  // Ripple & Confetti
  const { trigger: ripple } = useRipple();
  const { burst } = useConfetti();

  // Mouse trail particles
  //   const _trailRef = useRef<Array<{ x: number; y: number; id: number }>>([]);
  const trailContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let id = 0;
    const onMove = (e: MouseEvent) => {
      const container = trailContainerRef.current;
      if (!container) return;
      id++;
      const dot = document.createElement("div");
      const size = 4 + Math.random() * 4;
      dot.style.cssText = `
        position:fixed;left:${e.clientX - size / 2}px;top:${e.clientY - size / 2}px;
        width:${size}px;height:${size}px;border-radius:50%;
        background:oklch(0.86 0.16 90/${0.4 + Math.random() * 0.4});
        pointer-events:none;z-index:9996;
        transition:opacity 0.5s ease,transform 0.5s ease;
        box-shadow:0 0 6px oklch(0.86 0.16 90/0.6);
      `;
      container.appendChild(dot);
      requestAnimationFrame(() => {
        dot.style.opacity = "0";
        dot.style.transform = `scale(0) translateY(-8px)`;
      });
      setTimeout(() => dot.remove(), 520);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Mouse spotlight effect for hero section
  const heroRef = useRef<HTMLElement | null>(null);
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  const cursorDotRef = useRef<HTMLDivElement | null>(null);
  const cursorRingRef = useRef<HTMLDivElement | null>(null);
  const cursorPos = useRef({ x: -200, y: -200 });
  const ringPos = useRef({ x: -200, y: -200 });
  const rafId = useRef<number>(0);

  useEffect(() => {
    const dot = cursorDotRef.current;
    const ring = cursorRingRef.current;
    const spotlight = spotlightRef.current;
    if (!dot || !ring || !spotlight) return;

    const animate = () => {
      ringPos.current.x += (cursorPos.current.x - ringPos.current.x) * 0.12;
      ringPos.current.y += (cursorPos.current.y - ringPos.current.y) * 0.12;
      dot.style.transform = `translate(${cursorPos.current.x - 4}px, ${cursorPos.current.y - 4}px)`;
      ring.style.transform = `translate(${ringPos.current.x - 20}px, ${ringPos.current.y - 20}px)`;
      rafId.current = requestAnimationFrame(animate);
    };
    rafId.current = requestAnimationFrame(animate);

    const onMove = (e: MouseEvent) => {
      cursorPos.current = { x: e.clientX, y: e.clientY };
      const hero = heroRef.current;
      if (hero) {
        const r = hero.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        spotlight.style.background = `radial-gradient(600px circle at ${x}px ${y}px, oklch(0.76 0.15 80 / 0.13), transparent 55%)`;
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col md:cursor-none"
      ref={revealRef as React.RefObject<HTMLDivElement>}
    >
      {/* Mouse trail container */}
      <div ref={trailContainerRef} className="pointer-events-none" />

      {/* Custom cursor — dot + ring (desktop only) */}
      <div
        ref={cursorDotRef}
        className="pointer-events-none fixed left-0 top-0 z-[9998] hidden h-2 w-2 rounded-full bg-gold shadow-[0_0_8px_oklch(0.76_0.15_80/0.9)] md:block"
        style={{ willChange: "transform" }}
      />
      <div
        ref={cursorRingRef}
        className="pointer-events-none fixed left-0 top-0 z-[9997] hidden h-10 w-10 rounded-full border border-gold/50 md:block"
        style={{ willChange: "transform", transition: "border-color 0.2s" }}
      />

      <SiteHeader hideUntilScroll />

      {/* HERO */}
      <section id="zharys" ref={heroRef} className="relative overflow-hidden">
        <div className="absolute inset-0 bg-navy-deep" />
        {/* logo watermark */}
        {/* logo watermark — more visible */}
        <img
          src={emblem}
          alt=""
          className="absolute left-1/2 top-1/2 h-[60%] w-auto max-w-[60%] -translate-x-1/2 -translate-y-1/2 object-contain select-none pointer-events-none"
          style={{ opacity: 0.13, filter: "blur(0px) saturate(0.4) brightness(1.8)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/65 to-background" />
        <div className="absolute inset-0 grid-bg opacity-30" />

        {/* Mouse spotlight */}
        <div
          ref={spotlightRef}
          className="pointer-events-none absolute inset-0 z-10 transition-[background] duration-100"
        />

        {/* Aurora + orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -left-32 -top-32 h-[700px] w-[700px] rounded-full opacity-18 blur-[120px] animate-aurora"
            style={{
              background:
                "radial-gradient(circle, oklch(0.76 0.15 80) 0%, oklch(0.60 0.18 280) 50%, transparent 70%)",
            }}
          />
          <div
            className="absolute -right-32 top-1/4 h-[500px] w-[500px] rounded-full opacity-14 blur-[100px]"
            style={{
              background:
                "radial-gradient(circle, oklch(0.55 0.20 260) 0%, oklch(0.76 0.15 80) 60%, transparent 70%)",
              animation: "aurora 22s ease-in-out 6s infinite",
            }}
          />
          {/* strong gold glow behind title */}
          <div
            className="absolute left-1/2 top-[28%] h-[320px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: "radial-gradient(ellipse, rgba(200,146,42,0.22) 0%, transparent 70%)",
              filter: "blur(40px)",
              animation: "heroOrb1 5s ease-in-out infinite",
            }}
          />
          <div
            className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/6 blur-[100px]"
            style={{ animation: "heroOrb1 6s ease-in-out infinite" }}
          />
        </div>

        {/* Floating particles */}
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="pointer-events-none absolute rounded-full bg-gold blur-[1px]"
            style={{
              left: `${(i * 61 + 5) % 98}%`,
              top: `${(i * 37 + 10) % 90}%`,
              width: `${2 + (i % 3)}px`,
              height: `${2 + (i % 3)}px`,
              opacity: 0.15 + (i % 5) * 0.06,
              animation: `heroFloat ${4 + (i % 4)}s ease-in-out ${(i * 0.4) % 4}s infinite`,
            }}
          />
        ))}

        {/* floating 3-D rings around title */}
        <div className="pointer-events-none absolute left-1/2 top-[26%] -translate-x-1/2 -translate-y-1/2">
          <div
            className="rounded-full"
            style={{
              width: 520,
              height: 140,
              border: "1px solid rgba(200,146,42,0.14)",
              animation: "ringFloat 8s ease-in-out infinite",
            }}
          />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-[26%] -translate-x-1/2 -translate-y-1/2">
          <div
            className="rounded-full"
            style={{
              width: 680,
              height: 180,
              border: "1px dashed rgba(200,146,42,0.08)",
              animation: "ringFloat 11s ease-in-out infinite reverse",
            }}
          />
        </div>

        <style>{`
          @keyframes heroOrb1   { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:0.7} 50%{transform:translate(-50%,-50%) scale(1.18);opacity:1} }
          @keyframes heroFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
          @keyframes heroBadgeIn{ from{opacity:0;transform:translateY(-14px) scale(0.9)} to{opacity:1;transform:translateY(0) scale(1)} }
          @keyframes heroTitleIn{ from{opacity:0;transform:translateY(28px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
          @keyframes heroCardIn { from{opacity:0;transform:rotateY(-8deg) rotateX(6deg) translateY(40px) scale(0.96)} to{opacity:1;transform:rotateY(-8deg) rotateX(6deg) translateY(0) scale(1)} }
          @keyframes heroCtaIn  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
          @keyframes heroLineIn { from{width:0} to{width:100%} }
          @keyframes ringFloat  { 0%,100%{transform:translateY(0) scaleX(1)} 50%{transform:translateY(-10px) scaleX(1.03)} }
          @keyframes goldSheen  { 0%{background-position:-200% center} 100%{background-position:200% center} }
          @keyframes titleGlow  { 0%,100%{filter:drop-shadow(0 0 18px rgba(200,146,42,0.35)) drop-shadow(0 8px 32px rgba(0,0,0,0.6))} 50%{filter:drop-shadow(0 0 38px rgba(200,146,42,0.62)) drop-shadow(0 12px 48px rgba(0,0,0,0.55))} }
          .hero-title-3d {
            animation: heroTitleIn 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.25s both, titleGlow 3.5s ease-in-out 1s infinite;
            text-shadow:
              0 1px 0 rgba(255,255,255,0.06),
              0 4px 0 rgba(0,0,0,0.35),
              0 8px 0 rgba(0,0,0,0.22),
              0 14px 30px rgba(0,0,0,0.45),
              0 0 60px rgba(200,146,42,0.18);
          }
          .hero-gold-word {
            background: linear-gradient(100deg, #a86510 0%, #f5c842 30%, #ffe066 48%, #f5c842 66%, #c8922a 85%, #e8a93a 100%);
            background-size: 200% 100%;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: goldSheen 4s linear infinite;
          }
        `}</style>

        <div className="container relative mx-auto px-4 pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
          <div className="mx-auto max-w-6xl text-center">
            <div
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-background/65 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-gold backdrop-blur"
              style={{ animation: "heroBadgeIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both" }}
            >
              <Trophy className="h-4 w-4" />
              {t("home.hero_badge")}
            </div>

            {/* ── 3-D glowing title ── */}
            <h1
              className="hero-title-3d font-display font-black leading-none"
              style={{ fontSize: "clamp(3.5rem,10vw,8rem)", letterSpacing: "-0.02em" }}
            >
              <span className="text-white">Judo</span>
              <span className="hero-gold-word">-Arena</span>
            </h1>

            {/* Animated gold divider line */}
            <div className="mx-auto mt-6 h-px max-w-xs overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-transparent via-gold to-transparent"
                style={{ animation: "heroLineIn 0.8s ease-out 0.7s both" }}
              />
            </div>

            <div
              className="mx-auto mt-8 max-w-5xl [perspective:1400px]"
              style={{ animation: "heroCardIn 0.9s cubic-bezier(0.22,1,0.36,1) 0.45s both" }}
            >
              <div
                ref={tiltRef}
                onMouseMove={handleTilt}
                onMouseLeave={resetTilt}
                className="group relative overflow-hidden rounded-2xl border border-gold/30 bg-card/88 text-left shadow-elegant backdrop-blur-xl transition-transform duration-200 ease-out [transform:rotateY(-8deg)_rotateX(6deg)] [transform-style:preserve-3d]"
              >
                <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-br from-gold/35 via-transparent to-destructive/20 opacity-60 blur-xl transition-opacity group-hover:opacity-90" />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,transparent_38%,oklch(0.86_0.16_90/0.18)_48%,transparent_58%,transparent_100%)] opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="pointer-events-none absolute right-6 top-6 h-24 w-24 rounded-full border border-gold/20 bg-gold/10 blur-sm [transform:translateZ(46px)]" />
                <div className="relative [transform:translateZ(34px)]">
                  <div className="border-b border-border/50 bg-background/45 px-5 py-4 sm:px-7">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive shadow-[0_0_18px_oklch(0.62_0.22_25/0.8)]" />
                        </span>
                        {t("home.registration_label")}
                      </div>
                      {featuredTournament && (
                        <span
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${featuredTournament.status === "IN_PROGRESS" ? "border-destructive/40 bg-destructive/15 text-destructive" : "border-gold/30 bg-gold/10 text-gold"}`}
                        >
                          {statusText[featuredTournament.status] ?? featuredTournament.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {featuredTournament ? (
                    <div className="p-4 sm:p-5">
                      <h2 className="font-display text-xl font-bold leading-tight text-foreground sm:text-2xl">
                        {localizeName(featuredTournament.name)}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-gold" />
                          {formatDateRange(
                            featuredTournament.startDate,
                            featuredTournament.endDate,
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-gold" />
                          {featuredTournament.location || featuredTournament.city || "Белгісіз"}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-gold" />
                          <span className="font-semibold text-gold">
                            {participantCount(featuredTournament)}
                          </span>{" "}
                          қатысушы
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/20 bg-gold/8 px-4 py-3">
                        <Countdown to={new Date(featuredTournament.startDate).getTime()} />
                        <Link
                          to="/login"
                          search={{ mode: "register" }}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-gold px-5 py-2.5 text-sm font-bold text-gold-foreground shadow-gold transition-transform hover:scale-[1.02]"
                        >
                          Тіркелу <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center sm:p-10">
                      <h2 className="font-display text-3xl font-bold">
                        {t("home.no_upcoming_tournament")}
                      </h2>
                      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                        {t("home.no_upcoming_tournament_hint")}
                      </p>
                      <Link
                        to="/tournaments"
                        className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-gradient-gold px-6 py-3 font-bold text-gold-foreground shadow-gold"
                      >
                        Жарыстарды көру
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tagline + CTA — below card */}
            <div style={{ animation: "heroCtaIn 0.7s ease-out 0.9s both" }}>
              <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Дзюдо жарыстарын{" "}
                <span className="text-gold/90 font-medium">
                  {typeText}
                  <span className="typewriter-cursor text-gold">|</span>
                </span>{" "}
                — жеребе, törелік, нақты уақыттағы дәреже бір экранда
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/tournaments"
                  onMouseMove={magneticMove}
                  onMouseLeave={magneticLeave}
                  onClick={(e) => ripple(e as any)}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-gold px-7 py-3.5 text-sm font-bold text-gold-foreground shadow-gold hover:shadow-[0_0_40px_oklch(0.76_0.15_80/0.6)] ripple-container overflow-hidden"
                  style={{ willChange: "transform", display: "inline-flex" }}
                >
                  <Trophy className="h-4 w-4" />
                  Жарыстарды көру
                </Link>
                <Link
                  to="/login"
                  search={{ mode: "register" }}
                  onMouseMove={magneticMove}
                  onMouseLeave={magneticLeave}
                  onClick={(e) => {
                    ripple(e as any);
                    burst(e.clientX, e.clientY);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-background/60 px-7 py-3.5 text-sm font-semibold backdrop-blur hover:border-gold/80 hover:bg-gold/10 ripple-container overflow-hidden"
                  style={{ willChange: "transform", display: "inline-flex" }}
                >
                  Тіркелу
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      </section>

      {/* TEAMS + ATHLETES */}
      <section
        id="klubtar"
        className="relative py-14 sm:py-20 border-y border-border/40 bg-navy-deep/30 overflow-hidden"
      >
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="container mx-auto px-4 relative">
          <div className="flex items-end justify-between mb-8 sm:mb-12 flex-wrap gap-4">
            <div className="reveal">
              {/* Count-up stats row */}
              <div className="flex flex-wrap gap-6 mb-6">
                {[
                  { val: countTournaments, ref: refT, label: t("home.stat_tournaments") },
                  { val: countApplications, ref: refA, label: t("home.stat_applications") },
                  { val: countClubs, ref: refC, label: t("home.stat_clubs") },
                  { val: countCategories, ref: refCat, label: t("home.stat_categories") },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex items-end gap-1.5"
                    ref={s.ref as React.RefObject<HTMLDivElement>}
                  >
                    <span className="font-display text-4xl font-bold text-gradient-gold tabular-nums leading-none">
                      {s.val}
                    </span>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold mb-3">
                {t("home.clubs_athletes_section")}
              </div>
              <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
                {t("home.clubs_athletes_title").split(" ").slice(0, -1).join(" ")}{" "}
                <span className="relative text-gradient-gold italic">
                  {t("home.clubs_athletes_title").split(" ").slice(-1)[0]}
                  <span className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-gold/80 via-gold/40 to-transparent" />
                </span>
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                {t("home.clubs_athletes_desc")}
              </p>
            </div>
            <Link
              to="/rankings"
              className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-5 py-3 text-sm font-bold text-gold-foreground shadow-gold transition-transform hover:scale-[1.02]"
            >
              {t("home.go_to_rankings")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-4 sm:grid-cols-2">
              {teamRows.slice(0, 4).map((c, i) => (
                <Link
                  to="/rankings"
                  key={c.name}
                  onMouseMove={cardTilt}
                  onMouseLeave={cardTiltLeave}
                  className="group relative overflow-hidden rounded-2xl border border-gold/20 bg-card/55 p-5 shadow-elegant backdrop-blur card-glow-border shimmer-card"
                  style={{ willChange: "transform", transformStyle: "preserve-3d" }}
                >
                  <LazyImage
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
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-gold/70" /> {c.city}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3 text-gold/70" /> {c.coach}
                      </span>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      {[
                        { label: t("home.club_stat_athletes"), value: c.athletes },
                        { label: t("home.club_stat_entries"), value: c.entries },
                        { label: t("home.club_stat_categories"), value: c.categories },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-lg bg-background/40 border border-border/60 p-3"
                        >
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            {item.label}
                          </div>
                          <div className="font-display text-2xl font-bold text-gradient-gold">
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                        <span>{t("coach.team_readiness")}</span>
                        <span>{c.ready}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-background/50 border border-border/50">
                        <div
                          className="h-full rounded-full bg-gradient-gold shadow-gold"
                          style={{ width: `${c.ready}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {teamRows.length === 0 && (
                <div className="sm:col-span-2 rounded-2xl border border-gold/20 bg-card/55 p-8 text-center text-muted-foreground">
                  {t("home.clubs_empty")}
                </div>
              )}
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-card/55 shadow-elegant backdrop-blur">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
              <div className="flex items-center justify-between border-b border-border/40 bg-background/30 px-4 py-4 sm:px-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-gold">
                    Тікелей дәреже
                  </div>
                  <h3 className="font-display text-xl font-semibold">Команда спортшылары</h3>
                </div>
                <Star className="h-5 w-5 text-gold" />
              </div>
              <div className="divide-y divide-border/40">
                {athleteRows.map((a) => {
                  const medal =
                    a.rank === 1
                      ? "text-yellow-400"
                      : a.rank === 2
                        ? "text-zinc-300"
                        : a.rank === 3
                          ? "text-amber-600"
                          : "text-muted-foreground";
                  const change = a.change.startsWith("+")
                    ? "text-emerald-400"
                    : a.change.startsWith("−")
                      ? "text-rose-400"
                      : "text-muted-foreground";
                  return (
                    <Link
                      to="/rankings"
                      key={`${a.rank}-${a.name}`}
                      className="group grid grid-cols-[3rem_1fr_auto] gap-3 px-4 py-4 hover:bg-gold/5 transition-colors items-center sm:px-5"
                    >
                      <div
                        className={`font-display text-2xl font-bold ${medal} flex items-center gap-2`}
                      >
                        {a.rank <= 3 && <Star className="h-4 w-4 fill-current" />}
                        {a.rank}
                      </div>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-full border border-gold/30 bg-gradient-gold shrink-0">
                          <LazyImage src={a.image} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold group-hover:text-gold transition-colors">
                            {a.name}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {a.club} · {a.weight}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-lg font-bold text-gradient-gold tabular-nums">
                          {a.points}
                        </div>
                        <div className={`text-xs tabular-nums ${change}`}>{a.change}</div>
                      </div>
                    </Link>
                  );
                })}
                {athleteRows.length === 0 && (
                  <div className="px-5 py-10 text-center text-muted-foreground">
                    {t("home.ratings_empty")}
                  </div>
                )}
              </div>
              <div className="border-t border-border/40 p-4">
                <Link
                  to="/rankings"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:border-gold/60"
                >
                  Барлық спортшылар <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ЖАРЫС ХАТТАМАЛАРЫ */}
      <section id="hattamalar" className="relative py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-60" />
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="container mx-auto px-4 relative">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div className="reveal">
              <div className="text-xs uppercase tracking-[0.3em] text-gold mb-4">
                {t("home.protocol_section")}
              </div>
              <h2 className="font-display text-5xl md:text-6xl font-bold leading-tight overflow-hidden">
                {t("home.protocol_title").split(" ").slice(0, 1).join(" ")}{" "}
                <span className="text-gradient-gold italic inline-block">
                  {t("home.protocol_title").split(" ").slice(1).join(" ")}
                </span>
              </h2>
              <p className="mt-3 text-muted-foreground max-w-xl">{t("home.protocol_desc")}</p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
              <Radio className="h-3.5 w-3.5 animate-pulse" /> {t("home.protocol_live_badge")}
            </span>
          </div>
          <div className="glass rounded-2xl p-6 border border-gold/20 shadow-elegant">
            <Bracket rounds={sampleRounds} />
          </div>
          <div className="mt-6 text-center">
            <Link
              to="/tournaments"
              className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-6 py-3 text-sm font-bold text-gold-foreground shadow-gold transition-transform hover:scale-[1.02]"
            >
              {t("home.go_to_protocol")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* PROTOCOL RESULT MODULE */}
      <section className="container mx-auto px-4 pb-14 sm:pb-20">
        <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-card/60 px-6 py-5 shadow-elegant backdrop-blur sm:px-8">
          <div className="absolute inset-0 grid-bg opacity-20" />
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-gold shadow-gold">
                <Trophy className="h-5 w-5 text-gold-foreground" />
              </div>
              <div>
                <div className="font-display text-lg font-bold">
                  {t("home.protocol_ready_title")}
                </div>
                <p className="text-sm text-muted-foreground">{t("home.protocol_ready_desc")}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/rankings"
                className="inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/15"
              >
                <BarChart className="h-4 w-4" /> Дәреже кестесі
              </Link>
              <Link
                to="/tournaments"
                className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-bold text-gold-foreground shadow-gold transition-transform hover:scale-[1.02]"
              >
                <GitBranch className="h-4 w-4" /> Жарыстарға өту
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* UPCOMING TOURNAMENTS WITH COUNTDOWN */}
      <section className="container mx-auto px-4 py-14 sm:py-20">
        <div className="flex items-end justify-between mb-8 sm:mb-12 flex-wrap gap-4">
          <div className="reveal">
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold mb-3">
              {t("home.calendar_section")}
            </div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold">
              {t("home.calendar_title").split(" ").slice(0, -1).join(" ")}{" "}
              <span className="text-gradient-gold italic">
                {t("home.calendar_title").split(" ").slice(-1)[0]}
              </span>
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
              {t("home.calendar_desc")}
            </p>
          </div>
          <Link
            to="/tournaments"
            className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm text-gold hover:border-gold/60"
          >
            {t("home.view_all_tournaments")} <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {featuredTournament ? (
          <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <Link
              to="/tournaments/$id"
              params={{ id: featuredTournament.id }}
              className="group relative min-h-[29rem] overflow-hidden rounded-2xl border border-gold/20 bg-card shadow-elegant transition-all hover:-translate-y-1 hover:border-gold/50"
            >
              <LazyImage
                src={featuredTournament.posterUrl || teamLineup}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-45 transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-destructive/20 to-gold/10 via-background/80" />
              <div className="absolute inset-0 grid-bg opacity-30" />
              <div className="relative flex h-full flex-col justify-between p-5 sm:p-7">
                <div>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/20 px-3 py-1.5 text-[10px] uppercase tracking-widest text-destructive">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />{" "}
                      {statusText[featuredTournament.status] ?? featuredTournament.status}
                    </span>
                    <span className="rounded-full border border-gold/30 bg-background/70 px-3 py-1.5 text-[10px] uppercase tracking-widest text-gold backdrop-blur">
                      Негізгі жарыс
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-gold" />
                      {formatDateRange(featuredTournament.startDate, featuredTournament.endDate)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-gold" />
                      {featuredTournament.city}
                    </span>
                  </div>
                  <h3 className="mt-4 max-w-2xl font-display text-3xl font-bold leading-tight sm:text-5xl">
                    {localizeName(featuredTournament.name)}
                  </h3>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Live жарыс модулі: командалар, қатысушылар, live-тор, белдесулер және хаттама
                    бір жерден бақыланады.
                  </p>
                </div>

                <div className="mt-8">
                  <div className="mb-5 grid grid-cols-3 gap-2">
                    {[
                      { label: "Өтінім", value: featuredTournament._count?.applications ?? 0 },
                      { label: "Татами", value: featuredTournament.tatamiCount ?? 1 },
                      { label: "Санат", value: featuredTournament._count?.categories ?? 0 },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl border border-white/10 bg-background/55 p-3 text-center backdrop-blur"
                      >
                        <div className="font-display text-2xl font-bold text-gradient-gold tabular-nums">
                          {item.value}
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                          {item.label}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["Шолу", "Қатысушылар", "Live-тор", "Белдесулер", "Хаттама"].map((tab, i) => (
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
                  {t("home.search_placeholder")}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {["2026", "LIVE", "Тіркеу ашық", "Бір шығару", "Айналмалы"].map((filter) => (
                  <span
                    key={filter}
                    className="rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    {filter}
                  </span>
                ))}
              </div>
              {upcomingRest.map((tour: any, i: number) => (
                <Link
                  to="/tournaments/$id"
                  params={{ id: tour.id }}
                  key={tour.id}
                  onMouseMove={cardTilt}
                  onMouseLeave={cardTiltLeave}
                  className={`group relative overflow-hidden rounded-2xl border border-gold/20 bg-card/55 p-4 shadow-elegant backdrop-blur reveal reveal-delay-${i + 1} card-glow-border shimmer-card`}
                  style={{ willChange: "transform", transformStyle: "preserve-3d" }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-gold/15 to-sky-500/10 opacity-80" />
                  <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gold/10 blur-2xl group-hover:bg-gold/20 transition-colors" />
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

                  <div className="relative flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-gold/30 bg-gold/15 px-2.5 py-1 text-[10px] uppercase tracking-widest text-gold">
                            {t("status.REGISTRATION_OPEN")}
                          </span>
                          <span className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                            {statusText[tour.status] ?? tour.status}
                          </span>
                        </div>
                        <h3 className="font-display text-lg font-semibold group-hover:text-gold transition-colors">
                          {localizeName(tour.name)}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-gold/70" />
                            {formatDateRange(tour.startDate, tour.endDate)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-gold/70" />
                            {tour.city}
                          </span>
                        </div>
                      </div>
                      <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-gold shadow-gold sm:flex">
                        <Trophy className="h-5 w-5 text-gold-foreground" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          label: t("home.stats_tournaments"),
                          value: tour._count?.applications ?? 0,
                        },
                        { label: t("home.tatami_label"), value: tour.tatamiCount ?? 1 },
                        { label: t("tournament.categories"), value: tour._count?.categories ?? 0 },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-xl border border-border/60 bg-background/35 p-3 text-center"
                        >
                          <div className="font-display text-xl font-bold text-gradient-gold tabular-nums sm:text-2xl">
                            {item.value}
                          </div>
                          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                            {item.label}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-4 border-t border-border/40 pt-4 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                          {tour.status === "IN_PROGRESS"
                            ? t("home.live_now")
                            : t("home.until_start")}
                        </div>
                        <Countdown to={new Date(tour.startDate).getTime()} />
                      </div>
                      <span className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold group-hover:border-gold/60">
                        {tour.status === "IN_PROGRESS"
                          ? t("home.live_bracket")
                          : t("home.full_info")}
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
            {t("home.tournaments_empty")}
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
              <div className="reveal">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-destructive">
                  <Radio className="h-3.5 w-3.5 animate-pulse" />
                  {t("home.live_center_badge")}
                </div>
                <h2 className="font-display text-3xl font-bold sm:text-4xl md:text-5xl">
                  {t("home.live_center_title")}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {t("home.live_center_desc")}
                </p>
              </div>
              <Link
                to="/tournaments"
                className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:border-gold/60"
              >
                Жарыс хаттамасы <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
              <div className="grid gap-4 md:grid-cols-3">
                {(liveMatches.length ? liveMatches : []).map((item, i) => (
                  <div
                    key={item.tatami}
                    className={`relative overflow-hidden rounded-2xl border border-border/60 bg-background/45 p-4 backdrop-blur blur-reveal reveal-delay-${i + 1} card-glow-border shimmer-card`}
                  >
                    <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gold/10 blur-2xl" />
                    <div className="relative flex items-center justify-between">
                      <span className="rounded-full border border-destructive/40 bg-destructive/15 px-2.5 py-1 text-[10px] uppercase tracking-widest text-destructive">
                        LIVE
                      </span>
                      <span className="font-display text-3xl font-bold text-gold/30">
                        #{item.tatami}
                      </span>
                    </div>
                    <div className="relative mt-4 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {item.category}
                    </div>
                    <h3 className="relative mt-2 min-h-[3rem] font-display text-lg font-semibold leading-tight">
                      {item.current}
                    </h3>
                    <div className="relative mt-4 rounded-xl border border-border/60 bg-card/50 p-3">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Келесі
                      </div>
                      <div className="mt-1 text-sm text-foreground">{item.next}</div>
                    </div>
                    <div className="relative mt-4">
                      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                        <span>{item.status}</span>
                        <span>{item.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full border border-border/50 bg-background/50">
                        <div
                          className="h-full rounded-full bg-gradient-gold shadow-gold"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {liveMatches.length === 0 && (
                  <div className="md:col-span-3 rounded-2xl border border-border/60 bg-background/45 p-8 text-center text-muted-foreground">
                    Белдесулер live-тор дайындалғаннан кейін осы блокта көрінеді.
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
                    <div className="text-[10px] uppercase tracking-[0.28em] text-gold">
                      {t("home.official_docs")}
                    </div>
                    <h3 className="font-display text-xl font-semibold">{t("home.docs_module")}</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { title: t("home.doc_start_sheet"), status: t("home.doc_ready") },
                    { title: t("home.doc_bracket"), status: t("home.doc_live") },
                    { title: t("home.doc_protocol"), status: t("home.doc_auto") },
                    { title: t("home.doc_pdf"), status: t("home.doc_final") },
                  ].map((doc) => (
                    <div
                      key={doc.title}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-card/45 px-4 py-3"
                    >
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

      {/* BELT PATH */}
      <section
        id="tehnika"
        ref={cineRef}
        className="relative overflow-hidden border-y border-border/40 py-16 sm:py-24"
      >
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
              opacity: 0.25 + (i % 4) / 10,
            }}
          />
        ))}

        <div className="container mx-auto px-4 relative">
          <div className="mb-8 max-w-3xl lg:mb-12 reveal">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-4 py-1.5">
              <BookOpen className="h-3.5 w-3.5 text-gold" />
              <span className="text-[10px] uppercase tracking-[0.28em] text-gold">
                Белбеу жүйесі
              </span>
            </div>
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-5xl md:text-6xl">
              Спортшының белбеу жолы
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Деңгей, техника және жарысқа дайындық бір экранда: спортшы қай белбеуде екенін, келесі
              қадамын және прогресін анық көреді.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-card/70 p-5 shadow-elegant backdrop-blur sm:p-8">
            <div className="absolute inset-0 grid-bg opacity-25" />
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/15 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative">
              {/* Top: belt name + level badge */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div
                    className={`h-12 w-12 shrink-0 rounded-xl border border-white/20 bg-gradient-to-br ${currentBelt.color} shadow-elegant sm:h-16 sm:w-16 sm:rounded-2xl`}
                  />
                  <div>
                    <div className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-gold">
                      белбеу жолы
                    </div>
                    <h3 className="mt-0.5 font-display text-4xl font-black leading-none sm:text-6xl">
                      {currentBelt.label}
                    </h3>
                  </div>
                </div>
                <div className="shrink-0 rounded-xl border border-gold/25 bg-background/55 px-3 py-2 text-right sm:rounded-2xl sm:px-5 sm:py-3">
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
                    ағымдағы деңгей
                  </div>
                  <div className="mt-0.5 font-display text-2xl font-bold text-gradient-gold sm:text-3xl">
                    {currentBelt.level}
                  </div>
                </div>
              </div>

              {/* Progress bar + stats */}
              <div className="mt-7 rounded-2xl border border-border/50 bg-background/35 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    жалпы прогресс
                  </span>
                  <span className="font-display text-2xl font-bold text-gradient-gold">
                    {currentBelt.progress}%
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full border border-border/50 bg-background/70">
                  <div
                    className="h-full rounded-full bg-gradient-gold shadow-gold transition-all duration-700"
                    style={{ width: `${currentBelt.progress}%` }}
                  />
                </div>
                <div className="mt-4 grid gap-2 grid-cols-3">
                  {(["Техника", "Тәртіп", "Жарыс"] as const).map((item, idx) => (
                    <div
                      key={item}
                      className="rounded-xl border border-border/50 bg-card/45 px-3 py-2.5"
                    >
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {item}
                      </div>
                      <div className="mt-1 font-display text-xl font-bold text-gold">
                        {Math.min(100, currentBelt.progress + idx * 7)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Techniques grid */}
              <div className="mt-7">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border/50" />
                  <span className="text-[10px] uppercase tracking-[0.28em] text-gold">
                    {currentBelt.label} белбеуінің техникалары
                  </span>
                  <div className="h-px flex-1 bg-border/50" />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {currentBelt.techniques.map((tech, idx) => (
                    <div
                      key={tech}
                      className="group flex items-center gap-2.5 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5 transition-all hover:border-gold/40 hover:bg-gold/8"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-[9px] font-bold text-gold">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-medium leading-tight">{tech}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Belt selector */}
              <div className="-mx-5 mt-7 sm:mx-0">
                <div className="flex gap-2.5 overflow-x-auto px-5 pb-2 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-7 [scrollbar-width:none]">
                  {beltPath.map((belt, i) => (
                    <button
                      key={belt.label}
                      type="button"
                      onClick={() => setActiveBelt(i)}
                      className={`group shrink-0 rounded-2xl border p-3 text-left transition-all hover:-translate-y-1 sm:shrink ${
                        activeBelt === i
                          ? "border-gold/70 bg-gold/15 shadow-gold"
                          : "border-border/60 bg-background/35 hover:border-gold/40 hover:bg-gold/8"
                      }`}
                      style={{ minWidth: "4.5rem" }}
                    >
                      <span
                        className={`mb-2.5 block h-8 rounded-xl border border-white/20 bg-gradient-to-r ${belt.color} transition-transform group-hover:scale-[1.03]`}
                      />
                      <span className="block font-display text-sm font-bold">{belt.label}</span>
                      <span className="text-[10px] text-gold">{belt.level}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PARTNERS / SPONSORS CAROUSEL */}
      <section className="container mx-auto px-4 py-14 sm:py-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-12">
          <div className="max-w-2xl reveal">
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold mb-3">
              Серіктестер
            </div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold">
              Бізге <span className="text-gradient-gold italic">сенім артқандар</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Федерациялар, клубтар және демеушілер. Карталарды көлденең жылжытып көріңіз.
            </p>
          </div>
          <div className="hidden rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-gold sm:block">
            серіктестер
          </div>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none]">
          <div className="flex gap-5">
            {partners.map((p) => (
              <div
                key={p.name}
                className="group relative h-[25rem] w-[18rem] shrink-0 overflow-hidden rounded-2xl border border-gold/20 bg-card shadow-elegant transition-all hover:-translate-y-1 hover:border-gold/50 sm:w-[21rem]"
              >
                <LazyImage
                  src={p.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-55 transition-transform duration-500 group-hover:scale-105"
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-t ${p.accent} via-background/70 to-background/10`}
                />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
                  <LazyImage
                    src={p.logo}
                    alt=""
                    className="h-12 w-12 rounded-xl border border-white/20 bg-white object-cover shadow-gold"
                  />
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
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
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
              { n: "01", t: "Тіркелу", d: "Спортшы немесе жаттықтырушы жеке кабинет ашады." },
              { n: "02", t: "Өтінім", d: "Жаттықтырушы клубтан атынан өтінім жібереді." },
              { n: "03", t: "Жеребе", d: "Әкімші бір батырмамен IJF хаттамасын құрады." },
              { n: "04", t: "Жекпе-жек", d: "Төреші LIVE панелде ұпайларды тіркейді." },
            ].map((s, i) => (
              <div key={s.n} className={`relative text-center reveal reveal-delay-${i + 1}`}>
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
      <section className="px-3 pb-16 sm:px-4 sm:pb-24">
        <div
          className="relative overflow-hidden rounded-3xl"
          style={{ background: "linear-gradient(135deg,#060c1c 0%,#0c1835 55%,#07101f 100%)" }}
        >
          {/* bg photo */}
          <LazyImage
            src={heroKazakhstan}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center opacity-20 mix-blend-luminosity"
          />
          {/* grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(200,146,42,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(200,146,42,0.06) 1px,transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
          {/* glow orbs */}
          <div
            className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle,rgba(200,146,42,0.14) 0%,transparent 65%)",
              filter: "blur(48px)",
            }}
          />
          <div
            className="absolute -bottom-20 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle,rgba(26,58,140,0.22) 0%,transparent 65%)",
              filter: "blur(40px)",
            }}
          />
          {/* top gold line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

          <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_1fr] lg:gap-12 lg:p-12 xl:p-14">
            {/* LEFT — copy */}
            <div className="flex flex-col justify-center">
              <div
                className="mb-5 inline-flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.28em]"
                style={{
                  background: "rgba(200,146,42,0.12)",
                  border: "1px solid rgba(200,146,42,0.28)",
                  color: "#e8a93a",
                }}
              >
                <Trophy className="h-3.5 w-3.5" />
                жарыс күні
              </div>
              <h2
                className="font-black leading-[0.88] text-white"
                style={{ fontSize: "clamp(2.2rem,4.5vw,4rem)", letterSpacing: "-0.025em" }}
              >
                Команда келді.
                <br />
                Тор ашылды.
                <br />
                <span
                  style={{
                    background: "linear-gradient(100deg,#c8922a,#f5c842,#c8922a)",
                    backgroundSize: "200% 100%",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    fontStyle: "italic",
                  }}
                >
                  Татами дайын.
                </span>
              </h2>
              <p
                className="mt-5 max-w-md text-sm leading-relaxed sm:text-base"
                style={{ color: "rgba(255,255,255,0.52)" }}
              >
                Жарыстың нақты шешуші көрінісі: кім тіркелді, қай татамиде күреседі және қандай
                құжат дайын болады.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/tournaments"
                  className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-[#1a0e00] transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg,#f0c040,#c8922a)",
                    boxShadow: "0 8px 28px rgba(200,146,42,0.42)",
                  }}
                >
                  Live жарыстар <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/tournaments"
                  className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold transition-all hover:brightness-110"
                  style={{
                    border: "1px solid rgba(200,146,42,0.30)",
                    color: "#e8a93a",
                    background: "rgba(200,146,42,0.08)",
                  }}
                >
                  Жарыс хаттамасы
                </Link>
              </div>
            </div>

            {/* RIGHT — 4 stat cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {[
                {
                  title: "Бастау парағы",
                  value: "248",
                  desc: "қатысушы бекітілді",
                  icon: Users,
                  color: "rgba(200,146,42,0.18)",
                },
                {
                  title: "Тор",
                  value: "18",
                  desc: "санат бойынша құрылды",
                  icon: GitBranch,
                  color: "rgba(59,130,246,0.18)",
                },
                {
                  title: "Татами",
                  value: "3",
                  desc: "live кезек жұмыс істейді",
                  icon: Radio,
                  color: "rgba(239,68,68,0.18)",
                },
                {
                  title: "Қорытынды",
                  value: "PDF",
                  desc: "медаль және хаттама",
                  icon: Shield,
                  color: "rgba(34,197,94,0.18)",
                },
              ].map((item, i) => (
                <div
                  key={item.title}
                  className={`group relative overflow-hidden rounded-2xl p-4 sm:p-5 transition-all hover:-translate-y-1 reveal reveal-delay-${i + 1}`}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  {/* icon bg glow */}
                  <div
                    className="absolute -right-8 -top-8 w-24 h-24 rounded-full pointer-events-none transition-opacity group-hover:opacity-100 opacity-70"
                    style={{ background: item.color, filter: "blur(20px)" }}
                  />
                  <div className="relative">
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-2xl"
                        style={{
                          background: "linear-gradient(135deg,#f0c040,#c8922a)",
                          boxShadow: "0 6px 18px rgba(200,146,42,0.40)",
                        }}
                      >
                        <item.icon className="h-5 w-5 text-[#1a0e00]" />
                      </div>
                      <span
                        className="font-black text-3xl sm:text-4xl leading-none"
                        style={{ color: "#e8a93a" }}
                      >
                        {item.value}
                      </span>
                    </div>
                    <p className="font-bold text-white text-base leading-tight">{item.title}</p>
                    <p
                      className="mt-1 text-xs sm:text-sm"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* bottom line */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
