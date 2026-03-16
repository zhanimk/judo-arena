const features = [
  {
    title: "Тіркеу Жүйесі",
    description:
      "IJF ережелеріне сәйкес қатысушыларды автоматты түрде салмақ дәрежелеріне бөлу және деректерді валидациялау.",
    image:
      "https://placehold.co/600x400/2b5ff5/white?text=Тіркеу+Жүйесі",
  },
  {
    title: "Online Табло",
    description:
      "Белдесу барысы мен нәтижелерін кез келген құрылғыдан нақты уақыт режимінде бақылау мүмкіндігі.",
    image:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR6MoIzl-j3JnWskyXp6JsiKO0qNT2_dsGc3g&s",
  },
  {
    title: "Мульти-Татами",
    description:
      "Ондаған жарыс алаңдарының жұмысын бірыңғай орталықтан қатесіз үйлестіру және басқару.",
    image:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTc0hWfvwGunhkpRtgGRU7jJRa-YBRgLLeoDw&s",
  },
];

export default function About() {
  return (
    <section id="about" className="relative overflow-hidden py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.08),_transparent_25%)]" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <header className="max-w-3xl">
          <h2 className="text-4xl font-semibold leading-tight md:text-6xl">
            ПЛАТФОРМА ТУРАЛЫ
            <br />
            <span className="text-white/45">КӘСІБИ ЖҮЙЕ НЕГІЗІ</span>
          </h2>

          <p className="mt-6 text-lg leading-8 text-white/70">
            Біздің платформа дзюдо турнирлерін халықаралық стандарттарға сай
            ұйымдастыруға, бірнеше татамиді орталықтандырылған жүйе арқылы
            басқаруға және нәтижелерді нақты уақытта бақылауға мүмкіндік береді.
          </p>
        </header>

        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {features.map((item) => (
            <article
              key={item.title}
              className="group overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-[#D4AF37]/30"
            >
              <div className="relative h-56 overflow-hidden">
                <img
                  src={item.image}
                  alt={item.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#060B18] via-transparent to-transparent" />
              </div>

              <div className="p-6">
                <h3 className="text-2xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/65">
                  {item.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}