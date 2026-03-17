const highlights = [
  {
    id: 1,
    title: "Top 10 Ippons from Paris Grand Slam 2024",
    meta: "8.4M Views • 2 days ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBXSWkLlz3kHUlGh7aqcqyNKPjX9pDNYTpRa5042Xrpu7drc1GhTlWdlpuqU8uJSWSzXp0ckC7SDiMhFBbaiRbaN5UNa0rsWVJhiSgeNq1tel90wESVblMpJVSuJH_olhk1U49CBEbJU5J9eoR92q0uyX--aKHhT9x_Wf6WnUvZ44AX9E3OTAmaw8KQUnADqIqTwQHZOzvzZUQnZv8A9r_jkLvYZ91-7fY4wB2yxbEe3C8XJlW7HNbioZ81p8tDtoXztt4E0gY0HV4",
  },
  {
    id: 2,
    title: "Heavyweight Division: Riner vs Tushishvili",
    meta: "1.2M Views • 5 days ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBhv5dHvGY3mVoKWE69qqR29Akx_H1gCLG1FOGtJ6ddYm12IULA1HJdjk1gTEV6d3i-zwf3gpfqhs2HMmcHKO1i0JaHUaL8aJlC-_xtJLLsW7VbYvD9i9k_D2BlhaAYhpT3Vf5alorcIFP-WrvvHN0CJu3vXJwMhLz0bPFB0N_61S9gqOncxXI5XfeN9DKzKaLdWp9_qmMerKkJPAIvNsL4SF3RiOAnk5piENi2mHO6J3eHVs_XLejaKE_TUVRW4Wc7bxXv1qdYPfQ",
  },
  {
    id: 3,
    title: "Women's -48kg Technical Breakdown",
    meta: "450K Views • 1 week ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD5mx7ro8y5rYGgHgoP_kuXDz_rK-CQzgW0KDceD_A55o6-Cq3XCcVkAMBJNW0Rc1Nvr5SSlOF2EtfDY9reSLEfPNmmQGqGIxa-iuIQdmpsLk1KDf5BEsRvlhVkAretm2R3NQRCjZPY6CXg0kbIX0FKy_oF3DQaWHuq_fqiQkfB8XZRptPHpvpQ2ZgIkUO9gMsFDwBWstT6Ffm7-SiZlok2WxNPdc7rQofcGYMRX8aVNknsSuBLKS7-8b_p02-4AnI-pDXUH9oZZFA",
  },
];

export default function HighlightsSection() {
  return (
    <section className="border-y border-darkBorder bg-darkSurface/30 py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-20 text-center">
          <h2 className="relative inline-block text-4xl font-extrabold uppercase tracking-tighter text-white">
            Live Match Highlights
            <div className="absolute -bottom-4 left-1/2 h-1 w-12 -translate-x-1/2 bg-primary" />
          </h2>
        </div>

        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div className="group relative aspect-video cursor-pointer overflow-hidden rounded-custom border-2 border-primary/20 bg-darkBg shadow-2xl">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8oLAyIdyGUUjD8a1XyzInpykkdC_XS_sod9yYLiGC1eL6ddcutjHITX_iVnKS5cm3qDcn-jZiUEGG4zwx2YF2ISW-3mNXvt9l2hQuSTlMnVeH1KyHgH9znNWNa2YnDJLd5PRKZ6-Oml_X5q61ztaS828nBDqSIwa7N-UJA3UCy78vydvSEAVQlk_6tH7RdsZ62htoJcAKQcDoi6tT1VkPCTREVdx51U-SBENDVxVs6aD0qtabOal3FVCrjiImzeGuwVWK4oAOA04"
              alt="Featured highlight"
              className="h-full w-full object-cover opacity-50 transition-opacity duration-500 group-hover:opacity-30"
            />

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gold-gradient text-darkBg shadow-2xl transition-transform duration-500 group-hover:scale-110">
                <span className="ml-1 text-4xl">▶</span>
              </div>
            </div>

            <div className="absolute bottom-8 left-8 right-8">
              <span className="mb-4 inline-block rounded-sm bg-primary px-3 py-1 text-[9px] font-black uppercase tracking-widest text-darkBg shadow-lg">
                Flashback
              </span>

              <h4 className="text-2xl font-bold text-white drop-shadow-lg">
                Incredible Osoto-gari by Abe Hifumi (Tokyo Finals)
              </h4>
            </div>
          </div>

          <div className="space-y-4">
            {highlights.map((item) => (
              <div
                key={item.id}
                className="group flex cursor-pointer gap-6 rounded-custom border border-transparent p-5 transition-all hover:border-primary/30 hover:bg-darkSurface"
              >
                <div className="h-24 w-36 flex-shrink-0 overflow-hidden rounded-sm border border-darkBorder bg-darkBg transition-all group-hover:border-primary/50">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                  />
                </div>

                <div>
                  <h5 className="mb-2 text-lg font-bold leading-snug text-white transition-colors group-hover:text-primary">
                    {item.title}
                  </h5>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {item.meta}
                  </p>
                </div>
              </div>
            ))}

            <button className="w-full py-6 text-center text-[11px] font-black uppercase tracking-[0.3em] text-primary transition-colors hover:text-white">
              Explore Library
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}