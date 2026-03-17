import { Zap, Facebook, Twitter } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-darkBorder bg-darkBg py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-16 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-custom bg-gold-gradient">
                <Zap className="h-4 w-4 text-darkBg" />
              </div>

              <span className="text-lg font-black uppercase tracking-tighter text-white">
                Judo<span className="text-primary">Arena</span>
              </span>
            </div>

            <p className="mb-8 text-sm font-light leading-relaxed text-slate-500">
              The global authority for elite judo tournament management, world
              rankings, and digital dojo networking.
            </p>

            <div className="flex gap-4">
              <a
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-custom border border-darkBorder transition-all hover:bg-primary hover:text-darkBg"
              >
                <Facebook className="h-5 w-5" />
              </a>

              <a
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-custom border border-darkBorder transition-all hover:bg-primary hover:text-darkBg"
              >
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="mb-8 text-xs font-black uppercase tracking-[0.3em] text-white">
              Platform
            </h4>
            <ul className="space-y-4 text-xs font-medium uppercase tracking-widest text-slate-500">
              <li><a href="#" className="transition-colors hover:text-primary">Live Scoreboard</a></li>
              <li><a href="#" className="transition-colors hover:text-primary">World Ranking</a></li>
              <li><a href="#" className="transition-colors hover:text-primary">Upcoming Events</a></li>
              <li><a href="#" className="transition-colors hover:text-primary">Global News</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-8 text-xs font-black uppercase tracking-[0.3em] text-white">
              Organization
            </h4>
            <ul className="space-y-4 text-xs font-medium uppercase tracking-widest text-slate-500">
              <li><a href="#" className="transition-colors hover:text-primary">Register Club</a></li>
              <li><a href="#" className="transition-colors hover:text-primary">Host Event</a></li>
              <li><a href="#" className="transition-colors hover:text-primary">Sponsorship</a></li>
              <li><a href="#" className="transition-colors hover:text-primary">Academy Portal</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-8 text-xs font-black uppercase tracking-[0.3em] text-white">
              Bulletin
            </h4>
            <p className="mb-6 text-xs font-light text-slate-500">
              Subscribe for exclusive insights and premium event notifications.
            </p>

            <div className="flex">
              <input
                type="email"
                placeholder="EMAIL ADDRESS"
                className="w-full rounded-l-custom border border-darkBorder bg-darkSurface text-xs text-white placeholder:text-slate-600 focus:border-primary focus:ring-primary"
              />
              <button className="rounded-r-custom bg-gold-gradient px-5 text-darkBg transition-opacity hover:opacity-90">
                →
              </button>
            </div>
          </div>
        </div>

        <div className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-darkBorder pt-10 md:flex-row">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
            © 2024 Judo Arena International. All rights reserved.
          </p>

          <div className="flex gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
            <a href="#" className="transition-colors hover:text-primary">Privacy</a>
            <a href="#" className="transition-colors hover:text-primary">Terms</a>
            <a href="#" className="transition-colors hover:text-primary">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}