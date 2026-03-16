export default function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top,_rgba(43,95,245,0.18),_transparent_30%),linear-gradient(180deg,_#07111F_0%,_#060B18_100%)]"
    >
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:50px_50px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_35%)]" />

      <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-3 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-[#F6E27A]">
            <span className="h-2 w-2 rounded-full bg-[#F6E27A] shadow-[0_0_12px_#F6E27A]" />
            АШЫҚ РЕЖИМ • LIVE • КӨП ТАТАМИ
          </div>

          <h1 className="mt-8 text-5xl font-semibold leading-none tracking-tight md:text-7xl">
            JUDO ARENA
            <br />
            <span className="bg-gradient-to-r from-[#FFF1A8] to-[#D4AF37] bg-clip-text text-transparent">
              ЭВОЛЮЦИЯСЫ
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">
            Көрермендерге арналған кәсіби трансляция және ұйымдастыру алқасы үшін
            жүйені дәл басқару. Жарыс нәтижелері мен хаттамалар лезде жаңартылады.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <a
              href="/viewer"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#F6E27A] to-[#D4AF37] px-7 py-4 text-base font-semibold text-[#081426] shadow-[0_12px_40px_rgba(212,175,55,0.2)] transition duration-300 hover:-translate-y-0.5"
            >
              Көрермен экраны
              <span className="ml-2">→</span>
            </a>

            <a
              href="/results"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-base font-semibold text-white backdrop-blur-md transition duration-300 hover:border-[#D4AF37]/50 hover:text-[#F6E27A]"
            >
              Нәтижелерді қарау
            </a>
          </div>

          <div className="mt-12 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div className="text-3xl font-semibold text-[#F6E27A]">≤ 1с</div>
              <div className="mt-1 text-sm text-white/60">жаңарту жылдамдығы</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div className="text-3xl font-semibold text-[#F6E27A]">Multi</div>
              <div className="mt-1 text-sm text-white/60">татами режимі</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}