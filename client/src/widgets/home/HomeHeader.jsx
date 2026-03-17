import { Link } from "react-router-dom";

export default function HomeHeader() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 pt-5 md:px-6">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between rounded-full border border-white/10 bg-[rgba(8,12,24,0.82)] px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl md:px-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 shadow-[0_0_30px_rgba(0,119,255,0.16)]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1E6FFF] shadow-[0_0_14px_#1E6FFF]" />
          </div>

          <span className="text-[22px] font-black uppercase tracking-tight text-white md:text-[26px]">
            JUDO<span className="text-[#247BFF]">ARENA</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-10 lg:flex">
          <a href="#about" className="text-lg text-white/65 transition hover:text-white">
            Платформа
          </a>
          <a href="#skills" className="text-lg text-white/65 transition hover:text-white">
            Техникалар
          </a>
          <a href="#events" className="text-lg text-white/65 transition hover:text-white">
            Жарыстар
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#1B2333] transition hover:scale-[1.03] md:px-5 md:py-3 md:text-base"
          >
            Кіру
          </Link>
          <Link
            to="/register"
            className="rounded-full bg-[linear-gradient(135deg,#2D7DFF,#5D8CFF)] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(45,125,255,0.30)] transition hover:scale-[1.03] md:px-6 md:py-3 md:text-base"
          >
            Тіркелу
          </Link>
        </div>
      </div>
    </header>
  );
}