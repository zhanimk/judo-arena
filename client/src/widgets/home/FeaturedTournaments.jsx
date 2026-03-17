import { CalendarDays, MapPin } from "lucide-react";

const tournaments = [
  {
    id: 1,
    tag: "International",
    title: "Grand Slam Tokyo 2024",
    date: "December 12 - 14, 2024",
    location: "Tokyo Metropolitan Gym",
    button: "Register Entry",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCdz9WasgmYgm9PfHgrUoVgp7XYHmwZT4A0TDGuJIdNaf6jXeoVYpJ0BmZLUbC9Qk8qFsv1TXYme7QCt4mr6vRb-6c_IgISHB8RQIUgDiWUqIQrMRgRmKDngS-uc4Ke3GuE9skbAkcD4ttRILrN5759G8tVz1zDDKbf3hf_h7ZN1Bh8wFbWcxxAWoWfRNhVS-5pwt-5sX_A165LLGEE4Y0_D4l_nuw65OlR2SX8WRoSrAMnc_hlIpouEyCLP1Uw12B_wnDlYEqQvgw",
  },
  {
    id: 2,
    tag: "Regional",
    title: "European Open Madrid",
    date: "January 05 - 07, 2025",
    location: "Arena de Madrid, Spain",
    button: "Event Details",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDGedBA6OD4ysX41q5oJPjWK0F12kA9EV-MLunm-6Qu8837Qz6hAihAglICTGY6ZirOOTgdEkqOTkVgQ5_-AEBZ_QQ7a8tiigJhub1dgrjDiCS-AwmUSbSYzKy18200T86XH_nE2hPp1DSZSbG_fZ48T-Db7LodMl-KnsWuBECmPdLf-pnDtmYS-I6C5mJUL9mPc5n9SKGORR2g2Cm7DjgUv7Y2dKJVz3ZwbB7AGBj8B9Ou2HGWQjaBY6N9F6yjn6YdJjX7qEu3oPk",
  },
  {
    id: 3,
    tag: "National",
    title: "Pan-American Cup",
    date: "February 20 - 22, 2025",
    location: "Rio de Janeiro, Brazil",
    button: "Event Details",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCNwNwTGpApc4dnFDElo8HpxY5aX4q9eO89bdPu48bjojFbkeU61T-Ldf6BHUGPEO5-4xa1eumvL6a5dZGFel3mHoKQY5nnpuuvF_z6Wfm1ltxBt-83YRiEAfhQDhXkdUNj1N5LSKpkMsulSqeCLRNQ5g1jOugqdtsLlTMa09i19J2y7lDy8aWo3_Tr13ykFl-XZs5MhHIgtQ_T6X3M_pGxke9xSLcwaAxP1IhvYp067c67PYDOzwVQeu_6ZXgUsNJr2YAjafcqffQ",
  },
];

export default function FeaturedTournaments() {
  return (
    <section
      id="tournaments"
      className="mx-auto max-w-7xl px-4 py-32 sm:px-6 lg:px-8"
    >
      <div className="mb-16 flex items-end justify-between gap-8">
        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.3em] text-primary">
            Premium Events
          </span>

          <h2 className="text-4xl font-extrabold uppercase tracking-tighter text-white">
            Featured Tournaments
          </h2>

          <div className="mt-4 h-1 w-24 bg-primary" />
        </div>

        <a
          href="#"
          className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-primary transition-colors hover:text-white"
        >
          View Schedule
          <span>→</span>
        </a>
      </div>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((item) => (
          <article
            key={item.id}
            className="group overflow-hidden rounded-custom border border-darkBorder bg-darkSurface transition-all duration-500 hover:border-primary/50 hover:-translate-y-1"
          >
            <div className="relative h-56 overflow-hidden">
              <img
                src={item.image}
                alt={item.title}
                className="h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-110"
              />
              <div
                className={`absolute left-4 top-4 rounded-sm px-2 py-1 text-[9px] font-black uppercase shadow-lg ${
                  item.tag === "International"
                    ? "bg-gold-gradient text-darkBg"
                    : "bg-slate-800 text-white"
                }`}
              >
                {item.tag}
              </div>
            </div>

            <div className="p-8">
              <h3 className="mb-6 text-2xl font-bold leading-tight text-white transition-colors group-hover:text-primary">
                {item.title}
              </h3>

              <div className="mb-8 space-y-4">
                <div className="flex items-center text-xs font-medium uppercase tracking-wider text-slate-400">
                  <CalendarDays className="mr-3 h-4 w-4 text-primary" />
                  {item.date}
                </div>
                <div className="flex items-center text-xs font-medium uppercase tracking-wider text-slate-400">
                  <MapPin className="mr-3 h-4 w-4 text-primary" />
                  {item.location}
                </div>
              </div>

              <button className="w-full rounded-custom border border-darkBorder bg-darkBg py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-darkBg">
                {item.button}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}