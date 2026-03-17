import { useEffect, useRef, useState } from "react";

function MetricCard({ value, suffix, label, desc, icon, percent, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  const [count, setCount] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const current = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay);
        }
      },
      { threshold: 0.2 }
    );

    if (current) observer.observe(current);
    return () => current && observer.unobserve(current);
  }, [delay]);

  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const end = value;
    const step = Math.max(1, Math.ceil(end / 40));

    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 35);

    return () => clearInterval(timer);
  }, [visible, value]);

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (circumference * (visible ? percent : 0)) / 100;

  return (
    <article
      ref={ref}
      className="group relative flex items-center gap-8 rounded-[32px] border border-border bg-card p-10 backdrop-blur-xl transition-all duration-500 hover:-translate-y-3 hover:scale-[1.02] hover:border-[#2b5ff5] hover:shadow-soft max-sm:flex-col max-sm:text-center"
    >
      <div className="absolute right-4 top-4 h-5 w-5 border-r-2 border-t-2 border-[#2b5ff5] opacity-50 transition-all duration-300 group-hover:right-5 group-hover:top-5 group-hover:opacity-100 max-sm:hidden" />

      <div className="relative h-[90px] w-[90px] shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgba(30,43,74,0.9)"
            strokeWidth="5"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#2b5ff5"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            className="transition-all duration-[1800ms] ease-out"
            style={{ filter: "drop-shadow(0 0 8px #2b5ff5)" }}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center text-2xl text-textMain">
          {icon}
        </div>
      </div>

      <div>
        <div className="text-[44px] font-black leading-none text-textMain">
          {count}
          <span className="ml-1 text-base text-textMuted">{suffix}</span>
        </div>

        <h3 className="my-3 text-[13px] font-extrabold uppercase tracking-[2px] text-[#2b5ff5]">
          {label}
        </h3>

        <p className="text-sm leading-7 text-textMuted">{desc}</p>
      </div>
    </article>
  );
}

export default function AdvantagesSection() {
  return (
    <section className="relative overflow-hidden bg-bg px-6 py-24 text-textMain transition-all duration-300 md:px-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(rgba(30,43,74,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(30,43,74,0.9) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(circle at 50% 50%, black, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 50%, black, transparent 85%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-3 flex items-center gap-4 font-mono text-[11px] uppercase tracking-[4px] text-[#2b5ff5]">
          <span className="inline-block h-px w-10 animate-pulse bg-[#2b5ff5] shadow-[0_0_10px_#2b5ff5]" />
          ЖҮЙЕЛІК ДИАГНОСТИКА • КӨК БЕЛБЕУ ДЕҢГЕЙІ
        </div>
        <h2 className="mb-16 text-[clamp(38px,8vw,86px)] font-black uppercase leading-[0.95] tracking-[-0.04em] text-textMain">
          ЖҮЙЕ
          <span className="block text-transparent [-webkit-text-stroke:1.5px_#2b5ff5] [text-shadow:0_0_35px_rgba(43,95,245,0.2)]">
            ӨНІМДІЛІГІ
          </span>
        </h2>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <MetricCard
            value={1}
            suffix="сек"
            label="КІДІРІС (LATENCY)"
            desc="Бүкіл желі бойынша таблоның лезде жауап қатуы."
            icon="⚡"
            percent={92}
            delay={0}
          />
          <MetricCard
            value={32}
            suffix="+"
            label="ТАТАМИ САНЫ"
            desc="Әлем чемпионаты деңгейіне дейін масштабтау мүмкіндігі."
            icon="🥋"
            percent={85}
            delay={200}
          />
          <MetricCard
            value={100}
            suffix="%"
            label="СЕНІМДІЛІК"
            desc="Деректердің кепілді түрде жеткізілуі және сақталуы."
            icon="🛡️"
            percent={100}
            delay={400}
          />
        </div>
      </div>
    </section>
  );
}