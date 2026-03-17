export default function AboutSection() {
  const features = [
    {
      title: "Тіркеу Жүйесі",
      desc: "Қатысушыларды автоматты тіркеу, салмақ дәрежелері бойынша бөлу және өтінімдерді басқару.",
      img: "https://images.unsplash.com/photo-1599059813005-11265ba4b4ce?q=80&w=1200&auto=format&fit=crop",
      accent: "bg-[linear-gradient(135deg,#3E63DD,#5B8CFF)]",
    },
    {
      title: "Live Бақылау",
      desc: "Белдесулерді, нәтижелерді және татами жағдайын нақты уақыт режимінде бақылау мүмкіндігі.",
      img: "https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1200&auto=format&fit=crop",
      accent: "bg-[linear-gradient(135deg,#0F172A,#111827)]",
    },
    {
      title: "Турнир Басқару",
      desc: "Бірнеше татамиді орталықтан басқару, кесте, bracket және жарыс логикасын бақылау.",
      img: "https://images.unsplash.com/photo-1603787081207-362bcef7c144?q=80&w=1200&auto=format&fit=crop",
      accent: "bg-[linear-gradient(135deg,#0F172A,#111827)]",
    },
  ];

  return (
    <section
      id="about"
      className="relative overflow-hidden bg-[#050A18] px-5 py-24 text-white md:px-8"
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 bg-[radial-gradient(circle,rgba(29,120,255,0.18),transparent_70%)] blur-[90px]" />

      <div className="relative z-10 mx-auto max-w-[1280px]">
        <div className="mb-16 text-center">
          <h2 className="text-[clamp(38px,6vw,92px)] font-black uppercase leading-[0.92] tracking-[-0.045em] text-white">
            ПЛАТФОРМА ТУРАЛЫ
            <span className="block text-transparent [-webkit-text-stroke:1.6px_rgba(191,219,254,0.95)] [text-shadow:0_0_26px_rgba(45,125,255,0.2)]">
              КӘСІБИ ЖҮЙЕ НЕГІЗІ
            </span>
          </h2>

          <p className="mx-auto mt-7 max-w-[860px] text-[18px] leading-[1.75] text-[#9FB0D1] md:text-[20px]">
            Біздің платформа дзюдо турнирлерін халықаралық стандарттарға сай
            ұйымдастыруға, бірнеше татамиді орталықтандырылған жүйе арқылы
            басқаруға және нәтижелерді нақты уақытта бақылауға мүмкіндік береді.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {features.map((item, index) => (
            <article
              key={item.title}
              className="group relative overflow-hidden rounded-[30px] border border-white/10 bg-[rgba(10,16,30,0.82)] shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition-all duration-500 hover:-translate-y-3 hover:border-[#2D7DFF] hover:shadow-[0_30px_70px_rgba(0,0,0,0.45)]"
            >
              <div className={`h-[220px] w-full ${item.accent}`}>
                {index !== 0 && (
                  <img
                    src={item.img}
                    alt={item.title}
                    className="h-full w-full object-cover opacity-95 transition duration-700 group-hover:scale-[1.05]"
                  />
                )}

                {index === 0 && (
                  <div className="flex h-full items-center justify-center px-8 text-center">
                    <span className="text-[clamp(34px,4vw,62px)] font-light tracking-[-0.04em] text-white">
                      Тіркеу Жүйесі
                    </span>
                  </div>
                )}
              </div>

              <div className="relative min-h-[220px] bg-[rgba(5,10,24,0.95)] px-8 pb-8 pt-7">
                <div className="mb-5 h-12 w-12 bg-[#2D7DFF] shadow-[0_0_24px_rgba(45,125,255,0.35)]" />

                <h3 className="mb-3 text-[26px] font-black tracking-[-0.03em] text-white">
                  {item.title}
                </h3>

                <p className="text-[16px] leading-7 text-[#9FB0D1]">
                  {item.desc}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}