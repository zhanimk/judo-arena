import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getTournaments } from "@/shared/api/tournaments.api";

const roleCards = [
  {
    icon: "sports_martial_arts",
    title: "Athletes",
    items: [
      "Apply to tournaments online",
      "Track participation status",
      "View brackets and match progress",
    ],
  },
  {
    icon: "strategy",
    title: "Coaches",
    items: [
      "Manage club athletes",
      "Coordinate team applications",
      "Monitor competition flow",
    ],
  },
  {
    icon: "gavel",
    title: "Judges",
    items: [
      "Follow assigned competition flow",
      "Work inside structured match logic",
      "Support consistent officiating",
    ],
  },
  {
    icon: "admin_panel_settings",
    title: "Organizers",
    items: [
      "Create and publish tournaments",
      "Review and approve applications",
      "Generate brackets and manage statuses",
    ],
  },
];

const featureCards = [
  {
    icon: "grid_view",
    title: "Structured brackets",
    text: "Generate brackets and follow tournament flow through a more organized digital structure.",
  },
  {
    icon: "tv",
    title: "Match visibility",
    text: "Keep operations transparent with match structure, statuses, and cleaner tournament coordination.",
  },
  {
    icon: "history_edu",
    title: "Audit trail",
    text: "Track operational actions with better control across tournament lifecycle events.",
  },
  {
    icon: "account_balance",
    title: "Club workflows",
    text: "Support club membership, join requests, and athlete coordination in one system.",
  },
  {
    icon: "mobile_friendly",
    title: "Modern access",
    text: "Use a responsive product experience designed for organizers, coaches, and athletes.",
  },
  {
    icon: "language",
    title: "Scalable platform",
    text: "Built with clear architecture for future multilingual growth and broader federation use.",
  },
];

const faqItems = [
  {
    q: "Can athletes apply to tournaments online?",
    a: "Yes. Judo-Arena supports structured applications and participation workflows for digital tournament registration.",
  },
  {
    q: "Can organizers manage tournament statuses?",
    a: "Yes. Organizers can control the lifecycle of tournaments, including publication, archive, and operational updates.",
  },
  {
    q: "When are brackets generated?",
    a: "Brackets are generated after participant review and approval, once the tournament data is ready for competition flow.",
  },
];

function normalizeTournament(item) {
  return {
    id: item?._id || item?.id,
    title: item?.title || item?.name || "Untitled tournament",
    date: item?.startDate || item?.date || null,
    location:
      item?.location || item?.city || item?.venue || "Location to be announced",
    status: item?.status || "published",
  };
}

function formatDate(date) {
  if (!date) return "Date to be announced";

  try {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Date to be announced";
  }
}

