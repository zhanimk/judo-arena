import { Link } from "react-router-dom"

export default function HomePage() {
  return (
    <div className="bg-[#060B18] text-white min-h-screen">

      {/* HERO */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">

        {/* Background image */}
        <img
          src="/images/judo-hero.jpg"
          alt="Judo"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#060B18]/70 to-[#060B18]"></div>

        {/* Content */}
        <div className="relative z-10 text-center max-w-4xl px-6">

          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            The Modern Platform
            <span className="block text-[#D4AF37]">
              For Judo Tournaments
            </span>
          </h1>

          <p className="mt-6 text-lg text-gray-300">
            Manage tournaments, clubs and athletes in one powerful system.
            Built for the modern judo community.
          </p>

          <div className="mt-10 flex justify-center gap-6">

            <Link
              to="/tournaments"
              className="px-8 py-4 rounded-xl bg-[#D4AF37] text-black font-semibold hover:scale-105 transition"
            >
              View Tournaments
            </Link>

            <Link
              to="/register"
              className="px-8 py-4 rounded-xl border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black hover:scale-105 transition"
            >
              Join Platform
            </Link>

          </div>

        </div>
      </section>

    </div>
  )
}