import { Link } from "react-router-dom";

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-[#050A18] px-4 pb-20 pt-[140px] md:px-6 md:pt-[150px]">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(30,43,74,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(30,43,74,0.55) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
          maskImage: "radial-gradient(circle at 30% 30%, black, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(circle at 30% 30%, black, transparent 80%)",
        }}
      />

      <div className="pointer-events-none absolute left-[10%] top-[-8%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(30,111,255,0.22),transparent_70%)] blur-[80px]" />

      <div className="relative z-10 mx-auto w-full max-w-[1300px]">
        <div className="max-w-[950px] text-left">
          <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-[rgba(15,20,34,0.72)] px-5 py-2 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-[#1E6FFF] shadow-[0_0_14px_#1E6FFF]" />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#B8C7FF]">
              АШЫҚ РЕЖИМ • LIVE • КӨП ТАТАМИ
            </span>
          </div>

          <h1 className="mb-8 leading-[0.9] tracking-[-0.03em]">
            <span className="block text-[clamp(46px,8.5vw,92px)] font-black uppercase text-white">
              JUDO ARENA
            </span>
            <span className="mt-1 block text-[clamp(40px,7.6vw,86px)] font-black uppercase text-transparent [-webkit-text-stroke:1.5px_#1E6FFF] [text-shadow:0_0_30px_rgba(30,111,255,0.25)]">
              ЭВОЛЮЦИЯСЫ
            </span>
          </h1>

          <p className="mb-12 max-w-[600px] text-[clamp(16px,2.1vw,20px)] leading-[1.6] text-[#95A3C3]">
            Көрермендерге арналған кәсіби трансляция және ұйымдастыру алқасы үшін
            жүйені дәл басқару. Жарыс нәтижелері мен хаттамалар лезде жаңартылады.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              to="/viewer"
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#1E6FFF,#6A5CFF)] px-7 py-4 text-lg font-extrabold text-white shadow-[0_15px_35px_rgba(30,111,255,0.30)] transition-all duration-300 hover:-translate-y-1 hover:brightness-110 md:px-9 md:py-5"
            >
              Көрермен экраны
              <span>→</span>
            </Link>

            <Link
              to="/results"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-[rgba(15,20,34,0.72)] px-7 py-4 text-lg font-extrabold text-white backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/20 md:px-9 md:py-5"
            >
              Нәтижелерді қарау
            </Link>
          </div>

          <div className="mt-14 flex flex-wrap gap-3">
            <div className="flex min-w-[220px] items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-[rgba(15,20,34,0.72)] px-5 py-4">
              <div className="text-[22px] font-black text-white">≤ 1с</div>
              <div className="text-[11px] uppercase tracking-[0.1em] text-[#95A3C3]">
                жаңарту жылдамдығы
              </div>
            </div>

            <div className="flex min-w-[220px] items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-[rgba(15,20,34,0.72)] px-5 py-4">
              <div className="text-[22px] font-black text-white">Multi</div>
              <div className="text-[11px] uppercase tracking-[0.1em] text-[#95A3C3]">
                татами режимі
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}