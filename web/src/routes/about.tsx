import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Code2, Database, Zap, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Платформа туралы — Judo-Arena" },
      { name: "description", content: "Judo-Arena жобасы туралы: технологиялар, архитектура және стандарттар." },
    ],
  }),
  errorComponent: RouteErrorUI,
  component: About,
});

function About() {
  const { t } = useTranslation();

  const blocks = [
    { icon: Zap, tKey: "about.tech_realtime_title", dKey: "about.tech_realtime_desc" },
    { icon: Database, tKey: "about.tech_db_title", dKey: "about.tech_db_desc" },
    { icon: ShieldCheck, tKey: "about.tech_security_title", dKey: "about.tech_security_desc" },
    { icon: Code2, tKey: "about.tech_stack_title", dKey: "about.tech_stack_desc" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <section className="container mx-auto px-4 pt-20 pb-16 max-w-4xl">
        <div className="text-xs uppercase tracking-[0.3em] text-gold mb-3">{t("about.title")}</div>
        <h1 className="font-display text-5xl md:text-6xl font-bold leading-tight">
          {t("about.hero_title")}<br/><span className="text-gradient-gold italic">{t("about.hero_title_accent")}</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
          {t("about.hero_desc")}
        </p>
      </section>

      <section className="container mx-auto px-4 pb-24 max-w-4xl space-y-6">
        {blocks.map((b) => (
          <div key={b.tKey} className="glass rounded-xl p-7 flex gap-5 hover:border-gold/40 transition-colors">
            <div className="h-12 w-12 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
              <b.icon className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold">{t(b.tKey)}</h3>
              <p className="text-muted-foreground mt-1">{t(b.dKey)}</p>
            </div>
          </div>
        ))}
      </section>
      <SiteFooter />
    </div>
  );
}
