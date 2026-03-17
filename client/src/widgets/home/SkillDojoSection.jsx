import { useState } from "react";

const skills = [
  {
    id: 1,
    name: "IPPON SEOI-NAGE",
    type: "Te-Waza (Қол техникасы)",
    desc: "Қарсыластың иығынан асыра, бір қолмен ұстап лақтырудың классикалық әдісі.",
  },
  {
    id: 2,
    name: "UCHI-MATA",
    type: "Ashi-Waza (Аяқ техникасы)",
    desc: "Санмен қағып лақтыру — қазіргі дзюдоның ең тиімді және кең тараған тәсілі.",
  },
  {
    id: 3,
    name: "OSOTO-GARI",
    type: "Ashi-Waza (Аяқ техникасы)",
    desc: "Сырттан шалып лақтыру. Қарсыластың тепе-теңдігін бұзу арқылы орындалатын күшті әдіс.",
  },
];

export default function SkillDojoSection() {
  const [activeId, setActiveId] = useState(null);

  return (
    <section className="relative overflow-hidden bg-bg px-6 py-24 text-textMain transition-all duration-300 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-20 text-center">
          <h2 className="mb-6 text-[clamp(38px,8vw,86px)] font-black uppercase leading-[0.95] tracking-[-0.04em] text-textMain">
            ДЗЮДО ӨНЕРІ
            <span className="block text-transparent [-webkit-text-stroke:1.5px_#ffea00] [text-shadow:0_0_30px_rgba(255,234,0,0.2)]">
              ТЕХНИКА
            </span>
          </h2>

          <p className="mx-auto max-w-2xl text-[clamp(16px,2vw,19px)] leading-8 text-textMuted">
            Әдістің биомеханикасын зерттеу үшін картаға меңзерді апарыңыз
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {skills.map((skill) => {
            const active = activeId === skill.id;

            return (
              <article
                key={skill.id}
                onMouseEnter={() => setActiveId(skill.id)}
                onMouseLeave={() => setActiveId(null)}
                className="group relative flex cursor-crosshair flex-col overflow-hidden rounded-[24px] border border-border bg-card p-10 transition-all duration-500 hover:-translate-y-3 hover:border-[#ffea00] hover:shadow-soft"
              >
                <div className="absolute right-4 top-4 h-[10px] w-[10px] border-r border-t border-[#ffea00] opacity-0 transition-all duration-300 group-hover:right-6 group-hover:top-6 group-hover:opacity-100" />

                <div className="mb-3 font-mono text-[11px] uppercase tracking-[3px] text-[#ffea00]">
                  {skill.type}
                </div>

                <h3 className="mb-5 text-2xl font-black text-textMain">
                  {skill.name}
                </h3>

                <div className="relative mb-8 h-[120px] overflow-hidden border border-dashed border-border bg-black/10">
                  <span
                    className={`absolute left-1/2 top-[20%] h-[40px] w-px -translate-x-1/2 rotate-45 bg-[#ffea00] transition-all duration-500 ${
                      active ? "opacity-100 shadow-[0_0_10px_#ffea00]" : "opacity-30"
                    }`}
                  />
                  <span
                    className={`absolute left-[30%] top-1/2 h-px w-[50px] bg-[#ffea00] transition-all duration-500 ${
                      active ? "opacity-100 shadow-[0_0_10px_#ffea00]" : "opacity-30"
                    }`}
                  />
                  <span
                    className={`absolute left-[70%] top-[15%] h-[60px] w-px -rotate-[30deg] bg-[#ffea00] transition-all duration-500 ${
                      active ? "opacity-100 shadow-[0_0_10px_#ffea00]" : "opacity-30"
                    }`}
                  />
                </div>

                <p className="mb-8 flex-grow text-[15px] leading-7 text-textMuted">
                  {skill.desc}
                </p>

                <div className="mt-auto">
                  <div className="mb-3 font-mono text-xs font-bold uppercase tracking-[2px] text-textMuted">
                    IMPACT (КҮШІ)
                  </div>
                  <div className="h-[3px] w-full overflow-hidden rounded-full bg-border">
                    <div className={`h-full bg-[#ffea00] shadow-[0_0_10px_#ffea00] transition-all duration-700 ${
                        active ? "w-[85%]" : "w-[0%]"
                      }`}
                    />
                  </div>
                </div>

                <div
                  className="pointer-events-none absolute bottom-[-10px] right-[-10px] h-[120px] w-[120px] opacity-10"
                  style={{
                    backgroundImage:
                      "radial-gradient(#ffea00 1px, transparent 1px)",
                    backgroundSize: "12px 12px",
                    maskImage: "linear-gradient(to top left, black, transparent)",
                    WebkitMaskImage:
                      "linear-gradient(to top left, black, transparent)",
                  }}
                />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}