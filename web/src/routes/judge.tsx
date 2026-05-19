/**
 * Базовая страница /judge — без токена.
 * Показывает инструкцию: как получить реальный токен судьи от админа.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Gavel, ShieldCheck, Smartphone } from "lucide-react";

export const Route = createFileRoute("/judge")({
  head: () => ({ meta: [{ title: "Төреші — Judo-Arena" }] }),
  component: JudgeIntro,
});

function JudgeIntro() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <section className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl text-center">
          <Gavel className="h-16 w-16 text-gold mx-auto mb-6" />
          <h1 className="font-display text-4xl sm:text-5xl font-bold mb-4">
            Төреші <span className="text-gradient-gold italic">панелі</span>
          </h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Төрешілерге арналған панель жекелеген бір реттік сілтеме арқылы ашылады.
            Әкімшіден сізге арналған URL алыңыз:
            <span className="block mt-2 font-mono text-gold text-sm">/judge/&lt;token&gt;</span>
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <Card icon={ShieldCheck} title="Қауіпсіздік">
              Тіркеу қажет емес. Әр матчқа бөлек сілтеме беріледі.
            </Card>
            <Card icon={Smartphone} title="Мобильді">
              Үлкен батырмалар, телефонда қолайлы.
            </Card>
            <Card icon={Gavel} title="IJF ережелері">
              Ippon, Waza-ari, Shido, Osaekomi таймері — бәрі автоматты.
            </Card>
          </div>

          <Link to="/login" className="mt-8 inline-block text-sm text-gold hover:underline">
            Әкімші ретінде кіру →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-5 text-left">
      <Icon className="h-8 w-8 text-gold mb-3" />
      <div className="font-display text-lg font-semibold mb-1">{title}</div>
      <div className="text-xs text-muted-foreground">{children}</div>
    </div>
  );
}
