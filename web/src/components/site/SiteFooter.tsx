import { Link } from "@tanstack/react-router";
import emblem from "@/assets/jcl-logo.jpeg";
import teamLineup from "@/assets/team-lineup.jpg";
import { ArrowUpRight, Instagram, Mail, MapPin, Radio, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="relative mt-0 overflow-hidden border-t border-gold/20 bg-navy-deep">
      <img src={teamLineup} alt="" className="absolute inset-0 h-full w-full object-cover opacity-12" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/70" />
      <div className="absolute inset-0 grid-bg opacity-20" />

      <div className="container relative mx-auto px-4 py-10 sm:py-14">
        <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-gold/20 bg-card/45 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-gold shadow-gold">
              <Radio className="h-5 w-5 text-gold-foreground" />
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-gold">live arena</div>
              <div className="font-display text-lg font-semibold">{t("footer.tagline")}</div>
            </div>
          </div>
          <Link to="/tournaments" className="inline-flex w-fit items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:border-gold/60">
            {t("footer.tournaments")} <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr_0.75fr_1fr]">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="relative inline-flex h-12 w-12 items-center justify-center">
                <span className="absolute inset-0 rounded-xl conic-gold opacity-60 blur-[6px] animate-spin-conic" />
                <span className="absolute inset-[2px] rounded-[10px] bg-background" />
                <img src={emblem} alt="Judo Child League" className="relative h-10 w-10 rounded-lg object-cover" />
              </span>
              <div>
                <div className="font-display text-xl font-bold">JUDO·CHILD·LEAGUE</div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">digital tournament arena</div>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-gold">{t("footer.platform")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/tournaments" className="hover:text-gold">{t("footer.tournaments")}</Link></li>
              <li><Link to="/rankings" className="hover:text-gold">{t("footer.rankings")}</Link></li>
              <li><Link to="/protocol" className="hover:text-gold">{t("footer.protocol")}</Link></li>
              <li><Link to="/about" className="hover:text-gold">{t("footer.about")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-gold">{t("nav.login")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/login" className="hover:text-gold">{t("roles.coach")}</Link></li>
              <li><Link to="/login" className="hover:text-gold">{t("roles.athlete")}</Link></li>
              <li><Link to="/login" className="hover:text-gold">{t("roles.admin")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-gold">{t("footer.contact")}</h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              <a href="mailto:support@ajl.kz" className="flex items-center gap-2 hover:text-gold">
                <Mail className="h-4 w-4 text-gold" /> support@ajl.kz
              </a>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gold" /> Astana, Kazakhstan
              </div>
              <a
                href="https://www.instagram.com/judochildleague"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-gold hover:border-gold/60"
              >
                <Instagram className="h-4 w-4" />
                Instagram
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border/40 pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
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
