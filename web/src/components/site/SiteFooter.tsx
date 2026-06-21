import { Link } from "@tanstack/react-router";
const emblem = "/jcl-logo.jpg";
import { ArrowUpRight, Instagram, Mail, MapPin, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer
      className="relative overflow-hidden border-t border-gold/15"
      style={{
        background: "linear-gradient(180deg,hsl(var(--background)) 0%,hsl(var(--navy-deep)) 100%)",
      }}
    >
      {/* grid bg */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(200,146,42,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(200,146,42,0.07) 1px,transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />
      {/* gold glow top-left */}
      <div
        className="absolute -top-24 -left-24 w-80 h-80 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle,rgba(200,146,42,0.10) 0%,transparent 65%)",
          filter: "blur(40px)",
        }}
      />
      {/* top gold line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

      <div className="container relative mx-auto px-4 pt-10 pb-8 sm:pt-12 sm:pb-10">
        {/* ── Live-arena banner ── */}
        <div
          className="mb-10 flex flex-col gap-4 overflow-hidden rounded-2xl sm:flex-row sm:items-center sm:justify-between"
          style={{
            background:
              "linear-gradient(135deg,rgba(200,146,42,0.10) 0%,rgba(200,146,42,0.04) 100%)",
            border: "1px solid rgba(200,146,42,0.22)",
            padding: "1rem 1.25rem",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-gold/35">
              <img src={emblem} alt="JCL" className="h-full w-full object-cover" />
            </span>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-gold">
                live arena
              </div>
              <div className="font-display text-base font-bold">{t("footer.tagline")}</div>
            </div>
          </div>
          <Link
            to="/tournaments"
            className="inline-flex w-fit items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-gold transition-all hover:brightness-110"
            style={{
              background: "rgba(200,146,42,0.12)",
              border: "1px solid rgba(200,146,42,0.30)",
            }}
          >
            {t("footer.tournaments")} <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {/* ── Main grid ── */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1fr]">
          {/* Brand */}
          <div>
            <Link to="/" className="group mb-4 flex items-center gap-3">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-gold/30 transition-transform group-hover:scale-105">
                <img src={emblem} alt="JCL" className="h-full w-full object-cover" />
              </span>
              <div>
                <div className="font-display text-base font-bold leading-tight">
                  JUDO·CHILD·LEAGUE
                </div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  digital tournament arena
                </div>
              </div>
            </Link>
            <p className="max-w-[260px] text-sm leading-relaxed text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-gold">
              {t("footer.platform")}
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link to="/tournaments" className="transition-colors hover:text-gold">
                  {t("footer.tournaments")}
                </Link>
              </li>
              <li>
                <Link to="/rankings" className="transition-colors hover:text-gold">
                  {t("footer.rankings")}
                </Link>
              </li>
              <li>
                <Link to="/protocol" className="transition-colors hover:text-gold">
                  {t("footer.protocol")}
                </Link>
              </li>
              <li>
                <Link to="/about" className="transition-colors hover:text-gold">
                  {t("footer.about")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Auth */}
          <div>
            <h4 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-gold">
              {t("nav.login")}
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link to="/login" className="transition-colors hover:text-gold">
                  {t("roles.coach")}
                </Link>
              </li>
              <li>
                <Link to="/login" className="transition-colors hover:text-gold">
                  {t("roles.athlete")}
                </Link>
              </li>
              <li>
                <Link to="/login" className="transition-colors hover:text-gold">
                  {t("roles.admin")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-gold">
              {t("footer.contact")}
            </h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              <a
                href="mailto:support@ajl.kz"
                className="flex items-center gap-2 transition-colors hover:text-gold"
              >
                <Mail className="h-4 w-4 text-gold shrink-0" /> support@ajl.kz
              </a>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gold shrink-0" /> Astana, Kazakhstan
              </div>
              <a
                href="https://www.instagram.com/judochildleague"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-gold transition-all hover:brightness-110"
                style={{
                  background: "rgba(200,146,42,0.10)",
                  border: "1px solid rgba(200,146,42,0.25)",
                }}
              >
                <Instagram className="h-4 w-4" /> Instagram <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div
          className="mt-10 flex flex-col gap-3 border-t pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "rgba(200,146,42,0.12)" }}
        >
          <div>© 2026 Judo Child League. {t("footer.rights")}</div>
          <div className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-gold" />
            {t("footer.built_with")}
          </div>
        </div>
      </div>
    </footer>
  );
}
