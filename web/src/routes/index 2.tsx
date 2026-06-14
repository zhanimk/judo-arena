import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import heroImg from "@/assets/hero-judo.jpg";
import emblem from "@/assets/emblem.png";
import judoka3d from "@/assets/judoka-3d.jpg";
import { useEffect, useRef, useState } from "react";
import {
  Trophy, Shield, Users, Activity, Gavel, ArrowRight,
  Sparkles, Flame, Medal, Timer, Radio, ChevronRight,
  Building2, User, Calendar, MapPin, Star, BarChart,
} from "lucide-react";
import { Bracket, sampleRounds } from "@/components/judo/Bracket";

export const Route = createFileRoute("/index 2")({
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

const roles = [
  { name: "Әкімші", to: "/login", desc: "Жүйе, жарыстар, өтінімдер және татами кестесі — толық бақылау.", icon: Shield },
  { name: "Төреші", to: "/login", desc: "Жекпе-жектерді бағалайтын цифрлық панель. Ippon, Waza-ari, Shido.", icon: Gavel },
  { name: "Жаттықтырушы", to: "/login", desc: "Клуб өтінімдері, спортшыларды бақылау, нәтижелер.", icon: Users },
  { name: "Спортшы", to: "/login", desc: "Жеке кабинет, дәреже, схваткалар тарихы.", icon: Activity },
];

const stats = [
  { value: "<1с", label: "Жеребе тастау" },
  { value: "100%", label: "IJF стандарты" },
  { value: "24/7", label: "Live трансляция" },
  { value: "∞", label: "Қайтару тереңдігі" },
];

const partners = [
  "ҚР Дзюдо Федерациясы", "Almaty Judo Club", "Astana Pro", "Tigers Karaganda",
  "Shymkent Warriors", "IJF Standard", "Aktobe Dojo", "Pavlodar Elite",
];

const upcoming = [
  { name: "Алматы Кубогі 2026", date: "24–26 мамыр", city: "Алматы", status: "LIVE", participants: 248, startsAt: Date.now() + 1000 * 60 * 60 * 6 },
  { name: "Қазақстан Чемпионаты", date: "12–15 маусым", city: "Астана", status: "Тіркеу", participants: 412, startsAt: Date.now() + 1000 * 60 * 60 * 24 * 18 },
  { name: "Tigers Open", date: "2–3 шілде", city: "Қарағанды", status: "Тіркеу", participants: 96, startsAt: Date.now() + 1000 * 60 * 60 * 24 * 41 },
  { name: "Astana Junior Cup", date: "20 шілде", city: "Астана", status: "Тіркеу", participants: 184, startsAt: Date.now() + 1000 * 60 * 60 * 24 * 60 },
];

const clubs = [
  { name: "Almaty Judo Club", city: "Алматы", coach: "Қ. Серіков", athletes: 86, wins: 142, color: "from-sky-500/20 to-sky-500/5" },
  { name: "Astana Pro", city: "Астана", coach: "Д. Жұмабек", athletes: 64, wins: 118, color: "from-amber-500/20 to-amber-500/5" },
  { name: "Tigers Karaganda", city: "Қарағанды", coach: "Б. Темірлан", athletes: 48, wins: 96, color: "from-orange-500/20 to-orange-500/5" },
  { name: "Shymkent Warriors", city: "Шымкент", coach: "Е. Сейітжан", athletes: 52, wins: 88, color: "from-emerald-500/20 to-emerald-500/5" },
  { name: "Aktobe Dojo", city: "Ақтөбе", coach: "Н. Қанат", athletes: 39, wins: 71, color: "from-violet-500/20 to-violet-500/5" },
  { name: "Pavlodar Elite", city: "Павлодар", coach: "Р. Дәурен", athletes: 41, wins: 65, color: "from-rose-500/20 to-rose-500/5" },
];

const topAthletes = [
  { rank: 1, name: "Ә. Сәрсенов", club: "Almaty Judo", weight: "−73 кг", points: 460, change: "+2" },
  { rank: 2, name: "Н. Қайратұлы", club: "Astana Pro", weight: "−81 кг", points: 410, change: "+1" },
  { rank: 3, name: "Д. Нұрлан", club: "Tigers Karaganda", weight: "−66 кг", points: 380, change: "−1" },
  { rank: 4, name: "С. Бекзат", club: "Shymkent Warriors", weight: "−90 кг", points: 295, change: "+3" },
  { rank: 5, name: "Р. Олжас", club: "Aktobe Dojo", weight: "−60 кг", points: 245, change: "—" },
  { rank: 6, name: "М. Ержан", club: "Pavlodar Elite", weight: "−100 кг", points: 215, change: "+1" },
];

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
          <img src={heroImg} alt="" className="h-full w-full object-cover object-center mix-blend-luminosity" />
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
                  Қазір 2 жарыс — LIVE эфирде
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
                {stats.map((s, i) => (
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

      {/* REGISTER CTA — clearly visible right after hero */}
      <section className="container mx-auto px-4 -mt-6 relative z-10">
        <div className="relative overflow-hidden rounded-2xl gradient-border bg-gradient-navy border border-gold/30 p-5 sm:p-7 shadow-elegant">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold shrink-0">
                <Sparkles className="h-5 w-5 text-gold-foreground" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-gold mb-1">Тіркелу ашық</div>
                <h3 className="font-display text-xl sm:text-2xl font-bold leading-tight">
                  Спортшы немесе жаттықтырушы ретінде <span className="text-gradient-gold italic">бір минутта</span> тіркеліңіз
                </h3>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 md:shrink-0">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-gradient-gold text-gold-foreground px-6 py-3 rounded-md font-semibold shadow-gold hover:scale-105 transition-transform"
              >
                Тіркелу <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 glass border border-gold/30 px-6 py-3 rounded-md font-medium hover:border-gold/60 transition-colors"
              >
                Кіру
              </Link>
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
              Аренаға <span className="text-gradient-gold italic">шығу уақыты</span>
            </h2>
          </div>
          <Link to="/tournaments" className="text-sm text-gold hover:underline inline-flex items-center gap-1">
            Барлық жарыстар <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {upcoming.map((t) => (
            <Link
              to="/tournaments"
              key={t.name}
              className="group relative glass rounded-2xl p-6 hover:border-gold/50 transition-all hover:-translate-y-1 overflow-hidden"
            >
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold/10 blur-2xl group-hover:bg-gold/20 transition-colors" />
              <div className="relative flex items-start justify-between mb-4 gap-3">
                <div>
                  <h3 className="font-display text-xl sm:text-2xl font-semibold group-hover:text-gold transition-colors">
                    {t.name}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-gold/70" />{t.date}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-gold/70" />{t.city}</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-gold/70" />{t.participants}</span>
                  </div>
                </div>
                {t.status === "LIVE" ? (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-destructive/20 text-destructive border border-destructive/40 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" /> Live
                  </span>
                ) : (
                  <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-gold/15 text-gold border border-gold/30 shrink-0">
                    Тіркеу
                  </span>
                )}
              </div>
              <div className="relative mt-4 flex items-center justify-between gap-4 pt-4 border-t border-border/40">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Басталуына дейін</div>
                <Countdown to={t.startsAt} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CLUBS */}
      <section className="relative py-14 sm:py-20 border-y border-border/40 bg-navy-deep/30 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="container mx-auto px-4 relative">
          <div className="flex items-end justify-between mb-8 sm:mb-12 flex-wrap gap-4">
            <div>
              <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold mb-3">Клубтар</div>
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold">
                Қазақстанның <span className="text-gradient-gold italic">мықты клубтары</span>
              </h2>
            </div>
            <Link to="/rankings" className="text-sm text-gold hover:underline inline-flex items-center gap-1">
              Барлық клубтар <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((c, i) => (
              <Link
                to="/rankings"
                key={c.name}
                className={`group relative rounded-2xl p-6 overflow-hidden glass hover:border-gold/50 transition-all hover:-translate-y-1`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${c.color} opacity-60`} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
                      <Building2 className="h-5 w-5 text-gold-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">#{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="font-display text-xl font-semibold group-hover:text-gold transition-colors">
                    {c.name}
                  </h3>
                  <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {c.city} · бапкер: {c.coach}
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-background/40 border border-border/60 p-3">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Спортшы</div>
                      <div className="font-display text-2xl font-bold text-gradient-gold">{c.athletes}</div>
                    </div>
                    <div className="rounded-lg bg-background/40 border border-border/60 p-3">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Жеңіс</div>
                      <div className="font-display text-2xl font-bold text-gradient-gold">{c.wins}</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* TOP ATHLETES */}
      <section className="container mx-auto px-4 py-14 sm:py-20">
        <div className="flex items-end justify-between mb-8 sm:mb-12 flex-wrap gap-4">
          <div>
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold mb-3">Үздік спортшылар</div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold">
              Дәреженің <span className="text-gradient-gold italic">көшбасшылары</span>
            </h2>
          </div>
          <Link to="/rankings" className="text-sm text-gold hover:underline inline-flex items-center gap-1">
            Толық дәреже <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="glass rounded-2xl border border-gold/20 overflow-hidden">
          <div className="hidden sm:grid grid-cols-[60px_1fr_1fr_120px_120px_80px] gap-3 px-5 py-3 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40 bg-background/30">
            <div>#</div><div>Спортшы</div><div>Клуб</div><div>Салмақ</div><div className="text-right">Ұпай</div><div className="text-right">±</div>
          </div>
          <div className="divide-y divide-border/40">
            {topAthletes.map((a) => {
              const medal = a.rank === 1 ? "text-yellow-400" : a.rank === 2 ? "text-zinc-300" : a.rank === 3 ? "text-amber-600" : "text-muted-foreground";
              const change = a.change.startsWith("+") ? "text-emerald-400" : a.change.startsWith("−") ? "text-rose-400" : "text-muted-foreground";
              return (
                <Link
                  to="/rankings"
                  key={a.rank}
                  className="group grid grid-cols-2 sm:grid-cols-[60px_1fr_1fr_120px_120px_80px] gap-3 px-4 sm:px-5 py-4 hover:bg-gold/5 transition-colors items-center"
                >
                  <div className={`font-display text-2xl font-bold ${medal} flex items-center gap-2`}>
                    {a.rank <= 3 && <Star className="h-4 w-4 fill-current" />}
                    {a.rank}
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-gradient-gold flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-gold-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate group-hover:text-gold transition-colors">{a.name}</div>
                      <div className="text-[11px] text-muted-foreground sm:hidden truncate">{a.club} · {a.weight}</div>
                    </div>
                  </div>
                  <div className="hidden sm:block text-sm text-muted-foreground truncate">{a.club}</div>
                  <div className="hidden sm:block text-sm">{a.weight}</div>
                  <div className="text-right font-display text-lg sm:text-xl font-bold text-gradient-gold tabular-nums col-start-2 sm:col-auto">{a.points}</div>
                  <div className={`hidden sm:block text-right text-sm tabular-nums ${change}`}>{a.change}</div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* QUICK NAV — transitions */}
      <section className="container mx-auto px-4 pb-14 sm:pb-20">
        {/* SCORING SYSTEM */}
        <div className="mb-8 sm:mb-12 glass rounded-2xl border border-gold/20 p-5 sm:p-7 overflow-hidden relative">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl pointer-events-none" />
          <div className="relative flex items-start gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold shrink-0">
              <Trophy className="h-5 w-5 text-gold-foreground" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-gold mb-1">Ұпай жүйесі</div>
              <h3 className="font-display text-xl sm:text-2xl font-bold leading-tight">
                Әр <span className="text-gradient-gold italic">жарыс</span> үшін ұпайлар
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {[
              { p: 100, l: "1-орын", c: "from-yellow-400 to-amber-500", t: "text-navy-deep" },
              { p: 80,  l: "2-орын", c: "from-zinc-300 to-zinc-500",   t: "text-navy-deep" },
              { p: 50,  l: "3-орын", c: "from-amber-700 to-amber-900", t: "text-white" },
              { p: 30,  l: "3 үшін жеңіліс", c: "from-muted to-muted",  t: "text-foreground" },
              { p: 15,  l: "Жұбату · 7-орын", c: "from-muted to-muted", t: "text-foreground" },
            ].map((s) => (
              <div key={s.l} className={`relative rounded-xl bg-gradient-to-br ${s.c} p-3 sm:p-4 text-center shadow-elegant`}>
                <div className={`font-display text-2xl sm:text-3xl font-bold tabular-nums ${s.t}`}>{s.p}</div>
                <div className={`text-[10px] sm:text-xs uppercase tracking-widest mt-1 opacity-80 ${s.t}`}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { to: "/tournaments", label: "Жарыстарға өту", icon: Trophy, desc: "Афиша және live хаттамалар" },
            { to: "/rankings", label: "Дәрежеге өту", icon: BarChart, desc: "Спортшылар мен клубтар" },
            { to: "/protocol", label: "Хаттамаға өту", icon: Shield, desc: "Ресми құжаттар" },
          ].map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="group relative glass rounded-2xl p-6 flex items-center gap-4 hover:border-gold/50 transition-all hover:-translate-y-1 overflow-hidden"
            >
              <div className="h-14 w-14 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold shrink-0 group-hover:scale-110 transition-transform">
                <q.icon className="h-6 w-6 text-gold-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg font-semibold group-hover:text-gold transition-colors">{q.label}</div>
                <div className="text-xs text-muted-foreground">{q.desc}</div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-gold group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </section>

      {/* PARTNERS MARQUEE */}
      <section className="border-y border-border/40 bg-navy-deep/40 py-6 overflow-hidden">
        <div className="flex gap-12 animate-marquee whitespace-nowrap">
          {[...partners, ...partners].map((p, i) => (
            <div key={i} className="flex items-center gap-3 shrink-0 text-muted-foreground">
              <Medal className="h-4 w-4 text-gold/70" />
              <span className="font-display tracking-wide text-sm uppercase">{p}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CINEMATIC JUDOKA */}
      <section ref={cineRef} className="relative overflow-hidden min-h-[70vh] sm:min-h-[90vh] flex items-center">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 grid-bg opacity-30" />
        {/* Judoka image with parallax */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ transform: `translate3d(0, ${cineY}px, 0)` }}
        >
          <img
            src={judoka3d}
            alt="Дзюдошы — uchi-mata"
            loading="lazy"
            className="h-full w-full object-cover object-center opacity-95"
          />
        </div>
        {/* Vignette + gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,oklch(0.10_0.04_265/0.85)_75%,oklch(0.08_0.04_265)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/30 to-background/0" />
        <div className="absolute inset-0 bg-gradient-to-l from-background via-background/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />

        {/* Floating gold particles */}
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-gold/60 blur-[1px] animate-float"
            style={{
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              width: `${4 + (i % 4) * 2}px`,
              height: `${4 + (i % 4) * 2}px`,
              animationDelay: `${(i * 0.3) % 5}s`,
              animationDuration: `${5 + (i % 4)}s`,
              opacity: 0.35 + ((i % 5) / 10),
            }}
          />
        ))}

        {/* Orbiting emblem */}
        <img
          src={emblem}
          alt=""
          className="hidden md:block absolute right-[10%] top-1/2 -translate-y-1/2 h-40 w-40 opacity-30 animate-spin-slow"
        />
        <div className="hidden md:block absolute right-[12%] top-1/2 -translate-y-1/2 h-72 w-72 rounded-full conic-gold opacity-20 blur-2xl animate-spin-conic" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              <span className="text-xs tracking-widest uppercase text-muted-foreground">Дзюдо рухы</span>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold leading-[0.95] text-3d">
              Бір <span className="text-gradient-gold italic">сәт</span>.
              <br />Бір <span className="text-gradient-gold italic">ippon</span>.
              <br />Бір <span className="text-gradient-gold italic">жеңіс</span>.
            </h2>
            <p className="mt-5 sm:mt-6 text-base sm:text-lg text-muted-foreground max-w-lg leading-relaxed">
              Әр лақтыру — мыңдаған сағаттық еңбектің нәтижесі.
              Judo-Arena бұл сәтті дөл, әділ және мәңгілікке тіркейді.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <div className="glass rounded-lg px-4 py-3 border border-gold/20">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Сот шешімі</div>
                <div className="font-display text-xl text-gold">&lt; 0.4 с</div>
              </div>
              <div className="glass rounded-lg px-4 py-3 border border-gold/20">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Дәлдік</div>
                <div className="font-display text-xl text-gold">99.98%</div>
              </div>
              <div className="glass rounded-lg px-4 py-3 border border-gold/20">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Видео-қайта қарау</div>
                <div className="font-display text-xl text-gold">4K HDR</div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      </section>

      {/* FEATURES */}
      {/* PARTNERS / SPONSORS-STYLE WALL */}
      <section className="container mx-auto px-4 py-14 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold mb-3">Серіктестер</div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold">
            Бізге <span className="text-gradient-gold italic">сенім артқандар</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Қазақстан мен әлемдегі жетекші клубтар, федерациялар және демеушілер.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            ...partners,
            "JCL Foundation", "Kazakhstan Sport"
          ].map((p) => (
            <div
              key={p}
              className="glass rounded-xl border border-border/60 hover:border-gold/40 transition-all hover:-translate-y-0.5 px-4 py-5 sm:py-6 flex items-center justify-center text-center"
            >
              <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <Medal className="h-4 w-4 text-gold/70 shrink-0" />
                <span className="font-display tracking-wide text-xs sm:text-sm uppercase truncate">{p}</span>
              </div>
            </div>
          ))}
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


      {/* ROLES */}
      <section className="container mx-auto px-4 py-16 sm:py-24">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-12 items-start">
          <div className="lg:sticky lg:top-24">
            <div className="text-xs uppercase tracking-[0.3em] text-gold mb-4">Рөлдік модель</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold leading-tight">
              Әр рөлге —<br/><span className="text-gradient-gold italic">өз кабинеті</span>
            </h2>
            <p className="mt-6 text-muted-foreground">
              4 рөл, бір жүйе. RBAC негізіндегі құқықтарды бөлу,
              толық аудит және әр қатысушыға арналған жеке интерфейс.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground glass rounded-full px-3 py-1.5">
              <Flame className="h-3.5 w-3.5 text-gold" />
              Спортшы мен жаттықтырушы өздері тіркеледі
            </div>
          </div>
          <div className="grid gap-3">
            {roles.map((r, i) => (
              <Link key={r.name} to={r.to} className="group relative flex items-center gap-5 glass rounded-xl p-5 hover:border-gold/50 transition-all hover:translate-x-2 overflow-hidden">
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-gold opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="font-display text-2xl text-muted-foreground/40 w-8">0{i + 1}</div>
                <div className="h-12 w-12 rounded-lg bg-gradient-gold flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <r.icon className="h-5 w-5 text-gold-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg font-semibold">{r.name}</div>
                  <div className="text-sm text-muted-foreground">{r.desc}</div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-gold group-hover:translate-x-1 transition-all" />
              </Link>
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

      {/* CTA */}
      <section className="container mx-auto px-4 pb-16 sm:pb-24">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-navy border border-gold/20 p-8 sm:p-12 md:p-16 text-center shadow-elegant">
          <div className="absolute inset-0 grid-bg opacity-40" />
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-gold/20 blur-3xl animate-float" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-gold/10 blur-3xl animate-float" style={{ animationDelay: "1s" }} />
          <div className="relative">
            <Sparkles className="h-6 w-6 text-gold mx-auto mb-4" />
            <h2 className="font-display text-4xl md:text-6xl font-bold leading-tight">
              Тамаша жарыс өткізуге<br/><span className="text-gradient-gold italic">дайынсыз ба?</span>
            </h2>
            <p className="mt-6 text-muted-foreground max-w-xl mx-auto">
              Спортшы немесе жаттықтырушы ретінде тіркеліп, алғашқы өтінімді жіберіңіз.
              Қызмет иелері — әкімшіден кіру деректерін алады.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Link to="/login" className="inline-flex items-center gap-2 bg-gradient-gold text-gold-foreground px-8 py-4 rounded-md font-medium shadow-gold hover:scale-105 transition-transform">
                Жұмысты бастау <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/tournaments" className="inline-flex items-center gap-2 glass border border-gold/30 px-8 py-4 rounded-md font-medium hover:border-gold/60 transition-colors">
                Жарыстарды көру
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
