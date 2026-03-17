import { useMemo, useState } from "react";

const TATAMI_DATA = [
  {
    id: 1,
    blue: {
      name: "А. САПАРОВ",
      club: "Алматы Дзюдо Клубы",
      score: "1",
      wazaari: 1,
      shido: 1,
    },
    white: {
      name: "Қ. НҰРҚАН",
      club: "Астана Дожо",
      score: "0",
      wazaari: 0,
      shido: 0,
    },
    time: "02:18",
    category: "Жасөспірімдер (U18) · -66кг · Жартылай финал",
    queue: [
      { k: "ҚАЗІР", v: "U18 · -66кг · 1/2 Финал", p: "Сапаров vs Нұрқан" },
      { k: "КЕЛЕСІ", v: "Әйелдер · -52кг · Финал", p: "Иванова vs Ли" },
      { k: "КЕЙІН", v: "Ерлер · -73кг · Қола жүлде", p: "Танака vs Силва" },
    ],
  },
  {
    id: 2,
    blue: {
      name: "Б. ЕРМЕК",
      club: "Қарағанды Тарлан",
      score: "0",
      wazaari: 0,
      shido: 2,
    },
    white: {
      name: "С. ДЖОНСОН",
      club: "USA Team",
      score: "1",
      wazaari: 1,
      shido: 1,
    },
    time: "03:45",
    category: "Ерлер · -81кг · Ширек финал",
    queue: [
      { k: "ҚАЗІР", v: "Ерлер · -81кг · 1/4 Финал", p: "Ермек vs Джонсон" },
      { k: "КЕЛЕСІ", v: "Ерлер · -81кг · 1/4 Финал", p: "Ким vs Мюллер" },
      { k: "КЕЙІН", v: "Әйелдер · -63кг · Жұбаныш", p: "Смит vs Төлеген" },
    ],
  },
  {
    id: 3,
    blue: {
      name: "М. ТАКИМОТО",
      club: "Japan Judo",
      score: "10",
      wazaari: 0,
      shido: 0,
    },
    white: {
      name: "Д. СМАҒҰЛОВ",
      club: "Қазақстан ҰҚ",
      score: "0",
      wazaari: 0,
      shido: 1,
    },
    time: "01:12",
    category: "Ерлер · -90кг · Финал",
    queue: [
      { k: "ҚАЗІР", v: "Ерлер · -90кг · Финал", p: "Такимото vs Смағұлов" },
      { k: "КЕЛЕСІ", v: "Марапаттау рәсімі", p: "-90кг Салмақ дәрежесі" },
      { k: "КЕЙІН", v: "-", p: "-" },
    ],
  },
];