export default function HomePage() {
  const [tournaments, setTournaments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadTournaments() {
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      try {
        setIsLoading(true);
        const response = await getTournaments();
        const payload = response?.data ?? response;

        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.tournaments)
          ? payload.tournaments
          : [];

        if (!mounted) return;
        setTournaments(list.slice(0, 3).map(normalizeTournament));
      } catch {
        if (!mounted) return;
        setTournaments([]);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadTournaments();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background-light text-slate-900 antialiased dark:bg-background-dark dark:text-slate-100 ornament-bg">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-background-light/80 backdrop-blur-md dark:border-slate-800 dark:bg-background-dark/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="text-primary">
                <span className="material-symbols-outlined text-4xl">
                  sports_martial_arts
                </span>
              </div>
              <span className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">
                Judo-Arena
              </span>
            </Link>

            <nav className="hidden space-x-10 md:flex">
              <a
                className="text-sm font-semibold text-slate-600 transition-colors hover:text-primary dark:text-slate-300"
                href="#workflow"
              >
                Workflow
              </a>
              <a
                className="text-sm font-semibold text-slate-600 transition-colors hover:text-primary dark:text-slate-300"
                href="#roles"
              >
                Roles
              </a>
              <a
                className="text-sm font-semibold text-slate-600 transition-colors hover:text-primary dark:text-slate-300"
                href="#features"
              >
                Features
              </a>
              <a
                className="text-sm font-semibold text-slate-600 transition-colors hover:text-primary dark:text-slate-300"
                href="#faq"
              >
                FAQ
              </a>
            </nav>

            <div className="flex items-center gap-6">
              <Link
                to="/login"
                className="text-sm font-bold text-slate-700 transition-colors hover:text-primary dark:text-slate-200"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden pb-20 pt-24 lg:pb-32 lg:pt-36">
          <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-full w-full -translate-x-1/2 opacity-20">
            <div className="absolute left-1/2 top-0 h-[700px] w-[1200px] -translate-x-1/2 rounded-full bg-primary/20 blur-[150px]" />
          </div>

          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8 animate-fade-in-up">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Professional sports-tech standard
              </span>
            </div>

            <h1 className="mb-8 text-5xl font-black leading-[1.1] tracking-tight text-slate-900 dark:text-white lg:text-7xl">
              Professional platform for <br className="hidden lg:block" />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                judo tournament operations.
              </span>
            </h1>

            <p className="mx-auto mb-12 max-w-3xl text-xl font-light leading-relaxed text-slate-600 dark:text-slate-400 lg:text-2xl">
              Judo-Arena unites tournaments, clubs, applications, brackets,
              matches, and operational workflows in one modern system for
              organizers, judges, coaches, and athletes.
            </p>

            <div className="flex flex-col justify-center gap-5 sm:flex-row">
              <Link
                to="/register"
                className="rounded-xl bg-primary px-10 py-5 text-lg font-black text-white shadow-2xl shadow-primary/30 transition-transform duration-300 hover:scale-[1.05]"
              >
                Get started
              </Link>
              <a
                href="#workflow"
                className="rounded-xl border border-slate-200 bg-white px-10 py-5 text-lg font-black text-slate-900 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                Explore platform
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-32 animate-fade-in-up reveal-delay-1">
          <div className="group relative">
            <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-r from-primary to-accent opacity-10 blur transition duration-1000 group-hover:opacity-30" />
            <div className="glass-panel relative aspect-[16/10] overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-full w-full flex-col">
                <div className="flex h-14 items-center gap-4 border-b border-slate-200 bg-slate-50/50 px-6 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="flex gap-2">
                    <div className="h-3.5 w-3.5 rounded-full bg-red-500/80" />
                    <div className="h-3.5 w-3.5 rounded-full bg-accent/80" />
                    <div className="h-3.5 w-3.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="text-[11px] font-mono uppercase tracking-widest text-slate-500">
                    judo-arena / tournament operations workspace
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-12 gap-8 p-8">
                  <div className="col-span-8 space-y-8">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
                      <div className="mb-6 flex justify-between">
                        <div>
                          <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                            Tournament workflow
                          </div>
                          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                            Almaty Open Championship
                          </div>
                        </div>
                        <div className="rounded-lg bg-primary/20 px-3 py-2 text-xs font-bold text-primary">
                          Published
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                          Applications received and under review
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                          Bracket generation and match structure ready
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
                      <div className="mb-6 text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                        Competition structure
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
                          <div className="text-sm font-bold text-slate-500">
                            Brackets
                          </div>
                          <div className="mt-3 text-3xl font-black text-slate-900 dark:text-white">
                            Auto-ready
                          </div>
                        </div>
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
                          <div className="text-sm font-bold text-slate-500">
                            Matches
                          </div>
                          <div className="mt-3 text-3xl font-black text-slate-900 dark:text-white">
                            Live flow
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-4 h-full rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="mb-6 text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                      Platform modules
                    </div>
                    <div className="space-y-5">
                      <div className="rounded-xl bg-primary/80 px-4 py-3 font-bold text-white">
                        Tournament management
                      </div>
                      <div className="rounded-xl bg-slate-100 px-4 py-3 font-bold dark:bg-slate-900">
                        Applications review
                      </div>
                      <div className="rounded-xl bg-slate-100 px-4 py-3 font-bold dark:bg-slate-900">
                        Clubs and members
                      </div>
                      <div className="rounded-xl bg-slate-100 px-4 py-3 font-bold dark:bg-slate-900">
                        Brackets and matches
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50 py-32 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-16 md:grid-cols-3">
              <div className="group text-center hover-lift">
                <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-xl shadow-primary/5 transition-all duration-500 group-hover:bg-primary group-hover:text-white">
                  <span className="material-symbols-outlined text-4xl">
                    cloud_done
                  </span>
                </div>
                <h3 className="mb-4 text-2xl font-black">Operational clarity</h3>
                <p className="text-lg font-light leading-relaxed text-slate-600 dark:text-slate-400">
                  Replace fragmented processes with one system for tournament,
                  application, and bracket operations.
                </p>
              </div>

              <div className="group text-center hover-lift">
                <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10 text-accent shadow-xl shadow-accent/5 transition-all duration-500 group-hover:bg-accent group-hover:text-white">
                  <span className="material-symbols-outlined text-4xl">
                    timer
                  </span>
                </div>
                <h3 className="mb-4 text-2xl font-black">Structured flow</h3>
                <p className="text-lg font-light leading-relaxed text-slate-600 dark:text-slate-400">
                  Keep applications, approvals, brackets, and matches aligned in
                  one consistent operational workflow.
                </p>
              </div>

              <div className="group text-center hover-lift">
                <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-xl shadow-primary/5 transition-all duration-500 group-hover:bg-primary group-hover:text-white">
                  <span className="material-symbols-outlined text-4xl">
                    verified_user
                  </span>
                </div>
                <h3 className="mb-4 text-2xl font-black">Product foundation</h3>
                <p className="text-lg font-light leading-relaxed text-slate-600 dark:text-slate-400">
                  Built on a real backend foundation with auth, clubs,
                  tournaments, applications, and bracket logic.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="roles" className="mx-auto max-w-7xl px-4 py-32 sm:px-6 lg:px-8">
          <div className="mb-20 text-center animate-fade-in-up">
            <h2 className="mb-6 text-4xl font-black lg:text-5xl">
              Built for the tournament ecosystem
            </h2>
            <p className="text-xl font-light text-slate-600 dark:text-slate-400">
              Role-based value for every participant inside Judo-Arena.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {roleCards.map((card) => (
              <div
                key={card.title}
                className="group rounded-3xl border border-slate-200 bg-white p-10 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-2xl dark:border-slate-700 dark:bg-slate-800/40 hover-lift"
              >
                <span className="material-symbols-outlined mb-6 text-5xl text-primary opacity-80 transition-transform group-hover:scale-110 group-hover:opacity-100">
                  {card.icon}
                </span>
                <h4 className="mb-4 text-2xl font-black">{card.title}</h4>
                <ul className="space-y-3 text-base font-medium text-slate-600 dark:text-slate-400">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-sm text-accent">
                        verified
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section
          id="workflow"
          className="relative overflow-hidden py-32"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative flex flex-col items-center gap-16 overflow-hidden rounded-[3rem] border border-white/10 bg-gradient-to-br from-primary to-blue-900 p-10 shadow-3xl shadow-primary/20 lg:flex-row lg:p-20">
              <div className="pointer-events-none absolute bottom-0 right-0 h-full w-1/2 translate-x-1/2 translate-y-1/2 -rotate-45 bg-accent/20 blur-[120px]" />

              <div className="z-10 lg:w-1/2 animate-fade-in-up">
                <h2 className="mb-8 text-4xl font-black leading-[1.1] text-white lg:text-6xl">
                  From registration <br /> to final bracket.
                </h2>
                <p className="mb-10 text-xl font-light leading-relaxed text-white/80">
                  Publish tournaments, receive applications, review
                  participants, generate brackets, and manage match flow inside
                  one connected platform experience.
                </p>

                <div className="flex gap-8">
                  {[
                    ["1", "Apply"],
                    ["2", "Approve"],
                    ["3", "Bracket"],
                  ].map(([num, label], index) => (
                    <div key={label} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div
                          className={`mb-3 flex h-16 w-16 items-center justify-center rounded-full border-2 font-black text-xl ${
                            index === 0
                              ? "border-accent/50 text-accent"
                              : "border-white/30 text-white"
                          }`}
                        >
                          {num}
                        </div>
                        <span
                          className={`text-xs font-extrabold uppercase tracking-[0.2em] ${
                            index === 0 ? "text-accent" : "text-white"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                      {index < 2 && (
                        <div className="mt-8 h-px w-16 bg-white/20" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="z-10 w-full lg:w-1/2 animate-fade-in-up reveal-delay-2">
                <div className="space-y-8 rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur-2xl">
                  {[
                    "Application and approval workflow",
                    "Bracket generation after review",
                    "Secure tournament data handling",
                  ].map((item, index) => (
                    <div
                      key={item}
                      className="group flex cursor-default items-center gap-6 text-white"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 transition-colors group-hover:bg-accent/20">
                        <span className="material-symbols-outlined text-accent">
                          {index === 0
                            ? "sync"
                            : index === 1
                            ? "analytics"
                            : "security"}
                        </span>
                      </div>
                      <span className="text-lg font-bold">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 py-24 dark:border-slate-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-12 lg:grid-cols-4">
              <div className="text-center">
                <div className="mb-3 text-5xl font-black text-primary lg:text-6xl">
                  Auth
                </div>
                <div className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
                  Secure Access
                </div>
              </div>
              <div className="text-center">
                <div className="mb-3 text-5xl font-black text-accent lg:text-6xl">
                  Clubs
                </div>
                <div className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
                  Member Workflows
                </div>
              </div>
              <div className="text-center">
                <div className="mb-3 text-5xl font-black text-primary lg:text-6xl">
                  Brackets
                </div>
                <div className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
                  Match Structure
                </div>
              </div>
              <div className="text-center">
                <div className="mb-3 text-5xl font-black text-accent lg:text-6xl">
                  Audit
                </div>
                <div className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
                  Traceability
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="mx-auto max-w-7xl px-4 py-32 sm:px-6 lg:px-8"
        >
          <div className="mb-20 text-center animate-fade-in-up">
            <h2 className="mb-6 text-4xl font-black lg:text-5xl">
              Core platform capabilities
            </h2>
            <p className="text-xl font-light text-slate-600 dark:text-slate-400">
              Product features aligned with the actual Judo-Arena system.
            </p>
          </div>

          <div className="grid gap-10 md:grid-cols-3">
            {featureCards.map((card, index) => (
              <div
                key={card.title}
                className="hover-lift rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900/40"
              >
                <span
                  className={`material-symbols-outlined mb-5 text-4xl ${
                    index % 2 === 0 ? "text-primary" : "text-accent"
                  }`}
                >
                  {card.icon}
                </span>
                <h5 className="mb-3 text-xl font-black">{card.title}</h5>
                <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400">
                  {card.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white py-24 dark:border-slate-900 dark:bg-slate-950 ornament-bg">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-16 text-center">
              <h2 className="mb-6 text-4xl font-black lg:text-5xl">
                Tournament access
              </h2>
              <p className="text-xl font-light text-slate-600 dark:text-slate-400">
                Real tournaments can be shown here after authentication with the
                current backend contract.
              </p>
            </div>

            {!hasToken ? ( 
              <div className="mx-auto max-w-3xl rounded-[2.5rem] border border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-800 dark:bg-slate-900/80">
                <h3 className="mb-4 text-2xl font-black">
                  Sign in to view real tournaments
                </h3>
                <p className="mb-8 text-base text-slate-500 dark:text-slate-400">
                  Your current `/tournaments` endpoint is protected by auth, so
                  real data becomes available after login.
                </p>
                <div className="flex justify-center gap-4">
                  <Link
                    to="/login"
                    className="rounded-2xl border-2 border-primary px-6 py-4 font-black text-primary transition-all duration-300 hover:bg-primary hover:text-white"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="rounded-2xl bg-primary px-6 py-4 font-black text-white shadow-2xl shadow-primary/30 transition-transform hover:scale-[1.02]"
                  >
                    Create account
                  </Link>
                </div>
              </div>
            ) : isLoading ? (
              <div className="grid gap-8 md:grid-cols-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="rounded-[2rem] border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-900/80"
                  >
                    <div className="mb-4 h-5 w-28 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="mb-3 h-8 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
                  </div>
                ))}
              </div>
            ) : tournaments.length > 0 ? (
              <div className="grid gap-8 md:grid-cols-3">
                {tournaments.map((tournament) => (
                  <div
                    key={tournament.id}
                    className="rounded-[2rem] border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-900/80"
                  >
                    <div className="mb-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-primary">
                      {tournament.status}
                    </div>
                    <h3 className="mb-3 text-2xl font-black">
                      {tournament.title}
                    </h3>
                    <p className="mb-2 text-sm font-semibold text-slate-500">
                      {formatDate(tournament.date)}
                    </p>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {tournament.location}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mx-auto max-w-3xl rounded-[2.5rem] border border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-800 dark:bg-slate-900/80">
                <h3 className="mb-4 text-2xl font-black">
                  No tournaments available yet
                </h3>
                <p className="text-base text-slate-500 dark:text-slate-400">
                  Once tournaments are available from the backend, they will be
                  displayed here.
                </p>
              </div>
            )}
          </div>
        </section>

        <section id="faq" className="bg-slate-50 py-32 dark:bg-slate-900/30">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-16 text-center text-4xl font-black">
              Frequently asked questions
            </h2>
            <div className="space-y-6">
              {faqItems.map((item) => (
                <div
                  key={item.q}
                  className="group cursor-pointer rounded-3xl border border-slate-200 bg-white p-8 transition-colors hover:border-primary/50 dark:border-slate-700 dark:bg-slate-800/40"
                >
                  <h4 className="mb-4 flex items-center justify-between text-xl font-black">
                    {item.q}
                    <span className="material-symbols-outlined text-primary transition-transform group-hover:rotate-180">
                      expand_more
                    </span>
                  </h4>
                  <p className="text-lg font-light leading-relaxed text-slate-600 dark:text-slate-400">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white pb-10 pt-20 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-20 grid gap-16 md:grid-cols-4">
            <div className="col-span-2 md:col-span-1">
              <div className="mb-8 flex items-center gap-3">
                <div className="text-primary">
                  <span className="material-symbols-outlined text-4xl">
                    sports_martial_arts
                  </span>
                </div>
                <span className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">
                  Judo-Arena
                </span>
              </div>
              <p className="mb-8 text-base font-medium leading-relaxed text-slate-500">
                Professional tournament management platform for modern judo
                operations.
              </p>
            </div>

            <div>
              <h6 className="mb-8 text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
                Product
              </h6>
              <ul className="space-y-4 text-sm font-semibold text-slate-500">
                <li>
                  <a className="transition-colors hover:text-primary" href="#features">
                    Features
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-primary" href="#workflow">
                    Workflow
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-primary" href="#roles">
                    Roles
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h6 className="mb-8 text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
                Access
              </h6>
              <ul className="space-y-4 text-sm font-semibold text-slate-500">
                <li>
                  <Link className="transition-colors hover:text-primary" to="/login">
                    Login
                  </Link>
                </li>
                <li>
                  <Link
                    className="transition-colors hover:text-primary"
                    to="/register"
                  >
                    Register
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h6 className="mb-8 text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
                Platform note
              </h6>
              <p className="text-sm font-medium text-slate-500">
                Public tournament output can be expanded further after adding a
                public tournaments endpoint on the backend.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-10 text-center text-xs font-bold tracking-[0.1em] text-slate-500 dark:border-slate-800">
            © 2026 Judo-Arena. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}