export default function LiveShowcaseSection() {
  const [tab, setTab] = useState(1);
  const data = useMemo(
    () => TATAMI_DATA.find((x) => x.id === tab) || TATAMI_DATA[0],
    [tab]
  );

  return (
    <section className="relative overflow-hidden bg-bg px-6 py-24 text-textMain md:px-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
          maskImage: "radial-gradient(circle at 50% 50%, black, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 50%, black, transparent 80%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-4 flex items-center gap-3 text-[11px] uppercase tracking-[4px] text-[#4caf50]">
          <div className="flex h-3 items-end gap-[3px]">
            <span className="w-[3px] h-[40%] rounded bg-[#4caf50]" />
            <span className="w-[3px] h-[60%] rounded bg-[#4caf50]" />
            <span className="w-[3px] h-[80%] rounded bg-[#4caf50]" />
            <span className="w-[3px] h-full rounded bg-[#4caf50] animate-pulse" />
          </div>
          ТІКЕЛЕЙ ТЕЛЕМЕТРИЯ
        </div>

        <h2 className="mb-16 text-[clamp(38px,8vw,86px)] font-black uppercase leading-[0.95] tracking-[-0.04em] text-textMain">
          ТУРНИР АЛАҢЫ
          <span className="block text-transparent [-webkit-text-stroke:1.5px_#4caf50] [filter:drop-shadow(0_0_8px_rgba(76,175,80,0.8))_drop-shadow(0_0_20px_rgba(76,175,80,0.5))]">
            LIVE SHOWCASE
          </span>
        </h2>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_380px]">
          <div>
            <div className="mb-5 flex flex-wrap gap-3">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setTab(n)}
                  className={`flex flex-col rounded-xl border px-7 py-4 transition-all duration-300 ${
                    tab === n
                      ? "border-[#4caf50] bg-[rgba(76,175,80,0.1)] shadow-soft": "border-white/10 bg-white/5"
                    }`}
                  >
                    <span className="font-mono text-[10px] text-[#4caf50]">0{n}</span>
                    <span className="font-black tracking-[1px] text-textMain">ТАТАМИ</span>
                  </button>
                ))}
              </div>
  
              <div className="rounded-[30px] border border-border bg-card p-10 shadow-soft">
                <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
                  <div className="rounded-md bg-red-500 px-3 py-1 text-[10px] font-black uppercase text-white animate-pulse">
                    REC ● ТІКЕЛЕЙ
                  </div>
                  <div className="text-sm text-textMuted">{data.category}</div>
                </div>
  
                <div className="grid grid-cols-1 items-center gap-10 xl:grid-cols-[1fr_auto_1fr] xl:text-left text-center">
                  <div className="flex flex-col items-center gap-5 xl:flex-row xl:justify-end">
                    <div className="font-mono text-[82px] font-black leading-none text-[#0055ff]">
                      {data.blue.score}
                    </div>
                    <div>
                      <div className="text-[28px] font-black uppercase">{data.blue.name}</div>
                      <div className="text-sm text-textMuted">{data.blue.club}</div>
                      <div className="mt-2 flex justify-center gap-4 font-mono font-bold xl:justify-start">
                        <span>W: {data.blue.wazaari}</span>
                        <span className="text-orange-400">S: {data.blue.shido}</span>
                      </div>
                    </div>
                  </div>
  
                  <div className="min-w-[200px] text-center">
                    <div className="font-mono text-[56px] font-black tracking-[-2px]">
                      {data.time}
                    </div>
                    <div className="mt-2 text-[10px] font-extrabold uppercase tracking-[2px] text-[#4caf50]">
                      GOLDEN SCORE
                    </div>
                  </div>
  
                  <div className="flex flex-col items-center gap-5 xl:flex-row xl:justify-start">
                    <div className="xl:order-2 font-mono text-[82px] font-black leading-none text-textMain">
                      {data.white.score}
                    </div>
                    <div className="xl:order-1">
                      <div className="text-[28px] font-black uppercase">{data.white.name}</div>
                      <div className="text-sm text-textMuted">{data.white.club}</div>
                      <div className="mt-2 flex justify-center gap-4 font-mono font-bold xl:justify-start">
                        <span>W: {data.white.wazaari}</span>
                        <span className="text-orange-400">S: {data.white.shido}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
  
            <aside className="rounded-[30px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
              <h3 className="mb-6 text-sm font-black uppercase tracking-[2px]">
                КЕЗЕКТЕГІ БЕЛДЕСУЛЕР
              </h3>
  
              <div className="space-y-2">
                {data.queue.map((q, i) => (
                  <div
                    key={i}
                    className={`flex gap-5 border-b border-white/10 p-5 transition-all ${
                      q.k === "ҚАЗІР"
                        ? "rounded-2xl border-b-transparent bg-[rgba(76,175,80,0.08)]"
                        : ""
                    }`}
                  >
                    <div className="font-mono text-[11px] font-black text-[#4caf50]">
                      {q.k}
                    </div>
                    <div>
                      <div className="text-[13px] font-extrabold">{q.v}</div>
                      <div className="mt-1 text-[15px] font-semibold text-textMuted">
                        {q.p}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
          </div>
    </section>
  );
}